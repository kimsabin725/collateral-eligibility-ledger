'use strict';
/**
 * Feasibility probe for finalist P-A — DeFi vault governance accountability.
 *
 * Question: can a Creditcoin contract cryptographically prove *who acted* on a lending vault on
 * Ethereum — with no indexer, no Dune, no API?
 *
 * ROLE CORRECTION (verified on-chain 2026-08-17): `reallocate` is `onlyAllocatorRole`, so the
 * caller of ReallocateSupply is an ALLOCATOR (or the curator, or the owner) — NOT necessarily the
 * curator. For steakUSDC, isAllocator(0x9e9110cf…f9e1) == true while curator() is
 * 0x827e8607…eCdB, so that caller is an allocator. Roles must be proven, never assumed.
 *
 * MetaMorpho (Morpho's curated-vault layer) emits exactly the right provenance chain:
 *
 *   MetaMorphoFactory.CreateMetaMorpho(vault, ...)   -> vault V is a genuine MetaMorpho vault
 *   V.SetCurator(curator C)                          -> C controls V
 *   V.SetIsAllocator(A, true)                        -> owner authorised allocator A
 *   V.SubmitCap(caller=C, market id=M, cap)          -> CURATOR set the risk envelope
 *   V.ReallocateSupply(caller=A, id=M, assets)       -> ALLOCATOR executed within it
 *   (note: SetCap is NOT a curator act — acceptCap is permissionless after the timelock)
 *
 * Every one is an event from a known contract with the actor in an indexed field, so each is
 * provable via Attestcoin, and composing an appointment proof with an action proof yields the
 * only correct claim: "A, an allocator authorised by the owner, moved vault V into market M,
 * inside a cap the curator had set."
 *
 * Read-only: public RPC + hosted Proof Builder + eth_call. No wallet, no gas, no deployment.
 *
 * Usage: node scripts/05-prove-curator-action.js
 */

const { ethers } = require('ethers');
const { CHAIN_KEY, CC3_TESTNET, BLOCK_PROVER_ABI } = require('../src/config');
const { ProofBuilderClient, toVerifierArgs } = require('../src/proofClient');

/**
 * A large, live MetaMorpho vault. Curator/allocator activity here is frequent —
 * measured 344 `ReallocateSupply` events in ~50k blocks (~7 days) on 2026-08-17.
 * Scanning without an address filter finds almost nothing: these events come from
 * thousands of individual vault contracts, not from one hub.
 */
const VAULT = '0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB'; // steakUSDC (Steakhouse Financial)

/** Public RPCs vary wildly in allowed getLogs range; this one served 50k-block queries. */
const WIDE_RANGE_RPC = 'https://rpc.flashbots.net';

const TOPIC = {
  SetCurator: ethers.id('SetCurator(address)'),
  SetCap: ethers.id('SetCap(address,bytes32,uint256)'),
  ReallocateSupply: ethers.id('ReallocateSupply(address,bytes32,uint256,uint256)'),
  ReallocateWithdraw: ethers.id('ReallocateWithdraw(address,bytes32,uint256,uint256)'),
};

const chainKey = CHAIN_KEY.ETH_MAINNET;

async function main() {
  const pb = new ProofBuilderClient();
  const eth = new ethers.JsonRpcProvider(CC3_TESTNET.sourceChains[chainKey].rpcUrl);
  const cc3 = new ethers.JsonRpcProvider(CC3_TESTNET.rpcUrl);
  const prover = new ethers.Contract(CC3_TESTNET.blockProverPrecompile, BLOCK_PROVER_ABI, cc3);

  console.log('=== Can Creditcoin prove who allocated depositor funds? ===\n');

  const [attested, head] = await Promise.all([pb.attestedHeight(chainKey), eth.getBlockNumber()]);
  console.log('Ethereum mainnet head :', head);
  console.log('Attested height       :', attested, `(lag ${head - attested} blocks)\n`);

  const wide = new ethers.JsonRpcProvider(WIDE_RANGE_RPC);
  const logs = await wide.getLogs({
    address: VAULT,
    topics: [TOPIC.ReallocateSupply],
    fromBlock: attested - 50000,
    toBlock: attested - 20, // stay inside the attested range
  });
  console.log(`ReallocateSupply on ${VAULT}: ${logs.length} events in ~50k blocks\n`);
  if (!logs.length) { console.log('None found; widen the range.'); return; }

  const log = logs[logs.length - 1];
  console.log('--- latest allocation action (role proven separately) ---');
  console.log('  vault (emitter):', log.address);
  console.log('  block / tx     :', log.blockNumber, '/', log.transactionHash);
  console.log('  actor (caller) : 0x' + log.topics[1].slice(26), ' <-- WHO moved the funds (role must be proven separately)');
  console.log('  market id      :', log.topics[2].slice(0, 26) + '…  <-- WHERE they moved them\n');

  const t0 = Date.now();
  const proof = await pb.proofByTxHash(chainKey, log.transactionHash);
  const a = toVerifierArgs(proof);
  const ok = await prover.verify(
    a.chainKey, a.height, a.encodedTransaction, a.merkleProof, a.continuityProof);
  console.log(`  proof          : ${Date.now() - t0} ms, txBytes ${(proof.txBytes.length - 2) / 2}`);
  console.log(`  VERIFY         : ${ok ? '✅ TRUE' : '❌ FALSE'}\n`);

  // Decode on Creditcoin: show the actor and market are readable by a contract, not just by us.
  const DECODER_ABI = [
    'function decodeReceiptFields(bytes chunk) pure returns ((uint8 receiptStatus, uint64 receiptGasUsed, (address address_, bytes32[] topics, bytes data)[] receiptLogs, bytes receiptLogsBloom))',
  ];
  const decoder = new ethers.Contract(CC3_TESTNET.decoderContract, DECODER_ABI, cc3);
  const receipt = await decoder.decodeReceiptFields(proof.txBytes);
  const hits = receipt.receiptLogs.filter(
    (l) => l.topics.length && l.topics[0] === TOPIC.ReallocateSupply);
  console.log('--- decoded ON Creditcoin ---');
  console.log('  receiptStatus  :', receipt.receiptStatus.toString(),
    receipt.receiptStatus === 1n ? '(success)' : '(FAILED tx)');
  console.log('  ReallocateSupply logs in this tx:', hits.length);
  for (const l of hits.slice(0, 3)) {
    console.log(`    vault ${l.address_}  caller 0x${l.topics[1].slice(26)}  market ${l.topics[2].slice(0, 18)}…`);
  }
  console.log();

  console.log('Interpretation:');
  console.log('  The actor is in an indexed topic, so "address X moved vault V into market M"');
  console.log('  is a provable fact — unlike an Aave repayment, which is merely position management.');
  console.log('  But the ROLE is NOT in this event: bind it with a SetIsAllocator/SetCurator proof.');
  console.log('  Still NOT provable: absence of other actions, or whether the move was imprudent.');
}

main().catch((e) => {
  console.error('\nFAILED:', e.shortMessage || e.message);
  process.exit(1);
});
