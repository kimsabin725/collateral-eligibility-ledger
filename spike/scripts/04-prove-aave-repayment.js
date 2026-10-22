'use strict';
// Spike 4: prove a real Aave V3 Repay (and find LiquidationCall) on mainnet, read-only.

const { ethers } = require('ethers');
const { CHAIN_KEY, CC3_TESTNET, BLOCK_PROVER_ABI } = require('../src/config');
const { ProofBuilderClient, toVerifierArgs } = require('../src/proofClient');

const AAVE_V3_POOL = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2'; // Ethereum mainnet
const EVENTS = {
  Repay: ethers.id('Repay(address,address,address,uint256,bool)'),
  LiquidationCall: ethers.id(
    'LiquidationCall(address,address,address,uint256,uint256,address,bool)'),
};

const chainKey = CHAIN_KEY.ETH_MAINNET;

async function main() {
  const pb = new ProofBuilderClient();
  const eth = new ethers.JsonRpcProvider(CC3_TESTNET.sourceChains[chainKey].rpcUrl);
  const cc3 = new ethers.JsonRpcProvider(CC3_TESTNET.rpcUrl);
  const prover = new ethers.Contract(CC3_TESTNET.blockProverPrecompile, BLOCK_PROVER_ABI, cc3);

  console.log('=== Can Creditcoin verify real Ethereum credit events? ===\n');

  const [attested, head] = await Promise.all([pb.attestedHeight(chainKey), eth.getBlockNumber()]);
  const lag = head - attested;
  console.log('Ethereum mainnet head :', head);
  console.log('Attested height       :', attested);
  console.log(`Lag                   : ${lag} blocks ≈ ${((lag * 12) / 60).toFixed(1)} min\n`);

  for (const [name, topic0] of Object.entries(EVENTS)) {
    // Narrow window below the attested tip: recent enough for a public RPC, old enough to be attested.
    let logs = [];
    try {
      logs = await eth.getLogs({
        address: AAVE_V3_POOL,
        topics: [topic0],
        fromBlock: attested - 45,
        toBlock: attested - 2,
      });
    } catch (err) {
      console.log(`${name}: log query failed (${(err.shortMessage || err.message).slice(0, 60)})`);
      continue;
    }

    console.log(`--- Aave V3 ${name}: ${logs.length} event(s) in the attested window ---`);
    if (!logs.length) {
      console.log('    none in this window; re-run later\n');
      continue;
    }

    const log = logs[logs.length - 1];
    console.log('    tx      :', log.transactionHash);
    console.log('    block   :', log.blockNumber);
    console.log('    reserve : 0x' + log.topics[1].slice(26));
    console.log('    user    : 0x' + log.topics[2].slice(26));

    const t0 = Date.now();
    const proof = await pb.proofByTxHash(chainKey, log.transactionHash);
    const args = toVerifierArgs(proof);
    const ok = await prover.verify(
      args.chainKey, args.height, args.encodedTransaction, args.merkleProof, args.continuityProof);
    console.log(`    proof   : ${Date.now() - t0} ms`);
    console.log(`    VERIFY  : ${ok ? '✅ TRUE' : '❌ FALSE'}\n`);
  }

  console.log('Interpretation:');
  console.log('  A Creditcoin contract can prove "wallet X repaid / was liquidated on Aave"');
  console.log('  from the protocol\'s own event, with no trusted score provider in the path.');
  console.log('  What it CANNOT prove is absence — "X was never liquidated" is not provable.');
  console.log('  See PROBLEM_CANDIDATES.md for why that shapes the design.');
}

main().catch((e) => {
  console.error('\nFAILED:', e);
  process.exit(1);
});
