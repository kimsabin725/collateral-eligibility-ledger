'use strict';
/**
 * EligibilityLedger + GatedCreditLine — application-logic tests on a local in-memory EVM.
 *
 * The BlockProver precompile does not exist locally, so it and the decoder are mocked. That is
 * deliberate: the precompile is ALREADY proven against real mainnet data in spike/scripts/01–06,
 * and the real decoder is exercised end-to-end in realdata-eligibility.test.js. What runs here is
 * the logic layered on top — the five checks, the earliest-impairment rule, restoration ordering,
 * and the credit gate (including the rule that exits are never gated).
 */

const { VM } = require('@ethereumjs/vm');
const { Account, Address, hexToBytes, bytesToHex } = require('@ethereumjs/util');
const { ethers } = require('ethers');
const artifacts = require('../artifacts/contracts.json');

const DEPLOYER = new Address(hexToBytes('0x1111111111111111111111111111111111111111'));
const GAS = 30_000_000n;

const CHAIN_KEY_MAINNET = 3n;
const CHAIN_KEY_SEPOLIA = 1n;

// Blocks mirror the real evidence: sNUSD Paused on Ethereum at 25,745,732 (2026-08-13).
const PAUSE_BLOCK = 25745732n;
const ROGUE = '0xdeadbeef00000000000000000000000000000001'; // never registered

const PAUSED = ethers.id('Paused(address)');
const UNPAUSED = ethers.id('Unpaused(address)');
const TRANSFER = ethers.id('Transfer(address,address,uint256)');

const RECEIPT_T =
  'tuple(uint8 receiptStatus, uint64 receiptGasUsed, tuple(address address_, bytes32[] topics, bytes data)[] receiptLogs, bytes receiptLogsBloom)';
const coder = ethers.AbiCoder.defaultAbiCoder();
const pad = (a) => ethers.zeroPadValue(ethers.getAddress(a), 32);
const E18 = 10n ** 18n;

function receipt(logs, status = 1) {
  return coder.encode([RECEIPT_T], [[status, 21000, logs, '0x']]);
}
const evLog = (asset, sig) => ({ address_: asset, topics: [sig, pad(DEPLOYER.toString())], data: '0x' });
const noiseLog = (asset) => ({
  address_: asset,
  topics: [TRANSFER, pad(DEPLOYER.toString()), pad(DEPLOYER.toString())],
  data: coder.encode(['uint256'], [1n]),
});

let vm, ledger, line, verifier, decoder, coll, loan;
let lIface, gIface, vIface, eIface;

async function deploy(name, args = []) {
  const a = artifacts[name];
  const f = new ethers.Interface(a.abi);
  const encoded = args.length ? f.encodeDeploy(args).slice(2) : '';
  const res = await vm.evm.runCall({
    caller: DEPLOYER, origin: DEPLOYER, gasLimit: GAS,
    data: hexToBytes(a.bytecode + encoded),
  });
  if (res.execResult.exceptionError) {
    throw new Error(`deploy ${name} failed: ${res.execResult.exceptionError.error}`);
  }
  return res.createdAddress;
}

async function call(to, ifaceObj, fn, args, { expectRevert = false } = {}) {
  const data = ifaceObj.encodeFunctionData(fn, args);
  const res = await vm.evm.runCall({
    caller: DEPLOYER, origin: DEPLOYER, to, gasLimit: GAS, data: hexToBytes(data),
  });
  const err = res.execResult.exceptionError;
  const ret = bytesToHex(res.execResult.returnValue);
  if (err && !expectRevert) throw new Error(`${fn} reverted unexpectedly: ${err.error} ${ret}`);
  if (!err && expectRevert) throw new Error(`${fn} was expected to revert but succeeded`);
  let decodedError = null;
  if (err && ret && ret.length > 2) {
    for (const i of [ifaceObj, lIface, gIface]) {
      if (!i) continue;
      try { const p = i.parseError(ret); if (p) { decodedError = p.name; break; } } catch { /* keep trying */ }
    }
  }
  return { reverted: Boolean(err), error: decodedError, ret };
}

const submit = (chainKey, block, encodedTx, opts) =>
  call(ledger, lIface, 'submitEvent',
    [chainKey, block, encodedTx, ethers.ZeroHash, [], ethers.ZeroHash, []], opts);

async function read(to, iface, fn, args = []) {
  const r = await call(to, iface, fn, args);
  return iface.decodeFunctionResult(fn, r.ret)[0];
}

const results = [];
function check(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`  ${pass ? '✅' : '❌'} ${name}${detail ? '  — ' + detail : ''}`);
}

async function main() {
  vm = await VM.create();
  await vm.stateManager.putAccount(DEPLOYER, new Account(0n, 10n ** 20n));

  verifier = await deploy('MockVerifier2');
  decoder = await deploy('MockDecoder2');
  ledger = await deploy('EligibilityLedger', [verifier.toString(), decoder.toString()]);
  line = await deploy('GatedCreditLine', [ledger.toString()]);
  coll = await deploy('MockERC20', ['Staked NUSD', 'sNUSD']);
  loan = await deploy('MockERC20', ['USD Coin', 'USDC']);

  lIface = new ethers.Interface(artifacts.EligibilityLedger.abi);
  gIface = new ethers.Interface(artifacts.GatedCreditLine.abi);
  vIface = new ethers.Interface(artifacts.MockVerifier2.abi);
  eIface = new ethers.Interface(artifacts.MockERC20.abi);

  const COLL = coll.toString();
  console.log('deployed: ledger', ledger.toString());
  console.log('          line  ', line.toString());
  console.log('          asset ', COLL, '(stands in for sNUSD)\n');

  await call(ledger, lIface, 'registerAsset', [COLL, CHAIN_KEY_MAINNET, 'Staked NUSD (sNUSD)']);
  await call(ledger, lIface, 'setImpairmentSignature', [PAUSED, true]);
  await call(ledger, lIface, 'setRestorationSignature', [UNPAUSED, true]);
  await call(line, gIface, 'listMarket', [COLL, loan.toString(), 9200]);

  await call(coll, eIface, 'mint', [DEPLOYER.toString(), 10_000n * E18]);
  await call(loan, eIface, 'mint', [DEPLOYER.toString(), 10_000n * E18]);
  await call(coll, eIface, 'approve', [line.toString(), ethers.MaxUint256]);
  await call(loan, eIface, 'approve', [line.toString(), ethers.MaxUint256]);
  await call(line, gIface, 'fund', [COLL, 5_000n * E18]);

  console.log('— before any proof —');
  check('status starts NO_PROOF (0)', Number(await read(ledger, lIface, 'statusOf', [COLL])) === 0);
  check('NO_PROOF does not gate credit', (await read(ledger, lIface, 'isCreditGated', [COLL])) === false);

  let r = await call(line, gIface, 'openPosition', [COLL, 1000n * E18, 500n * E18]);
  check('credit extended before impairment is proven', !r.reverted);
  const borrowed = await read(loan, eIface, 'balanceOf', [DEPLOYER.toString()]);
  check('borrower received the loan asset', borrowed === 5_500n * E18,
    `balance=${borrowed / E18}`);

  console.log('\n— impairment proof flips the gate —');
  await call(verifier, vIface, 'setTxIndex', [1]);
  r = await submit(CHAIN_KEY_MAINNET, PAUSE_BLOCK, receipt([evLog(COLL, PAUSED)]));
  check('impairment proof admitted', !r.reverted);
  check('status → IMPAIRED (1)', Number(await read(ledger, lIface, 'statusOf', [COLL])) === 1);
  const since = await read(ledger, lIface, 'impairedSince', [COLL]);
  check('impairedSince = source block', since === PAUSE_BLOCK, `block=${since}`);

  r = await call(line, gIface, 'openPosition', [COLL, 100n * E18, 10n * E18], { expectRevert: true });
  check('new position refused', r.error === 'AssetImpaired', `error=${r.error}`);
  r = await call(line, gIface, 'borrowMore', [0, 1n * E18], { expectRevert: true });
  check('borrowing more on an existing position refused', r.error === 'AssetImpaired', `error=${r.error}`);
  r = await call(line, gIface, 'addCollateral', [0, 1n * E18], { expectRevert: true });
  check('adding collateral refused', r.error === 'AssetImpaired', `error=${r.error}`);

  console.log('\n— exits are never gated (a risk control must not trap the borrower) —');
  r = await call(line, gIface, 'repay', [0, 500n * E18]);
  const p0 = await read(line, gIface, 'getPosition', [0]);
  check('repay works while impaired', !r.reverted && p0.debt === 0n, `debt=${p0.debt}`);
  r = await call(line, gIface, 'withdrawCollateral', [0, 1000n * E18]);
  check('collateral withdrawal works while impaired', !r.reverted);

  console.log('\n— negative cases (must fail closed) —');
  await call(verifier, vIface, 'setShouldVerify', [false]);
  await call(verifier, vIface, 'setTxIndex', [2]);
  r = await submit(CHAIN_KEY_MAINNET, PAUSE_BLOCK + 1n, receipt([evLog(COLL, PAUSED)]), { expectRevert: true });
  check('tampered / invalid proof → revert', r.error === 'ProofRejected', `error=${r.error}`);
  await call(verifier, vIface, 'setShouldVerify', [true]);

  await call(verifier, vIface, 'setTxIndex', [1]);
  r = await submit(CHAIN_KEY_MAINNET, PAUSE_BLOCK, receipt([evLog(COLL, PAUSED)]), { expectRevert: true });
  check('replay of a processed query → revert', r.error === 'QueryAlreadyProcessed', `error=${r.error}`);

  await call(verifier, vIface, 'setTxIndex', [3]);
  r = await submit(CHAIN_KEY_MAINNET, PAUSE_BLOCK + 2n, receipt([evLog(ROGUE, PAUSED)]), { expectRevert: true });
  check('unregistered emitter → revert, nothing recorded', r.error === 'NoMatchingEvent', `error=${r.error}`);

  await call(verifier, vIface, 'setTxIndex', [4]);
  r = await submit(CHAIN_KEY_MAINNET, PAUSE_BLOCK + 3n, receipt([noiseLog(COLL)]), { expectRevert: true });
  check('registered asset but unconfigured signature → revert', r.error === 'NoMatchingEvent', `error=${r.error}`);

  await call(verifier, vIface, 'setTxIndex', [5]);
  r = await submit(CHAIN_KEY_MAINNET, PAUSE_BLOCK + 4n, receipt([evLog(COLL, PAUSED)], 0), { expectRevert: true });
  check('failed source transaction (status 0) → revert', r.error === 'SourceTxFailed', `error=${r.error}`);

  await call(verifier, vIface, 'setTxIndex', [6]);
  r = await submit(CHAIN_KEY_SEPOLIA, PAUSE_BLOCK + 5n, receipt([evLog(COLL, PAUSED)]), { expectRevert: true });
  check('same address on a different source chain → revert', r.error === 'WrongChainKey', `error=${r.error}`);

  console.log('\n— chronology: the cutoff is the EARLIEST proven impairment —');
  await call(verifier, vIface, 'setTxIndex', [7]);
  await submit(CHAIN_KEY_MAINNET, PAUSE_BLOCK + 500n, receipt([evLog(COLL, PAUSED)]));
  let now = await read(ledger, lIface, 'impairedSince', [COLL]);
  check('later impairment proof does not move the cutoff forward', now === PAUSE_BLOCK, `block=${now}`);

  await call(verifier, vIface, 'setTxIndex', [8]);
  await submit(CHAIN_KEY_MAINNET, PAUSE_BLOCK - 100n, receipt([evLog(COLL, PAUSED)]));
  now = await read(ledger, lIface, 'impairedSince', [COLL]);
  check('earlier impairment proof moves the cutoff back', now === PAUSE_BLOCK - 100n, `block=${now}`);

  console.log('\n— batched source transaction —');
  await call(verifier, vIface, 'setTxIndex', [9]);
  r = await submit(CHAIN_KEY_MAINNET, PAUSE_BLOCK + 600n,
    receipt([noiseLog(ROGUE), evLog(ROGUE, PAUSED), evLog(COLL, PAUSED), noiseLog(COLL)]));
  const admitted = lIface.decodeFunctionResult('submitEvent', r.ret)[0];
  check('batched tx records only the registered asset', !r.reverted && admitted === 1n,
    `admitted=${admitted}`);

  console.log('\n— restoration ordering —');
  await call(verifier, vIface, 'setTxIndex', [10]);
  await submit(CHAIN_KEY_MAINNET, PAUSE_BLOCK - 200n, receipt([evLog(COLL, UNPAUSED)]));
  check('restoration older than the impairment is ignored',
    Number(await read(ledger, lIface, 'statusOf', [COLL])) === 1);

  await call(verifier, vIface, 'setTxIndex', [11]);
  await submit(CHAIN_KEY_MAINNET, PAUSE_BLOCK + 1000n, receipt([evLog(COLL, UNPAUSED)]));
  check('restoration after the impairment → RESTORED (2)',
    Number(await read(ledger, lIface, 'statusOf', [COLL])) === 2);
  check('credit gate released', (await read(ledger, lIface, 'isCreditGated', [COLL])) === false);
  r = await call(line, gIface, 'openPosition', [COLL, 100n * E18, 50n * E18]);
  check('credit available again after restoration', !r.reverted);

  console.log('\n— read paths —');
  // 6 admitted for this asset: 3 impairments (base, later, earlier), 1 from the batched tx,
  // 2 restorations (the ignored older one is still kept as history).
  const evs = await read(ledger, lIface, 'eventsOf', [COLL]);
  check('every admitted event is retained as history, including ignored ones',
    evs.length === 6, `count=${evs.length}`);
  const exposed = await read(line, gIface, 'exposedPositions', [COLL]);
  check('exposedPositions lists open debt', exposed.length === 1, `count=${exposed.length}`);

  const passed = results.filter((x) => x.pass).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  if (passed !== results.length) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
