# 퀵 요청 미리보기 구조화 카드 · 채팅 말풍선 하단 정렬 기획서

> Date: 2026-10-27
> Status: Completed
> Author: planner
> **퀵 2차(94~101) 중 3번째.** 선행: [95](./95_dongbang-visibility-audit-plan.md) 완료 후(코드 의존 없음 · 순서 규칙). **FE only · BE·SQL 없음**
> **brief 항목:** 2(미리보기 Dialog) · 3(말풍선 아래 빈 공간)
> **Supersedes:** [87](./87_quick-request-goods-notes-address-picker-plan.md) AC-03·AC-04의 **미리보기 텍스트 줄 판정**(`크기: 기타`·`물품:` 줄) · [92](./92_quick-web-only-notifications-plan.md) D-9의 `formatQuickRequestPreviewText`(제거) · [86](./86_quick-request-kakao-redesign-plan.md) AC-13의 `quick-request-preview-message` `<pre>`
> **선행:** [86](./86_quick-request-kakao-redesign-plan.md), [87](./87_quick-request-goods-notes-address-picker-plan.md), [89](./89_quick-workflow-dongbang-openchat-plan.md), [92](./92_quick-web-only-notifications-plan.md), [93](./93_quick-request-chat-plan.md)

## 선행 plan 참조 (Phase 0)

| Plan | Status | 관계 |
|------|--------|------|
| **86 · 87** | Approved | 미리보기 Dialog(`quick-request-preview-dialog.tsx`)의 `<pre>` 텍스트 덩어리를 구조화 카드로 바꾼다. 폼 모델·요약 보드(`quick-request-summary-content`)·테마 규칙(THEMES 10종 × light/dark · 시맨틱 토큰)은 그대로. 요약 보드의 행 구성 함수를 **재사용**한다 |
| **92** | Completed | D-9 「미리보기 본문 전용」 `formatQuickRequestPreviewText`는 이 plan에서 **제거**(미리보기가 텍스트를 쓰지 않음). Dialog 설명 문구(AC-07)는 유지 |
| **89** | In Progress | U-8(「등록」 버튼 · pending Spinner · 성공 시 상세 이동)은 유지 |
| **93** | Completed | 메시지 목록(`quick-chat-message-list.tsx`)의 스크롤 컨테이너·자동 스크롤·「새 메시지 N ↓」·구분선은 유지하고 **정렬만** 바꾼다 |

### 정찰로 확인한 사실

| 항목 | 사실 | 근거 |
|------|------|------|
| 미리보기 | `<pre data-testid="quick-request-preview-message">`에 `formatQuickRequestPreviewText(parsed, requesterName, at)` 결과 · `DialogFooter className='gap-2 sm:gap-0'` → PC에서 버튼 간격 0 | `quick-request-preview-dialog.tsx:46~71` · `quick-request-order-page.tsx:59` |
| 요약 보드 | `quick-request-summary-content.tsx`가 출발/경유/도착·크기·차량·운임·일정을 행으로 그린다(폼 값 → 표시 라벨 함수 보유) | 86·87 |
| 메시지 목록 | 컨테이너 `relative h-full overflow-y-auto px-4 py-3` 안에 메시지가 위에서부터 쌓임 → 메시지가 적으면 아래가 빈다 | `quick-chat-message-list.tsx:160` |

---

## 한 줄 요약

퀵 요청 **미리보기 Dialog**를 카톡용 텍스트 덩어리 대신 **출발/도착 2칸 + 경유 목록 + 크기·차량·결제·일정 칩**으로 보여 주고, 「취소」「등록」 버튼 간격을 모든 화면에서 벌린다. 퀵 **채팅**은 메시지가 적을 때도 **최신 메시지가 입력창 바로 위**에 붙도록(카톡 방식) 말풍선을 아래 기준으로 정렬한다.

---

## 정책 확정안 (brief 2·3)

| # | 항목 | 확정 |
|---|------|------|
| D-1 | 미리보기 구조 | 제목 「퀵 요청 미리보기」·설명(92 AC-07 문구) 유지. 본문: ① **경로 카드**: `lg`↑ 2열(출발 \| 도착), 미만 1열. 각 칸 = 라벨(출발지/도착지) · 도로명 · 상세 · 담당자 · 연락처(`formatPhoneDisplay`) · 특이사항 칩 · 메모. 경유지가 있으면 출발·도착 사이(1열) 또는 아래(2열)에 「경유 N」 목록(번호 + 같은 항목) ② **칩 줄**: 「{크기 라벨}」 · 「{차량 라벨} × {대수}」 · 「{결제 라벨}」 · 「{일정 라벨}」(즉시 요청 / 절대 시각) ③ 「기타」 크기면 「물품 내용」 행(line-clamp-3) ④ 요청자 이름·요청 시각 1줄(muted) |
| D-2 | 버튼 | `DialogFooter`를 `gap-2`(모든 breakpoint)로. 모바일은 세로(`flex-col-reverse`), PC는 가로 오른쪽 정렬. 「취소」 `variant='outline'`·「등록」 primary. testid `quick-request-confirm-button` 유지 · 「취소」에 `quick-request-preview-cancel` 추가 |
| D-3 | 텍스트 함수 | `formatQuickRequestPreviewText`·`lib/format-quick-request-message.ts` **삭제**(다른 사용처 0 · 정찰). 미리보기 데이터는 **폼 값 → 요약 보드와 같은 라벨 함수**로 만든다(중복 포맷터 금지) |
| D-4 | 말풍선 정렬 | 메시지 목록 스크롤 컨테이너 안에 `flex min-h-full flex-col justify-end` 래퍼를 둔다. 메시지가 적으면 아래에 붙고, 많으면 기존대로 스크롤. 자동 스크롤·「새 메시지 N ↓」·「여기부터 새 메시지」·날짜 구분선·「입력 중…」 위치(목록 맨 아래) 동작은 변경 없음 |
| D-5 | 빈 상태 | 메시지 0건 안내(93 AC-04 문구)는 **세로 가운데** 유지(래퍼의 `justify-end` 예외) |

---

## 목표 & 완료 기준 (AC)

공통: `user.json` · 셀렉터 `getByRole`/`getByTestId` · 레이아웃 측정은 `boundingBox()`·`page.evaluate`만.

| AC | 유형 | 전제 | 동작 | 기대 |
|----|------|------|------|------|
| AC-01 | Playwright | 1280 · 유효 폼(출발 `서울 중구 세종대로 110 / 1층 / E2E 출발 / 01011112222`, 경유 1, 도착, 크기 「소형」, 차량 「다마스」 1대, 월정산, 즉시) | 등록 클릭 | Dialog 「퀵 요청 미리보기」 · `quick-request-preview-origin`·`quick-request-preview-destination` 두 칸이 **같은 y(±4px)** 에 나란히 · 각 칸에 도로명·상세·담당자·`010-1111-2222` · `quick-request-preview-stopovers`에 「경유 1」 · 칩 줄(`quick-request-preview-chips`)에 **「소형」「다마스 × 1」「월정산」「즉시 요청」** · `quick-request-preview-message`(`<pre>`) **0건** |
| AC-02 | Playwright | 375 · 같은 폼 | 등록 | 출발 칸 **위**, 도착 칸 **아래**(y 증가) · 가로 스크롤 없음 · 「취소」·「등록」 버튼 세로 배치, 두 버튼 `boundingBox` **간격 ≥ 8px** · 각 버튼 높이 ≥ 44px |
| AC-03 | Playwright | 1280 | 등록 | 「취소」·「등록」 가로 배치 · x 간격 **≥ 8px** · 「취소」 클릭 시 Dialog 닫힘 + 폼 유지 · 「등록」 → 201 · 상세 이동(89 AC-08 회귀) |
| AC-04 | Playwright | 크기 「기타」 + 물품 내용 `철판 2m` | 등록 | 칩 「기타」 · 행 `quick-request-preview-item-description` = `철판 2m` · 「소형」일 때는 그 행 **0건**(87 AC-03·04 대체) |
| AC-05 | grep | 구현 완료 | `grep -rn "formatQuickRequestPreviewText\|format-quick-request-message" src e2e` | **0건** · `src/features/quick-request/components/quick-request-preview-dialog.tsx`에서 `<pre` 0건 · 86 AC-20 grep(`#hex`·`rounded-[`·`shadow-[`·`bg-white`) 신규 파일 포함 0건 |
| AC-06 | Playwright | `THEMES` × light/dark 20조합 · 1280 | 미리보기 열기 | 각 조합에서 Dialog 표시 · `scrollWidth <= clientWidth`(86 AC-19 패턴) |
| AC-07 (r1) | Playwright | `user.json` · 본인 건 · 메시지 **1개** | 상세 「요청 대화」·「퀵 대화」 각각(1280) · 375 상세 전체 뷰 | ① 마지막 말풍선 `boundingBox.bottom`과 `quick-chat-messages` 컨테이너 `bottom`의 차이 **≤ 16px**(= 컨테이너 `py-3` · 실측 12px) ② 말풍선 `bottom` < 입력창(`quick-chat-input`) `top` ③ 메시지가 적으므로 컨테이너 **상단에 빈 공간**(말풍선 `top` − 컨테이너 `top` > 컨테이너 높이의 절반) · `quick-chat-messages-stack` bottom = 말풍선 bottom. ~~입력창 top − 말풍선 bottom ≤ 72px~~ **(r1 폐기)**: 「입력 중…」 줄(20px)·composer 패딩(9px)·빠른 답장 칩 줄(44~88px · 1280 상세는 2줄 wrap)이 D-4·U-3 「위치 불변」 Out 영역이라 입력창 기준 임계는 구조상 성립 불가(실측 85~129px). **입력창 기준 픽셀 임계는 쓰지 않는다** |
| AC-08 | Playwright | 메시지 **40개** fixture | 대화 열기 | 스크롤 맨 아래 · 마지막 말풍선이 입력창 바로 위 · 위로 스크롤 후 새 메시지 수신 시 「새 메시지 N ↓」(93 AC 회귀) · 「여기부터 새 메시지」 구분선 위치 유지 |
| AC-09 | Playwright | 메시지 0개 | 대화 열기 | 빈 상태 문구가 목록 영역 **세로 가운데**(`boundingBox` 중심이 컨테이너 중심 ±40px) |
| AC-10 | Playwright | 375 · 메시지 3개 | 상세 하단 「대화」 → 전체 뷰 | 말풍선 아래 정렬 · 키보드 없이 입력창 보임 · 가로 스크롤 없음 |
| AC-11 | CLI | — | `npx tsc --noEmit` · `npm run lint` · `npm run build` · `npx playwright test e2e/quick-request e2e/quick-chat e2e/quick-workflow/register*.spec.ts` | 통과(87 AC-03·04·86 AC-13 spec의 `<pre>` 판정 → AC-01·04로 교체) |

**AC 총 11개.**

---

## 범위 (In / Out)

### In
1. `quick-request-preview-dialog.tsx` 재작성(구조화 카드 · footer 간격 · testid) + 신규 `quick-request-preview-card.tsx`(경로 칸·칩 줄 · 요약 보드 라벨 함수 재사용)
2. `quick-request-order-page.tsx`: `previewMessage` 문자열 상태 → 폼 값 전달
3. `lib/format-quick-request-message.ts` 삭제
4. `quick-chat-message-list.tsx` 래퍼(`justify-end`) + 빈 상태 예외
5. E2E: `e2e/quick-round2/96-preview-chat-align.spec.ts` 신규 · 기존 spec `<pre>` 판정 교체
6. README 96 등록 · 86/87/92 수정 이력 1행

### Out
| 항목 | 이유 |
|------|------|
| 미리보기에서 바로 수정(인라인 편집) | 요청 없음 · 「취소」 후 폼 수정 |
| 요약 보드(우측/하단바) 재디자인 | 86·87 유지 |
| 메시지 payload·정렬 로직·Realtime | 94 범위 |
| 말풍선 색·모양 변경 | 93 U-4 유지 |
| BE·SQL·activity log | 변경 없음 |

---

## UI 요구사항 (designer 지시)

| # | 화면 | 요구 |
|---|------|------|
| U-1 | 미리보기 Dialog | `max-w-2xl`(lg↑) · 본문 `max-h-[70vh] overflow-y-auto`. 경로 카드 2칸은 shadcn `Card`(`bg-muted/30`) · 칸 제목 「출발지」/「도착지」 + `Icons.*`(출발·도착 아이콘 기존 세트) · 항목 라벨 muted · 값 `break-keep` · 연락처 `tabular-nums`. 경유는 번호 Badge(「경유 1」) + 같은 항목 축소. 칩 줄은 `Badge variant='secondary'` 가로 wrap. 요청자·시각 1줄 muted(`formatAbsoluteDateTimeKo`) |
| U-2 | 버튼 | `DialogFooter className='gap-2'` · 모바일 `flex-col-reverse`(「등록」이 위) · PC 가로 · 각 `min-h-11` |
| U-3 | 채팅 목록 | 스크롤 컨테이너 안에 `flex min-h-full flex-col justify-end gap-…` 래퍼 · 빈 상태는 `justify-center`. 「입력 중…」 줄·「새 메시지 N ↓」 버튼 위치 불변 |
| U-4 | 테마 | 시맨틱 토큰·테마 radius/shadow 토큰만(86 규칙) |

---

## API / DB 요구사항

- 없음(FE only). notify/등록 Route body 불변.

---

## 활동 감사 로그

> **activity log 해당 없음** — Read·표시 변경만. 신규 CUD Route 없음. 삭제 UI 없음(`AlertModal` 대상 없음).

---

## 영향 파일 & 패턴

| 팀 | 파일 |
|---|---|
| FE | `src/features/quick-request/components/quick-request-preview-dialog.tsx` · `quick-request-preview-card.tsx`(신규) · `quick-request-order-page.tsx` · `quick-request-summary-content.tsx`(라벨 함수 export만) · `lib/format-quick-request-message.ts`(삭제) · `components/chat/quick-chat-message-list.tsx` |
| verifier | `e2e/quick-round2/96-preview-chat-align.spec.ts`(신규) · `e2e/quick-request/order-page.spec.ts`(`<pre>` 판정 교체) · `e2e/quick-workflow/register*.spec.ts` · `e2e/quick-chat/dm-behaviors.spec.ts`(회귀) |

**패턴:** 86 테마·터치 타깃 규칙 · `Card`/`Badge` shadcn · 93 메시지 목록 스크롤 로직.

---

## 리스크 & 완화

| 등급 | 리스크 | 완화 |
|---|---|---|
| MED | `justify-end` 래퍼가 자동 스크롤·「새 메시지 N ↓」 판정(스크롤 위치 계산)을 깨뜨림 | 컨테이너는 그대로, 내부 래퍼만 추가 · AC-08 회귀 |
| MED | 텍스트 함수 삭제로 e2e 다수가 깨짐 | AC-05·11에서 교체 대상 명시 |
| LOW | 20테마 조합에서 Card 대비 부족 | AC-06 스모크 + 시맨틱 토큰 |

**롤백:** git revert(FE 4파일).

---

## Battle Plan (단계)

| # | 단계 | 산출물 | 확신도 | 의존 |
|---|---|---|---|---|
| 0 | root Step 0 백업 | — | HIGH | — |
| 1 | designer: 미리보기 카드 배치(2열/1열·경유 위치·칩) · footer · 채팅 정렬 확인 | 설계 메모 | HIGH | — |
| 2 | FE: 미리보기 카드 + Dialog + order-page 연결 + 텍스트 함수 삭제 → tsc | UI | HIGH | 1 |
| 3 | FE: 메시지 목록 래퍼 + 빈 상태 | UI | HIGH | 1 |
| 4 | verifier: 신규 spec + 교체 + 테마 20조합 + 회귀 | green | HIGH | 2·3 |

**추정:** 신규 2파일 · 수정 5파일 · 삭제 1파일 · +300/−120줄 · **Simple~Medium** · 약 2~3시간.

---

## requirements-pipeline Express (Phase 3)

### 가정

| ID | 가정 | 출처 |
|----|------|------|
| A1 | 미리보기는 「확인용」이며 편집 기능이 없다 | 86·89 U-8 |
| A2 | 요약 보드 라벨 함수가 재사용 가능한 형태(순수 함수)다 | 정찰 **[INFERRED · 2단계에서 export 정리]** |
| A3 | 채팅 정렬 변경은 스크롤 로직과 독립적이다 | D-4 |

### 검증 시나리오

| 시나리오 | 기대 |
|----------|------|
| PC 미리보기 | 2칸 나란히 · 칩 4개 · 버튼 간격(AC-01·03) |
| 모바일 미리보기 | 1열 · 세로 버튼(AC-02) |
| 메시지 1개 | 말풍선이 목록 컨테이너 바닥에 붙고(≤ 16px) 상단은 빈 공간(AC-07 r1) |
| 메시지 40개 | 기존 스크롤 동작(AC-08) |

---

## 구현 팀 전달 메모

### designer
- 경로 칸 2열/1열 · 경유 위치 · 칩 순서 · footer 간격 · 테마 토큰. 채팅은 정렬만.

### frontend-dev
- 요약 보드 라벨 함수 재사용(중복 포맷터 금지) · `<pre>`·텍스트 함수 제거 · `DialogFooter gap-2` · 메시지 목록 `justify-end` 래퍼(빈 상태 예외).

### verifier
- `<pre>` 판정을 testid 판정으로 교체 · boundingBox로 간격·정렬 판정 · 테마 20조합 · 93 DM 회귀.

---

## 열린 질문

없음.

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-10-27 | 최초 작성 · Approved(/root 단일 게이트 · brief 2·3). 미리보기 구조화 카드(출발/도착 2칸 · 경유 · 칩 4종) · footer 간격 · 텍스트 포맷터 삭제 · 채팅 말풍선 하단 정렬 · FE only · AC 11 | planner |
| 2026-10-28 | verifier: 신규 `e2e/quick-round2/96-preview-chat-align.spec.ts` 33/35 green · AC-01~06·08~10 pass · tsc·lint·react-doctor·build pass · cleanup 0. **AC-07 「≤ 72px」 임계만 실패**(실측 상세 1280 129px · 퀵 대화 85px · 375 93px — `py-3` 12 + 「입력 중…」 20 + composer 패딩 9 + 빠른 답장 칩 줄 44~88, 전부 D-4 Out 영역) → Status **In Progress** · `[planner 재진입]`: 「마지막 말풍선 bottom ↔ `quick-chat-messages` 컨테이너 bottom ≤ 16px + 말풍선 bottom < 입력창 top」으로 교체 권장(`.claude/handoff/96-verifier.md`) | verifier |
| 2026-10-28 | **r1 (planner 재진입 · AC-07 기획 수정)**: AC-07 기대값을 「마지막 말풍선 bottom ↔ `quick-chat-messages` 컨테이너 bottom 차이 ≤ 16px + 말풍선 bottom < 입력창 top + 상단 빈 공간」으로 교체. 사유: 하단 정렬은 green(실측 12px)이고 실패는 입력창 기준 임계(≤ 72px)뿐인데, 그 사이 영역(「입력 중…」 20 · composer 패딩 9 · 빠른 답장 칩 줄 44~88)은 D-4·U-3 「위치 불변」 Out이라 임계가 구조상 성립 불가(실측 상세 1280 129 · 퀵 대화 85 · 375 93). 입력창 기준 픽셀 임계(72·96)는 폐기. 검증 시나리오 1행 동기화. **Status In Progress 유지**(verifier 재검증 후 Completed) · spec은 `PLAN_AC07_MAX_GAP_PX` 단언만 제거(`expectBottomAligned` 유지) · 코드 변경 없음 | planner |
| 2026-10-28 | **verifier 재검증(r1) · Completed** — AC-07 r1 판정으로 spec 교체(`PLAN_AC07_MAX_GAP_PX` 단언 제거 · `expectBottomAligned` 유지 · 375 전체 뷰 동일 판정) → `e2e/quick-round2/96-preview-chat-align.spec.ts` **35/35 green**(AC-01~10 · 실측 말풍선 bottom ↔ 컨테이너 bottom 12px / 상세·퀵 대화 1280 · 375). 회귀 `quick-request quick-chat vendor-flow` 168 passed · 실패 2 = 기존 `notes.api AC-12`(가드 401 `x-request-id`) + `06-notifications AC-27` 부하 플레이크(파일 단위 재실행 12/12 pass). vendor-flow AC-19/21 spec 레이스 보정(`after()` 알림 기록을 `expect.poll`로 대기 · 앱 변경 없음). tsc 0 · lint:strict 0 · react-doctor 79(회귀 없음) · build exit 0 · `npm run e2e:cleanup` remaining 전부 0 | verifier |
| 2026-10-29 | [106](./106_quick-mobile-restructure-plan.md): AC-07·AC-10의 375 측정 위치가 새 전체 화면 대화방으로 바뀜. 판정식(컨테이너 bottom ≤ 16px)은 유지(106 AC-42) | planner |
