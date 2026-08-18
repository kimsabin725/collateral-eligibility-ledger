'use strict';
/**
 * VaultAuthorityLedger — application-logic tests on a local in-memory EVM.
 *
 * The Creditcoin BlockProver precompile does not exist locally, so it and the decoder are mocked.
 * That is deliberate: the real precompile is ALREADY proven against real Ethereum mainnet data in
 * spike/scripts/01–06 (verify() TRUE on genuine txs, revert on a tampered continuity proof, and
 * decoder output cross-checked against Ethereum's own RPC). What was NOT yet tested is the
 * application logic layered on top — replay protection, the emitter allowlist, the tx-success
 * check, and above all the authority→action role composition. That is what runs here.
 */

const { VM } = require('@ethereumjs/vm');
const { Account, Address, hexToBytes, bytesToHex } = require('@ethereumjs/util');
const { ethers } = require('ethers');
const artifacts = require('../artifacts/contracts.json');

const DEPLOYER = new Address(hexToBytes('0x1111111111111111111111111111111111111111'));
const GAS = 30_000_000n;

const CHAIN_KEY_MAINNET = 3n;
const VAULT = '0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB'; // steakUSDC
const ROGUE_VAULT = '0xdeadbeef00000000000000000000000000000001'; // NOT allowlisted
const ACTOR = '0x9e9110cfd24cd851ea5bc73a27975b33e308f9e1'; // proven allocator
const MARKET = '0x94b823e6bd8ea533dbe1d0a1b2e2c4b0d5a6f7e8901234567890abcdef123456';

const SET_IS_ALLOCATOR = ethers.id('SetIsAllocator(address,bool)');
const REALLOCATE_SUPPLY = ethers.id('ReallocateSupply(address,bytes32,uint256,uint256)');

const RECEIPT_T =
  'tuple(uint8 receiptStatus, uint64 receiptGasUsed, tuple(address address_, bytes32[] topics, bytes data)[] receiptLogs, bytes receiptLogsBloom)';
const coder = ethers.AbiCoder.defaultAbiCoder();
const pad = (a) => ethers.zeroPadValue(ethers.getAddress(a), 32);

/** Build the abi-encoded receipt our MockDecoder returns verbatim. */
function receipt(logs, status = 1) {
  return coder.encode([RECEIPT_T], [[status, 21000, logs, '0x']]);
}
const allocatorGrantLog = (vault = VAULT, actor = ACTOR, enabled = true) => ({
  address_: vault, topics: [SET_IS_ALLOCATOR, pad(actor)],
  data: coder.encode(['bool'], [enabled]),
});
const reallocateLog = (vault = VAULT, actor = ACTOR, market = MARKET, assets = 1_000_000n) => ({
  address_: vault, topics: [REALLOCATE_SUPPLY, pad(actor), market],
  data: coder.encode(['uint256', 'uint256'], [assets, assets]),
});

let vm, ledger, verifier, decoder, iface;

async function deploy(name, args = []) {
  const a = artifacts[name];
  const factory = new ethers.Interface(a.abi);
  const encodedArgs = args.length
    ? factory.encodeDeploy(args).slice(2)
    : '';
  const res = await vm.evm.runCall({
    caller: DEPLOYER, origin: DEPLOYER, gasLimit: GAS,
    data: hexToBytes(a.bytecode + encodedArgs),
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
    try { decodedError = ifaceObj.parseError(ret)?.name ?? null; } catch { /* not a custom error */ }
  }
  return { reverted: Boolean(err), error: decodedError, ret };
}

// Convenience: submit a proof-bearing call with the flattened ASC parameter shape.
const submit = (fn, chainKey, block, encodedTx, opts) =>
  call(ledger, iface, fn, [chainKey, block, encodedTx, ethers.ZeroHash, [], ethers.ZeroHash, []], opts);

const results = [];
function check(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`  ${pass ? '✅' : '❌'} ${name}${detail ? '  — ' + detail : ''}`);
}

async function main() {
  vm = await VM.create();
  await vm.stateManager.putAccount(DEPLOYER, new Account(0n, 10n ** 20n));

  verifier = await deploy('MockVerifier');
  decoder = await deploy('MockDecoder');
  ledger = await deploy('VaultAuthorityLedger', [verifier.toString(), decoder.toString()]);
  iface = new ethers.Interface(artifacts.VaultAuthorityLedger.abi);
  const vIface = new ethers.Interface(artifacts.MockVerifier.abi);

  console.log('deployed: verifier', verifier.toString());
  console.log('          decoder ', decoder.toString());
  console.log('          ledger  ', ledger.toString(), '\n');

  await call(ledger, iface, 'setKnownVault', [VAULT, true]);

  console.log('— core success path —');
  // txIndex distinguishes queries; bump it whenever a new "transaction" is submitted.
  await call(verifier, vIface, 'setTxIndex', [1]);
  let r = await submit('submitAuthority', CHAIN_KEY_MAINNET, 22194870n, receipt([allocatorGrantLog()]));
  check('authority grant ingested', !r.reverted);

  await call(verifier, vIface, 'setTxIndex', [2]);
  r = await submit('submitAction', CHAIN_KEY_MAINNET, 25772893n, receipt([reallocateLog()]));
  check('action ingested', !r.reverted);

  let rec = await call(ledger, iface, 'getRecord', [0]);
  let decoded = iface.decodeFunctionResult('getRecord', rec.ret)[0];
  check('role attributed = ALLOCATOR (3)', Number(decoded.roleAtAction) === 3,
    `roleAtAction=${decoded.roleAtAction}, actor=${decoded.actor}`);
  check('actor recorded correctly',
    decoded.actor.toLowerCase() === ACTOR.toLowerCase());
  check('market recorded correctly', decoded.market.toLowerCase() === MARKET.toLowerCase());

  console.log('\n— the ledger refuses to guess —');
  const UNSEEN = '0x00000000000000000000000000000000000000aa';
  await call(verifier, vIface, 'setTxIndex', [3]);
  r = await submit('submitAction', CHAIN_KEY_MAINNET, 25772894n,
    receipt([reallocateLog(VAULT, UNSEEN)]));
  rec = await call(ledger, iface, 'getRecord', [1]);
  decoded = iface.decodeFunctionResult('getRecord', rec.ret)[0];
  check('action with no prior grant → UNKNOWN (0)', Number(decoded.roleAtAction) === 0,
    `roleAtAction=${decoded.roleAtAction}`);

  // Grant that comes AFTER the action must not back-date authority.
  const LATE = '0x00000000000000000000000000000000000000bb';
  await call(verifier, vIface, 'setTxIndex', [4]);
  await submit('submitAuthority', CHAIN_KEY_MAINNET, 25772900n,
    receipt([allocatorGrantLog(VAULT, LATE)]));
  await call(verifier, vIface, 'setTxIndex', [5]);
  await submit('submitAction', CHAIN_KEY_MAINNET, 25772895n,
    receipt([reallocateLog(VAULT, LATE)]));
  rec = await call(ledger, iface, 'getRecord', [2]);
  decoded = iface.decodeFunctionResult('getRecord', rec.ret)[0];
  check('grant AFTER action → UNKNOWN (no back-dating)', Number(decoded.roleAtAction) === 0,
    `roleAtAction=${decoded.roleAtAction}`);

  console.log('\n— negative cases (must fail closed) —');
  await call(verifier, vIface, 'setShouldVerify', [false]);
  await call(verifier, vIface, 'setTxIndex', [10]);
  r = await submit('submitAction', CHAIN_KEY_MAINNET, 25772896n, receipt([reallocateLog()]),
    { expectRevert: true });
  check('tampered / invalid proof → revert', r.reverted && r.error === 'ProofRejected', r.error);
  await call(verifier, vIface, 'setShouldVerify', [true]);

  // Replay: same chainKey + block + txIndex as the very first submission.
  await call(verifier, vIface, 'setTxIndex', [1]);
  r = await submit('submitAuthority', CHAIN_KEY_MAINNET, 22194870n,
    receipt([allocatorGrantLog()]), { expectRevert: true });
  check('replay of a processed query → revert',
    r.reverted && r.error === 'QueryAlreadyProcessed', r.error);

  await call(verifier, vIface, 'setTxIndex', [11]);
  r = await submit('submitAction', CHAIN_KEY_MAINNET, 25772897n,
    receipt([reallocateLog(ROGUE_VAULT)]), { expectRevert: true });
  // A tx whose ONLY matching log comes from a non-allowlisted contract yields no records at all.
  check('wrong source contract (not allowlisted) → revert, nothing recorded',
    r.reverted && r.error === 'NoMatchingEvent', r.error);

  // And a BATCHED tx (allowlisted + rogue in one receipt) records only the allowlisted one.
  await call(verifier, vIface, 'setTxIndex', [14]);
  const before = Number(iface.decodeFunctionResult('recordCount',
    (await call(ledger, iface, 'recordCount', [])).ret)[0]);
  await submit('submitAction', CHAIN_KEY_MAINNET, 25772901n,
    receipt([reallocateLog(ROGUE_VAULT), reallocateLog(VAULT)]));
  const after = Number(iface.decodeFunctionResult('recordCount',
    (await call(ledger, iface, 'recordCount', [])).ret)[0]);
  check('batched tx records ONLY the allowlisted vault', after - before === 1,
    `added ${after - before}`);

  await call(verifier, vIface, 'setTxIndex', [12]);
  r = await submit('submitAction', CHAIN_KEY_MAINNET, 25772898n,
    receipt([reallocateLog()], 0), { expectRevert: true });
  check('failed source transaction (status 0) → revert',
    r.reverted && r.error === 'SourceTxFailed', r.error);

  await call(verifier, vIface, 'setTxIndex', [13]);
  r = await submit('submitAction', CHAIN_KEY_MAINNET, 25772899n,
    receipt([allocatorGrantLog()]), { expectRevert: true }); // right vault, wrong event
  check('wrong event signature → revert',
    r.reverted && r.error === 'NoMatchingEvent', r.error);

  console.log('\n— read paths —');
  const acts = await call(ledger, iface, 'actionsOf', [ACTOR]);
  const list = iface.decodeFunctionResult('actionsOf', acts.ret)[0];
  // 2 = the core success-path action + the allowlisted half of the batched tx above.
  check('actionsOf(actor) returns both recorded actions', list.length === 2, `count=${list.length}`);
  const grs = await call(ledger, iface, 'grantsOf', [ACTOR]);
  const glist = iface.decodeFunctionResult('grantsOf', grs.ret)[0];
  check('grantsOf(actor) returns the grant', glist.length === 1, `count=${glist.length}`);

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => { console.error('\nHARNESS ERROR:', e.message); process.exit(1); });
