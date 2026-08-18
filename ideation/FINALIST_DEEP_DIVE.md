# Finalist Deep Dive — P-A / P-B(P1′) / P-D / P-E

> 2026-08-17. Each finalist carries its own strongest counterargument, written to kill it.
> **FACT** = cited · **INFERENCE** = reasoning · **DECISION** = call.

---

## P-A — Curator Accountability

### [A] Real users
Vault depositors and institutional allocators. **FACT:** Morpho ~$5.8B TVL early 2026; curated
vaults peaked ~$7.2B (Dec 2025); ~200 active vaults; Steakhouse's USDC vault alone >$400M.
Retail is exposed indirectly — **Coinbase routes US customers' USDC into a Steakhouse-curated
Morpho vault** (Sept 2025). Apollo Global ($940B AUM) is acquiring up to 9% of MORPHO supply.

### [B] Workflow
Depositor picks a vault → **owner** appoints curator and allocators → **curator** sets caps on
Morpho Blue markets (the risk envelope) → **allocator** reallocates funds within that envelope →
depositor bears the outcome with no backstop.

### [C] Current solution
Host-protocol UI; off-chain graders (**CuratorWatch**, grading 377 vaults on a 10-point check;
**DIA Vaults Map**, 3,700+ vaults/80+ chains); curators' own published risk reports; Dune.

### [D] Concrete weakness
**FACT (independent, academic).** arXiv 2512.11976 analysed on-chain data 1 Oct 2024 – 19 Nov
2025 across six lending systems and eight curators and concludes: *"Users cannot effectively
evaluate curator strategies on a comparable basis because standardized disclosures are absent."*
It also finds concentration (Gauntlet 27.6% of curated TVL ≈ $2B; Steakhouse 17.8%), clustered
tail co-movement (pairwise drawdown correlations 0.72–0.80), and fee opacity uncorrelated with
risk (R7 16% vs Yearn <3%).
**FACT (incident).** Stream Finance: ~$285M exposure; post-mortems cite the absence of on-chain
verification; the same curator brands continue operating.

### [E] Required fact — verified on-chain by us

> ⚠️ **Corrected.** `SetCap` is *not* a curator decision (`acceptCap` is permissionless after the
> timelock) and `ReallocateSupply.caller` is the **allocator**, not the curator. Corrected chain below.
From `morpho-org/metamorpho` `EventsLib.sol`, a self-contained provenance chain:
```
MetaMorphoFactory.CreateMetaMorpho(vault …)      vault V is genuine
V.SetCurator(address indexed C)                  C controls V
V.SetIsAllocator(address indexed a, bool)        owner authorises allocator a
V.SubmitCap(address indexed caller, Id m, cap)   CURATOR sets the risk envelope
V.ReallocateSupply(address indexed caller, Id m) ALLOCATOR executes within it
```
The **actor is an indexed topic** in each — decision, not inference.

### [F] Why Attestcoin
A Creditcoin contract can verify each act from Morpho's own events, with no indexer, grader or API
in the trust path — and, crucially, correct attribution requires **composing** an appointment proof
with an action proof, since a reallocation caller may be an allocator, the curator, or the owner. Remove Attestcoin and the registry must trust whoever
feeds it — which is precisely the failure mode being addressed.

### [G] Why Creditcoin — *the weakest link, stated honestly*
**Defensible:** the registry evaluates Morpho, Euler and the curators themselves, so it should not
live under the governance of any evaluated party, and it must span ecosystems rather than being
parochial to one. Creditcoin is a neutral chain whose stated identity is credit record-keeping,
and Attestcoin is its native verification path — "an independent, programmable response layer
separated from the source chain," which is on the user's own list of acceptable answers.
**INFERENCE (not a technical necessity).** A neutral Ethereum contract fed by **Axiom** or
**Herodotus** (both alive and actively developed — Axiom pushing daily as of 2026-08-16) could do
the same job on Ethereum. The case for Creditcoin is architectural neutrality plus cost, not
capability. This must be argued, not asserted.

### [H] Latency
Fine. Curator reputation is not a trading signal.

### [I] Competition
| | CuratorWatch / DIA / Dune | This |
|---|---|---|
| Data source | indexer | Ethereum event + inclusion proof |
| Trust | operator honest & online | proof self-validating |
| Contract-consumable | no | yes |
| Permanence | until the site pivots (cf. Spectral) | on-chain |
| Coverage | far broader | narrow (only provable events) |
| Completeness | best-effort, curated | provably incomplete by construction |

### [J] Failure scenarios
Selective submission; wallet rotation by curators; a valid proof that is economically misleading
(a prudent reallocation looking bad in isolation). Handled in `FINAL_MVP_AND_DEMO.md` §5.

### [K][L] MVP & demo
**Proven feasible.** `spike/scripts/05-prove-curator-action.js` takes a real mainnet
`ReallocateSupply` (tx `0x35a2f50f…e8f0`, block 25,772,893, vault steakUSDC), proves it, gets
`VERIFY ✅ TRUE`, and decodes it **on Creditcoin** — extracting vault, caller `0x9e9110cf…f9e1`
(verified by `isAllocator()` to be an **allocator**, not the curator), and market id. 344 such
events in ~7 days on that vault alone. A second real tx (`0x0c540598…eb181`) proving
**`SetIsAllocator`** (one allocator appointed, one revoked, 4 vaults) also verifies ✅ TRUE.

### 🔪 Strongest counterargument
> *"CuratorWatch and DIA already track curators, and journalists named the Stream Finance
> curators within days. Information availability was never the binding constraint — depositors
> chased yield anyway. And no allocator has asked for contract-enforced curator policy."*

**Response.** Partly conceded. For *human* dashboards, an indexer is the better product and we
should not pretend otherwise. The unmet need is narrower and real: a record that a **contract**
can act on without an oracle, that an adversary can add to, and that no evaluated party can
revise. The independent academic finding that comparable evaluation is *absent* as of Nov-2025
data contradicts the claim that the information problem is solved. **Not fatal, but it caps the
claim: this is verification infrastructure, not a better analytics product.**

**Verdict: GO. Confidence: Medium-High.**

---

## P-B / P1′ — On-chain private-credit borrower performance

### Findings
**FACT.** Maple emits genuine credit events (`Impaired`, `LoanImpaired`, `Repossessed`,
`PaymentMade`, `BorrowerAccepted`) — verified by reading `maple-labs/open-term-loan` and
`fixed-term-loan`. Unlike Aave liquidations, impairment is a real distress signal.
**FACT.** Maple ~$2.1B TVL, ~$1.97B active loans (May 2026); real historical losses (~$36M
Orthogonal + Auros).

### 🔪 Strongest counterargument — **fatal**
> *"Who consumes it? Maple's borrowers are fully KYC'd by pool delegates (Maple Direct, Room40,
> AQRU) who perform multi-step underwriting **and post first-loss capital**. The party that would
> use a borrower's history already has it, is contractually accountable, and has money at risk."*

**FACT.** Maple's delegate model: delegates KYC borrowers, set rates and tenor, and **post a
first-loss tranche to share losses with lenders**. **FACT.** No evidence found of any protocol or
lender reusing Maple borrower performance data.
**INFERENCE.** The borrower universe is a few dozen institutions; headline defaults become public
news; and the accountable underwriter already holds the information. A portable registry solves a
problem nobody has. This is the same "no consumer" failure that killed P1.

**Verdict: KILL. Confidence: High.**

---

## P-D — Restaking operator reputation

**FACT.** On-chain slashing became enforceable on EigenLayer in early 2026; **33 slashing events
in Q1 2026**; 190+ AVSs. Symbiotic is a separate ecosystem. Our search found **no cross-protocol
slashing registry**, so the gap is genuine.

### 🔪 Strongest counterargument — decisive
> *"33 events in a quarter is not a data set, and the operators that matter are a handful of
> named institutional brands (Coinbase Cloud, Figment, P2P.org) whose reputations are already
> public and heavily scrutinised. Delegators already use dashboards showing slashing records."*

**FACT.** Slashing records are described as *"generally on a permanent public record"* and
delegators *"use performance dashboards, commission history, and slashing records."*
**INFERENCE.** Tiny event volume, already-transparent actors, and no financial decision that
changes. Also weak portfolio relevance for a digital-asset/RWA career target.

**Verdict: KILL. Confidence: High.**

---

## P-E — DAO grant milestone accountability

**FACT.** Milestone-based payouts with clawback are the recommended pattern; programmable
release via Superfluid/Sablier gated on oracle-verified events already exists.

### 🔪 Strongest counterargument — decisive
> *"The hard part is verifying the deliverable, which is off-chain. The on-chain payout is the
> easy, uncontested part."*

**INFERENCE.** Attestcoin can prove a payout occurred — a fact nobody disputes — and cannot prove
the work was done. Same structural error as P3. Economic stakes are also small relative to the
other finalists.

**Verdict: KILL. Confidence: High.**

---

## Scoring

Scores assigned after research, then weighted.

| # | Criterion | Wt | P-A | P-B | P-D | P-E |
|---|---|--:|--:|--:|--:|--:|
| 1 | Problem reality | 15% | 9 | 6 | 4 | 4 |
| 2 | User clarity | 10% | 8 | 5 | 5 | 5 |
| 3 | Economic / operational importance | 10% | 9 | 7 | 3 | 3 |
| 4 | Existing-solution gap | 15% | 6 | 3 | 3 | 3 |
| 5 | Attestcoin necessity | 15% | 8 | 7 | 7 | 4 |
| 6 | Creditcoin architectural fit | 10% | 6 | 5 | 4 | 4 |
| 7 | Technical feasibility now | 10% | 10 | 8 | 6 | 7 |
| 8 | Demo clarity | 5% | 9 | 6 | 5 | 6 |
| 9 | Novelty | 5% | 8 | 5 | 6 | 3 |
| 10 | Portfolio / financial relevance | 5% | 8 | 8 | 3 | 3 |
| | **Weighted total** | | **7.90** | **5.85** | **4.55** | **4.10** |

| | Verdict | Confidence |
|---|---|---|
| **P-A Curator Accountability** | **GO** | Medium-High |
| P-B / P1′ Private-credit borrower | KILL | High |
| P-D Restaking operator | KILL | High |
| P-E DAO grant milestones | KILL | High |

**P-A leads on the two heaviest "is this real" criteria (1 and 4) — the exact criteria on which
every round-1 candidate failed.**

---

## GO gate — the seven sentences (§16)

1. **Vault depositors and allocators** currently bear curator *and allocator* decisions they cannot
   evaluate on a comparable basis — a gap that cost ~$285M in the Stream Finance contagion.
2. Today they rely on **host-protocol UIs and off-chain graders (CuratorWatch, DIA, Dune)**, which
   must be trusted to be honest, complete and online, and **cannot be read by a smart contract**.
3. On Ethereum, `SetCurator`/`SetIsAllocator` (owner), `SubmitCap` (curator) and
   `ReallocateSupply` (allocator) record each act with the actor in an indexed topic.
4. Attestcoin verifies those transactions by **Merkle inclusion + block-continuity proof**, and we
   additionally enforce `receiptStatus == 1`, emitter allowlist and event-signature checks.
5. Creditcoin records an **append-only, role-separated authority-and-action log** and exposes a
   queryable policy view that another contract can gate on.
6. Remove Attestcoin and the registry must trust **whoever feeds it the data** — an indexer,
   an API, or the evaluated protocol itself.
7. A depositor or allocator gains a curator track record that **no evaluated party can revise,
   that an adversary can add to, and that a contract can enforce policy against.**

Sentence 6 is strong; sentence 5's "must be Creditcoin" is the weakest and is argued, not proven.
