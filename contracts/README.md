# Contracts

Two ledgers share one proof pipeline.

- **`EligibilityLedger`** — the submission. An asset-level impairment event on a source chain,
  proven with Attestcoin, gates new credit on Creditcoin. Start here.
- **`VaultAuthorityLedger`** — the earlier build, kept as a regression on the proof plumbing.
  Retired as the headline idea; see the root [`README.md`](../README.md#prior-work-in-this-repo).

Project overview and live addresses: [`../README.md`](../README.md).
Scope and claims are frozen in [`../docs/BUILD_SPEC_V2.md`](../docs/BUILD_SPEC_V2.md).

## Quick start

```bash
npm install
node scripts/compile.js        # npm solc — no system toolchain required

node test/eligibility.test.js            # 27/27  EligibilityLedger + GatedCreditLine
node test/realdata-eligibility.test.js   # 10/10  REAL mainnet proof + REAL decoder
node test/ledger.test.js                 # 15/15  VaultAuthorityLedger regression
node test/realdata.test.js               #  8/8   REAL proofs, two more transactions
```

**60/60.** The real-data suites fetch live Attestcoin proofs for real Ethereum mainnet transactions
and run them through the real `EvmV1Decoder`. Only the BlockProver precompile is mocked, because it
is a Creditcoin runtime component that cannot exist on a local EVM — and the live scripts below
exercise the real one.

## Against CC3 Testnet

```bash
node scripts/deploy-eligibility.js   # deploy + ingest a real impairment + show the gate refuse
node scripts/demo-rejections.js      # read-only: four forgeries rejected on-chain
node scripts/deploy-and-ingest.js    # v1: authority→action composition (optional)
```

`deploy-eligibility.js` writes [`deployment.json`](deployment.json), which `demo-rejections.js`
reads. The current deployment is already recorded there, so the negative demo runs on its own.

**Requires testnet CTC** for the deploying scripts. Funding is a Discord-bot faucet — a manual step:

1. join <https://discord.gg/creditcoin>
2. in the `faucet` channel post the slash command: `/faucet address:<DEPLOYER_ADDRESS from .env>`

Pick it from Discord's autocomplete — pasting it as plain text is not parsed as a command. The
faucet is rate-limited per address (one request per hour). Both deploy scripts detect a zero
balance, print this instruction, and exit with code 2 before touching the chain.

## The EligibilityLedger pipeline

### The five checks, in order

1. **Replay** — `keccak(chainKey, blockHeight, txIndex)`; `txIndex` is recomputed on-chain by the
   precompile, never supplied by the caller, so the key is a *position*, not something a submitter
   can influence.
2. **Inclusion + continuity** — the BlockProver precompile at `0x…0FD2`. On a bad proof the
   precompile reverts inside the runtime; application code is never reached.
3. **Transaction success** — `receiptStatus == 1`. The precompile does **not** check this.
4. **Event signature** — is this a configured impairment or restoration signature?
5. **Emitter allowlist** — a log from a non-registered contract is never recorded. Without this,
   anyone deploys a look-alike, emits `Paused`, and proves it. It is the single most important
   check in the pipeline.

Checks 4–5 **skip** non-matching logs rather than reverting: real source transactions are batched
(one live allocation transaction carried 48 logs). A transaction yielding no allowlisted,
signature-matching log reverts with `NoMatchingEvent` and writes nothing.

An asset is registered against exactly one source chain. A proof from a different chain naming the
same address is a different contract, and reverts with `WrongChainKey`.

### State machine

`NO_PROOF → IMPAIRED → RESTORED`, driven only by proofs.

- The **earliest** proven impairment block is the cutoff. A later proof never pushes it forward.
- A restoration counts only if an impairment was proven first and the restoration is **strictly
  later**. If a newly proven earlier impairment moves the cutoff back past a known restoration, that
  restoration is invalidated.
- Ignored events are still appended to history and announced as `EventIgnored` — never dropped
  silently.

`GatedCreditLine` reads `isCreditGated(asset)`. Impaired means `openPosition`, `borrowMore` and
`addCollateral` revert with `AssetImpaired`; `repay` and `withdrawCollateral` always work.

## Files

| File | Purpose |
|---|---|
| `src/EligibilityLedger.sol` | The ledger: verify → app checks → decode → append (7,431 bytes) |
| `src/GatedCreditLine.sol` | Credit venue reading the ledger; exits never gated (5,007 bytes) |
| `src/VaultAuthorityLedger.sol` | v1 — authority→action composition, kept as regression |
| `src/vendor/EvmV1Decoder.sol` | Vendored verbatim from `@gluwa/usc-contracts@0.1.2`. We deploy our own because the decoder listed on the official chains/environments page is an older build missing `getLogsByEventSignature` (verified 2026-08-17) |
| `test/Mocks.sol`, `test/MocksV2.sol` | Local stand-ins for the precompile and decoder |

## Build notes

- `viaIR: true` is **required** — the documented ASC entry point takes 7 flattened proof
  parameters, which overflows the legacy codegen's stack.
- `evmVersion: 'paris'` — avoids `PUSH0`/`MCOPY` so identical bytecode runs on the local test VM
  and on chains that lag on hardforks.

## What this does not claim

- Not a complete history — **absence is unprovable**; only submitted events exist here.
  `NO_PROOF` is not a statement that an asset is healthy.
- Not real-time protection. Attestation lags the source chain by 8–9 minutes; this gates **new**
  credit, it does not stop a transaction in flight.
- Not a judgement that any action was imprudent. Facts only. Not a rating or score.
- Discovery is **not** trustless — finding which transactions to submit still needs log scanning.
- The ERC-20s in the demo are mocks. The source event is real.

Full limitation list: [`../docs/BUILD_SPEC_V2.md`](../docs/BUILD_SPEC_V2.md) and
[`../CROSS_CHAIN_COLLATERAL_ELIGIBILITY_PROJECT_STATE.md`](../CROSS_CHAIN_COLLATERAL_ELIGIBILITY_PROJECT_STATE.md) §15.
