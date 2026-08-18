'use strict';
/**
 * End-to-end vertical slice with REAL data, run on a local EVM.
 *
 * Uses:
 *   - a REAL Attestcoin proof, fetched live from the hosted Proof Builder
 *   - a REAL Ethereum mainnet transaction: the sNUSD `Paused` event of 2026-08-13, i.e. the
 *     moment a $53M synthetic dollar's staking wrapper stopped being freely redeemable while
 *     DeFi contracts were still holding it
 *   - the REAL EvmV1Decoder from @gluwa/usc-contracts, deployed into the local VM
 *   - the REAL EligibilityLedger and GatedCreditLine
 *
 * Only the BlockProver precompile is mocked: it is a Creditcoin runtime component that cannot
 * exist on a local EVM, and it is the one piece already proven against mainnet in spike/scripts.
 *
 *   node test/realdata-eligibility.test.js
 */

const { VM } = require('@ethereumjs/vm');
const { Account, Address, hexToBytes, bytesToHex } = require('@ethereumjs/util');
const { ethers } = require('ethers');
const artifacts = require('../artifacts/contracts.json');
const { ProofBuilderClient, toVerifierArgs } = require('../../spike/src/proofClient');
const { CHAIN_KEY } = require('../../spike/src/config');

const DEPLOYER = new Address(hexToBytes('0x1111111111111111111111111111111111111111'));
const GAS = 200_000_000n;
const E18 = 10n ** 18n;

// The real event this whole project is built around.
const SNUSD = '0x08efcc2f3e61185d0ea7f8830b3fec9bfa2ee313'; // Staked NUSD (Neutrl)
const PAUSE_TX = '0xc25678129b98d6cb082472cc38b3e9908a81829e5826325c71d62318cb2f9c9a';
const PAUSE_BLOCK = 25745732n; // 2026-08-13 11:14:59 UTC

const PAUSED = ethers.id('Paused(address)');
const UNPAUSED = ethers.id('Unpaused(address)');
const STATUS = ['NO_PROOF', 'IMPAIRED', 'RESTORED'];

let vm;
const results = [];
const check = (name, pass, detail = '') => {
  results.push(pass);
  console.log(`  ${pass ? '✅' : '❌'} ${name}${detail ? '  — ' + detail : ''}`);
};

async function deploy(name, args = []) {
  const a = artifacts[name];
  const i = new ethers.Interface(a.abi);
  const enc = args.length ? i.encodeDeploy(args).slice(2) : '';
  const res = await vm.evm.runCall({
    caller: DEPLOYER, origin: DEPLOYER, gasLimit: GAS, data: hexToBytes(a.bytecode + enc),
  });
  if (res.execResult.exceptionError) {
    throw new Error(`deploy ${name}: ${res.execResult.exceptionError.error}`);
  }
  return res.createdAddress;
}

async function call(to, iface, fn, args) {
  const res = await vm.evm.runCall({
    caller: DEPLOYER, origin: DEPLOYER, to, gasLimit: GAS,
    data: hexToBytes(iface.encodeFunctionData(fn, args)),
  });
  return { err: res.execResult.exceptionError, ret: bytesToHex(res.execResult.returnValue) };
}

/** Proof Builder response → documented flattened ASC parameters. */
function flatten(proof) {
  const a = toVerifierArgs(proof);
  return [
    a.chainKey, a.height, a.encodedTransaction,
    a.merkleProof[0],
    a.merkleProof[1].map(([hash, isLeft]) => ({ hash, isLeft })),
    a.continuityProof[0],
    a.continuityProof[1],
  ];
}

async function main() {
  console.log('fetching the real Attestcoin proof for the sNUSD pause…\n');
  const pb = new ProofBuilderClient();
  const attested = await pb.attestedHeight(CHAIN_KEY.ETH_MAINNET);
  if (BigInt(attested) < PAUSE_BLOCK) {
    throw new Error(`source block ${PAUSE_BLOCK} not attested yet (head ${attested})`);
  }
  const proof = await pb.proofByTxHash(CHAIN_KEY.ETH_MAINNET, PAUSE_TX);
  const args = flatten(proof);

  console.log(`  tx        ${PAUSE_TX}`);
  console.log(`  block     ${args[1]}  (expected ${PAUSE_BLOCK})`);
  console.log(`  txBytes   ${(args[2].length - 2) / 2} bytes`);
  console.log(`  siblings  ${args[4].length} | continuity roots ${args[6].length}\n`);

  vm = await VM.create();
  await vm.stateManager.putAccount(DEPLOYER, new Account(0n, 10n ** 20n));

  const decoder = await deploy('EvmV1Decoder');       // the REAL decoder
  const verifier = await deploy('MockVerifier2');     // the one Creditcoin-only component
  const ledger = await deploy('EligibilityLedger', [verifier.toString(), decoder.toString()]);
  const line = await deploy('GatedCreditLine', [ledger.toString()]);
  const coll = await deploy('MockERC20', ['Staked NUSD', 'sNUSD']);
  const loan = await deploy('MockERC20', ['USD Coin', 'USDC']);

  const lIface = new ethers.Interface(artifacts.EligibilityLedger.abi);
  const gIface = new ethers.Interface(artifacts.GatedCreditLine.abi);
  const dIface = new ethers.Interface(artifacts.EvmV1Decoder.abi);
  const eIface = new ethers.Interface(artifacts.MockERC20.abi);

  console.log('deployed real EvmV1Decoder at', decoder.toString());
  console.log('deployed ledger            at', ledger.toString(), '\n');

  // ── the real decoder against the real transaction bytes ──
  const dec = await call(decoder, dIface, 'decodeReceiptFields', [args[2]]);
  check('real decoder parses the real mainnet txBytes', !dec.err,
    dec.err ? dec.err.error : '');
  const fields = dIface.decodeFunctionResult('decodeReceiptFields', dec.ret)[0];
  check('receiptStatus == 1', Number(fields.receiptStatus) === 1);
  const logs = fields.receiptLogs;
  check('logs present', logs.length > 0, `${logs.length} log(s)`);

  const pauseLog = logs.find(
    (l) => l.address_.toLowerCase() === SNUSD && l.topics[0] === PAUSED);
  check('the sNUSD Paused log is in this transaction', Boolean(pauseLog),
    pauseLog ? `emitter ${pauseLog.address_}` : 'not found');

  // ── the ledger, configured for the real asset on the real chain ──
  console.log('\n— configuring the venue for the real asset —');
  await call(ledger, lIface, 'registerAsset', [SNUSD, CHAIN_KEY.ETH_MAINNET, 'Staked NUSD (sNUSD)']);
  await call(ledger, lIface, 'setImpairmentSignature', [PAUSED, true]);
  await call(ledger, lIface, 'setRestorationSignature', [UNPAUSED, true]);
  // The credit venue lends against a local representation of the same asset.
  await call(line, gIface, 'listMarket', [coll.toString(), loan.toString(), 9200]);
  await call(coll, eIface, 'mint', [DEPLOYER.toString(), 10_000n * E18]);
  await call(loan, eIface, 'mint', [DEPLOYER.toString(), 10_000n * E18]);
  await call(coll, eIface, 'approve', [line.toString(), ethers.MaxUint256]);
  await call(loan, eIface, 'approve', [line.toString(), ethers.MaxUint256]);
  await call(line, gIface, 'fund', [coll.toString(), 5_000n * E18]);

  const before = await call(ledger, lIface, 'statusOf', [SNUSD]);
  check('asset starts NO_PROOF',
    Number(lIface.decodeFunctionResult('statusOf', before.ret)[0]) === 0);

  // ── submit the REAL proof ──
  console.log('\n— submitting the real proof through the ledger —');
  const sub = await call(ledger, lIface, 'submitEvent', args);
  check('submitEvent(real proof) succeeded', !sub.err, sub.err ? sub.err.error : '');
  const admitted = sub.err ? 0n : lIface.decodeFunctionResult('submitEvent', sub.ret)[0];
  check('exactly one impairment admitted from the real tx', admitted === 1n, `count=${admitted}`);

  const st = await call(ledger, lIface, 'statusOf', [SNUSD]);
  const status = Number(lIface.decodeFunctionResult('statusOf', st.ret)[0]);
  check('status → IMPAIRED from real mainnet data', status === 1, STATUS[status]);

  const sinceR = await call(ledger, lIface, 'impairedSince', [SNUSD]);
  const since = lIface.decodeFunctionResult('impairedSince', sinceR.ret)[0];
  check('impairedSince = the real source block', since === PAUSE_BLOCK, `block=${since}`);

  const evR = await call(ledger, lIface, 'getEvent', [0]);
  const ev = lIface.decodeFunctionResult('getEvent', evR.ret)[0];
  console.log(`\n    recorded: asset ${ev.asset}`);
  console.log(`              sig   ${ev.sig.slice(0, 18)}…  impairment=${ev.impairment}`);
  console.log(`              src   chainKey ${ev.srcChainKey} block ${ev.srcBlock}`);

  // ── the gate, driven by the real event ──
  console.log('\n— the credit gate, driven by the real event —');
  // Point the venue at the real asset id so the gate reads the proven state.
  await call(line, gIface, 'listMarket', [SNUSD, loan.toString(), 9200]);
  const refused = await call(line, gIface, 'openPosition', [SNUSD, 100n * E18, 10n * E18]);
  let errName = null;
  if (refused.err && refused.ret.length > 2) {
    try { errName = gIface.parseError(refused.ret)?.name ?? null; } catch { /* ignore */ }
  }
  check('new credit against the impaired asset is refused', Boolean(refused.err) && errName === 'AssetImpaired',
    `error=${errName}`);

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  if (passed !== results.length) process.exit(1);
  console.log('\nVERTICAL SLICE PROVEN with a real, 5-day-old mainnet impairment event.');
  console.log('Only the BlockProver precompile was mocked; it is already verified on Creditcoin');
  console.log('against real mainnet transactions in spike/scripts/01–06.');
}

main().catch((e) => { console.error(e); process.exit(1); });
