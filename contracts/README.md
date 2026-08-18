# VaultAuthorityLedger

An append-only record on Creditcoin of **who was granted authority over a DeFi lending vault on
Ethereum, and what they subsequently did with depositor funds** — every entry admitted only on an
Attestcoin proof of the underlying Ethereum transaction.

Scope and claims are frozen in [`../docs/BUILD_SPEC.md`](../docs/BUILD_SPEC.md).

## The point

MetaMorpho's `reallocate` is `onlyAllocatorRole`, which admits **allocator OR curator OR owner**.
So a single `ReallocateSupply` proof shows only that *some address* moved depositor funds — it does
**not** identify a role. Correct attribution requires composing two proofs:

```
proof #1   SetIsAllocator(X, true)      on vault V   @ block A     ← authority
proof #2   ReallocateSupply(X, m, …)    on vault V   @ block B>A   ← action
           ⇒ "X, granted allocator authority on V at A, moved V's funds into m at B"
```

Without proof #1 the ledger records the action with role **UNKNOWN**. It never guesses.
That composition is why this needs Attestcoin rather than an event lookup.

## Quick start

```bash
npm install
node scripts/compile.js        # npm solc — no system toolchain required
node test/ledger.test.js       # 15/15 — application logic on a local EVM
node test/realdata.test.js     # 8/8  — REAL proofs + REAL decoder on a local EVM
```

`realdata.test.js` fetches live Attestcoin proofs for two real Ethereum mainnet transactions and
runs them through the real `EvmV1Decoder` and the real ledger. Only the BlockProver precompile is
mocked, because it is a Creditcoin runtime component that cannot exist locally — and it is already
verified against these exact two transactions in [`../spike/scripts/06`](../spike/scripts).

## Deploying to CC3 Testnet

```bash
node scripts/deploy-and-ingest.js
```

Deploys the decoder and ledger, allowlists the vault, fetches real proofs, submits authority then
action, and asserts `roleAtAction == ALLOCATOR`.

**Requires testnet CTC.** Funding is a Discord-bot faucet — a manual step:

1. join <https://discord.gg/creditcoin>
2. in `#token-faucet` post: `/faucet address:<DEPLOYER_ADDRESS from .env>`

The script exits early with this instruction if the balance is zero.

## Contracts

| File | Purpose |
|---|---|
| `src/VaultAuthorityLedger.sol` | The ledger: verify → app checks → decode → append |
| `src/vendor/EvmV1Decoder.sol` | Vendored verbatim from `@gluwa/usc-contracts@0.1.2`. We deploy our own because the decoder listed on the official chains/environments page is an older build missing `getLogsByEventSignature` (verified 2026-08-17) |
| `test/Mocks.sol` | Local stand-ins for the precompile and decoder |

### The five checks, in order

1. **Replay** — `keccak(chainKey, blockHeight, txIndex)`; `txIndex` is recomputed on-chain by the
   precompile, never supplied by the caller.
2. **Inclusion + continuity** — the BlockProver precompile.
3. **Transaction success** — `receiptStatus == 1`. The precompile does **not** check this.
4. **Event signature + arity**.
5. **Emitter allowlist** — a log from a non-allowlisted contract is never recorded.

Checks 4–5 **skip** non-matching logs rather than reverting: real source transactions are batched
(the live grant we ingest sets allocators across several vaults at once; one allocation tx carried
48 logs). A transaction yielding no allowlisted, signature-matching log reverts with
`NoMatchingEvent` and writes nothing.

## Build notes

- `viaIR: true` is **required** — the documented ASC entry point takes 7 flattened proof
  parameters, which overflows the legacy codegen's stack.
- `evmVersion: 'paris'` — avoids `PUSH0`/`MCOPY` so identical bytecode runs on the local test VM
  and on chains that lag on hardforks.

## What this does not claim

- Not a complete history — **absence is unprovable**; only submitted events exist here.
- Not proof that an actor is *currently* authorised — we prove a grant at a block, never
  non-revocation.
- Not a judgement that any action was imprudent. Facts only.
- Not a rating or score.
- Discovery is **not** trustless — finding which transactions to submit still needs log scanning.

Full limitation list: `../docs/BUILD_SPEC.md` §15–16.
