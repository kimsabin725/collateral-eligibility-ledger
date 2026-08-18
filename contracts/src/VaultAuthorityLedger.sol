// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// @notice Creditcoin BlockProver precompile (0x…0FD2). Verifies transaction inclusion and block
///         continuity. It does NOT check whether the transaction succeeded — the dApp must.
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

/// @notice EvmV1Decoder from @gluwa/usc-contracts, deployed separately.
///         NOTE: the decoder pre-deployed at the address in the official chains/environments page
///         is an older build; deploy your own from the npm package.
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

/**
 * @title VaultAuthorityLedger
 * @notice An append-only record of WHO was granted authority over a DeFi lending vault on
 *         Ethereum, and WHAT they subsequently did with depositor funds — admitted only on an
 *         Attestcoin proof of the underlying Ethereum transaction.
 *
 * @dev THE CENTRAL DESIGN POINT. MetaMorpho's `reallocate` is `onlyAllocatorRole`, which admits
 *      `isAllocator[sender] || sender == curator || sender == owner`. A single ReallocateSupply
 *      proof therefore shows only that *some address* moved funds — it does NOT identify a role.
 *      A role is attributed only when a separately-proven authority grant exists for the same
 *      (vault, actor) at a strictly earlier source block. Otherwise the role stays UNKNOWN.
 *      The ledger never guesses.
 *
 *      What this contract does NOT and CANNOT establish:
 *        - that the grant was never revoked before the action (absence is unprovable)
 *        - that the action was imprudent (judgement, not fact)
 *        - a complete history (only submitted events exist here)
 */
contract VaultAuthorityLedger {
    // ─────────────────────────────── types ───────────────────────────────

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

    // ────────────────────────────── storage ──────────────────────────────

    address public immutable owner;
    INativeQueryVerifier public immutable VERIFIER;
    IEvmDecoder public immutable DECODER;

    /// @dev keccak(chainKey, blockHeight, txIndex) — replay protection keyed by POSITION, so the
    ///      submitter cannot influence it. txIndex is recomputed on-chain by the precompile.
    mapping(bytes32 => bool) public processedQueries;

    /// @dev Emitter allowlist. Without this, anyone deploys a look-alike contract, emits
    ///      ReallocateSupply naming any actor, and proves it. Single most important check.
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

    // ─────────────────────────────── events ──────────────────────────────

    event VaultAllowed(address indexed vault, bool allowed);
    event AuthorityRecorded(
        uint256 indexed grantId, address indexed vault, address indexed actor,
        Role role, bool granted, uint64 srcBlock);
    event ActionRecorded(
        uint256 indexed recordId, address indexed vault, address indexed actor,
        Role roleAtAction, bytes32 market, uint256 assets, uint64 srcBlock);

    // ─────────────────────────────── errors ──────────────────────────────

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

    // ──────────────────────────── entry points ───────────────────────────

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
            // Only a positive grant establishes authority. Revocations are appended as history
            // but deliberately do not clear the pointer: we cannot prove absence either way, and
            // silently erasing a grant would misrepresent what was proven.
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

    // ──────────────────────────── verification ───────────────────────────

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

    /// @dev (4) event-signature/arity match and (5) emitter allowlist.
    ///
    ///      Non-matching logs are SKIPPED, not reverted on. Real source transactions are routinely
    ///      batched: the live mainnet grant we ingest (0x52ced076…) sets allocators across several
    ///      vaults in one transaction, and a busy allocation tx carried 48 logs. Reverting on the
    ///      first foreign emitter would make every such transaction unusable.
    ///
    ///      The security property is unchanged: a log from a non-allowlisted contract is never
    ///      recorded. If a transaction yields no allowlisted, signature-matching log at all, the
    ///      caller gets NoMatchingEvent and nothing is written.
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

    // ───────────────────────────── read paths ────────────────────────────

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
