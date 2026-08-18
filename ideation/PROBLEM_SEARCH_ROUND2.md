# Problem Search — Round 2

> 2026-08-17, session start 15:33 KST. Deliberately started **outside** P1/P2/P3.
> Constraints fixed by [`../spike/BASELINE.md`](../spike/BASELINE.md); prior kills stand
> (bookbuilding, Aave-generic credit, generic reusable KYC, generic EM capital commitment).
> **FACT** = from a cited source · **INFERENCE** = our reasoning · **DECISION** = our call.

## 0. Two corrections to earlier work, found immediately

**FACT — Goldfinch wound down (June 2026).** Governance proposal GIP-87 posted 12 June, vote
20–23 June. ~$100M originated, **$56.15M outstanding**; one depositor recovered ~30% of principal;
GFI down 99.80% from its Jan-2022 high. *(The Defiant, read 2026-08-17.)*
→ `CANDIDATE_VALIDATION_FINAL.md` cited Goldfinch as a live alternative that made P3 redundant.
That premise was wrong in direction (the incumbent didn't just exist — it **failed**), though
P3's kill stands for other reasons.

**FACT — the 2025–2026 private credit crisis is a documented macro event.** FSB published
*Vulnerabilities in Private Credit* (6 May 2026). Reported default rates of 1–2% understate a
true rate near **5.8%**, with ~60% of defaults involving PIK/interest deferral that lets distress
"compound invisibly." 28 of 53 listed BDCs swung to losses in Q1 2026. 2026 lawsuits allege
misstated NAV and delayed loss recognition.
→ Relevant because it names the exact failure mode — **reported performance diverging from cash
reality** — that on-chain data can, in principle, settle.

---

## 1. Problem candidates (12 found; ≥8 required)

| # | Problem | Ethereum fact needed | Verdict |
|---|---|---|---|
| **P-A** | **DeFi vault curators allocate depositor funds with no comparable, permanent record of their decisions** | vault/curator/market allocation events | **FINALIST** |
| **P-B** | On-chain private-credit borrower performance is siloed per protocol | Maple `Impaired`/`Repossessed`/`PaymentMade` | **FINALIST (= P1′)** |
| **P-C** | Reported repayment ≠ cash received (PIK/restructure masking) | actual token transfer vs accrual event | merged into P-B |
| **P-D** | Restaking operator slashing history doesn't cross ecosystems | EigenLayer/Symbiotic slashing events | **FINALIST** |
| **P-E** | DAO grant milestones released without verified delivery | milestone/payout events | **FINALIST** |
| P-F | Bridges accept forged cross-chain messages (Kelp ~$292–300M; Verus ~$11.6M) | message/delivery events | KILL — rebuilding the primitive; Succinct/Polyhedra ZK light clients are production |
| P-G | Oracle price manipulation (52 attacks, $124.1M H1 2026) | — | KILL — manipulation occurs *inside* a valid tx; inclusion proves nothing about price fairness |
| P-H | Stablecoin reserve attestations are point-in-time; redemption can be gated | reserves are off-chain | KILL — off-chain facts |
| P-I | Private-credit covenant monitoring is manual (~70% on spreadsheets; 45–60 day reporting lag) | covenants are off-chain | KILL — off-chain facts |
| P-J | OTC/escrow settlement failures and payment disputes | payment events | KILL — atomic settlement needs writability (unavailable) |
| P-K | BDC/private-credit NAV misstatement and delayed loss recognition | off-chain valuations | KILL — off-chain facts |
| P-L | Tokenized-securities KYC portability | registry events | KILL — already killed; standard maintainers shipping cross-chain ONCHAINID |

**DECISION — screening rule applied.** Any candidate whose decisive fact is off-chain, or that
requires proving absence, or that requires writability, was cut without further research. That
removed 6 of 12 immediately.

---

## 2. Finalist definitions

### P-A — Curator accountability *(new)*
**Problem.** DeFi lending split into a two-layer model: ERC-4626 vaults plus third-party
*curators* who choose which markets depositor money enters. The curators are now systemically
large, and their decisions are recorded on Ethereum but not in any neutral, permanent,
machine-consumable form.
**User.** Vault depositors and institutional allocators.
**Current intermediary trusted.** The curator itself, the host protocol's UI, and off-chain
graders/indexers.
**What goes wrong.** Stream Finance, 4 Nov 2025: $93M hole, xUSD −77%, **~$285M debt exposure**
across Morpho and Euler, ~$1B net DeFi outflows. Named exposures: **TelosC $123.64M**, Elixir
$68M, **MEV Capital $25.42M**, Varlamore and **Re7 Labs** tens of millions each. Root causes
included "no fund segregation, multi-signature controls, **on-chain verification**, or even
formal contracts."
**Required Ethereum fact.** `SetCurator` / `SetIsAllocator` (owner: *who is authorised*),
`SubmitCap` (curator: *the risk envelope*), `ReallocateSupply` (allocator: *execution*) — actor in
an indexed topic. *(Corrected 2026-08-17 — see `CORRECTION_ROLE_ATTRIBUTION.md`.)*
**Why 8–9 min is fine.** Reputation, not execution.

### P-B / P1′ — On-chain private-credit borrower performance
**Problem.** Real credit events exist in uncollateralised lending, unlike Aave. Maple absorbed
~$36M (Orthogonal, which *misrepresented its financial position*) plus Auros; TrueFi $4.4M.
Maple is now ~$2.1B TVL / ~$1.97B active loans.
**Required Ethereum fact.** `Impaired`, `LoanImpaired`, `Repossessed`, `PaymentMade`,
`BorrowerAccepted`.

### P-D — Restaking operator reputation
**Problem.** Operators secure many networks; slashing is now enforced on-chain (**33 events in
Q1 2026** on EigenLayer). EigenLayer and Symbiotic are separate ecosystems and, per our search,
**no cross-protocol slashing registry exists**.

### P-E — DAO grant milestone accountability
**Problem.** Milestone payouts released on unverified deliverables; clawback is rare.

---

## 3. Sources (all read 2026-08-17)

The Defiant (Goldfinch wind-down) · FSB *Vulnerabilities in Private Credit*, 6 May 2026 ·
Wikipedia *2025–2026 private credit crisis* · Quinn Emanuel client alert on private-credit
litigation · BlockEden / PANews / Tiger Research on the Stream Finance collapse ·
arXiv 2512.11976 *Institutionalizing risk curation in decentralized credit* · MixBytes on curator
risk · DIA DeFi Vaults Map · CuratorWatch · morpho-org/metamorpho `EventsLib.sol` ·
maple-labs loan contracts · EigenLayer/Symbiotic 2026 comparisons · CertiK Hack3D H1 2026.
