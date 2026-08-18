# Attestcoin Technical Spike — Findings & Capability Map

> Executed 2026-08-17 against **CC3 Testnet** (EVM chainId `102031`).
> Everything below was produced by running code in `scripts/`, not by reading docs alone.
> Re-run before relying on any of it: `node scripts/01-verify-readonly.js` etc.

Legend — **[측정]** measured by us · **[문서]** stated in official docs · **[추론]** our inference.

---

## 1. Headline result

**The Attestcoin readability path works end-to-end today, and we proved it without a wallet,
without gas, and without deploying anything.**

```
Sepolia tx  →  Proof Builder (Merkle + continuity proof)  →  BlockProver precompile  →  true
            →  EvmV1Decoder  →  receiptStatus / logs / topics / calldata
```

`eth_call` executes against real chain state, so a `true` from the precompile is the genuine
on-chain verdict — not a simulation of our own making.

| Path | Status | Evidence |
|---|---|---|
| Source-chain read | ✅ works | `01-verify-readonly.js` → `verify() ✅ TRUE` |
| Proof generation | ✅ works, hosted | 308 ms for a cached proof |
| On-chain verification | ✅ works | BlockProver `0x…0FD2` |
| Tamper rejection | ✅ works | reverts `"Continuity proof does not match attestation or checkpoint"` |
| Transaction decode | ✅ works | status/gasUsed/logs all cross-check vs Sepolia RPC |
| Business logic on Creditcoin | ⛔ needs funded wallet | not attempted — see §7 |
| **Writability (Creditcoin → dest chain)** | ⛔ **blocked** | see §6 |

---

## 2. Verified environment facts

Confirmed **on-chain** via the ChainInfo precompile, not just from the docs
(`03-chain-info.js`):

| chainKey | Name | EVM chainId | Notes |
|---:|---|---:|---|
| 1 | `Sepolia ethereum` | 11155111 | free testnet ETH — **the only practical source chain** |
| 3 | `Ethereum` | 1 | real mainnet; originating a source tx here costs real ETH |

Exactly **two** source chains. `chainKey` is an Attestcoin-internal id and is **not** the EVM
chain id — a genuine footgun, since Sepolia's chainKey is `1` while EVM chainId `1` is Ethereum
mainnet.

Live endpoints (all healthy at time of writing):

| Component | Value |
|---|---|
| Creditcoin RPC | `https://rpc.cc3-testnet.creditcoin.network` |
| Proof Builder | `https://proof-gen-api.cc3-testnet.creditcoin.network` (OpenAPI at `/api/swagger/`) |
| BlockProver precompile | `0x0000000000000000000000000000000000000FD2` |
| ChainInfo precompile | `0x0000000000000000000000000000000000000FD3` |
| Decoder (pre-deployed) | `0x731c345d79Fb8BbDC541f9DF3b6317585F849F9f` — ⚠️ stale, see §5 |
| SDK | `@gluwa/usc-sdk@0.18.0` (published 2026-06-22) |
| Contracts | `@gluwa/usc-contracts@0.1.2` |

---

## 3. Attestation latency — the number the docs never gave

The docs only say users would wait "several minutes". **[측정]** Measured twice, ~20 min apart:

| Sample | Sepolia head | Attested height | Lag | ≈ time |
|---|---:|---:|---:|---:|
| 1 | 11,505,991 | 11,505,950 | 41 blocks | **8.2 min** |
| 2 | 11,506,003 | 11,505,960 | 43 blocks | **8.6 min** |

**Implication for the demo:** a source transaction cannot be proven on Creditcoin for roughly
**8–9 minutes**. A live end-to-end demo recorded in one unbroken take is therefore not viable.
Plan for one of:

- pre-stage the source transaction before recording, then show verification live;
- record in two segments;
- show a previously-verified transaction alongside a live one still maturing.

Proof retrieval itself is fast (~0.3–0.7 s cached), so the wait is attestation, not proving.

---

## 4. What the verifier does and does not check — confirmed by running it

**[문서 + 측정]** The precompile validates **inclusion and continuity only**:

> "The block prover precompile **does not** validate if a transaction was successful or not."
> — architecture docs

> "a dApp's attestcoin smart contract **MUST** check the 'status' field" — architecture docs

So an application contract must itself enforce, in this order:

1. `receipt.receiptStatus == 1` — otherwise a **reverted** source transaction still carries a
   valid inclusion proof.
2. `log.address_ == <registered source contract>` — otherwise anyone deploys a look-alike
   contract, emits your event with arbitrary arguments, and proves it. The official example
   flags this exact attack in a code comment.
3. `log.topics[0] == <expected event signature>`.
4. Replay protection — see §5.

**[측정]** Negative control passed: mutating `continuityProof.lowerEndpointDigest` by one byte
caused a revert rather than a `false`. Tampering is rejected at the precompile.

---

## 5. Reusable patterns lifted from the official example

These answer questions the handover brief listed as unknown.

**Replay protection** (`USCBase.sol`) — a query id derived from position, not from payload:

```
queryId = keccak256(chainKey, blockHeight, txIndex)
require(!processedQueries[queryId], "Query already processed");
processedQueries[queryId] = true;
```

`txIndex` is recomputed on-chain via `VERIFIER.calculateTxIndex(merkleProof)` rather than
trusted from the caller. **[측정]** We confirmed the derived index matches the proof's own
`txIndex`.

**Decoding** (`EvmV1Decoder`) — receipts *and* logs are fully available:
`getTransactionType` → `decodeReceiptFields` → `getLogsByEventSignature` → read `topics`/`data`.
**[측정]** Decoded `status`, `gasUsed`, and log count matched Sepolia's own RPC exactly.

**⚠️ Discrepancy — official docs vs deployed bytecode.** The decoder pre-deployed at the address
listed in the chains/environments page is an **older build**. Selector inspection of the live
bytecode shows both `getLogsByEventSignature` overloads are **absent**, while
`getTransactionType`, `decodeCommonTxFields`, and `decodeReceiptFields` are present. Calls to the
missing functions revert with no data.

*Severity: low.* The official loan-flow tutorial deploys **its own** `EvmV1Decoder` library and
links it, which is the pattern we will follow. Do not depend on the documented address.

**⚠️ Second discrepancy — incomplete interface file.** `VerifierInterface.sol` in the examples
repo declares only `verifyAndEmit` and `calculateTxIndex`. The precompile **also** implements a
read-only `verify(...) view returns (bool)`, which we called successfully. This is very useful:
it allows verification with no state change and no gas, and the examples repo simply omits it.

**⚠️ Naming trap.** ChainInfo precompile functions are **snake_case**
(`get_supported_chains`, `is_height_attested`). A hand-written camelCase ABI reverts with
`"Unknown selector"`. Always use the ABI shipped in `@gluwa/usc-sdk/dist/chain-info/chain_info.json`.

---

## 6. ⛔ Writability is blocked on CC3 Testnet today

This is the most consequential finding, and it changes what is buildable.

**How writability is designed to work** (from `@gluwa/usc-contracts/write-ability` and the
`gluwa/usc-message-relayer` README):

```
Creditcoin: dApp → Outbox.publishMessage()        → MessagePublished
            attestors observe, ECDSA-sign messageHash, gossip over libp2p
            relayer aggregates to ⌊2N/3⌋+1 votes
Dest chain: Inbox.deliverMessage(…, votes) → EOAValidator re-verifies → dApp.receiveMessage
   ack:     Inbox MessageDelivered → native USC proof → AcknowledgmentValidator on Creditcoin
            → Outbox.acknowledgeMessage
```

The acknowledgement leg is elegant: it closes the loop by feeding the destination chain's event
**back through readability**. A genuine round trip exists in the design.

**Why we cannot build on it right now:**

| Blocker | Evidence |
|---|---|
| Not generally available | Docs: *"Writability is undergoing 3rd party testing and audits"*; sub-pages promised "once the feature matures on testnet" |
| No deployed addresses | Chains/environments page lists **no** Outbox / Inbox / OutboxFactory for CC3 Testnet or Mainnet |
| Requires the attestor set | Delivery needs **⌊2N/3⌋+1 attestor signatures**. A participant cannot produce these; Gluwa's attestors must actively sign our route |
| Reference config targets another network | `config.example.yaml` uses `creditcoin_chain_id: 102035` and `chain_key: 7` — **not** CC3 Testnet (`102031`, keys 1/3) — with a placeholder inbox `0x1111…1111` |
| Acknowledged incompleteness | Relayer's own "Known gaps": *"OutboxFactory resolution is a stub"*, *"`cc3_active_set` attestor source is unimplemented"*, fee integration pending |

**[추론]** Writability looks like an in-flight feature that landed in the repos ahead of a public
testnet deployment. It is not currently a foundation a hackathon project can stand on.

**Not fully disproven:** Gluwa may operate an unpublished route and simply not have documented
it. **This is the single highest-value question for the organizers** — see §8.

---

## 7. ⛔ Next step requires a funded wallet

Everything achievable read-only is now done. Continuing means:

1. deploying a source contract on Sepolia,
2. deploying an ASC + a linked `EvmV1Decoder` on Creditcoin,
3. sending real (testnet) transactions and paying gas on both chains.

That needs a keypair and faucet funds on both networks — **stopped here for your decision**
rather than generating or handling keys unilaterally. Costs are testnet-only (no real money),
provided we stay on chainKey 1 and never use the Ethereum-mainnet chainKey.

Prerequisite not yet installed: **Foundry** (`forge`), used by the official tutorial. An
npm-only path (`solc` + ethers) is also possible and avoids a system-level install.

---

## 8. Questions for the organizers (AMA, 2026-08-18 20:00 KST)

1. **Is writability usable on CC3 Testnet during this hackathon?** If yes, what are the Outbox /
   Inbox / OutboxFactory addresses, which destination chains are live, and is a relayer +
   attestor set running for them? *(Directly determines whether round-trip designs are viable.)*
2. Does "depth of Attestcoin utilization" scoring reward writability over readability-only?
3. Is there a published judging rubric with weights?
4. Are more source chains planned before 2026-09-06, or is Sepolia the practical ceiling?
5. Does re-skinning the loan-flow tutorial's structure count against originality?

---

## 9. Capability map — what we can actually build on

✅ **Available and proven**

- Verify that a specific Sepolia transaction was really included in the canonical chain.
- Read that transaction's **success status, sender, recipient, value, calldata, and all event
  logs** inside a Creditcoin contract.
- Filter logs by event signature and authenticate the emitting contract address.
- Enforce exactly-once processing via position-derived `queryId`.
- Do all verification read-only (`verify`, `eth_call`) — cheap validation before paying gas.
- Query attestation state, continuity bounds, and checkpoints from the ChainInfo precompile.

⛔ **Not available**

- Sending messages/state **from** Creditcoin to another chain (writability — §6).
- Aggregating from **many** source chains: only Sepolia is practical; the second option is
  Ethereum mainnet with real cost.
- Sub-minute source→Creditcoin reaction: budget **~8–9 minutes**.

⚠️ **Available with caveats**

- Proof generation depends on Gluwa's hosted Proof Builder (a `RawProofBuilder` exists for
  offline computation, unverified by us).
- A dApp must run its own off-chain worker to watch, wait, prove, and submit.

**[추론] What this shape favours.** Attestcoin is currently a strong **inbound verification**
primitive: Creditcoin as a place that reacts to *proven facts that happened elsewhere*, where
the reaction is high-value enough to justify a multi-minute settling delay and where a
centralised operator asserting the same fact would be the weak point worth removing. Designs
needing a fast loop, many chains, or Creditcoin pushing state outward do not fit today.

---

## 10. Files

| Path | Purpose |
|---|---|
| `src/config.js` | Network, precompile, and ABI configuration |
| `src/proofClient.js` | Proof Builder API client (`waitUntilAttested`, proof fetch) |
| `scripts/01-verify-readonly.js` | Proof → on-chain verification + tamper negative control |
| `scripts/02-decode-readonly.js` | Transaction/receipt/log decoding + cross-check vs Sepolia |
| `scripts/03-chain-info.js` | Supported chains, attestation state, continuity bounds |
