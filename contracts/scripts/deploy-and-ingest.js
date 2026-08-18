'use strict';
/**
 * One command to complete the vertical slice on CC3 Testnet, once the deployer is funded.
 *
 *   node scripts/deploy-and-ingest.js
 *
 * It will:
 *   1. deploy EvmV1Decoder (own copy — the officially-listed one at 0x731c…F9f is a stale build)
 *   2. deploy VaultAuthorityLedger, wired to the real BlockProver precompile 0x…0FD2
 *   3. allowlist the steakUSDC vault
 *   4. fetch REAL Attestcoin proofs for the two real Ethereum mainnet transactions
 *   5. submit the authority grant, then the action
 *   6. read back the record and assert roleAtAction == ALLOCATOR
 *
 * Requires: contracts/.env with DEPLOYER_PRIVATE_KEY, and testnet CTC in that account.
 * Funding is a Discord-bot faucet (see README) — a manual step we cannot perform.
 */

const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const artifacts = require('../artifacts/contracts.json');
const { ProofBuilderClient, toVerifierArgs } =
  require('../../spike/src/proofClient');
const { CC3_TESTNET, CHAIN_KEY } = require('../../spike/src/config');

const BLOCK_PROVER = CC3_TESTNET.blockProverPrecompile;
const VAULT = '0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB'; // steakUSDC
const ACTOR = '0x9e9110cfd24cd851ea5bc73a27975b33e308f9e1';

// The two real, already-verified Ethereum mainnet transactions (see spike/scripts/06).
const AUTHORITY_TX = '0x52ced076746bb8682d009f0b2b6d19101e77998a866808f1b6fa8c442e4106fd'; // blk 22,194,870
const ACTION_TX    = '0x35a2f50fbbe5c624b6c26551f530448557589c4d92348afdd4070a7fbf98e8f0'; // blk 25,772,893

const ROLE = ['UNKNOWN', 'OWNER', 'CURATOR', 'ALLOCATOR'];

/** Flatten a Proof Builder response into the documented ASC entry-point parameter shape. */
function flatten(proof) {
  const a = toVerifierArgs(proof);
  return [
    a.chainKey,
    a.height,
    a.encodedTransaction,
    a.merkleProof[0],                                    // merkleRoot
    a.merkleProof[1].map(([hash, isLeft]) => ({ hash, isLeft })),
    a.continuityProof[0],                                // lowerEndpointDigest
    a.continuityProof[1],                                // continuityRoots
  ];
}

async function deploy(wallet, name, args = []) {
  const { abi, bytecode } = artifacts[name];
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const c = await factory.deploy(...args);
  await c.waitForDeployment();
  const addr = await c.getAddress();
  console.log(`  deployed ${name.padEnd(22)} ${addr}`);
  return c;
}

async function main() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error('DEPLOYER_PRIVATE_KEY missing from contracts/.env');

  const provider = new ethers.JsonRpcProvider(CC3_TESTNET.rpcUrl);
  const wallet = new ethers.Wallet(pk, provider);
  const bal = await provider.getBalance(wallet.address);

  console.log('=== VaultAuthorityLedger — deploy & ingest real mainnet data ===\n');
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
  const decoderSrc = require.resolve(
    '@gluwa/usc-contracts/contracts/decoding/EvmV1Decoder.sol', { paths: [path.join(__dirname, '../../spike')] });
  console.log('  (decoder source available at', path.relative(process.cwd(), decoderSrc) + ')');
  if (!artifacts.EvmV1Decoder) {
    throw new Error('EvmV1Decoder not compiled. Add it to scripts/compile.js SOURCES and re-run.');
  }
  const decoder = await deploy(wallet, 'EvmV1Decoder');
  const ledger = await deploy(wallet, 'VaultAuthorityLedger',
    [BLOCK_PROVER, await decoder.getAddress()]);

  console.log('\n— allowlisting the source vault —');
  await (await ledger.setKnownVault(VAULT, true)).wait();
  console.log('  steakUSDC allowlisted:', VAULT);

  const pb = new ProofBuilderClient();
  console.log('\n— fetching real Attestcoin proofs —');
  const [authProof, actionProof] = await Promise.all([
    pb.proofByTxHash(CHAIN_KEY.ETH_MAINNET, AUTHORITY_TX),
    pb.proofByTxHash(CHAIN_KEY.ETH_MAINNET, ACTION_TX),
  ]);
  console.log('  authority proof: block', authProof.headerNumber);
  console.log('  action    proof: block', actionProof.headerNumber);

  console.log('\n— submitting (order matters: authority first) —');
  const t1 = await (await ledger.submitAuthority(...flatten(authProof))).wait();
  console.log('  submitAuthority tx:', t1.hash, '| gas', t1.gasUsed.toString());
  const t2 = await (await ledger.submitAction(...flatten(actionProof))).wait();
  console.log('  submitAction    tx:', t2.hash, '| gas', t2.gasUsed.toString());

  console.log('\n— reading back —');
  const n = await ledger.recordCount();
  for (let i = 0; i < n; i++) {
    const r = await ledger.getRecord(i);
    console.log(`  record ${i}: actor ${r.actor} role ${ROLE[Number(r.roleAtAction)]}` +
      ` market ${r.market.slice(0, 14)}… srcBlock ${r.srcBlock}`);
  }
  const first = await ledger.getRecord(0);
  const ok = Number(first.roleAtAction) === 3 &&
    first.actor.toLowerCase() === ACTOR.toLowerCase();
  console.log('\nRESULT:', ok
    ? '✅ real mainnet authority→action chain recorded on Creditcoin with role ALLOCATOR'
    : '❌ unexpected record contents');

  fs.writeFileSync(path.join(__dirname, '..', 'deployment.json'), JSON.stringify({
    network: CC3_TESTNET.name,
    decoder: await decoder.getAddress(),
    ledger: await ledger.getAddress(),
    blockProver: BLOCK_PROVER,
    vault: VAULT,
    authorityTx: AUTHORITY_TX,
    actionTx: ACTION_TX,
  }, null, 2));
  console.log('deployment.json written');
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error('\nFAILED:', e.shortMessage || e.message); process.exit(1); });
