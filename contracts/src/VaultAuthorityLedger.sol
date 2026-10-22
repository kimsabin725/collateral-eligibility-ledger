// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// @notice BlockProver precompile (0x…0FD2): checks inclusion and continuity, not transaction success.
interface INativeQueryVerifier {
    struct MerkleProofEntry { bytes32 hash; bool isLeft; }
    struct MerkleProof { bytes32 root; MerkleProofEntry[] siblings; }
    struct ContinuityProof { bytes32 lowerEndpointDigest; bytes32[] roots; }

    function verifyAndEmit(
        uint64 chainKey,
        uint64 height,
        bytes calldata encodedTransaction,
        MerkleProof calldata merkleProof,
        ContinuityProof calldata continuityProof
    ) external returns (bool);

    function calculateTxIndex(MerkleProof calldata merkleProof) external view returns (uint64);
}

/// @notice EvmV1Decoder from @gluwa/usc-contracts; deploy your own, the pre-deployed one is an older build.
interface IEvmDecoder {
    struct LogEntry { address address_; bytes32[] topics; bytes data; }
    struct ReceiptFields {
        uint8 receiptStatus;
        uint64 receiptGasUsed;
        LogEntry[] receiptLogs;
        bytes receiptLogsBloom;
    }
    function decodeReceiptFields(bytes memory chunk) external pure returns (ReceiptFields memory);
}

/// @title VaultAuthorityLedger
/// @notice Append-only record of who was granted authority over a lending vault and what they did, admitted only on Attestcoin proofs.
/// @dev A ReallocateSupply proof alone does not identify a role; a role comes only from a proven, strictly earlier grant for the same (vault, actor).
contract VaultAuthorityLedger {

    enum Role { UNKNOWN, OWNER, CURATOR, ALLOCATOR }

    struct RoleGrant {
        address vault;
        address actor;
        Role role;
        bool granted;        // false = revocation
        uint64 srcChainKey;
        uint64 srcBlock;
        bytes32 srcTxHash;   // informational; not part of replay protection
    }

    struct ActionRecord {
        address vault;
        address actor;
        Role roleAtAction;   // ALLOCATOR only if a prior grant proof exists
        bytes32 market;
        uint256 assets;
        uint64 srcChainKey;
        uint64 srcBlock;
    }


    address public immutable owner;
    INativeQueryVerifier public immutable VERIFIER;
    IEvmDecoder public immutable DECODER;

    /// @dev Replay key keccak(chainKey, blockHeight, txIndex): keyed by position so the submitter cannot influence it.
    mapping(bytes32 => bool) public processedQueries;

    /// @dev Emitter allowlist; without it anyone could prove an event from a look-alike contract.
    mapping(address => bool) public knownVaults;

    RoleGrant[] public grants;
    ActionRecord[] public records;

    /// @dev (vault, actor) => 1-based index into `grants` of the latest GRANT seen. 0 = none.
    mapping(bytes32 => uint256) private _latestGrant;
    mapping(address => uint256[]) public actionsOfActor;
    mapping(address => uint256[]) public grantsOfActor;

    // Event signatures on the source chain (MetaMorpho / Vault V1).
    bytes32 public constant SET_IS_ALLOCATOR =
        keccak256("SetIsAllocator(address,bool)");
    bytes32 public constant REALLOCATE_SUPPLY =
        keccak256("ReallocateSupply(address,bytes32,uint256,uint256)");


    event VaultAllowed(address indexed vault, bool allowed);
    event AuthorityRecorded(
        uint256 indexed grantId, address indexed vault, address indexed actor,
        Role role, bool granted, uint64 srcBlock);
    event ActionRecorded(
        uint256 indexed recordId, address indexed vault, address indexed actor,
        Role roleAtAction, bytes32 market, uint256 assets, uint64 srcBlock);


    error NotOwner();
    error ProofRejected();
    error SourceTxFailed(uint8 status);
    error VaultNotAllowed(address vault);
    error NoMatchingEvent();
    error QueryAlreadyProcessed(bytes32 queryId);

    constructor(address verifier, address decoder) {
        owner = msg.sender;
        VERIFIER = INativeQueryVerifier(verifier);
        DECODER = IEvmDecoder(decoder);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function setKnownVault(address vault, bool allowed) external onlyOwner {
        knownVaults[vault] = allowed;
        emit VaultAllowed(vault, allowed);
    }


    /// @notice Ingest an authority grant/revocation (MetaMorpho `SetIsAllocator`).
    /// @dev Parameter shape follows the documented ASC entry-point pattern (flattened proof).
    function submitAuthority(
        uint64 chainKey,
        uint64 blockHeight,
        bytes calldata encodedTransaction,
        bytes32 merkleRoot,
        INativeQueryVerifier.MerkleProofEntry[] calldata siblings,
        bytes32 lowerEndpointDigest,
        bytes32[] calldata continuityRoots
    ) external returns (uint256 count) {
        IEvmDecoder.ReceiptFields memory receipt = _verify(
            chainKey, blockHeight, encodedTransaction,
            merkleRoot, siblings, lowerEndpointDigest, continuityRoots);

        for (uint256 i; i < receipt.receiptLogs.length; ++i) {
            IEvmDecoder.LogEntry memory log = receipt.receiptLogs[i];
            if (!_isTarget(log, SET_IS_ALLOCATOR, 2)) continue;

            address vault = log.address_;
            address actor = address(uint160(uint256(log.topics[1])));
            bool granted = log.data.length >= 32 && uint256(bytes32(log.data)) == 1;

            grants.push(RoleGrant({
                vault: vault, actor: actor, role: Role.ALLOCATOR, granted: granted,
                srcChainKey: chainKey, srcBlock: blockHeight, srcTxHash: bytes32(0)
            }));
            uint256 gid = grants.length - 1;
            grantsOfActor[actor].push(gid);
            // Revocations are kept as history but do not clear the pointer: absence is unprovable either way.
            if (granted) _latestGrant[_key(vault, actor)] = gid + 1;

            emit AuthorityRecorded(gid, vault, actor, Role.ALLOCATOR, granted, blockHeight);
            unchecked { ++count; }
        }
        if (count == 0) revert NoMatchingEvent();
    }

    /// @notice Ingest an execution action (MetaMorpho `ReallocateSupply`).
    function submitAction(
        uint64 chainKey,
        uint64 blockHeight,
        bytes calldata encodedTransaction,
        bytes32 merkleRoot,
        INativeQueryVerifier.MerkleProofEntry[] calldata siblings,
        bytes32 lowerEndpointDigest,
        bytes32[] calldata continuityRoots
    ) external returns (uint256 count) {
        IEvmDecoder.ReceiptFields memory receipt = _verify(
            chainKey, blockHeight, encodedTransaction,
            merkleRoot, siblings, lowerEndpointDigest, continuityRoots);

        for (uint256 i; i < receipt.receiptLogs.length; ++i) {
            IEvmDecoder.LogEntry memory log = receipt.receiptLogs[i];
            if (!_isTarget(log, REALLOCATE_SUPPLY, 3)) continue;

            address vault = log.address_;
            address actor = address(uint160(uint256(log.topics[1])));

            records.push(ActionRecord({
                vault: vault,
                actor: actor,
                roleAtAction: _roleAt(vault, actor, chainKey, blockHeight),
                market: log.topics[2],
                assets: log.data.length >= 32 ? uint256(bytes32(log.data)) : 0,
                srcChainKey: chainKey,
                srcBlock: blockHeight
            }));
            uint256 rid = records.length - 1;
            actionsOfActor[actor].push(rid);

            ActionRecord memory r = records[rid];
            emit ActionRecorded(rid, vault, actor, r.roleAtAction, r.market, r.assets, blockHeight);
            unchecked { ++count; }
        }
        if (count == 0) revert NoMatchingEvent();
    }


    /// @dev The five mandatory checks, in order. Any failure reverts and writes nothing.
    function _verify(
        uint64 chainKey,
        uint64 blockHeight,
        bytes calldata encodedTransaction,
        bytes32 merkleRoot,
        INativeQueryVerifier.MerkleProofEntry[] calldata siblings,
        bytes32 lowerEndpointDigest,
        bytes32[] calldata continuityRoots
    ) internal returns (IEvmDecoder.ReceiptFields memory receipt) {
        INativeQueryVerifier.MerkleProof memory mp =
            INativeQueryVerifier.MerkleProof({root: merkleRoot, siblings: siblings});
        INativeQueryVerifier.ContinuityProof memory cp =
            INativeQueryVerifier.ContinuityProof({
                lowerEndpointDigest: lowerEndpointDigest, roots: continuityRoots});

        // (1) replay protection, keyed by position
        bytes32 queryId = keccak256(
            abi.encodePacked(chainKey, blockHeight, VERIFIER.calculateTxIndex(mp)));
        if (processedQueries[queryId]) revert QueryAlreadyProcessed(queryId);

        // (2) inclusion + continuity
        if (!VERIFIER.verifyAndEmit(chainKey, blockHeight, encodedTransaction, mp, cp)) {
            revert ProofRejected();
        }
        processedQueries[queryId] = true;

        // (3) transaction success — the precompile does NOT check this
        receipt = DECODER.decodeReceiptFields(encodedTransaction);
        if (receipt.receiptStatus != 1) revert SourceTxFailed(receipt.receiptStatus);
    }

    /// @dev (4) event signature/arity and (5) emitter allowlist. Non-matching logs are skipped, not reverted on,
    ///      because real transactions batch logs from many vaults.
    function _isTarget(IEvmDecoder.LogEntry memory log, bytes32 sig, uint256 minTopics)
        internal view returns (bool)
    {
        if (log.topics.length < minTopics || log.topics[0] != sig) return false;
        return knownVaults[log.address_];
    }

    /// @dev Attribute a role ONLY from a proven grant that is strictly earlier on the same chain.
    function _roleAt(address vault, address actor, uint64 chainKey, uint64 blockHeight)
        internal view returns (Role)
    {
        uint256 ptr = _latestGrant[_key(vault, actor)];
        if (ptr == 0) return Role.UNKNOWN;
        RoleGrant storage g = grants[ptr - 1];
        if (g.srcChainKey != chainKey) return Role.UNKNOWN;
        if (g.srcBlock >= blockHeight) return Role.UNKNOWN; // grant must PRECEDE the action
        return g.role;
    }

    function _key(address vault, address actor) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(vault, actor));
    }


    function recordCount() external view returns (uint256) { return records.length; }
    function grantCount() external view returns (uint256) { return grants.length; }

    function actionsOf(address actor) external view returns (uint256[] memory) {
        return actionsOfActor[actor];
    }
    function grantsOf(address actor) external view returns (uint256[] memory) {
        return grantsOfActor[actor];
    }
    function getRecord(uint256 id) external view returns (ActionRecord memory) {
        return records[id];
    }
    function getGrant(uint256 id) external view returns (RoleGrant memory) {
        return grants[id];
    }
}
