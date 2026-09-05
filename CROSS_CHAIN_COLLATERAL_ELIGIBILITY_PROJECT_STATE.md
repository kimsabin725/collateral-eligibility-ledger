# Cross-chain Collateral Eligibility — 프로젝트 상태 스냅샷

**작성: 2026-08-18 (KST 밤)** · 마감: **2026-09-06 13:59 KST (D-19)**
**대상 해커톤:** BUIDL CTC 2026 Fall (Creditcoin / Attestcoin) — 전 제출작이 Attestcoin Protocol 사용 필수

> 이 문서 하나만 읽고 프로젝트 전체를 복원할 수 있도록 작성했다.
> 근거 표기: **[FACT]** 실제 tx·코드·공식문서·RPC로 확인 · **[INTERPRETATION]** 확인된 사실에서 도출한 해석 ·
> **[HYPOTHESIS]** PoC가 검증하려는 가정 · **[CORRECTED]** 폐기된 초기 가설(기록 보존용)

---

# Executive Summary

**해결하려는 문제.** 기관 담보관리에서 자산은 *가격*만으로 관리되지 않는다. 환매가능성·이전가능성·발행사 통제
같은 **적격성(eligibility)** 축이 따로 있고, 사고가 나면 이 축이 **가격보다 먼저** 움직인다. 온체인 대출은
사실상 가격 축(oracle·LTV·청산임계)만 가지고 있다.

**왜 금융적으로 의미 있나.** 실제로 2025-11 Stream Finance에서 환매가 중단되고 xUSD가 $1→$0.1로 갔지만
Morpho·Euler·Silo가 **하드코딩 $1**로 평가해 청산이 걸리지 않았고, $285M 규모로 전파됐다 **[FACT]**.
가격 축만 보는 구조의 실패 사례다.

**왜 cross-chain에서 더 어려운가.** 자산의 통제 주체는 A체인에, 그 자산을 담보로 잡은 신용시장은 B체인에
있는 구조가 **이미 대규모로 실재한다** — Robinhood Chain의 Morpho에 USDe 담보 **$285.5M**, 원본과 통제는
Ethereum **[FACT]**. B체인의 컨트랙트는 A체인의 사건을 스스로 확인할 방법이 없다.

**왜 Attestcoin인가.** 오라클·모니터링 벤더·일반 메시징은 "누군가가 그렇다고 말한다"를 전달한다. 그 말을
신뢰하는 것은 담보 자격을 끄는 권한을 그 주체에게 주는 것과 같다. Attestcoin은 **"그 트랜잭션이 그 블록에
포함되었다"를 목적지 컨트랙트가 직접 검증**하게 한다. 그리고 이 설계는 Attestcoin의 약점(상태증명 불가,
부재증명 불가, outbound 쓰기 불가)을 **하나도 건드리지 않는다**.

**실제 데이터로 확인한 것.** 5일 전 실제 사건 — `sNUSD`가 Ethereum에서 `Paused` 되었고
(block 25,745,732 / 2026-08-13 11:14:59 UTC), 그 proof를 Proof Builder에서 실제로 받아 **실제 EvmV1Decoder**로
파싱해 우리 원장이 IMPAIRED로 전이하고 신규 여신이 거부되는 것까지 로컬에서 통과시켰다 **[FACT]**.

**구현 상태.** 컨트랙트 2개(`EligibilityLedger` 7,431B / `GatedCreditLine` 5,007B) 작성 완료,
테스트 **27/27 + 10/10** 통과(구 프로젝트 회귀 15/15 + 8/8 포함 **총 60/60**). CC3 배포는 **faucet 대기**로 미완.

**주장하지 않는 것.** 실시간 차단 아님 · 기존 Morpho 마켓을 멈추는 게 아님 · `NO_PROOF`는 건강 증명이 아님 ·
"아무도 해결 안 했다"가 아님.

**내일 첫 작업.** faucet 수령 여부 확인 → 받았으면 `node contracts/scripts/deploy-eligibility.js` 한 번.
못 받았으면 README/제출 서사와 데모 시퀀스 확정.

---

# 1. 프로젝트 한 문장

> **자산의 통제 주체가 있는 소스 체인에서 발생한 명시적 담보 적격성 훼손 사건(예: 자산 컨트랙트 `Paused`)을
> Attestcoin proof로 검증해, 다른 체인에 있는 신용 베뉴가 그 사실을 스스로 확인하고 **그 사건 이후의 신규
> 여신만** 차단하도록 만드는 institutional collateral control PoC.**

핵심 단어 셋: **적격성(eligibility)** · **크로스체인 검증(proof, not assertion)** · **신규 여신 게이팅(출구는 열어둠)**

---

# 2. 왜 시작했는가 — 최초 문제의식

사용자의 출발점은 "DeFi를 더 편하게 만드는 기능"이 아니었다.

> **TradFi가 DeFi를 실제 금융 인프라로 흡수할 때, 블록체인상 `transaction validity`와 금융기관 내부 기준상
> `institutional validity`가 어긋나는 지점을 찾는 것.**

체인은 "이 트랜잭션은 유효하다"까지만 말한다. 금융기관은 그 위에 **권한·승인·mandate·담보·리스크·컴플라이언스·
포트폴리오 통제**를 요구한다. 이 둘이 벌어지는 곳을 찾는 게 목표였다.

작업 중 사용자가 명시한 **가장 중요한 필터**:

> **"한 프로토콜이나 인프라 사업자가 자기 시스템에 기능 하나 추가하면 사라지는 문제는 주력으로 삼지 않는다."**

이 필터가 이후 대부분의 후보를 죽였다.

"스마트컨트랙트를 만들었다"가 아니라 "**금융산업과 디지털자산 인프라 사이의 실제 문제를 발견하고 구조화할 줄
안다**"는 증거여야 한다.

---

# 3. 선행 프로젝트 — Morpho Authority → Action (v1)

## 3-1. 무엇을 검증했는가 [FACT]

Ethereum mainnet의 **실제** Morpho(MetaMorpho V1) 데이터로 두 사건을 연결했다.

```
proof #1  SetIsAllocator(0x9E9110cF…f9e1, true)  on steakUSDC  @ block 22,194,870
proof #2  ReallocateSupply(같은 actor, …)        on steakUSDC  @ block 25,772,893   (≈497일 후)
⇒ "이 주소는 이 vault에서 allocator 권한을 부여받은 뒤 실제로 자금을 재배분했다"
```

검증 항목: actor 동일성 · vault 동일성 · **엄격한 시간순서** · proof 유효성 · replay protection ·
위조 proof/잘못된 이벤트/미허용 emitter/실패 tx 등 네거티브 케이스.

문제 정의의 근거: MetaMorpho V1의 `reallocate`는 `onlyAllocatorRole`이고, 이 modifier는
`isAllocator[sender] || sender == curator || sender == owner`를 모두 허용한다. 따라서 **행위 tx 하나만으로는
어떤 역할로 움직였는지 특정되지 않는다** — 권한 부여 proof가 따로 있어야 한다.

구현 중 실제 버그도 하나 잡았다 [FACT]: 초기 구현은 allowlist되지 않은 로그가 하나라도 있으면 전체를 reject
했는데, 실제 grant tx는 여러 vault에 걸쳐 배치돼 있었고 action tx는 로그가 48개였다. → foreign log는 skip하고
관심 이벤트만 기록하도록 수정(보안 성질은 불변).

## 3-2. 기술적으로 얻은 primitive [FACT]

> **서로 다른 시점(또는 체인)의 실제 온체인 사건을 Attestcoin proof로 가져와 관계를 검증하고 금융적 의미를 부여한다.**

이 엔진(5중 검사 + 시간순서 판정)은 **현재 프로젝트에 그대로 재사용**되고 있다.

## 3-3. 왜 폐기했는가 — 실패가 아니라 문제 약화

**구현과 primitive는 유효했다. 약해진 것은 application-level problem이다.** [INTERPRETATION]

- **[FACT]** Morpho Vault **V2**는 역할을 훨씬 명확히 분리한다(Owner/Curator/Allocator/Sentinel). V1의 role
  ambiguity는 상당 부분 해소된다.
- 즉 이 문제는 **"프로토콜이 access-control 설계를 고치면 사라지는 문제"** 였다 → §2의 최우선 필터에 정면으로 걸린다.

따라서 v1은 **KILL**. 단 코드는 레포에 남겨두고 회귀 테스트도 계속 돌린다 — proof 배관이 계속 검증되기 때문이다.

---

# 4. 이후 아이디어 발굴 과정 (탈락 기록)

18개 후보를 발굴해 13개를 제거했다. 주요 탈락 사유는 **prior art**와 **patchability**다.
아래는 "비슷한 기능이 존재한다"와 "end-to-end 문제가 해결됐다"를 구분해 기록한 것이다.

| 후보 | 처음에 좋아 보인 이유 | 왜 약해졌나 |
|---|---|---|
| **Cross-chain Institutional Credential** | 기관 자격을 여러 체인에서 재사용 | **[FACT]** Chainlink ACE가 cross-chain identity·credential·expiry·revoke·정책강제를 이미 제공 |
| **Credential Revocation / 퇴사자 권한회수** | 실제 내부통제 이슈 | ACE 등이 revocation/expiry 직접 지원. 게다가 Attestcoin은 **부재 증명 불가**라 "즉시 kill switch"에 부적합 |
| **Approval Workflow / Maker-Checker** | TradFi 결재선의 직관적 이식 | **[FACT]** Safe(모듈·가드), Fireblocks(정책엔진·승인워크플로), Fordefi가 이미 성숙 |
| **Protocol Upgrade / Approval Expiry** | 투심위 승인 대상과 실제 구현체의 불일치 | **[FACT]** Hypernative가 upgrade·admin key·parameter change 모니터링 제공. Safe Guard로 사전검사 가능 |
| **Global Investment Mandate Controller** | 펀드 단위 한도를 온체인 강제 | **[FACT]** Mellow의 vault-level mandate, **Centrifuge V3.3 Onchain Execution Policy**(2026-08-05)가 같은 방향 |
| **Institutional Approval Provenance** | 승인 시점 상태와 실행의 암호학적 연결 | 좁은 빈칸은 남지만 기존 업체가 "못 해서"가 아니라 "문서화 안 했을" 가능성 → 보류 |
| **Look-Through Entitlement Register**<br>(풀 내부 실질보유자 귀속) | **[FACT]** Securitize 자신이 "풀 주소를 단일 신원과 매칭할 수 없다"고 인정. BUIDL 배당이 pro-rata mint(전원 **0.026098%** 일치)로 나가고 그 수취인 중 하나가 **BUIDL 15,768,036개를 보유한 ERC-4626 볼트**임을 실측 | **[FACT]** Securitize **Vault Registrar**(2026-03 개정, multichain)가 "투자자 신원에 묶인 개별 볼트"로 정면 대응 중이고 sToken은 그 이유로 deprecated. 게다가 대상이 *포지션*이라 Attestcoin의 state-proof 부재와 충돌 |
| **Double-Pledge Evidence Registry** | 이중담보 탐지는 **양성 사실 2건**만 필요(부재 증명 불필요) | DeFi 과담보 구조에서 각 프로토콜이 실제 토큰을 락업하므로 "이중담보가 정상 동작"이라는 반론을 못 넘음 |
| Cross-chain DvP 원자성 | 결제 핵심 문제 | **[FACT]** Chainlink CRE×JPM Kinexys×Ondo, ERC3643 협회×LayerZero×Tokeny×ABN AMRO가 이미 실증 |
| 24/7 vs stale NAV | Stream 사고와 직결 | **[FACT]** DIA·RedStone NAV 피드, Chainlink SmartData, RedStone **Settle**(2026-04)로 포화 |
| 제재자금 유입 사후증명 | 컴플라이언스 수요 | **[FACT]** Hypernative provenance/toxicity 모니터링, Blockaid×Predicate 실행시점 차단 |
| 커스터디 출금 화이트리스트·트래블룰 | 기관 필수 통제 | **[FACT]** Fireblocks·BitGo·Anchorage·Copper가 제품화 완료 |
| 온체인 트레저리 준비금 증명 | 감사 수요 | **[FACT]** Chainlink PoR 40+ 피드, 56개 프로젝트, $17B 검증 |
| best execution vs MEV | SEC 2026 검사 우선순위에 포함 | Flashbots·CoW·1inch Fusion 성숙. 벤치마크가 오프체인이라 증명 대상 아님 |
| 법적 finality vs 체인 finality | EU가 공식 인정한 충돌 | **입법으로 해결 중**(SFD 개정·신규 규정). 오프체인 사실이라 증명 원천이 없음 |
| 도산·담보우선순위 vs 자동청산 | UCC Art.12 등 실제 쟁점 | 트리거(법원 명령)가 **어느 체인에도 없음** → Attestcoin 부적합 |
| 회계 look-through | GAAP 등가물 부재 | 강제력·지불의사 약함 → 다른 후보로 흡수 |
| 다중체인 등록부 정합 | Attestcoin 적합도 최고 | 대상이 *공급량/상태* → state proof 없이는 불건전 |

---

# 5. 아이디어 선별 기준

**두 가지 목적을 동시에 만족해야 한다.**

| 목적 A — Hackathon | 목적 B — Digital Asset Portfolio |
|---|---|
| 며칠 내 PoC 가능 | 실제 금융회사 업무와 연결 |
| 문제를 30초에 설명 | RWA·institutional DeFi 흐름과 연결 |
| 1~2분 데모 | 기술+리스크+규제+오퍼레이션으로 확장 가능 |
| Attestcoin 사용 이유가 명확 | 면접에서 5~10분 깊게 이야기할 소재 |
| 심사위원에게 기술적 차별성 | generic Web3 포트폴리오와 차별 |

가중치(최종 라운드): Real Financial Pain 20% · Existing Solution Gap 20% · Real Onchain Evidence 15% ·
Attestcoin Fit 15% · Cross-chain Naturalness 10% · Buildability/Demo 10% · Portfolio Value 10%

**Hard Kill 조건**(하나라도 확인되면 총점 무관 탈락): 기존 제품이 사실상 end-to-end 해결 / 실제 사건 사례 없음 /
크로스체인 설정이 정당화 안 됨 / Attestcoin 없이도 거의 같은 프로젝트 / Attestcoin 능력상 핵심 로직 구현 불가 /
가격·리스크 파라미터만으로 충분.

---

# 6. 최종 아이디어 — 문제 정의

TradFi 담보관리는 담보를 **두 축**으로 본다.

| 축 | 내용 | 온체인 대출에서 |
|---|---|---|
| **가격** | 시가·헤어컷·변동성 | ✅ oracle price, LTV/LLTV, 청산임계 |
| **적격성** | redeemability, transferability, 발행사 통제, 자산 pause, 법적·운영상 사용가능성 | ❌ 사실상 없음 |

**[FACT]** ECB/Eurosystem은 적격 담보 기준을 Guideline (EU) 2015/510 Part Four에 규정하고 NCB가 사전 심사 후
목록에 게시하며 임시 프레임워크로 기준을 바꾼다. ICMA 삼자repo는 등급별 eligibility set과 헤어컷을, ISDA는
관할별 적격담보 비교표를 유지한다.
*(단, "비가격 사유로 적격성이 상실된다"는 조항을 **원문 verbatim으로 인용하지는 못했다** — 제출 전 확인 필요)*

따라서 문제는:

> **가격이 아직 움직이지 않았어도 자산은 먼저 담보로 부적격해질 수 있는데, 온체인 신용시장에는 그 축이 없다.**

**중요한 정정 [CORRECTED].** 조사 초기에 나는 "적격성 축이 온체인에 아예 없다"고 썼는데 **틀렸다.**
Aave는 LTV=0으로, Morpho 큐레이터는 cap=0으로 담보를 끌 수 있고, Hypernative는 탐지→대응을 초 단위로 실행한다.
증거에 맞춘 정확한 문제는 다음이다:

> **자산 측 사건이 터졌을 때 그 자산을 물고 있는 것은 발행사 본인이 아니라 무관한 제3자 프로토콜이다.
> 현재 그들이 아는 경로는 (a) 같은 벤더를 각자 구독하거나 (b) 사람이 보고 수동 대응하는 것뿐이고,
> **목적지 컨트랙트가 그 사건을 스스로 검증하는 경로는 없다.** 자산과 신용시장이 다른 체인이면 간극이 커진다.**

---

# 7. 왜 Cross-chain인가

이 프로젝트에 대한 **가장 강한 반례**는 이것이다:

> "같은 체인이면 issuer contract를 그냥 읽으면 되는데 왜 Attestcoin이 필요한가?"

정면으로 답한다: **통제와 신용이 다른 체인에 있는 구조가 이미 대규모로 실재한다** (§9, §10).
같은 체인이면 직접 읽기가 더 단순하다는 것은 **맞다**. 이 프로젝트의 범위는 **다른 체인일 때**다.

---

# 8. 실증 ① — sNUSD (자산 레벨 사건이 실재한다는 증거)

## 확인 사실 [FACT]

```
token   sNUSD (Staked NUSD, Neutrl)  0x08efcc2f3e61185d0ea7f8830b3fec9bfa2ee313  (Ethereum)
event   Paused(address)
block   25,745,732      2026-08-13 11:14:59 UTC      tx status = 1 (성공), 로그 1건
tx      0xc25678129b98d6cb082472cc38b3e9908a81829e5826325c71d62318cb2f9c9a
```

같은 시점 sNUSD를 보유하던 컨트랙트(직접 조회) [FACT]:

| 보유자 | 보유량 | 정체 |
|---|---:|---|
| `0x10c5e771…62666409` | **8,202,400 sNUSD** | `SY-sNUSD` (Pendle Standardized Yield, `asset()=NUSD`) |
| `0xbbbbbbbb…37eeffcb` | 1,828,755 sNUSD | **Morpho Blue 싱글턴** |
| `0x00000000…3de08a90` | 7,710 sNUSD | Uniswap V4 PoolManager |

**[FACT]** Morpho API 조회 결과 sNUSD/USDC 마켓에 **차입 잔액 $1,661,397**이 남아 있고, 보고된 담보가치는 $0.
**[FACT]** 배경: Neutrl이 준비금 문제로 NUSD 발행·환매를 중단(2026-08-14 공표, 유통 약 $53.6M, 준비금 87%가
Fireblocks 경유). 다운스트림 Strata는 **별도로, 스스로** srNUSD·jrNUSD 관련 기능을 중단했다 — 자동 전파가 아니었다.

## 이 사례가 증명하는 것과 아닌 것

**증명하는 것 [INTERPRETATION]:** 개별 지갑 동결이 아닌 **자산/인스트루먼트 레벨의 적격성 훼손 사건이
실제로, 명시적 온체인 이벤트로, 지금도 발생한다**. 그리고 그 여파는 발행사와 무관한 제3자 프로토콜이 떠안는다.

**⚠️ 한계 (명시):** **이 사건 자체는 cross-chain이 아니었다.** sNUSD도 Pendle SY도 Morpho도 Ethereum에 있다.
따라서 sNUSD는 "**사건 유형이 실재한다**"는 증거이지 "**cross-chain 구조가 실재한다**"는 증거가 아니다.
그 증거는 §9에서 따로 확보했다. **두 사례를 하나의 사건처럼 서술하면 안 된다.**

---

# 9. 실증 ② — USDe × Robinhood Chain (cross-chain 구조가 실재한다는 증거)

## Source / origin [FACT]

```
USDe (Ethena)   0x4c9EDD5852cd905f086C759E8383e09bff1E68B3   (Ethereum)
  totalSupply   3,992,807,046 USDe (≈$4B)
  owner()       0xE8Dc0Fab349EA169283C48Ccfd09d797E6DB7c94
  minter()      0xe3490297a08d6fC8Da46Edb7B6142E4F461b62D3
  paused() / isBlacklisted() → 바이트코드에 선택자 없음 (토큰 자체엔 동결 기능 없음)
```

## Destination [FACT]

```
Robinhood Chain (chainId 4663, Arbitrum Orbit L2, Ethereum에 정산)
USDe 표현      0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34
  totalSupply  288,815,204
  endpoint()   0x6F475642a6e85809B1c36Fa62763669b1b48DD5B  +  peers(uint32) 존재
  → LayerZero OFT. 즉 원본은 Ethereum, 이건 크로스체인 표현
  l1Address() 없음 → 표준 Arbitrum 게이트웨이 브리지 토큰은 아님
```

## Morpho 담보 마켓 [FACT] (Morpho 공개 API 조회)

| 담보 | 대출자산 | LLTV | 담보 | 차입 |
|---|---|---:|---:|---:|
| **USDe** | USDG | 92% | **$285,532,168** | **$251,647,632** |

## 의미

**증명하는 것 [INTERPRETATION]:** 발행/통제의 source of truth와 신용 베뉴가 **서로 다른 체인에 있는 구조가
$285M 규모로 실재한다**. 그리고 목적지 체인의 컨트랙트는 Ethereum 쪽 사건을 스스로 확인할 수단이 없다.

**⚠️ 한계 (명시):** **USDe에서 sNUSD 같은 pause 사건이 실제로 발생했다는 뜻이 아니다.** USDe 토큰에는 pause/
blacklist 기능조차 없다(위 확인). 적격성을 바꿀 사건이 있다면 발행·상환 레이어(EthenaMinting 등, Ethereum)에서
일어난다. 이 사례의 역할은 **구조의 실재 증명**이지 사건 증명이 아니다.

---

# 10. 추가 cross-chain 사례

## syrupUSDG (Maple) [FACT]

```
Robinhood Chain  0x40858070814a57FdF33a613ae84fE0a8b4a874f7   totalSupply 90,799,994
Morpho 담보 $90,801,145 / 차입 $79,438,999 / LLTV 92%
```
**[FACT]** Maple의 크레딧 엔진과 풀은 Ethereum이고, syrupUSDG는 "Ethereum과 Robinhood Chain에서 이용 가능".

## Centrifuge — JAAA / JTRSY / deJAAA (구조가 가장 명시적) [FACT]

Centrifuge V3는 **hub-and-spoke**다: "each pool selects a single hub chain for management and can tokenize
and distribute liquidity on many spoke chains." hub = 풀 관리·회계·NAV·가격 배포, spoke = share token·vault·escrow.

**`PoolId`가 hub 체인을 인코딩한다** (`src/core/types/PoolId.sol`): `centrifugeId = poolId >> 48`.
centrifugeId 매핑(env/*.json): 1=Ethereum, 2=Base, 3=Arbitrum, 4=Plume, 5=Avalanche, 6=BNB, 9=HyperEVM,
10=Optimism, 11=Monad, 12=Pharos.

Ethereum Spoke(`0xEC3582fc…`) `AddShareClass` 이벤트 30건을 전수 스캔해 확인:

| 토큰 | 주소(Ethereum) | poolId | **hub** | 체인별 공급량 |
|---|---|---|---|---|
| **JAAA** | `0x5a0F93D040De44e78F251b03c43be9CF317Dcf64` | 281474976710663 | **Ethereum(1)** | ETH 371,157,461 · **Avalanche 250,000,001** · Base 48,207,418 · BNB 497,554 |
| **JTRSY** | `0x8c213ee79581Ff4984583C6a801e5263418C4b86` | 281474976710662 | **Ethereum(1)** | ETH 783,770,063 · Plume 496,381 · BNB 478,397 |
| **deJAAA** | `0xAAA0008C8CF3A7Dca931adaF04336A5D808C82Cc` | 281474976710659 | **Ethereum(1)** | ETH 5,471,277 · Base 675,661 |

**[FACT]** Base에는 deJAAA·JTRSY 담보 Morpho 마켓이 **이미 개설**돼 있다(LLTV 86~98%) — 다만 사용액은 **$14** 수준.

**왜 중요한가 [INTERPRETATION]:** 기관 RWA가 "hub에서 통제·회계, spoke에서 유통·담보"로 **설계 단계에서부터
분리**되고 있다. 이는 우리 문제(통제 체인 ≠ 신용 체인)가 우발적 현상이 아니라 **아키텍처 추세**라는 뜻이다.

## 탈락한 사례 [CORRECTED]

**sBUIDL × Euler(Avalanche)** — 처음엔 최우선 후보였다. 실측 결과 탈락:
- `sBUIDL 0xaEb1FA0853c7C98EAb10fcF0EA669aE3d07FBB10`의 `asset()`은 **Avalanche의 BUIDL**
  (`0x53FC82f14F009009b440a706e31c9021E1196A2F`, supply 634,332,208) → **통제와 담보가 같은 체인**
- sBUIDL 공급량은 **9,240**까지 줄어 사실상 휴면
- Avalanche의 JAAA 250,000,001개도 최근 50k 블록 내 전송 0건, 주요 대출 베뉴 보유 0 → **휴면**

---

# 11. [CORRECTED] 스테이블코인 블랙리스트 가설 — 폐기

## 초기 가설

USDC/USDT의 freeze·burn 이벤트를 "발행사 통제 행위"의 근거로 삼으려 했다. 처음 15일 표본에서
USDC `Blacklisted` 7건, USDT `AddedBlackList` 16건, USDT `DestroyedBlackFunds` 15건을 확인했고,
"실데이터가 풍부하다"고 판단했다.

## 전수 검증 [FACT]

60일치(약 432,000블록)를 전수 디코딩:

| 이벤트 | 건수 | 컨트랙트 대상 | 정체 |
|---|---:|---:|---|
| USDC `Blacklisted(address)` | 다수 | 소수 | — |
| USDT `AddedBlackList` | — | 소수 | — |
| USDT `DestroyedBlackFunds` | **31건** (총 **6,961,544 USDT** 소각) | 4건 | USDT 컨트랙트 자기 자신 1건 + 나머지 |

컨트랙트 대상들을 개별 조회한 결과 **전부 23바이트 스마트월렛/위임 계정 또는 outboundTxCount=1인 소형 컨트랙트**
였고, **담보 풀이나 대출 프로토콜은 단 한 건도 없었다.**

## 결론 [CORRECTED]

> **개별 EOA 또는 스마트월렛 freeze는 "asset-level collateral eligibility" 사건이 아니다.**
> 이 프로젝트의 근거로 사용하지 않는다. 근거는 sNUSD형 **자산 레벨 pause**로 한정한다.

*(이 가설을 지우지 않고 남기는 이유: 같은 실수를 반복하지 않기 위해서다. "실데이터가 많다"와 "적절한 실데이터다"는 다르다.)*

---

# 12. Prior Art / 경쟁 인프라 검증

**원칙:** "비슷한 기능이 있다"와 "end-to-end 문제를 해결했다"를 구분한다. 아래 모두 **과소평가하지 않는다.**

## Hypernative — Threat **HIGH**

- **[FACT]** "탐지 신호를 **사전 승인된 온체인 액션에 직접 바인딩**해 수 초 내 실행". 알림만이 아니다.
- **[FACT]** 2026-05-07 Parallel USDp 익스플로잇에서 실제로 프로토콜을 **pause**시켰다.
- **[FACT]** **Neutrl의 pauser 역할을 맡고 있다** — 즉 §8 사건의 당사자가 이미 고객이다.
- **겹치는 부분:** 사건 탐지 → 온체인 대응. 우리보다 **훨씬 빠르다(초 vs 8~9분)**.
- **남는 차이 [INTERPRETATION]:** ① **고용한 고객 자신의 컨트랙트**를 멈춘다 — 그 자산을 물고 있는 무관한 제3자
  프로토콜은 보호 대상이 아니다(Strata가 별도로 스스로 멈춘 것이 그 증거). ② 목적지 컨트랙트가 **스스로 검증**
  하는 것이 아니라 벤더를 **신뢰**한다.

## Aave — Threat **HIGH**

- **[FACT]** 2026-04 rsETH 사고 때 Protocol Guardian·Risk Steward가 **Ethereum·Arbitrum·Base·Mantle·Linea
  전 네트워크에서 동시에 pause + LTV=0**을 실행했다. 우리가 제안하려던 대응이 이미, 크로스체인으로, 실행된다.
- **[FACT]** 자동화도 있다: **Chaos Labs Edge Risk Oracle → AaveStewardsInjector(Chainlink Automation) →
  Risk Steward**로 파라미터가 자동 주입된다(Arbitrum 마켓 동적 cap 등). 단 입력은 **시장 리스크 지표**이고,
  범위는 거버넌스가 정한 `maxPercentChange` 안이며, rates steward는 보안상 **금리 업데이트로만 한정** 배포됐다.
- **[FACT]** Aave **Horizon**의 `RwaATokenManager`(소스 2,091바이트 전문 확인)는 기능이
  `grantAuthorizedTransferRole` / `revokeAuthorizedTransferRole` / `transferRwaAToken` /
  `hasAuthorizedTransferRole` **뿐**이다 → **전송 권한 관리 전용**. 적격성·동결·담보 비활성화 기능은 없다.
- **남는 차이:** 트리거가 **사람 또는 시장지표**이지 **발행사 사건**이 아니다.

## Morpho Blue — 코드 레벨 확인

- **[FACT]** `morpho-org/morpho-blue/src/Morpho.sol`(22,047바이트) 전수 검색:
  `pause`·`freeze`·`frozen`·`disable`·`emergency`·`shutdown`·`blacklist` **매치 0건**.
  `onlyOwner` 함수는 5개뿐 — `setOwner`, `enableIrm`, `enableLltv`, `setFee`, `setFeeRecipient`.
- **정확한 표현 [INTERPRETATION]:** *Morpho 생태계 전체가 아무 대응도 못 한다*는 뜻이 **아니다**. 볼트 큐레이터는
  `submitCap`으로 cap을 즉시 0으로 내리고 supply queue를 비울 수 있다. 정확한 사실은
  **"Morpho Blue 코어 마켓 자체에 임의의 pause primitive가 없다"** 는 것이다. 그래서 마켓의 실질 통제점은
  생성 시 지정한 **oracle**이다.

## Euler v2

- **[FACT]** `EVault/modules/Governance.sol`: `setLTV`, `setHookConfig(hookTarget, hookedOps)`, `setCaps`,
  `setConfigFlags`가 모두 **`governorOnly`**. 훅으로 오퍼레이션을 차단할 수 있으나 **거버너가 눌러야** 한다.
- **[INTERPRETATION]** 훅 구조 덕에 **같은 체인의 외부 status를 읽는 통합은 기술적으로 가능**하다. 자동 소비가
  기본 제공되지 않을 뿐이다.

## Chainlink

- **[FACT]** SmartData 프로덕션 피드 유형은 공식 문서 목차 기준 **Proof of Reserve · NAVLink(SmartNAV) ·
  SmartAUM 3종**이다. PoR은 40+ 피드/56개 프로젝트/$17B 검증.
- **[FACT]** **MVR 피드는 숫자·비숫자 데이터를 온체인 번들로 전달할 수 있다** — 기술적으로 status 값 전달은 가능하다.
- **[FACT]** ACE/CCT는 *이전 적격성*·정책 강제·크로스체인 컴플라이언스 메타데이터를 다룬다.
- **구분 [INTERPRETATION]:** **"기술적으로 전달 가능"과 "적격성/환매상태를 크로스체인 대출 통제에 공급하는
  프로덕션 솔루션이 존재"는 다르다.** 후자는 조사 범위에서 발견하지 못했다.

## 기타

- **[FACT]** LlamaRisk **LlamaGuard PT** — Pendle PT 담보용 온체인 리스크 체크(자산 특화, 발행사 사건 아님)
- **[FACT]** Blockaid × Predicate — 실행 시점 정책 차단 (트랜잭션 위험 판정)
- **[FACT]** RedStone **Settle**(2026-04) — RWA 담보 청산 결제 (자격 판정 아님)

---

# 13. GO 판단까지 걸어둔 3개 Condition

## CONDITION 1 — 실제 cross-chain collateral workflow 존재? → **YES**

근거: §9 USDe × Robinhood Chain (담보 $285.5M / 차입 $251.6M / LLTV 92%, OFT 확인),
§10 syrupUSDG($90.8M), Centrifuge hub-spoke(hub=Ethereum, spoke에 실공급).
"멀티체인 배포"만으로는 부족하다는 기준을 세우고, **실제 담보 예치·차입이 일어나는 것**까지 확인했다.

## CONDITION 2 — 기존 벤더가 end-to-end로 이미 해결? → **NO**

end-to-end 정의: `발행사 적격성 사건 → 크로스체인 전달/검증 → 목적지 대출 프로토콜 → 담보 판정`.
조사 범위: Chainlink(SmartData 피드 유형 전수, ACE/CCT), Hypernative(제품 문서·실제 사례),
Chaos Labs(Edge Risk Oracle 구조), LlamaRisk, Blockaid, Aave Horizon(소스), RedStone.
결과: 부품은 많으나 **네 단계를 잇는 경로는 발견되지 않았다.**

## CONDITION 3 — 목적지 프로토콜이 발행사 authoritative status를 자동 소비? → **NO**

Morpho Blue는 소스 코드상 pause primitive 자체가 없고, Euler는 전부 `governorOnly`,
Aave는 사람/시장지표 기반, Horizon의 발행사 훅은 전송 권한 관리 전용.

---

# 14. 현재 프로젝트가 **주장하는 것**

> **소스 체인에서 발생한 명시적 담보 훼손 사건을, 목적지 신용 베뉴가 Attestcoin proof로 스스로 검증하고,
> 그 사건 이후의 신규 신용공여를 제한할 수 있다.**

세부 주장:
1. 그 사건은 **이산적**이고 **시간순서**가 금융 판정에 결정적이다.
2. 목적지는 벤더·오라클을 **신뢰하지 않고** 검증한다 (assertion → proof).
3. 이 설계는 Attestcoin의 한계를 **하나도 건드리지 않는다**.

---

# 15. 절대 **주장하지 않는 것**

> ### ❌ 실시간 차단
> **[FACT]** attestation 지연 실측 8~9분. 따라서 real-time exploit prevention이 아니라
> **delayed but verifiable gating for new credit**이다. Hypernative는 초 단위로 대응한다 — 속도로는 진다.
>
> ### ❌ 기존 Morpho 마켓을 멈춘다
> Morpho Blue 코어 마켓에는 pause primitive가 없어 **누구도 멈출 수 없다**. 이 PoC는 기존 마켓을 통제하는 것이
> 아니라 **CC3 위의 신용 베뉴에 적격성 로직을 적용**한다.
>
> ### ❌ `NO_PROOF` = 건강함
> `NO_PROOF`는 **"아직 훼손 proof가 ingest되지 않았다"**는 뜻이다. **부재는 증명 불가**이므로 자산이 건강하다는
> 증명이 될 수 없다. 컨트랙트 주석과 테스트에 이 성질을 고정했다.
>
> ### ❌ "아무도 해결하지 않았다"
> 기존 인프라는 모니터링·대응·정책을 이미 많이 해결했다. 이 프로젝트의 초점은
> **크로스체인에서 검증 가능한 적격성 사건을 목적지 신용 판단에 연결하는 특정 primitive** 하나다.

---

# 16. 현재 설계

## 아키텍처

```
Ethereum (자산 통제)                      Creditcoin CC3 (신용 공여)
  자산 레벨 적격성 사건   ──proof──▶   EligibilityLedger ──▶ GatedCreditLine
  예: sNUSD Paused                       (5중 검사·상태기계)   (신규 여신 게이팅)
```

## 상태 기계 (자산 단위)

```
NO_PROOF ──impairment proof──▶ IMPAIRED ──restoration proof(엄격히 더 나중)──▶ RESTORED
```

## 5중 검사 (순서 고정, v1 엔진 재사용)

1. **리플레이 방지** — `keccak(chainKey, blockHeight, txIndex)`. txIndex는 precompile이 재계산하므로 제출자가 조작 불가
2. **포함·연속성 증명** — BlockProver precompile
3. **소스 tx 성공** — `receiptStatus == 1` (precompile은 확인하지 않음)
4. **emitter 허용목록** — 등록된 자산 컨트랙트의 로그만 인정
5. **이벤트 시그니처** — 등록된 훼손/복구 시그니처와 일치

미일치 로그는 **skip**(revert 아님) — 실제 tx는 배치로 여러 로그를 담기 때문. 매칭이 하나도 없으면
`NoMatchingEvent`로 revert하고 **아무것도 쓰지 않는다**. 추가로 자산은 **정확히 하나의 소스 체인**에 등록되며,
다른 chainKey로 같은 주소가 오면 `WrongChainKey`로 revert한다.

## A. 출구는 절대 게이팅하지 않는다 ⭐

훼손이 증명돼도 다음은 **항상 허용**한다:
- `repay` — 부채 상환
- `withdrawCollateral` — 담보 회수

차단하는 것은 **새로운 리스크 생성**뿐이다:
- `openPosition` — 신규 포지션
- `borrowMore` — 추가 차입
- `addCollateral` — 담보 추가(= 해당 자산에 대한 신규 익스포저)

**설계 원칙:** > **gate new risk, never trap existing users.**
리스크 통제 시스템이 사용자의 출구까지 막으면 통제가 아니라 인질극이 된다.
테스트에서 이 성질을 고정했다("repay works while impaired", "collateral withdrawal works while impaired").

## B. Earliest Proven Impairment Cutoff ⭐

여러 훼손 proof가 들어올 때 **가장 이른 증명된 블록**을 cutoff로 유지한다.
- 더 **늦은** proof는 cutoff를 **뒤로 밀지 못한다** (`EventIgnored` 이벤트로 기록만)
- 더 **이른** proof가 오면 cutoff를 **앞당긴다**

**이유:** 실제 훼손 이후 실행된 신용공여는 **proof가 늦게 도착했다는 이유로 정상 거래가 되지 않는다.**

## C. Recovery Rule

- 복구는 **훼손이 먼저 증명된 경우에만** 의미를 가진다 (`no impairment proven` → 무시)
- 복구 블록은 훼손보다 **엄격히 나중**이어야 한다 (`not later than impairment` → 무시)
- 이미 알려진 복구보다 **오래된** 복구 proof는 무시된다
- 더 이른 훼손이 새로 증명되어 cutoff가 앞당겨지면, 그보다 이르거나 같은 복구는 **무효화**된다

무시된 이벤트도 **히스토리에는 남긴다**(`EventIgnored`) — 조용히 버리지 않는다.

---

# 17. Attestcoin의 역할과 제약

## 하는 것 [FACT]

- Ethereum 소스 트랜잭션의 **포함 증명 + 블록 연속성 증명**
- 그 트랜잭션의 **receipt/logs 디코딩**(EvmV1Decoder) → 이벤트 시그니처·emitter·데이터 접근
- **시간순서 판정을 위한 검증 가능한 입력**(소스 블록 높이)

## 하지 못하는 것 [FACT]

| 제약 | 확인 방법 |
|---|---|
| **임의 현재 상태 증명 불가** | Proof Builder OpenAPI 전 엔드포인트 + `@gluwa/usc-sdk@0.18.0` 인터페이스 전수 확인 → account/storage 증명 경로 없음 |
| **부재 증명 불가** | 원리적. "이벤트가 없었다"를 증명할 수 없음 |
| **소스 체인 쓰기 불가 (outbound)** | 공식 문서: writability는 "3rd party testing and audits" 중, 배포 주소 없음 |
| **동기적 크로스체인 명령 불가** | 위와 동일 |
| **지원 체인 제한** | ChainInfo precompile 직접 조회: **Ethereum mainnet(chainKey 3), Sepolia(chainKey 1) 2개뿐** |
| **지연** | 실측 8~9분 (2회 측정: 41블록·43블록) |

## 증명 단위

`GET /api/v1/proof-by-tx/{chain_key}/{tx_hash}` · `GET /api/v1/proof/{chain_key}/{header}/{tx_index}` ·
`POST /api/v1/proof-batch{,-by-tx}/{chain_key}` — 전부 **트랜잭션 단위**.

---

# 18. 왜 Creditcoin/CC3에 Credit Venue를 만드는가

Attestcoin은 **inbound 검증 전용**이다. Creditcoin은 다른 체인에 명령을 보낼 수 없다.
따라서 `Ethereum event proof → CC3 contract` 구조가 **유일하게 가능한 형태**이고, 이는 곧
**신용 베뉴 자체가 CC3 위에 있어야 한다**는 뜻이다.

**우리는 실제 Robinhood Chain이나 Morpho를 제어한다고 주장하지 않는다.**
PoC에서 CC3 컨트랙트는 **Robinhood Chain 같은 목적지 신용 베뉴의 역할을 축소 재현**한다.

**이것이 한계를 숨기는 우회가 아닌 이유 [INTERPRETATION]:** 검증하려는 핵심 아키텍처는
`source-chain fact → destination financial decision`이다. 목적지가 Robinhood Chain이든 CC3든
**"목적지 컨트랙트가 소스 사건을 스스로 검증해 신용 판단에 반영한다"**는 명제는 동일하게 검증된다.
실제 구조(§9, §10)는 그 명제가 현실에서 필요한 이유를 뒷받침하는 근거로 인용한다.

---

# 19. 현재 구현 상태

## 컨트랙트

| 파일 | 크기(컴파일) | 상태 |
|---|---:|---|
| `contracts/src/EligibilityLedger.sol` (311줄) | 7,431 B | **DONE** |
| `contracts/src/GatedCreditLine.sol` (213줄) | 5,007 B | **DONE** |
| `contracts/src/vendor/EvmV1Decoder.sol` | 10,303 B | **DONE** (`@gluwa/usc-contracts@0.1.2` verbatim) |
| `contracts/src/VaultAuthorityLedger.sol` (v1, 308줄) | 6,870 B | **DONE** — 폐기된 아이디어지만 회귀용으로 유지 |

## 기능별

| 기능 | 상태 |
|---|---|
| proof ingestion (5중 검사) | **DONE** |
| replay protection (position-keyed) | **DONE** |
| emitter allowlist / signature match / chainKey 검증 | **DONE** |
| earliest-impairment cutoff | **DONE** |
| recovery(복구) 순서 검증 | **DONE** |
| credit venue — `openPosition` / `borrowMore` / `addCollateral` 게이팅 | **DONE** |
| `repay` / `withdrawCollateral` 무게이팅 | **DONE** |
| `exposedPositions` 조회 | **DONE** |
| 배포 스크립트 `scripts/deploy-eligibility.js` (157줄) | **DONE (미실행)** |
| CC3 실배포 | **NOT STARTED** — faucet 대기 |
| 프론트엔드 | **NOT STARTED** |
| README / 덱 / 데모 영상 | **NOT STARTED** |

## 테스트

| 파일 | 결과 | 내용 |
|---|---|---|
| `test/eligibility.test.js` (236줄) | **27/27** | 유닛 |
| `test/realdata-eligibility.test.js` (184줄) | **10/10** | **실제 mainnet proof + 실제 EvmV1Decoder** |
| `test/ledger.test.js` (v1) | 15/15 | 회귀 |
| `test/realdata.test.js` (v1) | 8/8 | 회귀 |
| **합계** | **60/60** | |

### 핵심 네거티브 케이스 (모두 통과)

- 위조/무효 proof → `ProofRejected`
- 처리된 쿼리 재제출 → `QueryAlreadyProcessed`
- 미등록 emitter만 있는 tx → `NoMatchingEvent` (아무것도 기록 안 됨)
- 등록 자산이지만 미설정 시그니처 → `NoMatchingEvent`
- 실패한 소스 tx(status 0) → `SourceTxFailed`
- 같은 주소·다른 소스 체인 → `WrongChainKey`
- 배치 tx에서 등록 자산 로그만 1건 기록
- 늦은 훼손 proof가 cutoff를 밀지 못함 / 이른 proof는 앞당김
- 훼손보다 이른 복구 proof는 무시

### real-data 테스트가 실제로 한 일 [FACT]

```
Proof Builder에서 실제 proof 취득: txBytes 1,536B · siblings 10 · continuity roots 69
→ 실제 EvmV1Decoder가 파싱, receiptStatus=1, 로그 1건
→ sNUSD Paused 로그 확인 (emitter 0x08EFCC2F3e61185D0EA7F8830B3FEc9Bfa2EE313)
→ EligibilityLedger: NO_PROOF → IMPAIRED, impairedSince = 25,745,732
→ GatedCreditLine.openPosition() → revert AssetImpaired
```
**BlockProver precompile만 mock** — CC3 런타임 컴포넌트라 로컬 EVM에 존재할 수 없고,
이미 spike/scripts/01–06에서 실제 메인넷 tx로 검증된 유일한 부분이다.

---

# 20. 배포 상태

**CC3 배포: 미완료.** 원인은 단 하나 — **배포 지갑 잔액 0 CTC**.

```
deploy wallet   0xDd9ddFcEb1dc1dC0aE393DD458Fe376aaB60294a
CC3 balance     0.0 CTC   (2026-08-18 재확인)
faucet          Creditcoin Discord #token-faucet  (API/CLI/웹 없음 — 사람이 해야 함)
                /faucet address:0xDd9ddFcEb1dc1dC0aE393DD458Fe376aaB60294a
```

## `node contracts/scripts/deploy-eligibility.js`가 하는 일

1. `EvmV1Decoder` 배포 (공식 목록의 `0x731c…F9f`는 구버전이라 자체 배포)
2. `EligibilityLedger` 배포 — 실제 BlockProver precompile `0x…0FD2`에 연결
3. `GatedCreditLine` + mock ERC20 2종 배포
4. sNUSD를 chainKey 3으로 등록, `Paused(address)`/`Paused()`를 훼손 시그니처,
   `Unpaused(address)`/`Unpaused()`를 복구 시그니처로 설정, 마켓 리스팅(LTV 92%)
5. Proof Builder에서 **실제** sNUSD pause proof 취득 (attested height 확인 포함)
6. `submitEvent` 온체인 제출 → 상태·`impairedSince`·이벤트 읽기
7. `openPosition` staticCall이 `AssetImpaired`로 revert하는지 확인
8. `contracts/deployment.json` 기록

**잔액 0이면:** faucet 안내를 출력하고 **exit code 2**로 중단한다(현재 실행 결과가 정확히 이것).

---

# 21. 현재까지 확인된 가장 강한 반례 (살아 있는 위험)

| # | 반례 | 왜 위험한가 | 왜 아직 프로젝트를 죽이지 않았나 |
|---|---|---|---|
| 1 | **Hypernative의 자동 대응** | 초 단위 탐지→pause 실행, 실제 사례 있음, Neutrl의 pauser | 고용 고객 **자신의** 컨트랙트만 보호. 제3자 프로토콜로의 자동 전파는 없었음(Strata가 별도 대응). 신뢰 기반 |
| 2 | **오라클/MVR 확장성** | Chainlink MVR은 비숫자 데이터 전달 가능 → 적격성 피드를 만들 수 있음 | 만들 수 있다 ≠ 만들어져 있다. 프로덕션 피드 유형은 PoR/NAV/AUM 3종뿐. 또한 assertion 기반이라 신뢰 모델이 다름 |
| 3 | **같은 체인이면 직접 읽기** | 동일 체인에서는 컨트랙트 직접 read/hook이 훨씬 단순 | 맞다. 그래서 범위를 **다른 체인일 때**로 한정. 단 서사에서 이 경계를 흐리면 즉시 무너짐 |
| 4 | **proof 지연 8~9분** | 고빈도 익스플로잇 방어에 부적합 | 주장 범위를 **신규 여신 게이팅**으로 축소. Stream 사례는 며칠간 오작동이 지속돼 분 단위가 무의미했다는 반례도 있음 |
| 5 | **실제 수요 미검증** | 기관이 proof 기반 적격성 레이어를 원하는지 시장검증 안 됨 | PoC 단계에서 요구할 수 없는 수준의 검증. 다만 **[HYPOTHESIS]**로 명시하고 과장하지 않음 |
| 6 | **최고의 사건 증거가 same-chain** | sNUSD 사건은 크로스체인이 아님 | 구조 증거(§9, §10)를 별도로 확보해 보완. **두 사례를 합쳐 서술하지 않는 것**이 필수 |
| 7 | **Attestcoin이 2개 체인만 지원** | 현실적 조합(Ethereum→Base/Avalanche/RH Chain)을 시연 불가 | 목적지를 CC3로 두는 것이 오히려 해커톤 취지에 부합. 실제 구조는 근거로 인용 |

---

# 22. FACT / INTERPRETATION / HYPOTHESIS 요약

| 구분 | 내용 |
|---|---|
| **FACT** | sNUSD가 block 25,745,732(2026-08-13 11:14:59 UTC)에 `Paused` 되었다 |
| **FACT** | 그 시점 Pendle `SY-sNUSD`가 8,202,400 sNUSD, Morpho Blue가 1,828,755 sNUSD를 보유 중이었다 |
| **FACT** | Robinhood Chain Morpho에 USDe 담보 $285.5M / 차입 $251.6M이 있고, USDe 원본·통제는 Ethereum(LayerZero OFT로 확인) |
| **FACT** | Morpho Blue 코어에는 pause primitive가 없다(소스 코드 전수 검색) |
| **FACT** | Chainlink 프로덕션 SmartData 피드 유형은 PoR·NAVLink·SmartAUM 3종이다 |
| **FACT** | Attestcoin은 트랜잭션 포함 증명만 제공하며 상태·부재 증명과 outbound 쓰기가 불가하고 지연이 8~9분이다 |
| **INTERPRETATION** | redeemability 훼손은 **가격과 별개의** 담보 리스크 축이 될 수 있다 |
| **INTERPRETATION** | 통제 체인과 신용 체인의 분리는 우발이 아니라 **아키텍처 추세**다(Centrifuge hub-spoke, OFT 표현) |
| **INTERPRETATION** | 기존 해법은 **당사자 본인 또는 신뢰 벤더** 구조이며, 무관한 제3자가 스스로 검증하는 경로는 비어 있다 |
| **HYPOTHESIS** | 소스 체인 훼손 proof를 목적지 신용 베뉴가 소비하면 크로스체인 신용 리스크 통제가 개선된다 |
| **HYPOTHESIS** | 기관은 assertion보다 proof 기반 트리거에 가치를 둘 것이다 (**시장 미검증**) |
| **CORRECTED** | "적격성 축이 온체인에 없다" → 틀림. 축은 있고, 없는 것은 **제3자 간 검증 가능한 전파 경로**다 |
| **CORRECTED** | "스테이블코인 블랙리스트가 근거다" → 틀림. 60일 전수조사 결과 담보 풀 대상 0건 |
| **CORRECTED** | "sBUIDL×Euler가 크로스체인 사례다" → 틀림. Avalanche BUIDL을 감싼 **같은 체인** 구조이며 휴면 |

---

# 23. Tomorrow Checklist

1. **오늘 코드/테스트를 다시 읽고 이 문서와 설계가 일치하는지 확인**
   → `contracts/src/EligibilityLedger.sol`, `contracts/src/GatedCreditLine.sol`
   → `cd contracts && node scripts/compile.js && node test/eligibility.test.js && node test/realdata-eligibility.test.js`
2. **CC3 faucet 수령 여부 확인** → 받았으면 `node scripts/deploy-eligibility.js` 실행(원커맨드로 배포+실제 proof ingest까지)
3. **실제 proof ingest 재현** — real-data 테스트가 여전히 통과하는지(소스는 mainnet이라 안정적)
4. **최소 프론트엔드 필요 여부 판단** — 데모 영상만으로 충분한지, 아니면 상태 표시 페이지가 설득력을 더하는지
5. **README / 제출 서사 작성** — §14(주장)와 §15(비주장)를 그대로 반영. prior art를 먼저 인정하는 톤
6. **데모 시퀀스 확정** — (a) 정상 차입 성공 → (b) 실제 tx 해시 입력·proof 제출 → (c) IMPAIRED 전이 →
   (d) 동일 차입 revert → (e) 위조 proof revert → (f) repay/withdraw는 여전히 동작(설계 의도 강조)
7. **프로젝트 이름 최종 결정** — 현재 가칭 "Collateral Eligibility Ledger"
8. **과장 claim 최종 점검** — "실시간", "아무도 해결 안 했다", "Morpho를 멈춘다", "NO_PROOF=안전" 표현이
   문서·코드주석·데모 스크립트 어디에도 없는지

**오늘은 여기서 새 구현을 시작하지 않는다.**

---

# 부록 — 문서 지도

| 파일 | 내용 |
|---|---|
| `docs/BUILD_SPEC_V2.md` | 현재 프로젝트 동결 스펙(범위·상태기계·검수기준·데모) |
| `ideation/FINAL_VERDICT.md` | GO 판정 전문 (3개 Condition 근거) |
| `ideation/IDEA_SELECTION_2026-08-18.md` | 18개 후보 발굴 → 13개 제거 → Top 3 |
| `ideation/PREBUILD_VALIDATION.md` | 구현 전 4-Gate 검증(이후 FINAL_VERDICT로 갱신됨) |
| `ideation/STRUCTURAL_SEARCH_ROUND1.md` | 8개 구조적 문제영역 kill table |
| `ideation/FEASIBILITY_LOOKTHROUGH.md` | Attestcoin state-proof 부재 확인(설계 최상위 제약의 출처) |
| `docs/CURRENT_STATE.md` | 짧은 현재상태 요약(에이전트 진입점) |
| `docs/SESSION_LATEST.md` | 세션 전문 로그 (`python3 tools/export-claude-session.py`로 갱신) |
| `AGENTS.md` / `CLAUDE.md` | 에이전트 자동 로딩 진입점(협업 규칙·기술 제약·금지사항) |
| `spike/BASELINE.md`, `spike/FINDINGS.md` | Attestcoin 기술 베이스라인·실측 결과 |
