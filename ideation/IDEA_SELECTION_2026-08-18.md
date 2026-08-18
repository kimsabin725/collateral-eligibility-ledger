# 아이디어 발굴·검증·선별 — Institutional DeFi × Attestcoin

> 2026-08-18 · 마감 D-19 · 목적: **해커톤 제출 + 포트폴리오 산출물** 두 가지를 동시에 만족하는 프로젝트 1개 선정
> 태그: **[VERIFIED]** 직접 실행·측정 · **[FACT]** 외부 출처 · **[INFERENCE]** 추론 · **[UNVERIFIED]** 미확인
> 이 라운드는 기존 후보(어제 구현물 포함)에 **어떤 특혜도 주지 않고** 처음부터 다시 평가했다.

---

## 0. 모든 후보의 점수를 실제로 좌우하는 제약 (실측 확정)

| 제약 | 근거 | 후보 선별에 미치는 영향 |
|---|---|---|
| **증명 단위 = 트랜잭션 1건**. account/storage proof 없음 | **[VERIFIED]** Proof Builder OpenAPI 전 엔드포인트 + `@gluwa/usc-sdk@0.18.0` 인터페이스 전수 확인 | *사건*이 핵심인 아이디어는 적합, *잔액/포지션*이 핵심이면 부적합 |
| source chain 2개 (mainnet=3, Sepolia=1) | **[VERIFIED]** ChainInfo precompile 조회 | "여러 체인 합산" 서사는 시연 불가 |
| attestation 지연 8~9분 | **[VERIFIED]** 2회 측정 | 실시간 차단형 제품 불가 → 사후검증·자격판정형만 |
| outbound(쓰기) 불가 | **[FACT]** 공식 문서 | Creditcoin이 타 체인에 명령 못 보냄. 판정·기록만 |
| **부재 증명 불가** | 원리적 | "완전한 목록"을 주장하는 설계는 전부 불건전 |

> **핵심 함의:** 좋은 후보는 "**이미 일어난 이산 사건**을, **다른 체인의 금융 판단**에, **인덱서를 신뢰하지 않고** 반영하는 것"이어야 한다.

---

## 1. 후보 발굴 — 18개

형식: **TradFi에서는 X가 당연한데, DeFi에서는 Y 때문에 X가 깨진다.**

| # | 영역 | 후보 한 문장 |
|---|---|---|
| 1 | Collateral | TradFi에서는 담보자산에 동결·압류가 걸리면 담보권자가 **즉시 통지**받는데, DeFi에서는 발행사가 동결해도 그 토큰을 담보로 잡은 프로토콜이 **모른 채 정상 담보로 계산**한다 |
| 2 | Risk | TradFi에서는 펀드가 **환매를 중단하면** 그 수익증권은 즉시 담보부적격/헤어컷 상향인데, DeFi에서는 렌딩시장이 **하드코딩 $1**로 계속 평가해 청산이 걸리지 않는다 |
| 3 | Collateral | TradFi에서는 같은 담보를 **두 곳에 이중담보로 제공할 수 없게** 삼자관리기관이 encumbrance를 추적하는데, DeFi에서는 프로토콜·체인마다 장부가 달라 **재담보가 보이지 않는다** |
| 4 | Asset servicing | TradFi에서는 배당·의결권이 **실질 보유자**에게 가는데, DeFi에서는 명부상 보유자가 **풀 컨트랙트**여서 귀속이 끊긴다 |
| 5 | Asset servicing | TradFi에서는 record date 스냅샷이 정본인데, DeFi에서는 같은 펀드가 **여러 체인에 동시 존재**해 등록부가 하나로 모이지 않는다 |
| 6 | Settlement | TradFi에서는 DvP로 두 leg가 원자적으로 묶이는데, cross-chain에서는 한쪽 leg만 성립하는 **fails**가 발생한다 |
| 7 | Settlement | TradFi에서는 결제 실패 시 **buy-in·클레임 절차**가 있는데, DeFi에서는 실패 사실 자체를 **누가 증명하는지** 정해져 있지 않다 |
| 8 | Compliance | TradFi에서는 제재 대상 자금 유입 시 **사후 소명 자료**가 남는데, DeFi에서는 오염 자금이 내 포지션에 들어왔는지 **검증 가능한 형태로** 남지 않는다 |
| 9 | Custody | TradFi에서는 출금 화이트리스트·트래블룰이 기관 단위로 강제되는데, DeFi에서는 체인마다 통제가 분절된다 |
| 10 | Treasury | TradFi에서는 자산 실재성이 감사로 확인되는데, 온체인 트레저리는 **준비금 증명**이 필요하다 |
| 11 | Valuation | TradFi에서는 NAV가 정해진 주기·검증절차로 산출되는데, DeFi는 24/7 청산이라 **stale NAV** 구간이 생긴다 |
| 12 | Private credit | TradFi에서는 covenant 위반·디폴트가 **정해진 절차로 통지**되는데, 토큰화 사모대출은 그 사건의 검증 가능한 전파 경로가 없다 |
| 13 | Accounting | TradFi 회계는 원자산까지 **look-through**하는데, DeFi에서는 wrapper·LP·중첩 볼트로 자산 인식이 끊긴다 |
| 14 | Payments | TradFi 송금은 **지급 증명**이 회계 시스템과 붙는데, 스테이블코인 결제는 인보이스와 연결이 끊긴다 |
| 15 | Internal control | TradFi에서는 권한 부여와 실행이 **분리 기록**되는데, DeFi 트랜잭션 하나만으로는 어떤 권한으로 행동했는지 특정이 안 된다 *(어제 구현물)* |
| 16 | Market structure | TradFi에서는 최선집행 의무를 **증빙**해야 하는데, DeFi 실행은 MEV·라우팅 때문에 증빙 기준 자체가 없다 |
| 17 | Governance | TradFi에서는 투자심의가 승인한 **대상의 동일성**이 유지되는데, upgradeable contract는 주소가 같아도 내용이 바뀐다 |
| 18 | Risk | TradFi에서는 거래상대 한도가 **그룹 단위로 합산**되는데, DeFi에서는 같은 주체가 여러 프로토콜에 분산돼 익스포저가 합산되지 않는다 |

---

## 2. Kill Test — 18개 중 13개 제거

| # | 판정 | 사유 |
|---|---|---|
| 5 | **KILL** | *잔액/공급량*이 대상 → state proof 없이는 불건전. 발행사가 mint 권한 독점이라 patchable |
| 6 | **KILL** | prior art 압도적: **[FACT]** Chainlink CRE×JPM Kinexys×Ondo cross-chain DvP 실증, ERC3643 협회×LayerZero×Tokeny×ABN AMRO DvP 발표 |
| 7 | **DOWNRANK** | 시장 자체가 아직 미형성. 클레임 절차를 논할 거래량·분쟁 사례가 공개적으로 없음 |
| 8 | **KILL** | **[FACT]** Hypernative가 "real-time provenance and toxicity monitoring", Blockaid×Predicate가 실행시점 차단 제공 |
| 9 | **KILL** | **[FACT]** Fireblocks·BitGo·Anchorage·Copper가 allowlist·승인자·지연·트래블룰을 이미 제품화 |
| 10 | **KILL** | **[FACT]** Chainlink Proof of Reserve 40+ 피드, 56개 프로젝트, $17B 검증. 게다가 state 대상 |
| 11 | **KILL** | **[FACT]** DIA·RedStone NAV 피드 + Chainlink SmartData(NAV/AUM/reserve)로 이미 포화 |
| 12 | **DOWNRANK** | 트리거(covenant 위반·디폴트 판정)가 **오프체인 사실** → 증명할 원천이 체인에 없음 |
| 13 | **MERGE→4** | 회계는 강제력·지불의사가 약함. 4번의 두 번째 수요처로만 인용 |
| 14 | **KILL** | 리콘 파이프라인·ERP 커넥터가 이미 상품화(NetSuite/SAP/Oracle 연동) |
| 15 | **KILL** | **어제 구현물.** Morpho V2가 역할분리로 해소 → 한 프로토콜 패치로 사라지는 문제 |
| 16 | **KILL** | Flashbots·CoW·1inch Fusion 등 성숙. 벤치마크가 오프체인이라 증명 대상도 아님 |
| 17 | **DOWNRANK** | **[FACT]** Hypernative가 upgrade/admin/parameter change 모니터링 제공. 좁은 빈칸만 남음 |
| 18 | **DOWNRANK** | 익스포저 *합산*은 state 대상 → Attestcoin 부적합 |

**생존: 1, 2, 3, 4 (+7 보류)** — 그리고 **1과 2는 같은 문제의 두 얼굴**이다(둘 다 "담보의 자격을 바꾸는 사건이 다른 체인에서 일어났다"). 병합한다.

---

## 3. Shortlist (4개)

### S1. 담보 자격을 바꾸는 사건의 검증 가능한 등록부 *(후보 1+2 병합)*

- **Candidate** — 발행사의 동결·소각·환매중단 같은 **담보 자격을 바꾸는 사건**을, 다른 체인의 렌딩시장이 **인덱서를 신뢰하지 않고 스스로 검증**해 담보 자격에 반영하게 한다.
- **Real Workflow** — 기관 담보관리에서 자산은 항상 *적격/부적격*, *헤어컷 몇 %*로 관리된다. 발행체에 사고가 나면 그 자산은 **가격이 떨어지기 전에 먼저 부적격이 된다.** 이건 가격 문제가 아니라 **자격 문제**다.
- **Exact Gap** — 현존 인프라는 두 갈래뿐이다. ①**오라클**(가격·NAV·준비금 = 숫자) ②**모니터링 서비스**(Hypernative·Blockaid = 신뢰 기반 알림/차단). **"이 사건이 이 블록에서 실제로 일어났다"를 목적지 컨트랙트가 직접 검증하는 경로가 없다.**
- **Attestcoin Role** — 사건은 이산적이고, 시간순서가 금융 판정에 결정적이며(동결 이전 대출 vs 이후 대출), 사실은 다른 체인에 있고, 오라클/인덱서를 신뢰하면 안 된다. **state proof도 부재 증명도 필요 없다.**
- **Minimum Demo** — 실제 메인넷 동결 tx 1건을 proof로 제출 → Sepolia mock 담보시장의 해당 포지션이 **적격 → 부적격**으로 뒤집히는 장면.
- **Portfolio Story** — "담보 적격성(collateral eligibility)이라는 TradFi 개념이 온체인에는 없다는 걸 발견하고, 그걸 암호학적으로 검증 가능한 형태로 구현했다."
- **Strongest Counterargument** — 같은 체인이면 프로토콜이 발행사 컨트랙트를 직접 구독하면 끝. **cross-chain일 때만 성립**한다.

### S2. Look-Through Entitlement Register *(후보 4+13)*

- **Candidate** — 풀·볼트 뒤의 실질 보유자에게 배당·권리가 귀속되는지 **증명 기반으로** 확인한다.
- **Exact Gap** — 업계 표준 해법이 발행사의 **오프체인 인덱서**다.
- **Strongest Counterargument** — **[FACT] Securitize Vault Registrar**(2026-03)가 "투자자 신원에 묶인 개별 볼트"로 정면 대응 중. 게다가 대상이 *포지션*이라 Attestcoin과 어긋난다.

### S3. 이중담보(Double-Pledge) 탐지 등록부 *(후보 3)*

- **Candidate** — 같은 자산이 **두 곳 이상에 담보로 제공된 사실**을 서로 다른 체인의 proof 2건으로 입증한다.
- **설계상 강점** — 이중담보 탐지는 **양성 사실 2건의 증명**만으로 성립한다. 부재 증명이 필요 없다 — 이 한계를 우회하는 드문 구조다.
- **Exact Gap** — **[FACT]** 토큰화가 encumbrance 가시성을 준다고 홍보되지만, 그건 **하나의 삼자관리 플랫폼 안에서**의 이야기다. 프로토콜·체인을 가로지르면 통합 뷰가 없다. **[FACT]** Stream Finance에서 xUSD가 Morpho·Euler·Silo에 재담보되어 "구멍이 담보 그래프를 타고 전파"됐다.
- **Strongest Counterargument** — DeFi의 과담보 구조에서는 "이중담보"가 사기가 아니라 정상 동작(각 프로토콜이 실제 토큰을 락업)이다. **TradFi 개념을 잘못 이식했다**는 반론이 강하다.

### S4. 결제 실패 증거 *(후보 7)* — **보류**

시장 미형성. 분쟁 사례가 공개되지 않아 문제 실재성을 입증할 수 없다.

---

## 4. Top 3

### 🥇 #1 — Collateral Eligibility Ledger

**30초 설명**
> 기관 담보관리에서 자산은 *가격*만이 아니라 *적격성*으로 관리된다. 발행사가 토큰을 동결하거나 펀드가 환매를 중단하면, 그 자산은 값이 떨어지기 **전에** 이미 담보로 못 쓴다. 그런데 그 사건은 이더리움에서 일어나고, 그 자산을 담보로 잡은 시장은 다른 체인에 있다. **이 원장은 그 사건을 Attestcoin proof로 검증해 담보 적격성을 뒤집는다.**

**왜 실제 금융 문제인가**
담보 적격성·헤어컷·부적격 사유는 삼자repo와 ISDA 담보약정의 핵심 조항이다. **[FACT]** 발행체 사고 시 자격이 먼저 바뀌고 가격은 나중에 따라온다.

**왜 지금 디지털자산 시장과 관련 있는가**
- **[FACT]** Stream Finance(2025-11): $93M 손실 → 입출금 중단 → xUSD $1→$0.1. 그런데 **Morpho·Euler·Silo가 xUSD를 하드코딩 $1로 평가**해 청산이 걸리지 않았고, 차입자가 USDC를 빼가 대주가 부실을 떠안았다. 총 **$285M 익스포저**.
- **[VERIFIED]** 발행사 통제 행위는 지금도 상시 발생한다 — 최근 15일 메인넷: **USDC `Blacklisted` 7건, USDT `AddedBlackList` 16건, USDT `DestroyedBlackFunds` 15건**(실제 소각).
- **[FACT]** 2026-03 Circle은 봉인명령으로 **무관한 거래소 핫월렛 16개**를 동결했다. 범죄자가 아니어도 걸린다.

**기존 솔루션이 어디까지 해결하는가**
| 유형 | 대표 | 한계 |
|---|---|---|
| 가격/준비금 오라클 | Chainlink PoR(40+피드·$17B), SmartData NAV | **숫자**를 준다. "환매가 중단됐다"는 *사건*은 다루지 않음 |
| 리스크 모니터링 | Hypernative(Morpho 연동), Blockaid×Predicate | **신뢰 기반 서비스**. 목적지 컨트랙트가 스스로 검증 못 함 |
| 컴플라이언스 | Chainlink ACE/CCT | *이전 허용 여부*를 판정. 담보 자격 개념 없음 |

**정확히 남는 Gap**
> **"자격을 바꾸는 사건이 저 체인의 저 블록에서 실제로 일어났다"를, 담보를 잡고 있는 컨트랙트가 제3자를 신뢰하지 않고 직접 검증하는 경로.**

**왜 Attestcoin인가**
①대상이 이산 사건 ②시간순서가 판정의 핵심(동결 전 대출 vs 후 대출) ③사실은 다른 체인 ④오라클/인덱서 신뢰 배제가 목적 ⑤**state proof도 부재 증명도 불필요** — 프로토콜 한계를 하나도 건드리지 않는다. 8~9분 지연도 "자격 플래그"에는 문제되지 않는다(실시간 차단 주장 안 함).

**Minimum PoC**
1. Sepolia: mock 담보시장 + mock 발행사 토큰(동결 기능 포함)
2. mainnet: **실제** USDC/USDT 동결·소각 tx를 proof로 가져와 검증(읽기 전용, 비용 0)
3. CC3: `CollateralEligibilityLedger` — 사건 admit → 대상 자산/주소 추출 → 적격성 플래그 전환 + **사건 이전/이후 포지션 구분**

**1~2분 Demo**
"이 포지션은 적격, LTV 정상" → 실제 메인넷 동결 tx 해시 입력 → proof 검증 통과 → **동일 포지션이 부적격으로 전환, 신규 차입 차단, 사건 이후 대출은 별도 표시** → 위조 proof 제출 → revert.

**Digital Asset Portfolio Story**
TradFi 담보관리에는 가격과 별개로 *적격성*이라는 축이 있고, 발행체 사고에서는 이 축이 먼저 움직인다. 온체인 렌딩은 이 축이 통째로 없어서 Stream Finance에서 $285M가 가격 축만 보다가 무너졌다. 나는 이 결손을 문제로 정의하고, 발행사의 통제 행위를 다른 체인에서 암호학적으로 검증해 담보 자격에 반영하는 PoC를 실제 메인넷 데이터로 만들었다. 면접에서는 여기서 삼자repo의 eligibility set, 헤어컷 체계, 부적격 사유 통지, 그리고 "온체인에는 왜 이 개념이 없었는가"로 확장할 수 있다.

**가장 강한 반례**
같은 체인이면 프로토콜이 발행사 컨트랙트를 직접 구독하면 된다 → **cross-chain 상황을 서사의 중심에 두어야 한다.** 부차적으로, permissioned 시장은 발행사·프로토콜이 오프체인 조율할 유인이 크다.

**무엇이 확인되면 포기하는가**
- 주요 렌딩 프로토콜이 이미 발행사 통제 이벤트를 자격 로직에 반영하고 있다는 증거
- Chainlink/Hypernative가 "verifiable event → eligibility" 제품을 이미 출시했다는 증거

**점수** (가중치 A15 B15 C15 D15 E10 F20 G10)

| 항목 | 점수 |
|---|---:|
| Financial Pain | 9 |
| Solution Gap | 8 |
| Attestcoin Fit | 9 |
| Buildability | 9 |
| Demo | 9 |
| Portfolio Value | 9 |
| Differentiation | 8 |
| **Weighted Total** | **8.75 / 10** |

---

### 🥈 #2 — Double-Pledge Evidence Registry

**30초 설명**
> 같은 토큰화 자산이 서로 다른 체인·프로토콜에 담보로 잡혀 있다는 사실을, **양성 증거 2건**으로 입증하는 원장.

**정확히 남는 Gap** — encumbrance 가시성은 *하나의 플랫폼 안*에서만 성립한다. 체인·프로토콜을 넘으면 통합 장부가 없다.
**왜 Attestcoin인가** — 이중담보 탐지는 **부재 증명이 필요 없는 드문 구조**(양성 사실 2건이면 성립). 서로 다른 체인이 전제.
**Minimum PoC** — Sepolia 담보 예치 + mainnet 실제 담보 예치를 각각 증명 → CC3에서 동일 자산·동일 주체 매칭 → 경보 기록.
**Portfolio Story** — 재담보와 담보 재사용은 2008년 이후 규제의 핵심 주제이고, Stream Finance에서 정확히 그 경로로 전파됐다.
**가장 강한 반례** — DeFi 과담보 구조에서 각 프로토콜은 실제 토큰을 락업하므로 이중담보가 **정상 동작**이다. "TradFi 개념 오이식" 반론을 넘지 못하면 죽는다.

| 항목 | 점수 |
|---|---:|
| Financial Pain | 8 · Solution Gap | 7 |
| Attestcoin Fit | 8 · Buildability | 7 |
| Demo | 8 · Portfolio Value | 8 · Differentiation | 8 |
| **Weighted Total** | **7.70 / 10** |

---

### 🥉 #3 — Look-Through Entitlement Register

**30초 설명**
> 풀·볼트 뒤의 실질 보유자에게 권리가 귀속되는지 증명 기반으로 확인한다.

**실측 근거** — **[VERIFIED]** BUIDL은 명부상 보유자에게 pro-rata mint(전원 0.026098% 일치)로 수익을 주고, 그중 하나가 **BUIDL 15,768,036개를 보유한 ERC-4626 볼트**다.
**가장 강한 반례** — **[FACT] Securitize Vault Registrar**(2026-03)가 정면 대응 중이고, 대상이 *포지션*이라 Attestcoin과 어긋난다(청구 기반 구조로만 건전).

| 항목 | 점수 |
|---|---:|
| Financial Pain | 8 · Solution Gap | 5 |
| Attestcoin Fit | 6 · Buildability | 6 |
| Demo | 7 · Portfolio Value | 9 · Differentiation | 7 |
| **Weighted Total** | **6.95 / 10** |

---

## 5. 최종 선택

> ### 내가 실제로 만들 프로젝트는 **#1 Collateral Eligibility Ledger** 다.

**#2보다 나은 이유** — #2는 "DeFi에서 이중담보는 정상 동작"이라는 반론을 아직 못 넘었다. #1의 반론(같은 체인이면 직접 구독)은 **cross-chain으로 범위를 좁히면 해소**되지만, #2의 반론은 문제 정의 자체를 무너뜨린다.

**#3보다 나은 이유** — #3은 지배적 사업자(Securitize)가 같은 이름으로 대응 중이고, 대상이 *포지션*이라 Attestcoin의 원리적 한계에 정면으로 부딪힌다. #1은 그 한계를 **하나도** 건드리지 않는다.

**해커톤에서 강한 이유** — 실제 메인넷 데이터로 시연한다(최근 15일에만 38건). 실패 시연(위조 proof revert)이 명확하고, Attestcoin을 빼면 성립하지 않는다. 심사 기준인 "의미 있는 Attestcoin 통합"에 정확히 부합한다.

**디지털자산 면접에서 강한 이유** — 담보 적격성·헤어컷·부적격 통지는 증권사/운용사 리스크·담보관리 실무 언어다. "smart contract를 만들었다"가 아니라 "**TradFi 담보관리의 한 축이 온체인에 통째로 없다는 걸 발견했다**"가 첫 문장이 된다.

**가장 큰 위험** — cross-chain 전제가 인위적으로 보일 수 있다. "왜 같은 체인에서 안 하냐"에 대한 답을 데모 첫 30초에 넣어야 한다.

**개발 시작 전 반드시 검증할 사실 3가지**
1. **[UNVERIFIED]** 주요 렌딩 프로토콜(Aave/Morpho/Euler)이 발행사 통제 이벤트를 **이미** 담보 로직에 반영하는가? 반영한다면 gap이 사라진다.
2. **[UNVERIFIED]** Stream Finance 당시 xUSD의 **환매중단이 온체인 이벤트로 존재했는가?** 존재하면 데모의 두 번째 실제 사례가 되고, 없으면 "동결·소각"만으로 서사를 구성해야 한다.
3. **[UNVERIFIED]** 동결·소각 대상 주소 중 **컨트랙트(프로토콜/풀)** 가 실제로 있었는가? 있으면 "담보가 발밑에서 사라진" 실제 사례가 되어 설득력이 결정적으로 올라간다. (오늘 표본에서는 USDC 4건 모두 EOA였고, USDT는 비인덱스 파라미터라 data 디코딩이 필요해 미확인)

**아직 하지 않는 것** — 상세 컨트랙트 아키텍처·프론트엔드 설계. 위 3가지 검증 후에 착수한다.
