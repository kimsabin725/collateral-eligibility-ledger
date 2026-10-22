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

/// @notice EvmV1Decoder from @gluwa/usc-contracts, deployed separately.
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

/// @title EligibilityLedger
/// @notice Records on Creditcoin that a proven source-chain event impaired an asset's use as collateral.
/// @dev NO_PROOF means nothing was proven, not that the asset is healthy; attestation lags ~8–9 min, so this gates new credit only.
contract EligibilityLedger {

    enum Status {
        NO_PROOF,  // nothing proven — NOT a statement that the asset is fine
        IMPAIRED,  // an impairment event has been proven
        RESTORED   // a restoration strictly later than the impairment has been proven
    }

    struct Asset {
        bool registered;
        uint64 chainKey;      // Attestcoin source-chain id the asset lives on
        uint64 impairedAt;    // EARLIEST proven impairment block (0 = none)
        uint64 restoredAt;    // latest proven restoration block (may precede latest impairment)
        string label;
    }

    struct LatestEvent {
        bool seen;
        bool hasImpairment;
        bool impairment;
        uint64 blockHeight;
        uint64 txIndex;
        uint256 logIndex;
    }

    struct Event {
        address asset;
        bytes32 sig;
        bool impairment;      // false = restoration
        uint64 srcChainKey;
        uint64 srcBlock;
        uint64 admittedAt;    // Creditcoin block in which the proof was admitted
    }


    address public immutable owner;
    INativeQueryVerifier public immutable VERIFIER;
    IEvmDecoder public immutable DECODER;

    /// @dev Replay key keccak(chainKey, blockHeight, txIndex): keyed by position so a submitter cannot influence it.
    mapping(bytes32 => bool) public processedQueries;

    /// @dev Emitter allowlist; without it anyone could prove a Paused event from a look-alike contract.
    mapping(address => Asset) public assets;
    mapping(address => LatestEvent) public latestEvents;

    /// @dev Which source-chain event signatures count as impairment / restoration.
    mapping(bytes32 => bool) public impairmentSig;
    mapping(bytes32 => bool) public restorationSig;

    Event[] public events;
    mapping(address => uint256[]) public eventsOfAsset;


    event AssetRegistered(address indexed asset, uint64 chainKey, string label);
    event SignatureConfigured(bytes32 indexed sig, bool impairment, bool enabled);
    event Impaired(address indexed asset, bytes32 indexed sig, uint64 srcBlock, uint256 eventId);
    event Restored(address indexed asset, bytes32 indexed sig, uint64 srcBlock, uint256 eventId);
    event EventIgnored(address indexed asset, bytes32 indexed sig, uint64 srcBlock, string reason);


    error NotOwner();
    error ProofRejected();
    error SourceTxFailed(uint8 status);
    error NoMatchingEvent();
    error QueryAlreadyProcessed(bytes32 queryId);
    error WrongChainKey(address asset, uint64 expected, uint64 got);

    constructor(address verifier, address decoder) {
        owner = msg.sender;
        VERIFIER = INativeQueryVerifier(verifier);
        DECODER = IEvmDecoder(decoder);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }


    function registerAsset(address asset, uint64 chainKey, string calldata label)
        external onlyOwner
    {
        Asset storage a = assets[asset];
        if (a.registered && a.chainKey != chainKey) {
            revert WrongChainKey(asset, a.chainKey, chainKey);
        }
        a.registered = true;
        a.chainKey = chainKey;
        a.label = label;
        emit AssetRegistered(asset, chainKey, label);
    }

    function setImpairmentSignature(bytes32 sig, bool enabled) external onlyOwner {
        impairmentSig[sig] = enabled;
        emit SignatureConfigured(sig, true, enabled);
    }

    function setRestorationSignature(bytes32 sig, bool enabled) external onlyOwner {
        restorationSig[sig] = enabled;
        emit SignatureConfigured(sig, false, enabled);
    }


    /// @notice Submit a proven source tx; allowlisted impairment/restoration logs are recorded, the rest skipped.
    /// @dev Parameter shape follows the documented ASC entry-point pattern (flattened proof).
    function submitEvent(
        uint64 chainKey,
        uint64 blockHeight,
        bytes calldata encodedTransaction,
        bytes32 merkleRoot,
        INativeQueryVerifier.MerkleProofEntry[] calldata siblings,
        bytes32 lowerEndpointDigest,
        bytes32[] calldata continuityRoots
    ) external returns (uint256 count) {
        (IEvmDecoder.ReceiptFields memory receipt, uint64 txIndex) = _verify(
            chainKey, blockHeight, encodedTransaction,
            merkleRoot, siblings, lowerEndpointDigest, continuityRoots);

        for (uint256 i; i < receipt.receiptLogs.length; ++i) {
            IEvmDecoder.LogEntry memory log = receipt.receiptLogs[i];
            if (log.topics.length == 0) continue;

            Asset storage a = assets[log.address_];
            if (!a.registered) continue;                 // (5) emitter allowlist

            bytes32 sig = log.topics[0];
            bool isImpair = impairmentSig[sig];
            bool isRestore = restorationSig[sig];
            if (!isImpair && !isRestore) continue;       // (4) signature match

            // An asset belongs to one source chain; the same address on another chain is a different contract.
            if (a.chainKey != chainKey) revert WrongChainKey(log.address_, a.chainKey, chainKey);

            _recordEvent(a, log.address_, sig, isImpair, blockHeight, txIndex, i);
            unchecked { ++count; }
        }
        if (count == 0) revert NoMatchingEvent();
    }


    /// @dev Keep even an early-arriving restoration so proof delivery order cannot change the final status.
    function _recordEvent(
        Asset storage a, address asset, bytes32 sig, bool impairment,
        uint64 blockHeight, uint64 txIndex, uint256 logIndex
    ) internal {
        uint256 id = _append(asset, sig, impairment, a.chainKey, blockHeight);
        LatestEvent storage latest = latestEvents[asset];
        if (impairment) {
            if (!latest.hasImpairment || blockHeight < a.impairedAt) a.impairedAt = blockHeight;
            latest.hasImpairment = true;
        } else if (blockHeight > a.restoredAt) {
            a.restoredAt = blockHeight;
        }

        // Position is derived from the verified proof and decoded receipt, never caller metadata.
        bool newer = !latest.seen || blockHeight > latest.blockHeight ||
            (blockHeight == latest.blockHeight && (txIndex > latest.txIndex ||
                (txIndex == latest.txIndex && logIndex > latest.logIndex)));
        if (!newer) {
            emit EventIgnored(asset, sig, blockHeight, "older than latest proven event");
            return;
        }
        latest.seen = true;
        latest.impairment = impairment;
        latest.blockHeight = blockHeight;
        latest.txIndex = txIndex;
        latest.logIndex = logIndex;
        if (impairment) emit Impaired(asset, sig, blockHeight, id);
        else emit Restored(asset, sig, blockHeight, id);
    }

    function _append(
        address asset, bytes32 sig, bool impairment, uint64 chainKey, uint64 blockHeight
    ) internal returns (uint256 id) {
        events.push(Event({
            asset: asset, sig: sig, impairment: impairment,
            srcChainKey: chainKey, srcBlock: blockHeight, admittedAt: uint64(block.number)
        }));
        id = events.length - 1;
        eventsOfAsset[asset].push(id);
    }


    /// @dev Checks 1–3. Any failure reverts and writes nothing.
    function _verify(
        uint64 chainKey,
        uint64 blockHeight,
        bytes calldata encodedTransaction,
        bytes32 merkleRoot,
        INativeQueryVerifier.MerkleProofEntry[] calldata siblings,
        bytes32 lowerEndpointDigest,
        bytes32[] calldata continuityRoots
    ) internal returns (IEvmDecoder.ReceiptFields memory receipt, uint64 txIndex) {
        INativeQueryVerifier.MerkleProof memory mp =
            INativeQueryVerifier.MerkleProof({root: merkleRoot, siblings: siblings});
        INativeQueryVerifier.ContinuityProof memory cp =
            INativeQueryVerifier.ContinuityProof({
                lowerEndpointDigest: lowerEndpointDigest, roots: continuityRoots});

        // (1) replay protection, keyed by position
        txIndex = VERIFIER.calculateTxIndex(mp);
        bytes32 queryId = keccak256(abi.encodePacked(chainKey, blockHeight, txIndex));
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


    /// @notice Current status of an asset.
    /// @dev NO_PROOF is not a clean bill of health — see the contract-level notice.
    function statusOf(address asset) public view returns (Status) {
        LatestEvent storage latest = latestEvents[asset];
        if (!latest.hasImpairment) return Status.NO_PROOF;
        if (!latest.impairment) return Status.RESTORED;
        return Status.IMPAIRED;
    }

    /// @notice The gate a credit venue calls. True = do not extend new credit against this asset.
    function isCreditGated(address asset) external view returns (bool) {
        return statusOf(asset) == Status.IMPAIRED;
    }

    function impairedSince(address asset) external view returns (uint64) {
        return assets[asset].impairedAt;
    }

    function eventCount() external view returns (uint256) { return events.length; }

    function eventsOf(address asset) external view returns (uint256[] memory) {
        return eventsOfAsset[asset];
    }

    function getEvent(uint256 id) external view returns (Event memory) { return events[id]; }
}
