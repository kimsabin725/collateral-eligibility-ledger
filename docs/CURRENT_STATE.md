# 현재 상태 — 항상 최신으로 유지하는 파일

**갱신: 2026-08-18 23:40 KST** · 마감까지 **D-19** (2026-09-06 13:59 KST)

## 한 줄

**아이디어 선정 완료.** 18개 후보 발굴 → 13개 제거 → Top 3 → **최종 1개 선택: `Collateral Eligibility Ledger`**.
착수 전 검증해야 할 사실 3가지가 남아 있다(아래).

## 최종 선택 — Collateral Eligibility Ledger (8.75/10)

> 발행사가 토큰을 동결·소각하거나 펀드가 환매를 중단하면 그 자산은 값이 떨어지기 **전에** 이미 담보로 못 쓴다.
> 그 사건은 이더리움에서 일어나고, 담보를 잡은 시장은 다른 체인에 있다.
> 그 사건을 Attestcoin proof로 검증해 **담보 적격성**을 뒤집는 원장.

- 전체 근거·점수·반례: `ideation/IDEA_SELECTION_2026-08-18.md`
- 2위 Double-Pledge Evidence Registry (7.70) / 3위 Look-Through Entitlement Register (6.95)
- 어제 구현물(Authority→Action)은 **KILL** 확정 — Morpho V2로 해소되는 patchable 문제

> 📌 **전체 상태를 하나로 복원하려면 루트의 `CROSS_CHAIN_COLLATERAL_ELIGIBILITY_PROJECT_STATE.md`(730줄)를 읽어라.**
> 문제정의·탐색과정·리서치 근거·설계·구현상태·리스크가 전부 들어 있는 스냅샷이다.

## 상태: **구현 진행 중** (아이디어 확정 · 로컬 전부 통과 · 배포만 faucet 대기)

판정 근거: `ideation/FINAL_VERDICT.md` (GO) · 동결 스펙: `docs/BUILD_SPEC_V2.md`

### 지금까지 만든 것

| 산출물 | 상태 |
|---|---|
| `contracts/src/EligibilityLedger.sol` | 7,431 bytes 컴파일 — 5중 검사, 최earliest-impairment 규칙, 복구 순서 검증 |
| `contracts/src/GatedCreditLine.sol` | 5,007 bytes — 신규 여신 게이팅, **출구는 절대 차단 안 함** |
| `contracts/test/eligibility.test.js` | **27/27** |
| `contracts/test/realdata-eligibility.test.js` | **10/10** — 실제 mainnet proof + 실제 EvmV1Decoder |
| `contracts/scripts/deploy-eligibility.js` | 작성 완료, faucet 게이트에서 exit 2 |
| v1(VaultAuthorityLedger) 회귀 | 15/15 + 8/8 여전히 통과 (proof 배관 검증용으로 유지) |

**회귀 총합 60/60.**

### 실제 데이터로 증명된 것 [VERIFIED]

```
sNUSD Paused @ block 25,745,732 (2026-08-13 11:14:59 UTC)
tx 0xc25678129b98d6cb082472cc38b3e9908a81829e5826325c71d62318cb2f9c9a
→ Proof Builder에서 실제 proof 취득 (txBytes 1,536B / siblings 10 / continuity roots 69)
→ 실제 EvmV1Decoder가 파싱, receiptStatus=1, sNUSD Paused 로그 확인
→ EligibilityLedger가 IMPAIRED로 전이, impairedSince=25745732
→ GatedCreditLine.openPosition() → revert AssetImpaired
```

### 남은 작업

1. **CC3 배포** — faucet만 해결되면 `node scripts/deploy-eligibility.js` 한 번으로 끝
2. 최소 프론트엔드(선택) · README/덱/데모 영상

### CONDITION 1 핵심 증거 [VERIFIED]
- **USDe**: 통제 Ethereum(`0x4c9EDD58…`, supply 3.99B) → Robinhood Chain LayerZero OFT(`0x5d3a1Ff2…`, supply 288.8M)
  → **Morpho 담보 $285,532,168 / 차입 $251,647,632 / LLTV 92%**
- **syrupUSDG**: RH Chain supply 90.8M → 담보 $90,801,145 / 차입 $79,438,999 (Maple 풀은 Ethereum)
- **Centrifuge JAAA/JTRSY**: `PoolId>>48`로 hub 체인 인코딩 → 둘 다 **hub=Ethereum**,
  spoke는 Avalanche 250,000,001 / Base 48,207,418. Base에 담보 마켓 이미 개설(사용액은 $14)

### CONDITION 3 핵심 증거 [VERIFIED]
`morpho-blue/src/Morpho.sol`(22,047B)에 pause/freeze/disable/emergency/blacklist **매치 0건**.
onlyOwner는 5개(setOwner·enableIrm·enableLltv·setFee·setFeeRecipient)뿐 → **마켓 불변, 아무도 못 멈춤.**
Euler는 전부 `governorOnly`, Aave Horizon `RwaATokenManager`(2,091B)는 **전송 권한 관리 전용**.

### 설계 제약 (Attestcoin inbound 전용)
Creditcoin은 outbound 쓰기가 불가하므로 **신용 베뉴 자체가 CC3 위에 있어야 한다.**
`Ethereum 발행사 사건 ──proof──▶ CC3 EligibilityLedger ──▶ 담보 판정·신규 여신 게이팅`

### 포지셔닝 규칙 (어기면 심사에서 깨짐)
1. "아무도 해결 안 했다" 금지 — Aave Risk Steward·Hypernative·Chaos Labs Edge 먼저 인정
2. "실시간 차단" 주장 금지 (지연 8~9분)
3. 스테이블코인 개별 지갑 블랙리스트를 근거로 쓰지 말 것 (60일 전수조사: 담보 풀 0건)
4. 근거 사건은 **자산 레벨 pause**(sNUSD형)로 한정

## 확정된 것

| 항목 | 상태 |
|---|---|
| Attestcoin 증명 단위 = 트랜잭션 1건 (state proof 없음) | **[VERIFIED]** API·SDK 전수 확인 |
| source chain 2개 (mainnet / Sepolia) | **[VERIFIED]** 온체인 조회 |
| BUIDL은 명부상 보유자에게 pro-rata mint (전원 0.026098% 일치) | **[VERIFIED]** 메인넷 실측 |
| 그 수취인 중 ERC-4626 볼트 1개가 BUIDL 15,768,036개 보유 | **[VERIFIED]** |
| Aave Horizon RWA USTB aToken이 USTB 5,775,210개 보유 | **[VERIFIED]** |
| Horizon aToken은 보유량 == totalSupply, 차액 0 (가설 기각) | **[VERIFIED]** |
| 어제 코드: 15/15 + 8/8 통과, 오늘 재실행해도 동일 | **[VERIFIED]** |

## 폐기·보류된 것

- **VaultAuthorityLedger(어제 아이디어)** — Morpho V2가 역할분리로 해소 → "패치되면 사라지는 문제"
- 8개 구조적 영역 중 6개 KILL/DOWNRANK — 상세는 `ideation/STRUCTURAL_SEARCH_ROUND1.md`
- 후보 A는 **Securitize Vault Registrar**(2026-03)가 정면 대응 중이라 89 → 76점으로 하락

## 막혀 있는 것

- **CC3 배포**: faucet이 디스코드 수동 절차. 배포 주소 `0xDd9ddFcEb1dc1dC0aE393DD458Fe376aaB60294a`
  잔액 **0 CTC** (오늘 재확인). 사람이 직접 받아야 함.
- **원문 접근 실패**: Securitize `#HyFi` 3편(medium=Cloudflare 403, securitize.io=JS앱),
  4pillars Vault Registrar 해설(429). **검색 스니펫만 확보 — 인용 확정하려면 사람이 브라우저로 열어야 함.**

## 다음에 누가 무엇을 하면 되는가

- **에이전트**: 구현 명세 작성 → `EligibilityLedger` 구현. 어제 코드의 5중 검사·시간순서 로직 재사용 가능
- **사용자**: faucet 수령(디스코드 수동) — 배포의 유일한 블로커
- **사용자**: faucet 수령(디스코드 수동) · Securitize #HyFi 원문 3편 열람(봇 차단으로 에이전트 접근 불가)

---
> 이 파일을 고친 에이전트는 맨 위 **갱신 시각**도 함께 고칠 것.
> 세션 로그 갱신: `python3 tools/export-claude-session.py`
