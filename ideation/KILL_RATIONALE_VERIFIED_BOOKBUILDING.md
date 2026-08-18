# Kill Record — "Verified Cross-chain Bond Bookbuilding / Proof-of-Capacity"

> Status: **KILLED** 2026-08-17, confirmed by the user.
> Purpose: preserve the evidence so this idea is not silently revived, and so the *reusable*
> parts of the research are not lost.
> Supersedes the "SURVIVOR" status recorded in `BUIDL_CTC_2026_FALL_AGENT_BRIEF.md` §8 and §10.

---

## 1. What the idea was

Mock institutional investors post commitment transactions on Ethereum Sepolia. Attestcoin
verifies those transactions. Only verified commitments enter a bond orderbook on Creditcoin,
giving the bookrunner a cryptographically-backed "capacity signal" alongside each order.

Claimed problem: bond bookbuilding suffers from **order inflation** and **duplicate orders**, so
an order is not the same as real demand.

---

## 2. Why it was killed — three independent strikes

### Strike 1 — The mechanism does not address any documented cause of order inflation

The ICMA Primary Market Handbook (Appendix B XIII, *Pre-Sounding, Bookbuilding and Allocations*,
marked **April 2012 (revised)**) enumerates the causes of order inflation. Verbatim, ¶15 — an
investor may inflate if it:

> "**(i)** anticipates that its order will be reduced on allocation because of oversubscription,
> **(ii)** overestimates demand that it was unable to confirm internally prior to placing its
> order, or even **(iii)** anticipates particularly strong demand by other investors and so
> expects to liquidate part of its allocation in initial secondary trading to crystallise the
> initial issuance premium ('flipping')."

| Documented cause | Nature | Does proof-of-capacity address it? |
|---|---|---|
| (i) pre-empting allocation cuts | allocation game | ❌ |
| (ii) internal demand not yet confirmed | buy-side process | ❌ |
| (iii) flipping for issuance premium | arbitrage motive | ❌ |

**Not one of the three is "the investor lacks funds or settlement capacity."** Proving capital
therefore addresses none of them.

The same paragraph records the mitigation the market *actually* uses — reputation, not capital:

> "bookrunners may well apply a discount factor to, or even entirely exclude on allocation,
> orders they view as being potentially inflated (bookrunner views in this respect will inter
> alia account for **previous experience with specific investors**)."

Note: the handover brief already suspected this (§11.2) but kept the idea alive anyway. The
primary source confirms the suspicion.

### Strike 2 — Duplicate-order detection is already solved off-chain, at scale

ICMA ¶14 named the fix back in 2012:

> "efficiencies are being sought through increased automation with bookrunners increasingly
> connecting their orderbook management systems in a manner enabling **unique investor
> identification**."

Fourteen years on, those systems are the market standard:

| Platform | Relevant claim | Scale |
|---|---|---|
| **InvestorAccess** (Ipreo / S&P Global) | "order duplication is **eliminated** and orderbooks are easier to reconcile and allocate"; buy-side submits directly, creating a "definitive, auditable order record" | "vast majority" of new issuance across US equities, US municipals, global fixed income; integrated with **IssueNet**, used by "every major investment bank in the world" |
| **DirectBooks** | electronic order routing into syndicate orderbooks; allocations returned electronically (Bloomberg TSOX integration announced 2026-06-08) | 48 underwriters, 1,000+ institutional accounts since late 2020 |

⚠️ **Evidence quality caveat:** S&P Global and DTCC pages returned HTTP 403 to automated
retrieval, so these two rows rest on **secondary sources** (vendor press releases, trade press)
rather than primary pages. The *direction* is corroborated by ICMA ¶14, which is primary. If this
idea is ever revisited, verify these two claims from primary sources first.

### Strike 3 — A public orderbook makes the problem worse, not better

ICMA ¶17 states that investors seek orderbook visibility precisely in order to inflate:

> "some investors also seek such information **in order to magnify their orders** where there is
> substantial oversubscription…"

And ¶18 records that disclosure is deliberately restricted, sometimes entirely:

> "This may result in a conclusion in individual cases that **no information relating to the
> orderbook should be** [disclosed]"

Publishing a verified book on a public chain runs directly against the market's own control.

---

## 3. Supporting structural problems

- **"Cross-chain" was not deliverable as pitched.** CC3 Testnet supports exactly two source
  chains — Sepolia and Ethereum **mainnet** (confirmed on-chain 2026-08-17 via the ChainInfo
  precompile). Aggregating investor liquidity "across many chains" would require paying real ETH.
  Sepolia → Creditcoin *is* genuinely cross-chain; multi-source aggregation is not.
- **"Why Creditcoin?" was circular.** With every commitment on one source chain and no use of
  writability, nothing answered "why not just run the book on Sepolia?" other than "because the
  hackathon is on Creditcoin" — the exact weak answer the brief itself forbade (§5.4, §P6.3).
- **Tutorial-reskin risk.** The official `loan-flow` tutorial is structurally identical
  (register → source event → prove → state transition). Renaming
  `registerLoan/LoanFunded/LoanRepaid` to `registerDeal/CommitmentPlaced/OrderVerified` yields
  the proposed design. With "depth of Attestcoin utilization" an explicit scoring criterion and
  76 submissions in the previous season, that is a real risk.

---

## 4. What survives and should be reused

The research was not wasted. These findings hold regardless of the idea:

1. **The gap is real, but nobody is filling it on-chain.** Tradeweb's ECB Bond Market Contact
   Group presentation says verbatim: **"Off-chain syndication and book build."** Independently,
   ICMA's *Tracker of New FinTech Applications in Bond Markets* lists ~16 primary-market
   platforms (HSBC Orion, Clearstream D7, JPM Kinexys, Euroclear, SDX, Obligate, …) — **none**
   described as an on-chain bookbuilding or order-collection system. Read that as a gap *and* as
   a signal that the market does not consider it the next thing to move on-chain.
2. **Reputation, not capital, is the market's inflation control.** Any future idea about demand
   quality should start from persistent counterparty track record, not collateral proof.
3. **Confidentiality is a first-class constraint** in institutional order flow, not a detail to
   defer to "we'd add ZK later."
4. **Prior art must be checked before design, not after.** Four of the brief's earlier kills came
   from a single search each; this one survived only because the incumbents (DirectBooks,
   InvestorAccess) were listed as "to search" and never searched.

---

## 5. Standing prohibitions

Do not revive under a new name without new primary evidence. Specifically, never claim:

- that capacity or collateral proof reduces order inflation;
- that duplicate orders are an unsolved problem in primary bond markets;
- that Attestcoin verifies demand, intent, creditworthiness, or economic truth of any kind;
- that a public-chain orderbook is compatible with institutional confidentiality.

---

## 6. Primary sources

- ICMA Primary Market Handbook, Appendix B XIII (April 2012 revised) —
  <https://www.icmagroup.org/assets/documents/Regulatory/Handbook-recent-items-unlocked/ICMA-PMHbk-S6-B-XIII.PDF>
  (text extracted locally; ¶13–18 are the operative passages)
- ICMA Tracker of New FinTech Applications in Bond Markets —
  <https://www.icmagroup.org/fintech-and-digitalisation/fintech-resources/tracker-of-new-fintech-applications-in-bond-markets/>
- Tradeweb, *Tokenisation in Finance*, ECB Bond Market Contact Group —
  <https://www.ecb.europa.eu/paym/groups/pdf/bmcg/260304/Item_3a_Tokenisation_in_finance_Tradeweb.pdf>
- S&P Global InvestorAccess — <https://www.spglobal.com/market-intelligence/en/solutions/products/investor-access> *(403 to automated fetch; claims via secondary sources)*
- DirectBooks / Bloomberg TSOX, 2026-06-08 — <https://www.bloomberg.com/company/press/bloomberg-and-directbooks-collaborate-on-primary-fixed-income-market-workflows/>

Technical constraints referenced above: see [`../spike/FINDINGS.md`](../spike/FINDINGS.md).
