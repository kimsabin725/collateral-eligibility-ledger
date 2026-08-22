'use strict';
/**
 * Negative demo — what the deployed ledger REFUSES, on CC3 Testnet.
 *
 *   node scripts/demo-rejections.js
 *
 * The positive path (deploy-eligibility.js) shows a real Ethereum impairment gating credit.
 * This shows the other half: four ways to get a wrong or unauthorised event into the ledger,
 * each rejected on-chain by a different check, with the ledger's state unchanged afterwards.
 *
 * Two are caught by this contract's application checks, and two never reach it at all — the
 * BlockProver precompile reverts inside the Creditcoin runtime first.
 *
 *   A. replay          — resubmit the exact proof already admitted
 *                        → QueryAlreadyProcessed                      [ledger]
 *   B. wrong emitter   — a valid proof of an UNRELATED real mainnet tx
 *                        whose logs come from non-allowlisted contracts
 *                        → NoMatchingEvent                            [ledger]
 *   C. forged proof    — the same bundle, Merkle root off by one bit
 *                        → "Merkle proof validation failed"           [precompile 0x…0FD2]
 *   D. wrong chain     — the real mainnet proof, re-labelled as Sepolia
 *                        → "Continuity proof does not match …"        [precompile 0x…0FD2]
 *
 * Every case runs as eth_call against the LIVE contracts in ../deployment.json, so nothing
 * here can write. The final read-back proves the state never moved.
 */

const path = require('path');
const { ethers } = require('ethers');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const artifacts = require('../artifacts/contracts.json');
const deployment = require('../deployment.json');
const { ProofBuilderClient, toVerifierArgs } = require('../../spike/src/proofClient');
const { CC3_TESTNET, CHAIN_KEY } = require('../../spike/src/config');

const SNUSD = deployment.asset;
const PAUSE_TX = deployment.sourceTx;

// An unrelated, real Ethereum mainnet transaction already proven end-to-end in spike/scripts/06.
// Its logs are genuine and its proof is genuine — the emitters are simply not on our allowlist.
const UNRELATED_TX = '0x35a2f50fbbe5c624b6c26551f530448557589c4d92348afdd4070a7fbf98e8f0';

const STATUS = ['NO_PROOF', 'IMPAIRED', 'RESTORED'];

function flatten(proof, overrides = {}) {
  const a = toVerifierArgs(proof);
  const args = [
    a.chainKey, a.height, a.encodedTransaction,
    a.merkleProof[0],
    a.merkleProof[1].map(([hash, isLeft]) => ({ hash, isLeft })),
    a.continuityProof[0],
    a.continuityProof[1],
  ];
  if (overrides.chainKey !== undefined) args[0] = overrides.chainKey;
  if (overrides.merkleRoot !== undefined) args[3] = overrides.merkleRoot;
  return args;
}

/** Flip the low bit of the last byte — a root that is one bit away from the truth. */
function corrupt(root) {
  const b = ethers.getBytes(root);
  b[b.length - 1] ^= 0x01;
  return ethers.hexlify(b);
}

/**
 * @param expected  custom-error name thrown by the ledger, or the revert string the
 *                  BlockProver precompile raises inside the runtime.
 */
async function expectRejection(label, ledger, args, layer, expected) {
  process.stdout.write(`  ${label.padEnd(36)}`);
  try {
    await ledger.submitEvent.staticCall(...args);
    console.log('❌ ACCEPTED — this should not happen');
    return false;
  } catch (e) {
    // A custom error decodes to revert.name; the precompile raises Error(string) instead.
    const r = e.revert;
    const got = r?.name === 'Error' ? r.args[0] : (r?.name ?? e.shortMessage ?? e.message);
    const ok = got === expected;
    console.log(ok ? `✅ ${layer.padEnd(11)} ${expected}` : `❌ got "${got}", expected "${expected}"`);
    return ok;
  }
}

async function main() {
  const provider = new ethers.JsonRpcProvider(CC3_TESTNET.rpcUrl);
  const ledger = new ethers.Contract(
    deployment.ledger, artifacts.EligibilityLedger.abi, provider);

  console.log('=== EligibilityLedger — what it refuses ===\n');
  console.log('network :', CC3_TESTNET.name, '| chainId', (await provider.getNetwork()).chainId);
  console.log('ledger  :', deployment.ledger);
  console.log('asset   :', SNUSD, '(sNUSD, registered against Ethereum mainnet)\n');

  const before = {
    status: Number(await ledger.statusOf(SNUSD)),
    since: await ledger.impairedSince(SNUSD),
    count: await ledger.eventCount(),
  };
  console.log('state before:', STATUS[before.status],
    '| impairedSince', before.since.toString(), '| events', before.count.toString(), '\n');

  const pb = new ProofBuilderClient();
  console.log('— fetching two real proofs —');
  const pauseProof = await pb.proofByTxHash(CHAIN_KEY.ETH_MAINNET, PAUSE_TX);
  console.log('  admitted sNUSD pause  block', pauseProof.headerNumber);
  const otherProof = await pb.proofByTxHash(CHAIN_KEY.ETH_MAINNET, UNRELATED_TX);
  console.log('  unrelated mainnet tx  block', otherProof.headerNumber, '\n');

  console.log('— rejections —');
  const results = [
    await expectRejection('A. replay of the admitted proof', ledger,
      flatten(pauseProof), '[ledger]', 'QueryAlreadyProcessed'),
    await expectRejection('B. real proof, emitter not listed', ledger,
      flatten(otherProof), '[ledger]', 'NoMatchingEvent'),
    await expectRejection('C. forged Merkle root (1 bit)', ledger,
      flatten(otherProof, { merkleRoot: corrupt(toVerifierArgs(otherProof).merkleProof[0]) }),
      '[precompile]', 'Merkle proof validation failed'),
    await expectRejection('D. mainnet proof sent as Sepolia', ledger,
      flatten(pauseProof, { chainKey: CHAIN_KEY.SEPOLIA }),
      '[precompile]', 'Continuity proof does not match attestation or checkpoint'),
  ];

  console.log('\n— state after —');
  const after = {
    status: Number(await ledger.statusOf(SNUSD)),
    since: await ledger.impairedSince(SNUSD),
    count: await ledger.eventCount(),
  };
  console.log('state after :', STATUS[after.status],
    '| impairedSince', after.since.toString(), '| events', after.count.toString());

  const unchanged = after.status === before.status
    && after.since === before.since && after.count === before.count;
  console.log('  unchanged:', unchanged ? '✅' : '❌');

  const ok = results.every(Boolean) && unchanged;
  console.log('\nRESULT:', ok
    ? '✅ four distinct forgeries rejected on-chain; the ledger did not move'
    : '❌ unexpected outcome');
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error('\nFAILED:', e.message); process.exit(1); });
