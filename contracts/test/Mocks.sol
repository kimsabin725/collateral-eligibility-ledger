// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {INativeQueryVerifier, IEvmDecoder} from "../src/VaultAuthorityLedger.sol";

/// @notice Local stand-in for the BlockProver precompile; the real one is exercised in spike/scripts.
contract MockVerifier is INativeQueryVerifier {
    bool public shouldVerify = true;
    uint64 public txIndex;

    function setShouldVerify(bool v) external { shouldVerify = v; }
    function setTxIndex(uint64 i) external { txIndex = i; }

    function verifyAndEmit(uint64, uint64, bytes calldata, MerkleProof calldata, ContinuityProof calldata)
        external view returns (bool)
    {
        return shouldVerify;
    }

    function calculateTxIndex(MerkleProof calldata) external view returns (uint64) {
        return txIndex;
    }
}

/// @notice Stand-in for EvmV1Decoder that takes abi-encoded ReceiptFields so test cases are easy to build.
contract MockDecoder is IEvmDecoder {
    function decodeReceiptFields(bytes memory chunk) external pure returns (ReceiptFields memory) {
        return abi.decode(chunk, (ReceiptFields));
    }
}
