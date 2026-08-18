# BUIDL CTC 2026 Fall — Environment & Compliance Audit

> Executed 2026-08-17, read-only, time-boxed. No new market research.
> Primary sources re-fetched today: DoraHacks detail + tracks pages, `buidl.creditcoin.org`,
> `docs.creditcoin.org/attestcoin-protocol/*` (`.md` originals), plus our own `spike/` code.
> **Deprecated-source policy:** no `creditcoin-usc` (USC v1) page is used as evidence of the current
> environment. Where the organizer cites those paths, they 301-redirect to current pages (verified
> below) and only the redirect target is treated as authoritative.

---

## A. Hackathon submission requirements

| Item | Official requirement / current environment | Our project | Evidence | PASS/GAP |
|---|---|---|---|---|
| Attestcoin integration level | *"Projects must demonstrate a **meaningful and functional** integration"*; *"Working Attestcoin Protocol integration code running within your project"*; *"**Depth** of Attestcoin Protocol utilization will be evaluated as one of the core scoring criteria"* | Attestcoin verification is the admission gate for every ledger entry; the core feature is a **two-proof composition** (authority + action) that is required for correct attribution | DoraHacks detail page, verbatim, re-fetched 2026-08-17 | **PASS** |
| Technical documentation | *"Technical documentation detailing your setup and explaining how the project uses the Attestcoin Protocol"* | `docs/BUILD_SPEC.md` + `spike/FINDINGS.md` + `spike/README.md` + planned repo README | same | **PASS** |
| Testnet deployment | *"Must be deployed on a testnet."* No chain is named, but Attestcoin must be a core feature, which requires CC3 | Deploy `EvmV1Decoder` + `VAULT_LEDGER` on **CC3 Testnet (chainId 102031)** | same; `BUILD_SPEC` §17.1 | **PASS** |
| Creditcoin testnet specifically required? | **Not stated explicitly.** Requirement is "a testnet" + Attestcoin as core feature | We target CC3 Testnet anyway | same | **PASS** ([INFERENCE] that CC3 is implied) |
| Original work during hackathon | *"Must be original work created during the hackathon."* | All contracts/frontend to be written now. `spike/` scripts are also this-period work. Pre-existing research is documentation, not submitted code | same | **PASS** |
| Track-specific requirements | **None.** Five tracks (DeFi/RWA/DePIN/Gaming/AI) carry only topic tags; every track tags `#Attestcoin Protocol` | Fits **DeFi** (lending) or **RWA**; no extra obligations either way | tracks page, re-fetched | **PASS** |
| Must participants deploy their own **source-chain** contract? | **NO.** `source-chain-smart-contracts` presents an example and frames it as illustrative (*"The following example shows a simple ERC20 contract…"*, plus *"for educational purposes only"*). **No must/should establishing deployment as a requirement.** `attestcoin-smart-contracts` likewise *"does not specify whether the source contract must be one you deployed."* | We use **existing third-party** MetaMorpho vault events | both `.md` pages, re-fetched | **PASS** |
| Are events from existing Ethereum contracts allowed as source data? | **Not prohibited anywhere.** Docs are silent; nothing in the requirements restricts source-event provenance | Core of our design | as above | **PASS** (silence, not endorsement — see §E) |
| Other deliverables | Project name/sector/description, **Attestcoin Integration Summary**, GitHub + README, deck/whitepaper PDF, demo video, team info; min team 1 | All in `BUILD_SPEC` §17 | DoraHacks detail | **PASS** |
| Deadline | `endDate` `2026-09-06T04:59:00.000Z`, `isExtended: false` (body text still says "23:59 ET" — conflict unchanged) | `BUILD_SPEC` uses the earlier value: **2026-09-06 13:59 KST** | JSON-LD payload, re-fetched | **PASS** |

## B. Current official environment (CC3 Testnet)

| Component | Official value (chains-environments page, 2026-08-17) |
|---|---|
| Network | **CC3 Testnet** |
| ASC Dashboard | `https://dashboard.cc3-testnet.creditcoin.network/` |
| Proof Builder API | `https://proof-gen-api.cc3-testnet.creditcoin.network/` |
| Decoder Contract | `0x731c345d79Fb8BbDC541f9DF3b6317585F849F9f` |
| ChainInfo Precompile | `0x0000000000000000000000000000000000000fd3` |
| BlockProver Precompile | `0x0000000000000000000000000000000000000FD2` |
| SDK | `@gluwa/usc-sdk` (npm) |
| Supported source chains | **Ethereum Sepolia → chainkey 1** · **Ethereum Mainnet → chainkey 3** (genesis 0) |

RPC/chainId are published on the endpoints page: `https://rpc.cc3-testnet.creditcoin.network`,
chainId **102031**, explorer `https://creditcoin-testnet.blockscout.com/`.

## C. Our environment vs official — value-by-value

| Setting | Official | Ours (`spike/src/config.js`) | Match |
|---|---|---|---|
| Creditcoin RPC | `https://rpc.cc3-testnet.creditcoin.network` | identical (line 19) | ✅ |
| Creditcoin chainId | 102031 | 102031 (line 18) | ✅ |
| Proof Builder | `https://proof-gen-api.cc3-testnet.creditcoin.network` | identical (line 20–21) | ✅ |
| BlockProver precompile | `0x…0FD2` | `0x0000000000000000000000000000000000000FD2` (line 25) | ✅ |
| ChainInfo precompile | `0x…0fd3` | `0x0000000000000000000000000000000000000FD3` (line 24) | ✅ (case-insensitive) |
| Decoder | `0x731c345d79Fb8BbDC541f9DF3b6317585F849F9f` | identical (line 23) | ✅ |
| Dashboard | `https://dashboard.cc3-testnet.creditcoin.network/` | identical (line 22) | ✅ |
| chainKey Sepolia | 1 | `SEPOLIA: 1` (line 12) | ✅ |
| chainKey Ethereum mainnet | 3 | `ETH_MAINNET: 3` (line 13, with the mainnet-vs-testnet caveat noted) | ✅ |
| SDK | `@gluwa/usc-sdk` | **0.18.0** installed (latest published, 2026-06-22) | ✅ |
| Contracts pkg | `@gluwa/usc-contracts` | **0.1.2** installed | ✅ |

**Conclusion: zero configuration drift.** Every endpoint, address and chainkey in our code equals
the current official value.

## D. Version mixing — old vs current

| Source we touched | Status | Verdict |
|---|---|---|
| `docs.creditcoin.org/attestcoin-protocol/*` | **Current** | Authoritative. All environment facts taken from here |
| `docs.creditcoin.org/creditcoin-usc/*` (the paths the organizer links) | **Legacy paths**, 301 → current `attestcoin-protocol/*` (verified today for all three cited links) | Safe: only redirect targets used |
| `gluwa/usc-testnet-bridge-examples` | Live (last substantive commit 2026-07-29; CI green 2026-08). Videos/naming still say "USC" | **Fine for patterns** (`USCBase` replay protection, receiptStatus check, emitter allowlist). Naming is legacy only |
| `VerifierInterface.sol` in that repo | **Incomplete** — declares only `verifyAndEmit` + `calculateTxIndex`; the precompile also implements read-only `verify()`, which we call successfully | Experiment-safe. For the submitted ASC, use the **documented** flattened-parameter entry pattern (see gap G-2) |
| Pre-deployed decoder `0x731c…F9f` | **Officially listed but stale** — re-confirmed today: `decodeReceiptFields` PRESENT, `getLogsByEventSignature(...)` **ABSENT**, while `@gluwa/usc-contracts@0.1.2` has it | Read-only spike use: fine. **Submission must deploy our own `EvmV1Decoder`** — already MUST-HAVE #1 in `BUILD_SPEC` §12 |
| `@gluwa/usc-sdk/dist/chain-info/chain_info.json` | Current package | Correct — hand-written camelCase ABI reverts (`"Unknown selector"`); precompile functions are snake_case |
| Deprecated USC v1 docs | **Not used as evidence anywhere** | Compliant with instruction |

No harmful version mixing found. One item (stale decoder) was already scheduled for replacement
before this audit.

## E. Architecture alignment

Our flow — **Ethereum mainnet MetaMorpho event → Attestcoin proof → Creditcoin verification →
`VAULT_LEDGER` business logic** — maps 1:1 onto the official ASC five-step pattern
(`attestcoin-smart-contracts`, re-fetched):

| Official ASC step | Our implementation |
|---|---|
| 1. Receive proofs + tx data from an off-chain worker | Submitter script (`proofClient.js`) |
| 2. Implement replay protection | `processedQueries[keccak(chainKey, blockHeight, txIndex)]` |
| 3. Call the Block Prover Precompile (synchronous) | `verify()` / `verifyAndEmit()` at `0x…0FD2` |
| 4. Extract tx/event data from verified bytes | `EvmV1Decoder` (own deployment) |
| 5. Execute business logic on verified data | Role-grant + action append, ordering check |

Plus the explicit mandate — *"The block prover precompile does not validate if a transaction was
successful"*, so the ASC **MUST** check status `0x1` — which is `BUILD_SPEC` §10 check #2.

**Requirement vs best practice — the key question:**
Deploying your own source-chain contract is a **best practice, not a requirement**. The
`dapp-design-patterns-readability` page states, in a best-practices list, *"An ASC-enabled dApp
should have a **single source chain contract**"* and *"keep logic on the source chain as minimal
as possible"* — normative **"should"**, aimed at simplifying off-chain worker tracking. No page
imposes a MUST.

**Our deliberate deviation, stated openly:** we read events from ~200 third-party MetaMorpho
vaults rather than one contract we deployed. This is permitted, and it is the point of the product
— but it costs us the convenience the best practice was protecting, which is exactly why
`BUILD_SPEC` §11 requires a `knownVaults` allowlist and §6 declares that **discovery is not
trustless**. [INFERENCE] Judges may still expect the tutorial shape; the Attestcoin Integration
Summary should pre-empt this by explaining why third-party source events are the harder and more
meaningful integration.

## F. Gaps found

Neither blocks implementation; both are spec refinements.

- **G-1 (documentation, not code).** `BUILD_SPEC` should state that our source events come from
  third-party contracts, that this is permitted, that it deviates from the documented
  single-source-contract *best practice*, and why. → add to `BUILD_SPEC` §7/§15.
- **G-2 (spec detail).** `BUILD_SPEC` §10 does not fix the ASC entry-point signature. Adopt the
  documented flattened-parameter form (`chainKey, blockHeight, encodedTransaction, merkleRoot,
  siblings[], lowerEndpointDigest, continuityRoots[]`) rather than the struct-tuple form our
  read-only scripts use with `verify()`. → add to `BUILD_SPEC` §10/§11.

## G. Verdict

> ## HACKATHON ENVIRONMENT VERIFIED
>
> Zero configuration drift; no deprecated environment values; the architecture matches the official
> ASC pattern step for step; and using third-party source-chain events is permitted. The two gaps
> are spec-text additions, not environment or compliance failures.
