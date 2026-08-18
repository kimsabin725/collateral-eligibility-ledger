// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {INativeQueryVerifier, IEvmDecoder} from "../src/EligibilityLedger.sol";

/// @notice Stand-in for the Creditcoin BlockProver precompile (0x…0FD2), absent on a local EVM.
///         The real precompile is already proven against real mainnet data in spike/scripts/01–06
///         (verify() TRUE on genuine txs, revert on a tampered continuity proof). These mocks test
///         the APPLICATION logic layered on top.
contract MockVerifier2 is INativeQueryVerifier {
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

/// @notice Stand-in for EvmV1Decoder. Tests pass an abi-encoded ReceiptFields directly so cases are
///         easy to construct; the real decoder is exercised in realdata-eligibility.test.js.
contract MockDecoder2 is IEvmDecoder {
    function decodeReceiptFields(bytes memory chunk) external pure returns (ReceiptFields memory) {
        return abi.decode(chunk, (ReceiptFields));
    }
}

/// @notice Minimal ERC-20 for the credit-venue tests. No permit, no hooks — just balances.
contract MockERC20 {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory n, string memory s) { name = n; symbol = s; }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        if (a != type(uint256).max) allowance[from][msg.sender] = a - amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}
