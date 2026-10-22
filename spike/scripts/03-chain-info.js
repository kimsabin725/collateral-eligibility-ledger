'use strict';
// Spike 3: ask the ChainInfo precompile which source chains it attests.
// Its functions are snake_case, so use the ABI shipped in @gluwa/usc-sdk rather than a hand-written one.

const { ethers } = require('ethers');
const CHAIN_INFO_ABI = require('@gluwa/usc-sdk/dist/chain-info/chain_info.json');
const { CC3_TESTNET } = require('../src/config');

const toName = (hexBytes) => ethers.toUtf8String(hexBytes);

async function main() {
  const cc3 = new ethers.JsonRpcProvider(CC3_TESTNET.rpcUrl);
  const info = new ethers.Contract(CC3_TESTNET.chainInfoPrecompile, CHAIN_INFO_ABI, cc3);

  console.log('=== ChainInfo precompile —', CC3_TESTNET.name, '===\n');
  console.log('Precompile :', CC3_TESTNET.chainInfoPrecompile);
  console.log('EVM chainId:', (await cc3.getNetwork()).chainId.toString(), '\n');

  const chains = await info.get_supported_chains();
  console.log(`Supported source chains: ${chains.length}\n`);

  for (const c of chains) {
    const [genesis, latest] = await Promise.all([
      info.get_attestation_genesis_height(c.chainKey),
      info.get_latest_attestation_height_and_hash(c.chainKey),
    ]);
    console.log(`  chainKey ${c.chainKey}  "${toName(c.chainName)}"`);
    console.log(`    EVM chainId      : ${c.chainId}`);
    console.log(`    chainEncoding    : ${c.chainEncoding}`);
    console.log(`    attested since   : block ${genesis}`);
    console.log(`    latest attested  : ${latest.height} (isAttestation=${latest.isAttestation}, exists=${latest.exists})`);
    console.log(`    digest           : ${latest.hash}\n`);
  }

  // Continuity bounds show the window a proof for a given height is anchored between.
  const sepolia = chains.find((c) => Number(c.chainKey) === 1);
  if (sepolia) {
    const latest = await info.get_latest_attestation_height_and_hash(1);
    const probe = Number(latest.height) - 300;
    const bounds = await info.get_attestation_bounds(1, probe);
    console.log(`get_attestation_bounds(chainKey=1, height=${probe}):`);
    console.log(`  isAttested : ${bounds.isAttested}`);
    console.log(`  parent     : ${bounds.parentHeight} (attestation=${bounds.parentIsAttestation})`);
    console.log(`  child      : ${bounds.childHeight} (attestation=${bounds.childIsAttestation})`);
    console.log(`  is_height_attested(${probe}) : ${await info.is_height_attested(1, probe)}`);
  }

  console.log('\nNOTE: chainKey is an Attestcoin-internal id, NOT the EVM chain id.');
  console.log('      Originating a source tx on the Ethereum-mainnet chainKey costs real ETH.');
}

main().catch((e) => {
  console.error('\nFAILED:', e);
  process.exit(1);
});
