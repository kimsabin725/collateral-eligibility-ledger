# 구조적 문제공간 1차 스윕 (ROUND 1)

> 근거 문서: `~/Downloads/BUIDL_CTC_TradFi_DeFi_Master_Handoff_2026-08-18.md` §19–§22, §27
> 작성: 2026-08-18 · 마감: 2026-09-06 13:59 KST (D-19)
> 태그: **[FACT]** 외부 출처 · **[VERIFIED]** 우리가 실행/실측 · **[INFERENCE]** 우리 추론 · **[UNVERIFIED]** 미확인

## 0. 이번 라운드에서 지켜야 했던 규칙

1. 코딩 금지, research first
2. patchable institutional-control 문제(authority/credential/approval/mandate)는 더 만들지 않는다
3. 원문 먼저, 결론은 나중에 / 빈칸을 추론으로 메우지 않는다
4. 아이디어를 살리지 말고 prior-art와 반례로 먼저 죽인다

## 1. 오늘 실측한 환경 제약 — 후보 선택을 실제로 구속함

**[VERIFIED] 2026-08-18, `spike/scripts/03-chain-info.js`를 CC3 테스트넷에 직접 실행:**

| chainKey | 이름 | EVM chainId | 최신 attested block |
|---|---|---|---|
| 3 | Ethereum | 1 | 25,781,430 |
| 1 | Sepolia ethereum | 11155111 | 11,514,550 |

**지원 source chain은 2개뿐이다.** 그리고 그중 우리가 트랜잭션을 *일으킬* 수 있는 곳은 Sepolia뿐이다(메인넷 발신은 실제 ETH 비용).

**따라서 [INFERENCE]:** "Base/Solana/Avalanche에 흩어진 포지션을 합산한다" 류의 아이디어는 **이번 해커톤에서 시연 자체가 불가능**하다. 실현 가능한 유일한 cross-chain 서사는:

```
Ethereum mainnet (chainKey 3)  = 진짜 발행사/펀드/프로토콜의 실제 사실 (읽기 전용)
        +
Sepolia (chainKey 1)           = 우리가 만든 mock 기관 시나리오 (쓰기 가능)
        ↓  두 사실을 Attestcoin proof로 검증
Creditcoin CC3                 = 두 사실의 관계를 판정·기록하는 곳
```

이 제약은 **어제 만든 proof-composition 엔진(사실A + 사실B + 시간순서 + 동일주체)을 그대로 재사용**하는 방향과 정확히 일치한다.

**[FACT]** 제출 요건: 이번 시즌 모든 제출작은 Attestcoin Protocol을 반드시 사용해야 하며, 심사에서 "Attestcoin을 얼마나 의미 있게 통합했는가"를 본다. 트랙은 DeFi/RWA/DePIN/Gaming, 총상금 $15,000(대상 $10,000).

---

## 2. 8개 영역 kill table (1차)

### A. Legal ownership vs on-chain control → **KEEP (단, 단독이 아니라 #1의 토대)**

- **문제:** 토큰을 쥔 주소가 법적 소유자인지, 수익적 소유자인지, 수탁자인지, 담보권자인지 온체인에서 구분되지 않는다.
- **TradFi requirement:** [FACT] SEC 3개 부서 합동 성명(2026-01-28)은 **형식이 법적 성격을 바꾸지 않는다**고 명시. 발행사는 온체인이든 오프체인이든 **master securityholder file**을 정확히 유지할 transfer agent 의무를 그대로 진다. 성명은 issuer-sponsored / custodial(security entitlement) / synthetic(linked security·security-based swap)로 유형을 나누며, 유형마다 보유자가 갖는 권리가 **다르다**고 못박는다.
- **DeFi cause:** ERC-20 잔액은 이 구분을 표현하지 못한다.
- **Existing solution:** Securitize·Tokeny·Tokensoft의 on-chain cap table (직접 보유자에 한함).
- **Patchability:** 발행사 단독 패치 불가(상대방이 제3자 프로토콜).
- **Verdict:** 단독 제품은 추상적. **#1 후보의 법적 근거로 흡수.**

### B. Transfer restriction vs composability → **DOWNRANK**

- **문제:** 발행사 레벨 이전제한이 wrapper/bridge/담보를 거치며 어디까지 유지되는가.
- **Existing solution:** [FACT] Chainlink **ACE + CCT Compliance Extension**이 pre-transaction 정책 검사와 **cross-chain 이동 시 compliance metadata 동반**을 이미 제품으로 제공. [FACT] ERC-3643은 2024–2026 사이 "institutional default"로 자리잡음.
- **Patchability:** 높음 — 토큰 표준/컴플라이언스 레이어의 기능 추가로 상당 부분 소멸.
- **Verdict:** **DOWNRANK.** 단, "제한이 깨지는가"가 아니라 "**제한이 지켜졌는지 제3자가 검증할 수 있는가**"로 각도를 틀면 #1과 합류 가능.

### C. Legal finality vs blockchain finality → **DOWNRANK**

- **[FACT]** CSDR·Settlement Finality Directive가 DLT 결제와 충돌한다는 점은 EU가 공식 인정, **SFD 개정·신규 Settlement Finality Regulation 제안이 진행 중**(2026). ECB 담보 프레임워크(2026-03-30)는 토큰화 증권에 DvP를 요구.
- **Fatal counterargument:** 이 문제는 **입법으로 해결되는 중**이고, 해결 주체가 우리 컨트랙트가 아니다. 법적 finality는 오프체인 사실이라 Attestcoin으로 증명할 대상이 없다.
- **Verdict:** **DOWNRANK.**

### D. 24/7 DeFi vs stale NAV / redemption window → **KILL (주력에서 제외)**

- **[FACT]** 문제 자체는 실재: 일 1회 NAV 스냅샷은 24시간의 미반영 구간을 남기고, T+0 상환과 T+1 국채 결제가 어긋난다.
- **Existing solution:** [FACT] DIA·RedStone 등 NAV/redemption-rate 오라클, BUIDL–Circle USDC 즉시 전환, [FACT] RedStone **Settle**(2026-04)은 RWA 담보 청산 결제를 직접 겨냥.
- **Patchability:** 높음(오라클 갱신주기 + 리스크 파라미터).
- **Verdict:** **KILL as primary.** 어제 죽인 NAV Circuit Breaker와 동일 운명.

### E. Corporate actions / rights propagation through wrappers → **KEEP — 최우선 후보**

- **문제:** 증권형 토큰이 AMM 풀·렌딩 담보·볼트에 들어가는 순간, **토큰 컨트랙트가 기록하는 보유자는 그 풀 주소**다. 배당·의결권·세금원천징수·수익적 소유 보고가 모두 record date의 "보유자"를 기준으로 작동하는데, 그 보유자가 사람이 아니라 컨트랙트다.
- **[FACT] 발행 인프라 본인의 진술 (Securitize, #HyFi 시리즈 — 검색 스니펫 기준. 원문은 medium/securitize.io 모두 봇 차단으로 직접 열람 실패, 사용자 확인 권장):**
  - "Uniswap, Aave, Balancer 같은 공개 풀은 여러 투자자의 토큰을 컨트랙트 안에 공유 풀로 예치하며, 이때 **Digital Security 컨트롤은 풀 주소를 단일 신원과 매칭할 수 없어 그 잔액에 대한 소유권 귀속이 간단하지 않다.**"
  - "배당을 지급하거나 의결 같은 거버넌스 이벤트를 수행할 때, **그 토큰을 들고 있는 스마트컨트랙트가 그 권리를 받아야 하는지 의문이 제기된다.**"
  - 이들이 제시하는 해법: "**풀이 내보내는 이벤트를 오프체인으로 추적**해, 토큰 컨트랙트에는 풀의 총잔액만 기록되더라도 발행사의 기록(Master Securityholder File, Transaction Log, snapshot infra)이 내부 소유구조를 정확히 유지하게 한다."
- **여기가 핵심 빈칸 [INFERENCE]:** 업계 표준 해법이 **발행사가 운영하는 신뢰 기반 오프체인 인덱서 + 풀마다의 개별 연동**이다. 즉 (a) 투자자는 발행사의 장부를 믿어야 하고, (b) 연동되지 않은 풀에 들어간 투자자는 조용히 누락되며, (c) 프로토콜이 다른 체인에 있으면 연동 비용이 더 커진다.
- **Existing solution 점검:**
  - [FACT] ERC-8056(Robinhood×Superstate)은 **주식분할용 UI multiplier**일 뿐 — 풀 내부 귀속을 풀지 못한다.
  - [FACT] Ondo×Broadridge 프록시 의결(2026-04, 250+ 종목)은 **자기 wrapper 보유자**의 의사표시를 모으는 것이고, Ondo 토큰은 원주식 주주권을 직접 주지 않는다. DeFi 풀 내부 보유자는 대상이 아니다.
  - [FACT] Aave **Horizon**은 담보를 예치하면 **양도 불가능한 aToken**을 발행한다 → 경제적 보유자와 등록부상 보유자가 구조적으로 분리된다.
  - [FACT] Tokensoft류 on-chain cap table도 "거래소 pooled wallet 내부 분포는 온체인에서 보이지 않으며, 정확한 cap table을 유지하려면 **거래소가 발행사에 데이터를 제공해야 한다**"고 같은 한계를 인정.
- **Patchability:** **낮음.** 발행사는 자기 컨트랙트에 hook을 넣을 수 있지만 **Aave/Uniswap/Morpho/타 체인 wrapper를 패치할 권한이 없다.** 반대로 프로토콜은 transfer agent 의무를 대신 질 수 없다. 서로 다른 법적 주체 3자(발행사–프로토콜–투자자)의 경계에 남는다.
- **Attestcoin fit:** **load-bearing.** "발행사의 record-date/분배 선언(체인 A의 사실)" + "풀 내부 예치·인출 이벤트(체인 B의 사실)"를 **인덱서를 신뢰하지 않고** 합성해야 귀속이 성립한다. 어제 만든 authority→action 합성기가 그대로 declaration→position 합성기로 일반화된다.
- **Testnet demo:** 명확. mock 발행사·mock 풀을 Sepolia에, 실제 대조군은 mainnet에서 읽고, CC3에서 "이 record date에 이 풀 안의 실질 보유자는 누구이고 각자 얼마인가"를 proof로 판정. **실패 시연**도 강력: 연동 안 된 풀 → 배당이 컨트랙트 주소로 들어가 투자자가 누락되는 장면.
- **Fatal counterargument (반드시 라운드2에서 검증):** "발행사가 애초에 자기 토큰을 공개 풀에 못 들어가게 막으면 끝 아닌가?" → [FACT] 시장은 반대로 가는 중이다(Horizon의 permissioned 담보 + permissionless 유동성, Securitize×Euler, Centrifuge/Superstate 담보). 하지만 **"허용된 풀만 화이트리스트"면 발행사가 그 풀과 연동도 하므로 문제가 사라진다**는 반론이 성립할 수 있다. 이 반론이 얼마나 강한지가 이 후보의 생사다.
- **Verdict:** **KEEP — Top 1 후보.**

### F. Insolvency / collateral priority vs 자동청산 → **DOWNRANK (단, #2와 부분 결합)**

- **[FACT]** UCC Article 12(controllable electronic records): **control에 의한 완전화가 filing-only보다 우선**하며 2027-06-03 기준 우선순위 규정이 적용된다. [FACT] 파산 자동중지(automatic stay) 하에서 **DeFi 스마트컨트랙트가 채무자 자산을 자동 이전하면 stay 위반으로 판단될 수 있다**는 법률 분석이 존재하나, 대부분 2022년 자료이고 토큰화 담보에 대한 적용은 미확립.
- **Attestcoin fit:** 약함 — 트리거(법원 명령·도산 선고)가 **어느 체인에도 없는 오프체인 사실**이다.
- **Verdict:** **DOWNRANK.** 단 "발행사/등록기관이 온체인에서 낸 통제 행위"로 좁히면 #2로 살아난다.

### G. Best execution / fiduciary duty vs AMM·MEV → **DOWNRANK**

- **[FACT]** SEC 2026 검사 우선순위에 best execution 준수가 명시되어 실무 압력은 진짜다.
- **Existing solution:** [FACT] Flashbots Protect·MEV-Blocker·CoW Swap·1inch Fusion 등 실행 보호가 이미 성숙.
- **Attestcoin fit:** 약함 — 벤치마크 가격 등 판단 근거가 대부분 오프체인이고, 실행은 단일 체인에서 끝난다.
- **Verdict:** **DOWNRANK.**

### H. Composable DeFi positions vs TradFi accounting → **MERGE into #1**

- **[FACT]** "지갑이 받은 토큰은 그 주체가 경제적으로 보유한 자산이 아닌 경우가 대부분이며, look-through 없이 wrapper를 시가로 계상하면 재무제표가 오도된다." [FACT] 온체인 재무보고에는 아직 GAAP 등가물이 없다(2026 Q1 기준 240개 기업 트레저리가 제각각 공시).
- **Fatal counterargument:** 회계는 "누가 돈을 내는가"가 불분명하고, 규제 강제력이 약하다.
- **Verdict:** **MERGE** — #1의 두 번째 수요처(회계·보고)로만 인용.

---

## 3. Top 3 (1차 점수)

배점: 구조성 25 · 금융 중요도 20 · prior-art 공백 20 · Attestcoin load-bearing 15 · PoC 명확성 10 · 포트폴리오 설명력 10

### 🥇 #1 — Look-Through Entitlement Register (89/100)

> **한 줄:** 증권형 토큰이 풀·볼트·담보 컨트랙트 안으로 들어가는 순간 발행사의 법적 등록부는 "누가 실질 보유자인지" 볼 수 없게 되는데, 지금의 해법은 발행사가 돌리는 **신뢰 기반 오프체인 인덱서**다. 이것을 **proof로 검증 가능한 온체인 귀속 판정**으로 바꾼다.

| 항목 | 점수 | 근거 |
|---|---|---|
| 구조성 | 23/25 | 발행사(규제 대상 TA) · 프로토콜(무허가 코드) · 투자자 — 서로 다른 법적 주체. 어느 한쪽 패치로 안 사라짐 |
| 금융 중요도 | 18/20 | 배당·의결권·원천징수·수익적 소유 보고가 전부 record date 보유자에 걸림 |
| prior-art 공백 | 15/20 | 부분 해법 다수(HyFi 오프체인 추적, Broadridge 프록시, ERC-8056). **검증 가능한 귀속**은 미발견 — 라운드2에서 더 죽여야 함 |
| Attestcoin | 14/15 | 두 체인의 두 사실을 인덱서 없이 합성해야 성립 |
| PoC | 9/10 | mock 발행사(Sepolia) + 실제 mainnet 대조 + CC3 판정. 실패 시연이 강력 |
| 포트폴리오 | 10/10 | 전략/상품/내부통제 언어로 그대로 설명됨 |

### 🥈 #2 — Issuer Control Action vs DeFi 담보 (81/100)

> **한 줄:** 발행사는 법적 의무로 freeze·forced transfer·clawback을 실행할 수 있는데, 그 토큰이 다른 곳에서 담보로 잡혀 있으면 **대주는 담보가 발밑에서 사라지는 것을 사후에야 안다.**

구조성 20 · 중요도 17 · 공백 14 · Attestcoin 13 · PoC 9 · 설명력 8.
[FACT] freeze/forced transfer/clawback은 규제 증권 토큰의 표준 기능이고, [FACT] RedStone Settle은 청산 *결제*를 다루지 유통 *통제권 충돌*을 다루지 않는다.
**약점:** permissioned 시장에서는 발행사–프로토콜이 오프체인으로 조율할 유인이 크다.

### 🥉 #3 — Multi-Chain Register Reconciliation (78/100)

> **한 줄:** 같은 펀드가 [FACT] BENJI 8개 체인·BUIDL 7개 체인에 동시에 존재하는데, 법적으로 정확해야 하는 등록부는 **하나**다.

구조성 19 · 중요도 16 · 공백 12 · Attestcoin 15(최고) · PoC 8 · 설명력 8.
**약점:** 발행사가 mint/burn 권한을 독점하므로 "발행사 시스템 하나로 정리된다"는 patchability 반론이 강하다. **[VERIFIED] 지원 체인이 2개뿐**이라 8체인 서사를 시연으로 보여줄 수 없다.

**#1과 #3은 동일 제품으로 합칠 수 있다** — "풀 안을 못 본다 + 체인 밖을 못 본다 = 등록부가 진실을 담지 못한다".

---

## 4. 아직 검증되지 않은 것 (ROUND 2에서 반드시)

1. **[UNVERIFIED] Securitize HyFi 원문 3편** — medium.com(Cloudflare 403)·securitize.io(JS 앱) 모두 봇 차단. 검색 스니펫만 확보. **사용자가 브라우저로 직접 열어 인용문 확정 필요.**
2. **[UNVERIFIED] #1의 치명적 반론**: 발행사가 화이트리스트한 풀만 허용 → 연동도 함께 → 문제 소멸? 실제 Horizon/Euler/Centrifuge 연동 계약서 수준의 문서 확인 필요.
3. **[UNVERIFIED] 실제 사고 사례**: "DeFi 풀에 있었다는 이유로 배당·의결권을 놓친" 구체적 사건이 공개 기록에 있는가. 있으면 #1의 설득력이 급상승.
4. **[UNVERIFIED] SEC Project Blueprint(2025-11-27, tokenized collateral)** PDF 본문 — 추출 실패(로컬에 PDF 도구 없음).
5. **[UNVERIFIED] Newton Protocol** 범위 — authorization layer로 확인됨(EigenLayer AVS, Rego/OPA, TEE/ZKP). #1과 직접 충돌하지는 않아 보이나 재확인 필요.
6. **[UNVERIFIED]** Attestcoin이 **event 부재/스냅샷 잔액**을 다룰 수 있는 범위 — #1은 "record date 시점의 풀 내부 지분"을 다루므로 잔액 재구성 방식(예치·인출 이벤트 누적)이 실제로 성립하는지 spike로 확인해야 한다. **이것이 #1의 기술적 생사다.**

## 5. 출처

- SEC, *Statement on Tokenized Securities* (Corp Fin·IM·TM 합동, 2026-01-28) — 원문 직접 확보
- Securitize, *#HyFi for Security Tokens* 시리즈 (pooled assets / smart contracts as token holders) — 스니펫만
- Chainlink, ACE 및 CCT Compliance Extension 문서
- Aave, *Horizon Launch* / Aave Labs (2025-08)
- RedStone, *Settle* (2026-04-28)
- CoinDesk, *Ondo adds proxy voting* (2026-04-28)
- EIPs, ERC-8056 (Scaled UI Amount Extension)
- Crowell & Moring / Porzio, UCC Article 12 control·perfection·priority
- Central Bank of Ireland DP12, AFME, ECB Macroprudential Bulletin (2026-04) — DLT/finality
- DoraHacks, *BUIDL CTC 2026 Fall* 요강
- **[VERIFIED]** `spike/scripts/03-chain-info.js` 실행 결과 (2026-08-18)
