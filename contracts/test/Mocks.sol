// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {INativeQueryVerifier, IEvmDecoder} from "../src/VaultAuthorityLedger.sol";

/// @notice Stand-in for the Creditcoin BlockProver precompile (0x…0FD2), which does not exist on a
///         local EVM. The real precompile is already proven to work — see spike/scripts/01–06,
///         where `verify()` returned TRUE for real mainnet transactions and reverted on a tampered
///         continuity proof. These mocks exist to test the APPLICATION logic around it.
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

/// @notice Stand-in for EvmV1Decoder. The real decoder parses RLP transaction bytes; for tests we
///         pass an abi-encoded ReceiptFields directly so cases are easy to construct. The real
///         decoder's behaviour is already verified against Ethereum's own RPC in spike/scripts/02.
contract MockDecoder is IEvmDecoder {
    function decodeReceiptFields(bytes memory chunk) external pure returns (ReceiptFields memory) {
        return abi.decode(chunk, (ReceiptFields));
    }
}
