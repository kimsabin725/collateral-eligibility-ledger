# HANDOFF MANIFEST

**Snapshot created:** 2026-08-17, 22:47 KST (Asia/Seoul)
**Project:** BUIDL CTC 2026 Fall — **VaultAuthorityLedger**
**Submission deadline:** 2026-09-06 13:59 KST

## Current stage

**Implementation, mid-vertical-slice.** Contracts are written, compiled, and pass a full local
regression suite — including an end-to-end run on **real Ethereum mainnet Attestcoin proofs**
through the **real** `EvmV1Decoder` (8/8), plus 15/15 application-logic and negative tests.

**Nothing has been deployed to any network.** The remaining step is blocked on a manual faucet.

## Read these three first

1. `docs/CODEX_HANDOFF.md` — status, environment, keys policy, next actions
2. `docs/BUILD_SPEC.md` — frozen scope, claims, and limits
3. `ideation/CORRECTION_ROLE_ATTRIBUTION.md` — the curator-vs-allocator correction; re-making that
   mistake invalidates the product

## Included

| Directory | Contents |
|---|---|
| `docs/` | `CODEX_HANDOFF.md`, `BUILD_SPEC.md`, `ENVIRONMENT_AUDIT.md` |
| `contracts/` | `VaultAuthorityLedger.sol`, vendored `EvmV1Decoder.sol`, `Mocks.sol`, `compile.js`, `deploy-and-ingest.js`, `ledger.test.js` (15 checks), `realdata.test.js` (8 checks), `README.md`, `package.json`, `package-lock.json`, `.gitignore`, `.env.example` |
| `spike/` | `scripts/01–06` (read-only Attestcoin verification), `src/config.js`, `src/proofClient.js`, `BASELINE.md`, `FINDINGS.md`, `README.md`, `package.json`, `package-lock.json`, `.gitignore`, `.env.example` |
| `ideation/` | 12 files: problem search, four kill records, finalist deep dive, decision trail |
| root | `HANDOFF_MANIFEST.md`, `.gitignore` |

## Deliberately excluded

| Excluded | Why |
|---|---|
| `contracts/.env` | **Contains a private key.** Never bundled. Generate your own — see `CODEX_HANDOFF.md` §4 |
| `node_modules/` (both projects) | ~90 MB; restore with `npm install`. Lockfiles are included |
| `.git/` | History not part of the handoff |
| `contracts/artifacts/` | Build output; `node scripts/compile.js` regenerates it |
| `.DS_Store` | macOS noise |

## Does not exist yet (do not assume otherwise)

- `contracts/deployment.json` — written only by a successful `deploy-and-ingest.js` run
- any frontend
- root `package.json`, CI config
- submission deck / demo video

## Current blocker

**CC3 testnet CTC is only obtainable via a Discord bot — a manual human step.**

1. join <https://discord.gg/creditcoin>
2. in `#token-faucet` post `/faucet address:<YOUR_DEPLOYER_ADDRESS>`

No API, CLI, or web faucet is documented. `deploy-and-ingest.js` detects a zero balance, prints
this instruction, and exits code 2.

## Verify the snapshot

```bash
cd spike && npm install && node scripts/06-prove-authority-action-chain.js   # AUTHORITY-ACTION CHAIN VERIFIED
cd ../contracts && npm install && node scripts/compile.js \
  && node test/ledger.test.js      # 15/15
  && node test/realdata.test.js    # 8/8   (needs network access)
```
