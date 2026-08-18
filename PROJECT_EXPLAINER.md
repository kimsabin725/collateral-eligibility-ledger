# PROJECT EXPLAINER — VaultAuthorityLedger

> For a reader who knows DeFi basics but has never seen Creditcoin, Attestcoin, or MetaMorpho, and
> has no access to the conversations that produced this project.
>
> This is **not** a build guide (see `docs/BUILD_SPEC.md` and `contracts/README.md` for that).
> It explains **what this is, why it is shaped this way, and exactly how much has been confirmed.**
>
> Every claim is tagged:
> **[FACT]** an external source says so · **[VERIFIED]** we executed it and observed the result ·
> **[INFERENCE]** our reasoning, not established · **[UNVERIFIED]** not checked yet.
>
> Snapshot: 2026-08-17.

---

## 1. This project in one sentence

**We build a permanent, independently verifiable record of who was given permission to move other
people's money inside a DeFi lending vault, and what they actually did with it afterwards.**

---

## 2. Why look at this problem

In modern DeFi lending, depositors do not choose which loans their money funds. They pick a
*vault*, and professional third parties decide where the money goes. Three separate questions
follow, and they are genuinely separate:

1. **Who holds permission** over the vault, and who granted it?
2. **Who actually moved the funds?**
3. **Can those two facts be tied together in the right time order** — i.e. was the person who moved
   the money actually authorised to, *at the moment they did it*?

Question 3 is the one nobody answers today, and it is the whole project.

**Why it matters — confirmed facts only.**

- **[FACT]** Independent academic analysis of on-chain data (arXiv 2512.11976; 1 Oct 2024 – 19 Nov
  2025; six lending systems, eight curators) concludes: *"Users cannot effectively evaluate curator
  strategies on a comparable basis because standardized disclosures are absent."* The same work
  reports heavy concentration — one curator held ≈27.6% of curated TVL (≈$2B).
- **[FACT]** The money at stake is real. Morpho held ≈$5.8B TVL in early 2026 across ~200 active
  vaults. **[VERIFIED]** one vault we examined directly, steakUSDC, held **75,212,830.24 USDC**.
- **[FACT]** Retail exposure is indirect but real: Coinbase routes some US customers' USDC into a
  Steakhouse-curated Morpho vault (Sept 2025).
- **[FACT]** When it goes wrong it is expensive. In the Stream Finance collapse (4 Nov 2025), a
  $93M hole and a 77% depeg of xUSD produced roughly **$285M of debt exposure** across Morpho and
  Euler, with named exposures including TelosC ($123.64M) and MEV Capital ($25.42M). Public
  post-mortems cite missing fund segregation, multisig controls, and on-chain verification.

**What we explicitly do NOT claim.** We do **not** claim this product would have prevented Stream
Finance, or any other incident. The named actors there were publicly identified within days by
journalists. Information availability was not obviously the binding constraint, and we have no
evidence that a verified record would have changed anyone's behaviour. We cite the incident only to
establish that authority over vault funds is economically significant — nothing more.

---

## 3. What you need to know about Morpho vaults first

A MetaMorpho vault (Morpho's curated-vault layer) splits control across three roles. **[VERIFIED
by reading `morpho-org/metamorpho` contract source]**:

| Role | Decides | Concretely |
|---|---|---|
| **Owner** | **who holds which role** | appoints/removes the curator and allocators |
| **Curator** | **the risk envelope** | which lending markets are eligible, and the maximum exposure (cap) to each |
| **Allocator** | **execution inside that envelope** | actually moves depositor funds between the already-approved markets |

A useful analogy: the **Owner** hires staff; the **Curator** writes the investment mandate; the
**Allocator** trades within the mandate.

The access rules, verbatim from the source:

```solidity
onlyCuratorRole()   : sender == curator || sender == owner
onlyAllocatorRole() : isAllocator[sender] || sender == curator || sender == owner
afterTimelock(v)    : time check ONLY — no role check at all
```

Two consequences that shape everything downstream:

- **`reallocate` is `onlyAllocatorRole`, which admits three different roles.** So observing a
  successful fund movement tells you *an address with some authority* acted. It does **not** tell
  you which role that address held.
- **`acceptCap` is permissionless** once its timelock elapses. So the `SetCap` event names whoever
  pushed the button, not the curator. The curator's actual decision is the earlier `SubmitCap`.

> **A correction, noted once and not dwelt on.** An earlier version of this project described
> `ReallocateSupply` as "the curator moving depositor funds" and treated `SetCap` as a curator
> decision. Both were wrong for the reasons above, and both were corrected against contract source
> before implementation. Details, if you want them: `ideation/CORRECTION_ROLE_ATTRIBUTION.md`.

---

## 4. What you can already find out today

This project does **not** claim the data is hidden or missing. It is all public on Ethereum. Today
you can:

- **Etherscan / an RPC node** — read individual transactions and event logs, one at a time.
- **Indexers (Dune, subgraphs)** — query aggregated history with SQL or GraphQL.
- **[FACT] CuratorWatch** — grades 377 actively managed vaults against a 10-requirement checklist.
- **[FACT] DIA Vaults Map** — compares 3,700+ vaults across 80+ chains.
- **The host protocol's own UI** and curators' self-published risk reports.

**For a human wanting to research a curator, these are better tools than what we are building, and
we say so plainly.** They have far broader coverage.

What they share is a structural property: each one is **a report produced by an operator you have
to trust** to be honest, complete, and online. None can be read by a smart contract. And an
operator can revise a record, or simply stop existing — **[VERIFIED]** Spectral raised roughly $30M
for on-chain credit scoring and pivoted entirely to AI agents; `spectral.finance` now returns HTTP
404, and ARCx is offline.

---

## 5. What we add

Not a dashboard. A **verified attribution**, built by composing two independent proofs.

The insight: a single event is ambiguous, because `onlyAllocatorRole` admits three roles. Two
events, proven separately and checked for time order, are not.

```
   Ethereum (source of truth)
   ─────────────────────────────────────────────────────────────
   [1] Owner calls setIsAllocator(A, true)  on Vault V
           → event: SetIsAllocator(A, true)          @ block 22,194,870
                                                           │
   [2] A calls reallocate(...)              on Vault V      │
           → event: ReallocateSupply(A, market, amount) @ block 25,772,893
                                                           │
   ───────────────────────────────────────────────────────  │
                        prove each one separately           │
                                  │                         │
   Attestcoin  ── proof #1 ───────┤                         │
               ── proof #2 ───────┘                         │
                                  ▼
   Creditcoin  ── check: same actor A?          ✓
               ── check: same vault V?          ✓
               ── check: block[1] < block[2]?   ✓
                                  ▼
        "A, granted allocator authority on V at block 22,194,870,
         moved V's depositor funds into that market at block 25,772,893."
```

**If proof #1 is absent, the record is written with role `UNKNOWN`.** The system never guesses a
role. That refusal is a feature, not a gap: it is the difference between a fact and an assumption.

---

## 6. Why Attestcoin

Attestcoin is Creditcoin's cross-chain verification layer (formerly called Universal Smart
Contracts / USC). It lets a smart contract *on Creditcoin* check a claim about a transaction that
happened *on Ethereum*, cryptographically, rather than being told about it.

**What it proves** — **[VERIFIED]** by us against real mainnet transactions:

| Fact | How |
|---|---|
| The transaction was included in a real Ethereum block | Merkle inclusion proof |
| That block belongs to the canonical, attested chain | block-continuity proof |
| Which contract emitted a log | the log's emitter address, decoded from the verified bytes |
| Which event it was, and its arguments | event signature (`topics[0]`) and topic/data fields |
| Whether the transaction succeeded | the receipt `status` field |

**The difference from an API.** An indexer or RPC endpoint *asserts* that something happened; you
trust the responder. An Attestcoin proof is *self-validating*: the Creditcoin runtime checks the
maths, so a wrong or tampered proof simply fails. **[VERIFIED]** we mutated one byte of a
continuity proof and the chain rejected it with
`"Continuity proof does not match attestation or checkpoint"`.

A useful side effect: because the proof is what is trusted rather than the submitter, **anyone can
submit a record**, including someone the subject would rather not hear from.

**What Attestcoin cannot prove — equally important:**

- **Transaction success is not checked by the verifier.** **[FACT]** the official docs state the
  precompile *"does not validate if a transaction was successful"* and that a dApp **MUST** check
  the status field itself. Our contract does.
- **The absence of an event.** There is no way to prove "nothing else happened". This is permanent
  and it bounds the whole product.
- **Current state or balances.** Only that specific transactions occurred.
- **Anything off-chain** — a firm's identity, an audit, a bank balance, a valuation.
- **Whether an action was wise.** That is judgement, not proof.

There is also a practical constraint: **[VERIFIED]** attestation lags the source chain by roughly
**8–9 minutes** on both Ethereum mainnet and Sepolia. Fine for an audit trail; useless for anything
real-time. We claim no real-time capability.

---

## 7. Why Creditcoin

The honest answer, split into two parts that should not be blended.

**The architectural argument (what we do claim):**

- The record evaluates Morpho, Euler, and the role-holders themselves. It is cleaner for it not to
  live under the governance of any party being evaluated.
- It is meant to span protocols and ecosystems, rather than being parochial to one protocol's home
  chain.
- Attestcoin is Creditcoin's native verification path, so Creditcoin is where a contract can consume
  these proofs and hold the resulting **independent, composed, append-only audit state** — a policy
  layer separated from the source chain.

**The limits of that argument (stated, not hidden):**

- **[INFERENCE]** This is an architectural preference, **not a technical necessity**. A neutral
  contract on Ethereum, fed by an Ethereum-native historical-proof system, could do a comparable
  job. **[VERIFIED]** two such systems (Axiom, Herodotus) are alive and actively developed.
- **Adoption risk is real and separate.** **[VERIFIED]** Creditcoin mainnet recorded 12,268,150
  lifetime transactions but only **190 transactions on 2026-08-17**, at 0.022% network utilisation,
  and it does not appear in DeFiLlama's 461-chain list. There is no live DeFi ecosystem there today.

**We do not claim** that Creditcoin has a large existing user base for this, or that only Creditcoin
can solve this problem. The technical fit and the adoption risk are two different statements, and
both are true at once.

---

## 8. What has actually been verified, with real data

Everything below was executed read-only against live systems — no wallet, no gas, no deployment.

**The vault** — **[VERIFIED]** via `eth_call` and bytecode inspection:
steakUSDC, `0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB`, a MetaMorpho **Vault V1 (v1.1 line)**
holding 75,212,830.24 USDC, with a 7-day timelock. Its `owner`, `curator`, and `guardian` are three
distinct addresses, and notably `isAllocator(curator)` is **false** — in this vault the roles really
are separated.

**The actor.** The address that moved funds, `0x9e9110cf…f9e1`, is an **allocator** — not the
curator, owner, or guardian. We did not infer this from current state; we proved the historical
grant (below).

**The two transactions:**

| | Transaction | Block | What it means |
|---|---|---|---|
| **Authority** | `0x52ced076…06fd` | 22,194,870 | The owner granted `0x9e9110cf…f9e1` allocator permission on this vault (`SetIsAllocator(…, true)`) |
| **Action** | `0x35a2f50f…e8f0` | 25,772,893 | That same address moved depositor funds into three markets (3 × `ReallocateSupply`) |

**The result** — **[VERIFIED]**:

- Both transactions passed Attestcoin verification on Creditcoin: `verify() → TRUE`.
- Both had receipt `status == 1` (genuinely successful, not merely included).
- Creditcoin's decoder extracted **the same actor address** from both, and the vault matched.
- The order is correct: the grant precedes the action by **3,578,023 blocks — about 497 days**.

So the sentence in §5 is not a design sketch. It is a checked statement about real money on
Ethereum mainnet.

**Two supporting observations.** **[VERIFIED]** A separate real transaction
(`0x0c540598…eb181`, block 25,773,900) contained eight `SetIsAllocator` logs — one allocator
appointed and another revoked across four vaults at once — showing that revocations are also
observable events. And allocator activity is frequent: **344** `ReallocateSupply` events in about
seven days on steakUSDC alone.

---

## 9. What we have actually built

### COMPLETED — **[VERIFIED]** by running it

- **Proof client** — fetches Attestcoin proofs from the hosted Proof Builder and waits for
  attestation.
- **Read-only verification suite** — six scripts covering proof verification, a tampered-proof
  negative control, transaction/log decoding cross-checked against Ethereum's own RPC, supported-
  chain queries, and the authority→action composition above.
- **Decoder** — the official `EvmV1Decoder` vendored and compiled. We deploy our own copy because
  **[VERIFIED]** the decoder listed on the official environments page is an older build missing a
  log-filtering helper.
- **`VaultAuthorityLedger` contract** — five mandatory checks (replay protection, proof
  verification, transaction-success, event signature, emitter allowlist), then decode and append.
- **Authority→action composition** — role attributed only from a proven grant at a strictly earlier
  block; otherwise `UNKNOWN`.
- **Real-data tests — 8/8 passing.** Live Attestcoin proofs for the two real mainnet transactions,
  run through the *real* decoder on a local EVM; all three real actions attributed `ALLOCATOR`.
- **Negative tests — part of 15/15 passing.** Invalid proof, replayed proof, non-allowlisted source
  contract, wrong event, failed source transaction, missing grant, and a grant dated *after* the
  action (no back-dating) all handled correctly.
- **A real bug, found by real data and fixed.** The contract originally rejected any transaction
  containing a log from a non-allowlisted contract. Real transactions are batched — the actual
  authority grant spans several vaults, and one action transaction carried 48 logs — so this made
  genuine data unusable. Foreign logs are now skipped rather than fatal; they are still never
  recorded.

### NOT YET COMPLETED

- **Deployment to Creditcoin CC3 Testnet** — nothing has been deployed to any network.
- **Ingesting the real transactions on CC3** — proven locally, never executed on-chain.
- **A frontend** — not started.
- **Final README, deck, and demo video** — not done.

### The current external blocker

**[VERIFIED]** CC3 testnet tokens are obtainable only through a Discord bot: join the Creditcoin
Discord and post `/faucet address:<…>` in `#token-faucet`. No API, CLI, or web faucet is documented.
This requires a human, so deployment is blocked on that one manual step. The deploy script detects a
zero balance and stops with these instructions.

---

## 10. What this product never claims

This list is load-bearing. Overstating any of it would make the project dishonest.

- ❌ **Not a complete history.** Absence is unprovable. The record contains *proven actions*, never
  *all actions*.
- ❌ **Not proof that nothing bad happened.** An empty adverse record means nothing was submitted,
  not that nothing occurred.
- ❌ **Not a claim that an actor is currently authorised.** We prove a grant at a block. We cannot
  prove it was never revoked afterwards.
- ❌ **No real-world identity.** We record addresses. We do not establish which firm or person
  controls one.
- ❌ **No evaluation of whether an allocation was good.** Facts only; judgement stays with the
  reader.
- ❌ **Not a credit score, rating, or ranking.**
- ❌ **Discovery is not trustless.** Verification is. Finding *which* transactions to submit still
  requires scanning logs with an indexer — **[VERIFIED]** we located the 497-day-old grant using a
  third-party indexer's full-history API, because public RPC nodes prune old state.
- ❌ **No claim that this prevents incidents** like Stream Finance, or changes anyone's behaviour.
- ❌ **No claim that the underlying data is otherwise unavailable.** It is public (see §4).

---

## 11. What using it looks like

**For a person (the intended near-term use).** You are considering a vault, or reviewing one you
already hold. You look up the vault and see, in time order:

- which addresses were granted allocator permission, when, and by whom — including permissions that
  were later revoked;
- what those addresses subsequently did: which markets they moved funds into, when, how much;
- for each entry, whether it is backed by a verified proof, and which role — if any — could be
  attributed;
- a link to the original Ethereum transaction, so you can re-verify it yourself rather than trust
  the display.

The distinguishing property is not that the information is new. It is that the record is
append-only, attributed, checkable by you independently, and not maintained by anyone with a stake
in how it reads.

**For a smart contract (a hypothesis, not a validated need).** **[INFERENCE / UNVERIFIED]** Because
the record lives on-chain as verified state rather than in a database, another contract could in
principle read it and enforce a policy — for example, an allocation mandate that refuses vaults
whose role-holders have a particular proven history. We have designed for this possibility, but
**we have found no evidence that any allocator actually wants machine-enforced policy of this
kind.** It remains the softest part of the thesis and is labelled as such throughout.

---

## 12. Biggest limitations and open questions

| # | Issue | Status |
|---|---|---|
| 1 | **Completeness.** Only submitted events exist in the record; absence is unprovable | **Unsolved — structural.** Mitigated by permissionless submission (anyone can add adverse evidence), which is not the same as completeness |
| 2 | **Non-revocation.** We prove a grant at a block, not that it survived to the action | **Unsolved.** Revocations are themselves provable events and can be submitted; their non-existence cannot |
| 3 | **Role exclusivity.** The actor's authority at action time could in principle have come from curator/owner status rather than the allocator grant | **Unsolved.** The grant is a sufficient and parsimonious explanation, not an exclusive one |
| 4 | **Discovery is not trustless.** Finding candidate transactions needs an indexer | **Unsolved — declared** |
| 5 | **Address rotation.** An actor can simply use a fresh address | **Unsolved.** Weakly mitigated only because these are commercial brands, for whom a blank record has its own cost |
| 6 | **Is Creditcoin economically necessary?** | **[INFERENCE] only.** An Ethereum-native design could plausibly compete (§7) |
| 7 | **Does anyone want machine-enforced policy?** | **[UNVERIFIED].** No evidence found either way. The single most important open question |
| 8 | **Creditcoin adoption** — 190 transactions/day | Real production risk, accepted deliberately, not disguised |
| 9 | **Curator-policy leg.** `SubmitCap` (the actual curator decision) has no sample yet | **[UNVERIFIED].** Optional scope; the authority→action leg does not depend on it |

---

## 13. Why this fits the hackathon

BUIDL CTC 2026 Fall requires, **[FACT]** verbatim, a *"meaningful and functional integration"* with
the Attestcoin Protocol, deployment on a testnet, and original work created during the event; and it
states that *"depth of Attestcoin Protocol utilization will be evaluated as one of the core scoring
criteria."*

This project uses the intended shape — **Ethereum source data → Attestcoin verification →
Creditcoin application logic** — where verification is genuinely load-bearing rather than
decorative: without it, the record would have to trust whoever supplied the data, which is the exact
weakness being addressed. The depth comes from needing *composed* proofs, since one proof cannot
establish a role.

**[VERIFIED]** Using events from third-party contracts we did not deploy is permitted; no official
requirement mandates deploying your own source-chain contract, though the docs do recommend a single
self-deployed source contract as a best practice, and we deviate from that deliberately.

We make no claim about winning, and no claim beyond what the published rules actually say.

---

## 14. The whole project in one picture

```
┌─ ETHEREUM MAINNET ─────────────────────────────────────────────────────────┐
│                                                                            │
│   Owner ──── setIsAllocator(A, true) ────►  MetaMorpho Vault V             │
│                                              emits SetIsAllocator  [AUTHORITY]
│                                                                            │
│   Curator ── submitCap(market, cap) ─────►  (sets the risk envelope)       │
│                                                                            │
│   Allocator A ── reallocate(...) ────────►  emits ReallocateSupply  [ACTION]│
└──────────────────────────────┬─────────────────────────────────────────────┘
                               │  two independent transactions
                               ▼
┌─ ATTESTCOIN ───────────────────────────────────────────────────────────────┐
│   attestors commit source-chain state  →  Merkle inclusion + continuity    │
│   proofs   (≈8–9 min lag; verifier does NOT check tx success)              │
└──────────────────────────────┬─────────────────────────────────────────────┘
                               ▼
┌─ CREDITCOIN (CC3) ─────────────────────────────────────────────────────────┐
│   BlockProver precompile  →  verify proof                                  │
│   EvmV1Decoder            →  receipt status, emitter, topics, data         │
│   VaultAuthorityLedger    →  5 checks, then:                               │
│        • same actor?  • same vault?  • grant block < action block?         │
│        • yes → role ALLOCATOR      • no → role UNKNOWN                    │
└──────────────────────────────┬─────────────────────────────────────────────┘
                               ▼
              Append-only, attributed, independently re-checkable
                            AUDIT TRAIL
                               │
              ┌────────────────┴─────────────────┐
              ▼                                  ▼
     human-readable profile            contract-consumable state
        (near-term use)                  ([INFERENCE] — hypothesis)
```

---

## 15. The 60-second explanation

> In DeFi lending, depositors don't pick loans — they pick a vault, and professional third parties
> move the money. Three separate people matter: an **owner** who hands out permissions, a
> **curator** who sets what's allowed, and an **allocator** who actually moves funds. The catch is
> that the contract function for moving funds accepts all three roles, so seeing a fund movement
> on-chain tells you *someone with authority* acted — not who, and not under what permission.
>
> We fix that by proving **two** events instead of one: the moment permission was granted, and the
> later moment it was used. Attestcoin verifies both Ethereum transactions cryptographically — not
> an API telling us they happened, but a proof a Creditcoin contract checks itself — and our
> contract confirms it's the same address, the same vault, and that the grant came first. Then it
> writes a permanent, attributed record. If the permission grant is missing, it records the role as
> **UNKNOWN** rather than guessing.
>
> We've verified this on real money: a real allocator on a $75M Morpho vault, granted permission in
> block 22,194,870 and moving funds 497 days later in block 25,772,893 — both proofs verified on
> Creditcoin, same actor extracted from both.
>
> What it is **not**: a complete history, a rating, or proof anyone did anything wrong. Absence
> can't be proven, so it's *proven actions* — never *all actions*. The contract is written and
> tested; the remaining step is deploying to Creditcoin's testnet, which is waiting on a manual
> Discord faucet.

---

**Where to go next:** `docs/BUILD_SPEC.md` (frozen scope and claims) ·
`docs/CODEX_HANDOFF.md` (status and how to run) · `contracts/README.md` (build and test) ·
`spike/FINDINGS.md` (measured capability limits).
