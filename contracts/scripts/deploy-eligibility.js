'use strict';
/**
 * One command to complete the vertical slice on CC3 Testnet, once the deployer is funded.
 *
 *   node scripts/deploy-eligibility.js
 *
 * It will:
 *   1. deploy EvmV1Decoder (own copy — the officially-listed one at 0x731c…F9f is a stale build)
 *   2. deploy EligibilityLedger, wired to the real BlockProver precompile 0x…0FD2
 *   3. deploy GatedCreditLine and list a market against the asset
 *   4. register sNUSD as a source asset and configure Paused/Unpaused signatures
 *   5. fetch the REAL Attestcoin proof for the sNUSD pause of 2026-08-13
 *   6. submit it, then read back the status and show the credit gate refusing new credit
 *
 * Requires: contracts/.env with DEPLOYER_PRIVATE_KEY, and testnet CTC in that account.
 * Funding is a Discord-bot faucet (see README) — a manual step we cannot perform.
 */

const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const artifacts = require('../artifacts/contracts.json');
const { ProofBuilderClient, toVerifierArgs } = require('../../spike/src/proofClient');
const { CC3_TESTNET, CHAIN_KEY } = require('../../spike/src/config');

const BLOCK_PROVER = CC3_TESTNET.blockProverPrecompile;

// The real source event: Staked NUSD paused on Ethereum, 2026-08-13 11:14:59 UTC.
const SNUSD = '0x08efcc2f3e61185d0ea7f8830b3fec9bfa2ee313';
const PAUSE_TX = '0xc25678129b98d6cb082472cc38b3e9908a81829e5826325c71d62318cb2f9c9a';
const PAUSE_BLOCK = 25745732n;

const PAUSED = ethers.id('Paused(address)');
const PAUSED_NOARG = ethers.id('Paused()');
const UNPAUSED = ethers.id('Unpaused(address)');
const UNPAUSED_NOARG = ethers.id('Unpaused()');
const STATUS = ['NO_PROOF', 'IMPAIRED', 'RESTORED'];

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

async function deploy(wallet, name, args = []) {
  const { abi, bytecode } = artifacts[name];
  const c = await new ethers.ContractFactory(abi, bytecode, wallet).deploy(...args);
  await c.waitForDeployment();
  console.log(`  deployed ${name.padEnd(20)} ${await c.getAddress()}`);
  return c;
}

async function main() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error('DEPLOYER_PRIVATE_KEY missing from contracts/.env');

  const provider = new ethers.JsonRpcProvider(CC3_TESTNET.rpcUrl);
  const wallet = new ethers.Wallet(pk, provider);
  const bal = await provider.getBalance(wallet.address);

  console.log('=== EligibilityLedger — deploy & ingest a real mainnet impairment ===\n');
  console.log('network :', CC3_TESTNET.name, '| chainId', (await provider.getNetwork()).chainId);
  console.log('deployer:', wallet.address);
  console.log('balance :', ethers.formatEther(bal), 'CTC\n');

  if (bal === 0n) {
    console.error('STOP: deployer has no testnet CTC.');
    console.error('Fund it via the Creditcoin Discord faucet, then re-run:');
    console.error('  1. join  https://discord.gg/creditcoin');
    console.error('  2. in #token-faucet post:  /faucet address:' + wallet.address);
    process.exit(2);
  }

  console.log('— deploying —');
  const decoder = await deploy(wallet, 'EvmV1Decoder');
  const ledger = await deploy(wallet, 'EligibilityLedger',
    [BLOCK_PROVER, await decoder.getAddress()]);
  const line = await deploy(wallet, 'GatedCreditLine', [await ledger.getAddress()]);
  const coll = await deploy(wallet, 'MockERC20', ['Staked NUSD', 'sNUSD']);
  const loan = await deploy(wallet, 'MockERC20', ['USD Coin', 'USDC']);

  console.log('\n— configuring —');
  await (await ledger.registerAsset(SNUSD, CHAIN_KEY.ETH_MAINNET, 'Staked NUSD (sNUSD)')).wait();
  console.log('  registered asset  ', SNUSD, '(chainKey', CHAIN_KEY.ETH_MAINNET + ')');
  for (const sig of [PAUSED, PAUSED_NOARG]) {
    await (await ledger.setImpairmentSignature(sig, true)).wait();
  }
  for (const sig of [UNPAUSED, UNPAUSED_NOARG]) {
    await (await ledger.setRestorationSignature(sig, true)).wait();
  }
  console.log('  impairment sigs   Paused(address), Paused()');
  console.log('  restoration sigs  Unpaused(address), Unpaused()');

  // The venue lends against the same asset id, so the gate reads the proven state directly.
  await (await line.listMarket(SNUSD, await loan.getAddress(), 9200)).wait();
  console.log('  market listed     collateral', SNUSD, 'LTV 92%');

  console.log('\n— fetching the real Attestcoin proof —');
  const pb = new ProofBuilderClient();
  const attested = await pb.attestedHeight(CHAIN_KEY.ETH_MAINNET);
  console.log('  attested height:', attested, '| needed:', PAUSE_BLOCK.toString());
  if (BigInt(attested) < PAUSE_BLOCK) throw new Error('source block not attested yet');
  const proof = await pb.proofByTxHash(CHAIN_KEY.ETH_MAINNET, PAUSE_TX);
  console.log('  proof: block', proof.headerNumber, '| siblings',
    proof.merkleProof?.siblings?.length ?? '?', '| roots', proof.continuityProof?.roots?.length ?? '?');

  console.log('\n— submitting —');
  const before = Number(await ledger.statusOf(SNUSD));
  console.log('  status before:', STATUS[before]);
  const tx = await (await ledger.submitEvent(...flatten(proof))).wait();
  console.log('  submitEvent tx:', tx.hash, '| gas', tx.gasUsed.toString());

  console.log('\n— reading back —');
  const after = Number(await ledger.statusOf(SNUSD));
  const since = await ledger.impairedSince(SNUSD);
  console.log('  status after :', STATUS[after]);
  console.log('  impairedSince:', since.toString(), '(source block)');
  const ev = await ledger.getEvent(0);
  console.log(`  event 0: asset ${ev.asset} impairment=${ev.impairment} srcBlock ${ev.srcBlock}`);

  console.log('\n— the credit gate —');
  let refused = false;
  try {
    await line.openPosition.staticCall(SNUSD, 1n, 0n);
  } catch (e) {
    refused = /AssetImpaired/.test(e.message ?? '');
    console.log('  openPosition reverted:', refused ? 'AssetImpaired ✅' : e.shortMessage ?? e.message);
  }

  const ok = after === 1 && since === PAUSE_BLOCK && refused;
  console.log('\nRESULT:', ok
    ? '✅ a real Ethereum impairment event was verified on Creditcoin and now gates new credit'
    : '❌ unexpected state');

  fs.writeFileSync(path.join(__dirname, '..', 'deployment.json'), JSON.stringify({
    network: CC3_TESTNET.name,
    decoder: await decoder.getAddress(),
    ledger: await ledger.getAddress(),
    creditLine: await line.getAddress(),
    blockProver: BLOCK_PROVER,
    asset: SNUSD,
    sourceTx: PAUSE_TX,
    sourceBlock: PAUSE_BLOCK.toString(),
    submitTx: tx.hash,
  }, null, 2));
  console.log('deployment.json written');
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error('\nFAILED:', e.message); process.exit(1); });
