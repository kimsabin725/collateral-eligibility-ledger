# MVP Scenario — BLOCKED

**Status: not written. No GO candidate exists as of 2026-08-17.**

This file is a placeholder so the expected output set is complete and its absence is not mistaken
for an oversight. It is deliberately empty of product content: writing a scenario for a candidate
that was killed would fabricate confidence the evidence does not support.

See [`PROJECT_DECISION.md`](./PROJECT_DECISION.md) — P1, P2 and P3 were all killed, and the
blocking issue is a **selection criterion**, not a missing idea.

## What must be true before this file can be written

1. The user decides between Option A / B / C in `PROJECT_DECISION.md` §4.
2. A candidate survives the validation chain end-to-end:
   real problem → real users → current solution → its specific weakness → why that weakness
   matters → why Attestcoin improves it → why the consequence must live on Creditcoin →
   MVP feasible today → demonstrable → differentiated.
3. That candidate is checked against the capability boundary in `../spike/BASELINE.md`
   (no state proofs, no absence proofs, no off-chain facts, ~8–9 min latency, no writability).

## What is already settled and will carry into the MVP whenever one exists

Independent of which candidate wins, these are measured and reusable — see `../spike/FINDINGS.md`:

- Source-chain event → Proof Builder → BlockProver precompile → verified, working today on both
  Ethereum mainnet and Sepolia.
- Full receipt/log decoding on Creditcoin, cross-checked against Ethereum's own RPC.
- Mandatory application-side checks: `receiptStatus == 1`, emitter address equals the registered
  source contract, `topics[0]` equals the expected event signature.
- Replay protection via `keccak256(chainKey, blockHeight, txIndex)`.
- A working negative control: a tampered continuity proof reverts.
- Demo constraint: ~8–9 minutes of attestation latency rules out a single-take live demo.
