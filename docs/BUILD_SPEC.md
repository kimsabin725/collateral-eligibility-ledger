# BUILD SPEC — frozen implementation baseline

> Frozen 2026-08-17. **Purpose: stop scope and claims from drifting during implementation.**
> No new research went into this document; every fact is carried from
> `ideation/CORRECTION_ROLE_ATTRIBUTION.md`, `ideation/FINAL_*`, `ideation/FINALIST_DEEP_DIVE.md`,
> `spike/BASELINE.md`, `spike/FINDINGS.md` and the six scripts in `spike/scripts/`.
>
> Labels used throughout: **[VERIFIED]** = we executed it and saw the result ·
> **[FACT]** = from a cited external source · **[INFERENCE]** = our reasoning, not established ·
> **[UNVERIFIED]** = not yet checked.
>
> Submission deadline: **2026-09-06 13:59 KST** (platform countdown `2026-09-06T04:59:00Z`).

---

## 1. Working title — NOT YET DECIDED

`CuratorLedger` is **retired as a name**: it is now inaccurate. The design is role-separated and
the most abundant, best-verified data is **allocator** activity, not curator activity. Naming it
"Curator…" would re-introduce the exact confusion this project already made once.

Three candidates, to be chosen at first commit:

| Candidate | Why | Against |
|---|---|---|
| **VaultAuthorityLedger** | Most literally accurate: records authority grants and the actions taken under them | Dry; long |
| **ProvenMandate** | Names the actual product idea — a mandate whose authority chain is proven, not asserted | Slightly abstract |
| **AttestedVaultRecord** | Signals both Attestcoin and the append-only record | Generic |

Until chosen, code and docs use the neutral placeholder **`VAULT_LEDGER`**.

## 2. One-sentence product definition

> An append-only record on Creditcoin of **who was granted authority over a DeFi lending vault and
> what they subsequently did with depositor funds** — where each entry is admitted only on a
> cryptographic Attestcoin proof of the underlying Ethereum transaction, and a role is attributed
> only when a matching authority-grant proof exists.

## 3. The problem being solved

**[FACT]** DeFi lending moved to a two-layer model: ERC-4626 vaults plus third-party role-holders.
Independent academic analysis (arXiv 2512.11976; on-chain data 1 Oct 2024 – 19 Nov 2025, six
lending systems, eight curators) concludes: *"Users cannot effectively evaluate curator strategies
on a comparable basis because standardized disclosures are absent."* It also reports concentration
(Gauntlet ≈27.6% of curated TVL ≈ $2B; Steakhouse 17.8%) and fee opacity uncorrelated with risk.

**[FACT]** The cost of that gap — Stream Finance, 4 Nov 2025: $93M hole, xUSD −77%, **~$285M debt
exposure** across Morpho and Euler, ~$1B net DeFi outflows. Named exposures: TelosC $123.64M,
Elixir $68M, MEV Capital $25.42M, Varlamore and Re7 Labs. Post-mortems cite the absence of fund
segregation, multisig controls and **on-chain verification**. The same brands still operate.

**The specific unmet need:** the record of *who held which authority when, and what they did with
it*, in a form (a) no evaluated party can revise, (b) an adversary can add to, and (c) a smart
contract can read without an oracle.

## 4. Users — real vs hypothetical

**Real today [FACT]**
- Vault depositors. Morpho ≈$5.8B TVL early 2026, ~200 active vaults; curated vaults peaked
  ≈$7.2B (Dec 2025); steakUSDC alone holds **75,212,830.24 USDC** [VERIFIED via `totalAssets()`].
- Retail, indirectly: Coinbase routes US customers' USDC into a Steakhouse-curated Morpho vault
  (Sept 2025).
- Institutional allocators: Apollo Global ($940B AUM) acquiring up to 9% of MORPHO supply.

**Hypothetical [INFERENCE] — must be labelled as such in every pitch**
- Anyone who wants this record **enforced by a contract** (the `MandateGate` consumer). No
  allocator has been observed asking for contract-enforced role/action policy. This is the
  softest link in the thesis and is not evidenced.
- Any user on Creditcoin specifically. Creditcoin mainnet ran **190 transactions on 2026-08-17**
  at 0.022% utilisation; the criterion requiring existing Creditcoin users was explicitly relaxed
  by the user, and low adoption is recorded as production-adoption risk, not disqualification.

## 5. Existing approach

**[FACT]** Host-protocol UIs; off-chain graders — **CuratorWatch** (377 vaults, 10-requirement
grade) and **DIA Vaults Map** (3,700+ vaults, 80+ chains); curators' self-published risk reports;
Dune/subgraphs.

**[VERIFIED]** These are better products than ours for human analysis, and we concede it. Their
limits: the operator must be honest and online, the record can be revised or disappear (Spectral
raised ~$30M for on-chain credit scoring and pivoted to AI agents; `spectral.finance` → HTTP 404;
ARCx offline), and **none is readable by a smart contract**.

## 6. The exact trust assumption we remove

**Removed:** that an indexer, subgraph, grader, API, or the evaluated protocol's own UI is telling
the truth about *whether a given Ethereum transaction happened and what it contained*. Submission
also becomes permissionless, because the proof — not the submitter — is what is trusted.

**Explicitly NOT removed:**
- Attestcoin's attestor set and Creditcoin's validators.
- Gluwa's hosted Proof Builder, for **liveness only** (a bad proof fails verification).
- Morpho's contracts emitting events faithfully.
- **Discovery.** Finding *which* transactions to submit still requires log scanning. The 497-day-old
  authority grant in §9 was located via Blockscout's full-history log API, because public RPCs
  prune state (`state at block #21387476 is pruned`) and cap `getLogs` ranges. **Verification is
  trustless; discovery is not.**
- Any judgement about whether an action was prudent.

## 7. Role of each layer

| Layer | Responsibility | Trusted? |
|---|---|---|
| **Ethereum** (mainnet, chainKey **3**; Sepolia = chainKey **1**) | Ground truth. Emits the authority and action events. **Source events come from ~200 third-party MetaMorpho vaults we did not deploy.** [VERIFIED] This is permitted — no official page makes deploying your own source contract a requirement — but it deviates from the documented best practice *"An ASC-enabled dApp should have a single source chain contract"*. That is why `knownVaults` (§11) and the discovery caveat (§6) exist. See `ENVIRONMENT_AUDIT.md` §E. | Emits faithfully |
| **Attestcoin** | Merkle transaction-inclusion proof + block-continuity proof; exposes raw tx bytes. Verified by the BlockProver precompile `0x…0FD2`. Does **not** check tx success. | No — it verifies |
| **Creditcoin (CC3, chainId 102031)** | Application checks → decode via own `EvmV1Decoder` → append record → expose queryable role/action view. | No — it enforces |
| **Frontend** | Display, source-tx links, "verify it yourself". | Yes (display only) |

## 8. Role model — do not re-confuse these

**[VERIFIED from `morpho-org/metamorpho` `MetaMorpho.sol`]**

```solidity
onlyCuratorRole()   : sender == curator || sender == owner
onlyAllocatorRole() : isAllocator[sender] || sender == curator || sender == owner
afterTimelock(v)    : time check ONLY — no role check
```

| Function | Access | Event | What the event actually identifies |
|---|---|---|---|
| `setCurator` | **onlyOwner** | `SetCurator(newCurator)` | Owner appoints the curator |
| `setIsAllocator` | **onlyOwner** | `SetIsAllocator(allocator, bool)` | Owner grants/revokes allocator authority |
| `submitCap` | **onlyCuratorRole** | `SubmitCap(caller, id, cap)` | **The curator's risk decision** |
| `submitMarketRemoval` | onlyCuratorRole | `SubmitMarketRemoval(caller, id)` | Curator's risk decision |
| `acceptCap` | **permissionless after timelock** | `SetCap(caller, id, cap)` | **Anyone.** NOT a curator decision |
| `reallocate` | **onlyAllocatorRole** | `ReallocateSupply(caller, id, …)` | **Allocator** — *or* curator *or* owner |
| `setSupplyQueue` | onlyAllocatorRole | `SetSupplyQueue(caller, …)` | Allocator (or curator/owner) |

**Correct model:** the **owner** decides who holds authority · the **curator** defines the risk
envelope (eligible markets and caps) · the **allocator** moves funds **within** that envelope.

### The verified authority→action chain

Because `onlyAllocatorRole` admits three roles, a single action proof establishes only that *some
address* moved funds. Correct attribution requires **composing two proofs**:

```
proof #1  [owner]  SetIsAllocator(X, true)   on vault V   @ block A
proof #2  [X]      ReallocateSupply(X, m, …) on vault V   @ block B,  B > A
          ⇒ "X, granted allocator authority on V at A, moved V's funds into m at B"
```

**This composition is the reason the product needs Attestcoin rather than an event lookup, and it
is the MVP's core feature.**

## 9. Transactions already verified on real Ethereum mainnet

All read-only, no wallet, no gas. Reproducible: `spike/scripts/04`, `05`, `06`.

**Vault under test [VERIFIED]:** steakUSDC `0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB` —
MetaMorpho **Vault V1 (v1.1 line)**, confirmed by bytecode selector inspection (19,340 bytes;
`acceptCap(MarketParams)`/`isAllocator`/`multicall` present, all V2 markers `adapters()`,
`allocate(address,bytes,uint256,bytes4)`, `curators(address)`, `absoluteCap`, `relativeCap` absent).
`owner` `0x0A0e559b…f8DD` · `curator` `0x827e8607…eCdB` · `guardian` `0xaa050019…c03d` ·
timelock 604,800 s.

| # | What | tx | Block | Result |
|---|---|---|---|---|
| 1 | **AUTHORITY** `SetIsAllocator(0x9e9110cf…f9e1, true)` on steakUSDC | `0x52ced076…06fd` | 22,194,870 | **verify() ✅ TRUE**, receiptStatus 1, same actor extracted on CC3 |
| 2 | **ACTION** `ReallocateSupply(caller=0x9e9110cf…f9e1, …)` ×3 markets, steakUSDC | `0x35a2f50f…e8f0` | 25,772,893 | **verify() ✅ TRUE**, receiptStatus 1, same actor ×3 on CC3 |
| 3 | Allocator **rotation**: 8 × `SetIsAllocator` — `0xb9e9131…49de` enabled, `0xaa852a6…bbbd` revoked, 4 vaults | `0x0c540598…eb181` | 25,773,900 | **verify() ✅ TRUE**, booleans decoded on CC3 |
| 4 | Control from a different protocol: Aave V3 `Repay` | `0x9b0d0a9c…a75f0` | 25,772,707 | **verify() ✅ TRUE** |

**Ordering [VERIFIED]:** 22,194,870 < 25,772,893 — grant precedes action by 3,578,023 blocks
(~497 days). §8's chain is therefore verified on real data with a single actor and a single vault.

**Volume [VERIFIED]:** 344 `ReallocateSupply` events in ~50k blocks (~7 days) on steakUSDC alone.
**Latency [VERIFIED]:** attestation lag ≈8–9 min on both Ethereum mainnet and Sepolia.
**Size note [VERIFIED]:** the action tx decoded to 20,000 bytes of `txBytes` — relevant to gas.

**[UNVERIFIED]** No `SubmitCap` / `SetCap` / `SetCurator` sample has been obtained. The
curator-policy leg of the model is therefore **unproven in practice**. Blockscout's full-history
API now looks like a viable route but has not been tried for these.

## 10. MVP end-to-end flow

```
STEP 1  Ethereum mainnet already contains  SetIsAllocator(X,true)@A  and  ReallocateSupply(X,m)@B
STEP 2  Submitter (anyone) fetches a proof per tx from the Proof Builder      ~1–2 s each
ASC entry-point signature — use the DOCUMENTED flattened form, not the struct-tuple form our
read-only scripts pass to `verify()`:

```solidity
function submitAuthority(   // and submitAction(), same shape
    uint64 chainKey, uint64 blockHeight, bytes calldata encodedTransaction,
    bytes32 merkleRoot, INativeQueryVerifier.MerkleProofEntry[] calldata siblings,
    bytes32 lowerEndpointDigest, bytes32[] calldata continuityRoots
) external returns (bool success);
```

STEP 3  VAULT_LEDGER.submitAuthority(proof#1)
          → precompile verify()                        must be true
          → receiptStatus == 1                         precompile does NOT check this
          → emitter ∈ knownVaults                      else a look-alike contract can lie
          → topics[0] == SetIsAllocator                else wrong event
          → queryId unused                             replay protection
          → write RoleGrant{vault, actor X, granted=true, srcBlock A}
STEP 4  VAULT_LEDGER.submitAction(proof#2)
          → same five checks, topics[0] == ReallocateSupply
          → look up RoleGrant(vault, X): exists AND srcBlock < B ?
                yes → Record{actor X, role=ALLOCATOR, vault, market m, assets, srcBlock B}
                no  → Record{actor X, role=UNKNOWN, …}      ← never guess a role
STEP 5  Read path: actionsOf(X), grantsOf(X) → frontend profile
STEP 6  MandateGate.check(vault) reads the ledger and allows/blocks a mock allocation
```

Every failure path reverts. Nothing is written on a failed proof.

## 11. Minimum Creditcoin state

```solidity
enum Role   { UNKNOWN, OWNER, CURATOR, ALLOCATOR }
enum Action { SET_IS_ALLOCATOR, SET_CURATOR, SUBMIT_CAP, REALLOCATE_SUPPLY }

struct RoleGrant {                    // from an authority proof only
    address vault; address actor; Role role; bool granted;
    uint64 srcChainKey; uint64 srcBlock; bytes32 srcTxHash;
}

struct ActionRecord {                 // from an action proof
    address vault; address actor;
    Role    roleAtAction;             // ALLOCATOR only if a grant with srcBlock < this exists
    bytes32 market; uint256 assets; Action action;
    uint64  srcChainKey; uint64 srcBlock; bytes32 srcTxHash;
}

mapping(bytes32 => bool)              processedQueries;   // keccak(chainKey, blockHeight, txIndex)
mapping(address => bool)              knownVaults;        // emitter allowlist — critical
mapping(bytes32 => bytes32)           eventSigOf;         // action → topics[0], versionable
mapping(address => RoleGrant[])       grantsOf;           // actor → authority history
mapping(address => uint256[])         actionsOf;          // actor → action indices
ActionRecord[]                        records;            // append-only
```

Why each exists:
- `processedQueries` — replay protection keyed by **position**, not payload (official `USCBase`
  pattern); `txIndex` is recomputed on-chain by the precompile, never supplied by the caller.
- `knownVaults` — without it, anyone deploys a look-alike contract, emits `ReallocateSupply` with
  an arbitrary actor, and proves it. **Single most important check.**
- `eventSigOf` — Morpho ships new vault versions; versioning avoids forking the ledger.
- `roleAtAction` — the field that encodes the §8 correction. Defaults to `UNKNOWN`.
- Append-only; **no update or delete path**, by design. Revocations are appended, never applied
  retroactively.

## 12. Scope

### MUST HAVE
| # | Item | Difficulty |
|---|---|---|
| 1 | Deploy own `EvmV1Decoder` on CC3 (the pre-deployed one at `0x731c…F9f` is **stale** — lacks both `getLogsByEventSignature` overloads [VERIFIED]) | Low |
| 2 | `VAULT_LEDGER.sol`: verify → 5 app checks → decode → append | Medium |
| 3 | **Authority→action composition** with `srcBlock` ordering (the core feature) | Medium |
| 4 | Replay protection via `queryId` | Low |
| 5 | Vault allowlist + event-signature check + `receiptStatus == 1` | Low |
| 6 | Submitter script (reuses `spike/src/proofClient.js`) | Low |
| 7 | Ingest the **real** mainnet pair from §9 rows 1 and 2 | Low |
| 8 | Read path: `grantsOf`, `actionsOf` | Low |
| 9 | Minimal frontend: actor profile with role + source-tx links | Medium |
| 10 | Negative: tampered proof reverts | Low |
| 11 | Negative: replay reverts | Low |
| 12 | Negative: non-allowlisted (wrong-source) vault reverts | Low |
| 13 | README + deck + 2–3 min demo video | Medium |

### NICE TO HAVE
`MandateGate.sol` policy consumer · `SubmitCap` curator-policy leg (blocked on obtaining a sample) ·
`CreateMetaMorpho` factory-provenance third leg · Sepolia mock vault for deterministic negatives ·
both chainKeys (1 and 3) in one ledger · revocation ingestion.

### OUT OF SCOPE
Scoring/rating/ranking of any actor · completeness guarantees · Euler or other protocol adapters ·
writability (unavailable) · linking addresses to real-world firms · bad-debt attribution ·
gas optimisation of 20 KB `txBytes` · anything requiring a key beyond a fresh testnet keypair.

## 13. Success case

1. Submit proof #1 (`0x52ced076…06fd`) → `RoleGrant{steakUSDC, 0x9e9110cf…f9e1, ALLOCATOR, granted, block 22,194,870}`.
2. Submit proof #2 (`0x35a2f50f…e8f0`) → 3 × `ActionRecord{… roleAtAction = ALLOCATOR …}` because a
   grant exists with `srcBlock 22,194,870 < 25,772,893`.
3. Frontend shows the actor with role **ALLOCATOR**, the grant, the three market moves, and links to
   both Etherscan txs and both Creditcoin txs.
4. Submitting proof #2 **without** #1 yields `roleAtAction = UNKNOWN` — the honest default.

## 14. Negative cases (all must revert or degrade safely)

| Case | Method | Expected |
|---|---|---|
| Tampered proof | flip one byte of `continuityProof.lowerEndpointDigest` | revert — precompile rejects. **[VERIFIED]** in `scripts/01`: `"Continuity proof does not match attestation or checkpoint"` |
| Replay / duplicate | submit the same tx twice | revert `"Query already processed"` |
| Wrong source | proof of a valid event from a non-allowlisted contract | revert — emitter not in `knownVaults` |
| Wrong event | valid proof, `topics[0]` ≠ expected | revert |
| Failed source tx | valid inclusion proof of a reverted tx | revert on `receiptStatus != 1` |
| Action without grant | proof #2 only | accepted with `role = UNKNOWN` (not a revert — an honest downgrade) |
| Grant *after* action | grant `srcBlock` > action `srcBlock` | `role = UNKNOWN` |

## 15. Never claim

- ❌ That the curator moved depositor funds. **An allocator executes; the curator sets the envelope.**
- ❌ That `SetCap` is a curator decision. `acceptCap` is permissionless.
- ❌ That the record is a complete history. **Absence is unprovable.** Always "proven actions".
- ❌ That an actor is *currently* authorised. We prove a grant at a block, never non-revocation.
- ❌ That an action was imprudent, negligent, or bad. The ledger stores facts; judgement is the
  reader's.
- ❌ That any named firm behaved wrongly. All on-chain statements are neutral reports of public data;
  adverse scenarios in the demo use a clearly-labelled **mock** market.
- ❌ A rating, score, or credit assessment.
- ❌ That discovery is trustless.
- ❌ That we deployed the source-chain contracts, or that reading third-party events is the
  officially recommended pattern. It is **permitted**, and we chose it deliberately; the docs
  recommend a single self-deployed source contract.
- ❌ Real-time anything (≈8–9 min minimum).
- ❌ "World first", "solves", "production-ready" — see the banned-phrase list in the original brief.

## 16. Remaining limitations

| # | Limitation | Status |
|---|---|---|
| 1 | Non-revocation between grant and action is unprovable (absence) | **UNSOLVED — structural.** Mitigated by permissionless revocation submission; honest state is "granted at A; no revocation proof submitted" |
| 2 | Role exclusivity: X's authority at action time could have derived from curator/owner status | **UNSOLVED.** Grant is sufficient and parsimonious, not exclusive |
| 3 | Completeness: only submitted events exist in the ledger | **UNSOLVED — structural** |
| 4 | Discovery requires an indexer (Blockscout used for the 497-day-old grant) | **UNSOLVED — declared** |
| 5 | Actor address rotation | **UNSOLVED**; mitigated only because these are brands |
| 6 | Valid proof, misleading economics (one reallocation out of context) | **ACCEPTED** — facts only, no verdicts |
| 7 | No `SubmitCap` sample → curator-policy leg unproven | **OPEN** — top demo risk |
| 8 | Creditcoin necessity is architectural, not technical (Axiom/Herodotus could serve Ethereum) | **[INFERENCE] declared** |
| 9 | Contract-enforced policy demand is unevidenced | **[INFERENCE] declared** |
| 10 | Creditcoin adoption ≈190 tx/day | Production-adoption risk, accepted by explicit user decision |
| 11 | Source-protocol upgrades change signatures | Mitigated by `eventSigOf`; allowlist updates are an admin dependency |

## 17. MVP done criteria

All of the following, or the MVP is not done:

1. `EvmV1Decoder` and `VAULT_LEDGER` deployed on CC3 testnet; addresses recorded with explorer links.
2. The **real** mainnet pair from §9 (rows 1–2) ingested, producing `roleAtAction = ALLOCATOR`.
3. §14 negatives 1–5 each demonstrated reverting, with transcripts.
4. `role = UNKNOWN` demonstrated for an action with no prior grant.
5. Read path returns the actor's grants and actions.
6. Frontend or deterministic CLI shows one actor profile end to end.
7. README reproduces every result from a clean clone.
8. Threat model + §15 + §16 published verbatim in the repo.
9. 2–3 min demo video recorded.
10. Submission fields complete before **2026-09-06 13:59 KST**.

## 18. Demo — key scenes (2:40)

| Time | Scene | The point |
|---|---|---|
| 0:00–0:25 | Stream Finance: ~$285M across Morpho/Euler, named exposures | Someone had authority over that money |
| 0:25–0:45 | Etherscan: `ReallocateSupply` — an address moved $-millions. *Who authorised them?* | A single event cannot answer that |
| 0:45–1:05 | `onlyAllocatorRole` = allocator OR curator OR owner | **Why one proof is not enough** — the intellectual core |
| 1:05–1:45 | **Live:** submit both proofs → both `verify() ✅ TRUE` → ordering check → record with `role = ALLOCATOR` on the Creditcoin explorer | The chain verified it, not us |
| 1:45–2:00 | Same action submitted **without** the grant → `role = UNKNOWN` | It refuses to guess |
| 2:00–2:25 | **Live negatives:** tampered proof → revert · replay → revert · wrong-source vault → revert | It fails closed |
| 2:25–2:40 | Actor profile; one honest line: *"proven actions, not a complete history"* | Limits stated, not hidden |

Source transactions are pre-existing mainnet history, so nothing waits on the ≈8–9 min attestation
lag. **The scene that must land is 0:45–1:05 → 1:45–2:00: one proof is ambiguous, two proofs
attribute, and absent a grant the system says UNKNOWN rather than guessing.**
