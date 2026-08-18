# CuratorLedger — Scenario, Architecture, MVP, Demo, Adversarial Review

> 2026-08-17. Nothing here has been implemented. No wallet, key, deployment or mainnet
> transaction has been used; the verification results cited are read-only.

---

## 1. Architecture

```
[ ETHEREUM MAINNET ]
  MetaMorphoFactory ── CreateMetaMorpho(vault,…)      provenance: V is a real vault
  Vault V (ERC-4626) ─ SetCurator(C) / SetIsAllocator(A,bool)  authority: owner appoints
                     ─ SubmitCap(caller=C, m, cap)              policy:    CURATOR's envelope
                     ─ ReallocateSupply(caller=A, m, assets)    action:    ALLOCATOR executes
        │ transaction + receipt logs
        ▼
[ ATTESTCOIN ]
  Attestor set ──── block attestations on Creditcoin
  Proof Builder ─── Merkle inclusion proof + block continuity proof     (hosted; liveness only)
        │ txBytes + proofs
        ▼
[ CREDITCOIN CC3 ]
  BlockProver precompile 0x…0FD2   verify()  →  inclusion + continuity          (trustless)
  EvmV1Decoder (self-deployed)     receipt / logs / topics                      (pure)
  CuratorLedger.sol                app checks → decode → append record          ← we build
  MandateGate.sol                  reads ledger, allows/blocks an allocation    ← we build
        │
        ▼
[ FRONTEND ]  curator profile · proven actions · explorer links · verify-it-yourself
```

| Component | Trusted? | Decentralised? | In | Out |
|---|---|---|---|---|
| Morpho contracts | yes (emit faithfully) | yes | curator calls | events |
| Proof Builder | **liveness only** | no (hosted) | tx hash | proofs |
| BlockProver precompile | no — verifies | yes (validators) | proof | bool |
| EvmV1Decoder | no — pure | n/a | txBytes | receipt/logs |
| CuratorLedger | no — enforces rules | yes | proof | record |
| Frontend | yes (display) | no | ledger | UI |

---

## 2. End-to-end scenario

**Actors.** *Dana*, evaluating vaults · *Vault V* = `0xBEEF0173…64CB` (steakUSDC, MetaMorpho V1
v1.1, $75.2M) · *Curator* = `0x827e8607…eCdB` · *Allocator A* = `0x9e9110cf…f9e1`
(**verified by `isAllocator()` = true**) · *Owner* = `0x0A0e559b…f8DD` · *CuratorLedger* on
Creditcoin · *MandateGate*, Dana's policy contract.

> Factual statements about C are neutral reports of public on-chain data. The "market later
> impaired" branch in STEP 8 uses a **clearly-labelled mock market** — we do not assert that any
> real firm acted imprudently.

| Step | Actor | Chain | Contract | Data | Trust assumption |
|---|---|---|---|---|---|
| **0** | — | — | — | Ledger knows the MetaMorpho factory address and the event signatures | Allowlist set at deploy |
| **1** | Allocator A | Ethereum | Vault V | A rebalances depositor funds **within the curator's caps** | Morpho emits faithfully |
| **2** | Ethereum | Ethereum | V | tx `0x35a2f50f…e8f0` @ block 25,772,893, 3 × `ReallocateSupply` | — |
| **3** | Anyone (worker, Dana, a rival) | off-chain | Proof Builder | requests proof by tx hash | **permissionless** — proof self-validates |
| **4** | Proof Builder | — | — | Merkle inclusion + continuity proof (~1.2 s; block must be attested, ~8–9 min) | liveness only |
| **5** | CuratorLedger | Creditcoin | `0x…0FD2` | `verify(chainKey, height, txBytes, merkle, continuity)` → bool | trustless |
| **6** | CuratorLedger | Creditcoin | EvmV1Decoder | `receiptStatus == 1`; emitter ∈ known vaults; `topics[0] == ReallocateSupply`; read `caller`, `market`, `assets` | pure |
| **7** | CuratorLedger | Creditcoin | CuratorLedger | append `Record{actor A, role=ALLOCATOR (only if an appointment proof exists), vault V, market m, assets, srcBlock, srcTx, queryId}`; mark `queryId` used | replay-protected |
| **8** | Dana | Creditcoin | MandateGate | policy: "block vaults whose curator has a proven allocation to any market on my impaired list" → **allocation blocked** | Dana chooses the list |
| **9** | Attacker | Creditcoin | CuratorLedger | submits a spoofed vault's event / another curator's event / a replay | see §5 |
| **10** | CuratorLedger | Creditcoin | — | reverts: bad proof, `receiptStatus != 1`, emitter not allowlisted, wrong `topics[0]`, `queryId` seen | fail-closed |

**Why Dana benefits:** her mandate is enforced by a contract reading a record no evaluated party
can revise, instead of by an analyst reading a dashboard someone else maintains.

---

## 3. Creditcoin state design

```solidity
struct Record {
    address actor;          // from log.topics[1] — WHO acted (role NOT assumed)
    uint8   role;           // UNKNOWN | OWNER | CURATOR | ALLOCATOR — set only by an appointment proof
    address vault;          // log.address_ — must be allowlisted
    bytes32 market;         // log.topics[2]
    uint256 assets;         // log.data
    uint8   action;         // SetCap | ReallocateSupply | SetCurator
    uint64  srcChainKey;    // 1 = Sepolia, 3 = Ethereum mainnet
    uint64  srcBlock;
    bytes32 srcTxHash;
    uint64  recordedAt;
}

mapping(bytes32 => bool)      processedQueries;  // keccak(chainKey, blockHeight, txIndex)
mapping(address => uint256[]) recordsByCurator;  // curator profile
mapping(address => bool)      knownVaults;       // emitter allowlist
mapping(uint8 => bytes32)     eventSigOf;        // action → topics[0], versionable
```

Rationale:
- **`processedQueries`** — replay protection, keyed by *position* not payload (official `USCBase`
  pattern). A tx containing 3 logs is one query; all 3 records are written in that call.
- **`knownVaults`** — without it anyone deploys a look-alike contract, emits
  `ReallocateSupply` with an arbitrary curator address, and proves it. This is the single most
  important check.
- **`eventSigOf`** — Morpho can ship new vault versions with new signatures; versioning avoids a
  hard fork of the ledger.
- **`srcBlock`** — lets consumers apply their own recency policy; old events stay provable
  forever, which is a feature for a track record and a risk for freshness-sensitive use.
- **Append-only** — no update or delete path, by design.

---

## 4. MVP scope

### MUST HAVE
| # | Feature | Difficulty | Dependency |
|---|---|---|---|
| 1 | `EvmV1Decoder` deployed + linked on CC3 | Low | `@gluwa/usc-contracts` (pre-deployed one is stale) |
| 2 | `CuratorLedger.sol`: verify → app checks → decode → append | **Medium** | precompile, decoder |
| 2b | **Authority→Action composition** (THE core feature): ingest `SetIsAllocator`/`SetCurator`, set `role` only from a proof, require grant-block < action-block | **Medium** | 2 — **VERIFIED on real mainnet data, `scripts/06`** |
| 3 | Replay protection via `queryId` | Low | `USCBase` pattern |
| 4 | Vault allowlist + event-signature check + `receiptStatus == 1` | Low | — |
| 5 | Off-chain submitter script (tx hash → proof → submit) | Low | `proofClient.js` ✅ exists |
| 6 | Ingest a **real mainnet** curator action | Low | ✅ already proven read-only |
| 7 | Curator profile read path (`recordsByCurator`) | Low | — |
| 8 | Minimal frontend: curator profile + source-tx links | Medium | — |
| 9 | Negative demo: tampered proof rejected | Low | ✅ already proven |
| 10 | Negative demo: duplicate/replay rejected | Low | #3 |
| 11 | Negative demo: spoofed vault rejected | Low | #4 |

### NICE TO HAVE
| Feature | Difficulty |
|---|---|
| `MandateGate.sol` policy consumer (allow/block an allocation) | Medium |
| `CreateMetaMorpho` factory-provenance proof (3rd leg) | **High** |
| Sepolia mock vault for a fast, deterministic live demo | Low |
| Multi-source-chain (Sepolia + mainnet) in one ledger | Low |

### OUT OF SCOPE
Curator scoring/rating · completeness guarantees · Euler/other protocol adapters · writability ·
identity linking of curator addresses to firms · liquidation/bad-debt attribution · gas
optimisation of 20 KB `txBytes`.

---

## 5. Adversarial review

| Attack / limitation | Status | Handling |
|---|---|---|
| Submitter posts only favourable events | **MITIGATED** | Submission is permissionless, so rivals/victims can post adverse ones. Does **not** yield completeness. |
| Omitted bad events | **UNSOLVED — structural** | Absence is unprovable. Product must always read "proven actions," never "full history." *MVP limitation, not fatal — the thesis is verified attribution, not completeness.* |
| Duplicate / replay | **SOLVED** | `queryId = keccak(chainKey, blockHeight, txIndex)`, `txIndex` recomputed on-chain by the precompile. |
| Spoofed source contract | **SOLVED** | Emitter must be in `knownVaults`; the official Maple example documents this exact attack. |
| Wrong curator attributed | **SOLVED** | `curator` is read from an indexed topic of an allowlisted contract, not supplied by the submitter. |
| Failed transaction proven | **SOLVED** | `receiptStatus == 1` enforced (precompile does not check this). |
| Old / stale event replayed as new | **MITIGATED** | `srcBlock` stored; consumers apply their own recency window. |
| Curator rotates to a fresh address | **UNSOLVED** | Same class as wallet whitewashing. Mitigated only because curators are *brands* selling to institutions; a new address means starting with no record. Declared. |
| Valid proof, misleading economics | **UNSOLVED — accepted** | A single reallocation out of context can look bad. Ledger stores facts; interpretation stays with the reader. Never present a record as a verdict. |
| Source protocol upgrade / new event signature | **MITIGATED** | `eventSigOf` versioning; new vault versions need an allowlist update (an admin dependency — declared). |
| Latency window (8–9 min) | **ACCEPTED** | Non-issue for reputation; fatal for anything real-time — so we claim neither. |
| Proof Builder outage | **MITIGATED** | Liveness dependency only; `RawProofBuilder` offline path exists (untested by us). |
| Indexer dependency for *discovery* | **UNSOLVED — honest** | Finding which txs to submit still needs log scanning. Verification is trustless; **discovery is not**. |
| Malicious frontend | **MITIGATED** | Every record carries `srcTxHash`; anyone can re-verify independently. |

**Fatal-flaw check:** none of the UNSOLVED items contradicts the thesis, because the thesis is
*verified attribution of actions that were taken*, not *a complete or evaluative record*. They do
bound the claim, and every one is stated in the product thesis §6.

---

## 6. Demo (2 min 40 s)

Attestation latency rules out waiting for a live source transaction, so the source tx is
pre-staged and everything after it runs live.

| Time | Screen | Point |
|---|---|---|
| 0:00–0:25 | Stream Finance headline: ~$285M across Morpho/Euler; named curator exposures | Someone chose to put depositor money there |
| 0:25–0:45 | Etherscan: a **real** `ReallocateSupply` — vault, **caller**, market | The decision is already on-chain, attributed |
| 0:45–1:05 | Dashboard vs proof, side by side | A dashboard is a claim by its operator |
| 1:05–1:45 | **Live:** submit tx hash → proof → `verify()` → `VERIFY ✅ TRUE` → decode → record appended on Creditcoin explorer | The chain checked it, not us |
| 1:45–2:05 | Curator profile page built purely from proven records | A track record nobody can revise |
| 2:05–2:25 | **Live negatives:** tampered proof → revert · replay → revert · spoofed vault → revert | It fails closed |
| 2:25–2:40 | `MandateGate` blocks an allocation; one honest line: *"proven actions, not a complete history"* | A contract can act on it — and we state the limit |

**The demo's job:** make the difference between *reading an API* and *verifying a proof* visible —
the tampered-proof revert at 2:05 is the moment that lands.

---

## 7. Implementation plan

| # | Task | Purpose | Output | Difficulty | Blocker |
|---|---|---|---|---|---|
| 1 | Toolchain: solc via npm or Foundry | compile contracts | build works | Low | **user decision + install** |
| 2 | Testnet keypair + CC3/Sepolia faucet | deploy & write | funded address | Low | **⚠️ requires user approval** |
| 3 | Deploy `EvmV1Decoder` on CC3 | current decoder ABI | address | Low | 1, 2 |
| 4 | `CuratorLedger.sol` + tests | core | contract | **Medium** | 3 |
| 5 | Deploy + allowlist steakUSDC | ingest real data | address | Low | 4 |
| 6 | Submitter script (reuse `proofClient.js`) | tx hash → record | CLI | Low | ✅ exists |
| 7 | Ingest the real mainnet action end-to-end | first vertical slice | record on CC3 | Low | 5, 6 |
| 8 | Negative tests (tamper / replay / spoof) | fail-closed proof | 3 reverts | Low | 7 |
| 9 | Frontend curator profile | demo | page | Medium | 7 |
| 10 | `MandateGate.sol` | consumer story | contract | Medium | 7 |
| 11 | Provenance chaining (`SetCurator` + factory) | Attestcoin depth | multi-proof | **High** | 7 |
| 12 | README, deck, demo video | submission | package | Medium | all |

**Reusable today:** `src/config.js`, `src/proofClient.js`, scripts 01–05, the decoder ABI, the
replay-protection pattern, and the negative control. **Tasks 1–3 are the first blocking step and
require your approval** (keypair + faucet).

---

## 8. Portfolio value

Demonstrated by artefacts already in the repo, not by assertion: problem discovery from primary
sources; **four documented kill decisions** including two of the author's own favourites;
competitor liveness verification (Spectral pivot, ARCx/Goldfinch/Relic dead); protocol due
diligence by reading contracts rather than docs; trust-model design with an explicit
trusted/untrusted split; cross-chain verification implemented and measured; MVP scoping; and
adversarial self-review with unsolved items published rather than hidden.
