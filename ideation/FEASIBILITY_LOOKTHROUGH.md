# 후보 #1 기술 타당성 검증 — Look-Through Entitlement Register

> 2026-08-18 실행. 모두 **우리가 직접 호출한 결과**이며, 기사/문서 인용이 아님을 표시했다.
> 태그: **[VERIFIED]** 직접 실행·측정 · **[FACT]** 외부 출처 · **[INFERENCE]** 추론

## 결론 요약

| 질문 | 답 |
|---|---|
| Attestcoin이 "record date 시점의 잔액"을 증명할 수 있는가 | **아니오** — state/storage proof가 존재하지 않음 |
| 이벤트 누적으로 재구성 가능한가 | **완전성은 불가능**(부재 증명 불가). claim + 보존식 + 이의제기 구조로만 건전함 |
| 문제가 실재하는가 | **예 — 메인넷에서 실측 확인** |
| 그럼에도 이 후보를 주력으로 삼아야 하는가 | **재검토 필요** — Securitize Vault Registrar가 정면으로 겨냥 중 |

---

## 1. [VERIFIED] Attestcoin의 증명 단위는 "트랜잭션"뿐이다

Proof Builder OpenAPI(`/api/swagger/openapi.json`) 전체 엔드포인트:

| method | path | 의미 |
|---|---|---|
| GET | `/api/v1/proof-by-tx/{chain_key}/{tx_hash}` | tx 1건 inclusion proof |
| GET | `/api/v1/proof/{chain_key}/{header_number}/{tx_index}` | 위치 기반 동일 |
| POST | `/api/v1/proof-batch/{chain_key}` | **연속 블록 범위** 다건, continuity proof 공유 |
| POST | `/api/v1/proof-batch-by-tx/{chain_key}` | tx 해시 목록 다건 |
| GET | `/api/v1/attested-height/{chain_key}`, `/health` | 상태 조회 |

스키마도 `ContinuityProofSchema`, `TransactionMerkleProofSchema`, `MerkleProofEntrySchema`뿐이다.
SDK(`@gluwa/usc-sdk@0.18.0`) `BlockProvingProvider` 인터페이스도 `verifySingle` / `verifyBatch` /
`verifyAndEmit*` 4개이며 모두 `(chainKey, height, encodedTransaction, merkleProof, continuityProof)`를 받는다.

**즉 account/storage MPT 증명 경로가 없다.** `balanceOf(user)`나 `vault.shares(user)` 같은 *상태*를
Creditcoin 쪽 컨트랙트가 신뢰 없이 확인할 방법은 현재 프로토콜에 존재하지 않는다.

### 1-1. [INFERENCE] 여기서 나오는 일반 원칙 — 프로젝트 전체에 적용됨

> **Attestcoin은 "사건(event)이 일어났다"를 증명하는 도구이지, "잔액/포지션이 얼마다"를 증명하는 도구가 아니다.**

제품의 핵심 대상이 *시점 잔액*이면 구조적으로 불리하고, *이산 사건*이면 자연스럽다.
이 한 줄이 Top 3 중 #1·#3(둘 다 register/position 형태)을 약화시키고 #2(발행사의 통제 *행위* = 사건)를
상대적으로 강화한다.

### 1-2. 그래도 건전하게 만들 수 있는 유일한 형태

완전성을 주장하지 않는 **청구 기반(claim-based) 구조**:

1. 투자자가 자기 예치·인출 tx를 proof로 제출 → `provenPosition = Σ입금 − Σ출금`
2. **누구나** 더 나중의 출금 tx를 증명해 그 청구를 자동 감액시킬 수 있다(이의제기 창) — 은닉 공격 차단
3. **보존식**: Σ지급가능청구 ≤ 발행사가 증명한 풀 보유량. 초과 청구는 구조적으로 불가
4. 레지스터는 "완전한 명부"가 아니라 **"반증되지 않은 증명된 청구"**만 주장한다

어제 프로젝트의 원칙("절대 완전한 이력을 주장하지 않는다 / 부재는 증명 불가")과 동일한 규율이다.
배치 proof(연속 블록 범위 공유 continuity proof)가 있어 다건 제출 비용은 낮다.

---

## 2. [VERIFIED] 문제는 메인넷에서 실재한다 — 직접 측정

Ethereum mainnet(head 25,781,512)에서 public RPC로 직접 조회.

### 2-1. 토큰 실체 확인

| 토큰 | 주소 | name (온체인) | totalSupply |
|---|---|---|---|
| USTB | `0x43415eB6…97d31C4e` | **Invesco Short Duration US Government Securities Fund** | 68,523,070.17 |
| BUIDL | `0x7712c342…f8aA2AEc` | **BlackRock USD Institutional Digital Liquidity Fund** | 225,102,892.87 |

> 주의: USTB는 Superstate 자료에서 알려진 이름과 달리 온체인 `name()`이 **Invesco** 명의였다.
> 펀드 이관/리브랜딩 가능성 — 인용 전 반드시 재확인할 것. **[UNVERIFIED]**

### 2-2. 증권형 토큰은 실제로 스마트컨트랙트가 보유 중

최근 8,000블록(~27시간) 구간에서 USTB 전송 172건, 상대방 10개 중 **6개가 컨트랙트**.

| 컨트랙트 | 정체 | 보유량 |
|---|---|---|
| `0x4e58a2e4…62e8dfdb3` | **Aave Horizon RWA USTB (`aHorRwaUSTB`)**, `asset()=USTB`, `POOL=0xAe05Cd22…` | **5,775,210.165 USTB** |
| `0x569d7dcc…00c4f0ec` | (미식별) | 5,680,968.248 USTB |
| `0x5fbaa3a3…c0504f33` | `asset()=USTB` | 2,900,041.28 USTB |

**[VERIFIED]** Horizon aToken은 `totalSupply == USTB 보유량 == 5,775,210.165`로 **정확히 1:1**이며 차액 0.
즉 이 케이스에서는 "wrapper가 수익을 가로챈다"는 서사가 **성립하지 않는다.** (가설 기각)

### 2-3. BUIDL은 배당을 mint로 지급하며, 그 수취인 중에 컨트랙트가 있다

최근 9,000블록에서 BUIDL mint 33건. 보유량 대비 지급률을 계산한 결과:

| 보유자 | 유형 | 직전 잔액 | 지급 | 비율 |
|---|---|---:|---:|---:|
| `0x713742…a51a258` | EOA | 66,295,805.65 | 17,301.60 | **0.026098%** |
| `0xed71aa…49a5cf72` | EOA | 54,624,382.53 | 14,255.64 | **0.026098%** |
| **`0xe827ab…6e4e9c`** | **CONTRACT** | **15,763,920.08** | **4,116.60** | **0.026114%** |
| `0xc0d9ed…7290e43` | CONTRACT | 5,485,498.94 | 1,431.57 | 0.026097% |

**[VERIFIED] 균일 비율 0.0261%** — 명부상 보유자(holder of record)에게 pro-rata로 신주를 mint하는
전형적 분배다. 그리고 **그 명부상 보유자 중 하나가 ERC-4626 볼트**다:

```
0xe827abf9f462ac4f147753d86bc5f91e186e4e9c
   asset()      = BUIDL
   totalAssets  = 15,768,036.68 BUIDL   (= 자기 BUIDL 잔액과 일치)
   totalSupply  = 99,120,312.67 shares (18dp)
```

**[FACT]** 이 구조는 Securitize의 sToken 볼트(sBUIDL) 계열로, BUIDL 보유자가 예치하면 DeFi에서 쓸 수
있는 토큰을 받고 원 수익은 계속 받는 모델이다.

**따라서 문제의 실물 크기: 약 1,576만 BUIDL(≈$15.7M)이 wrapper 뒤에 있고, 발행사의 명부는 그
wrapper 주소 하나만 본다.** 실질 보유자는 볼트 지분 보유자들이며, 이들에게 분배가 도달하는지는
전적으로 그 wrapper의 코드에 달려 있다.

---

## 3. ⚠️ 라운드1에서 놓쳤던 prior-art — 이 후보를 실제로 위협함

**[FACT] Securitize `Vault Registrar`** (2026-03 개정판: *Explicit Authorizations, Standardization,
and Multichain Support*):

- 목적: **DeFi 프로토콜이 규제 RWA 토큰과 상호작용해도 컴플라이언스 보장이 깨지지 않게 하는 것**
- 방식: **identity-bound, investor-specific vault** — 프로토콜이 통제하되 **투자자의 컴플라이언스
  신원 아래에서 동작하는 "smart escrow" 볼트**
- 명시된 문제의식: "규제 증권은 **어느 투자자가 어느 포지션을 소유하는지** 추적해야 하며, corporate
  action·record date·분배·상환은 본질적으로 **투자자 단위**다"
- **sToken은 deprecated** — wrapper 구조가 "소유권·record date·권리·분배 등 규제 정보를 DeFi 네이티브
  토큰 표현과 **분리된 채로 남겨두는** 추가 추상화 계층을 요구했기 때문"
- 보고 측면: Securitize Fund Services × Upshift가 **투자자 단위 배분 투명성과 온체인 활동 전면 대사**를
  오프체인 서비스로 제공

**[INFERENCE] 평가:** 우리가 겨냥한 빈칸을, 이 시장의 지배적 발행 인프라가 **정확히 그 이름으로**
공략 중이다. 접근법은 "풀 내부 귀속을 푸는 것"이 아니라 **"애초에 풀링하지 않고 투자자별 볼트로
쪼개는 것" + 오프체인 펀드행정**이다. 사용자의 §1 규칙("한 사업자가 기능 추가로 없앨 수 있는 문제")에
비추면 **patchability가 낮다고 보기 어렵다.**

### 남을 수 있는 좁은 빈칸 (라운드2에서 판정 필요)

1. Vault Registrar에 **통합되지 않은 제3자 wrapper**(허가 없이 감싸는 경우) — 다만 "발행사가 허용
   안 하면 그만"이라는 반론이 강함
2. **투자자가 관리자를 신뢰하지 않고 스스로 자기 지분을 증명**하는 경로 — Registrar는 기록을 개선하지만
   투자자는 여전히 Securitize의 오프체인 행정을 신뢰해야 함
3. Registrar가 커버하지 않는 **다른 발행사 자산**(Superstate/Invesco·Ondo·Franklin·Centrifuge)

---

## 4. 판정

| 항목 | 결과 |
|---|---|
| 기술적으로 구현 가능한가 | **조건부 가능** — 청구 기반 + 보존식 + 이의제기. "정본 명부"는 불가 |
| 문제가 실재하는가 | **예** ($15.7M wrapper가 명부상 보유자로 배당 수취, 실측) |
| Attestcoin이 자연스러운가 | **부분적** — 대상이 *포지션*이라 proof 모델(*사건*)과 어긋남 |
| patchability 테스트 | **위험** — Securitize Vault Registrar가 정면 대응 중 |

**권고:** #1을 이 형태 그대로 주력으로 밀지 말 것. 두 갈래 중 선택 필요:
- **(a)** #2(발행사 통제 *행위* vs DeFi 담보)로 전환 — 대상이 사건이라 Attestcoin과 정합적
- **(b)** #1을 "투자자 자력 증명(self-custody of proof)" 각도로 좁혀 라운드2에서 살릴 수 있는지 판정

## 5. 재현 방법

```bash
node spike/scripts/03-chain-info.js          # 지원 체인 2개 확인
curl -s https://proof-gen-api.cc3-testnet.creditcoin.network/api/swagger/openapi.json | python3 -m json.tool
# 메인넷 실측 스크립트는 스크래치패드(probe4~7.js)에 있으며 public RPC(gateway.tenderly.co)만 사용
```
