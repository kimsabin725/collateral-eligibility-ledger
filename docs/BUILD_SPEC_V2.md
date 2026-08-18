# BUILD SPEC v2 — Collateral Eligibility Ledger (FROZEN 2026-08-18)

> 이 문서가 구현의 계약이다. 여기서 벗어나면 스펙을 먼저 고친다.
> 판정 근거: `ideation/FINAL_VERDICT.md` (GO)

## 1. 한 문장

**발행 측에서 담보 적격성을 훼손하는 사건이 Ethereum에서 발생했음을 Attestcoin proof로 검증하고,
Creditcoin 위의 신용 베뉴가 그 사실을 스스로 확인해 신규 여신을 차단하는 원장.**

## 2. 왜 Creditcoin이 신용 베뉴인가 (설계 제약)

Attestcoin은 **inbound 전용**이다 — Creditcoin은 다른 체인에 명령을 보낼 수 없다.
따라서 신용 베뉴가 CC3 위에 있어야 하며, 이는 현실 구조의 축소판이다.

```
Ethereum (자산 통제)                    Creditcoin CC3 (신용 공여)
  자산 레벨 적격성 사건  ──proof──▶  EligibilityLedger ──▶ GatedCreditLine
  예: sNUSD Paused                     (검증·기록)          (신규 여신 게이팅)
```

현실 대응: Robinhood Chain에서 USDe 담보 **$285M**(통제는 Ethereum), Base에서 Centrifuge JAAA
담보 마켓(hub는 Ethereum). 그 자리에 CC3가 들어간다.

## 3. 범위 (IN)

| # | 항목 |
|---|---|
| 1 | `EligibilityLedger` — 5중 검사로 소스 사건을 admit하고 자산별 적격성 상태를 기록 |
| 2 | `GatedCreditLine` — 원장을 읽어 **신규 여신·담보 추가**를 차단하는 최소 신용 베뉴 |
| 3 | 실제 mainnet 사건(sNUSD `Paused`, block 25,745,732)으로 하는 real-data 테스트 |
| 4 | 네거티브 테스트: 위조 proof, 리플레이, 미등록 emitter, 잘못된 시그니처, 실패한 소스 tx |
| 5 | CC3 실배포 + 실제 proof 1건 ingest (faucet 해결 시) |

## 4. 범위 밖 (OUT — 주장하지 않는다)

- **실시간 차단** — attestation 지연 8~9분. 신규 여신 게이팅이지 트랜잭션 차단이 아니다
- **기존 마켓 제어** — Morpho Blue는 불변이라 아무도 못 멈춘다. 우리 게이팅은 **우리 베뉴**에만 적용
- **자산이 건강하다는 증명** — 부재는 증명 불가. "반증되지 않았다"만 말한다
- **가격/청산 엔진** — 적격성 축만 다룬다. 가격은 범위 밖
- 프론트엔드, 실제 자금, 외부 체인으로의 쓰기

## 5. 핵심 상태 기계 (자산 단위)

```
NO_PROOF          아직 아무 사건도 증명되지 않음 (≠ 건강함)
   │ impairment proof
   ▼
IMPAIRED          적격성 훼손 사건이 증명됨 → 신규 여신 차단
   │ restoration proof (엄격히 더 나중 블록)
   ▼
RESTORED          복구 사건이 증명됨 → 차단 해제
```

**규칙**
- `impairedSince`는 **가장 이른** 증명된 훼손 블록을 유지한다(나중 proof가 시점을 미루지 못함)
- 복구는 훼손보다 **엄격히 더 나중 블록**일 때만 인정
- 상태 전이는 오직 proof로만 발생. 관리자 수동 전환 없음

## 6. 5중 검사 (순서 고정, 어제 엔진 재사용)

1. **리플레이 방지** — `keccak(chainKey, blockHeight, txIndex)`, txIndex는 precompile이 재계산
2. **포함·연속성 증명** — BlockProver precompile
3. **소스 tx 성공** — `receiptStatus == 1` (precompile은 확인하지 않음)
4. **emitter 허용목록** — 등록된 자산 컨트랙트가 emit한 로그만 인정
5. **이벤트 시그니처** — 등록된 훼손/복구 시그니처와 일치

미일치 로그는 **skip**(revert 아님) — 실제 tx는 배치로 여러 로그를 담는다.
매칭 로그가 하나도 없으면 `NoMatchingEvent`로 revert하고 아무것도 쓰지 않는다.

## 7. 등록 대상 (owner)

| 등록 | 예 |
|---|---|
| 자산 컨트랙트 + chainKey | sNUSD `0x08efcc2f…` (chainKey 3 = Ethereum mainnet) |
| 훼손 시그니처 | `Paused(address)`, `Paused()` |
| 복구 시그니처 | `Unpaused(address)`, `Unpaused()` |

## 8. 검수 기준 (Acceptance)

| # | 기준 |
|---|---|
| A1 | 유닛 테스트 전항목 통과 (mock 검증기·디코더) |
| A2 | **실제 mainnet sNUSD `Paused` proof**를 **실제 EvmV1Decoder**로 통과시켜 IMPAIRED 전이 |
| A3 | 훼손 증명 후 `GatedCreditLine.borrow()`가 revert, 증명 전 개설 포지션은 그대로 조회됨 |
| A4 | 위조 proof / 리플레이 / 미등록 emitter / 잘못된 시그니처 / 실패 tx 전부 revert |
| A5 | 복구 proof가 훼손보다 이른 블록이면 무시됨 |
| A6 | (faucet 해결 시) CC3 배포 + 실제 proof 1건 온체인 ingest |

## 9. 데모 시나리오 (1~2분)

1. CC3의 신용 라인에서 sNUSD 담보로 차입 — **성공**
2. 실제 메인넷 tx 해시 `0xc25678…` 입력 → proof 생성 → `submitImpairment`
3. 원장이 IMPAIRED로 전이, 소스 블록 25,745,732 기록
4. 동일한 차입 재시도 → **revert (AssetImpaired)**
5. 위조 proof 제출 → **revert (ProofRejected)**

## 10. 절대 하지 말 것

- "아무도 해결 안 했다" 류의 주장 (Aave Risk Steward·Hypernative·Chaos Labs Edge를 먼저 인정)
- 개별 지갑 블랙리스트를 근거로 인용 (60일 전수조사 결과 담보 풀 0건)
- 완전한 이력이나 자산 건강성 주장
