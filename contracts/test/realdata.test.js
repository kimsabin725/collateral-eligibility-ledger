'use strict';
/**
 * End-to-end vertical slice with REAL data, run on a local EVM.
 *
 * This is the strongest test we can run without testnet funds. It uses:
 *   - REAL Attestcoin proofs, fetched live from the hosted Proof Builder
 *   - REAL Ethereum mainnet transaction bytes (steakUSDC authority grant + allocation)
 *   - the REAL EvmV1Decoder from @gluwa/usc-contracts, deployed into the local VM
 *   - the REAL VaultAuthorityLedger
 *
 * Only the BlockProver precompile is mocked, because it is a Creditcoin runtime component that
 * cannot exist on a local EVM — and it is the one piece already proven against mainnet in
 * spike/scripts/06 (verify() TRUE for both of these exact transactions).
 *
 * So this closes the remaining gap: it proves our contract correctly parses genuine proof
 * payloads and RLP transaction bytes, and produces the right role attribution.
 *
 *   node test/realdata.test.js
 */

const { VM } = require('@ethereumjs/vm');
const { Account, Address, hexToBytes, bytesToHex } = require('@ethereumjs/util');
const { ethers } = require('ethers');
const artifacts = require('../artifacts/contracts.json');
const { ProofBuilderClient, toVerifierArgs } = require('../../spike/src/proofClient');
const { CHAIN_KEY } = require('../../spike/src/config');

const DEPLOYER = new Address(hexToBytes('0x1111111111111111111111111111111111111111'));
const GAS = 200_000_000n;

const VAULT = '0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB';
const ACTOR = '0x9e9110cfd24cd851ea5bc73a27975b33e308f9e1';
const AUTHORITY_TX = '0x52ced076746bb8682d009f0b2b6d19101e77998a866808f1b6fa8c442e4106fd';
const ACTION_TX    = '0x35a2f50fbbe5c624b6c26551f530448557589c4d92348afdd4070a7fbf98e8f0';
const ROLE = ['UNKNOWN', 'OWNER', 'CURATOR', 'ALLOCATOR'];

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
  const ret = bytesToHex(res.execResult.returnValue);
  return { err: res.execResult.exceptionError, ret };
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
  console.log('=== Real proof data → real decoder → real ledger (local EVM) ===\n');

  const pb = new ProofBuilderClient();
  const attested = await pb.attestedHeight(CHAIN_KEY.ETH_MAINNET);
  console.log('attested mainnet height:', attested);

  const [authProof, actionProof] = await Promise.all([
    pb.proofByTxHash(CHAIN_KEY.ETH_MAINNET, AUTHORITY_TX),
    pb.proofByTxHash(CHAIN_KEY.ETH_MAINNET, ACTION_TX),
  ]);
  console.log('authority proof: block', authProof.headerNumber,
    '| txBytes', (authProof.txBytes.length - 2) / 2,
    '| siblings', authProof.merkleProof.siblings.length,
    '| roots', authProof.continuityProof.roots.length);
  console.log('action    proof: block', actionProof.headerNumber,
    '| txBytes', (actionProof.txBytes.length - 2) / 2,
    '| siblings', actionProof.merkleProof.siblings.length,
    '| roots', actionProof.continuityProof.roots.length, '\n');

  vm = await VM.create();
  await vm.stateManager.putAccount(DEPLOYER, new Account(0n, 10n ** 20n));

  const verifier = await deploy('MockVerifier');          // precompile stand-in only
  const decoder = await deploy('EvmV1Decoder');           // THE REAL DECODER
  const ledger = await deploy('VaultAuthorityLedger', [verifier.toString(), decoder.toString()]);
  const iface = new ethers.Interface(artifacts.VaultAuthorityLedger.abi);
  const vIface = new ethers.Interface(artifacts.MockVerifier.abi);
  console.log('deployed real EvmV1Decoder at', decoder.toString());
  console.log('deployed ledger           at', ledger.toString(), '\n');

  await call(ledger, iface, 'setKnownVault', [VAULT, true]);

  // Sanity: does the REAL decoder parse the REAL transaction bytes?
  const dIface = new ethers.Interface(artifacts.EvmV1Decoder.abi);
  const dec = await call(decoder, dIface, 'decodeReceiptFields', [actionProof.txBytes]);
  check('real decoder parses real mainnet txBytes', !dec.err, dec.err?.error ?? '');
  if (!dec.err) {
    const r = dIface.decodeFunctionResult('decodeReceiptFields', dec.ret)[0];
    check('receiptStatus == 1', Number(r.receiptStatus) === 1);
    check('logs present', r.receiptLogs.length > 0, `${r.receiptLogs.length} logs`);
  }

  console.log('\n— submitting real proofs through the ledger —');
  // txIndex is normally computed by the precompile from the Merkle proof; mirror the real value
  // so replay protection is keyed exactly as it would be on Creditcoin.
  await call(verifier, vIface, 'setTxIndex', [authProof.txIndex]);
  const a1 = await call(ledger, iface, 'submitAuthority', flatten(authProof));
  check('submitAuthority(real proof) succeeded', !a1.err,
    a1.err ? `${a1.err.error} ${a1.ret.slice(0, 20)}` : '');

  await call(verifier, vIface, 'setTxIndex', [actionProof.txIndex]);
  const a2 = await call(ledger, iface, 'submitAction', flatten(actionProof));
  check('submitAction(real proof) succeeded', !a2.err,
    a2.err ? `${a2.err.error} ${a2.ret.slice(0, 20)}` : '');

  const cnt = await call(ledger, iface, 'recordCount', []);
  const n = Number(iface.decodeFunctionResult('recordCount', cnt.ret)[0]);
  check('action records written', n > 0, `${n} record(s)`);

  let allocatorCount = 0;
  for (let i = 0; i < n; i++) {
    const g = await call(ledger, iface, 'getRecord', [i]);
    const r = iface.decodeFunctionResult('getRecord', g.ret)[0];
    if (Number(r.roleAtAction) === 3) allocatorCount++;
    console.log(`    record ${i}: actor ${r.actor} role ${ROLE[Number(r.roleAtAction)]}` +
      ` market ${r.market.slice(0, 14)}… srcBlock ${r.srcBlock}`);
  }
  check('every action attributed ALLOCATOR from the real grant', allocatorCount === n && n > 0,
    `${allocatorCount}/${n}`);

  const acts = await call(ledger, iface, 'actionsOf', [ACTOR]);
  const list = iface.decodeFunctionResult('actionsOf', acts.ret)[0];
  check('actionsOf(real allocator) non-empty', list.length > 0, `count=${list.length}`);

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  if (passed === results.length) {
    console.log('\nVERTICAL SLICE PROVEN with real proof data.');
    console.log('Only the BlockProver precompile was mocked; it is already verified against these');
    console.log('same two transactions on Creditcoin in spike/scripts/06.');
  }
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => { console.error('\nHARNESS ERROR:', e.message); process.exit(1); });
