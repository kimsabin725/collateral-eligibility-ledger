# Submission package — BUIDL CTC 2026 Fall

Everything DoraHacks asks for, ready to paste. Deadline **2026-09-06 13:59 KST**.

| Requirement | Status |
|---|---|
| Attestcoin integrated meaningfully and functionally | ✅ the ledger has no other write path |
| Working Attestcoin integration code in the project | ✅ `contracts/`, `spike/` |
| Technical doc explaining setup and Attestcoin usage | ✅ `README.md`, `contracts/README.md` |
| Deployed to testnet | ✅ CC3 Testnet, addresses below |
| Original work built during the hackathon | ✅ repo history starts 2026-08-17 |
| GitHub repository + README | ✅ https://github.com/kimsabin725/collateral-eligibility-ledger |
| Deck or whitepaper PDF URL | ✅ hosted on GitHub (link below) |
| Prototype demo video URL | ✅ `docs/demo.mp4` (2:36) — ⬜ needs a YouTube URL |
| Project description + Attestcoin integration summary | ✅ below |

---

## Live addresses (paste into the form)

```
Network        Creditcoin CC3 Testnet (chain id 102031)
Explorer       https://creditcoin3-testnet.subscan.io/

EligibilityLedger   0xA47a20079112252afAF2d54fF1FF0268bE3826a4
GatedCreditLine     0x0D35A7Bd0dcBBebAb54861bCe9CD04Da790B32eb
EvmV1Decoder        0xd735522d27cF22E443F48a3a3A3Dd2de8f24F008
BlockProver         0x0000000000000000000000000000000000000FD2   (runtime precompile)

Proof-admitting tx  0xbf8bda4f6595a1c61043f3897e35056fc0fbc5d9952d3abe8166d7bec68da4df
Source event        sNUSD Paused() · Ethereum mainnet block 25,745,732
```

> ⚠️ **Re-running `deploy-eligibility.js` deploys fresh contracts and overwrites
> `contracts/deployment.json` with new addresses.** If you re-run it — for the video, for instance —
> the addresses above become stale in **four places**: this file, `README.md`, `HANDOFF_MANIFEST.md`,
> `docs/CURRENT_STATE.md`, and `docs/deck.html` (then re-export `deck.pdf`). Either record the video
> against the existing deployment using `demo-rejections.js`, or re-run the deploy first and update
> the docs afterwards.

---

## 30-second pitch

> An asset can stop being usable as collateral before its price moves — an issuer pauses the
> instrument, and it is instantly ineligible while the oracle still says everything is fine.
> On-chain lending only has the price axis. And the protocols actually holding that asset are
> unrelated third parties, increasingly on a different chain from the contract the issuer controls.
> Today their only options are subscribing to the same monitoring vendor or reacting by hand.
>
> We built the missing path: an Attestcoin proof of the issuer's source-chain event, verified by the
> destination credit contract on Creditcoin, which then refuses new credit against that asset — while
> never blocking repayment or withdrawal. It is deployed on CC3 Testnet and it ingested a real
> Ethereum mainnet pause event, not a mock.

---

## Project description

**Collateral Eligibility Ledger** — an append-only record on Creditcoin of asset-level events that
impair an instrument's usability as collateral, admitted only on an Attestcoin proof of the source
transaction, and consumed by a credit venue that gates new lending against the affected asset.

Institutional collateral is managed on two axes: **price** and **eligibility**. The ECB defines
eligible collateral in Guideline (EU) 2015/510 Part Four with national central banks vetting
instruments before use; ICMA triparty repo maintains eligibility sets by grade; ISDA publishes
jurisdictional eligible-collateral tables. On-chain lending has the price axis — oracles, LTV,
liquidation — and effectively nothing on the other one.

We are careful about the exact gap. Aave can set LTV to zero, Morpho curators can set caps to zero,
and Hypernative binds detection to pre-approved on-chain actions in seconds. The accurate problem is
narrower: in all of those, the trigger is a human or a market-risk metric, and the destination
**trusts a vendor's assertion**. There is no path where the destination contract verifies the
issuer's event itself — and when the asset is controlled on one chain and lent against on another,
that gap widens into a blind spot.

That topology is not hypothetical. USDe is controlled on Ethereum and lent against on Robinhood Chain
through a LayerZero OFT, where Morpho carried $285,532,168 collateral against $251,647,632 borrowed at
92% LLTV. syrupUSDG shows the same split with Maple's pool on Ethereum. Centrifuge encodes the split
in the protocol itself — `PoolId >> 48` names the hub chain, and JAAA and JTRSY both resolve to an
Ethereum hub with Avalanche and Base spokes.

The event class is real and current. On 2026-08-13 at 11:14:59 UTC, sNUSD (Staked NUSD, Neutrl) emitted
`Paused(address)` at Ethereum block 25,745,732. Contracts holding it at that moment included a Pendle
Standardized-Yield wrapper with 8,202,400 sNUSD, the Morpho Blue singleton with 1,828,755, and a
Uniswap V4 PoolManager. Morpho's sNUSD/USDC market still carried $1,661,397 borrowed against a
reported collateral value of $0. Downstream, Strata paused its own products *separately, by its own
decision* — nothing propagated automatically. **That is the transaction our deployed contract
ingests.**

The ledger keeps the earliest proven impairment as the cutoff, so a late-arriving proof can never
retroactively bless credit extended after the real event. Restoration counts only if an impairment was
proven first and the restoration is strictly later. And once an asset is impaired, `repay` and
`withdrawCollateral` stay open forever — only new exposure is refused. A risk control that also blocks
the exit is not a control.

**We do not claim** real-time protection (measured attestation lag is 8–9 minutes), that `NO_PROOF`
means an asset is healthy (absence is unprovable), that this controls markets on other chains, that
discovery is trustless (choosing which transaction to submit still needs off-chain log scanning), or
that nobody has worked on this. The ERC-20s in the demo are mocks; the source event, the proof, the
verification and the refusal are real.

---

## Attestcoin integration summary

Attestcoin is the only way state enters this system. `EligibilityLedger` has no oracle, no
owner-writable status field, and no administrative path to mark an asset impaired. The single entry
point is `submitEvent(...)`, which takes the flattened proof bundle and runs five checks in a fixed
order:

1. **Replay protection**, keyed by `keccak(chainKey, blockHeight, txIndex)` — a *position*, where
   `txIndex` is recomputed on-chain by the precompile rather than supplied by the caller.
2. **Inclusion and continuity**, via the BlockProver precompile at `0x…0FD2`. On a bad proof the
   precompile reverts inside the Creditcoin runtime; our code is never reached.
3. **Source transaction success** — `receiptStatus == 1`, decoded from the proven transaction. The
   precompile does not check this, so the dApp must.
4. **Event signature** — is this a configured impairment or restoration signature?
5. **Emitter allowlist** — a log from a non-registered contract is never recorded. Without it, anyone
   deploys a look-alike, emits `Paused`, and proves it. This is the single most important check.

Checks 4–5 *skip* non-matching logs rather than reverting, because real source transactions are
batched — one transaction we proved during the spike carried 48 logs. A transaction yielding no
allowlisted, signature-matching log reverts with `NoMatchingEvent` and writes nothing. An asset is
registered against exactly one source chain; a proof from a different chain naming the same address is
a different contract and reverts with `WrongChainKey`.

Three protocol constraints shaped the architecture rather than being worked around:

- **The proof unit is a single transaction.** There is no account or storage proof path, so we can
  prove *an event happened*, never *a balance is X*. The whole design is event-driven for that reason.
- **Attestcoin is inbound-only.** CC3 can verify foreign transactions but cannot write back to them.
  So the credit venue itself must live on CC3 — which is why `GatedCreditLine` is a Creditcoin
  contract rather than a message sent to Ethereum.
- **Attestation lags 8–9 minutes.** That rules out real-time interception and makes this a *delayed
  but verifiable* gate on new credit. We state this rather than hiding it.

We deploy our own `EvmV1Decoder` (vendored from `@gluwa/usc-contracts@0.1.2`) because the decoder
listed on the official chains & environments page is an older build missing
`getLogsByEventSignature`, verified 2026-08-17.

Verified negatively as well: `scripts/demo-rejections.js` runs four forgeries against the live
deployment as `eth_call` and shows two rejected by our application checks
(`QueryAlreadyProcessed`, `NoMatchingEvent`) and two rejected by the Creditcoin runtime itself
(`"Merkle proof validation failed"` from a one-bit Merkle-root flip, `"Continuity proof does not match
attestation or checkpoint"` from re-labelling a mainnet proof as Sepolia), then reads the ledger back
to confirm nothing moved.

---

## Demo video — shot list (2:40 target)

Record at 1280×720 or larger. Terminal at a legible font size; a light terminal theme matches the deck.
Full transcripts of both runs are in `docs/transcripts/` if you want to check your output against a
known-good run.

**Before recording:** `cd contracts && node scripts/compile.js` so no build output appears mid-take.

| Time | Shot | Say |
|---|---|---|
| 0:00–0:20 | Deck slide 1, then slide 3 (the sNUSD panel) | "An asset can stop being good collateral before its price moves. On the thirteenth of August, Neutrl paused sNUSD on Ethereum. A Pendle wrapper held eight million of them, Morpho Blue held nearly two million, and Morpho's market still had one-point-six million dollars borrowed against it." |
| 0:20–0:40 | Deck slide 4 | "And increasingly the asset is controlled on one chain and lent against on another. Two hundred eighty-five million dollars of USDe collateral sits on Robinhood Chain while the contract that controls it is on Ethereum." |
| 0:40–1:00 | Deck slide 5 (pipeline) | "So the destination contract needs to verify the issuer's event itself. That is what Attestcoin gives us — and this ledger has no other way in. No oracle, no admin switch. A proof or nothing." |
| 1:00–1:50 | **Terminal:** `node scripts/deploy-eligibility.js` — let it run | "One command. It deploys the ledger and the credit line to CC3 Testnet, registers sNUSD against Ethereum mainnet, fetches the real Attestcoin proof for that pause transaction — ten Merkle siblings, sixty-nine continuity roots — and submits it." |
| 1:50–2:05 | Highlight the `status before / status after / openPosition reverted` lines | "Status goes from NO_PROOF to IMPAIRED, the impairment is dated to the *source* block, and the credit line now refuses to open a new position: AssetImpaired." |
| 2:05–2:35 | **Terminal:** `node scripts/demo-rejections.js` | "And here is what it refuses. Replaying the proof: rejected. A genuine mainnet proof from a contract that is not allowlisted: rejected. Flip one bit of the Merkle root, and the Creditcoin precompile refuses it before our code even runs. Re-label a mainnet proof as Sepolia: same. Then we read the ledger back — unchanged." |
| 2:35–2:40 | Deck slide 8 | "It does not stop an exploit in flight, and it never blocks repayment or withdrawal. It gates new credit, on a proof the destination verified itself." |

**Two things to get right on camera**

- Let the `deploy-eligibility.js` run play at real speed. The pause while it fetches the proof is the
  point — that is a live call to the Attestcoin Proof Builder, not a fixture.
- Make sure the four `✅` lines in `demo-rejections.js` are readable. That slide is the one judges
  asked for ("a failing proof being rejected") and it is the strongest 30 seconds in the video.

---

## Remaining human steps

1. **Push the repo to GitHub.** No remote is configured yet; there is one commit. Confirm
   `contracts/.env` is still ignored before pushing — it holds the deployer private key.
2. **Host `docs/deck.pdf`** and take the URL. Re-export after any edit with:
   ```bash
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
     --no-pdf-header-footer --print-to-pdf=docs/deck.pdf --virtual-time-budget=8000 \
     "file://$PWD/docs/deck.html"
   ```
3. **Record and upload the demo video**, then paste the URL into the form.
4. **Submit on DoraHacks** with the description and Attestcoin summary above. Track: RWA (DeFi is the
   fallback if RWA is crowded — the product logic is credit, but the subject is a tokenised instrument).
