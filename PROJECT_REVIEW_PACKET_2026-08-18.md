# PROJECT REVIEW PACKET — 2026-08-18

> 목적: **이 프로젝트를 제3자(또는 내일의 나)가 비판적으로 검토하기 위한 단일 자료.**
> 홍보 문서가 아니다. 약한 지점과 뒤집힌 결론을 의도적으로 앞에 드러낸다.
>
> 근거 표기: **[FACT]** 실제 tx·코드·공식문서·RPC로 확인 · **[INTERPRETATION]** 도출한 해석 ·
> **[HYPOTHESIS]** 검증되지 않은 가정 · **[CORRECTED]** 폐기된 결론(기록 보존)
>
> 관련 문서: 전체 상태 스냅샷 `CROSS_CHAIN_COLLATERAL_ELIGIBILITY_PROJECT_STATE.md` ·
> GO 판정 `ideation/FINAL_VERDICT.md` · 동결 스펙 `docs/BUILD_SPEC_V2.md`

---

# 1. Executive Snapshot

## 지금 프로젝트가 뭔지

자산의 통제 주체가 있는 **소스 체인(Ethereum)** 에서 발생한 **자산 레벨 담보 훼손 사건**(예: 토큰 컨트랙트
`Paused`)을 **Attestcoin proof**로 검증하고, **다른 체인(Creditcoin CC3)의 신용 베뉴**가 그 사실을 스스로 확인해
**그 사건 이후의 신규 여신만** 차단하는 PoC.

한 줄 요약: **assertion(누가 그렇다고 말함)을 proof(목적지가 직접 검증함)로 바꾼다.**

## 현재 판정

**GO** — 단, 조건부가 아니라 "3개 binary condition을 모두 증거로 판정한 뒤" 내린 GO다.

| Condition | 판정 | 증거 수준 |
|---|---|---|
| 1. 실제 cross-chain collateral workflow 존재 | **YES** | 온체인 실측 |
| 2. 기존 벤더가 end-to-end로 해결 | **NO** | 벤더 공식 문서 전수 |
| 3. 목적지 프로토콜이 발행사 status 자동 소비 | **NO** | Solidity 소스 직접 확인 |

## 어디까지 구현됐는지

| 항목 | 상태 |
|---|---|
| `EligibilityLedger.sol` (311줄 / 7,431B) | **DONE** |
| `GatedCreditLine.sol` (213줄 / 5,007B) | **DONE** |
| 유닛 테스트 | **27/27** |
| 실데이터 테스트(실제 mainnet proof + 실제 EvmV1Decoder) | **10/10** |
| v1 회귀(폐기된 아이디어, 배관 검증용) | 15/15 + 8/8 |
| 배포 스크립트 | 작성 완료, **미실행** |
| CC3 배포 | **미완** — faucet(디스코드 수동) 대기 |
| 프론트엔드 / README / 덱 / 데모영상 | **미착수** |

## 아직 남은 핵심 의문 (§10에서 상세)

1. **같은 자산에서 "크로스체인 사용"과 "실제 훼손 사건"을 동시에 확인하지 못했다.** 두 개의 다른 자산으로 나눠
   증명했다. 이게 치명적인가?
2. **목적지 체인의 로컬 표현이 이미 훼손을 반영한다면 Attestcoin이 불필요하다.** 이 조건을 아직 검증하지 않았다.
3. Centrifuge는 **hub→spoke 자체 메시징**을 이미 갖고 있다. 그럼 우리 레이어는 무엇을 더하는가?

---

# 2. Problem Definition

## 해결하려는 문제

기관 담보관리는 담보를 **두 축**으로 본다.

| 축 | 내용 | 온체인 대출 |
|---|---|---|
| **가격** | 시가·헤어컷·변동성 | ✅ oracle price, LTV/LLTV, 청산임계 |
| **적격성** | redeemability, transferability, 발행사 통제, 자산 pause, 법적·운영상 사용가능성 | ❌ 사실상 없음 |

> **가격이 아직 움직이지 않았어도 자산은 먼저 담보로 부적격해질 수 있다.**

**[FACT]** ECB/Eurosystem은 적격 담보 기준을 Guideline (EU) 2015/510 Part Four에 규정하고 NCB가 사전 심사 후
목록에 게시한다. ICMA 삼자repo는 등급별 eligibility set과 헤어컷을, ISDA는 관할별 적격담보 비교표를 유지한다.
*(⚠️ "비가격 사유로 적격성이 상실된다"는 조항을 **원문 verbatim으로 인용하지는 못했다.** 제출 전 확인 필요)*

## 왜 institutional DeFi / RWA에서 중요한가

**[FACT]** Stream Finance(2025-11-04): $93M 손실 → 입출금 중단 → xUSD $1→$0.1. 그런데 Morpho·Euler·Silo가
**하드코딩 $1**로 평가해 청산이 걸리지 않았고, 차입자가 USDC를 빼가 대주가 부실을 떠안았다. 총 **$285M** 익스포저.
업계는 이를 "**14개월간 4번째 하드코딩 오라클 사고**"로 분류했다.

**[INTERPRETATION]** 이 사고의 표면 원인은 오라클이지만, 구조적으로는 **환매중단이라는 적격성 사건이 가격 축에
반영되기까지의 공백**에서 손실이 났다.

## ⚠️ 여기서 이미 하나의 논리 점프가 있다 (스스로 지적)

업계 사후분석의 합의는 "**하드코딩 오라클이 문제였다, 실거래가를 쓰라**"이다. 즉 **"오라클을 제대로 쓰면 해결"**
이라는 반론이 성립한다. "적격성이라는 별도 축이 필요하다"는 우리 프레이밍은 **[INTERPRETATION]** 이지
업계 합의가 아니다. 이 점을 숨기면 안 된다.

---

# 3. Idea Selection History

18개 후보 발굴 → 13개 제거 → Top 3 → 최종 1개.

## 죽은 후보들 (요약)

| 후보 | 사망 원인 |
|---|---|
| **Morpho Authority→Action** (v1, 구현까지 완료) | **[FACT]** Morpho Vault V2가 역할분리를 강화 → "프로토콜이 패치하면 사라지는 문제" |
| Cross-chain Institutional Credential | **[FACT]** Chainlink ACE가 cross-chain identity·credential·expiry·revoke 제공 |
| Credential Revocation / 퇴사자 권한회수 | ACE 등이 직접 지원 + Attestcoin은 부재 증명 불가라 kill switch에 부적합 |
| Approval Workflow / Maker-Checker | **[FACT]** Safe·Fireblocks·Fordefi가 이미 성숙 |
| Protocol Upgrade / Approval Expiry | **[FACT]** Hypernative가 upgrade·admin·parameter 모니터링 제공 |
| Global Investment Mandate | **[FACT]** Mellow, Centrifuge V3.3 Onchain Execution Policy(2026-08-05) |
| **Look-Through Entitlement Register** | **[FACT]** Securitize **Vault Registrar**(2026-03)가 정면 대응, sToken은 그 이유로 deprecated |
| Double-Pledge Evidence Registry | DeFi 과담보에서 이중담보는 **정상 동작** — TradFi 개념 오이식 반론 |
| Cross-chain DvP / stale NAV / 제재자금 추적 / 커스터디 통제 / PoR / best-ex / 법적 finality / 도산 / 회계 | 각각 Chainlink CRE·RedStone·Hypernative·Fireblocks·Chainlink PoR·Flashbots·입법진행·오프체인 트리거·강제력 부재로 제거 |

## 왜 Collateral Eligibility가 1위가 됐나

| 기준 | 이유 |
|---|---|
| **Attestcoin 적합성** | 대상이 **이산 사건**이라 state proof·부재 증명·outbound 쓰기가 전부 불필요. 다른 후보들은 하나 이상에서 막혔다 |
| **실데이터** | 5일 전 실제 사건이 존재(§5) |
| **patchability** | 발행사는 Aave/Morpho를 패치할 수 없고, 프로토콜은 발행사 통제권을 없앨 수 없음 |
| **포트폴리오** | 담보 적격성·헤어컷·부적격 통지는 증권사/운용사 리스크·담보관리 실무 언어 |
| **점수** | 가중 8.75/10 (2위 Double-Pledge 7.70, 3위 Look-Through 6.95) |

---

# 4. Pre-Build Validation

## 4-Gate (1차 검증, 이후 3-Condition으로 갱신)

| Gate | 판정 | 근거 |
|---|---|---|
| 1. 실제 금융 문제인가 | **PASS** | ECB/ICMA/ISDA 적격성 프레임워크 실재 |
| 2. 기존 인프라 갭 | **PARTIAL** ⚠️ | Hypernative 초단위 자동 pause, Aave 5체인 동시 LTV0, Chainlink MVR |
| 3. 실제 온체인 사건 | **PASS** | sNUSD `Paused` 실측 |
| 4. 크로스체인 자연성 | **PARTIAL** ⚠️ → **[CORRECTED] 이후 PASS** | 당시엔 same-chain 사례만 확보 → 추가 조사로 $285M 크로스체인 담보 확인 |

## Hard Kill 조건 (하나라도 확인되면 총점 무관 탈락)

- 기존 제품이 사실상 end-to-end 해결 → **미확인**
- 실제 eligibility event 사례 없음 → **반증됨**(sNUSD)
- 크로스체인 설정이 정당화 안 됨 → **반증됨**(USDe $285M)
- Attestcoin 없이 단순 RPC/oracle로 거의 동일 → **부분 성립**(같은 체인이면 그렇다 → 범위를 다른 체인으로 한정)
- Attestcoin 능력상 핵심 로직 구현 불가 → **반증됨**(구현·테스트 완료)
- 가격/리스크 파라미터만으로 충분 → **부분 성립**(§2의 논리 점프 참조)

## GO까지 간 실제 근거

**CONDITION 1 (YES)** — USDe: 통제 Ethereum(`0x4c9EDD58…`, supply 3.99B) → Robinhood Chain LayerZero OFT
(`0x5d3a1Ff2…`, supply 288.8M) → Morpho 담보 **$285,532,168** / 차입 **$251,647,632** / LLTV 92%.

**CONDITION 2 (NO)** — Chainlink 프로덕션 SmartData 피드는 **PoR·NAVLink·SmartAUM 3종뿐**. Hypernative는
**고용 고객 자신의** 컨트랙트만 pause. Chaos Labs Edge는 **시장 지표** 입력·같은 체인·범위 제한.
네 단계(`발행사 사건 → 크로스체인 검증 → 목적지 대출 → 담보 판정`)를 잇는 경로 미발견.

**CONDITION 3 (NO)** — `morpho-blue/src/Morpho.sol`(22,047B)에 pause/freeze/disable/emergency/blacklist
**매치 0건**. Euler는 전부 `governorOnly`. Aave Horizon `RwaATokenManager`(2,091B)는 **전송 권한 관리 전용**.

---

# 5. Evidence

## ✅ sNUSD pause — "사건 유형이 실재한다"

```
token   sNUSD (Staked NUSD, Neutrl)  0x08efcc2f3e61185d0ea7f8830b3fec9bfa2ee313  (Ethereum)
event   Paused(address)
block   25,745,732      2026-08-13 11:14:59 UTC      tx status = 1, 로그 1건
tx      0xc25678129b98d6cb082472cc38b3e9908a81829e5826325c71d62318cb2f9c9a
```

같은 시점 보유 컨트랙트 **[FACT]**:

| 보유자 | 보유량 | 정체 |
|---|---:|---|
| `0x10c5e771…62666409` | 8,202,400 sNUSD | `SY-sNUSD` (Pendle Standardized Yield) |
| `0xbbbbbbbb…37eeffcb` | 1,828,755 sNUSD | **Morpho Blue 싱글턴** |
| `0x00000000…3de08a90` | 7,710 sNUSD | Uniswap V4 PoolManager |

**[FACT]** Morpho sNUSD/USDC 마켓 차입 잔액 **$1,661,397**, 보고 담보가치 $0.
**[FACT]** Neutrl이 준비금 문제로 NUSD 발행·환매 중단(2026-08-14 공표, 유통 ~$53.6M). 다운스트림 Strata는
**별도로 스스로** srNUSD·jrNUSD 기능을 중단 — 자동 전파가 아니었다.

> ⚠️ **한계:** 이 사건은 **cross-chain이 아니다.** sNUSD·Pendle·Morpho 전부 Ethereum.

## ✅ USDe × Robinhood Chain — "크로스체인 구조가 실재한다"

```
source        USDe  0x4c9EDD5852cd905f086C759E8383e09bff1E68B3  (Ethereum)
              totalSupply 3,992,807,046 · owner() 0xE8Dc0Fab… · minter() 0xe3490297…
              paused()/isBlacklisted() → 바이트코드에 선택자 없음
destination   Robinhood Chain (4663, Arbitrum Orbit L2)
              USDe  0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34  supply 288,815,204
              endpoint() 0x6F475642… + peers(uint32) → LayerZero OFT
venue         Morpho Blue — 담보 $285,532,168 / 차입 $251,647,632 / LLTV 92%
```

> ⚠️ **한계:** **USDe에서 pause 사건이 실제 발생한 적이 없다.** 토큰에 pause 기능조차 없다.
> 이 사례는 **구조 증명**이지 사건 증명이 아니다.

## ✅ syrupUSDG (Maple)

```
Robinhood Chain  0x40858070814a57FdF33a613ae84fE0a8b4a874f7  supply 90,799,994
Morpho 담보 $90,801,145 / 차입 $79,438,999 / LLTV 92%
Maple 크레딧 엔진·풀은 Ethereum ("Ethereum과 Robinhood Chain에서 이용 가능")
```

## ✅ Centrifuge — hub/spoke 분리가 설계 단계에 존재

**[FACT]** `PoolId >> 48 = centrifugeId`(hub 체인). 매핑: 1=Ethereum, 2=Base, 3=Arbitrum, 4=Plume,
5=Avalanche, 6=BNB, 9=HyperEVM, 10=Optimism, 11=Monad, 12=Pharos.

| 토큰 | poolId | **hub** | 체인별 공급 |
|---|---|---|---|
| JAAA `0x5a0F93D0…` | 281474976710663 | **Ethereum** | ETH 371,157,461 · Avalanche 250,000,001 · Base 48,207,418 |
| JTRSY `0x8c213ee7…` | 281474976710662 | **Ethereum** | ETH 783,770,063 · Plume 496,381 |
| deJAAA `0xAAA0008C…` | 281474976710659 | **Ethereum** | ETH 5,471,277 · Base 675,661 |

Base에 deJAAA·JTRSY 담보 Morpho 마켓 **개설됨**(LLTV 86~98%) — 다만 사용액 **$14**.

> ⚠️ **주의:** Centrifuge는 hub→spoke **자체 메시징으로 가격·상태를 배포**한다. 즉 이 생태계에서는
> 발행사가 이미 크로스체인 통제 채널을 갖고 있다. §10에서 다룬다.

## ❌ [CORRECTED] USDC/USDT blacklist — 근거로 쓸 수 없음

초기엔 "발행사 통제 행위가 상시 발생한다"는 근거로 삼으려 했다(15일 표본: USDC `Blacklisted` 7건,
USDT `AddedBlackList` 16건, `DestroyedBlackFunds` 15건).

**60일 전수 디코딩 결과 [FACT]:** `DestroyedBlackFunds` **31건, 총 6,961,544 USDT 소각**. 컨트랙트 대상 4건은
전부 **23바이트 스마트월렛/위임 계정 또는 outboundTxCount=1 소형 컨트랙트**. **담보 풀·대출 프로토콜은 0건.**

> **결론: 개별 지갑 freeze는 asset-level eligibility 사건이 아니다. 근거로 쓰지 않는다.**

## ❌ [CORRECTED] sBUIDL × Euler(Avalanche) — 크로스체인이 아님

```
sBUIDL 0xaEb1FA0853c7C98EAb10fcF0EA669aE3d07FBB10  asset() → 0x53FC82f1…(Avalanche BUIDL, supply 634,332,208)
→ 통제와 담보가 같은 체인. sBUIDL supply는 9,240까지 감소(사실상 휴면)
```
Avalanche JAAA 250,000,001개도 최근 50k 블록 전송 0건, 주요 대출 베뉴 보유 0 → 휴면.

---

# 6. Prior Art / Threats

**원칙: "비슷한 기능 존재"와 "end-to-end 해결"을 구분한다. 과소평가하지 않는다.**

| 제품 | 이미 해결하는 것 | 남는 부분 | Threat |
|---|---|---|---|
| **Hypernative** | **[FACT]** 탐지→사전승인 온체인 액션 **수 초 내** 실행. 2026-05-07 Parallel USDp 실제 pause. **Neutrl의 pauser** | 고용 고객 **자신의** 컨트랙트만. 제3자 자동 전파 없음(Strata 별도 대응이 증거). 벤더 **신뢰** 필요 | **HIGH** |
| **Aave** | **[FACT]** 2026-04 rsETH를 Ethereum·Arbitrum·Base·Mantle·Linea **5체인 동시** pause+LTV=0. Chaos Labs Edge→StewardsInjector로 파라미터 자동 주입 | 트리거가 **사람 또는 시장지표**. 발행사 사건 자동 소비 아님. Horizon 발행사 훅은 전송 권한 전용 | **HIGH** |
| **Chainlink** | **[FACT]** SmartData(PoR·NAVLink·SmartAUM), MVR로 **비숫자 데이터 전달 가능**, ACE/CCT 컴플라이언스, CCIP | "전달 가능"≠"적격성 피드가 프로덕션에 존재". assertion 모델 | **HIGH** |
| **Morpho Blue** | 큐레이터가 cap 0·supply queue 비우기로 즉시 대응 | **[FACT]** 코어 마켓에 **임의 pause primitive 없음**(소스 전수 검색). 실질 통제점은 oracle | MEDIUM |
| **Euler v2** | **[FACT]** `setHookConfig`로 오퍼레이션 차단 가능 | 전부 `governorOnly`(사람). 단 **훅으로 외부 status 통합은 기술적으로 가능** | MEDIUM |
| **Chaos Labs** | **[FACT]** Edge Risk Oracle이 Aave에 실제 자동 주입(동적 cap) | 입력이 시장 지표, 같은 체인, 거버넌스 범위 제한, 신뢰 퍼블리셔 | MEDIUM |
| LlamaRisk / Blockaid / RedStone | PT 리스크 체크 / 실행시점 차단 / RWA 청산 결제 | 각각 자산특화·트랜잭션판정·청산실행이지 적격성 아님 | LOW |

**KILLS IDEA 등급은 없다. 그러나 HIGH가 3개다.**

---

# 7. Current Product Design

## 아키텍처

```
Ethereum (자산 통제)                      Creditcoin CC3 (신용 공여)
  자산 레벨 적격성 사건   ──proof──▶   EligibilityLedger ──▶ GatedCreditLine
  예: sNUSD Paused                       (5중 검사·상태기계)   (신규 여신 게이팅)
```

## 상태 기계

```
NO_PROOF ──impairment proof──▶ IMPAIRED ──restoration(엄격히 더 나중)──▶ RESTORED
```

## 5중 검사 (순서 고정)

1. **리플레이 방지** — `keccak(chainKey, blockHeight, txIndex)`, txIndex는 precompile이 재계산(제출자 조작 불가)
2. **포함·연속성 증명** — BlockProver precompile
3. **소스 tx 성공** — `receiptStatus == 1` (precompile은 확인하지 않음)
4. **emitter 허용목록** — 등록 자산의 로그만
5. **이벤트 시그니처** — 등록된 훼손/복구 시그니처와 일치

미일치 로그는 **skip**(배치 tx 때문). 매칭 0건이면 `NoMatchingEvent`로 revert하고 아무것도 쓰지 않음.
자산은 **정확히 하나의 소스 체인**에 등록 — 다른 chainKey면 `WrongChainKey` revert.

## A. Exit non-gating ⭐

훼손이 증명돼도 **항상 허용**: `repay`, `withdrawCollateral`
차단: `openPosition`, `borrowMore`, `addCollateral` (= 신규 리스크 생성)

> **gate new risk, never trap existing users.**

리스크 통제가 출구까지 막으면 통제가 아니라 인질극이다. 테스트로 고정.

## B. Earliest impairment cutoff ⭐

가장 **이른** 증명된 블록을 cutoff로 유지. 더 늦은 proof는 밀지 못하고(`EventIgnored` 기록), 더 이른 proof는 앞당김.

> 실제 훼손 이후 나간 여신은 **proof가 늦게 도착했다는 이유로 정상 거래가 되지 않는다.**

## C. Recovery rule

- 훼손이 먼저 증명된 경우에만 유효
- 훼손보다 **엄격히 나중**이어야 함
- 이미 알려진 복구보다 오래된 proof는 무시
- 더 이른 훼손이 새로 증명되면 그보다 이르거나 같은 복구는 **무효화**
- 무시된 이벤트도 히스토리에 남김(조용히 버리지 않음)

## Attestcoin 제약 (설계를 강제한 요인) [FACT]

| 제약 | 확인 방법 |
|---|---|
| 상태 증명 불가 | Proof Builder OpenAPI 전 엔드포인트 + SDK 인터페이스 전수 → account/storage 경로 없음 |
| 부재 증명 불가 | 원리적 |
| outbound 쓰기 불가 | 공식 문서: writability는 감사 중, 배포 주소 없음 |
| 지원 체인 2개 | ChainInfo precompile 직접 조회 (mainnet=3, Sepolia=1) |
| 지연 8~9분 | 2회 측정(41·43블록) |

→ 이 다섯 제약을 **하나도 건드리지 않는** 설계가 현재 형태다.

---

# 8. Current Implementation State

| 파일 | 크기 | 상태 |
|---|---|---|
| `contracts/src/EligibilityLedger.sol` | 311줄 / 7,431B | DONE |
| `contracts/src/GatedCreditLine.sol` | 213줄 / 5,007B | DONE |
| `contracts/src/vendor/EvmV1Decoder.sol` | 10,303B | DONE (`@gluwa/usc-contracts@0.1.2` verbatim) |
| `contracts/test/eligibility.test.js` | 236줄 | **27/27** |
| `contracts/test/realdata-eligibility.test.js` | 184줄 | **10/10** |
| `contracts/test/ledger.test.js` + `realdata.test.js` | v1 회귀 | 15/15 + 8/8 |
| `contracts/scripts/deploy-eligibility.js` | 157줄 | 작성 완료, **미실행** |

**총 60/60.**

## 실데이터 테스트가 실제로 한 일 [FACT]

```
Proof Builder 실제 proof: txBytes 1,536B · siblings 10 · continuity roots 69
→ 실제 EvmV1Decoder 파싱, receiptStatus=1, 로그 1건
→ sNUSD Paused 확인 (emitter 0x08EFCC2F3e61185D0EA7F8830B3FEc9Bfa2EE313)
→ EligibilityLedger: NO_PROOF → IMPAIRED, impairedSince = 25,745,732
→ GatedCreditLine.openPosition() → revert AssetImpaired
```
BlockProver precompile만 mock (CC3 런타임이라 로컬 부재, spike/01–06에서 실제 mainnet tx로 이미 검증됨).

## CC3 faucet blocker

```
deploy wallet  0xDd9ddFcEb1dc1dC0aE393DD458Fe376aaB60294a
balance        0.0 CTC
faucet         Discord #token-faucet  →  /faucet address:0xDd9ddFcEb1dc1dC0aE393DD458Fe376aaB60294a
스크립트       잔액 0이면 안내 출력 후 exit code 2
```

---

# 9. Claims / Non-Claims

## ✅ 주장 가능한 것

1. 소스 체인의 명시적 담보 훼손 사건을, 목적지 신용 베뉴가 **proof로 스스로 검증**하고 그 사건 **이후의 신규
   여신을 제한**할 수 있다.
2. 사건은 **이산적**이고 **시간순서**가 판정에 결정적이다.
3. 이 설계는 Attestcoin의 다섯 제약을 하나도 건드리지 않는다.
4. **실제 5일 된 mainnet 사건**으로 전 경로를 관통시켰다(로컬).

## ❌ 절대 주장하면 안 되는 것

| 금지 주장 | 이유 |
|---|---|
| **실시간 차단** | 지연 8~9분. Hypernative는 초 단위 — 속도로는 진다. "delayed but verifiable gating for new credit"으로만 |
| **기존 Morpho 마켓을 멈춘다** | Blue 코어엔 pause primitive가 없어 **누구도 못 멈춘다**. 우리 게이팅은 **CC3 베뉴 한정** |
| **`NO_PROOF` = 건강함** | 부재는 증명 불가. "아직 훼손 proof가 ingest되지 않았다"는 뜻일 뿐 |
| **아무도 해결 안 했다** | Hypernative·Aave Risk Steward·Chaos Labs Edge를 먼저 인정하고, 차이를 **입력(시장지표 vs 발행사 사건)** 과 **신뢰 모델(assertion vs proof)** 로 설명 |
| **개별 지갑 블랙리스트가 근거다** | 60일 전수조사 결과 담보 풀 0건. 근거는 자산 레벨 pause로 한정 |
| **Stream Finance를 막을 수 있었다** | counterfactual. 업계 합의 원인은 하드코딩 오라클 |

---

# 10. Open Questions for Tomorrow

> 이 섹션이 이 패킷에서 가장 중요하다. 방어하지 말고 읽을 것.

## Q1. 같은 자산에서 cross-chain + impairment를 동시에 못 찾은 게 치명적인가?

**사실관계:** 증거가 두 자산으로 쪼개져 있다.
- sNUSD → 실제 훼손 사건 O, 크로스체인 X
- USDe → 크로스체인 O ($285M), 훼손 사건 X (pause 기능 자체가 없음)

**치명적이지 않다고 보는 근거 [INTERPRETATION]:** 우리가 증명해야 하는 건 두 가지 **독립 명제**다 —
①이런 사건이 실제로 일어난다 ②통제와 신용이 다른 체인인 구조가 실재한다. 각각 강한 증거가 있고,
둘의 결합은 **시간 문제**라고 볼 수 있다(RWA·합성달러가 멀티체인으로 확산 중이므로).

**치명적일 수 있다고 보는 근거:** 심사위원이나 면접관이 "그럼 그 결합 사례를 하나만 보여달라"고 하면
**보여줄 수 없다.** "곧 생길 것이다"는 [HYPOTHESIS]이지 증거가 아니다.

**내일 할 일:** 결합 사례를 **한 번 더 찾아본다.** 후보 —
① 멀티체인 배포된 합성달러 중 pause 기능이 있는 것(예: sUSDe? 다른 체인 표현에 pause가 있는지)
② Centrifuge spoke 토큰의 freeze/restriction 이벤트
③ 브리지된 RWA 중 발행사가 로컬 표현을 동결한 사례
찾으면 서사가 결정적으로 강해지고, 못 찾으면 **한계를 명시적으로 말하는 편이 낫다.**

## Q2. 목적지의 로컬 표현이 이미 훼손을 반영하면 Attestcoin이 불필요하지 않은가? ⚠️ 최대 약점

발행사가 자체 브리지/메시징으로 목적지 토큰에도 pause를 전파한다면, 목적지 대출시장은 **로컬 컨트랙트를 읽으면
끝**이다. Attestcoin이 필요 없다.

우리 가치가 성립하는 조건은 좁다:
> **소스 측 사건이 목적지 체인에 온체인 대응물을 갖지 않을 때** (예: 발행·상환 레이어의 중단, 펀드 레벨 결정)

**내일 할 일:** USDe·syrupUSDG·JAAA의 **목적지 표현에 pause/freeze/restriction 기능이 있는지** 바이트코드로 확인.
있으면 우리 명제의 적용 범위가 크게 줄어든다. **이걸 확인하기 전에는 서사를 확정하지 말 것.**

## Q3. Centrifuge는 이미 hub→spoke 메시징이 있는데 우리가 뭘 더하나?

Centrifuge V3는 hub에서 가격·상태를 **모든 네트워크로 배포**한다. 즉 발행사 자신은 이미 크로스체인 통제 채널이 있다.
우리 레이어의 대상은 **그 채널에 연결되지 않은 제3자 프로토콜**인데, 그 제3자는 결국 spoke 토큰의 **로컬 상태**를
읽으면 되지 않나? → Q2와 같은 뿌리의 질문이다.

**[INTERPRETATION]** 남는 답: Centrifuge가 배포하는 것을 신뢰하는 것 vs 소스 사건을 검증하는 것의 차이(신뢰 모델).
하지만 이건 **약한 차별점**이다. 정직하게 인정해야 한다.

## Q4. Attestcoin이 정말 필요한가?

**필요하다고 보는 근거:** 목적지 컨트랙트가 벤더·DON을 신뢰하지 않고 **직접 검증**한다. 담보 자격을 끄는 권한은
금융적으로 큰 권한이고, 그것을 누구에게 주느냐는 기관에게 실제 질문이다.

**불필요하다고 보는 근거:** ①같은 체인이면 직접 읽기가 단순 ②Chainlink MVR로 status 전달 가능(assertion이지만
실무적으로 충분할 수 있음) ③8~9분 지연은 순수 열위 ④**시장이 proof 기반을 원한다는 증거가 없다** [HYPOTHESIS]

**균형 판단:** 해커톤 요건(Attestcoin 필수 사용)에는 완벽히 부합한다. **제품 논리로서는 "신뢰 모델 개선"이
유일한 축**이며, 이 축 하나로 버티는 프로젝트라는 점을 인지하고 있어야 한다.

## Q5. 논리 점프는 없는가?

발견된 점프 3개(모두 문서에 표시함):
1. **§2** — "적격성 축이 필요하다"는 우리 프레이밍이지 업계 합의가 아니다(합의는 "오라클 제대로 쓰라").
2. **§5** — 두 자산의 증거를 하나의 서사로 이어붙이면 안 된다.
3. **§10-Q2** — "목적지가 모른다"를 검증 없이 전제하고 있다.

## Q6. 포트폴리오로 강한가?

**강한 부분:** 담보 적격성·헤어컷·부적격 통지라는 TradFi 실무 언어로 설명된다. Stream Finance를 주소·금액까지
추적했고, prior art를 정확히 알고 있다는 것 자체가 신호다. "assertion vs proof"라는 신뢰 모델 논의로 확장 가능.

**약한 부분:** 최종 산출물이 **PoC 신용 베뉴**라 "실제로 누가 쓰나"에 답하기 어렵다. Q2가 미해결이면
"그건 로컬에서 읽으면 되잖아요"라는 한 마디에 무너질 수 있다.

**결론 [INTERPRETATION]:** Q2를 확인하고, 그 결과에 맞게 **적용 범위를 좁혀서 정확히 말하는 것**이
과장하는 것보다 포트폴리오로 훨씬 강하다.

---

# 11. Raw Session Evidence / Important Excerpts

## 중요한 판단 전환 (시간순)

| 시점 | 전환 |
|---|---|
| 1 | v1(Morpho Authority→Action) **폐기** — Morpho V2 역할분리로 patchable 판정 |
| 2 | 8개 구조영역 스윕 → Look-Through가 1위(89점) |
| 3 | **Attestcoin에 state proof가 없음을 확인** → Look-Through 76점으로 강등, 설계 원칙 도출("사건은 되고 상태는 안 된다") |
| 4 | Securitize **Vault Registrar** 발견 → Look-Through 3위로 하락 |
| 5 | 18개 후보 재발굴 → Collateral Eligibility 1위(8.75) |
| 6 | 사전검증에서 Gate 2·4 **PARTIAL** → **CONDITIONAL GO** |
| 7 | 자율조사로 **USDe $285M 크로스체인 담보 발견** → Gate 4 판정 뒤집힘 → **GO** |
| 8 | 구현 완료, 실제 sNUSD proof로 관통 |

## [CORRECTED] 된 결론 5개

1. "적격성 축이 온체인에 없다" → **틀림.** 축은 있음(Aave LTV0, Morpho cap0, Hypernative 자동 pause).
   없는 건 **제3자 간 검증 가능한 전파 경로**.
2. "스테이블코인 블랙리스트가 근거" → **틀림.** 60일 전수 결과 담보 풀 0건.
3. "sBUIDL×Euler가 크로스체인" → **틀림.** Avalanche BUIDL을 감싼 같은 체인, 휴면.
4. "Gate 4 크로스체인 자연성 PARTIAL" → **뒤집힘.** USDe $285M 확인 후 PASS.
5. "Hypernative는 알림만 한다" → **틀림.** 초 단위로 실제 pause 실행, Neutrl의 pauser.

## 실제 shell/RPC 결과 요약 (원문 재검토 대상)

```
[Attestcoin 지원 체인]  spike/scripts/03-chain-info.js
  chainKey 3 "Ethereum"          latest attested 25,781,430
  chainKey 1 "Sepolia ethereum"  latest attested 11,514,550
  → Supported source chains: 2

[Proof Builder 엔드포인트]  /api/swagger/openapi.json
  proof-by-tx / proof / proof-batch / proof-batch-by-tx / attested-height / health
  → account·storage 증명 경로 없음

[Morpho Blue 소스]  morpho-blue/src/Morpho.sol (22,047B)
  grep pause|freeze|frozen|disable|emergency|shutdown|blacklist → 0건
  onlyOwner: setOwner, enableIrm, enableLltv, setFee, setFeeRecipient

[Robinhood Chain USDe]  rpc.mainnet.chain.robinhood.com
  endpoint() 0x6F475642a6e85809B1c36Fa62763669b1b48DD5B ; peers(uint32) 존재 → LayerZero OFT
  supply 288,815,204

[Morpho API — RWA 담보 by chain]
  Ethereum $135,573,390 · Robinhood Chain $90,801,145 · Arbitrum $106,883 · Base $27,892 · Polygon $0
  (wJAAA on Ethereum: 담보 $4,314,521 / 차입 $3,785,879 / LLTV 98%)

[USDT 60일 전수]  DestroyedBlackFunds 31건 / 6,961,544 USDT 소각
  컨트랙트 대상 4건 → 전부 23바이트 스마트월렛·소형 컨트랙트, 담보 풀 0건

[sNUSD 이벤트 스캔]  Paused(address) 1건 @ 25,745,732, tx status 1

[Centrifuge]  Ethereum Spoke AddShareClass 30건 전수 → JAAA/JTRSY/deJAAA 모두 hub=Ethereum(centrifugeId 1)

[테스트]  27/27 · 10/10 · 15/15 · 8/8
```

## 원문 세션에서 재검토할 대목

- `private/private/docs/SESSION_LATEST.md (비공개)` (비공개, 저장소 밖) — 전체 도구 호출 로그(223건). 특히:
  - Attestcoin OpenAPI 전수 확인 대목 (설계 최상위 제약의 출처)
  - USDe OFT 판정 대목 (Condition 1의 결정적 근거)
  - USDT 전수 디코딩 대목 (가설 폐기의 근거)
- `ideation/FINAL_VERDICT.md` — 3-Condition 판정 전문
- `ideation/PREBUILD_VALIDATION.md` — 뒤집히기 전의 CONDITIONAL GO 논리(왜 틀렸는지 대조용)

---

# 12. Code Reference

아래는 현재 커밋(`4b7d6dd`)의 실제 파일 내용이다.

## 12-1. `contracts/src/EligibilityLedger.sol` (전체)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// @notice Creditcoin BlockProver precompile (0x…0FD2). Verifies transaction inclusion and block
///         continuity. It does NOT check whether the transaction succeeded — the dApp must.
interface INativeQueryVerifier {
    struct MerkleProofEntry { bytes32 hash; bool isLeft; }
    struct MerkleProof { bytes32 root; MerkleProofEntry[] siblings; }
    struct ContinuityProof { bytes32 lowerEndpointDigest; bytes32[] roots; }

    function verifyAndEmit(
        uint64 chainKey,
        uint64 height,
        bytes calldata encodedTransaction,
        MerkleProof calldata merkleProof,
        ContinuityProof calldata continuityProof
    ) external returns (bool);

    function calculateTxIndex(MerkleProof calldata merkleProof) external view returns (uint64);
}

/// @notice EvmV1Decoder from @gluwa/usc-contracts, deployed separately.
interface IEvmDecoder {
    struct LogEntry { address address_; bytes32[] topics; bytes data; }
    struct ReceiptFields {
        uint8 receiptStatus;
        uint64 receiptGasUsed;
        LogEntry[] receiptLogs;
        bytes receiptLogsBloom;
    }
    function decodeReceiptFields(bytes memory chunk) external pure returns (ReceiptFields memory);
}

/**
 * @title EligibilityLedger
 * @notice Records, on Creditcoin, that an asset-level event on a source chain has impaired the
 *         asset's usability as collateral — admitted only on an Attestcoin proof of the source
 *         transaction.
 *
 * @dev WHY THIS EXISTS. Institutional collateral is managed on two axes: price, and *eligibility*.
 *      When an issuer pauses redemptions or freezes an instrument, the asset stops being usable as
 *      collateral before its price moves. Onchain lending only has the price axis. Where the asset
 *      is controlled on one chain and lent against on another, the credit venue has no way to see
 *      the event at all — today it must trust a monitoring vendor or an oracle publisher.
 *
 *      This contract replaces that assertion with a proof the destination verifies itself.
 *
 *      WHAT IT DELIBERATELY DOES NOT CLAIM:
 *        - that an asset is healthy. Absence of an event is unprovable; NO_PROOF means only that
 *          nothing has been proven here.
 *        - a complete event history. Only submitted, proven events exist in this ledger.
 *        - real-time protection. Attestation lags the source chain by roughly 8–9 minutes, so this
 *          gates NEW credit, it does not block a transaction in flight.
 */
contract EligibilityLedger {
    // ─────────────────────────────── types ───────────────────────────────

    enum Status {
        NO_PROOF,  // nothing proven — NOT a statement that the asset is fine
        IMPAIRED,  // an impairment event has been proven
        RESTORED   // a restoration strictly later than the impairment has been proven
    }

    struct Asset {
        bool registered;
        uint64 chainKey;      // Attestcoin source-chain id the asset lives on
        uint64 impairedAt;    // EARLIEST proven impairment block (0 = none)
        uint64 restoredAt;    // proven restoration block, strictly later than impairedAt
        string label;
    }

    struct Event {
        address asset;
        bytes32 sig;
        bool impairment;      // false = restoration
        uint64 srcChainKey;
        uint64 srcBlock;
        uint64 admittedAt;    // Creditcoin block in which the proof was admitted
    }

    // ────────────────────────────── storage ──────────────────────────────

    address public immutable owner;
    INativeQueryVerifier public immutable VERIFIER;
    IEvmDecoder public immutable DECODER;

    /// @dev keccak(chainKey, blockHeight, txIndex) — keyed by POSITION, so a submitter cannot
    ///      influence it. txIndex is recomputed on-chain by the precompile.
    mapping(bytes32 => bool) public processedQueries;

    /// @dev Emitter allowlist. Without it anyone deploys a look-alike contract, emits Paused, and
    ///      proves it. This is the single most important check in the pipeline.
    mapping(address => Asset) public assets;

    /// @dev Which source-chain event signatures count as impairment / restoration.
    mapping(bytes32 => bool) public impairmentSig;
    mapping(bytes32 => bool) public restorationSig;

    Event[] public events;
    mapping(address => uint256[]) public eventsOfAsset;

    // ─────────────────────────────── events ──────────────────────────────

    event AssetRegistered(address indexed asset, uint64 chainKey, string label);
    event SignatureConfigured(bytes32 indexed sig, bool impairment, bool enabled);
    event Impaired(address indexed asset, bytes32 indexed sig, uint64 srcBlock, uint256 eventId);
    event Restored(address indexed asset, bytes32 indexed sig, uint64 srcBlock, uint256 eventId);
    event EventIgnored(address indexed asset, bytes32 indexed sig, uint64 srcBlock, string reason);

    // ─────────────────────────────── errors ──────────────────────────────

    error NotOwner();
    error ProofRejected();
    error SourceTxFailed(uint8 status);
    error NoMatchingEvent();
    error QueryAlreadyProcessed(bytes32 queryId);
    error WrongChainKey(address asset, uint64 expected, uint64 got);

    constructor(address verifier, address decoder) {
        owner = msg.sender;
        VERIFIER = INativeQueryVerifier(verifier);
        DECODER = IEvmDecoder(decoder);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // ──────────────────────────── configuration ──────────────────────────

    function registerAsset(address asset, uint64 chainKey, string calldata label)
        external onlyOwner
    {
        Asset storage a = assets[asset];
        a.registered = true;
        a.chainKey = chainKey;
        a.label = label;
        emit AssetRegistered(asset, chainKey, label);
    }

    function setImpairmentSignature(bytes32 sig, bool enabled) external onlyOwner {
        impairmentSig[sig] = enabled;
        emit SignatureConfigured(sig, true, enabled);
    }

    function setRestorationSignature(bytes32 sig, bool enabled) external onlyOwner {
        restorationSig[sig] = enabled;
        emit SignatureConfigured(sig, false, enabled);
    }

    // ──────────────────────────── entry point ────────────────────────────

    /// @notice Submit a proven source transaction. Every allowlisted log whose signature is a
    ///         configured impairment or restoration is recorded; everything else is skipped.
    /// @dev Parameter shape follows the documented ASC entry-point pattern (flattened proof).
    function submitEvent(
        uint64 chainKey,
        uint64 blockHeight,
        bytes calldata encodedTransaction,
        bytes32 merkleRoot,
        INativeQueryVerifier.MerkleProofEntry[] calldata siblings,
        bytes32 lowerEndpointDigest,
        bytes32[] calldata continuityRoots
    ) external returns (uint256 count) {
        IEvmDecoder.ReceiptFields memory receipt = _verify(
            chainKey, blockHeight, encodedTransaction,
            merkleRoot, siblings, lowerEndpointDigest, continuityRoots);

        for (uint256 i; i < receipt.receiptLogs.length; ++i) {
            IEvmDecoder.LogEntry memory log = receipt.receiptLogs[i];
            if (log.topics.length == 0) continue;

            Asset storage a = assets[log.address_];
            if (!a.registered) continue;                 // (5) emitter allowlist

            bytes32 sig = log.topics[0];
            bool isImpair = impairmentSig[sig];
            bool isRestore = restorationSig[sig];
            if (!isImpair && !isRestore) continue;       // (4) signature match

            // An asset is registered against exactly one source chain. A proof from another chain
            // naming the same address is a different contract and must not move this state.
            if (a.chainKey != chainKey) revert WrongChainKey(log.address_, a.chainKey, chainKey);

            if (isImpair) {
                _recordImpairment(a, log.address_, sig, chainKey, blockHeight);
            } else {
                _recordRestoration(a, log.address_, sig, chainKey, blockHeight);
            }
            unchecked { ++count; }
        }
        if (count == 0) revert NoMatchingEvent();
    }

    // ──────────────────────────── state machine ──────────────────────────

    function _recordImpairment(
        Asset storage a, address asset, bytes32 sig, uint64 chainKey, uint64 blockHeight
    ) internal {
        uint256 id = _append(asset, sig, true, chainKey, blockHeight);

        // Keep the EARLIEST proven impairment. A later proof must never push the cutoff forward:
        // credit extended after the first impairment was already extended against an impaired
        // asset, whether or not anyone had proven it yet.
        if (a.impairedAt == 0 || blockHeight < a.impairedAt) {
            a.impairedAt = blockHeight;
            // A restoration only survives if it is still strictly later than the impairment.
            if (a.restoredAt != 0 && a.restoredAt <= blockHeight) a.restoredAt = 0;
            emit Impaired(asset, sig, blockHeight, id);
        } else {
            emit EventIgnored(asset, sig, blockHeight, "later than earliest proven impairment");
        }
    }

    function _recordRestoration(
        Asset storage a, address asset, bytes32 sig, uint64 chainKey, uint64 blockHeight
    ) internal {
        uint256 id = _append(asset, sig, false, chainKey, blockHeight);

        // A restoration means nothing unless an impairment was proven first, and it must be
        // strictly later than that impairment.
        if (a.impairedAt == 0) {
            emit EventIgnored(asset, sig, blockHeight, "no impairment proven");
            return;
        }
        if (blockHeight <= a.impairedAt) {
            emit EventIgnored(asset, sig, blockHeight, "not later than impairment");
            return;
        }
        if (a.restoredAt != 0 && blockHeight <= a.restoredAt) {
            emit EventIgnored(asset, sig, blockHeight, "older than known restoration");
            return;
        }
        a.restoredAt = blockHeight;
        emit Restored(asset, sig, blockHeight, id);
    }

    function _append(
        address asset, bytes32 sig, bool impairment, uint64 chainKey, uint64 blockHeight
    ) internal returns (uint256 id) {
        events.push(Event({
            asset: asset, sig: sig, impairment: impairment,
            srcChainKey: chainKey, srcBlock: blockHeight, admittedAt: uint64(block.number)
        }));
        id = events.length - 1;
        eventsOfAsset[asset].push(id);
    }

    // ──────────────────────────── verification ───────────────────────────

    /// @dev Checks 1–3. Any failure reverts and writes nothing.
    function _verify(
        uint64 chainKey,
        uint64 blockHeight,
        bytes calldata encodedTransaction,
        bytes32 merkleRoot,
        INativeQueryVerifier.MerkleProofEntry[] calldata siblings,
        bytes32 lowerEndpointDigest,
        bytes32[] calldata continuityRoots
    ) internal returns (IEvmDecoder.ReceiptFields memory receipt) {
        INativeQueryVerifier.MerkleProof memory mp =
            INativeQueryVerifier.MerkleProof({root: merkleRoot, siblings: siblings});
        INativeQueryVerifier.ContinuityProof memory cp =
            INativeQueryVerifier.ContinuityProof({
                lowerEndpointDigest: lowerEndpointDigest, roots: continuityRoots});

        // (1) replay protection, keyed by position
        bytes32 queryId = keccak256(
            abi.encodePacked(chainKey, blockHeight, VERIFIER.calculateTxIndex(mp)));
        if (processedQueries[queryId]) revert QueryAlreadyProcessed(queryId);

        // (2) inclusion + continuity
        if (!VERIFIER.verifyAndEmit(chainKey, blockHeight, encodedTransaction, mp, cp)) {
            revert ProofRejected();
        }
        processedQueries[queryId] = true;

        // (3) transaction success — the precompile does NOT check this
        receipt = DECODER.decodeReceiptFields(encodedTransaction);
        if (receipt.receiptStatus != 1) revert SourceTxFailed(receipt.receiptStatus);
    }

    // ───────────────────────────── read paths ────────────────────────────

    /// @notice Current status of an asset.
    /// @dev NO_PROOF is not a clean bill of health — see the contract-level notice.
    function statusOf(address asset) public view returns (Status) {
        Asset storage a = assets[asset];
        if (a.impairedAt == 0) return Status.NO_PROOF;
        if (a.restoredAt > a.impairedAt) return Status.RESTORED;
        return Status.IMPAIRED;
    }

    /// @notice The gate a credit venue calls. True = do not extend new credit against this asset.
    function isCreditGated(address asset) external view returns (bool) {
        return statusOf(asset) == Status.IMPAIRED;
    }

    function impairedSince(address asset) external view returns (uint64) {
        return assets[asset].impairedAt;
    }

    function eventCount() external view returns (uint256) { return events.length; }

    function eventsOf(address asset) external view returns (uint256[] memory) {
        return eventsOfAsset[asset];
    }

    function getEvent(uint256 id) external view returns (Event memory) { return events[id]; }
}
```

## 12-2. `contracts/src/GatedCreditLine.sol` (전체)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

interface IEligibilityLedger {
    function isCreditGated(address asset) external view returns (bool);
    function impairedSince(address asset) external view returns (uint64);
}

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title GatedCreditLine
 * @notice A minimal credit venue on Creditcoin that consults an {EligibilityLedger} before
 *         extending new credit against a collateral asset controlled on another chain.
 *
 * @dev This stands in for the real pattern the ledger is built for: the asset's control lives on
 *      Ethereum while the credit is extended somewhere else — USDe controlled on Ethereum and lent
 *      against on Robinhood Chain, Centrifuge pools whose hub is Ethereum with share tokens lent
 *      against on Base. Here Creditcoin is that other chain.
 *
 *      SCOPE. Deliberately no interest accrual, no price oracle and no liquidation engine: this
 *      exercises the ELIGIBILITY axis only. Do not present it as a lending protocol.
 *
 *      EXITS ARE NEVER GATED. Impairment blocks new credit; it must never trap an existing
 *      borrower. `repay` and `withdrawCollateral` stay open in every state — a gate that also
 *      locks the exit converts a risk control into a hostage situation.
 */
contract GatedCreditLine {
    struct Market {
        bool listed;
        IERC20 collateral;
        IERC20 loanAsset;
        uint16 ltvBps;        // e.g. 9200 = 92%
    }

    struct Position {
        address owner;
        address collateralAsset;
        uint256 collateral;
        uint256 debt;
        uint64 openedAtBlock;
        uint64 openedAtTime;
    }

    address public immutable owner;
    IEligibilityLedger public immutable LEDGER;

    mapping(address => Market) public markets;   // keyed by collateral asset
    Position[] public positions;
    mapping(address => uint256[]) public positionsOf;

    event MarketListed(address indexed collateral, address loanAsset, uint16 ltvBps);
    event Opened(uint256 indexed id, address indexed borrower, address indexed collateralAsset,
                 uint256 collateral, uint256 debt);
    event Borrowed(uint256 indexed id, uint256 amount, uint256 newDebt);
    event Repaid(uint256 indexed id, uint256 amount, uint256 newDebt);
    event CollateralWithdrawn(uint256 indexed id, uint256 amount, uint256 remaining);
    event CreditRefused(address indexed collateralAsset, address indexed borrower, uint64 impairedSince);

    error NotOwner();
    error NotBorrower();
    error MarketNotListed(address collateralAsset);
    error AssetImpaired(address collateralAsset, uint64 impairedSince);
    error ExceedsLtv(uint256 debt, uint256 maxDebt);
    error NothingToDo();

    constructor(address ledger) {
        owner = msg.sender;
        LEDGER = IEligibilityLedger(ledger);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /// @dev New credit is refused while the collateral asset has a proven, unrestored impairment.
    modifier creditAllowed(address collateralAsset) {
        if (LEDGER.isCreditGated(collateralAsset)) {
            uint64 since = LEDGER.impairedSince(collateralAsset);
            emit CreditRefused(collateralAsset, msg.sender, since);
            revert AssetImpaired(collateralAsset, since);
        }
        _;
    }

    function listMarket(address collateral, address loanAsset, uint16 ltvBps) external onlyOwner {
        markets[collateral] = Market({
            listed: true, collateral: IERC20(collateral), loanAsset: IERC20(loanAsset), ltvBps: ltvBps
        });
        emit MarketListed(collateral, loanAsset, ltvBps);
    }

    /// @notice Fund the venue's lendable balance.
    function fund(address collateralAsset, uint256 amount) external onlyOwner {
        Market storage m = _market(collateralAsset);
        m.loanAsset.transferFrom(msg.sender, address(this), amount);
    }

    // ───────────────────────────── credit path ───────────────────────────

    function openPosition(address collateralAsset, uint256 collateralAmount, uint256 borrowAmount)
        external creditAllowed(collateralAsset) returns (uint256 id)
    {
        Market storage m = _market(collateralAsset);
        if (collateralAmount == 0) revert NothingToDo();
        _requireWithinLtv(m, collateralAmount, borrowAmount);

        m.collateral.transferFrom(msg.sender, address(this), collateralAmount);

        positions.push(Position({
            owner: msg.sender,
            collateralAsset: collateralAsset,
            collateral: collateralAmount,
            debt: borrowAmount,
            openedAtBlock: uint64(block.number),
            openedAtTime: uint64(block.timestamp)
        }));
        id = positions.length - 1;
        positionsOf[msg.sender].push(id);

        if (borrowAmount > 0) m.loanAsset.transfer(msg.sender, borrowAmount);
        emit Opened(id, msg.sender, collateralAsset, collateralAmount, borrowAmount);
    }

    function borrowMore(uint256 id, uint256 amount) external {
        Position storage p = _own(id);
        Market storage m = _market(p.collateralAsset);
        if (LEDGER.isCreditGated(p.collateralAsset)) {
            uint64 since = LEDGER.impairedSince(p.collateralAsset);
            emit CreditRefused(p.collateralAsset, msg.sender, since);
            revert AssetImpaired(p.collateralAsset, since);
        }
        _requireWithinLtv(m, p.collateral, p.debt + amount);
        p.debt += amount;
        m.loanAsset.transfer(msg.sender, amount);
        emit Borrowed(id, amount, p.debt);
    }

    /// @notice Adding collateral is new credit exposure to the asset, so it is gated too.
    function addCollateral(uint256 id, uint256 amount)
        external creditAllowed(positions[id].collateralAsset)
    {
        Position storage p = _own(id);
        Market storage m = _market(p.collateralAsset);
        p.collateral += amount;
        m.collateral.transferFrom(msg.sender, address(this), amount);
    }

    // ──────────────────── exits — never gated, by design ─────────────────

    function repay(uint256 id, uint256 amount) external {
        Position storage p = _own(id);
        Market storage m = _market(p.collateralAsset);
        uint256 pay = amount > p.debt ? p.debt : amount;
        p.debt -= pay;
        m.loanAsset.transferFrom(msg.sender, address(this), pay);
        emit Repaid(id, pay, p.debt);
    }

    function withdrawCollateral(uint256 id, uint256 amount) external {
        Position storage p = _own(id);
        Market storage m = _market(p.collateralAsset);
        p.collateral -= amount;
        _requireWithinLtv(m, p.collateral, p.debt);
        m.collateral.transfer(msg.sender, amount);
        emit CollateralWithdrawn(id, amount, p.collateral);
    }

    // ───────────────────────────── read paths ────────────────────────────

    /// @notice Positions that were opened against an asset before its impairment was proven here.
    /// @dev Reported, never auto-liquidated: the ledger proves an event happened, not that any
    ///      particular borrower did anything wrong.
    function exposedPositions(address collateralAsset) external view returns (uint256[] memory ids) {
        uint256 n;
        for (uint256 i; i < positions.length; ++i) {
            if (positions[i].collateralAsset == collateralAsset && positions[i].debt > 0) ++n;
        }
        ids = new uint256[](n);
        uint256 k;
        for (uint256 i; i < positions.length; ++i) {
            if (positions[i].collateralAsset == collateralAsset && positions[i].debt > 0) ids[k++] = i;
        }
    }

    function positionCount() external view returns (uint256) { return positions.length; }
    function getPosition(uint256 id) external view returns (Position memory) { return positions[id]; }
    function positionsOfBorrower(address who) external view returns (uint256[] memory) {
        return positionsOf[who];
    }

    // ────────────────────────────── internals ────────────────────────────

    function _market(address collateralAsset) internal view returns (Market storage m) {
        m = markets[collateralAsset];
        if (!m.listed) revert MarketNotListed(collateralAsset);
    }

    function _own(uint256 id) internal view returns (Position storage p) {
        p = positions[id];
        if (p.owner != msg.sender) revert NotBorrower();
    }

    function _requireWithinLtv(Market storage m, uint256 collateral, uint256 debt) internal view {
        uint256 maxDebt = (collateral * m.ltvBps) / 10_000;
        if (debt > maxDebt) revert ExceedsLtv(debt, maxDebt);
    }
}
```

## 12-3. `contracts/test/realdata-eligibility.test.js` (전체)

> 실제 mainnet proof + 실제 EvmV1Decoder를 쓰는 테스트. 이 프로젝트의 가장 강한 증거다.

```javascript
'use strict';
/**
 * End-to-end vertical slice with REAL data, run on a local EVM.
 *
 * Uses:
 *   - a REAL Attestcoin proof, fetched live from the hosted Proof Builder
 *   - a REAL Ethereum mainnet transaction: the sNUSD `Paused` event of 2026-08-13, i.e. the
 *     moment a $53M synthetic dollar's staking wrapper stopped being freely redeemable while
 *     DeFi contracts were still holding it
 *   - the REAL EvmV1Decoder from @gluwa/usc-contracts, deployed into the local VM
 *   - the REAL EligibilityLedger and GatedCreditLine
 *
 * Only the BlockProver precompile is mocked: it is a Creditcoin runtime component that cannot
 * exist on a local EVM, and it is the one piece already proven against mainnet in spike/scripts.
 *
 *   node test/realdata-eligibility.test.js
 */

const { VM } = require('@ethereumjs/vm');
const { Account, Address, hexToBytes, bytesToHex } = require('@ethereumjs/util');
const { ethers } = require('ethers');
const artifacts = require('../artifacts/contracts.json');
const { ProofBuilderClient, toVerifierArgs } = require('../../spike/src/proofClient');
const { CHAIN_KEY } = require('../../spike/src/config');

const DEPLOYER = new Address(hexToBytes('0x1111111111111111111111111111111111111111'));
const GAS = 200_000_000n;
const E18 = 10n ** 18n;

// The real event this whole project is built around.
const SNUSD = '0x08efcc2f3e61185d0ea7f8830b3fec9bfa2ee313'; // Staked NUSD (Neutrl)
const PAUSE_TX = '0xc25678129b98d6cb082472cc38b3e9908a81829e5826325c71d62318cb2f9c9a';
const PAUSE_BLOCK = 25745732n; // 2026-08-13 11:14:59 UTC

const PAUSED = ethers.id('Paused(address)');
const UNPAUSED = ethers.id('Unpaused(address)');
const STATUS = ['NO_PROOF', 'IMPAIRED', 'RESTORED'];

let vm;
const results = [];
const check = (name, pass, detail = '') => {
  results.push(pass);
  console.log(`  ${pass ? '✅' : '❌'} ${name}${detail ? '  — ' + detail : ''}`);
};

async function deploy(name, args = []) {
  const a = artifacts[name];
  const i = new ethers.Interface(a.abi);
  const enc = args.length ? i.encodeDeploy(args).slice(2) : '';
  const res = await vm.evm.runCall({
    caller: DEPLOYER, origin: DEPLOYER, gasLimit: GAS, data: hexToBytes(a.bytecode + enc),
  });
  if (res.execResult.exceptionError) {
    throw new Error(`deploy ${name}: ${res.execResult.exceptionError.error}`);
  }
  return res.createdAddress;
}

async function call(to, iface, fn, args) {
  const res = await vm.evm.runCall({
    caller: DEPLOYER, origin: DEPLOYER, to, gasLimit: GAS,
    data: hexToBytes(iface.encodeFunctionData(fn, args)),
  });
  return { err: res.execResult.exceptionError, ret: bytesToHex(res.execResult.returnValue) };
}

/** Proof Builder response → documented flattened ASC parameters. */
function flatten(proof) {
  const a = toVerifierArgs(proof);
  return [
    a.chainKey, a.height, a.encodedTransaction,
    a.merkleProof[0],
    a.merkleProof[1].map(([hash, isLeft]) => ({ hash, isLeft })),
    a.continuityProof[0],
    a.continuityProof[1],
  ];
}

async function main() {
  console.log('fetching the real Attestcoin proof for the sNUSD pause…\n');
  const pb = new ProofBuilderClient();
  const attested = await pb.attestedHeight(CHAIN_KEY.ETH_MAINNET);
  if (BigInt(attested) < PAUSE_BLOCK) {
    throw new Error(`source block ${PAUSE_BLOCK} not attested yet (head ${attested})`);
  }
  const proof = await pb.proofByTxHash(CHAIN_KEY.ETH_MAINNET, PAUSE_TX);
  const args = flatten(proof);

  console.log(`  tx        ${PAUSE_TX}`);
  console.log(`  block     ${args[1]}  (expected ${PAUSE_BLOCK})`);
  console.log(`  txBytes   ${(args[2].length - 2) / 2} bytes`);
  console.log(`  siblings  ${args[4].length} | continuity roots ${args[6].length}\n`);

  vm = await VM.create();
  await vm.stateManager.putAccount(DEPLOYER, new Account(0n, 10n ** 20n));

  const decoder = await deploy('EvmV1Decoder');       // the REAL decoder
  const verifier = await deploy('MockVerifier2');     // the one Creditcoin-only component
  const ledger = await deploy('EligibilityLedger', [verifier.toString(), decoder.toString()]);
  const line = await deploy('GatedCreditLine', [ledger.toString()]);
  const coll = await deploy('MockERC20', ['Staked NUSD', 'sNUSD']);
  const loan = await deploy('MockERC20', ['USD Coin', 'USDC']);

  const lIface = new ethers.Interface(artifacts.EligibilityLedger.abi);
  const gIface = new ethers.Interface(artifacts.GatedCreditLine.abi);
  const dIface = new ethers.Interface(artifacts.EvmV1Decoder.abi);
  const eIface = new ethers.Interface(artifacts.MockERC20.abi);

  console.log('deployed real EvmV1Decoder at', decoder.toString());
  console.log('deployed ledger            at', ledger.toString(), '\n');

  // ── the real decoder against the real transaction bytes ──
  const dec = await call(decoder, dIface, 'decodeReceiptFields', [args[2]]);
  check('real decoder parses the real mainnet txBytes', !dec.err,
    dec.err ? dec.err.error : '');
  const fields = dIface.decodeFunctionResult('decodeReceiptFields', dec.ret)[0];
  check('receiptStatus == 1', Number(fields.receiptStatus) === 1);
  const logs = fields.receiptLogs;
  check('logs present', logs.length > 0, `${logs.length} log(s)`);

  const pauseLog = logs.find(
    (l) => l.address_.toLowerCase() === SNUSD && l.topics[0] === PAUSED);
  check('the sNUSD Paused log is in this transaction', Boolean(pauseLog),
    pauseLog ? `emitter ${pauseLog.address_}` : 'not found');

  // ── the ledger, configured for the real asset on the real chain ──
  console.log('\n— configuring the venue for the real asset —');
  await call(ledger, lIface, 'registerAsset', [SNUSD, CHAIN_KEY.ETH_MAINNET, 'Staked NUSD (sNUSD)']);
  await call(ledger, lIface, 'setImpairmentSignature', [PAUSED, true]);
  await call(ledger, lIface, 'setRestorationSignature', [UNPAUSED, true]);
  // The credit venue lends against a local representation of the same asset.
  await call(line, gIface, 'listMarket', [coll.toString(), loan.toString(), 9200]);
  await call(coll, eIface, 'mint', [DEPLOYER.toString(), 10_000n * E18]);
  await call(loan, eIface, 'mint', [DEPLOYER.toString(), 10_000n * E18]);
  await call(coll, eIface, 'approve', [line.toString(), ethers.MaxUint256]);
  await call(loan, eIface, 'approve', [line.toString(), ethers.MaxUint256]);
  await call(line, gIface, 'fund', [coll.toString(), 5_000n * E18]);

  const before = await call(ledger, lIface, 'statusOf', [SNUSD]);
  check('asset starts NO_PROOF',
    Number(lIface.decodeFunctionResult('statusOf', before.ret)[0]) === 0);

  // ── submit the REAL proof ──
  console.log('\n— submitting the real proof through the ledger —');
  const sub = await call(ledger, lIface, 'submitEvent', args);
  check('submitEvent(real proof) succeeded', !sub.err, sub.err ? sub.err.error : '');
  const admitted = sub.err ? 0n : lIface.decodeFunctionResult('submitEvent', sub.ret)[0];
  check('exactly one impairment admitted from the real tx', admitted === 1n, `count=${admitted}`);

  const st = await call(ledger, lIface, 'statusOf', [SNUSD]);
  const status = Number(lIface.decodeFunctionResult('statusOf', st.ret)[0]);
  check('status → IMPAIRED from real mainnet data', status === 1, STATUS[status]);

  const sinceR = await call(ledger, lIface, 'impairedSince', [SNUSD]);
  const since = lIface.decodeFunctionResult('impairedSince', sinceR.ret)[0];
  check('impairedSince = the real source block', since === PAUSE_BLOCK, `block=${since}`);

  const evR = await call(ledger, lIface, 'getEvent', [0]);
  const ev = lIface.decodeFunctionResult('getEvent', evR.ret)[0];
  console.log(`\n    recorded: asset ${ev.asset}`);
  console.log(`              sig   ${ev.sig.slice(0, 18)}…  impairment=${ev.impairment}`);
  console.log(`              src   chainKey ${ev.srcChainKey} block ${ev.srcBlock}`);

  // ── the gate, driven by the real event ──
  console.log('\n— the credit gate, driven by the real event —');
  // Point the venue at the real asset id so the gate reads the proven state.
  await call(line, gIface, 'listMarket', [SNUSD, loan.toString(), 9200]);
  const refused = await call(line, gIface, 'openPosition', [SNUSD, 100n * E18, 10n * E18]);
  let errName = null;
  if (refused.err && refused.ret.length > 2) {
    try { errName = gIface.parseError(refused.ret)?.name ?? null; } catch { /* ignore */ }
  }
  check('new credit against the impaired asset is refused', Boolean(refused.err) && errName === 'AssetImpaired',
    `error=${errName}`);

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  if (passed !== results.length) process.exit(1);
  console.log('\nVERTICAL SLICE PROVEN with a real, 5-day-old mainnet impairment event.');
  console.log('Only the BlockProver precompile was mocked; it is already verified on Creditcoin');
  console.log('against real mainnet transactions in spike/scripts/01–06.');
}

main().catch((e) => { console.error(e); process.exit(1); });
```

## 12-4. `contracts/test/eligibility.test.js` — 검증 시나리오 부분

> 전체 236줄 중 실제 검증이 일어나는 부분(설정·헬퍼 제외). 27개 체크가 여기 있다.

```javascript
  console.log('— before any proof —');
  check('status starts NO_PROOF (0)', Number(await read(ledger, lIface, 'statusOf', [COLL])) === 0);
  check('NO_PROOF does not gate credit', (await read(ledger, lIface, 'isCreditGated', [COLL])) === false);

  let r = await call(line, gIface, 'openPosition', [COLL, 1000n * E18, 500n * E18]);
  check('credit extended before impairment is proven', !r.reverted);
  const borrowed = await read(loan, eIface, 'balanceOf', [DEPLOYER.toString()]);
  check('borrower received the loan asset', borrowed === 5_500n * E18,
    `balance=${borrowed / E18}`);

  console.log('\n— impairment proof flips the gate —');
  await call(verifier, vIface, 'setTxIndex', [1]);
  r = await submit(CHAIN_KEY_MAINNET, PAUSE_BLOCK, receipt([evLog(COLL, PAUSED)]));
  check('impairment proof admitted', !r.reverted);
  check('status → IMPAIRED (1)', Number(await read(ledger, lIface, 'statusOf', [COLL])) === 1);
  const since = await read(ledger, lIface, 'impairedSince', [COLL]);
  check('impairedSince = source block', since === PAUSE_BLOCK, `block=${since}`);

  r = await call(line, gIface, 'openPosition', [COLL, 100n * E18, 10n * E18], { expectRevert: true });
  check('new position refused', r.error === 'AssetImpaired', `error=${r.error}`);
  r = await call(line, gIface, 'borrowMore', [0, 1n * E18], { expectRevert: true });
  check('borrowing more on an existing position refused', r.error === 'AssetImpaired', `error=${r.error}`);
  r = await call(line, gIface, 'addCollateral', [0, 1n * E18], { expectRevert: true });
  check('adding collateral refused', r.error === 'AssetImpaired', `error=${r.error}`);

  console.log('\n— exits are never gated (a risk control must not trap the borrower) —');
  r = await call(line, gIface, 'repay', [0, 500n * E18]);
  const p0 = await read(line, gIface, 'getPosition', [0]);
  check('repay works while impaired', !r.reverted && p0.debt === 0n, `debt=${p0.debt}`);
  r = await call(line, gIface, 'withdrawCollateral', [0, 1000n * E18]);
  check('collateral withdrawal works while impaired', !r.reverted);

  console.log('\n— negative cases (must fail closed) —');
  await call(verifier, vIface, 'setShouldVerify', [false]);
  await call(verifier, vIface, 'setTxIndex', [2]);
  r = await submit(CHAIN_KEY_MAINNET, PAUSE_BLOCK + 1n, receipt([evLog(COLL, PAUSED)]), { expectRevert: true });
  check('tampered / invalid proof → revert', r.error === 'ProofRejected', `error=${r.error}`);
  await call(verifier, vIface, 'setShouldVerify', [true]);

  await call(verifier, vIface, 'setTxIndex', [1]);
  r = await submit(CHAIN_KEY_MAINNET, PAUSE_BLOCK, receipt([evLog(COLL, PAUSED)]), { expectRevert: true });
  check('replay of a processed query → revert', r.error === 'QueryAlreadyProcessed', `error=${r.error}`);

  await call(verifier, vIface, 'setTxIndex', [3]);
  r = await submit(CHAIN_KEY_MAINNET, PAUSE_BLOCK + 2n, receipt([evLog(ROGUE, PAUSED)]), { expectRevert: true });
  check('unregistered emitter → revert, nothing recorded', r.error === 'NoMatchingEvent', `error=${r.error}`);

  await call(verifier, vIface, 'setTxIndex', [4]);
  r = await submit(CHAIN_KEY_MAINNET, PAUSE_BLOCK + 3n, receipt([noiseLog(COLL)]), { expectRevert: true });
  check('registered asset but unconfigured signature → revert', r.error === 'NoMatchingEvent', `error=${r.error}`);

  await call(verifier, vIface, 'setTxIndex', [5]);
  r = await submit(CHAIN_KEY_MAINNET, PAUSE_BLOCK + 4n, receipt([evLog(COLL, PAUSED)], 0), { expectRevert: true });
  check('failed source transaction (status 0) → revert', r.error === 'SourceTxFailed', `error=${r.error}`);

  await call(verifier, vIface, 'setTxIndex', [6]);
  r = await submit(CHAIN_KEY_SEPOLIA, PAUSE_BLOCK + 5n, receipt([evLog(COLL, PAUSED)]), { expectRevert: true });
  check('same address on a different source chain → revert', r.error === 'WrongChainKey', `error=${r.error}`);

  console.log('\n— chronology: the cutoff is the EARLIEST proven impairment —');
  await call(verifier, vIface, 'setTxIndex', [7]);
  await submit(CHAIN_KEY_MAINNET, PAUSE_BLOCK + 500n, receipt([evLog(COLL, PAUSED)]));
  let now = await read(ledger, lIface, 'impairedSince', [COLL]);
  check('later impairment proof does not move the cutoff forward', now === PAUSE_BLOCK, `block=${now}`);

  await call(verifier, vIface, 'setTxIndex', [8]);
  await submit(CHAIN_KEY_MAINNET, PAUSE_BLOCK - 100n, receipt([evLog(COLL, PAUSED)]));
  now = await read(ledger, lIface, 'impairedSince', [COLL]);
  check('earlier impairment proof moves the cutoff back', now === PAUSE_BLOCK - 100n, `block=${now}`);

  console.log('\n— batched source transaction —');
  await call(verifier, vIface, 'setTxIndex', [9]);
  r = await submit(CHAIN_KEY_MAINNET, PAUSE_BLOCK + 600n,
    receipt([noiseLog(ROGUE), evLog(ROGUE, PAUSED), evLog(COLL, PAUSED), noiseLog(COLL)]));
  const admitted = lIface.decodeFunctionResult('submitEvent', r.ret)[0];
  check('batched tx records only the registered asset', !r.reverted && admitted === 1n,
    `admitted=${admitted}`);

  console.log('\n— restoration ordering —');
  await call(verifier, vIface, 'setTxIndex', [10]);
  await submit(CHAIN_KEY_MAINNET, PAUSE_BLOCK - 200n, receipt([evLog(COLL, UNPAUSED)]));
  check('restoration older than the impairment is ignored',
    Number(await read(ledger, lIface, 'statusOf', [COLL])) === 1);

  await call(verifier, vIface, 'setTxIndex', [11]);
  await submit(CHAIN_KEY_MAINNET, PAUSE_BLOCK + 1000n, receipt([evLog(COLL, UNPAUSED)]));
  check('restoration after the impairment → RESTORED (2)',
    Number(await read(ledger, lIface, 'statusOf', [COLL])) === 2);
  check('credit gate released', (await read(ledger, lIface, 'isCreditGated', [COLL])) === false);
  r = await call(line, gIface, 'openPosition', [COLL, 100n * E18, 50n * E18]);
  check('credit available again after restoration', !r.reverted);

  console.log('\n— read paths —');
  // 6 admitted for this asset: 3 impairments (base, later, earlier), 1 from the batched tx,
  // 2 restorations (the ignored older one is still kept as history).
  const evs = await read(ledger, lIface, 'eventsOf', [COLL]);
  check('every admitted event is retained as history, including ignored ones',
    evs.length === 6, `count=${evs.length}`);
  const exposed = await read(line, gIface, 'exposedPositions', [COLL]);
  check('exposedPositions lists open debt', exposed.length === 1, `count=${exposed.length}`);

  const passed = results.filter((x) => x.pass).length;
  console.log(`\n${passed}/${results.length} checks passed`);
```

## 12-5. 테스트 실행 결과 (2026-08-18 실측)

```
$ node test/eligibility.test.js
— before any proof —
  ✅ status starts NO_PROOF (0)
  ✅ NO_PROOF does not gate credit
  ✅ credit extended before impairment is proven
  ✅ borrower received the loan asset  — balance=5500

— impairment proof flips the gate —
  ✅ impairment proof admitted
  ✅ status → IMPAIRED (1)
  ✅ impairedSince = source block  — block=25745732
  ✅ new position refused  — error=AssetImpaired
  ✅ borrowing more on an existing position refused  — error=AssetImpaired
  ✅ adding collateral refused  — error=AssetImpaired

— exits are never gated (a risk control must not trap the borrower) —
  ✅ repay works while impaired  — debt=0
  ✅ collateral withdrawal works while impaired

— negative cases (must fail closed) —
  ✅ tampered / invalid proof → revert  — error=ProofRejected
  ✅ replay of a processed query → revert  — error=QueryAlreadyProcessed
  ✅ unregistered emitter → revert, nothing recorded  — error=NoMatchingEvent
  ✅ registered asset but unconfigured signature → revert  — error=NoMatchingEvent
  ✅ failed source transaction (status 0) → revert  — error=SourceTxFailed
  ✅ same address on a different source chain → revert  — error=WrongChainKey

— chronology: the cutoff is the EARLIEST proven impairment —
  ✅ later impairment proof does not move the cutoff forward  — block=25745732
  ✅ earlier impairment proof moves the cutoff back  — block=25745632

— batched source transaction —
  ✅ batched tx records only the registered asset  — admitted=1

— restoration ordering —
  ✅ restoration older than the impairment is ignored
  ✅ restoration after the impairment → RESTORED (2)
  ✅ credit gate released
  ✅ credit available again after restoration

— read paths —
  ✅ every admitted event is retained as history, including ignored ones  — count=6
  ✅ exposedPositions lists open debt  — count=1

27/27 checks passed

$ node test/realdata-eligibility.test.js

deployed real EvmV1Decoder at 0x8f7a45ebde059392e46a46dcc14ab24681a961ea
deployed ledger            at 0x39c2540cc64c8562269200ee459dc2853aab9d87 

  ✅ real decoder parses the real mainnet txBytes
  ✅ receiptStatus == 1
  ✅ logs present  — 1 log(s)
  ✅ the sNUSD Paused log is in this transaction  — emitter 0x08EFCC2F3e61185D0EA7F8830B3FEc9Bfa2EE313

— configuring the venue for the real asset —
  ✅ asset starts NO_PROOF

— submitting the real proof through the ledger —
  ✅ submitEvent(real proof) succeeded
  ✅ exactly one impairment admitted from the real tx  — count=1
  ✅ status → IMPAIRED from real mainnet data  — IMPAIRED
  ✅ impairedSince = the real source block  — block=25745732

    recorded: asset 0x08EFCC2F3e61185D0EA7F8830B3FEc9Bfa2EE313
              sig   0x62e78cea01bee320…  impairment=true
              src   chainKey 3 block 25745732

— the credit gate, driven by the real event —
  ✅ new credit against the impaired asset is refused  — error=AssetImpaired

10/10 checks passed

VERTICAL SLICE PROVEN with a real, 5-day-old mainnet impairment event.
Only the BlockProver precompile was mocked; it is already verified on Creditcoin
against real mainnet transactions in spike/scripts/01–06.
```

---

**패킷 끝.** 검토 시 §10(Open Questions)부터 읽기를 권한다 — 나머지는 그 질문들에 대한 배경이다.
