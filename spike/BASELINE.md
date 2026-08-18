# Technical Baseline — FROZEN 2026-08-17

Fixed reference for all downstream idea work. Do not re-litigate these; treat as given.
Revise **only** if the organizers' AMA (2026-08-18 20:00 KST) or a later official source
contradicts an item — and record the contradiction here with its date and source.

| # | Fact | Status | Basis |
|---|---|---|---|
| 1 | **Readability is available** — verify an Ethereum-family source transaction on Creditcoin | ✅ USE IT | Measured: `verify()` returned `true` for a real Sepolia tx; tampered proof reverted |
| 2 | **Source chains: Ethereum mainnet + Sepolia** (chainKey 3 and 1) | ✅ USE IT | Read on-chain from ChainInfo precompile `0x…0FD3` |
| 3 | **Attestation latency ≈ 8–9 minutes** | ✅ PLAN AROUND IT | Measured twice: 41 and 43 Sepolia blocks behind head |
| 4 | **Writability is unavailable** | ⛔ ASSUME UNUSABLE | Docs: "undergoing 3rd party testing and audits"; no deployed addresses; needs ⌊2N/3⌋+1 attestor signatures we cannot produce |
| 5 | Full receipt + logs decodable on Creditcoin (status, emitter, topics, data, calldata) | ✅ USE IT | Decoded values matched Sepolia RPC exactly |
| 6 | Verifier does **not** check tx success — the dApp must | ⚠️ MUST HANDLE | Official docs, verbatim |
| 7 | Replay protection = `keccak256(chainKey, blockHeight, txIndex)` | ✅ PATTERN EXISTS | `USCBase.sol` in official examples |
| 8 | Read-only verification costs no gas (`verify` via `eth_call`) | ✅ USE IT | Called successfully |

## Design envelope this implies

**Attestcoin is an inbound verification primitive.** Creditcoin reacts to *proven facts that
already happened on Ethereum*. It cannot push state outward today.

A viable idea must therefore:

- put the **fact to be proven on Ethereum mainnet or Sepolia**;
- put the **consequence on Creditcoin**;
- tolerate **~8–9 minutes** between the two;
- derive real value from *cryptographic* proof rather than an API read;
- not require Creditcoin to write back to another chain.

## Explicitly out of scope (baseline-driven)

- Round-trip / Creditcoin→Ethereum messaging (item 4)
- Aggregating many source chains — only two exist, one of which costs real ETH (item 2)
- Sub-minute reaction loops (item 3)

## Open question for the AMA

Is writability usable on CC3 Testnet during this hackathon (addresses, live destination chains,
running relayer + attestor set)? A "yes" reopens round-trip designs and would revise item 4.
