# 구현 착수 전 최종 검증 — Cross-chain Collateral Eligibility

> 2026-08-18 · 목적: **GO / NO-GO 판정**. 아이디어를 살리는 게 아니라 싸게 죽이는 것이 성공.
> 태그: **[VERIFIED]** 직접 실행·측정 · **[FACT]** 외부 출처 · **[INFERENCE]** 추론 · **[UNVERIFIED]** 미확인

---

# 1. Verdict

> # **CONDITIONAL GO**

Gate 1·3은 통과했고, **Gate 2(기존 인프라 갭)와 Gate 4(크로스체인 자연성)가 예상보다 훨씬 약하다.**
아래 §10의 **3개 binary condition**을 먼저 확인하지 않으면 구현에 착수하지 않는다.

---

# 2. What exactly is the problem?

조사 전 문제정의는 "담보 적격성 축이 온체인에 없다"였다. **틀렸다 — 축은 있다.** Aave는 LTV=0, Morpho는
cap=0으로 즉시 담보를 끌 수 있고, Hypernative는 탐지-대응을 초 단위로 자동 실행한다.

증거에 맞춰 수정한 문제정의:

> **자산 발행 측에서 담보 적격성을 훼손하는 사건이 일어났을 때, 그 자산을 물고 있는 것은 발행사 본인이
> 아니라 아무 관계도 없는 제3자 프로토콜들이다. 현재 그 제3자들이 이 사실을 아는 경로는 (a)같은 벤더를
> 각자 구독하거나 (b)사람이 보고 수동 대응하는 것뿐이며, 목적지 컨트랙트가 그 사건을 스스로 검증하는
> 경로는 없다. 자산과 신용거래 장소가 서로 다른 체인일 때 이 간극이 커진다.**

즉 문제는 "적격성 개념의 부재"가 아니라 **"제3자 간 전파의 신뢰 모델"** 이다. 이 축소가 정직한 위치다.

---

# 3. Gate Results

## Gate 1 — Real Financial Problem : **PASS**

가격과 별개의 *적격성* 축은 TradFi에 실재한다. **[FACT]** ECB/Eurosystem은 적격 담보 기준을
Guideline (EU) 2015/510 Part Four에 규정하고 NCB가 사전 적격성 심사 후 목록에 게시하며, 임시 프레임워크로
기준을 변경한다. **[FACT]** ICMA 삼자repo는 등급별 eligibility set과 헤어컷을, ISDA는 관할별 적격담보
비교표를 유지한다. **[FACT]** 2026 GDF 보고서는 토큰화 MMF의 담보 활용에서 "ownership, control,
**encumbrance**의 공유 기록"과 "합의된 valuation·haircut 처리"를 전제로 든다.

⚠️ **한계 명시:** 위 문서들이 존재한다는 것까지는 확인했으나, "비가격 사유로 적격성이 상실된다"는
조항을 **원문 verbatim으로 인용하지는 못했다.** 최종 발표 전 1차 원문 확인 필요. **[UNVERIFIED]**

## Gate 2 — Existing Solution Gap : **PARTIAL PASS (가장 약한 게이트)**

기존 인프라가 예상보다 훨씬 많이 커버한다.

- **[FACT]** 2026-04 Aave: Protocol Guardian·Risk Steward가 rsETH/wrsETH를 **Ethereum·Arbitrum·Base·
  Mantle·Linea 전 네트워크에서 동시에 pause + LTV=0** 처리(Kelp DAO 브릿지 해킹 대응). 우리가 제안하려던
  바로 그 대응이 이미, 크로스체인으로, 사람 손에 의해 빠르게 실행된다.
- **[FACT]** Morpho: 큐레이터가 `submitCap`으로 **cap을 즉시 0**으로 내리고 supply queue를 비워 즉시 예치 차단.
- **[FACT]** Hypernative: "탐지 신호를 **사전 승인된 온체인 액션에 직접 바인딩**해 수 초 내 실행". 2026-05-07
  Parallel USDp 익스플로잇에서 실제로 프로토콜을 pause시켰고, **Neutrl의 pauser 역할을 맡고 있다.**
- **[FACT]** Chainlink: SmartData **MVR 피드가 숫자뿐 아니라 비숫자 데이터도 온체인 번들 전송**, PoR로
  circuit breaker 트리거, ACE로 적격성 검사·rate limit. CCIP로 크로스체인 전달.
- **[FACT]** Aave Horizon 리스크 프레임워크(LlamaRisk·Chaos Labs)는 이미 "**market access windows,
  lock-up periods**" 추적과 "**issuer constraints·custody delays를 고려한 맞춤 청산**"을 포함한다.

**남는 갭 (좁다):** 위 전부는 ①**당사자 본인**이 자기를 멈추거나 ②**신뢰하는 벤더**를 각자 고용하는 구조다.
아무 관계 없는 **제3자 프로토콜이 목적지 컨트랙트 안에서 사건을 스스로 검증**하는 경로는 발견되지 않았다.
Neutrl 사건에서 다운스트림 Strata는 **별도로, 스스로** 자기 마켓을 중단했다 — 자동 전파가 아니었다.

## Gate 3 — Real Onchain Event : **PASS** ✅

**[VERIFIED] 5일 전 실제로 일어났다.**

```
sNUSD (Staked NUSD) 0x08efcc2f3e61185d0ea7f8830b3fec9bfa2ee313
  event  Paused(address)
  block  25,745,732      2026-08-13 11:14:59 UTC
  tx     0xc25678129b98d6cb082472cc38b3e9908a81829e5826325c71d62318cb2f9c9a  (status 1)
```

이것은 브리프가 요구한 **자산/인스트루먼트 레벨 사건**이다(개별 EOA 블랙리스트가 아님).
그리고 **[VERIFIED]** 그 시점에 sNUSD를 물고 있던 것은 DeFi 컨트랙트들이다:

| 보유 컨트랙트 | 보유량 | 정체 |
|---|---:|---|
| `0x10c5e771…62666409` | **8,202,400 sNUSD** | **`SY-sNUSD`** (Pendle Standardized Yield, `asset()=NUSD`) |
| `0xbbbbbbbb…37eeffcb` | 1,828,755 sNUSD | Pendle 계열 라우터/마켓 |
| `0x00000000…3de08a90` | 7,710 sNUSD | Uniswap V4 PoolManager |

**[FACT]** 배경: Neutrl이 2026-08-14 준비금 문제로 NUSD 발행·환매를 중단했고(유통 약 $53.6M, 준비금 87%가
Fireblocks 경유), 다운스트림 Strata가 srNUSD·jrNUSD 관련 기능을 별도로 중단했다.

**반대 사례도 정직하게 기록:** **[VERIFIED]** 60일치 USDC `Blacklisted`(7건)·USDT `AddedBlackList`·
`DestroyedBlackFunds`(31건, 총 6,961,544 USDT 소각)를 전수 디코딩한 결과, 컨트랙트 대상은 전부
**23바이트 스마트월렛/위임 계정**이었고 **담보 풀이나 프로토콜은 하나도 없었다.**
→ **스테이블코인 블랙리스트는 이 프로젝트의 근거가 되지 못한다.** 근거는 sNUSD형 자산 레벨 pause다.

## Gate 4 — Cross-chain Naturalness : **PARTIAL / 가장 위험한 게이트** ⚠️

- **[FACT]** 크로스체인 구조 자체는 현실이다: BENJI 8개 체인, BUIDL 7개 체인, sBUIDL이 **Avalanche의
  Euler**에서 담보로 통합(발행 통제는 Ethereum). Centrifuge는 epoch 체결 후 **각 spoke 체인으로 콜백**.
- **그러나 두 가지가 아프다.**
  1. **[VERIFIED]** Attestcoin이 지원하는 source chain은 **Ethereum mainnet과 Sepolia뿐**이다.
     현실적 조합(Ethereum 발행사 → Base/Avalanche 대출시장)을 **시연할 수 없고** destination을 Sepolia mock으로
     둬야 한다.
  2. **내가 찾은 최고의 증거(sNUSD ↔ Pendle SY)가 같은 체인에 있다.** 이 사례를 쓰는 순간
     "그럼 그냥 같은 체인에서 이벤트 읽으면 되잖아"라는 반례가 정확히 성립한다.

---

# 4. Prior Art

| Product / Protocol | 이미 해결하는 것 | 증명·해결하지 **못하는** 것 | Threat |
|---|---|---|---|
| **Hypernative** | 탐지→사전승인 온체인 액션을 **수 초 내** 자동 실행. Neutrl의 pauser. Parallel USDp 실제 pause | 벤더를 **신뢰**해야 함. 목적지 컨트랙트가 스스로 검증 못 함. 고용한 고객만 보호 | **HIGH** |
| **Aave Guardian / Risk Steward** | 다중 네트워크 동시 pause + LTV=0 (rsETH 사례) | 사람·거버넌스 트리거. 발행사 이벤트를 자동 소비하지 않음 | **HIGH** |
| **Morpho 큐레이터** | cap 0 즉시, supply queue 비우기 | 큐레이터 재량·수동. 크로스체인 검증 없음 | MEDIUM |
| **Chainlink SmartData / MVR / PoR** | 비숫자 상태값 온체인 번들 전달, PoR 기반 circuit breaker | DON을 **신뢰**하는 assertion. "적격성 상태" 상용 피드는 미발견 | **HIGH** |
| **Chainlink ACE / CCT** | 이전 적격성·정책 강제, 크로스체인 컴플라이언스 메타데이터 | *이전 허용 여부*이지 *담보 적격성*이 아님 | MEDIUM |
| **Aave Horizon 리스크 프레임워크** (LlamaRisk·Chaos Labs) | market access window·lock-up 추적, issuer constraint 고려 청산 | 오프체인 리스크 서비스. 검증 가능한 온체인 트리거 아님 | MEDIUM |
| **Blockaid × Predicate** | 실행 시점 정책 차단 | 트랜잭션 위험 판정이지 자산 적격성 아님 | LOW |
| **RedStone Settle** | RWA 담보 청산 결제 | 자격 판정이 아니라 청산 실행 | LOW |

**KILLS IDEA 등급은 없다.** 그러나 HIGH가 3개다.

---

# 5. Best Real-World Evidence

**사건** — Neutrl이 준비금 문제로 NUSD 발행·환매 중단, `sNUSD` 컨트랙트가 온체인 `Paused` 상태로 전환.
**Transaction** — `0xc25678129b98d6cb082472cc38b3e9908a81829e5826325c71d62318cb2f9c9a`
**Event** — `Paused(address)` @ block **25,745,732**
**날짜** — **2026-08-13 11:14:59 UTC** (검증 시점 기준 약 120시간 전)
**Chain** — Ethereum mainnet
**Collateral implication** — 같은 시점 **Pendle `SY-sNUSD`가 8,202,400 sNUSD**를, 별도 Pendle 계열 컨트랙트가
1,828,755 sNUSD를 보유. 이들 wrapper 위에 쌓인 포지션 보유자들은 기초자산의 환매 경로가 닫힌 사실을
**프로토콜 코드로는 인지하지 못한다.**
**왜 이 프로젝트와 연결되는가** — 가격이 아니라 **환매 가능성**이 먼저 훼손된 사건이고, 그 사실이
**명시적 온체인 이벤트 1건**으로 존재하며, 영향받는 주체가 **발행사와 무관한 제3자 프로토콜**이다.
Attestcoin의 능력(단일 트랜잭션 증명 + 시간순서)과 정확히 일치한다.

---

# 6. Strongest Counterarguments

| # | 반례 | 판정 | 근거 |
|---|---|---|---|
| G | "문제 생기면 거버넌스·큐레이터가 즉시 마켓을 freeze하므로 별도 시스템 가치 낮다" | **Confirmed** | Aave rsETH 5개 네트워크 동시 pause+LTV0, Morpho cap 0 즉시 |
| B | "Hypernative/Chainlink가 이미 동일한 크로스체인 적격성 강제를 제공한다" | **Partially confirmed** | Hypernative는 초 단위 자동 pause 실행(단, 고용 고객 한정·신뢰 기반). Chainlink MVR은 비숫자 상태 전달 가능(단, 적격성 상용 피드 미발견) |
| E | "크로스체인 담보 사용 자체가 비현실적이라 문제를 억지로 만든 것" | **Rejected** | sBUIDL↔Avalanche Euler, BENJI 8체인, Centrifuge spoke 콜백 등 실재 |
| F | "Attestcoin 지연(8~9분) 때문에 담보 리스크 용도에 부적합" | **Partially confirmed** | 인시던트 대응은 초 단위가 표준(Hypernative). 단 Stream 사례는 **며칠간** 오작동이 지속돼 분 단위 지연이 무의미했음 |
| C | "적격성 이벤트가 온체인에 거의 표현되지 않는다" | **Rejected** | sNUSD `Paused` 실측 확인 |
| D | "기관은 haircut/price만 조정하면 충분" | **Partially confirmed** | Stream 사후분석의 업계 합의는 "**하드코딩 오라클이 원인, 실거래가 쓰라**"였다. 14개월간 4번째 반복 사고로 분류됨 |
| A | "Aave/Morpho가 이미 발행사 이벤트 기반 담보 비활성화를 지원" | **Unknown** | 코드·문서에서 자동 소비 증거를 찾지 못했으나, 없다고 단정하지 않는다 → §10 조건 1 |
| H | "단순 크로스체인 메시징/오라클로 훨씬 쉽게 동일 결과" | **Partially confirmed** | 기술적으로는 가능. 차이는 오직 **신뢰 모델**(assertion vs proof) |

---

# 7. Attestcoin Necessity Test

RPC·오라클·Hypernative 알림·일반 크로스체인 메시징은 모두 **"누군가가 그렇다고 말한다"**를 전달한다.
목적지 컨트랙트는 그 말을 한 주체(DON, 벤더, 릴레이어)를 신뢰해야 하고, 그 신뢰는 담보 자격을 끄는
**금융적 권한**과 같은 크기다. Attestcoin은 대신 **"그 트랜잭션이 그 블록에 실제로 포함되었다"**를
목적지 컨트랙트가 **직접 검증**하게 한다. 그리고 이 아이디어는 Attestcoin의 약점을 **하나도** 건드리지
않는다 — state proof 불필요(사건 1건), 부재 증명 불필요(양성 사실), outbound 쓰기 불필요(판정은 목적지에서),
지연 8~9분 허용(적격성 플래그이지 실시간 차단이 아님). **다만 정직하게 말하면, 이 필요성은 "기능"이 아니라
"신뢰 모델"의 차이이며, 오늘 시장이 그 차이에 비용을 지불하고 있다는 증거는 찾지 못했다.**

---

# 8. Portfolio Test

이 프로젝트를 설명하면 다음을 이해했다는 증거가 된다.

1. **담보는 가격만으로 관리되지 않는다** — eligibility·haircut·encumbrance라는 별도 축이 있고, ECB/ICMA/ISDA
   프레임워크가 그것을 어떻게 규정하는지 안다.
2. **DeFi 청산 아키텍처가 그 축을 어떻게 대체했는지** — LTV/LLTV/오라클 가격으로 환원했고, 그래서
   하드코딩 오라클이 14개월간 4번 반복 사고를 냈다는 것을 사례로 안다(Stream $93M → $285M 전파).
3. **인시던트가 제3자 프로토콜로 전파되는 경로** — Neutrl → Strata → Pendle wrapper까지, 실제 주소와
   금액으로 추적해봤다.
4. **assertion과 proof의 차이** — 오라클/모니터링 벤더가 주는 것과 암호학적 포함증명이 주는 것이 신뢰
   모델에서 어떻게 다른지, 그리고 그 차이에 언제 비용을 지불할 가치가 있는지.

과장 없이도 강하다: "아무도 해결 안 했다"고 말할 필요가 없고, **"기존 해법은 신뢰 기반이고 나는 검증
기반을 만들어봤다"**로 충분하다. 오히려 Hypernative·Aave Risk Steward를 정확히 알고 있다는 점이 더 강한 신호다.

---

# 9. Final Score

| 항목 | 가중치 | 점수 | 가중 |
|---|---:|---:|---:|
| Real Financial Pain | 20% | 8 | 1.60 |
| Existing Solution Gap | 20% | **5** | 1.00 |
| Real Onchain Evidence | 15% | 9 | 1.35 |
| Attestcoin Fit | 15% | 9 | 1.35 |
| Cross-chain Naturalness | 10% | **5** | 0.50 |
| Hackathon Buildability / Demo | 10% | 8 | 0.80 |
| Digital Asset Portfolio Value | 10% | 9 | 0.90 |
| **Weighted Total** | | | **7.50 / 10** |

Hard Kill 조건 중 **완전히 충족된 것은 없다.** 단 "기존 제품이 사실상 해결"과 "크로스체인 정당화"가
각각 부분 충족 상태다.

---

# 10. Final Decision — CONDITIONAL GO

아래 **3개 조건을 확인하기 전에는 컨트랙트를 한 줄도 쓰지 않는다.**

### 조건 1 — 자동 소비 여부 (가장 중요)

> Aave(V3/Horizon)·Morpho·Euler·Spark 중 **하나라도** 발행사/자산 측 pause·freeze 이벤트를
> **코드 레벨에서 자동으로** 담보 상태에 반영하는가?

- **YES → NO-GO.** 갭이 사라진다.
- **NO → 조건 2로.**
- 확인 방법: Aave Horizon 리스크 문서·컨트랙트, Morpho 큐레이터 문서, Euler 거버너 문서 정독.

### 조건 2 — 상용 적격성 피드 존재 여부

> Chainlink(또는 타 오라클)에 **"redemption/eligibility status"를 크로스체인으로 공급하고 실제 대출시장이
> 소비하는** 상용 피드가 존재하는가?

- **YES → NO-GO.** assertion 기반이라도 시장이 이미 그 형태를 채택했다면 우리 novelty가 사라진다.
- **NO → 조건 3으로.**
- 확인 방법: Chainlink SmartData 피드 주소 목록 전수 확인(문서에 주소 페이지 있음).

### 조건 3 — 크로스체인 서사의 실체

> 발행 통제가 Ethereum에 있고 담보 사용이 **다른 체인**에서 일어나는 **구체적 자산 1개**를,
> 주소와 금액까지 특정할 수 있는가? (후보: sBUIDL × Avalanche Euler)

- **YES → GO.** 그 자산을 데모의 서사 축으로 삼는다(destination은 Sepolia mock으로 대체하되, 실제 사례를
  근거로 제시).
- **NO → NO-GO.** 같은 체인 사례만 남으면 "그냥 이벤트 읽으면 된다"를 이길 수 없다.

---

## 착수 시 반드시 지켜야 할 포지셔닝 (조건 통과 시)

1. **"실시간 방어"를 주장하지 않는다.** 8~9분 지연은 Hypernative(초 단위)에 진다. 주장은
   **"검증 가능한 자격 판정 기록"**이다.
2. **"아무도 해결 안 했다"고 말하지 않는다.** Aave Risk Steward·Hypernative를 먼저 인정하고,
   차이를 **신뢰 모델**로 설명한다.
3. **스테이블코인 블랙리스트를 근거로 쓰지 않는다.** **[VERIFIED]** 60일 전수조사 결과 전부 개별 지갑
   대상이었다. 근거는 sNUSD형 **자산 레벨** pause다.
