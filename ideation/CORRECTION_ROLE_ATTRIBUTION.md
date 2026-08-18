# Correction — Role Attribution in MetaMorpho Vaults

> 2026-08-17, read-only verification. Triggered by a user challenge to the CuratorLedger thesis.
> **Outcome: the challenge was correct. Two factual errors found and corrected. Verdict: THESIS NEEDS PIVOT.**

---

## 1. Vault version — CONFIRMED

`steakUSDC` = `0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB` is a **MetaMorpho Vault V1**
(v1.1-generation), determined by selector inspection of the deployed bytecode (19,340 bytes):

| Present (V1) | Absent (V2 markers) |
|---|---|
| `owner()` `curator()` `guardian()` `isAllocator(address)` | `adapters()` |
| `submitCap(MarketParams,uint256)` `acceptCap(MarketParams)` | `allocate(address,bytes,uint256,bytes4)` |
| `setSupplyQueue(bytes32[])` `updateWithdrawQueue(uint256[])` | `deallocate(address,bytes,uint256,bytes4)` |
| `setIsAllocator(address,bool)` `multicall(bytes[])` | `curators(address)` `isSentinel(address)` `absoluteCap` `relativeCap` |

`acceptCap` taking `MarketParams` (not `Id`) places it in the **v1.1** line.

Live state (eth_call, Ethereum mainnet):
```
name        Steakhouse USDC        totalAssets  75,212,830.24 USDC
owner       0x0A0e559bc3b0950a7e448F0d4894db195b9cf8DD
curator     0x827e86072B06674a077f592A531dcE4590aDeCdB
guardian    0xaa0500198B4425DfC4E272FbE42C8E64E21fc03d
timelock    604800 s (7 days)
```

## 2. Role of the caller in the proven tx — CONFIRMED, AND MY CLAIM WAS WRONG

Transaction `0x35a2f50f…f98e8f0`, caller `0x9e9110cfd24cd851ea5bc73a27975b33e308f9e1`:

| Check (eth_call) | Result |
|---|---|
| `isAllocator(caller)` | **true** |
| `caller == curator()` | false |
| `caller == owner()` | false |
| `caller == guardian()` | false |
| `isAllocator(curator())` | **false** |
| `isAllocator(owner())` | **false** |

**The caller is an Allocator, not the Curator.** In this vault the roles are cleanly separated —
the curator is not even an allocator. My statement *"curator C moved depositor funds"* was
**factually wrong**.

## 3. Actual role separation — from contract source

`morpho-org/metamorpho` `MetaMorpho.sol`:

```solidity
modifier onlyCuratorRole()   { sender != curator && sender != owner()          -> revert }
modifier onlyAllocatorRole() { !isAllocator[sender] && sender != curator
                                                    && sender != owner()        -> revert }
modifier afterTimelock(v)    { block.timestamp < v -> revert }   // NO role check
```

| Function | Access | Event | Who it really identifies |
|---|---|---|---|
| `setCurator` | **onlyOwner** | `SetCurator(newCurator)` | Owner appoints curator |
| `setIsAllocator` | **onlyOwner** | `SetIsAllocator(allocator,bool)` | Owner appoints/revokes allocator |
| `submitCap` | **onlyCuratorRole** | `SubmitCap(caller,id,cap)` | **Curator's risk decision** |
| `submitMarketRemoval` | **onlyCuratorRole** | `SubmitMarketRemoval(caller,id)` | Curator's risk decision |
| `acceptCap` | **afterTimelock only — permissionless** | `SetCap(caller,id,cap)` | **Anyone**; mere execution |
| `reallocate` | **onlyAllocatorRole** | `ReallocateSupply(caller,id,…)` | **Allocator** (or curator/owner) executing |
| `setSupplyQueue` | onlyAllocatorRole | `SetSupplyQueue(caller,…)` | Allocator |

**Second error found:** the thesis also treated `SetCap` as the curator's decision. It is not —
`acceptCap` is permissionless, so `SetCap(caller)` is whoever pushed the button after the 7-day
timelock. The curator's decision is **`SubmitCap`**.

**Correct model:** the *curator* defines the risk envelope (which markets, what cap); the
*allocator* moves money **within** that envelope; the *owner* decides who holds each role.

## 4. Corrections applied

| Wrong claim | Corrected |
|---|---|
| "curator moved depositor funds into market m" | An **allocator** executed the move; the **curator** authorised the market and cap |
| `SetCap` = curator decision | `SubmitCap` = curator decision; `SetCap` = permissionless execution |
| `ReallocateSupply.caller` = curator | `= allocator, or curator, or owner` — **role must be proven separately, never assumed** |

Patched in `FINAL_PRODUCT_THESIS.md`, `FINAL_MVP_AND_DEMO.md`, `FINALIST_DEEP_DIVE.md`,
`FINAL_PROJECT_DECISION.md`, and `spike/scripts/05-prove-curator-action.js`.

## 5. Design A vs Design B

| | **A — curator policy only** | **B — role-separated governance + execution** |
|---|---|---|
| Records | `SubmitCap`, `SubmitMarketRemoval` | `SetCurator`/`SetIsAllocator` (authority) + `SubmitCap` (policy) + `ReallocateSupply` (execution) |
| User learns | which markets a curator was willing to expose depositors to | **who was authorised, by whom, when — and what they then did with the money** |
| vs CuratorWatch/DIA | little; caps are visible in current state anyway | attribution over **time**, including revoked roles and superseded policy that dashboards showing current state omit |
| Attestcoin need | single proof per event — shallow | **attribution is only correct if you compose proofs** (appointment + action). Verification is load-bearing, not decorative |
| Creditcoin need | weak | a neutral cross-protocol registry of authority-and-action, independent of the evaluated parties |
| Feasibility | **poor** — `SubmitCap`/`SetCap` not observed in our scans; could not obtain a sample event | **good** — `ReallocateSupply` abundant, `SetIsAllocator` found and proven |

**Design B wins decisively.** The user's challenge did not weaken the project; it forced the
design that actually requires Attestcoin.

## 6. Chain provability — PARTIAL (superseded by the ADDENDUM below)

> ⚠️ **This section overstated.** The two proofs below involve *different actors on different
> vaults*, so they do **not** establish a same-actor chain. Corrected in the **ADDENDUM**, where a
> genuine same-actor chain was found and verified.

Second real proof, executed read-only today:

```
tx 0x0c5405987ed7a33ff8d18c192c9f6600313fb380d62083e666b1c58c209eb181  @ block 25,773,900
VERIFY ✅ TRUE   ·  receiptStatus 1  ·  8 × SetIsAllocator decoded on Creditcoin

  vault 0xd63070114470f685b75B74D60EEc7c1113d33a3D  allocator 0xb9e9131…49de  enabled: true
  vault 0x9a8bC3B04b7f3D87cfC09ba407dCED575f2d61D8  allocator 0xb9e9131…49de  enabled: true
  vault 0x34eCe536d2ae03192B06c0A67030D1Faf4c0Ba43  allocator 0xb9e9131…49de  enabled: true
  vault 0x9480034D908989B006D78bDBBd7bD509c92E8bbC  allocator 0xb9e9131…49de  enabled: true
  … same four vaults, allocator 0xaa852a6…bbbd  enabled: false
```

A real **allocator rotation** — one appointed, one revoked, across four vaults in a single
transaction — proven and decoded on Creditcoin, including the boolean. Combined with the earlier
`ReallocateSupply` proof, the chain

```
[owner] SetIsAllocator(X, true)  ──proof #1──┐
                                             ├─► "X, an authorised allocator, moved funds to market m"
[X]     ReallocateSupply(X, m, …) ─proof #2──┘
```

was, at this point, only a **design sketch** — the two proofs named different actors on different
vaults. See the **ADDENDUM** for the same-actor version, which is verified.
`SetCurator` and `SubmitCap` remain unobserved, so the curator-policy leg is still unverified.

## 7. Limitations found during this verification

- **`SubmitCap`/`SetCap`/`SetCurator` not observed.** Scans covered up to ~700k blocks across all
  contracts, but individual chunks failed silently on RPC limits, so **coverage was incomplete and
  these counts are lower bounds, not frequencies.** Honest status: curator-policy events are rare
  and we have **no sample event yet**. This is the top open risk for the MVP demo.
- **Historical role assignments need an archive-capable log source.** Public RPCs pruned state
  (`state at block #21387476 is pruned`) and cap `getLogs` ranges. **Resolved in the ADDENDUM** via
  Blockscout's full-history log API — a 497-day-old assignment was located and proven.
- **Reinforces the known limitation:** verification is trustless; **discovery is not** — finding
  which transactions to submit still requires log scanning.

## 8. Verdict

> ## THESIS NEEDS PIVOT
>
> The *problem* survives intact — opaque, unattributable vault governance over real money.
> The *mechanism claim* was wrong and is now corrected. The product becomes a
> **role-separated verified vault authority-and-action registry** (Design B), which is both more
> accurate and a stronger fit for Attestcoin, because correct attribution genuinely requires
> composing multiple proofs rather than reading one event.

Confidence after pivot: **Medium-High**, unchanged — the correction removed a factual error
without weakening the problem, but added one new open risk (curator-policy event scarcity).

---

# ADDENDUM — Authority→Action chain, same actor (2026-08-17, later same day)

## Challenge

The first report drew the chain `SetIsAllocator(X,true) → ReallocateSupply(X,…)` as if verified.
**It was not.** The proven `ReallocateSupply` caller was `0x9e9110cf…f9e1` on steakUSDC, while the
proven `SetIsAllocator` events named `0xb9e9131…49de` / `0xaa852a6…bbbd` on four *different*
vaults. Different actors, different vaults — a design diagram presented as evidence. Conceded.

## What was then actually verified

Historical assignments for steakUSDC were retrieved from Blockscout's full-history log API (public
RPCs prune state and cap `getLogs` ranges). Ten `SetIsAllocator` events exist on the vault; one
names our actor:

```
block 22,194,870   SetIsAllocator(0x9e9110cfd24cd851ea5bc73a27975b33e308f9e1, enabled=true)
                   tx 0x52ced076746bb8682d009f0b2b6d19101e77998a866808f1b6fa8c442e4106fd
```

Both transactions were then proven and decoded on Creditcoin (`scripts/06`):

| | AUTHORITY | ACTION |
|---|---|---|
| tx | `0x52ced076…06fd` | `0x35a2f50f…e8f0` |
| block | 22,194,870 | 25,772,893 |
| Attestcoin `verify()` | **✅ TRUE** | **✅ TRUE** |
| `receiptStatus` | 1 | 1 |
| emitter == steakUSDC | ✅ | ✅ |
| actor in `topics[1]` | `0x9e9110cf…f9e1` | `0x9e9110cf…f9e1` (×3 markets) |
| content | `enabled=true` | 3 markets |

**Ordering:** 22,194,870 < 25,772,893 — the grant precedes the action by 3,578,023 blocks
(~497 days). ✅

## Verdict

> ## AUTHORITY-ACTION CHAIN VERIFIED
>
> Promoted to **the core proof composition of the MVP** (`scripts/06`), replacing single-event
> attribution. It is the concrete reason the product needs Attestcoin rather than an event lookup:
> one proof shows only that *some address* moved funds, because `onlyAllocatorRole` admits
> allocator OR curator OR owner. Attribution to a role requires composing two proofs.

## What remains unproven — do not overstate

1. **Non-revocation is unprovable.** We did not prove the grant survived to the action block; that
   is an absence claim. Blockscout's listing shows no revocation of this actor, but that is
   *indexer evidence, not proof*. Design answer: revocations are themselves events and can be
   submitted permissionlessly, so the ledger's honest state is "granted at A; no revocation proof
   submitted" — never "still authorised."
2. **Role exclusivity is unproven.** X's authority at action time could in principle have derived
   from curator/owner status rather than the allocator grant. The grant is a sufficient and
   parsimonious explanation, not an exclusive one.
3. **`isAllocator(X)` current state was NOT used as evidence of past role** — per instruction. The
   evidence is the historical grant transaction proof.
4. **Discovery is not trustless.** The grant was located via an indexer. Verification is
   trustless; finding what to verify is not. Unchanged structural limitation.
