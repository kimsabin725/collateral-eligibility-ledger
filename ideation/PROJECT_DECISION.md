# Project Decision — 2026-08-17

## Verdict: **NO-GO on P1, P2 and P3.** No candidate selected.

| Candidate | Verdict | Weighted score | Confidence |
|---|---|--:|---|
| P1 — Cross-chain verified credit history | **KILL** | 6.00 / 10 | High |
| P2 — Reusable KYC / whitelist portability | **KILL** | 4.45 / 10 | High |
| P3 — EM capital-commitment verification | **KILL** | 5.10 / 10 | Medium-High |

Full evidence: [`CANDIDATE_VALIDATION_FINAL.md`](./CANDIDATE_VALIDATION_FINAL.md).

Per the operating instruction, no new idea exploration has been started. This document records
the decision, the diagnosis, and the choice that now belongs to the user.

---

## 1. Most fatal reason per candidate

**P1 — the market tried this and left.** Spectral raised ~$30M (General Catalyst, Social Capital,
Samsung Next, Gradient, Truist) explicitly for "programmable creditworthiness" and has pivoted
entirely to AI agents; `spectral.finance` returns 404 and its GitHub org is now all agent
tooling. ARCx is offline. The survivor, Credora, was **acquired by RedStone** and now ships
ratings **as an oracle** into Morpho and Spark. Buyers chose coverage and judgment over
verifiability. Secondary but independent: Aave is overcollateralised, and liquidation there is
*"a protective mechanism rather than a default event, with no inherent loss to lenders"* — so the
signal we proved we can verify is not a credit signal at all.

**P2 — the trust root is off-chain and the gap is already closing.** SEC-registered transfer
agents *"carry legal accountability for sanctions screening, which is arguably more robust than
any automated oracle"*; proving the on-chain reflection of their decision removes trust in a
mirror operator, not in the actual root. Meanwhile OpenZeppelin and the T-REX Network are
shipping cross-chain ONCHAINID claims valid across chains *"without requiring new signatures."*
And revocation is unprovable: "was whitelisted at T" cannot establish "is whitelisted now," which
in a sanctions context is a compliance failure rather than a bug.

**P3 — it removes an uncontested trust assumption.** The party that committed capital on Ethereum
already knows it did. The contested facts — origination, servicing, repayment in the field — are
off-chain and unprovable by Attestcoin, and reporting back to the investor needs writability.
Goldfinch and Huma already connect DeFi capital to EM lenders using legal, auditor and
first-loss structures. No decision-maker was found who would act differently.

---

## 2. The pattern — all three broke at the same joint

Scores were high on feasibility, latency and demo clarity (criteria 6–8, 20% combined) and low on
problem reality and gap-vs-alternatives (criteria 1 and 3, **35% combined**).

> Every candidate was **buildable** and **not worth building**.

That is not three independent failures. It is one structural constraint appearing three times.

---

## 3. Diagnosis — the binding constraint is Creditcoin, not the problem

Attestcoin's value is *removing trust in an operator who relays Ethereum facts elsewhere*. For
that to be worth money, someone must simultaneously:

**(a)** need an Ethereum fact, **(b)** need to act on it somewhere *other than* Ethereum, and
**(c)** be harmed today by trusting a relayer.

(a) and (c) are satisfiable — we found real, expensive relayer failures (Kelp DAO **$292M** to a
forged cross-chain instruction; Verus ~$11.6M to a fake message).

**(b) is the problem.** Acting somewhere other than Ethereum means acting on Creditcoin, and
Creditcoin's own explorer reports **190 transactions today** at **0.022% network utilisation**,
with no DeFi TVL tracked anywhere and zero transactions across 12 consecutive testnet blocks.
Actors whose economic life is on Ethereum have no reason to move a consequence to a chain with no
liquidity, no counterparties and no composability.

So the question that killed all three was never "which Ethereum fact matters?" It was **"why
would the consequence live on Creditcoin at all?"** — and criterion 5 (Creditcoin necessity) plus
criterion 2 (user clarity) will keep killing candidates until that question is answered or
explicitly set aside.

**This constraint would have killed almost any candidate we brought.** Continuing to generate
problem candidates under the current criteria is likely to reproduce this outcome.

---

## 4. The decision that now belongs to the user

The blocking issue is a criterion, not a missing idea. Three coherent ways forward; they lead to
materially different work, so this is not ours to assume.

**Option A — Relax criterion 5 to hackathon terms (recommended).**
The competition's own published requirements demand a *meaningful, functional Attestcoin
integration*, testnet deployment, and original work. **Nowhere do they require an existing
Creditcoin user base**; the only stated scoring criterion is *"depth of Attestcoin Protocol
utilization."* Under Option A we require the **problem and its users to be real on Ethereum**,
and accept that the Creditcoin-side consumer is a demonstrated design rather than a live market.
This restores a large candidate space, including a genuine P1 pivot (a permissionlessly-submitted
registry of *real* uncollateralised credit events — Maple emits `Impaired`, `Repossessed`,
`BorrowerAccepted`, and we confirmed the multi-proof composition needed to bind a loan to a
borrower is feasible and technically substantial).

**Option B — Keep criterion 5 and search for genuine neutrality demand.**
Look only for cases where value comes *precisely from not being on Ethereum* — neutrality between
adversarial counterparties, censorship-resistance, cost, or regulatory separation. Intellectually
the cleanest answer, but the narrowest, and 19 days is little time to find and validate one.

**Option C — Accept NO-GO for this hackathon.**
Keep the spike as the portfolio artifact. It already demonstrates protocol due diligence,
independent verification, and a working cross-chain proof pipeline.

**Recommendation: Option A**, because criterion 5 as written is stricter than the competition
requires and is currently the sole binding constraint. This needs the user's explicit decision —
adopting it changes what "a good candidate" means.

---

## 5. What survives and is reusable regardless

- **Working technical baseline** — readability, decoding, replay protection, negative controls,
  all measured, in `spike/`. Including a live proof of a real Aave mainnet repayment.
- **A validated capability boundary** — provable: events from known contracts, tx success,
  emitter, calldata. Not provable: state, absence, off-chain facts, prices. This boundary did
  most of the killing and should be applied first to any future candidate.
- **Evidence of real, expensive relayer failures** — usable as motivation for whatever is chosen.
- **A competitive map of on-chain credit** — Spectral pivoted, ARCx dead, Credora→RedStone live
  on Morpho/Spark. Do not re-research this.
- **Maple's on-chain credit-event surface**, confirmed by reading the contracts.

---

## 6. Hackathon freshness check — re-verified 2026-08-17

No change since the previous check. `endDate` `2026-09-06T04:59:00.000Z` (≈ **2026-09-06 13:59
KST**), `isExtended: false`; 19 days left; requirements unchanged (Attestcoin as a core feature,
testnet deployment, original work created during the hackathon, GitHub + README, deck, demo
video); minimum team size 1; the only stated scoring criterion remains depth of Attestcoin
utilisation. Registered hackers 75 → **77**; still **0 submissions**.

Note that the body text still says "September 6, 2026, 23:59:00 ET" while the platform countdown
enforces `04:59Z`. Treat **2026-09-06 13:59 KST** as the hard deadline.
