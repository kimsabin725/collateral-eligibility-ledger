'use strict';
// Proves the same address was granted allocator role on a vault and later exercised it. Read-only.
// Limits: a revocation in between cannot be ruled out, and the grant was located via an indexer.

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
