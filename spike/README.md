# Attestcoin Spike

Minimal, reusable technical foundation for building on the **Attestcoin Protocol** (formerly
Universal Smart Contracts / USC) on Creditcoin **CC3 Testnet**.

Results and constraints: **[FINDINGS.md](./FINDINGS.md)**.

## Why this exists

Before committing to a product idea we needed to know what the protocol can actually do today,
measured rather than assumed. Every script here runs **read-only** — no wallet, no private key,
no gas, nothing deployed — yet they exercise the real on-chain verifier and decoder.

## Setup

```bash
npm install
```

Requires Node.js 20+ (developed on v26). No API keys. Public RPCs are used by default; override
with environment variables if you hit rate limits:

```bash
export CREDITCOIN_RPC_URL=...     # default https://rpc.cc3-testnet.creditcoin.network
export SOURCE_CHAIN_RPC_URL=...   # default https://ethereum-sepolia-rpc.publicnode.com
export PROOF_BUILDER_URL=...      # default https://proof-gen-api.cc3-testnet.creditcoin.network
```

## Run

```bash
# 1. Prove a Sepolia tx and verify it on Creditcoin. Includes a tamper negative control.
node scripts/01-verify-readonly.js [txHash]

# 2. Decode that transaction's receipt and logs, cross-checked against Sepolia's own RPC.
node scripts/02-decode-readonly.js [txHash]

# 3. Ask the chain which source chains it supports and how far attestation has progressed.
node scripts/03-chain-info.js
```

With no `txHash` argument, scripts 1 and 2 pick a suitable recent, already-attested transaction
automatically.

## Expected output (script 01)

```
Proof builder health : healthy (cc3_rpc=true, eth_rpc=true)
Attestation lag      : 43 blocks (~8.6 min)
Proof fetched        : 308 ms (cached=true)
calculateTxIndex()   : 0 ✅ matches proof
Verification via verify() [view]: ✅ TRUE
Tampered proof       : ✅ rejected (reverted: "Continuity proof does not match…")
```

## Three traps this code already works around

1. **`chainKey` ≠ EVM chain id.** Sepolia is `chainKey` **1**; EVM chainId `1` is Ethereum
   mainnet. Mixing them up silently targets the wrong chain.
2. **ChainInfo precompile functions are snake_case** (`get_supported_chains`). A hand-written
   camelCase ABI reverts with `"Unknown selector"`. Use the ABI shipped inside the SDK.
3. **The pre-deployed decoder is stale** — it lacks `getLogsByEventSignature`. Deploy your own
   `EvmV1Decoder` from `@gluwa/usc-contracts`, as the official tutorial does.

## Not covered here

Deploying contracts and writing state — that needs a funded keypair on both chains. Cross-chain
**writability** (Creditcoin → destination chain) is not usable on CC3 Testnet at present;
FINDINGS.md §6 documents why, with evidence.

## Sources

- Attestcoin docs — <https://docs.creditcoin.org/attestcoin-protocol>
- Official examples — <https://github.com/gluwa/usc-testnet-bridge-examples>
- Relayer (writability) — <https://github.com/gluwa/usc-message-relayer>
- Packages — `@gluwa/usc-sdk`, `@gluwa/usc-contracts`
