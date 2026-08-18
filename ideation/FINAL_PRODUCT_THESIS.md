# CuratorLedger — Product Thesis

> Decided 2026-08-17. Status: GO, confidence Medium-High.
> Technical constraints: [`../spike/BASELINE.md`](../spike/BASELINE.md). Writability assumed unusable.

## 1. Definition

| | |
|---|---|
| **Working name** | **CuratorLedger** |
| **One line** | A neutral, append-only, **role-separated** record on Creditcoin of who was authorised to act on a lending vault, what risk envelope the curator set, and which allocator then moved depositor funds where — every entry backed by a cryptographic proof of the underlying Ethereum transaction. |

> ⚠️ **Corrected 2026-08-17.** An earlier version of this document said "the curator moved
> depositor funds." That was **factually wrong**: `reallocate` is `onlyAllocatorRole`, and the
> proven transaction was an **allocator** action. `SetCap` was also wrongly attributed to the
> curator — `acceptCap` is permissionless. See
> [`CORRECTION_ROLE_ATTRIBUTION.md`](./CORRECTION_ROLE_ATTRIBUTION.md).
| **Target user** | Depositors and allocators in curated DeFi lending vaults (Morpho / Euler class). |
| **Job to be done** | *"Before I put money with this curator, show me what they have actually done — from a record they cannot edit and no one has to be trusted to maintain."* |

## 2. Problem

Curators choose which markets depositor money enters. Their decisions are recorded on Ethereum but
exist for evaluation only as dashboards. Independent academic analysis (arXiv 2512.11976, data to
Nov 2025, six lending systems, eight curators) concludes users **cannot evaluate curator strategies
on a comparable basis because standardised disclosures are absent**, alongside heavy concentration
(Gauntlet ≈27.6% of curated TVL, ~$2B) and fee opacity uncorrelated with risk.

The cost of that gap: Stream Finance, 4 Nov 2025 — $93M hole, xUSD −77%, **~$285M** exposure across
Morpho and Euler, ~$1B net DeFi outflows, with named curator exposures (TelosC $123.64M,
MEV Capital $25.42M, Re7 Labs). The same brands continue to operate.

## 3. Existing workflow and its weakness

| Today | Weakness |
|---|---|
| Host protocol UI | Controlled by a party with an interest in the outcome |
| CuratorWatch (377 vaults, 10-point grade), DIA Vaults Map (3,700+) | Trusted operator; can pivot or go offline (cf. Spectral, funded ~$30M, now an AI-agent company); **not readable by a contract** |
| Curators' own risk reports | Self-reported |
| Dune / subgraphs | Trusted indexer; not contract-consumable |

## 4. Our approach

Prove the curator's own Ethereum event, then record the attributed fact on a chain that no
evaluated party governs.

| Layer | Exact responsibility |
|---|---|
| **Ethereum** | Ground truth, **role-separated**: `SetCurator` / `SetIsAllocator` (owner-only — *who is authorised*), `SubmitCap` (curator-only — *the risk envelope*), `ReallocateSupply` (allocator — *execution inside that envelope*). Actor in an indexed topic. Note `SetCap` is **not** a curator decision: `acceptCap` is permissionless after the timelock. |
| **Attestcoin** | Proves the transaction was included in a canonical Ethereum block (Merkle inclusion + block continuity), and exposes the raw transaction bytes. |
| **Creditcoin** | Enforces application-level checks, decodes the event, and writes an append-only attributed record; exposes a policy view a contract can gate on. |
| **Frontend** | Curator profile: proven actions, source tx links, and a live "verify this yourself" path. |

## 5. Trust ledger — the honest part

**No longer trusted**
- Any indexer, subgraph, grader or API for the *existence and content* of a curator action
- The host protocol's own UI
- The submitter of a record — proofs are self-validating, so submission can be permissionless

**Still trusted**
- Attestcoin's attestor set and Creditcoin's validators
- Gluwa's hosted Proof Builder for *liveness* (not for correctness — a bad proof fails verification)
- Morpho's contracts to emit events faithfully
- The **interpretation** that an allocation was imprudent — that is judgment, never proof

## 6. What this product does NOT claim

- ❌ Not a complete credit history — **absence is unprovable**; the record is "proven actions,"
  never "all actions."
- ❌ Not a curator rating or risk score. It records facts, not judgments.
- ❌ Not proof that any allocation was imprudent, or that a curator is good or bad.
- ❌ Not a defence against a curator or allocator using a fresh address on a new vault.
- ❌ **Never attributes an action to a role without proving the role assignment.** A
  `ReallocateSupply` caller may be an allocator, the curator, or the owner; the record states the
  address and, where a matching appointment proof exists, the role.
- ❌ Not real-time — records land ~8–9 minutes after the Ethereum transaction.
- ❌ Not a replacement for CuratorWatch/DIA as a human analytics product; narrower and deeper.

## 7. Evidence that the core works — already measured

`spike/scripts/05-prove-curator-action.js`, run 2026-08-17:

**Proof 1 — execution leg** (`spike/scripts/05`):
```
vault           0xBEEF0173…64CB (steakUSDC, $75.2M USDC, MetaMorpho V1 v1.1)
tx              0x35a2f50f…f98e8f0  @ mainnet block 25,772,893
actor (caller)  0x9e9110cf…f9e1  — verified via isAllocator() = true → ALLOCATOR (not curator)
VERIFY          ✅ TRUE  (proof 1.2 s, txBytes 20,000)
decoded on CC3  receiptStatus 1 · 3 × ReallocateSupply · vault + caller + market id
volume          344 ReallocateSupply in ~50k blocks (~7 days) on this vault alone
```

**Proof 2 — authority leg** (real allocator rotation):
```
tx              0x0c540598…eb181  @ mainnet block 25,773,900
VERIFY          ✅ TRUE  ·  receiptStatus 1  ·  8 × SetIsAllocator decoded on CC3
content         allocator 0xb9e9131…49de ENABLED and 0xaa852a6…bbbd REVOKED across 4 vaults
```

Together these make the composition **`SetIsAllocator(X,true)` + `ReallocateSupply(caller=X)`**
provable today on real mainnet data — the basis of correct, role-separated attribution.

## 8. Key sources (read 2026-08-17)

arXiv 2512.11976 · `morpho-org/metamorpho` `EventsLib.sol` · BlockEden / PANews / Tiger Research
on Stream Finance · CuratorWatch · DIA Vaults Map · Morpho TVL reporting · Axiom & Herodotus
liveness (GitHub API).
