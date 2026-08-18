# 최종 판정 — Cross-chain Collateral Eligibility

> 2026-08-18 자율 조사 종료 · 문서 → 코드 → 온체인 데이터 순으로 증거 수준을 높여 3개 Condition을 전부 binary로 판정했다.
> 태그: **[VERIFIED]** 우리가 직접 실행·측정 · **[FACT]** 외부 출처 · **[INFERENCE]** 추론

---

# VERDICT: **GO**

3개 Condition이 모두 아이디어를 지지한다. `Unknown`으로 남은 핵심 항목은 없다.

| Condition | 판정 | 근거 수준 |
|---|---|---|
| 1. 실제 cross-chain workflow 존재 | **YES** | 온체인 실측 (주소·금액·컨트랙트) |
| 2. 기존 end-to-end 솔루션 존재 | **NO** | 벤더 공식 문서 전수 확인 |
| 3. 프로토콜 네이티브 자동 소비 | **NO** | Solidity 소스 코드 직접 확인 |

---

## CONDITION 1 — Real Cross-chain Workflow : **YES**

### 증거 A — USDe (규모 최대)

| 항목 | 값 |
|---|---|
| Asset | **USDe** (Ethena synthetic dollar) |
| Source chain (통제) | **Ethereum** |
| Issuer/control contract | 토큰 `0x4c9EDD5852cd905f086C759E8383e09bff1E68B3` — **[VERIFIED]** supply **3,992,807,046 USDe**, `owner()=0xE8Dc0Fab349EA169283C48Ccfd09d797E6DB7c94`, `minter()=0xe3490297a08d6fC8Da46Edb7B6142E4F461b62D3` |
| Destination chain | **Robinhood Chain** (chainId **4663**, Arbitrum Orbit L2, Ethereum에 정산) |
| Destination 표현 | `0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34` — **[VERIFIED]** supply **288,815,204**, `endpoint()=0x6F475642a6e85809B1c36Fa62763669b1b48DD5B` + `peers(uint32)` 존재 → **LayerZero OFT (원본은 Ethereum)** |
| Destination protocol | **Morpho Blue** |
| **담보 사용** | **[VERIFIED] YES — collateral $285,532,168 / borrowed $251,647,632 / LLTV 92%** |

토큰 자체에는 `paused()`·`isBlacklisted()`가 **없다** **[VERIFIED]** → 적격성을 바꾸는 사건은 발행·상환 레이어(Ethereum)에서 발생하며, Robinhood Chain의 Morpho는 이를 알 방법이 없다.

### 증거 B — syrupUSDG

`0x40858070814a57FdF33a613ae84fE0a8b4a874f7` (RH Chain) supply **90,799,994** **[VERIFIED]**,
Morpho 담보 **$90,801,145** / 차입 **$79,438,999** / LLTV 92%. **[FACT]** Maple의 크레딧 풀은 Ethereum, syrupUSDG는 "Ethereum과 Robinhood Chain에서 이용 가능".

### 증거 C — Centrifuge JAAA/JTRSY (구조가 가장 명시적)

**[VERIFIED]** Centrifuge V3는 **hub-and-spoke**다. `PoolId`가 hub 체인을 인코딩한다
(`centrifugeId = poolId >> 48`, `src/core/types/PoolId.sol`).

| 토큰 | poolId | **hub** | 체인별 공급량 (실측) |
|---|---|---|---|
| **JAAA** | 281474976710663 | **Ethereum (1)** | ETH 371,157,461 · **Avalanche 250,000,001** · Base 48,207,418 · BNB 497,554 |
| **JTRSY** | 281474976710662 | **Ethereum (1)** | ETH 783,770,063 · Plume 496,381 · BNB 478,397 |

hub는 **풀 관리·회계·NAV·가격 배포**를 담당하고, spoke는 share token과 vault만 갖는다.
**[VERIFIED]** Base에는 deJAAA/JTRSY 담보 Morpho 마켓이 **이미 개설**돼 있다(LLTV 86~98%) — 다만 사용액은 $14 수준.

> **판정 근거:** "멀티체인 배포"에 그치지 않고, **다른 체인의 대출시장에서 실제로 담보로 잡혀 차입이 일어나고 있다**
> ($285M + $90M). 통제·상환의 source of truth는 Ethereum이다.

---

## CONDITION 2 — Existing End-to-End Solution : **NO**

end-to-end 경로 = `발행사 적격성 사건 → 크로스체인 전달/검증 → 목적지 대출 프로토콜 → 담보 판정`

| 제품 | 실제 제공 범위 | end-to-end인가 |
|---|---|---|
| **Chainlink SmartData** | **[FACT]** 프로덕션 피드 유형은 **Proof of Reserve · NAVLink(SmartNAV) · SmartAUM 3종뿐**(공식 문서 목차 확인). 준비금·NAV·AUM = **숫자** | **NO** — 적격성/환매중단/이전제한 상태 피드가 **존재하지 않음** |
| **Chainlink ACE / CCT** | **[FACT]** 이전 허용 여부·정책 강제, 크로스체인 컴플라이언스 메타데이터 | **NO** — *이전 적격성*이지 *담보 적격성*이 아님 |
| **Hypernative** | **[FACT]** 탐지→사전승인 온체인 액션 수 초 내 실행, Neutrl의 pauser, Parallel USDp 실제 pause | **NO** — **고용한 고객 자신의 컨트랙트**를 멈춘다. 자산을 물고 있는 제3자 프로토콜은 대상이 아님. 신뢰 기반 |
| **Chaos Labs Edge Risk Oracle** | **[FACT]** Aave에 **자동 파라미터 주입** 실제 가동(AaveStewardsInjector → Risk Steward, Arbitrum 마켓 동적 cap). 입력은 **시장 리스크 지표**, 범위는 거버넌스가 정한 한계 내 | **NO** — 입력이 발행사 사건이 아니라 시장 데이터. 같은 체인. 신뢰 기반 퍼블리셔 |
| **LlamaRisk LlamaGuard PT** | **[FACT]** Pendle PT 담보용 온체인 리스크 체크 | **NO** — 자산 특화 리스크 체크, 발행사 사건 아님 |
| **Aave Horizon RwaATokenManager** | **[VERIFIED]** 소스 2,091바이트 전문 확인. 기능은 `grantAuthorizedTransferRole` / `revokeAuthorizedTransferRole` / `transferRwaAToken` / `hasAuthorizedTransferRole`뿐 | **NO** — **전송 권한 관리만**. 적격성·동결·담보 비활성화 기능 없음 |

**결론:** 유사 부품은 많지만 **발행사 적격성 사건을 크로스체인으로 검증해 목적지 담보 판정에 넣는 경로는 존재하지 않는다.**

---

## CONDITION 3 — Protocol-native Automatic Consumption : **NO**

### Morpho Blue — 소스 코드로 확정 **[VERIFIED]**

`morpho-org/morpho-blue/src/Morpho.sol` (22,047바이트) 전수 검색 결과:

- `pause` / `freeze` / `frozen` / `disable` / `emergency` / `shutdown` / `blacklist` → **매치 0건**
- `onlyOwner` 함수는 5개뿐: `setOwner`, `enableIrm`, `enableLltv`, `setFee`, `setFeeRecipient`

> **마켓은 생성 후 불변이다. 담보 자산을 끄는 기능이 프로토콜에 아예 없다.**
> 즉 $285M USDe 담보 마켓은 **누구도 멈출 수 없다.** 유일한 실질 통제점은 마켓 생성 시 지정한 **oracle**이다.

### Euler v2 — **[VERIFIED]** `EVault/modules/Governance.sol`

`setLTV` · `setHookConfig(hookTarget, hookedOps)` · `setCaps` · `setConfigFlags` 전부 **`governorOnly`**.
→ 오퍼레이션 차단은 가능하나 **거버너(사람/큐레이터)가 눌러야** 한다. 발행사 사건 자동 소비 없음.

### Aave — **[FACT]**

- 2026-04 rsETH: **Protocol Guardian·Risk Steward**가 5개 네트워크에서 pause+LTV=0 → **사람이 실행**
- 자동화는 Chaos Labs Edge Risk Oracle 경로뿐이며 입력은 시장 지표, 범위는 `maxPercentChange` 제한.
  Rates steward는 보안상 **금리 업데이트로만 한정**해 배포됨.
- Horizon의 발행사 훅은 **전송 권한 관리 전용**(위 §2).

**결론: 어떤 주요 대출 인프라도 발행사의 authoritative collateral-status를 자동 소비하지 않는다. 다른 체인이면 더더욱.**

---

## 실제 사건 증거 (Best Real-World Evidence)

**[VERIFIED]** 5일 전 실제로 발생, 그리고 **지금도 진행 중**:

```
sNUSD 0x08efcc2f3e61185d0ea7f8830b3fec9bfa2ee313   (Ethereum)
  event  Paused(address)      block 25,745,732      2026-08-13 11:14:59 UTC   status 1
  tx     0xc25678129b98d6cb082472cc38b3e9908a81829e5826325c71d62318cb2f9c9a
```

**[VERIFIED]** 같은 자산의 Morpho 마켓 상태(2026-08-18 조회): **sNUSD/USDC 마켓에 차입 잔액 $1,661,397**,
보고된 담보 가치 $0. **[VERIFIED]** Morpho Blue에는 이 마켓을 멈출 기능이 **없다**.
**[FACT]** 배경: Neutrl이 준비금 문제로 NUSD 발행·환매 중단(2026-08-14 공표, 유통 $53.6M), 다운스트림 Strata는
**별도로 스스로** srNUSD·jrNUSD 관련 기능을 중단 — 자동 전파가 아니었다.

**[FACT]** 선행 사례: Stream Finance(2025-11-04) $93M 손실 → 입출금 중단 → xUSD $1→$0.1.
Morpho·Euler·Silo가 **하드코딩 $1**로 평가해 청산이 걸리지 않았고 총 **$285M** 익스포저로 전파.

---

## Attestcoin Necessity — 재확인

목적지가 신뢰해야 하는 대상이 무엇인가로 갈린다. 오라클·모니터링 벤더·일반 메시징은 모두
**"누군가가 그렇다고 말한다"**를 전달하고, 그 말을 한 주체를 신뢰하는 것은 담보 자격을 끄는 권한을
그 주체에게 주는 것과 같다. Attestcoin은 **"그 트랜잭션이 그 블록에 포함되었다"를 목적지 컨트랙트가 직접 검증**하게 한다.

그리고 이 설계는 Attestcoin의 약점을 하나도 건드리지 않는다 — **[VERIFIED]** state proof 불필요(사건 1건),
부재 증명 불필요(양성 사실), outbound 쓰기 불필요, 지연 8~9분 허용(신규 여신 게이팅이지 실시간 차단이 아님).

### ⚠️ 설계상 반드시 지켜야 할 구조 (Attestcoin이 inbound 전용이므로)

Creditcoin은 다른 체인에 명령을 보낼 수 없다. 따라서 **신용 베뉴 자체가 Creditcoin 위에 있어야 한다.**

```
Ethereum (source)            Creditcoin CC3 (destination = 신용 베뉴)
  발행사 적격성 사건    ──proof──▶  EligibilityLedger  ──▶  담보 판정
  (sNUSD Paused 등)                                        신규 차입 게이팅
```

이는 현실 구조(Condition 1)의 정확한 축소판이다: **자산 통제는 Ethereum, 신용 공여는 다른 체인.**
Robinhood Chain·Base·Avalanche 자리에 Creditcoin이 들어간다.

---

## 남은 위험 (Hard Kill은 아니지만 반드시 관리)

| 위험 | 성격 | 대응 |
|---|---|---|
| **[VERIFIED]** Attestcoin source chain이 Ethereum+Sepolia뿐 | 시연 제약 | 실제 사건은 **mainnet proof**로 가져오고, 신용 베뉴는 **CC3에 실제 배포**. Robinhood Chain은 근거로만 인용 |
| 지연 8~9분 | 포지셔닝 | "실시간 방어" 주장 금지. **신규 여신·담보 온보딩 게이팅**으로 한정 |
| 기존 마켓(Morpho Blue)은 어차피 못 멈춤 | 통합 경로 | 강제점은 **oracle 래퍼 또는 신규 마켓/큐레이터 레이어**. 기존 불변 마켓을 고칠 수 있다고 주장하지 말 것 |
| 벤더가 이 형태를 출시할 가능성 | 경쟁 | 현재 미출시 확인. 차별점은 **신뢰 모델**로 설명 |

---

## 착수 승인 — 구현 시작 가능

**GO.** 아래 포지셔닝을 지키는 조건으로 구현에 착수한다.

1. "아무도 해결 안 했다"고 말하지 않는다 — Aave Risk Steward·Hypernative·Chaos Labs Edge를 먼저 인정하고,
   차이를 **입력(시장 지표 vs 발행사 사건)** 과 **신뢰 모델(assertion vs proof)** 로 설명한다.
2. **실시간 차단**을 주장하지 않는다.
3. 스테이블코인 개별 지갑 블랙리스트를 근거로 쓰지 않는다 — **[VERIFIED]** 60일 전수조사 결과 담보 풀은 0건이었다.
4. 근거 사건은 **자산 레벨 pause**(sNUSD형)로 한정한다.
