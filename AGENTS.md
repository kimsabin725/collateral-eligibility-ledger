# AGENTS.md — 이 레포에서 작업하는 모든 에이전트가 먼저 읽는 파일

프로젝트: **BUIDL CTC 2026 Fall 출품작** · 마감 **2026-09-06 13:59 KST**

## 0. 지금 상태를 알고 싶으면 여기부터

| 순서 | 파일 | 내용 |
|---|---|---|
| 1 | **`docs/CURRENT_STATE.md`** | **지금 무엇이 정해졌고 무엇이 대기 중인지. 항상 최신** |
| 2 | `README.md` (루트) | 제출용 개요 — 실주소·재현절차·한계·prior art |
| 3 | `docs/SUBMISSION.md` | 제출 패키지 — 제출폼 텍스트, 데모 영상 대본, 사람이 해야 할 일 |
| 4 | `private/docs/SESSION_LATEST.md (비공개)` (비공개, 저장소 밖) | Claude Code 세션 전문(도구 호출·실행 결과 포함). 근거 추적용 |
| 5 | `docs/CODEX_HANDOFF_2026-08-18.md` | 작업 지시서(무엇을 하지 말아야 하는지 포함) |

**아이디어 선정은 끝났다.** `ideation/`은 이제 결정 기록(왜 이걸 골랐고 무엇을 죽였는지)이지
살아있는 후보 목록이 아니다. `ideation/SHORTLIST_TWO_IDEAS.md`를 현재 상태로 읽지 말 것.

## 1. 이 레포에서 두 에이전트가 협업하는 방식

Claude Code와 Codex는 **대화를 공유하지 못한다**(각자 자기 세션 로그에만 기록).
따라서 **이 레포의 파일이 유일한 공용 메모리**다.

```
Claude Code  →  private/docs/SESSION_LATEST.md (비공개) 로 자기 작업 내역을 내보냄
             →  결론은 ideation/*.md, 상태는 docs/CURRENT_STATE.md 에 기록
Codex        →  위 파일들을 읽고 이어서 작업, 결과를 다시 ideation/*.md 에 기록
```

**세션 로그 갱신 명령** (Claude 쪽 작업 후 실행):

```bash
python3 private/tools/export-claude-session.py (비공개)       # → private/docs/SESSION_LATEST.md (비공개) 재생성
```

이 스크립트는 `contracts/.env`의 개인키가 산출물에 섞이면 **쓰기를 거부**한다(키는 출력하지 않음).

## 2. 작업 규칙 (사용자가 정한 것 — 어기지 말 것)

1. **한 프로토콜/사업자가 기능 하나 추가해서 없앨 수 있는 문제는 만들지 않는다.**
   authority / credential / approval / mandate 계열은 이미 전부 탈락했다.
2. **원문 먼저, 결론은 나중에.** 확인되지 않은 빈칸을 추론으로 메우지 않는다.
   못 찾았으면 "못 찾았다"고 쓴다.
3. 아이디어를 살리려 하지 말고 **prior-art와 반례로 먼저 죽인다.**
4. **"완전한 이력"을 주장하지 않는다** — Attestcoin은 부재를 증명하지 못한다.
5. 실명 회사가 잘못했다고 주장하지 않는다. 온체인 진술은 공개 데이터의 중립적 보고다.
6. 근거에는 태그를 단다: `[VERIFIED]` 직접 실행·측정 / `[FACT]` 외부 출처 /
   `[INFERENCE]` 추론 / `[UNVERIFIED]` 미확인.

## 3. 기술 제약 (실측 확인됨 — 재litigate 금지)

- **Attestcoin의 증명 단위는 트랜잭션 1건뿐.** account/storage 증명 경로 없음.
  → *사건이 일어났다*는 증명 가능, *잔액이 얼마다*는 증명 불가.
- **source chain은 2개뿐**: Ethereum mainnet(chainKey 3) · Sepolia(chainKey 1).
- **attestation 지연 8~9분** → 실시간 차단형 제품 불가, 사후검증형만 가능.
- 메인넷 `eth_getLogs`는 대부분의 public RPC가 막는다.
  **동작 확인: `https://gateway.tenderly.co/public/mainnet`**
- `spike/node_modules`에 ethers 존재. 레포 밖 스크립트는 `NODE_PATH=<repo>/spike/node_modules`.

## 4. 금지 사항

- `contracts/.env`를 **출력·커밋하지 말 것** (개인키 포함, `.gitignore` 처리됨).
- 아이디어가 확정되기 전에는 **새 컨트랙트를 쓰지 말 것.**
- `contracts/` 기존 코드를 수정하지 말 것 — 재사용 여부는 아이디어 확정 후 결정한다.
- 커밋·푸시는 **사용자가 명시적으로 지시할 때만.** 원격은 `kimsabin725/collateral-eligibility-ledger`(공개).

## 공개 저장소 규칙

이 저장소는 **공개**다. 커밋 전에 다음을 지킨다.
- 작업 노트·세션 덤프·제출 입력값·개인 연락처·소속·목적 서술은 `private/`에 둔다. `private/`는 전역 gitignore로 추적되지 않는다
- 저장소에 남는 문서는 프로젝트가 **무엇을 어떻게 만들었는지**만 말한다. 왜 만들었는지(진로·회사)는 쓰지 않는다
- push 시 전역 pre-push 훅(`~/.config/git/hooks/pre-push`)이 `~/.config/git/leak-blocklist.txt`로 검사한다. 걸리면 올리지 말고 고친다
