# Problem Candidates — external research first, ideas second

> Compiled 2026-08-17. Deliberately **not** anchored to `BUIDL_CTC_2026_FALL_AGENT_BRIEF.md` (비공개 작업 문서, 저장소 밖).
> Method: search for documented failures, losses, and friction in the wild, *then* ask whether
> Attestcoin verification would matter. Problems that only exist because Attestcoin exists were
> discarded.
> Technical constraints are fixed by [`../spike/BASELINE.md`](../spike/BASELINE.md).

---

## 0. The capability boundary that decides everything

Applied ruthlessly below. Attestcoin proves **that a specific transaction was included in a
canonical Ethereum block**, plus that transaction's success status, emitting contract, event
topics, event data, and calldata.

It **cannot** prove:

| Not provable | Consequence |
|---|---|
| Current state or balances | "Wallet holds 10 ETH" is out. Only "wallet *did* X" is in. |
| **Absence** of an event | "Never defaulted" / "not pledged elsewhere" is out. |
| Off-chain facts | Reserves in a bank, NAV, custody, legal title — all out. |
| Prices | Oracle-manipulation problems are a capability mismatch. |

**The sweet spot:** a fact that is an **event emitted by a specific, well-known contract**, where
the consequence is slow enough to absorb ~8–9 minutes, and lives on Creditcoin.

Anything requiring absence proofs needs a design answer (see P1's adverse-evidence mechanism).

---

## 1. Candidate long list (12)

Scored against the user's six criteria. ✅ met · ⚠️ partial · ❌ failed.

| # | Problem | Real problem? | Crypto‑verify > API? | 8–9 min OK? | Consequence on CTC? | Users + alternatives? | Attestcoin load-bearing? | Verdict |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|---|
| P1 | Credit history doesn't cross chains ("Reputation Black Hole") | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **FINALIST** |
| P2 | KYC/whitelist must be redone per chain for tokenized securities | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **FINALIST** |
| P3 | EM lenders can't prove use-of-funds to offshore DeFi capital | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ | **FINALIST** |
| P4 | Bridges forge cross-chain messages ($292M Kelp, $11.6M Verus) | ✅ | ✅ | ⚠️ | ⚠️ | ✅ | ✅ | KILL — we'd be rebuilding the primitive |
| P5 | Oracle price manipulation ($124.1M H1'26) | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | KILL — capability mismatch |
| P6 | RWA redemption reconciliation (phantom/orphan tokens) | ✅ | ✅ | ✅ | ⚠️ | ✅ | ⚠️ | HOLD |
| P7 | Proof-of-reserves is a point-in-time snapshot | ✅ | ❌ | ✅ | ⚠️ | ✅ | ❌ | KILL — off-chain facts |
| P8 | DeFi insurance claims take weeks, disputes are subjective | ✅ | ⚠️ | ✅ | ⚠️ | ✅ | ⚠️ | HOLD |
| P9 | Cross-chain DAO governance relies on trusted relayers | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ✅ | HOLD — no real users on CTC |
| P10 | Airdrop sybil / eligibility snapshots are operator-asserted | ⚠️ | ⚠️ | ✅ | ❌ | ✅ | ⚠️ | KILL — low value, poor career fit |
| P11 | Collateral double-pledged across venues | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | KILL — needs absence proofs |
| P12 | Restaking/slashing evidence portability | ⚠️ | ✅ | ✅ | ❌ | ⚠️ | ✅ | KILL — niche, weak CTC fit |

---

## 2. Killed — with reasons

**P5 Oracle manipulation.** The most expensive documented problem in the set (52 attacks,
$124.1M in H1 2026, an 11.8× rise in losses year-on-year), and Attestcoin cannot touch it.
Manipulation happens *inside* a valid, successfully-included transaction. Proving inclusion
proves nothing about whether the price was fair. Tempting and wrong.

**P4 Bridge message forgery.** The failure mode is exactly what proof-based verification fixes —
Kelp DAO lost **$292M** because an attacker forged what looked like a valid LayerZero
instruction; Verus lost **~$11.6M** to a fake cross-chain transfer message. But building a bridge
means rebuilding the primitive Attestcoin already is, against production ZK light clients
(Succinct secures Gnosis OmniBridge: >$40M TVL, >$1.5B stablecoin flow). We would lose on
technical depth to teams who do this for a living. *Keep the statistics as motivation for
whichever finalist we choose; do not build a bridge.*

**P7 Proof of reserves.** Real and well documented — reserves can be "window dressed" for the
attestation date, and custodians can fail between reporting periods undetected. But the asset
sits in a bank, not on Ethereum. Attestcoin proves nothing about it.

**P11 Double-pledged collateral.** Requires proving a *negative* across venues we cannot
enumerate. Structurally impossible with inclusion proofs.

**P10 Airdrop sybil.** Weak value, no institutional relevance, poor fit with the user's stated
career direction (digital assets / RWA / STO).

**P12 Restaking slashing.** Niche; no natural reason for the consequence to live on Creditcoin.

---

## 3. Held, not finalists

**P6 RWA redemption reconciliation.** Genuinely documented — *"Tokens burned without a ledger
posting produce phantom ownership; a ledger posting without the chain event produces orphan
tokens."* Attestcoin proves the burn cleanly. The problem: the *consequence* needs to be
off-chain (a custodian wiring fiat), and Creditcoin cannot reach out. Writability would fix this
— revisit if the AMA reopens it.

**P8 DeFi insurance.** Payout delays of weeks-to-months are real, and the recurring dispute is
whether a loss was "an exploit" at all. Attestcoin can prove the transaction happened; it cannot
prove it was malicious. The subjective core survives, so the trust reduction is partial.

**P9 Cross-chain governance.** >$1.5B in DAO treasuries across L2s/L1s with execution
bottlenecked on one chain and ~48-hour trust-heavy multisig delays. Excellent Attestcoin fit —
a vote is an event on Ethereum, execution is slow by design. Fails on **users**: Creditcoin has
no DAO ecosystem that needs this. We would be inventing the user.

---

## 4. Finalists

### P1 — Credit history does not cross chains

**Users.** Borrowers who built repayment history on Ethereum DeFi; lenders on other chains who
must price them as strangers.

**Current alternative.** Off-chain scoring services — Spectral (MACRO Score), ARCx (DeFi
Passport), Cred Protocol (scores across nine chains, feeding 3Jane). Each computes a score off
the chain and publishes it.

**Concrete weakness.** The consumer trusts *the score provider*, not the evidence. The score is
opaque and unauditable at the point of use; the provider is a single point of failure and
censorship. Documented industry framing: the **"Reputation Black Hole"** — *"a user who has built
up a stellar reputation by consistently repaying loans on Ethereum is treated as a complete
unknown when they bridge assets to a lending protocol on Solana."*

**Verifiable evidence.** ✅ **We proved this works.** `scripts/04-prove-aave-repayment.js` took a
real `Repay` event from the live Aave V3 Pool on Ethereum mainnet
(tx `0x9b0d0a9c…a75f0`, block 25,772,707) and verified it on Creditcoin: **`VERIFY ✅ TRUE`**,
proof fetched in under a second. No score provider anywhere in the path.

**Why Attestcoin matters.** The lender stops trusting a scorer and starts checking Aave's own
event. Remove Attestcoin and you are back to an oracle publishing an opinion — a materially
weaker trust model.

**Why 8–9 min is fine.** Credit limits are not set in seconds. The proof is submitted once and
the record is permanent.

**The hard problem — adverse selection.** A borrower will submit repayments and never submit
liquidations, and *absence is not provable*. The design answer: because an Attestcoin proof is
self-validating, **submission must be permissionless** — any lender or watcher can post proof of
a borrower's `LiquidationCall`, and it binds without the borrower's consent. The record becomes
"proven good events minus proven bad events," never "clean history." That distinction must be
stated honestly and is itself the interesting design content.

**Creditcoin fit — the strongest of any candidate.** Creditcoin is literally a credit-history
chain with real usage: ~9.4M transactions, #9 in RWA developer activity (Feb 2026), and over
**2 million Nigerians served 100B Naira in microloans** via the Aella partnership, with partners
in Kenya, Nigeria, Indonesia and Cambodia. "Why Creditcoin?" answers itself without circularity.

---

### P2 — Tokenized-securities KYC must be redone on every chain

**Users.** Issuers and transfer agents of tokenized funds; investors already verified elsewhere.

**Current alternative.** Per-venue, per-chain whitelists. Under ERC-3643 every transfer is
checked against an on-chain Identity Registry; if the receiving wallet has not completed KYC on
*that* chain, the transfer simply fails.

**Concrete weakness.** *"Even adding a new chain requires re-whitelisting addresses on that
chain."* Industry commentary is explicit that reusable credentials *"would cut weeks of dead
time"* versus making users *"pass the same checks three times."* Meanwhile funds are aggressively
multichain: BENJI spans eight chains; tokenized T-bills crossed **$7B AUM** in early 2026.

**Verifiable evidence.** ERC-3643 Identity Registry writes are on-chain events on Ethereum —
exactly the shape Attestcoin proves. *(Not yet empirically tested by us — see §5.)*

**Why Attestcoin matters.** The Ethereum registry stays canonical; Creditcoin verifies the
registration event cryptographically instead of trusting a bridge operator or an API to mirror
the whitelist. Given that whitelists gate securities transfers, a forged mirror is a compliance
failure, not just a bug.

**Why 8–9 min is fine.** Investor onboarding is measured in days.

**Honest weakness.** Revocation is the mirror image of the absence problem — proving someone
*was* whitelisted is easy; proving they have not since been *removed* is not. Any design needs an
explicit expiry/re-proof policy, and that limitation must be stated, not hidden.

---

### P3 — Emerging-market lenders cannot prove use-of-funds to offshore capital

**Users.** Microfinance institutions and EM lenders (Creditcoin's actual customer base); DeFi/
stablecoin capital sitting on Ethereum that would fund them.

**Current alternative.** Bilateral trust, periodic reporting, auditors — or simply no deal.

**Concrete weakness.** The lender's capital commitment lives on Ethereum, the loan book lives on
Creditcoin, and nothing cryptographically ties the two. Each side trusts the other's reporting.

**Verifiable evidence.** Creditcoin already records off-chain credit transactions between
identifiable counterparties for MFIs and EM borrowers, at real scale (Aella: 2M+ borrowers).
The capital side is verifiable: a deposit or commitment transaction on Ethereum is an event.

**Why Attestcoin matters.** A Creditcoin credit facility opens **only** on proof that capital was
actually committed on Ethereum — no operator asserting "the money arrived."

**Why 8–9 min is fine.** Loan facilities are not opened in seconds.

**Honest weakness — the direction problem.** Attestcoin is inbound-only. We can prove *capital
in*; we cannot push *repayment confirmations back out* to Ethereum without writability. So the
lender's side of the loop stays trust-based. This candidate benefits most from writability and is
the most likely to be upgraded if the AMA reopens it. Its user story is also the least verifiable
from public sources — it rests on Creditcoin's own published usage claims.

---

## 5. What is not yet verified about the finalists

Stated so nothing is over-claimed:

- **P1** — proven technically feasible end-to-end. What is *not* verified: whether lenders would
  actually price off such a record, and how much of Spectral/ARCx/Cred already covers this. Prior
  art needs a direct comparison before committing.
- **P2** — the friction is documented by industry commentary, not by a primary regulator or
  issuer source. We have not empirically proven an ERC-3643 registry event. Both are needed.
- **P3** — rests on Creditcoin's own usage claims; no independent confirmation, and no evidence
  yet that MFIs or DeFi lenders want this specific mechanism.

## 6. Sources

Bridge/oracle losses: Kelp DAO $292M, Verus ~$11.6M, CertiK Hack3D H1 2026 ($1.32B / 344
incidents), oracle manipulation 52 attacks / $124.1M H1 2026 · Reputation Black Hole and on-chain
credit scoring landscape (Spectral, ARCx, Cred Protocol, 3Jane, Wildcat) · ICMA-independent RWA
sources on redemption reconciliation · ERC-3643 / transfer-agent whitelisting and cross-chain
re-whitelisting burden · tokenized T-bill market >$7B, BENJI eight chains, BUIDL as derivatives
collateral at Crypto.com/Deribit Q1 2026, Securitize Markets FINRA broker-dealer May 2026 ·
Creditcoin usage: 9.4M transactions, Aella 2M+ Nigerian borrowers / 100B Naira, partners in
Kenya/Nigeria/Indonesia/Cambodia · Succinct ZK light client securing Gnosis OmniBridge.
