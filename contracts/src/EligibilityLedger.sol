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
 * @title EligibilityLedger
 * @notice Records, on Creditcoin, that an asset-level event on a source chain has impaired the
 *         asset's usability as collateral — admitted only on an Attestcoin proof of the source
 *         transaction.
 *
 * @dev WHY THIS EXISTS. Institutional collateral is managed on two axes: price, and *eligibility*.
 *      When an issuer pauses redemptions or freezes an instrument, the asset stops being usable as
 *      collateral before its price moves. Onchain lending only has the price axis. Where the asset
 *      is controlled on one chain and lent against on another, the credit venue has no way to see
 *      the event at all — today it must trust a monitoring vendor or an oracle publisher.
 *
 *      This contract replaces that assertion with a proof the destination verifies itself.
 *
 *      WHAT IT DELIBERATELY DOES NOT CLAIM:
 *        - that an asset is healthy. Absence of an event is unprovable; NO_PROOF means only that
 *          nothing has been proven here.
 *        - a complete event history. Only submitted, proven events exist in this ledger.
 *        - real-time protection. Attestation lags the source chain by roughly 8–9 minutes, so this
 *          gates NEW credit, it does not block a transaction in flight.
 */
contract EligibilityLedger {
    // ─────────────────────────────── types ───────────────────────────────

    enum Status {
        NO_PROOF,  // nothing proven — NOT a statement that the asset is fine
        IMPAIRED,  // an impairment event has been proven
        RESTORED   // a restoration strictly later than the impairment has been proven
    }

    struct Asset {
        bool registered;
        uint64 chainKey;      // Attestcoin source-chain id the asset lives on
        uint64 impairedAt;    // EARLIEST proven impairment block (0 = none)
        uint64 restoredAt;    // proven restoration block, strictly later than impairedAt
        string label;
    }

    struct Event {
        address asset;
        bytes32 sig;
        bool impairment;      // false = restoration
        uint64 srcChainKey;
        uint64 srcBlock;
        uint64 admittedAt;    // Creditcoin block in which the proof was admitted
    }

    // ────────────────────────────── storage ──────────────────────────────

    address public immutable owner;
    INativeQueryVerifier public immutable VERIFIER;
    IEvmDecoder public immutable DECODER;

    /// @dev keccak(chainKey, blockHeight, txIndex) — keyed by POSITION, so a submitter cannot
    ///      influence it. txIndex is recomputed on-chain by the precompile.
    mapping(bytes32 => bool) public processedQueries;

    /// @dev Emitter allowlist. Without it anyone deploys a look-alike contract, emits Paused, and
    ///      proves it. This is the single most important check in the pipeline.
    mapping(address => Asset) public assets;

    /// @dev Which source-chain event signatures count as impairment / restoration.
    mapping(bytes32 => bool) public impairmentSig;
    mapping(bytes32 => bool) public restorationSig;

    Event[] public events;
    mapping(address => uint256[]) public eventsOfAsset;

    // ─────────────────────────────── events ──────────────────────────────

    event AssetRegistered(address indexed asset, uint64 chainKey, string label);
    event SignatureConfigured(bytes32 indexed sig, bool impairment, bool enabled);
    event Impaired(address indexed asset, bytes32 indexed sig, uint64 srcBlock, uint256 eventId);
    event Restored(address indexed asset, bytes32 indexed sig, uint64 srcBlock, uint256 eventId);
    event EventIgnored(address indexed asset, bytes32 indexed sig, uint64 srcBlock, string reason);

    // ─────────────────────────────── errors ──────────────────────────────

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

    // ──────────────────────────── configuration ──────────────────────────

    function registerAsset(address asset, uint64 chainKey, string calldata label)
        external onlyOwner
    {
        Asset storage a = assets[asset];
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

    // ──────────────────────────── entry point ────────────────────────────

    /// @notice Submit a proven source transaction. Every allowlisted log whose signature is a
    ///         configured impairment or restoration is recorded; everything else is skipped.
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
        IEvmDecoder.ReceiptFields memory receipt = _verify(
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

            // An asset is registered against exactly one source chain. A proof from another chain
            // naming the same address is a different contract and must not move this state.
            if (a.chainKey != chainKey) revert WrongChainKey(log.address_, a.chainKey, chainKey);

            if (isImpair) {
                _recordImpairment(a, log.address_, sig, chainKey, blockHeight);
            } else {
                _recordRestoration(a, log.address_, sig, chainKey, blockHeight);
            }
            unchecked { ++count; }
        }
        if (count == 0) revert NoMatchingEvent();
    }

    // ──────────────────────────── state machine ──────────────────────────

    function _recordImpairment(
        Asset storage a, address asset, bytes32 sig, uint64 chainKey, uint64 blockHeight
    ) internal {
        uint256 id = _append(asset, sig, true, chainKey, blockHeight);

        // Keep the EARLIEST proven impairment. A later proof must never push the cutoff forward:
        // credit extended after the first impairment was already extended against an impaired
        // asset, whether or not anyone had proven it yet.
        if (a.impairedAt == 0 || blockHeight < a.impairedAt) {
            a.impairedAt = blockHeight;
            // A restoration only survives if it is still strictly later than the impairment.
            if (a.restoredAt != 0 && a.restoredAt <= blockHeight) a.restoredAt = 0;
            emit Impaired(asset, sig, blockHeight, id);
        } else {
            emit EventIgnored(asset, sig, blockHeight, "later than earliest proven impairment");
        }
    }

    function _recordRestoration(
        Asset storage a, address asset, bytes32 sig, uint64 chainKey, uint64 blockHeight
    ) internal {
        uint256 id = _append(asset, sig, false, chainKey, blockHeight);

        // A restoration means nothing unless an impairment was proven first, and it must be
        // strictly later than that impairment.
        if (a.impairedAt == 0) {
            emit EventIgnored(asset, sig, blockHeight, "no impairment proven");
            return;
        }
        if (blockHeight <= a.impairedAt) {
            emit EventIgnored(asset, sig, blockHeight, "not later than impairment");
            return;
        }
        if (a.restoredAt != 0 && blockHeight <= a.restoredAt) {
            emit EventIgnored(asset, sig, blockHeight, "older than known restoration");
            return;
        }
        a.restoredAt = blockHeight;
        emit Restored(asset, sig, blockHeight, id);
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

    // ──────────────────────────── verification ───────────────────────────

    /// @dev Checks 1–3. Any failure reverts and writes nothing.
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

    // ───────────────────────────── read paths ────────────────────────────

    /// @notice Current status of an asset.
    /// @dev NO_PROOF is not a clean bill of health — see the contract-level notice.
    function statusOf(address asset) public view returns (Status) {
        Asset storage a = assets[asset];
        if (a.impairedAt == 0) return Status.NO_PROOF;
        if (a.restoredAt > a.impairedAt) return Status.RESTORED;
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
