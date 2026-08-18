'use strict';
/**
 * Spike step 1 — prove the READ path end-to-end with no wallet, no gas, no deployment.
 *
 *   Sepolia transaction
 *     -> Proof Builder (Merkle inclusion + block continuity proof)
 *     -> Creditcoin BlockProver precompile, invoked via eth_call
 *     -> boolean verdict
 *
 * Because eth_call executes against real chain state without submitting a transaction,
 * this exercises the genuine on-chain verifier. A `true` here means the whole readability
 * path is live for us today.
 *
 * Usage: node scripts/01-verify-readonly.js [txHash]
 */

const { ethers } = require('ethers');
const { CHAIN_KEY, CC3_TESTNET, BLOCK_PROVER_ABI } = require('../src/config');
const { ProofBuilderClient, toVerifierArgs } = require('../src/proofClient');

const chainKey = CHAIN_KEY.SEPOLIA;
const source = CC3_TESTNET.sourceChains[chainKey];

async function pickSampleTx(attestedHeight) {
  // Reach well below the attested tip so the block is unambiguously final and attested.
  const target = attestedHeight - 500;
  const provider = new ethers.JsonRpcProvider(source.rpcUrl);
  const block = await provider.getBlock(target);
  if (!block || block.transactions.length === 0) {
    throw new Error(`No transactions in Sepolia block ${target}`);
  }
  return { txHash: block.transactions[0], blockNumber: target };
}

async function main() {
  const proofs = new ProofBuilderClient();
  const cc3 = new ethers.JsonRpcProvider(CC3_TESTNET.rpcUrl);
  const prover = new ethers.Contract(CC3_TESTNET.blockProverPrecompile, BLOCK_PROVER_ABI, cc3);

  console.log('=== Attestcoin read-path spike ===\n');

  const [health, attested, net] = await Promise.all([
    proofs.health(),
    proofs.attestedHeight(chainKey),
    cc3.getNetwork(),
  ]);
  console.log('Proof builder health :', health.status,
    `(cc3_rpc=${health.cc3_rpc_connected}, eth_rpc=${health.eth_rpc_connected})`);
  console.log('Creditcoin chainId   :', net.chainId.toString());

  const sourceProvider = new ethers.JsonRpcProvider(source.rpcUrl);
  const head = await sourceProvider.getBlockNumber();
  const lag = head - attested;
  console.log(`${source.label} head   :`, head);
  console.log('Attested height      :', attested);
  console.log(`Attestation lag      : ${lag} blocks (~${((lag * source.blockTimeSeconds) / 60).toFixed(1)} min)\n`);

  const txHash = process.argv[2] || (await pickSampleTx(attested)).txHash;
  console.log('Proving tx           :', txHash);

  const t0 = Date.now();
  const proof = await proofs.proofByTxHash(chainKey, txHash);
  console.log(`Proof fetched        : ${Date.now() - t0} ms (cached=${proof.cached})`);
  console.log('  block / txIndex    :', proof.headerNumber, '/', proof.txIndex);
  console.log('  txBytes length     :', (proof.txBytes.length - 2) / 2, 'bytes');
  console.log('  continuity roots   :', proof.continuityProof.roots.length);
  console.log('  merkle siblings    :', proof.merkleProof.siblings.length, '\n');

  const a = toVerifierArgs(proof);

  // calculateTxIndex is a pure view call — confirms our tuple encoding matches the precompile.
  const derivedIndex = await prover.calculateTxIndex(a.merkleProof);
  console.log('calculateTxIndex()   :', derivedIndex.toString(),
    derivedIndex.toString() === String(proof.txIndex) ? '✅ matches proof' : '❌ MISMATCH');

  // The real verification. Try the documented read-only `verify`, then fall back to
  // eth_call against the state-changing `verifyAndEmit` (eth_call never commits state).
  let verified;
  let via;
  try {
    verified = await prover.verify(a.chainKey, a.height, a.encodedTransaction, a.merkleProof, a.continuityProof);
    via = 'verify() [view]';
  } catch (err) {
    console.log('verify() unavailable :', err.shortMessage || err.message);
    verified = await prover.verifyAndEmit.staticCall(
      a.chainKey, a.height, a.encodedTransaction, a.merkleProof, a.continuityProof);
    via = 'verifyAndEmit() [eth_call]';
  }
  console.log(`Verification via ${via}: ${verified ? '✅ TRUE' : '❌ FALSE'}\n`);

  // Negative control: a tampered continuity endpoint must not verify.
  const bad = JSON.parse(JSON.stringify(proof));
  bad.continuityProof.lowerEndpointDigest = '0x' + '11'.repeat(32);
  const b = toVerifierArgs(bad);
  try {
    const badResult = await prover.verifyAndEmit.staticCall(
      b.chainKey, b.height, b.encodedTransaction, b.merkleProof, b.continuityProof);
    console.log('Tampered proof       :', badResult ? '❌ accepted (BAD)' : '✅ rejected (returned false)');
  } catch (err) {
    console.log('Tampered proof       : ✅ rejected (reverted:', (err.shortMessage || err.message).slice(0, 80) + ')');
  }
}

main().catch((e) => {
  console.error('\nFAILED:', e);
  process.exit(1);
});
