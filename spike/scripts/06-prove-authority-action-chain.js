'use strict';
/**
 * THE core proof composition for CuratorLedger — verified on real Ethereum mainnet data.
 *
 * Claim under test: can Attestcoin prove that *the same actor* was granted authority over a
 * vault and later exercised that authority — with the assignment strictly preceding the action?
 *
 * Answer: YES. Two independent transactions on the same vault, both proven and decoded on
 * Creditcoin, both naming the same address:
 *
 *   AUTHORITY  block 22,194,870  SetIsAllocator(0x9e9110cf…f9e1, true)   on steakUSDC
 *   ACTION     block 25,772,893  ReallocateSupply(caller=0x9e9110cf…f9e1, market, assets)
 *                                └─ 3,578,023 blocks (~497 days) after the grant
 *
 * WHY THIS MATTERS: a single ReallocateSupply proof shows only that *some address* moved funds —
 * `onlyAllocatorRole` admits allocator OR curator OR owner. Attribution to a role is only correct
 * when composed with an authority proof. This is why the design needs Attestcoin rather than an
 * event lookup.
 *
 * HONEST LIMITS (do not overstate — see ideation/CORRECTION_ROLE_ATTRIBUTION.md):
 *   1. We do NOT prove the grant was never revoked between the two blocks. Absence is unprovable.
 *      A revocation is itself an event, so it can be *submitted* — but its non-existence cannot.
 *   2. Strictly, X's authority at action time could have come from curator/owner status instead.
 *      The grant is a sufficient and parsimonious explanation, not an exclusive one.
 *   3. DISCOVERY is not trustless. The historical grant was located via Blockscout's indexer
 *      because public RPCs prune state and cap getLogs ranges. Verification is trustless;
 *      finding what to verify is not.
 *
 * Read-only: hosted Proof Builder + eth_call. No wallet, no gas, no deployment.
 *
 * Usage: node scripts/06-prove-authority-action-chain.js
 */

const { ethers } = require('ethers');
const { CHAIN_KEY, CC3_TESTNET, BLOCK_PROVER_ABI } = require('../src/config');
const { ProofBuilderClient, toVerifierArgs } = require('../src/proofClient');

const VAULT = '0xbeef01735c132ada46aa9aa4c54623caa92a64cb'; // steakUSDC, MetaMorpho V1 (v1.1)
const ACTOR = '0x9e9110cfd24cd851ea5bc73a27975b33e308f9e1';

const STEPS = [
  {
    label: 'AUTHORITY — SetIsAllocator',
    tx: '0x52ced076746bb8682d009f0b2b6d19101e77998a866808f1b6fa8c442e4106fd',
    topic0: ethers.id('SetIsAllocator(address,bool)'),
    describe: (log) => `enabled=${BigInt(log.data) === 1n}`,
  },
  {
    label: 'ACTION    — ReallocateSupply',
    tx: '0x35a2f50fbbe5c624b6c26551f530448557589c4d92348afdd4070a7fbf98e8f0',
    topic0: ethers.id('ReallocateSupply(address,bytes32,uint256,uint256)'),
    describe: (log) => `market=${log.topics[2].slice(0, 16)}…`,
  },
];

const DECODER_ABI = [
  'function decodeReceiptFields(bytes chunk) pure returns ((uint8 receiptStatus, uint64 receiptGasUsed, (address address_, bytes32[] topics, bytes data)[] receiptLogs, bytes receiptLogsBloom))',
];

async function main() {
  const pb = new ProofBuilderClient();
  const cc3 = new ethers.JsonRpcProvider(CC3_TESTNET.rpcUrl);
  const prover = new ethers.Contract(CC3_TESTNET.blockProverPrecompile, BLOCK_PROVER_ABI, cc3);
  const decoder = new ethers.Contract(CC3_TESTNET.decoderContract, DECODER_ABI, cc3);

  console.log('=== Authority → Action chain, same actor, real mainnet data ===\n');
  console.log('vault :', VAULT, '(steakUSDC)');
  console.log('actor :', ACTOR);
  console.log('attested height:', await pb.attestedHeight(CHAIN_KEY.ETH_MAINNET), '\n');

  const blocks = [];
  let allOk = true;

  for (const step of STEPS) {
    const proof = await pb.proofByTxHash(CHAIN_KEY.ETH_MAINNET, step.tx);
    const a = toVerifierArgs(proof);
    const verified = await prover.verify(
      a.chainKey, a.height, a.encodedTransaction, a.merkleProof, a.continuityProof);
    const receipt = await decoder.decodeReceiptFields(proof.txBytes);

    // Only logs emitted BY the vault itself count — otherwise a look-alike contract could lie.
    const logs = receipt.receiptLogs.filter(
      (l) => l.topics.length && l.topics[0] === step.topic0 && l.address_.toLowerCase() === VAULT);
    const sameActor = logs.filter((l) => ('0x' + l.topics[1].slice(26)).toLowerCase() === ACTOR);

    console.log(`--- ${step.label}`);
    console.log('    block        :', proof.headerNumber);
    console.log('    VERIFY       :', verified ? '✅ TRUE' : '❌ FALSE',
      '| receiptStatus', receipt.receiptStatus.toString());
    console.log('    vault logs   :', logs.length, '| naming our actor:', sameActor.length);
    for (const l of sameActor) console.log('       ✅ same actor |', step.describe(l));
    console.log();

    blocks.push(proof.headerNumber);
    if (!verified || receipt.receiptStatus !== 1n || !sameActor.length) allOk = false;
  }

  const [authorityBlock, actionBlock] = blocks;
  const ordered = authorityBlock < actionBlock;
  console.log('--- ordering');
  console.log(`    authority ${authorityBlock} < action ${actionBlock} :`, ordered ? '✅ YES' : '❌ NO');
  console.log(`    gap: ${actionBlock - authorityBlock} blocks (~${Math.round((actionBlock - authorityBlock) * 12 / 86400)} days)\n`);

  console.log(allOk && ordered
    ? 'RESULT: AUTHORITY-ACTION CHAIN VERIFIED'
    : 'RESULT: NOT VERIFIED');
  console.log('\nStill NOT proven: that the grant was never revoked in between (absence is');
  console.log('unprovable), nor that X\'s authority at action time derived specifically from');
  console.log('the allocator grant rather than curator/owner status.');
}

main().catch((e) => {
  console.error('\nFAILED:', e.shortMessage || e.message);
  process.exit(1);
});
