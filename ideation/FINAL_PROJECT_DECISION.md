# Final Project Decision — 2026-08-17

## Winner: **P-A — Vault Governance Accountability** · Working name **CuratorLedger**

> ⚠️ **Pivoted 2026-08-17** after a role-attribution challenge. `reallocate` is `onlyAllocatorRole`,
> so "the curator moved depositor funds" was factually wrong. The product is now **role-separated**:
> owner appoints · curator sets the risk envelope · allocator executes.
> See [`CORRECTION_ROLE_ATTRIBUTION.md`](./CORRECTION_ROLE_ATTRIBUTION.md).

| Candidate | Verdict | Score | Confidence |
|---|---|--:|---|
| **P-A Vault governance accountability** | **GO (pivoted)** | **7.90** | Medium-High |
| P-B / P1′ Private-credit borrower performance | KILL | 5.85 | High |
| P-D Restaking operator reputation | KILL | 4.55 | High |
| P-E DAO grant milestones | KILL | 4.10 | High |

Evidence: [`PROBLEM_SEARCH_ROUND2.md`](./PROBLEM_SEARCH_ROUND2.md) ·
[`FINALIST_DEEP_DIVE.md`](./FINALIST_DEEP_DIVE.md)

---

## Why P-A won

**WHY THIS PROBLEM.** DeFi lending re-architected into vaults plus third-party *curators* who
decide which markets depositor money enters. Those curators are now systemically large and their
decisions are unevaluable on a comparable basis — a finding from independent academic analysis of
on-chain data across six lending systems and eight curators, not from vendor marketing.

**WHY THIS USER.** Vault depositors and institutional allocators, with ~$5.8B on Morpho alone and
retail exposure via Coinbase routing US customers' USDC into a curated vault. These users bear
curator risk directly and have no backstop.

**WHY NOW.** Stream Finance (4 Nov 2025) turned the abstraction into ~$285M of exposure across
Morpho and Euler, with named curator exposures — TelosC $123.64M, MEV Capital $25.42M, Re7 Labs —
and post-mortems that explicitly cite missing on-chain verification. The same curator brands
still operate. Meanwhile institutional capital keeps arriving (Apollo, Coinbase).

**WHY ATTESTCOIN.** Each governance and execution act is already an Ethereum event with the actor in
an indexed topic — and correct attribution *requires composing several proofs* (appointment +
action), because the caller of a reallocation may be an allocator, the curator, or the owner. Attestcoin lets a contract on another chain verify that event from Morpho's own
logs — no indexer, no grader, no API in the trust path. Remove it and the registry trusts whoever
feeds it, which is the failure mode being addressed.

**WHY CREDITCOIN.** The registry judges Morpho, Euler and the curators, so it should not sit under
any evaluated party's governance, and it must span ecosystems rather than one protocol's chain.
Creditcoin is a neutral chain whose stated identity is credit record-keeping, and Attestcoin is
its native verification path — an independent, programmable response layer separated from the
source chain.

**WHY NOT API/RPC.** An RPC read is a claim by whoever answers; a proof is self-validating. More
concretely, an Ethereum smart contract cannot read another contract's historical logs, so any
event-history registry needs either a trusted feeder or a proof system. We use the proof system.

**WHY NOT ETHEREUM-ONLY.** Honest answer: a neutral Ethereum contract fed by Axiom or Herodotus
could do this. The argument for Creditcoin is architectural — neutrality from the evaluated
parties, cross-ecosystem scope, and append-only cost — not capability. **This is the thesis's
weakest link and is argued, not proven.**

**WHY EXISTING SOLUTIONS ARE NOT ENOUGH.** CuratorWatch and DIA are better products for humans and
we do not claim otherwise. Neither is contract-consumable, neither is permanent independent of the
operator, and neither can be added to by an adversary. Spectral's disappearance is the cautionary
case for depending on a startup's dashboard.

**WHY 8–9 MINUTES IS OK.** A curator track record is not a trading signal. Records are written
once and read for years.

**WHY THIS CAN WIN A HACKATHON.** Attestcoin is load-bearing rather than decorative; the demo
shows a named actor moving real money and a policy contract reacting; and the multi-event
provenance composition (**allocator appointment → allocation**, both proven on real mainnet data)
is genuine depth against the stated scoring criterion — attribution is *only* correct if several
proofs are composed.

---

## Why the others lost — one fatal reason each

- **P-B / P1′.** No consumer. Maple's pool delegates KYC borrowers, underwrite them, **and post
  first-loss capital**. The party that would use the history already has it and is accountable for
  it. Same "no consumer" failure that killed round-1 P1.
- **P-D.** 33 slashing events in Q1 2026 is not a data set, and the operators that matter are a
  handful of scrutinised institutional brands whose records are already public.
- **P-E.** Attestcoin can prove the payout — which nobody disputes — and cannot prove the
  deliverable, which is the contested off-chain part.

---

## Self-audit (§28)

| Question | Answer |
|---|---|
| Anchored on prior ideas? | **No** — winner is a new area found in round 2; P1′ was examined and killed. |
| Anchored on Maple? | **No** — P1′ scored 5.85 and was killed on the consumer question. |
| Mistook feasibility for market? | **Partly a risk.** Mitigated by independent academic evidence and $B-scale TVL, but the *registry consumer* is still the softest part. Declared. |
| Used secondary sources as primary? | **Partly.** Incident figures come from trade press/post-mortems; contract facts and TVL are primary. Labelled throughout. |
| Treated stale services as current? | **No** — liveness checked: Goldfinch dead, Spectral pivoted, ARCx dead, Relic dead, Axiom/Herodotus/CuratorWatch alive. |
| Forced Creditcoin in? | **Partly.** Stated as an architectural argument, not a technical necessity. |
| Same product without Attestcoin? | **No** — it would need a trusted feeder. |
| Is API/RPC actually more sensible? | **Yes, for human dashboards.** Conceded explicitly; our claim is narrowed to contract-consumable, adversarial, permanent records. |
| Hid the completeness problem? | **No** — stated as a permanent, structural limitation. |
| Weak evidence of users? | Depositors: strong. Registry consumers: **inferred**, declared as such. |
| Demo shows off tech over problem? | Demo is built around "who moved your money, and where" — see MVP doc. |

No audit answer overturns the decision, but two — Creditcoin necessity and registry-consumer
evidence — cap confidence at **Medium-High**.

---

## Unresolved items that could still overturn the thesis

1. **Would any allocator want contract-enforced curator policy?** Inferred, not evidenced. This is
   the one item that, if firmly false, reduces the project to a proof-backed dashboard.
2. **Creditcoin vs Ethereum+Axiom.** Argued architecturally; not demonstrated as necessary.
3. **Completeness is structurally unachievable.** Permanent limitation, must never be overstated.

Per the user's rule 3, item 1 was assessed before proceeding: it does not invert the thesis,
because the demo and MVP stand on verification integrity rather than on an allocator committing to
use it. Items 1–3 are carried as declared limitations, not as blockers.
