# Candidate Validation — P1 / P2 / P3

> Executed 2026-08-17, 15:10–15:30 KST. Adversarial by design: the goal was to break the
> candidates, not to rescue them.
> Technical constraints fixed by [`../spike/BASELINE.md`](../spike/BASELINE.md) — not re-verified here.
> **FACT** = observed/quoted from a primary source · **INFERENCE** = our reasoning · **JUDGMENT** = our call.

---

## 0. Findings that apply to all three candidates

### 0.1 FACT — Creditcoin mainnet is effectively dormant

Source: Creditcoin's own Blockscout explorer API, `https://creditcoin.blockscout.com/api/v2/stats`,
read 2026-08-17.

| Metric | Value |
|---|---|
| `total_transactions` (lifetime) | 12,268,150 |
| **`transactions_today`** | **190** |
| `network_utilization_percentage` | **0.022 %** |
| `total_addresses` | 1,488,560 |
| `average_block_time` | 15 s |
| market cap / price | ~$84M / $0.068 |

Cross-check: CC3 **testnet** produced **0 transactions across 12 consecutive blocks** (measured
directly via RPC). Creditcoin does **not appear at all** in DeFiLlama's 461-chain list — no
tracked DeFi TVL, no tracked stablecoin supply.

**INFERENCE.** The lifetime figure is a historical accumulation (largely credit-record writes);
the *current* run-rate is ~190 tx/day. There is no live DeFi ecosystem, no stablecoin liquidity,
and no application user base on Creditcoin to serve today.

**JUDGMENT.** This caps criterion 5 (Creditcoin ecosystem fit) for *every* candidate, and it is
not a defect of any individual candidate. See PROJECT_DECISION.md §3.

### 0.2 FACT — Creditcoin's own usage numbers are mutually inconsistent

Two Creditcoin-sourced claims encountered:

- "over 2 million Nigerians received 100B Naira in microloans" (via Aella)
- "Aella crossed **$100 million** in total on-chain loans recorded via Creditcoin in 2025";
  "5M+ individual loan transactions for **337,000+ users**"

2M users vs 337k users; 100B NGN (≈$65M at ~1,550 NGN/USD) vs $100M. **No independent
verification found** for any of these figures. Gluwa–Central Bank of Nigeria eNaira relationship
is an **MoU** (stage 1 on the brief's own maturity scale), not a deployment.

**JUDGMENT.** All Creditcoin adoption figures must be cited as *"Creditcoin self-published,
independently unverified, internally inconsistent."*

---

## 1. P1 — Cross-chain verified credit history

### 1.A Signal validity — **FAILS**

**FACT.** Aave is overcollateralized. Academic work (*Do liquidations discourage lending in
DeFi?*, ScienceDirect) states that liquidations are *"a protective mechanism rather than a
default event, with no inherent loss to lenders"* and that *"DeFi usage persists even after
liquidations,"* unlike traditional default which curtails future borrowing.

**FACT.** The academic basis for on-chain credit scoring (arXiv 2207.07008, *Scoring Aave
Accounts for Creditworthiness* — Cred Protocol's own paper, text extracted locally) describes
Spectral's model as predicting *"whether a borrower has gotten liquidated within a predefined
time window post the date of borrowing and whether his health factor dropped below a certain
threshold."* Keyword scan of the full paper: **0 occurrences** of "limitation", "caveat", or
"overcollateral". The overcollateralization critique is never addressed.

**JUDGMENT.** "Repaid on Aave" is position management, not creditworthiness. These models predict
*liquidation propensity in a collateralised system* — a different and far weaker quantity than
default risk. The premise of P1 as originally framed is invalid.

### 1.A′ Attempted rescue — target real credit protocols instead

**FACT.** Uncollateralised on-chain credit produces genuine credit events, and they are on-chain.
Maple's loan contracts emit (verified by reading `IMapleLoanEvents.sol` in
`maple-labs/open-term-loan` and `fixed-term-loan`):
`Impaired(uint40,uint40)`, `LoanImpaired(uint256)`, `ImpairmentRemoved(...)`,
`Repossessed(...)`, `PaymentMade(...)`, `BorrowerAccepted(address indexed)`.

**FACT.** Real losses exist: Orthogonal Trading defaulted on eight Maple loans totalling **$36M**
(Dec 2022) after *misrepresenting its financial position*; a delegate concealed FTX exposure.
Maple total defaults ≈$72M incl. Auros. TrueFi: $4.4M (Invictus, Blockwater). Maple is very much
alive — **~$2.1B TVL, ~$1.97B active loans (May 2026)**; tokenized private credit >$14B.

**FACT (technical).** Proving "borrower X was impaired" requires **composing ≥2 proofs**
(`BorrowerAccepted` binding loan-contract L↔X, plus `Impaired` from the same L) plus provenance
that L is a genuine factory-deployed Maple loan. Feasible and technically interesting.

**JUDGMENT.** The rescue is real but narrow: Maple's borrower universe is a few dozen KYC'd
institutions that the lender already underwrites bilaterally, and headline defaults are public
news. It does not restore a *market*.

### 1.D Competitive landscape — **the field was tried and abandoned**

Liveness checked directly 2026-08-17 (HTTP + DNS + GitHub API):

| Competitor | Status | Evidence |
|---|---|---|
| **Spectral** | **Pivoted away from credit entirely** | `spectral.finance` → HTTP **404**. GitHub org `Spectral-Finance` renamed "Spectral Labs", 23 repos, all AI/agent (`agentsea`, `lux`, `openrouter-rankings`, `autonomous-agent-contracts`). Now "Pioneering The Onchain Agent Economy" (Syntax V2). Raised **$23M in 2022 (General Catalyst, Social Capital; total ~$30M incl. Samsung Next, Gradient Ventures, Truist Ventures)** explicitly for "programmable creditworthiness". |
| **ARCx** | **Dead** | `arcx.money` DNS resolves but HTTP connection fails (curl code 000). GitHub org `arcxgame` → 404. Coverage is 2021–22 only. |
| **Cred Protocol** | Alive, quiet | Site 200. Public GitHub last pushed 2023–2024. |
| **Credora** | **Alive and winning — as an oracle** | Acquired by **RedStone (Sept 2025)**; "Credora by RedStone" DeFi risk ratings launched Nov 2025, **live on Morpho and Spark**. |

**JUDGMENT — this is the decisive finding.** Two well-funded attempts at trustless/portable
on-chain credit scoring exited the category. The survivor won by becoming an **oracle inside a
larger oracle company**, and the largest lending venues (Morpho, Spark) chose it. The market
revealed its preference: buyers want **coverage and judgment**, not **verifiability**.

### 1.C Wallet whitewashing — **UNSOLVED**

An address with adverse history is abandoned; a new one has none. Attestcoin cannot prove
absence, so a fresh wallet is indistinguishable from a clean one. Institutional borrowers on
Maple are KYC'd by Maple, which mitigates this *only inside Maple* — where the lender already
knows the borrower and needs no registry.

### 1.B Completeness — **UNSOLVED, and permissionless submission does not fix it**

Permissionless adverse submission means a third party *may* add an event they discovered. It does
not make the set complete. "10 Repays, 0 Liquidations" never means "no liquidations occurred."
A **verified event set** is not a **credit history**, and must never be presented as one.

### 1.E Final question

> *Who stakes money on this, and why choose cryptographic verification over an existing scorer
> when we have strictly less data?*

**Answer: no one identified.** Morpho and Spark pay for Credora/RedStone ratings today. Our
offering would carry less data (no off-chain, no collateral analytics, no absence, no state) in
exchange for verifiability that no observed buyer is paying for.

**VERDICT: KILL. Confidence: High.**

---

## 2. P2 — Reusable KYC / whitelist portability

### 2.A Problem reality — real but modest

**FACT.** Under ERC-3643 every transfer is checked against an on-chain Identity Registry; an
un-whitelisted recipient causes the transfer to fail. Industry commentary states *"even adding a
new chain requires re-whitelisting addresses on that chain"* and that reusable credentials
*"would cut weeks of dead time."* Funds are genuinely multichain (BENJI 8 chains; tokenized
T-bills >$7B AUM).

**LIMITATION.** These are trade-press/vendor statements, **not** primary regulator or issuer
sources. Not upgraded to a verified problem.

### 2.B/2.D Existing solutions — **the gap is actively closing**

**FACT.** OpenZeppelin and the T-REX Network are jointly evolving ONCHAINID with *"a cross-chain
identity model,"* allowing *"claims signed on one chain to be valid across multiple chains
**without requiring new signatures from claim issuers**"* and, via the same ONCHAINID address
across chains, claim reuse *"without the need for re-signature."*

**JUDGMENT.** That is P2's exact value proposition, being shipped by the standard's own
maintainers with OpenZeppelin. We would arrive late, weaker, and outside the standard.

### 2.C Revocation — **fatal**

**FACT.** Transfer agents must support *"the freezing of securities necessitated by OFAC
sanctions or other legal considerations."* Compliance is a *continuing* obligation.

**JUDGMENT.** Attestcoin proves "address X was whitelisted at time T" and **cannot** prove "X is
still whitelisted." Permitting a transfer for a since-sanctioned address on a stale proof is a
compliance failure, not a bug. Short expiry + periodic re-proof adds 8–9 minutes of latency and
recurring operational cost, and is strictly worse than querying the authoritative registry.

### 2.E Final question — **fails**

**FACT.** *"Securitize, Centrifuge, and Superstate all operate as SEC-registered transfer agents,
meaning their compliance teams carry legal accountability for sanctions screening, which is
arguably more robust than any automated oracle."*

**JUDGMENT.** The root of trust is a legally accountable off-chain entity. Proving the on-chain
reflection of its decision removes trust only in a *mirror operator* — a component that is not the
weak point — while leaving the substantive trust untouched. And **no tokenized securities exist on
Creditcoin**, so the consumer must be invented.

**VERDICT: KILL. Confidence: High.**

---

## 3. P3 — EM lending / cross-border capital commitment

### 3.A/3.B Users and Creditcoin usage

**FACT.** Aella records credit transactions on Creditcoin; "crossed $100M in total on-chain loans
recorded via Creditcoin in 2025"; "5M+ loan transactions, 337,000+ users." Creditcoin markets this
as "Credal". **All figures Creditcoin-self-published, internally inconsistent (§0.2), and
independently unverified.**

### 3.C Direction — **solves the easy half**

**JUDGMENT.** Attestcoin can prove *capital was committed on Ethereum*. But the party who
committed the capital **already knows they committed it** — that fact is not in dispute and nobody
is currently deceived about it. The genuinely disputed facts are **loan origination, servicing and
repayment in the field**, which are off-chain and therefore unprovable by Attestcoin. Reporting
back to the Ethereum-side investor requires writability, which the baseline treats as unusable.

So the mechanism removes an uncontested trust assumption and leaves every contested one intact.

### 3.D Existing solutions — **already built**

**FACT.** Goldfinch connects crypto capital to EM borrowers across Kenya, Nigeria, Uganda, Mexico,
Brazil, India, the Philippines, using human auditors and backers with a first-loss structure.
Huma Finance (PayFi) partners with Jia for revenue-backed loans in Kenya and the Philippines.
Both operate today with legal + auditor + tranche structures.

### 3.E Final question — **fails**

> *Which decision-maker acts differently because Creditcoin trustlessly confirms capital arrived
> from Ethereum?*

**No concrete decision-maker or changed action was identified.**

**VERDICT: KILL. Confidence: Medium-High.** (Medium-High rather than High because P3's user base
is the one that plausibly exists; it fails on mechanism, not on users.)

---

## 4. Scoring

Scores assigned after research, then weighted. 10-point scale.

| # | Criterion | Wt | P1 | P2 | P3 |
|---|---|--:|--:|--:|--:|
| 1 | Problem reality | 20% | 4 | 4 | 3 |
| 2 | User clarity | 10% | 6 | 6 | 6 |
| 3 | Gap vs existing alternatives | 15% | 3 | 2 | 3 |
| 4 | Attestcoin necessity | 15% | 8 | 3 | 3 |
| 5 | Creditcoin necessity / ecosystem fit | 10% | 5 | 2 | 8 |
| 6 | MVP feasibility | 10% | 10 | 8 | 8 |
| 7 | 8–9 min latency fit | 5% | 10 | 9 | 9 |
| 8 | Demo clarity | 5% | 8 | 6 | 6 |
| 9 | Novelty | 5% | 5 | 3 | 5 |
| 10 | Finance / RWA / credit meaning | 5% | 6 | 8 | 8 |
| | **Weighted total** | | **6.00** | **4.45** | **5.10** |

**Pattern.** All three score well on 6–8 (feasibility, latency, demo — 20% combined) and poorly on
1 and 3 (problem reality + gap — **35% combined**). Every candidate is *buildable* and *not worth
building*.

| | Verdict | Confidence |
|---|---|---|
| P1 | **KILL** | High |
| P2 | **KILL** | High |
| P3 | **KILL** | Medium-High |

---

## 5. Not verified (time-boxed; do not treat as settled)

- Cred Protocol's current commercial traction (site live, GitHub quiet — could be private repos).
- Whether P2's re-whitelisting friction is confirmed by a primary issuer or regulator source.
- Whether Maple/Goldfinch lenders would value a cross-venue credit-event registry — not tested
  with any practitioner.
- An unexplained `receiveMessages` call to `0xBC1ABF0B733CE8f888fdC86B6474C769e0Be779d` was
  observed on Creditcoin mainnet. Not investigated. It *may* indicate live messaging
  infrastructure; it does not change any verdict here, and BASELINE item 4 stands.

## 6. Key sources (all read 2026-08-17)

Creditcoin Blockscout stats API · DeFiLlama `/v2/chains` · `maple-labs/{open-term-loan,
fixed-term-loan, open-term-loan-manager}` on GitHub · arXiv 2207.07008 (text extracted locally) ·
ScienceDirect *Do liquidations discourage lending in DeFi?* · GitHub API for
`Spectral-Finance`/`arcxgame`/`credprotocol` orgs · HTTP/DNS liveness probes · RedStone blog +
CoinDesk/Blockworks on the Credora acquisition · OpenZeppelin × T-REX Network announcement ·
Securitize SEC Crypto Task Force submissions · CoinTelegraph on Aella×Creditcoin.
