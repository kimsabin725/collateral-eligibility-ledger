# CODEX 작업지시서 — 2026-08-18

> **이 파일이 현 시점의 진입점이다.** `docs/CODEX_HANDOFF.md`(2026-08-17)는 *구현 단계* 문서이며,
> 그 구현의 전제였던 아이디어가 오늘 폐기 검토에 들어갔으므로 **먼저 이 문서를 읽어라.**
>
> 마감: **2026-09-06 13:59 KST** (D-19)

## 0. 30초 요약

- 어제 만든 **VaultAuthorityLedger**는 코드로는 완성(15/15 + 8/8 통과)이지만, **아이디어가 약하다**고
  판단됐다. 이유: MetaMorpho V1의 role ambiguity는 **Morpho V2가 역할분리로 상당 부분 해소** →
  "한 프로토콜이 패치하면 사라지는 문제"에 해당.
- 오늘은 **코딩이 아니라 문제 재탐색**을 했다. 8개 구조적 영역을 훑고 → 후보 2개로 좁혔다.
- **아직 아무것도 확정되지 않았다.** 사용자의 결정을 기다리는 상태다.
- CC3 배포는 여전히 **faucet(디스코드 수동)** 에서 막혀 있다. 배포 잔액 0 CTC 확인됨(오늘 재확인).

## 1. 반드시 먼저 읽을 파일 (순서대로)

| # | 파일 | 내용 |
|---|---|---|
| 1 | `ideation/SHORTLIST_TWO_IDEAS.md` | **후보 2개 비교·점수·권고. 여기가 핵심** |
| 2 | `ideation/FEASIBILITY_LOOKTHROUGH.md` | 후보 A 기술검증 결과(=Attestcoin의 한계 발견) |
| 3 | `ideation/STRUCTURAL_SEARCH_ROUND1.md` | 8개 영역 kill table |
| 4 | `docs/SESSION_2026-08-18_TRANSCRIPT.md` | 오늘 세션 전문(도구 호출 포함). 근거가 의심되면 여기서 원인 추적 |
| 5 | `~/Downloads/BUIDL_CTC_TradFi_DeFi_Master_Handoff_2026-08-18.md` | 사용자가 정한 판단 기준 원본 |

## 2. 오늘 확정된 사실 (직접 실행·측정한 것만)

1. **Attestcoin의 증명 단위는 트랜잭션 1건뿐이다.** Proof Builder OpenAPI 전체 엔드포인트와
   `@gluwa/usc-sdk@0.18.0` 인터페이스 확인 결과 **account/storage 증명 경로가 없다.**
   → **"사건이 일어났다"는 증명 가능, "잔액이 얼마다"는 증명 불가.** 설계의 최상위 제약.
2. **지원 source chain은 2개뿐**: Ethereum mainnet(chainKey 3), Sepolia(chainKey 1).
   다중체인 합산 서사는 시연 불가.
3. **메인넷 실측**: BUIDL은 명부상 보유자에게 pro-rata mint로 수익 지급(전원 **0.026098%** 일치).
   그 수취인 중 하나가 **ERC-4626 볼트(BUIDL 15,768,036개 보유, 배당 4,116.6 수취)**.
   Aave Horizon RWA USTB aToken은 **USTB 5,775,210개** 보유.
4. **기각된 가설**: 그 Horizon aToken은 `USTB 보유량 == aToken totalSupply`로 **정확히 1:1, 차액 0**.
   "wrapper가 수익을 가로챈다"는 서사는 이 케이스에서 거짓. USTB의 mint는 배당이 아니라 신규 구독.

## 3. 지금 대기 중인 결정 (사용자 몫 — 임의로 고르지 말 것)

| 분기 | 내용 |
|---|---|
| **(a)** | 후보 B(발행사 통제 행위 vs DeFi 담보)를 주력으로 → **§4의 작업 실행** ← 권장 |
| (b) | 후보 A를 "투자자 자력 증명" 각도로 좁혀 라운드2 prior-art 사냥 |
| (c) | 둘 다 보류하고 문제탐색 라운드2로 복귀 |

## 4. (a)를 선택했을 때의 작업 명세 — 지금 당장 실행 가능

**목표: "발행사의 통제 행위가 메인넷에 실물로 존재하는가"를 증명하거나 반증한다.**
이것이 후보 B의 생사다. 없으면 mock 전용 데모가 되어 설득력을 잃는다.

### 4-1. 해야 할 일

1. 다음 규제 토큰들의 **통제 관련 이벤트 시그니처**를 컨트랙트 ABI/소스에서 특정하라:
   - BUIDL `0x7712c34205737192402172409a8F7ccef8aA2AEc` (Securitize DS Protocol)
   - USTB `0x43415eB6ff9DB7E26A15b704e7A3eDCe97d31C4e` (온체인 `name()`이 **Invesco** 명의로 나온다 — 확인 필요)
   - ERC-3643/T-REX 계열 아무거나 1종
   대상 이벤트: **freeze / unfreeze / forced transfer / clawback / seize / recovery / pause / allowlist 제거**
2. 메인넷에서 **실제 발생 사례**를 찾아라. 각 사례마다 `txHash`, `blockNumber`, 대상 주소, 금액을 기록.
3. 그 사례 중 **대상 주소가 컨트랙트(볼트/렌딩/풀)** 인 것이 있는지 확인하라. 있으면 후보 B는 강해진다.
4. 결과를 `ideation/EVIDENCE_ISSUER_CONTROL.md`에 기록하라. **없으면 "없음"이라고 명확히 써라.**

### 4-2. 실행 환경 메모 (오늘 실측)

- public RPC 다수가 `eth_getLogs`를 막는다. **동작 확인된 엔드포인트: `https://gateway.tenderly.co/public/mainnet`**
  (publicnode=archive 차단, llamarpc/ankr/cloudflare=불가, drpc=10k블록 제한)
- 조회 코드 예시는 `docs/SESSION_2026-08-18_TRANSCRIPT.md`의 probe4~7 스크립트 참고.
- `spike/node_modules`에 ethers가 있다. 스크립트를 레포 밖에서 돌리려면 `NODE_PATH=…/spike/node_modules`.

### 4-3. 하지 말 것

- **컨트랙트를 새로 쓰지 마라.** 아직 아이디어가 확정되지 않았다.
- 어제 코드(`contracts/`)를 수정하지 마라. 재사용 여부는 아이디어 확정 후 결정한다.
- 근거 없는 칸을 추론으로 메우지 마라. 못 찾았으면 **못 찾았다고 써라.**

## 5. 절대 어기면 안 되는 규칙 (사용자가 정한 것)

1. **한 프로토콜/사업자가 기능 하나 추가해서 없앨 수 있는 문제는 만들지 않는다.**
   (authority/credential/approval/mandate 계열은 이미 전부 탈락)
2. 원문 먼저, 결론은 나중에. 확인되지 않은 빈칸을 추론으로 메우지 않는다.
3. 아이디어를 살리려 하지 말고 prior-art와 반례로 **먼저 죽여라.**
4. "완전한 이력"을 주장하지 않는다 — **부재는 증명 불가**(Attestcoin의 원리적 한계).
5. 어떤 실명 회사도 잘못했다고 주장하지 않는다. 온체인 진술은 공개 데이터의 중립적 보고다.

## 6. 환경/비밀

- `contracts/.env`에 배포용 개인키가 있다. **절대 출력·커밋하지 마라.** `.gitignore`로 제외돼 있음(확인함).
- 레포는 **커밋이 하나도 없다** (전 파일 untracked). 커밋은 사용자 지시가 있을 때만.
- CC3 배포 주소 `0xDd9ddFcEb1dc1dC0aE393DD458Fe376aaB60294a` 잔액 **0 CTC** — faucet은 디스코드 수동 절차.
