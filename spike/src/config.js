'use strict';
/**
 * Attestcoin (formerly USC) spike — network + contract configuration.
 *
 * Every value below was read from the official docs on 2026-08-17:
 *   https://docs.creditcoin.org/attestcoin-protocol/attestcoin-protocol-chains-environments
 * Re-verify before a competition submission; the docs page is the source of truth.
 */

/** Attestcoin "chainKey" values. NOTE: these are protocol-internal ids, NOT EVM chain ids. */
const CHAIN_KEY = {
  SEPOLIA: 1,
  ETH_MAINNET: 3, // only meaningful on CC3 Testnet; on CC3 Mainnet Ethereum mainnet is key 1
};

const CC3_TESTNET = {
  name: 'CC3 Testnet',
  evmChainId: 102031, // observed via eth_chainId on 2026-08-17
  rpcUrl: process.env.CREDITCOIN_RPC_URL || 'https://rpc.cc3-testnet.creditcoin.network',
  proofBuilderUrl:
    process.env.PROOF_BUILDER_URL || 'https://proof-gen-api.cc3-testnet.creditcoin.network',
  dashboardUrl: 'https://dashboard.cc3-testnet.creditcoin.network/',
  decoderContract: '0x731c345d79Fb8BbDC541f9DF3b6317585F849F9f',
  chainInfoPrecompile: '0x0000000000000000000000000000000000000FD3',
  blockProverPrecompile: '0x0000000000000000000000000000000000000FD2',
  /** Source chains this environment can attest, keyed by Attestcoin chainKey. */
  sourceChains: {
    [CHAIN_KEY.SEPOLIA]: {
      label: 'Ethereum Sepolia',
      evmChainId: 11155111,
      rpcUrl: process.env.SOURCE_CHAIN_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
      blockTimeSeconds: 12,
      free: true, // testnet ETH from a faucet
    },
    [CHAIN_KEY.ETH_MAINNET]: {
      label: 'Ethereum Mainnet',
      evmChainId: 1,
      rpcUrl: process.env.ETH_MAINNET_RPC_URL || 'https://ethereum-rpc.publicnode.com',
      blockTimeSeconds: 12,
      free: false, // real ETH required to originate a source transaction — avoid for the hackathon
    },
  },
};

/**
 * ABI of the BlockProver precompile (0x…0FD2).
 * Mirrors contracts/sol/VerifierInterface.sol in gluwa/usc-testnet-bridge-examples.
 * `verify` is the non-state-changing twin of `verifyAndEmit` documented in
 * docs.creditcoin.org/attestcoin-protocol/architecture — declared here so we can probe it
 * with eth_call. If a probe shows it is absent, fall back to eth_call against verifyAndEmit.
 */
const MERKLE_PROOF_T = '(bytes32 root, (bytes32 hash, bool isLeft)[] siblings)';
const CONTINUITY_PROOF_T = '(bytes32 lowerEndpointDigest, bytes32[] roots)';

const BLOCK_PROVER_ABI = [
  `function verifyAndEmit(uint64 chainKey, uint64 height, bytes encodedTransaction, ${MERKLE_PROOF_T} merkleProof, ${CONTINUITY_PROOF_T} continuityProof) returns (bool)`,
  `function verify(uint64 chainKey, uint64 height, bytes encodedTransaction, ${MERKLE_PROOF_T} merkleProof, ${CONTINUITY_PROOF_T} continuityProof) view returns (bool)`,
  `function calculateTxIndex(${MERKLE_PROOF_T} merkleProof) view returns (uint64)`,
];

module.exports = { CHAIN_KEY, CC3_TESTNET, BLOCK_PROVER_ABI };
