# HANDOFF MANIFEST

**Snapshot updated:** 2026-08-22 KST (Asia/Seoul)
**Project:** BUIDL CTC 2026 Fall — **Collateral Eligibility Ledger**
**Submission deadline:** 2026-09-06 13:59 KST

## Current stage

**Deployed and verified on CC3 Testnet.** A real Ethereum mainnet impairment event
(sNUSD `Paused`, block 25,745,732) was proven with Attestcoin, admitted by the on-chain ledger, and
gates new credit — plus a read-only demo showing four forgeries rejected on-chain.

Local regression: **60/60**. No technical blocker remains; only the deck and demo video are left.

| Contract | Address |
|---|---|
| `EligibilityLedger` | `0xA47a20079112252afAF2d54fF1FF0268bE3826a4` |
| `GatedCreditLine` | `0x0D35A7Bd0dcBBebAb54861bCe9CD04Da790B32eb` |
| `EvmV1Decoder` | `0xd735522d27cF22E443F48a3a3A3Dd2de8f24F008` |
| admitting tx | `0xbf8bda4f6595a1c61043f3897e35056fc0fbc5d9952d3abe8166d7bec68da4df` |

## Read these three first

1. `README.md` (root) — the submission-facing overview: live addresses, how to reproduce, limits
2. `docs/CURRENT_STATE.md` — always-current status
3. `docs/BUILD_SPEC_V2.md` — frozen scope, claims, and limits for the current project

`ideation/CORRECTION_ROLE_ATTRIBUTION.md` still matters if you touch the v1 ledger: re-making the
curator-vs-allocator mistake invalidates that component.

## Included

| Directory | Contents |
|---|---|
| `docs/` | `CURRENT_STATE.md`, `BUILD_SPEC_V2.md`, `BUILD_SPEC.md`, `CODEX_HANDOFF*.md`, `ENVIRONMENT_AUDIT.md` |
| `contracts/` | `EligibilityLedger.sol`, `GatedCreditLine.sol`, `VaultAuthorityLedger.sol`, vendored `EvmV1Decoder.sol`, mocks, `compile.js`, `deploy-eligibility.js`, `demo-rejections.js`, `deploy-and-ingest.js`, four test suites (27+10+15+8), `deployment.json`, `README.md`, `package.json`, `package-lock.json`, `.gitignore`, `.env.example` |
| `spike/` | `scripts/01–06` (read-only Attestcoin verification), `src/config.js`, `src/proofClient.js`, `BASELINE.md`, `FINDINGS.md`, `README.md`, `package.json`, `package-lock.json`, `.gitignore`, `.env.example` |
| `ideation/` | problem search, kill records, finalist deep dive, decision trail |
| root | `README.md`, `HANDOFF_MANIFEST.md`, `CROSS_CHAIN_COLLATERAL_ELIGIBILITY_PROJECT_STATE.md`, `PROJECT_REVIEW_PACKET_2026-08-18.md`, `.gitignore` |

## Deliberately excluded

| Excluded | Why |
|---|---|
| `contracts/.env` | **Contains a private key.** Never bundled. Generate your own — see `CODEX_HANDOFF.md` §4 |
| `node_modules/` (both projects) | ~90 MB; restore with `npm install`. Lockfiles are included |
| `.git/` | History not part of the handoff |
| `contracts/artifacts/` | Build output; `node scripts/compile.js` regenerates it |
| `.DS_Store` | macOS noise |

## Does not exist yet (do not assume otherwise)

- any frontend (deliberate — a deterministic script demo was judged safer than a UI)
- root `package.json`, CI config
- demo video

Note: `contracts/deployment.json` **now exists** and records the live CC3 deployment.

## Current blocker

**None technical.** The Discord faucet — previously the only blocker — was resolved on 2026-08-22
(10,000 CTC received; ~9,996 CTC remaining). Anyone redeploying from a fresh key still needs it:

1. join <https://discord.gg/creditcoin>
2. in the `faucet` channel post the slash command `/faucet address:<YOUR_DEPLOYER_ADDRESS>`
   (choose it from Discord's autocomplete — plain text is not parsed; rate-limited to one request
   per address per hour)

No API, CLI, or web faucet is documented. Both deploy scripts detect a zero balance, print this
instruction, and exit code 2.

## Verify the snapshot

```bash
cd spike && npm install && node scripts/06-prove-authority-action-chain.js   # AUTHORITY-ACTION CHAIN VERIFIED
cd ../contracts && npm install && node scripts/compile.js \
  && node test/eligibility.test.js          # 27/27
  && node test/realdata-eligibility.test.js # 10/10  (needs network access)
  && node test/ledger.test.js               # 15/15
  && node test/realdata.test.js             #  8/8   (needs network access)

# against the live deployment, read-only, no key required:
node scripts/demo-rejections.js             # four forgeries rejected on-chain
```
