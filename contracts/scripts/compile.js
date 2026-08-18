'use strict';
/** Compile the contracts with the npm `solc` (no system toolchain install). */

const fs = require('fs');
const path = require('path');
const solc = require('solc');

const ROOT = path.join(__dirname, '..');
const SOURCES = [
  // v2 — Collateral Eligibility Ledger (current project, docs/BUILD_SPEC_V2.md)
  'src/EligibilityLedger.sol',
  'src/GatedCreditLine.sol',
  'test/MocksV2.sol',
  // v1 — VaultAuthorityLedger. Idea was retired (see ideation/IDEA_SELECTION_2026-08-18.md);
  // kept compiling so its regression suite still runs and the proof plumbing stays verified.
  'src/VaultAuthorityLedger.sol',
  'test/Mocks.sol',
  // Vendored verbatim from @gluwa/usc-contracts@0.1.2. We deploy our OWN copy because the
  // decoder listed on the official chains/environments page is an older build missing
  // getLogsByEventSignature (verified 2026-08-17).
  'src/vendor/EvmV1Decoder.sol',
];

function readSource(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

const input = {
  language: 'Solidity',
  sources: Object.fromEntries(SOURCES.map((s) => [s, { content: readSource(s) }])),
  settings: {
    // The documented ASC entry point takes 7 flattened proof parameters, which overflows the
    // legacy codegen's stack. viaIR is required, not optional, for this signature shape.
    viaIR: true,
    // Conservative EVM target: avoids PUSH0/MCOPY, so the same bytecode runs on the local test
    // VM and on chains that lag on hardforks. Revisit only if CC3 is confirmed on Cancun+.
    evmVersion: 'paris',
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
  },
};

function findImport(importPath) {
  // Imports are written relative to the importing file (test/ -> ../src/…)
  const candidates = [
    path.join(ROOT, importPath),
    path.join(ROOT, 'test', importPath),
    path.join(ROOT, 'src', importPath),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return { contents: fs.readFileSync(c, 'utf8') };
  }
  return { error: 'not found: ' + importPath };
}

const out = JSON.parse(solc.compile(JSON.stringify(input), { import: findImport }));

const errors = (out.errors || []).filter((e) => e.severity === 'error');
for (const e of out.errors || []) {
  if (e.severity !== 'error') console.warn('warning:', e.formattedMessage.trim().split('\n')[0]);
}
if (errors.length) {
  for (const e of errors) console.error(e.formattedMessage);
  process.exit(1);
}

const artifacts = {};
for (const [file, contracts] of Object.entries(out.contracts || {})) {
  for (const [name, c] of Object.entries(contracts)) {
    artifacts[name] = { abi: c.abi, bytecode: '0x' + c.evm.bytecode.object };
    console.log(
      `compiled ${name.padEnd(22)} ${((c.evm.bytecode.object.length / 2) | 0)
        .toString()
        .padStart(6)} bytes   (${file})`);
  }
}

fs.mkdirSync(path.join(ROOT, 'artifacts'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'artifacts', 'contracts.json'), JSON.stringify(artifacts, null, 2));
console.log('\nartifacts/contracts.json written');
