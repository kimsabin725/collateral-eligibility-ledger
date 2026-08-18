# CODEX HANDOFF — BUIDL CTC 2026 Fall / VaultAuthorityLedger

> Snapshot: **2026-08-17**. Submission deadline: **2026-09-06 13:59 KST**
> (platform countdown `2026-09-06T04:59:00Z`; the page body separately says "23:59 ET" — use the
> earlier value).
>
> **Read these three first, in order:**
> 1. [`BUILD_SPEC.md`](./BUILD_SPEC.md) — frozen scope, claims, and limits. Do not drift from it.
> 2. [`../contracts/README.md`](../contracts/README.md) — how to build, test, deploy.
> 3. [`../ideation/CORRECTION_ROLE_ATTRIBUTION.md`](../ideation/CORRECTION_ROLE_ATTRIBUTION.md) — the
>    curator-vs-allocator correction. Re-making this mistake would invalidate the product.

---

## 1. What this project is

An append-only record on **Creditcoin CC3 Testnet** of who was granted authority over a DeFi
lending vault on **Ethereum**, and what they subsequently did with depositor funds — each entry
admitted only on an **Attestcoin** proof of the underlying Ethereum transaction.

**The one idea that matters.** MetaMorpho's `reallocate` is `onlyAllocatorRole`, which admits
**allocator OR curator OR owner**. A single `ReallocateSupply` proof therefore shows only that
*some address* moved funds — it does not identify a role. Correct attribution needs **two composed
proofs**:

```
proof #1   SetIsAllocator(X, true)     on vault V @ block A    ← authority
proof #2   ReallocateSupply(X, m, …)   on vault V @ block B>A  ← action
           ⇒ "X, granted allocator authority on V at A, moved V's funds into m at B"
```

Without proof #1 the ledger writes role **UNKNOWN**. It never guesses. That composition is the
reason this needs Attestcoin rather than an event lookup, and it is the core scored feature.

---

## 2. Current Implementation Status

Verified by inspecting the repository at snapshot time.

### ✅ COMPLETED

| Item | Evidence |
|---|---|
| Local contract implementation | `contracts/src/VaultAuthorityLedger.sol` (6,921 bytes compiled) |
| Vendored official decoder | `contracts/src/vendor/EvmV1Decoder.sol`, verbatim from `@gluwa/usc-contracts@0.1.2` |
| Compilation, npm-only toolchain | `contracts/scripts/compile.js` — `solc` 0.8.36, `viaIR: true`, `evmVersion: 'paris'`. No system toolchain installed |
| **authority→action composition** | Implemented (`_roleAt`, strict `srcBlock` ordering) and tested |
| **Real Ethereum mainnet proof verification** | `contracts/test/realdata.test.js` — **8/8 passing**. Live Attestcoin proofs for 2 real mainnet txs, run through the **real** `EvmV1Decoder`; all 3 real actions attributed `ALLOCATOR` |
| Same-actor chain proven on-chain | `spike/scripts/06` — both txs `verify() ✅ TRUE` on Creditcoin; grant block 22,194,870 < action block 25,772,893 (~497 days) |
| **Batch-transaction bug found and fixed** | Real data revealed `_isTarget` reverted on any non-allowlisted emitter, making batched source txs unusable (the real grant spans several vaults; one action tx carried 48 logs). Now skips foreign logs; security property unchanged |
| Negative tests | `contracts/test/ledger.test.js` — `ProofRejected`, `QueryAlreadyProcessed` (replay), `NoMatchingEvent` (rogue vault / wrong event), `SourceTxFailed` (status 0), no-grant → `UNKNOWN`, late-grant → `UNKNOWN` (no back-dating), batched tx records only the allowlisted vault |
| Regression suite | **15/15** unit + **8/8** real-data + spike scripts 01–06 all passing |
| Read-only Attestcoin spike | `spike/scripts/01–06`, all passing; measured attestation lag ≈8–9 min on both mainnet and Sepolia |
| Deploy path written and gated | `contracts/scripts/deploy-and-ingest.js` — connects to CC3 (chainId 102031), detects zero balance, exits with faucet instructions |
| Environment compliance audit | `docs/ENVIRONMENT_AUDIT.md` — zero config drift vs official values; verdict HACKATHON ENVIRONMENT VERIFIED |

### ⛔ BLOCKED / NOT YET COMPLETED

| Item | Status |
|---|---|
| **CC3 Testnet deployment** | **NOT DONE.** Blocked on faucet (§3). No contract has been deployed to any network |
| **Real authority/action ingest on CC3** | **NOT DONE.** Proven locally against real proof data; never executed on-chain |
| `deployment.json` | **DOES NOT EXIST.** Written only by a successful `deploy-and-ingest.js` run |
| Minimum frontend | **NOT STARTED.** No frontend directory exists |
| `MandateGate.sol` policy consumer | **NOT STARTED** (NICE TO HAVE) |
| Curator-policy leg (`SubmitCap`) | **NOT STARTED.** No `SubmitCap`/`SetCap`/`SetCurator` sample obtained; frequency unknown. NICE TO HAVE, not required |
| Final README / deck / demo video | **NOT DONE.** `contracts/README.md` exists; the submission package does not |

---

## 3. The one external blocker

**CC3 testnet CTC is obtainable only through a Discord bot.** No API, no CLI, no web faucet is
documented. This requires a human:

1. join <https://discord.gg/creditcoin>
2. in `#token-faucet` post: `/faucet address:<YOUR_DEPLOYER_ADDRESS>`

`deploy-and-ingest.js` prints this instruction and exits code 2 when the balance is zero.

---

## 4. Keys and secrets — READ BEFORE DOING ANYTHING

- **No private key, seed phrase, or `.env` value is included in this bundle.** `contracts/.env`
  was deliberately excluded.
- **You are NOT inheriting a key.** Generate your **own fresh, project-only testnet keypair**:

  ```bash
  cd contracts && cp .env.example .env
  node -e "const {ethers}=require('ethers');const w=ethers.Wallet.createRandom();\
  console.log('DEPLOYER_PRIVATE_KEY='+w.privateKey);console.log('DEPLOYER_ADDRESS='+w.address)"
  ```
  Paste into `.env`, then fund via the Discord faucet.
- Never reuse an existing wallet. Never fund this address on mainnet.
- Ethereum **mainnet is read-only** in this project — it is a proof source only. No mainnet
  transaction is ever sent, so no real cost is incurred.
- For reference only, the address used during this session was
  `0xDd9ddFcEb1dc1dC0aE393DD458Fe376aaB60294a` (public address; it was never funded). Do not try
  to use it — you do not have its key, and you should not want it.

---

## 5. Repository map

```
docs/
  BUILD_SPEC.md              frozen scope/claims/limits — the contract with the project
  ENVIRONMENT_AUDIT.md       official-environment compliance audit (PASS)
  CODEX_HANDOFF.md           this file
contracts/
  package.json               npm-only toolchain: solc, ethers, @ethereumjs/*
  package-lock.json
  .gitignore                 node_modules/ .env artifacts/
  .env.example               no secrets; instructions to generate your own key
  README.md                  build / test / deploy instructions
  src/VaultAuthorityLedger.sol      the ledger (5 checks → decode → append)
  src/vendor/EvmV1Decoder.sol       vendored from @gluwa/usc-contracts@0.1.2
  test/Mocks.sol                    local stand-ins for precompile + decoder
  test/ledger.test.js               15/15 application-logic + negative tests
  test/realdata.test.js             8/8 real proofs + real decoder, local EVM
  scripts/compile.js                solc build (viaIR, evmVersion paris)
  scripts/deploy-and-ingest.js      one-command CC3 deploy + real ingest (faucet-gated)
spike/
  package.json / package-lock.json
  .gitignore / .env.example
  BASELINE.md                frozen technical baseline (what Attestcoin can/cannot do)
  FINDINGS.md                measured spike results + capability map
  README.md                  how to run the read-only scripts
  src/config.js              official CC3/chainKey/precompile/decoder config
  src/proofClient.js         Proof Builder client (waitUntilAttested, proof fetch)
  scripts/01-verify-readonly.js          proof → on-chain verify + tamper negative control
  scripts/02-decode-readonly.js          receipt/log decode, cross-checked vs Ethereum RPC
  scripts/03-chain-info.js               supported chains, attestation state, bounds
  scripts/04-prove-aave-repayment.js     control: proves a real Aave V3 Repay
  scripts/05-prove-curator-action.js     proves a real vault allocation action
  scripts/06-prove-authority-action-chain.js  THE core composition, both real txs
ideation/                    problem search, kill records, decision trail (12 files)
HANDOFF_MANIFEST.md          bundle manifest
.gitignore
```

**Not present** (do not assume otherwise): no frontend, no `deployment.json`, no root
`package.json`, no CI config.

---

## 6. Getting running in 3 minutes

```bash
cd spike     && npm install && node scripts/06-prove-authority-action-chain.js
cd ../contracts && npm install && node scripts/compile.js \
  && node test/ledger.test.js && node test/realdata.test.js
```

Expect: spike 06 → `AUTHORITY-ACTION CHAIN VERIFIED`; unit → `15/15`; real-data → `8/8`.
`contracts/artifacts/` is a build output and is **not** in the bundle — `compile.js` regenerates it.
`realdata.test.js` needs network access (live Proof Builder + public Ethereum RPC).

---

## 7. Official environment (verified 2026-08-17, zero drift)

| Component | Value |
|---|---|
| Creditcoin CC3 Testnet RPC | `https://rpc.cc3-testnet.creditcoin.network`, chainId **102031** |
| Explorer | `https://creditcoin-testnet.blockscout.com/` |
| Proof Builder API | `https://proof-gen-api.cc3-testnet.creditcoin.network` |
| BlockProver precompile | `0x0000000000000000000000000000000000000FD2` |
| ChainInfo precompile | `0x0000000000000000000000000000000000000fd3` |
| Decoder (official, **stale**) | `0x731c345d79Fb8BbDC541f9DF3b6317585F849F9f` — missing `getLogsByEventSignature`; deploy your own |
| Source chains | Ethereum **Sepolia = chainKey 1**, Ethereum **Mainnet = chainKey 3** |
| SDK / contracts | `@gluwa/usc-sdk@0.18.0`, `@gluwa/usc-contracts@0.1.2` |
| Attestation latency | ≈**8–9 min** (measured, both chains) — rules out a single-take live demo |

Build flags that are **not optional**: `viaIR: true` (7 flattened ASC proof params overflow the
legacy stack) and `evmVersion: 'paris'` (solc 0.8.36 otherwise emits Cancun opcodes the local test
VM rejects).

---

## 8. Reference data — the two real mainnet transactions

| Role | tx | Block | Note |
|---|---|---|---|
| AUTHORITY | `0x52ced076746bb8682d009f0b2b6d19101e77998a866808f1b6fa8c442e4106fd` | 22,194,870 | `SetIsAllocator(0x9e9110cf…f9e1, true)` on steakUSDC. Batched across vaults |
| ACTION | `0x35a2f50fbbe5c624b6c26551f530448557589c4d92348afdd4070a7fbf98e8f0` | 25,772,893 | 3 × `ReallocateSupply` by the same actor |

Vault: steakUSDC `0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB` — MetaMorpho **Vault V1 (v1.1)**,
`owner 0x0A0e559b…f8DD`, `curator 0x827e8607…eCdB`, `guardian 0xaa050019…c03d`, timelock 604,800 s.

---

## 9. Next actions, in order

1. **Generate your own testnet keypair** (§4), then get the user to run the Discord faucet (§3).
2. `node scripts/deploy-and-ingest.js` → satisfies `BUILD_SPEC` §17 criteria 1–2 and writes
   `deployment.json`.
3. Re-run the negative cases **on CC3** (tamper / replay / rogue vault) and capture transcripts —
   `BUILD_SPEC` §17.3.
4. Minimum frontend: one actor profile page — grants, actions, roles, source-tx links.
5. Submission package: README, deck, 2–3 min demo video per `BUILD_SPEC` §18.

## 10. Hard rules — do not break these

- Never say "the curator moved depositor funds". An **allocator** executes; the **curator** sets the
  risk envelope; the **owner** appoints both.
- `SetCap` is **not** a curator decision — `acceptCap` is permissionless after the timelock. The
  curator's decision is `SubmitCap`.
- Never claim a complete history. **Absence is unprovable.** Always "proven actions".
- Never claim an actor is *currently* authorised — we prove a grant at a block, never
  non-revocation.
- Never claim any named firm behaved wrongly. On-chain statements are neutral reports of public
  data; adverse demo scenarios must use a clearly-labelled mock market.
- Discovery is **not** trustless (finding which txs to submit needs an indexer). Verification is.
- Full list: `BUILD_SPEC.md` §15–16.
