# Collateral Eligibility Ledger

**An asset can stop being usable as collateral before its price moves. On-chain credit only has
the price axis. This proves the other one, across chains.**

Built for **BUIDL CTC 2026 Fall** — RWA / DeFi track. Deployed and running on **CC3 Testnet**.

When an issuer pauses an instrument, the asset is immediately ineligible as collateral even though
its oracle price has not moved yet. The lending markets holding that asset are usually unrelated
third parties, and increasingly they sit on a *different chain* from the contract the issuer
controls. Today their only paths are subscribing to the same monitoring vendor or reacting by hand.
There is no path where the destination contract **verifies the event itself**.

This ledger is that path: an Attestcoin proof of the source-chain event is verified on Creditcoin,
flips the asset's eligibility, and gates **new** credit against it — while never blocking the exit.

---

## Live on CC3 Testnet

| Contract | Address |
|---|---|
| `EligibilityLedger` | [`0xA47a20079112252afAF2d54fF1FF0268bE3826a4`](https://creditcoin3-testnet.subscan.io/account/0xA47a20079112252afAF2d54fF1FF0268bE3826a4) |
| `GatedCreditLine` | [`0x0D35A7Bd0dcBBebAb54861bCe9CD04Da790B32eb`](https://creditcoin3-testnet.subscan.io/account/0x0D35A7Bd0dcBBebAb54861bCe9CD04Da790B32eb) |
| `EvmV1Decoder` (our own build) | [`0xd735522d27cF22E443F48a3a3A3Dd2de8f24F008`](https://creditcoin3-testnet.subscan.io/account/0xd735522d27cF22E443F48a3a3A3Dd2de8f24F008) |
| BlockProver precompile | `0x0000000000000000000000000000000000000FD2` |

**The proof-admitting transaction:**
[`0xbf8bda4f…c68da4df`](https://creditcoin3-testnet.subscan.io/tx/0xbf8bda4f6595a1c61043f3897e35056fc0fbc5d9952d3abe8166d7bec68da4df)
— 346,458 gas. Chain id `102031`. Full record in [`contracts/deployment.json`](contracts/deployment.json).

---

## The event we actually ingested

Not a mock. A real Ethereum mainnet impairment, proven on Creditcoin:

```
asset    sNUSD (Staked NUSD, Neutrl)   0x08efcc2f3e61185d0ea7f8830b3fec9bfa2ee313
event    Paused(address)
block    25,745,732      2026-08-13 11:14:59 UTC      receiptStatus = 1
tx       0xc25678129b98d6cb082472cc38b3e9908a81829e5826325c71d62318cb2f9c9a
```

At that moment, contracts holding sNUSD included a Pendle Standardized-Yield wrapper
(8,202,400 sNUSD), the Morpho Blue singleton (1,828,755), and a Uniswap V4 PoolManager. Neutrl
halted NUSD issuance and redemption; the downstream protocol Strata paused its own products
**separately and by its own decision** — the event did not propagate on its own. That gap is the
problem this repo addresses.

> **Scope note, stated honestly:** the sNUSD incident itself was not cross-chain — issuer, wrapper
> and lending market were all on Ethereum. It is evidence that *this class of event is real and
> current*, not that the cross-chain topology is real. The cross-chain evidence is separate and
> independent: USDe is controlled on Ethereum and lent against on Robinhood Chain via a LayerZero
> OFT, where Morpho carried **$285,532,168 collateral / $251,647,632 borrowed at 92% LLTV**;
> syrupUSDG shows the same split with Maple's pool on Ethereum; Centrifuge's JAAA/JTRSY encode an
> Ethereum hub with Avalanche and Base spokes. See
> [`CROSS_CHAIN_COLLATERAL_ELIGIBILITY_PROJECT_STATE.md`](CROSS_CHAIN_COLLATERAL_ELIGIBILITY_PROJECT_STATE.md) §9–10.

---

## How Attestcoin is used

Attestcoin is not decoration here — **the business logic cannot run without it.** The ledger has no
oracle, no owner-write path, and no way to set an asset impaired other than submitting a proof.

```
Ethereum mainnet                Attestcoin                      Creditcoin CC3
────────────────                ──────────                      ──────────────
sNUSD.Paused()      ──proof──▶  Proof Builder API      ──────▶  EligibilityLedger.submitEvent()
@ block 25,745,732              (Merkle inclusion +               │ 1. replay guard (by position)
                                 block continuity)                │ 2. BlockProver 0x…0FD2  ◀── runtime
                                                                  │ 3. receiptStatus == 1
                                                                  │ 4. event signature match
                                                                  │ 5. emitter allowlist
                                                                  ▼
                                                        status: NO_PROOF → IMPAIRED
                                                                  │
                                                                  ▼
                                                        GatedCreditLine.openPosition()
                                                                  → revert AssetImpaired
```

The precompile verifies inclusion and continuity but **does not check whether the source
transaction succeeded** — so check 3 is ours. Checks 4–5 *skip* non-matching logs instead of
reverting, because real source transactions are batched (one live allocation transaction we
ingested during the spike carried 48 logs). A transaction yielding no allowlisted, signature-matching
log reverts with `NoMatchingEvent` and writes nothing.

Because Attestcoin is **inbound-only** — CC3 can verify foreign transactions but cannot write back
to them — the credit venue itself must live on CC3. That constraint shaped the whole architecture
rather than being worked around.

---

## Reproduce it

```bash
cd contracts
npm install
node scripts/compile.js            # npm solc — no system toolchain needed

node test/eligibility.test.js      # 27/27  application logic, local EVM
node test/ledger.test.js           # 15/15  v1 regression (proof plumbing)
node test/realdata-eligibility.test.js   # 10/10  REAL mainnet proof + REAL decoder
node test/realdata.test.js         #  8/8   REAL proofs, two more mainnet transactions
```

**60/60.** Only the BlockProver precompile is mocked locally — it is a Creditcoin runtime component
that cannot exist on a local EVM, and it is exercised for real by the two scripts below.

Against the live chain (needs a funded deployer — see [`contracts/README.md`](contracts/README.md)):

```bash
node scripts/deploy-eligibility.js   # deploy + fetch a real proof + ingest + show the gate refuse
node scripts/demo-rejections.js      # read-only: four forgeries rejected on-chain
```

`demo-rejections.js` runs entirely as `eth_call` against the deployed contracts, so it cannot write,
and it reads the ledger back afterwards to show the state never moved:

| Case | Rejected by | Result |
|---|---|---|
| A. replay of the admitted proof | ledger | `QueryAlreadyProcessed` |
| B. valid proof, emitter not allowlisted | ledger | `NoMatchingEvent` |
| C. Merkle root corrupted by one bit | **precompile `0x…0FD2`** | `Merkle proof validation failed` |
| D. mainnet proof re-labelled as Sepolia | **precompile `0x…0FD2`** | `Continuity proof does not match attestation or checkpoint` |

C and D never reach application code at all — the Creditcoin runtime refuses them first.

---

## Two design rules worth arguing about

**Gate new risk, never trap existing users.** Once an asset is proven impaired, `repay` and
`withdrawCollateral` stay open forever. Only `openPosition`, `borrowMore` and `addCollateral` are
refused. A risk control that also blocks the exit is not a control, it is a hostage situation. Both
properties are pinned by tests.

**Earliest proven impairment wins.** If several impairment proofs arrive, the ledger keeps the
*earliest* proven source block as the cutoff; a later proof can never push it forward. Credit
extended after the real impairment does not become sound merely because the proof arrived late.
Ignored events are still recorded (`EventIgnored`) rather than silently dropped. Restoration only
counts if an impairment was proven first and the restoration is strictly later.

---

## What this does not claim

- **Not real-time protection.** Measured attestation lag is 8–9 minutes. This is *delayed but
  verifiable gating of new credit*. Hypernative binds detection to pre-approved on-chain actions and
  responds in seconds — on speed, we lose.
- **`NO_PROOF` is not a clean bill of health.** Absence is unprovable. It means only that nothing
  has been proven here yet.
- **Not "nobody solved this."** Aave's Protocol Guardian and Risk Steward paused rsETH across five
  networks simultaneously in April 2026; Chaos Labs' Edge Risk Oracle already injects parameters
  automatically; Hypernative was Neutrl's own pauser. What remains unaddressed is narrower and
  specific: the trigger in those systems is a human or a market-risk metric, and the destination
  **trusts a vendor** rather than verifying. This repo is one primitive for that gap.
- **Not a control over existing Morpho markets.** Morpho Blue's core has no pause primitive —
  `pause`/`freeze`/`emergency`/`blacklist` return zero matches in `Morpho.sol` (22,047 bytes), and
  `onlyOwner` covers only five parameter setters. This PoC applies eligibility logic to a credit
  venue on CC3; it does not reach into markets on other chains.
- **Discovery is not trustless.** Deciding *which* transaction to submit still requires log
  scanning off-chain. Verification is trustless; discovery is not.
- **Mock tokens.** The ERC-20s deployed by the demo script are mocks. The *event* is real; the
  lending market is a PoC venue.

Full limitation list and the prior-art assessment: [`CROSS_CHAIN_COLLATERAL_ELIGIBILITY_PROJECT_STATE.md`](CROSS_CHAIN_COLLATERAL_ELIGIBILITY_PROJECT_STATE.md) §12, §15.

---

## Repository map

| Path | What is in it |
|---|---|
| `contracts/src/EligibilityLedger.sol` | The ledger — five checks, earliest-impairment cutoff, restoration ordering (7,431 bytes) |
| `contracts/src/GatedCreditLine.sol` | The credit venue that reads the ledger; exits never gated (5,007 bytes) |
| `contracts/src/vendor/EvmV1Decoder.sol` | Vendored from `@gluwa/usc-contracts@0.1.2`; we deploy our own because the officially listed decoder is an older build missing `getLogsByEventSignature` |
| `contracts/scripts/deploy-eligibility.js` | One command: deploy → configure → fetch real proof → ingest → show the gate refuse |
| `contracts/scripts/demo-rejections.js` | The negative demo, read-only, against the live deployment |
| `spike/` | Attestcoin integration spike — proof client, precompile probes, three real mainnet transactions proven end-to-end |
| `docs/SUBMISSION.md` | Submission package — description, Attestcoin summary, demo-video shot list |
| `docs/deck.html` / `docs/deck.pdf` | The 8-slide deck (print the HTML to re-export the PDF) |
| `docs/transcripts/` | Verbatim output of the live CC3 deploy and the rejection demo |
| `docs/BUILD_SPEC_V2.md` | Frozen scope and claims |
| `docs/CURRENT_STATE.md` | Always-current status file |
| `CROSS_CHAIN_COLLATERAL_ELIGIBILITY_PROJECT_STATE.md` | Full research trail: problem search, killed candidates, prior art, evidence, design rationale |
| `ideation/` | The candidate funnel — 18 candidates, 13 eliminated, and why |

The build requires `viaIR: true` (the flattened 7-parameter proof entry point overflows legacy
codegen's stack) and `evmVersion: 'paris'` (avoids `PUSH0`/`MCOPY` so identical bytecode runs on the
local test VM and on CC3).

---

## Prior work in this repo

An earlier build, `VaultAuthorityLedger`, composed two proofs to attribute a MetaMorpho
`reallocate` to a specific granted role. It works and its 15/15 + 8/8 tests still pass — it is kept
as the proof-plumbing regression. It was retired as the headline idea because Morpho V2's role
separation dissolves the problem it addressed: a problem that disappears when one protocol ships one
feature is not the right problem to build on. That reasoning is recorded in
[`ideation/`](ideation/) rather than hidden.

---

## License

MIT.
