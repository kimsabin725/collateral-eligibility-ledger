'use strict';
/**
 * Spike step 2 — prove the DECODE path read-only.
 *
 * A verified proof only tells you "this transaction was really in the source chain".
 * Business logic needs the contents: did it succeed, which contract emitted which event,
 * with what arguments. That is EvmV1Decoder's job.
 *
 * The decoder library is already deployed on CC3 Testnet, and its functions are
 * `public pure`, so we can exercise every one of them through eth_call — again with no
 * wallet and no gas.
 *
 * Usage: node scripts/02-decode-readonly.js [txHash]
 */

const { ethers } = require('ethers');
const { CHAIN_KEY, CC3_TESTNET } = require('../src/config');
const { ProofBuilderClient } = require('../src/proofClient');

const LOG_ENTRY_T = '(address address_, bytes32[] topics, bytes data)';
const RECEIPT_T = `(uint8 receiptStatus, uint64 receiptGasUsed, ${LOG_ENTRY_T}[] receiptLogs, bytes receiptLogsBloom)`;
const COMMON_T =
  '(uint64 nonce, uint64 gasLimit, address from, bool toIsNull, address to, uint256 value, bytes data)';

const DECODER_ABI = [
  'function getTransactionType(bytes encodedTx) pure returns (uint8)',
  'function isValidTransactionType(uint8 txType) pure returns (bool)',
  `function decodeReceiptFields(bytes chunk) pure returns (${RECEIPT_T})`,
  `function decodeCommonTxFields(bytes chunk) pure returns (${COMMON_T})`,
  `function getLogsByEventSignature(${RECEIPT_T} receipt, bytes32 eventSignature) pure returns (${LOG_ENTRY_T}[])`,
];

async function main() {
  const proofs = new ProofBuilderClient();
  const cc3 = new ethers.JsonRpcProvider(CC3_TESTNET.rpcUrl);
  const decoder = new ethers.Contract(CC3_TESTNET.decoderContract, DECODER_ABI, cc3);

  console.log('=== Attestcoin decode-path spike ===\n');
  console.log('Decoder contract     :', CC3_TESTNET.decoderContract);

  const attested = await proofs.attestedHeight(CHAIN_KEY.SEPOLIA);
  const sourceProvider = new ethers.JsonRpcProvider(
    CC3_TESTNET.sourceChains[CHAIN_KEY.SEPOLIA].rpcUrl);

  // Find a transaction that actually emitted logs, so the log-decoding path is exercised.
  let txHash = process.argv[2];
  if (!txHash) {
    const block = await sourceProvider.getBlock(attested - 500, true);
    for (const t of block.prefetchedTransactions) {
      const r = await sourceProvider.getTransactionReceipt(t.hash);
      if (r && r.logs.length > 0) { txHash = t.hash; break; }
    }
  }
  console.log('Sample tx            :', txHash);

  const proof = await proofs.proofByTxHash(CHAIN_KEY.SEPOLIA, txHash);
  const txBytes = proof.txBytes;

  const txType = await decoder.getTransactionType(txBytes);
  console.log('getTransactionType() :', txType.toString(),
    '| valid:', await decoder.isValidTransactionType(txType));

  const common = await decoder.decodeCommonTxFields(txBytes);
  console.log('\n-- CommonTxFields --');
  console.log('  from   :', common.from);
  console.log('  to     :', common.toIsNull ? '(contract creation)' : common.to);
  console.log('  value  :', ethers.formatEther(common.value), 'ETH');
  console.log('  nonce  :', common.nonce.toString());
  console.log('  calldata bytes:', (common.data.length - 2) / 2);

  const receipt = await decoder.decodeReceiptFields(txBytes);
  console.log('\n-- ReceiptFields --');
  console.log('  receiptStatus  :', receipt.receiptStatus.toString(),
    receipt.receiptStatus === 1n ? '(✅ success — this is the check the docs say dApps MUST do)' : '(⚠️ failed tx)');
  console.log('  gasUsed        :', receipt.receiptGasUsed.toString());
  console.log('  logs           :', receipt.receiptLogs.length);

  for (const [i, log] of receipt.receiptLogs.slice(0, 3).entries()) {
    console.log(`   [${i}] emitter=${log.address_} topics=${log.topics.length} dataBytes=${(log.data.length - 2) / 2}`);
    if (log.topics.length) console.log(`        topic0=${log.topics[0]}`);
  }

  // Cross-check the decoded values against the source chain's own RPC.
  const truth = await sourceProvider.getTransactionReceipt(txHash);
  console.log('\n-- Cross-check vs Sepolia RPC --');
  console.log('  status  onchain/decoded:', truth.status, '/', receipt.receiptStatus.toString(),
    String(truth.status) === receipt.receiptStatus.toString() ? '✅' : '❌');
  console.log('  gasUsed onchain/decoded:', truth.gasUsed.toString(), '/', receipt.receiptGasUsed.toString(),
    truth.gasUsed === receipt.receiptGasUsed ? '✅' : '❌');
  console.log('  logs    onchain/decoded:', truth.logs.length, '/', receipt.receiptLogs.length,
    truth.logs.length === receipt.receiptLogs.length ? '✅' : '❌');

  // Event-signature filtering: the primitive every ASC uses to find "its" event.
  // ethers returns a frozen Result; deep-copy to plain JS before passing it back as input.
  if (receipt.receiptLogs.length) {
    const plainReceipt = [
      receipt.receiptStatus,
      receipt.receiptGasUsed,
      receipt.receiptLogs.map((l) => [l.address_, [...l.topics], l.data]),
      receipt.receiptLogsBloom,
    ];
    const sig = receipt.receiptLogs[0].topics[0];
    try {
      const matched = await decoder.getLogsByEventSignature(plainReceipt, sig);
      console.log('\ngetLogsByEventSignature(topic0 of log[0]) ->', matched.length, 'log(s)',
        matched.length > 0 ? '✅' : '❌');

      const noise = ethers.id('DefinitelyNotAnEventInThisTx(uint256)');
      const none = await decoder.getLogsByEventSignature(plainReceipt, noise);
      console.log('getLogsByEventSignature(unrelated signature) ->', none.length, 'log(s)',
        none.length === 0 ? '✅ correctly filters' : '❌');
    } catch {
      // KNOWN DISCREPANCY (verified 2026-08-17 by selector inspection of the deployed bytecode):
      // the decoder pre-deployed at the address in the chains/environments doc is an OLDER build
      // that lacks BOTH getLogsByEventSignature overloads present in @gluwa/usc-contracts@0.1.2.
      // Not a blocker: the official loan-flow tutorial deploys its own EvmV1Decoder library and
      // links it, which is what we will do too. Filtering by topics[0] in our own contract is
      // trivial regardless.
      console.log('\ngetLogsByEventSignature -> ⚠️  absent from the pre-deployed decoder at');
      console.log('   ', CC3_TESTNET.decoderContract);
      console.log('    Deploy EvmV1Decoder from @gluwa/usc-contracts yourself (as the official');
      console.log('    loan-flow tutorial does) to get the current ABI. See FINDINGS.md §5.');
    }
  }
}

main().catch((e) => {
  console.error('\nFAILED:', e);
  process.exit(1);
});
