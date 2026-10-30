# 퀵 휴대폰 화면 구조 개편 기획서

> Date: 2026-10-29
> Status: Completed
> Author: planner
> **verifier (2026-10-29 · r2):** AC 54 자동 green + AC-54 실기기 수동 QA 9항목 사용자 전달 · 회귀 퀵 6폴더 471건 중 plan 106 무관 2건만 실패(100-ai-suggest-off AC-09 환경 · notes.api AC-12 401 `x-request-id`) · tsc 0 · lint:strict 0 · build 0 · react-doctor 변경분 에러 0(경고 17) · 단위 통과 · cleanup remaining 0 · 신규 `e2e/quick-mobile/106-*.spec.ts` 8개 + `chromium-quick-mobile` project · SQL 없음(migration 해당 없음)
> **1순위 목표:** 사용자는 퀵을 **휴대폰으로 더 많이 쓴다**("모바일 UI·UX가 굉장히 좋아야 함"). 이 plan의 모든 결정은 휴대폰 품질이 먼저다. PC(가로 1024px 이상)는 지금 화면을 지킨다(예외 3건은 §PC 영향 예외).
> **SQL:** 없음 · **BE:** 등록 Route 날짜 검사 1건(기존 400 분기 재사용) · **activity log:** 신규 action 없음(기존 분기 유지 · AC-52)
> **Supersedes (일부):** [86](./86_quick-request-kakao-redesign-plan.md) D1·In#1·Shell·주소 입력 UI(휴대폰) · [89](./89_quick-workflow-dongbang-openchat-plan.md) U-2·U-3·U-4(휴대폰 배치)·AC-36 판정 · [93](./93_quick-request-chat-plan.md) U-1·U-4(말풍선 시각)·U-6(휴대폰 Enter)·U-8·AC-03·AC-10 시각 판정 · [94](./94_quick-realtime-and-small-fixes-plan.md) D-7·AC-15(카드 「상세 보기」 유지 조항) · [96](./96_quick-preview-card-chat-bottom-align-plan.md) AC-07·AC-10 375 측정 위치 · [97](./97_quick-period-filter-recent-address-split-phone-plan.md) D-6·AC-08(대화 목록 시각)·D-7/U-1(휴대폰 툴바)·U-2/AC-05(페이지네이션 문구·휴대폰 넘김) · [101](./101_quick-chat-participants-plan.md) U-1(휴대폰 「참여자 N」 위치) · [90](./90_quick-dashboard-permission-info-plan.md) UI-1(휴대폰 ⓘ 위치) · [100](./100_quick-chat-ai-reply-suggestions-plan.md) D-8(휴대폰 입력 중 칩 숨김) — 상세는 §Supersede 표
> **선행:** [08](./08_activity-audit-log-plan.md), [14](./14_delete-confirm-dialog-plan.md), [40](./40_filter-shell-loading-ux-plan.md), [69](./69_org-chart-mobile-tree-plan.md), [86](./86_quick-request-kakao-redesign-plan.md), [87](./87_quick-request-goods-notes-address-picker-plan.md), [89](./89_quick-workflow-dongbang-openchat-plan.md), [90](./90_quick-dashboard-permission-info-plan.md), [91](./91_pwa-web-push-notifications-plan.md), [93](./93_quick-request-chat-plan.md)~[101](./101_quick-chat-participants-plan.md)

---

## 선행 plan 참조 (Phase 0)

| Plan | Status | 관계 |
|------|--------|------|
| **69** | Approved | 선례. **휴대폰 화면만 바꾸고 PC는 회귀 AC로 묶는다**(69 AC-09). 이 plan도 「lg 미만만 변경 + 1280·1024 회귀 AC」 방식 |
| **86** | Approved | 요청 폼 단일 화면·테마 10종·testid 규칙은 **유지**. 휴대폰에서 `viewportFill` 안쪽 스크롤 → **페이지 스크롤**, 큰 제목 숨김, 주소 칸 탭=검색, 하단 바 1줄로 바꾼다. 83 wizard로 돌아가지 않는다(Q4 A) |
| **87 · 99** | Approved · Completed | 주소 검색 Dialog(주소·최근·장소 탭)를 그대로 쓴다. 휴대폰에서 주소 칸을 누르면 이 Dialog가 열린다. 「주소 직접 입력」 탈출구를 추가한다 |
| **89** | In Progress | 상태 흐름·권한 매트릭스·API는 **불변**. 대시보드·상세의 **휴대폰 배치**만 바꾼다 |
| **90** | Completed | ⓘ 「퀵 권한 안내」 내용 불변. 휴대폰에서는 큰 제목이 사라지므로 **본문 첫 줄**로 옮긴다(§정찰 F-3) |
| **93 · 98 · 100 · 101** | Completed | 대화 컴포넌트·첨부·AI 칩·참여자 기능 불변. 휴대폰 대화방을 **전체 화면 + 한 줄 상단바**로 바꾸고, 휴대폰 Enter=줄바꿈, 입력 중 AI 칩 숨김, 「참여자 N」·「상세 보기」를 「⋯」로 옮긴다. 대화 시각은 짧게 쓴다(규칙 예외 · Q6) |
| **94** | Completed | 카드 전체 탭=상세 유지. 휴대폰 카드의 「상세 보기」 버튼은 **없애고**, 요청번호를 상세 링크(stretched link)로 바꿔 접근성 경로를 지킨다 |
| **96** | Completed | 말풍선 하단 정렬 판정식(컨테이너 bottom ≤ 16px)은 유지. 375 전체 뷰 레이아웃이 바뀌므로 다시 잰다 |
| **97** | Completed | 기간·DB 페이지네이션 API 불변. 휴대폰은 같은 `page` 파라미터로 **자동 추가 로드**(BE 변경 없음), PC는 페이지 번호 유지 + **한국어 문구** |
| **91 · 105** | Completed · Approved | PWA `display: standalone` — 아이폰 설치 앱에는 브라우저 「뒤로」가 없다 → 화면 안 「뒤로」 경로 필수 |
| **08 · 14** | Approved · Completed | 신규 CUD 없음. 요청 취소는 「⋯」 안으로 옮겨도 `AlertModal` 유지 |

### 정찰로 확인한 사실 (Phase 2 · 실제 파일)

| # | 항목 | 사실 | 근거 |
|---|------|------|------|
| F-1 | 페이지 헤더 | 4화면 모두 `PageContainer`(`components/layout` · ui 아님)의 `pageTitle`·`pageDescription`·`infoContent`·`pageHeaderAction` 사용. 헤더를 숨기는 prop 없음 | `src/app/dashboard/quick/**/page.tsx` · `page-container.tsx` |
| F-2 | 공통 상단바 | `header.tsx` h-16(md h-14) · `SidebarTrigger`(ui size-7) · `Breadcrumbs`(마지막 항목은 휴대폰에도 표시) · `ThemeModeToggle` · `NotificationCenter`. `use-breadcrumbs.tsx` routeMapping에 퀵 경로 없음 → `Quick`·`Request`·`Chat` 영어 | `components/layout/header.tsx` · `hooks/use-breadcrumbs.tsx:12` |
| F-3 | ⓘ 위치 제약 | `InfobarProvider`가 **본문만** 감싸고 `Header`는 밖 → 상단바에 `InfoButton`을 두면 패널 context가 없다. 휴대폰 ⓘ는 **본문 첫 줄**에 둔다. `InfoButton`은 props를 뒤에 펼쳐 `aria-label` 덮어쓰기 가능 | `app/dashboard/layout.tsx` · `ui/info-button.tsx:44~45` |
| F-4 | viewport | `app/layout.tsx` viewport에 `viewportFit` 없음 · appleWebApp 메타 없음 · manifest `standalone`. `env(safe-area-inset-bottom)` 사용 8곳이 지금은 0 | `app/layout.tsx:18` · `grep safe-area-inset` |
| F-5 | 대시보드 | 메타바 → 상태 카드(2×2 + 「취소 N」 ghost) → 툴바(기간 ToggleGroup 1줄 + 검색·Select·초기화) → 본문(lg 표 / lg 미만 카드 CSS 전환, 한 번의 `useSuspenseQuery`) → `DataTablePagination`(ui · 영어 문구 「row(s) total」「Page 1 of 3」「Go to next page」) | `components/dashboard/*` · `ui/table/data-table-pagination.tsx:38~100` |
| F-6 | 목록 API | `GET /api/quick-request?range&from&to&status&search&page&perPage` → `{rows,page,limit,total}`. 휴대폰 무한 목록은 **같은 `page`로 `useInfiniteQuery`** 가능 → **BE 변경 없음** | `api/queries.ts` · plan 97 |
| F-7 | 요청 폼 | `quick/request/layout.tsx` `h-[calc(100dvh-4rem)] overflow-hidden`(모든 폭) + 왼쪽 열 `overflow-y-auto` → 휴대폰도 안쪽 상자만 스크롤 | `app/dashboard/quick/request/layout.tsx` · `quick-request-order-page.tsx` |
| F-8 | 주소 칸 | 일반 input + 「주소 검색」 버튼(`-address-search`) · Daum embed `focusInput:false`. e2e `fillLocationByPrefix`가 `-road-address`에 `.fill()` → 칸을 `readonly`로 바꾸면 휴대폰 spec이 깨진다 | `quick-request-location-section.tsx` · `quick-request-daum-postcode-embed.tsx:118` · `e2e/quick-request/helpers.ts:152` |
| F-9 | 날짜 검사 | 폼 `refineQuickRequestForm`은 **요청·수정 폼 공용**, 서버 `quickRequestCreateBodySchema`는 등록 전용(`refineQuickRequestCrossFields`). 과거·순서 검사 없음 → 등록 전용 refine을 **새로** 붙이면 수정(동방)은 영향 없음 | `schemas/quick-request-form.ts:62` · `quick-request-edit.ts:50` · `quick-request-workflow.ts:90` |
| F-10 | 대화 | Messenger 높이 `useVisualViewportHeight`(MIN 320px) · `request` nuqs `history:'push'` · 헤더에 「목록」(lg 미만)·「참여자 N」·「상세 보기」(h-9) · composer Enter=전송(`enterKeyHint='send'`) · 입력 `text-base md:text-sm` · 말풍선·목록 시각 `formatAbsoluteDateTimeKo` | `components/chat/*` |
| F-11 | 상세 | 2열 aside·대화 카드는 **xl(1280)**부터. 1024~1279는 1열 + 액션바(「대화」·「요청 취소」·「수정」·주 동작). 스테퍼 시각 `hidden sm:block`. `?chat=1` `history:'push'` · 대화 뷰 `h-[calc(100dvh-11rem)]` | `components/detail/*` · `quick-chat-constants.ts:153` |
| F-12 | 하단 고정 요소 | ui 밖 하단 고정은 퀵 액션바 1곳(`sticky bottom-0`) + safe-area 패딩 8곳(퀵·워크플로우). 앱 전체 `viewport-fit=cover` 영향은 작다 | `grep "fixed.*bottom\|sticky bottom"` |
| F-13 | 다른 테마·폰트 | 86 AC-14가 375에서 `neobrutualism`·`notebook`·`mono`를 본다(폭이 넓어지는 테마) | `e2e/quick-request/responsive.spec.ts` |

---

## 한 줄 요약

퀵 4화면(내역·요청·대화·상세)을 **휴대폰 앱처럼** 다시 짠다. 휴대폰에서는 큰 제목을 숨기고 상단바에 한국어 화면 이름을 띄운다. 아래에는 **퀵 탭 3개**(내역·대화·요청하기)를 둔다. 내역은 **숫자 칩 한 줄 + 검색·「필터」 + 짧은 카드 + 자동 추가 로드**로 바꾼다. 요청 폼은 **페이지 전체 스크롤**로 바꾸고 **주소 칸을 누르면 바로 검색**이 열린다. 지난 시각은 등록할 수 없게 막는다. 대화방은 **전체 화면 + 한 줄 상단바**로 바꾸고, 휴대폰에서 엔터는 줄바꿈이며 **짧은 시각**을 쓴다. 상세는 **지금 상태 한 문장 → 기사·금액 → 경로**로 순서를 바꾸고, 하단 버튼은 **주 버튼 + 대화 + ⋯**로 정리한다. 점검에서 찾은 작은 고장은 전부 같이 고친다. PC 화면은 지킨다.

---

## 모바일 품질 기준 (1순위 · 모든 AC의 바탕)

| # | 기준 | 측정 |
|---|------|------|
| M-1 | **손가락 크기** — 퀵 화면에서 보이는 모든 버튼·링크·탭·입력칸 **44×44px 이상** | AC-09 전수 스캔 |
| M-2 | **첫 화면 정보** — 위쪽 고정 영역을 줄여 핵심 내용이 첫 화면에 보인다(내역 카드 3장·대화 메시지 영역 70%·상세 기사+금액) | AC-13·31·37·45 |
| M-3 | **엄지 영역** — 주 동작(요청하기·등록·전송·접수/승인)은 화면 아래쪽 고정 | AC-05·29·33·48 |
| M-4 | **가로 스크롤 0** — 360·375·430·768 × 4화면 × 열린 상태(필터·주소 검색·⋯·참여자) | AC-10 |
| M-5 | **키보드·홈 막대** — 키보드가 올라와도 최신 메시지·입력창이 보이고 이중 스크롤이 없다. 아이폰 홈 막대에 버튼이 겹치지 않는다 | AC-36 + 수동 QA |
| M-6 | **어디서든 돌아가기** — 설치 앱(브라우저 「뒤로」 없음)에서도 모든 하위 화면에 화면 안 「뒤로」가 있고, 폰 뒤로가기가 꼬이지 않는다 | AC-08·35 |

---

## 정책 확정안 (deep-interview 2026-10-29 · 사용자 「1 전체 다 고쳐 / 다른 건 전부 추천으로」)

| # | 항목 | 확정 |
|---|------|------|
| D-1 | 범위 (Q1 A) | 구조 개편 + 점검 작은 고장 **전부**(C1~C4 · D1~D9 · R1~R6 · T1~T8 · S1~S7). **브레이크포인트:** 휴대폰 규칙 = **`lg`(1024) 미만**. PC(≥1024)는 지금 화면 유지. 태블릿 768~1023은 휴대폰 규칙 + 요청 카드 **2열**. 퀵이 아닌 메뉴의 화면 구조는 바꾸지 않는다 |
| D-2 | 위쪽 공통 틀 (Q2-1 A) | 퀵 4화면만, lg 미만에서 `PageContainer` 큰 제목·설명·`pageHeaderAction`을 **숨긴다**(새 prop). 상단바 breadcrumb 마지막 항목을 한국어 화면 이름으로: `/dashboard/quick` 「퀵 내역」 · `/request` 「퀵 요청」 · `/chat` 「퀵 대화」 · `/{번호}` 「퀵 {번호}」. ⓘ 「퀵 권한 안내」는 **본문 첫 줄**(내역: 메타바 오른쪽 · 상세: 상태 카드 오른쪽 위 · 대화 목록: 목록 머리 오른쪽)에 44px로 둔다(정찰 F-3 — 상단바는 패널 context 밖) |
| D-3 | 앱 전체 공통 (Q2-1 함께) | ① 상단바 사이드바·테마·알림 버튼 **lg(1024) 미만 44px**(`header.tsx`·`theme-mode-toggle`·`notification-center`에서 className으로 · ui 수정 금지 · lg 이상 크기 불변 28/32/32 · **r1**: 「md 미만」→「lg 미만」 — Q1 확인 ② 「태블릿 768~1023은 휴대폰 규칙」) · 같은 근거로 lg 미만에서 상단바 검색(「Search... ⌘K」)·테마 프리셋 Select **숨김**, breadcrumb는 **마지막 항목만 + truncate**(T768 사이드바 펼침 때 상단바 가로 넘침 129~169px 해소 — plan 이전부터 있던 문제) ② `viewport` `viewportFit: 'cover'` + `body` 좌우 `env(safe-area-inset-left/right)` 패딩(세로 화면 0 → 변화 없음 · 가로 화면 노치 보호) ③ 앱의 다른 하단 고정 요소 safe-area 점검(정찰 F-12: 워크플로우 2곳은 이미 대응) |
| D-4 | 퀵 하단 탭 (Q2-2 A) | lg 미만 **퀵 전용 하단 탭** `quick-mobile-tabbar`: 「내역」(`/dashboard/quick`) · 「대화」(`/dashboard/quick/chat` · 안 읽은 합계 배지 = 사이드바와 같은 쿼리) · 「요청하기」(`/dashboard/quick/request` · `canCreate`만 · 동방은 2개). **보이는 화면:** 내역, 대화 목록. **숨기는 화면:** 요청 폼, 상세(전체), 대화방(`?request=` · `?chat=1`) — 이 화면들은 상단바 왼쪽에 **「뒤로」**(`quick-mobile-back`). 사이드바와 겹치지 않고, 아래 safe-area만큼 띄운다. 본문 아래 여백 = 탭 높이 |
| D-5 | 「뒤로」 동작 (Q8 b 「둘 다」 → standalone 필수) | 앱 안에서 들어온 화면이면 `history.back()`, 알림·주소창·새 창으로 **바로 들어온 화면이면** 부모 화면으로 `replace`(상세 → 내역, 요청 폼 → 내역, 대화방 → 대화 목록, 상세 대화 → 상세). 대화방·상세 대화의 nuqs `history:'push'` 때문에 「닫은 대화가 폰 뒤로가기로 다시 열림」(T5)이 없어야 한다 |
| D-6 | 내역 상태 (Q3 a) | lg 미만: 같은 상태 버튼 5개(`quick-dashboard-card-{status}` · testid 유지)를 **가로 한 줄 숫자 칩**(「신규요청 3」…「취소 0」 · 옆으로 밀기 · 설명문 숨김 · 각 44px)으로. 누르면 그 상태만(재탭 해제). lg 이상: 지금 카드 4개 + 「취소 N」 그대로(하나의 컴포넌트가 CSS로 배치만 바꿈 → testid 중복 없음) |
| D-7 | 내역 필터 (Q3 b) | lg 미만: 검색창 1줄 + **「필터」 버튼**(`quick-dashboard-filter-button` · 켜진 필터 수 배지) → 아래에서 올라오는 판 `quick-dashboard-filter-sheet`(제목 「필터」): 기간(7일·30일·90일·전체·기간 직접 선택 → 달력) + 상태(전체 + 5종, 큰 선택 목록) + 「초기화」(상태·검색만 · 기간 유지 · 89 designer K3) + 「닫기」. 선택은 바로 URL에 반영. 달력 칸·이전/다음·적용/지우기 **44px**(`Calendar` className `[--cell-size:…]` · ui 수정 금지). lg 이상 툴바 불변 |
| D-8 | 내역 카드 (Q3 c) | lg 미만 카드: 1줄 요청번호(=상세 링크 `quick-card-link-{no}` · 카드 전체를 덮는 stretched link)·상태 / 2줄 출발→도착(경유 N) / 3줄 요청 시각(전체 시각 유지)·요청자·물품·차량 / 금액은 **값이 있을 때만** 1줄 / 업무 버튼(있을 때). 「상세 보기」 버튼 **삭제**. 「새 대화 N」(`quick-unread-{no}`)은 카드 오른쪽 아래 **44×44 이상** 버튼(누르면 그 대화). 「참여」 배지 유지. 768~1023은 **2열** |
| D-9 | 목록 넘김 (Q3 가) | lg 미만: 끝까지 내리면 **20건씩 자동 추가 로드**(`useInfiniteQuery` + 기존 `page` · `quick-infinite-sentinel` 재사용 · 끝 문구 「더 이상 요청이 없습니다」 · `id` 중복 제거 · URL `page`/`perPage` 무시). Realtime invalidate 시 불러온 페이지 전부 다시 받음(같은 `lists()` 키 아래). lg 이상: 페이지 번호 유지 + **퀵 전용 한국어 페이지네이션**(「총 N건」·「페이지당」·「1 / 3 페이지」·「첫/이전/다음/마지막 페이지」 · ui `DataTablePagination`은 수정하지 않고 퀵 화면에서만 교체) |
| D-10 | 요청 폼 (Q4 A) | 한 페이지 폼 유지. lg 미만: ① **페이지 전체 스크롤**(request layout 높이 고정을 `lg:`로만) · 하단 요약바는 화면 아래 고정 유지 ② 주소 칸 `readonly` + 탭 → 주소 검색(휴대폰은 화면 거의 전체 높이) · 칸 안 검색 아이콘 버튼(`-address-search` testid 유지 · 44px) · 검색창 안 **「주소 직접 입력」**(`quick-request-address-picker-manual`) → 칸이 입력 가능해지고 포커스 ③ 담당자·연락처 **한 줄**(360 이상) ④ 경유 들여쓰기 축소 → 주소 칸 폭 **≥ 300px** ⑤ 차량 사진 타일 축소 ⑥ 글자 칸 `enterKeyHint='next'` + Enter → 다음 칸(마지막 `done`) · Enter로 미리보기가 열리지 않음 ⑦ 하단 요약바 **1줄**(말줄임 · 단어 중간 줄바꿈 없음) ⑧ 라디오 카드 내용 **세로 가운데**(R6 · PC 포함 버그 수정). lg 이상: 주소 칸 입력 가능·옆 검색 버튼·안쪽 스크롤·aside 그대로 |
| D-11 | 날짜 검사 (Q4 가) | **등록할 때만**(화면 + 서버). ① 픽업 「날짜/시간 선택」 시각 < 지금 → 「픽업 일시는 현재 이후로 선택해 주세요.」 ② 도착 예약 시각 < 지금 → 「도착 희망 일시는 현재 이후로 선택해 주세요.」 ③ 둘 다 예약이고 도착 < 픽업 → 「도착 희망 일시는 픽업 일시 이후로 선택해 주세요.」. 서버는 **5분 여유**(시계 차이·작성 시간). 입력칸 `min` 속성(지금 · 도착은 픽업). 공용 함수 1개를 폼 등록 스키마와 `quickRequestCreateBodySchema`에만 붙인다. **수정(동방·admin PATCH·수정 Sheet)은 지난 시각 허용**(이미 지난 배송 기록) — `refineQuickRequestForm`(공용)에는 넣지 않는다 |
| D-12 | 대화방 (Q5 A) | lg 미만에서 대화방(`/chat?request=`)과 상세 대화(`?chat=1`)는 **전체 화면**: 공통 상단바·하단 탭이 보이지 않고, **한 줄 상단바**(`quick-chat-header` · 높이 ≤ 60px): 「뒤로」(`quick-chat-back` · aria-label 「목록」 유지 / 상세 대화는 `quick-detail-chat-back` 「상세로」) · 요청번호(한 줄 · 줄바꿈 금지) + 상태 배지 (+ 둘째 줄 경로 말줄임 허용) · 「⋯」(`quick-chat-more`): 「참여자 N」(기존 Drawer) · 「상세 보기」(`quick-chat-detail-link` · 상세 대화에는 없음). 메시지 영역 **화면 높이의 70% 이상**. 구현 방식(오버레이 vs 상단바 숨김)은 designer·FE 결정 — 키보드 동작(AC-36)이 기준 |
| D-13 | 대화 입력 (Q5 ①②③④) | ① **터치 기기**(`(pointer: coarse)`)에서 Enter = 줄바꿈 · `enterKeyHint='enter'` · 보내기는 「전송」 버튼만 · 숨은 안내문도 바꿈. 마우스 기기(PC)는 Enter 전송·Shift+Enter 줄바꿈 그대로 ② lg 미만에서 **입력칸에 글자가 있으면 AI·빠른 답장 칩 줄 숨김**(비면 다시 보임 · 칩 탭 → 채워지고 숨김) · lg 이상 불변 ③ 「뒤로」·폰 뒤로가기 꼬임 수정(D-5) ④ **키보드가 올라와 화면이 줄어도 맨 아래를 보고 있었다면 맨 아래 유지**(컨테이너 크기 변화 감지) · 페이지 이중 스크롤 0 (`useVisualViewportHeight` 최소 높이 재조정) · lg 미만 입력 글자 **16px**(iPad·가로폰 확대 방지 · T8) |
| D-14 | 대화 시각 (Q6 A · **규칙 예외**) | 퀵 대화에서만: **말풍선·대화 안 시스템 줄** = `HH:mm`(위 날짜 구분선 `yyyy-MM-dd`가 날짜를 알려 줌) · **대화 목록** = KST 기준 오늘 `HH:mm` / 같은 해 `MM-dd` / 이전 해 `yyyy-MM-dd`. 상대 표현(「분 전」「방금」「어제」) **계속 금지**. 상세·처리 이력·알림·읽음 tooltip·참여자 초대 시각·내역 카드는 **전체 시각 유지**. 포맷 함수는 `@/lib/format-datetime`에 `formatChatBubbleTimeKo`·`formatChatListTimeKo` 추가(feature별 직접 작성 금지 원칙 유지). `WakeOne-web/.cursor/rules/core-conventions.mdc` §날짜·시각에 「퀵 대화 예외」 1줄 추가. **PC에도 같은 표기**(같은 컴포넌트 · §PC 영향 예외) |
| D-15 | 상세 (Q7 A) | lg 미만 순서: ① **상태 카드** — 요청번호·상태·ⓘ · **지금 상태 한 문장**(`quick-detail-status-summary` · §문구표) · 스테퍼(단계별 **전체 시각** 표시 · 두 줄까지 줄바꿈 허용 · `hidden sm:block` 제거) ② **기사 카드**(`quick-detail-driver-card`: 기사 이름 · 자동차등록번호 · 「전화 걸기」 큰 버튼 = `quick-detail-driver-phone` `tel:` · 번호 표시) — 배차 전이면 「배차 완료 후 기사 정보가 표시됩니다.」 한 줄 ③ **금액**(예상·최종 · 부가세 포함 안내) ④ 이동 경로 ⑤ 물품·차량·운임 ⑥ 요청 정보(요청자·연락처 — 요청 시각·요청번호 반복 제거) ⑦ **처리 이력 접기**(최신 1줄 + 「전체 보기」 · `aria-expanded` · 펼치면 94 순서). 1024~1279·1280 이상은 지금 순서·내용 그대로 |
| D-16 | 상세 하단 바 (Q7 A) | lg 미만: **[주 버튼(접수/배차완료/최종금액 입력/승인 · 넓게)] [「대화 N」] [「⋯」(`quick-detail-more`)]** · 「⋯」 안: 「수정」(`quick-detail-edit`) · 「요청 취소」(`quick-detail-cancel` · 빨강 · 기존 `QuickCancelAlert` AlertModal). 주 버튼이 없으면 「대화」 + 「⋯」. **할 일이 전혀 없으면 하단 바를 없애고** 오른쪽 아래 떠 있는 「대화」 버튼(56px · 안 읽은 수 배지 · `quick-detail-chat-button`). 승인 막힘 안내(「최종금액이 입력되면 승인할 수 있습니다.」) 유지. lg 이상 불변 |
| D-17 | 사용 환경 (Q8 a·b 기본값 「둘 다」) | 아이폰 + 안드로이드, **홈 화면 설치 앱(standalone) + 브라우저** 모두 지원 |
| D-18 | 확인 방법 (Q8 c A) | 자동 검사 360×780 · 375×812 · 430×932 · 768×1024(휴대폰 규칙) + 1024·1280(PC 회귀). 휴대폰 문맥은 Playwright `isMobile: true, hasTouch: true`. 끝나면 **실기기 5분 수동 QA 목록**(§수동 QA)을 사용자에게 준다 |
| D-19 | iOS 설치 배너 (C1) | **변경 없음**(Out) — 아이폰 사파리 미설치일 때만 뜨고, 닫으면 7일 숨김. 휴대폰 알림 설치를 유도하는 통로(91)라 유지 |

### 상세 「지금 상태 한 문장」 문구표 (D-15)

| 상태 | 요청자·초대 참여자·구매물류팀 | 동방특송·admin(처리 권한) |
|------|-------------------------------|---------------------------|
| `requested` | 동방특송이 요청을 확인하고 있습니다. | 새 요청입니다. 확인 후 접수해 주세요. |
| `dispatching` | 동방특송이 배차하고 있습니다. | 배차가 끝나면 배차완료를 입력해 주세요. |
| `dispatched` · 최종금액 없음 | 배차가 완료되었습니다. 최종금액이 입력되면 승인할 수 있습니다. | 운송이 끝나면 최종금액을 입력해 주세요. |
| `dispatched` · 최종금액 있음 | 최종금액을 확인하고 승인해 주세요. | 요청자의 승인을 기다리고 있습니다. |
| `approved` | 승인이 끝난 요청입니다. | 승인이 끝난 요청입니다. |
| `cancelled` | 취소된 요청입니다. (아래 취소 배너에 사유) | 취소된 요청입니다. |

- admin이 **요청자 본인**인 건(dispatched·최종금액 있음)은 승인 권한이 있으므로 왼쪽 열 문구. 판정은 `detail.permissions`(`canApprove`·`canAccept`·`canDispatch`·`canSetFinal`)로 한다(역할 문자열 비교 금지).

### PC 영향 예외 (사용자 선택으로 PC도 바뀌는 것 · 이것 말고는 PC 불변)

| # | 내용 | 근거 |
|---|------|------|
| X-1 | 대화 시각 짧게(말풍선 `HH:mm` · 목록 규칙) | Q6 A · 같은 대화 컴포넌트 |
| X-2 | 퀵 내역 페이지네이션 문구 한국어 | Q3 가 「PC는 문구만 한국어로」 |
| X-3 | 상단바 breadcrumb 퀵 경로 한국어(「퀵 내역」 등 · 맨 앞 「Dashboard」는 앱 전체라 Out) · 등록 시 날짜 검사 · 라디오 카드 세로 가운데(**r1: 요청 폼·수정 Sheet 모두**) | 점검 C3·R5·R6 버그 수정(Q1 A · 「전체 다 고쳐」) |
| X-4 (r2) | 대화 **상대 말풍선이 글자보다 넓게 늘어나던 버그** 수정(`quick-chat-bubble.tsx` 상대 쪽 `items-start` · PC에도 적용) | 사용자 제보 · verifier 「AC-42 보조(말풍선 폭)」로 확인 |

---

## 목표 & 완료 기준 (AC)

**공통:**
- 뷰포트 이름: **M360** = 360×780 · **M375** = 375×812 · **M430** = 430×932 · **T768** = 768×1024 · **D1024** = 1024×768 · **D1280** = 1280×800. M·T는 `isMobile: true, hasTouch: true`.
- 계정: `user.json`(요청자) · `user2.json` · `admin.json` · `dongbang.json` · `logistics.json`. DB fixture는 service-role 헬퍼로 만든다(기존 `e2e/quick-*` 패턴).
- 셀렉터는 `getByRole`·`getByTestId`·`getByPlaceholder`만. 크기·위치는 `boundingBox()`·`page.evaluate`만(픽셀 비교 금지).
- 「가로 스크롤 없음」 = `document.documentElement.scrollWidth <= clientWidth`.
- 「44px 스캔」(AC-09) 대상: 보이는(`isVisible` · 폭 > 1px) `button`, `a[href]`, `[role=button]`, `[role=tab]`, `[role=menuitem]`, `[role=option]`, `[role=radio]`(카드 label 기준), `input:not([type=hidden])`, `textarea`, `[role=combobox]`. **제외:** 개발 모드 오버레이(Next 표시기·TanStack Query Devtools 버튼 — 운영에 없음), 토스트, `aria-hidden` 안 요소, sr-only. 너비·높이 모두 ≥ 44.
- 시각: 대화 말풍선·시스템 줄·대화 목록만 D-14 짧은 형식. 그 밖은 `formatAbsoluteDateTimeKo`(`yyyy-MM-dd (EEE) HH:mm:ss`), 날짜만은 `formatAbsoluteDateKo`.
- **이메일 Route 호출 금지**(`E2E_REMINDER_DRY_RUN=1` 유지) · Main DB 금지.

### A. 공통 틀 (12)

| AC | 유형 | Given | When | Then |
|----|------|-------|------|------|
| AC-01 | Playwright | M375 · `user.json` · 본인 건 1개 | `/dashboard/quick` · `/dashboard/quick/request` · `/dashboard/quick/chat` · `/dashboard/quick/{번호}` 차례로 | 각 화면에서 큰 제목 heading(「나의 퀵 내역」·「🚚 퀵 배송 요청」·「퀵 대화」·「퀵 요청 상세」) **보이지 않음** · 페이지 설명문 보이지 않음 · 상단바(`banner`)에 각각 **「퀵 내역」「퀵 요청」「퀵 대화」「퀵 {번호}」** 표시 · 상단바 텍스트에 `Quick`·`Request`·`Chat` **0건** |
| AC-02 | Playwright | M375 · `user.json` | 내역·상세에서 `quick-mobile-info-button` 탭 | 버튼 `top < 200` · 44×44 이상 · 접근 이름 「퀵 권한 안내 보기」 · 패널 제목 **「퀵 권한 안내」** · 본문이 D1280 패널과 같음(90 AC-02 판정 재사용) |
| AC-03 (r1) | Playwright | M375·M360·T768 `user.json` / D1024·D1280 | `/dashboard/overview` · `/dashboard/quick` 상단바 | M·T768: 사이드바 열기·테마·알림 버튼 각 **≥ 44×44** · 상단바 검색(「Search...」)·테마 프리셋 Select **안 보임** · breadcrumb 보이는 항목 **1개**(마지막) · D1024·D1280: 상단바 높이 **56px**(md:h-14) · 사이드바·테마·알림 버튼 크기 지금과 같음(28/32/32 · 회귀) · 검색·테마 Select 보임 |
| AC-04 | Playwright·DOM | M375 | `/dashboard/quick` · `/auth/sign-in` | `meta[name="viewport"]` content에 **`viewport-fit=cover`** · `body` 계산 padding-left·right **0px**(세로 에뮬레이션 · 변화 없음) |
| AC-05 | Playwright | M375 · `user.json`·`logistics.json`·`dongbang.json` / D1280 | `/dashboard/quick` | `quick-mobile-tabbar`(role `navigation`, 이름 「퀵 메뉴」) 보임 · user·logistics 탭 3개 **「내역」「대화」「요청하기」** · dongbang 2개(「요청하기」 0) · 각 탭 높이 ≥ 44 · 「내역」 `aria-current="page"` · 「대화」 탭 → `/dashboard/quick/chat`(탭 바 유지 · 「대화」 current) · 「요청하기」 → `/dashboard/quick/request`(탭 바 **0**) · D1280에서 탭 바 **0** |
| AC-06 | Playwright (2 context) | M375 `dongbang.json` 내역 열어 둠 · fixture: 한 건에 요청자 메시지 2개(안 읽음) | 화면 확인 → `user.json`이 그 건에 메시지 1개 전송 | 「대화」 탭 배지 **「2」**(사이드바 「퀵 대화」 배지와 같은 값) → 5초 안에 **「3」** |
| AC-07 | Playwright | M375 `user.json` | `/dashboard/quick/request` · `/dashboard/quick/{번호}` · `…?chat=1` · `/dashboard/quick/chat?request={번호}` / `/dashboard/quick` · `/dashboard/quick/chat` | 앞 4곳 탭 바 **0** · 뒤 2곳 **보임** · T768(사이드바 펼친 상태 포함)에서 탭 바 boundingBox가 사이드바(`[data-sidebar="sidebar"]` 보이는 영역)와 **겹치지 않음** · **r1:** T768 사이드바 펼침(쿠키 `sidebar_state=true`)에서도 6곳 모두 **가로 스크롤 없음**(상단바 포함) |
| AC-08 | Playwright | M375 `user.json` · 본인 건 | ① `page.goto('/dashboard/quick/{번호}')`(바로 진입) → `quick-mobile-back` ② `/dashboard/quick` → 카드 탭 → 상세 → `quick-mobile-back` → `page.goBack()` ③ `page.goto('/dashboard/quick/request')` → 「뒤로」 | ① 버튼 44×44 이상 · 접근 이름 「뒤로」 · URL `/dashboard/quick` ② 내역으로 돌아옴 · 그 뒤 `goBack()` URL이 상세가 **아님** ③ `/dashboard/quick` |
| AC-09 | Playwright | M375 · `user.json`·`dongbang.json`·`admin.json` | 4화면 + 열린 상태(내역 필터 판 · 주소 검색 · 대화 「⋯」 · 참여자 Drawer · 상세 「⋯」) 각각 **44px 스캔**(공통 정의) | 미달 요소 **0개** (실패 시 요소 testid/이름·크기 목록 출력) |
| AC-10 (r1) | Playwright | M360·M375·M430·T768 × `user.json`·`dongbang.json` + M375 × 테마 `neobrutualism`·`notebook`·`mono`(`THEMES` import) + **T768 사이드바 펼침**(쿠키 `sidebar_state=true`) × `user.json`·`dongbang.json` | 4화면 + AC-09 열린 상태 | 모든 조합 **가로 스크롤 없음**(T768 사이드바 펼침 포함 · 상단바가 넘치지 않음) |
| AC-11 | Playwright | T768 · `dongbang.json` · 4건 이상 | `/dashboard/quick` | 카드 첫 두 장 **같은 y(±4px)·다른 x** (2열) · 탭 바 보임 · 가로 스크롤 없음 |
| AC-12 | Playwright (PC 회귀) | D1280·D1024 · 각 역할 | 4화면 | **내역:** 제목 「퀵 내역」/「나의 퀵 내역」·「퀵 요청하기」 버튼(`quick-request-new-button`) 보임 · 상태 카드 설명문 보임·`quick-dashboard-card-requested` 높이 ≥ 80 · 기간 ToggleGroup·상태 Select 툴바에 바로 보임 · `quick-dashboard-table` 보임 · 카드 목록·탭 바·`quick-dashboard-filter-button` 보이지 않음 **요청:** `quick-request-summary` 보임 · `quick-request-mobile-bar` 안 보임 · `quick-request-origin-road-address`에 `.fill()` 가능(readonly 아님) **대화(D1280):** 2단 · 헤더에 「상세 보기」(`quick-chat-detail-link`)·「참여자 N」이 「⋯」 없이 보임 · 공통 상단바 보임 **상세:** D1280 aside 「요청 대화」 카드 · D1024 액션바에 `quick-detail-cancel`·`quick-detail-edit`가 「⋯」 없이 보임(요청자 `requested` / admin `dispatched`) · `quick-detail-more` **0** |

### B. 퀵 내역 (9)

| AC | 유형 | Given | When | Then |
|----|------|-------|------|------|
| AC-13 | Playwright | M375·M360 · `user.json` · 오늘 본인 `requested` 5건(업무 버튼·금액·새 대화 없음) | `/dashboard/quick` | M375: 첫 카드 `top ≤ 320px` · 탭 바 위로 **완전히 보이는 카드 ≥ 3장** · 각 카드 높이 **≤ 128px** · M360: 첫 카드 `top ≤ 320px` · 완전히 보이는 카드 ≥ 2장 |
| AC-14 | Playwright | M375 · `dongbang.json` · 상태별 fixture | 상태 칩 줄 확인 → 「접수 및 배차중」 칩 탭 → 다시 탭 | 5개(`quick-dashboard-card-{requested,dispatching,dispatched,approved,cancelled}`) **같은 y(±4px)** · 각 높이 ≥ 44 · 글자 「{라벨} {숫자}」 · 숫자(`…-count`) = `GET /api/quick-request/summary` 값 · 설명문 **안 보임** · 탭 → `aria-pressed=true` · URL `status=dispatching` · 카드가 그 상태만 → 재탭 → 해제 · 칩 줄은 가로로 밀 수 있어도 **페이지** 가로 스크롤 없음 |
| AC-15 | Playwright | M375 · `dongbang.json` | 툴바 확인 → `quick-dashboard-filter-button` → 판에서 「30일」·「승인」 선택 → 닫기 → 다시 열어 「초기화」 | 판 밖에서 기간 ToggleGroup·상태 Select **안 보임** · 검색칸 높이 ≥ 44 · 판 = `dialog` 「필터」 · 선택지 각 ≥ 44 · URL `range=30d`·`status=approved` · 메타바 「기간: 최근 30일」 · 버튼 배지 **「2」** · 「초기화」 → `status` 제거·`range` 유지 · 배지 「1」 |
| AC-16 | Playwright | M375 · `dongbang.json` · 97 AC-03 fixture(20일 전 2건) | 판 → 「기간 직접 선택」 → 25일 전 ~ 15일 전 → 「적용」 | 날짜 칸·이전/다음·「적용」「지우기」 각 **≥ 44×44** · URL `range=custom&from=…&to=…` · 카드 2장 · 메타바 「기간: {from} ~ {to}」 |
| AC-17 | Playwright | M375 · `dongbang.json` · `requested` 건(새 대화 2) · `dispatched` 건(예상 20,000원) | 카드 확인 → 카드 본문 탭 / 「접수」 탭 / `quick-unread-{번호}` 탭 | 카드에 「상세 보기」(`quick-card-detail-{번호}`) **0** · `quick-card-link-{번호}`(접근 이름 「{번호} 상세 보기」) 있음 · 금액 없는 카드에 「예상」「최종」 줄 **0** · `dispatched` 카드에 `20,000원` · 본문 탭 → 상세 · 「접수」(`quick-card-action-{번호}`) → 접수만(이동 없음 · 94 AC-15 유지) · 새 대화 버튼 **≥ 44×44** · 탭 → `/dashboard/quick/chat?request={번호}`(93 AC-16 유지) |
| AC-18 | Playwright | M375 · `dongbang.json` · 오늘 45건(97 AC-05 fixture) | 처음 → 맨 아래로 스크롤 2회 | 처음 카드 **20장** · 페이지 번호 버튼·「페이지당」 **0** · 스크롤 → 40 → 45 · 끝 문구 **「더 이상 요청이 없습니다」** · `quick-card-*` testid **중복 0**(고유 45) · URL에 `page` 없음 · 상태 칩 탭 → 다시 첫 20장부터 |
| AC-19 | Playwright (2 context) | M375 · `admin.json` 내역에서 2페이지(40장)까지 불러 둠 | `user.json` 등록 | 5초 안에 새 카드가 **맨 위** · 카드 중복 0 · 「신규요청」 칩 숫자 +1 (94 AC-05 휴대폰판) |
| AC-20 | Playwright (PC) | D1280 · `dongbang.json` · 오늘 45건 | 페이지네이션 확인 → 「다음 페이지」 | 「총 45건」 · 「1 / 3 페이지」 · 「페이지당」 10/20/50 · 버튼 접근 이름 「첫 페이지」「이전 페이지」「다음 페이지」「마지막 페이지」 · `quick-dashboard` 안 `row(s)`·`Page `·`Rows per page`·`Go to` **0건** · 다음 → URL `page=2` · 행 21~40 (97 AC-05 판정 유지) |
| AC-21 (r2) | Playwright | M375 · `user.json` · 5건 | 맨 아래로 스크롤 | 하단 안내 「운송 완료 후 실제 금액을 확인하고 승인해주세요.」의 bottom ≤ 탭 바 top(가려지지 않음). **r2:** 끝 문구 「더 이상 요청이 없습니다」는 2페이지 이상 불러왔을 때만 나온다(설계 §3.10) → 5건(1페이지)에서는 나오지 않음이 정상이고, 끝 문구 위치는 AC-18(45건)에서 판정 |

### C. 퀵 요청 폼 (9)

| AC | 유형 | Given | When | Then |
|----|------|-------|------|------|
| AC-22 | Playwright | M375(812·667 높이) · `user.json` | 요청 폼 → 위·가운데·맨 아래로 `window.scrollTo` | 문서 `scrollHeight > innerHeight`(**페이지 스크롤**) · `quick-request-order-page` 안에 스스로 스크롤되는 상자 **0**(모든 자손 `scrollHeight - clientHeight ≤ 1` 또는 overflow 비스크롤) · 세 위치 모두 `quick-request-mobile-bar` bottom = `innerHeight`(±1) · 맨 아래에서 「운임 결제」 영역 보임 |
| AC-23 | Playwright | M375·M360 · 빈 기본 폼 / 경유 1개 추가 | 크기 측정 | M375 빈 폼 `quick-request-order-page` 높이 **≤ 2,400px**(지금 2,916) · 출발·도착·경유 1의 주소 칸(`-road-address` 묶음) 폭 **≥ 300px**(M375) · M360·M375에서 담당자·연락처 칸 **같은 y(±4px)** |
| AC-24 | Playwright | M375 · `user.json` | `quick-request-origin-road-address` 탭 → 검색창 닫기 → `-address-search` 탭 → 「주소 직접 입력」 → 「서울 중구 세종대로 110」 입력 | 칸에 `readonly` 속성 · 탭 → `dialog` 「주소 검색」 열림 · 검색창 높이 ≥ 뷰포트의 **90%** · 아이콘 버튼 ≥ 44×44 · 「주소 직접 입력」(`quick-request-address-picker-manual`) → 검색창 닫힘 · 칸 `readonly` 없음·포커스 · 입력값 유지 · D1280 칸은 처음부터 입력 가능(AC-12) |
| AC-25 | Playwright | M375 · `user.json` | 출발 상세주소에 글자 입력 후 Enter → 계속 Enter | 포커스 상세주소 → 담당자 → 연락처 → (다음 글자 칸) 순서 · 미리보기 Dialog **열리지 않음** · 글자 칸 `enterkeyhint="next"`(마지막 칸 `done`) |
| AC-26 | Playwright | M375·D1280 · `user.json` · 나머지 필수 입력 완료 | ① 픽업 「날짜/시간 선택」 = 지금 −1시간 ② 픽업 +2시간·도착 +1시간 ③ 픽업 즉시·도착 예약 −1시간 ④ 픽업 +1시간·도착 +3시간 → 각각 등록 | ① 「픽업 일시는 현재 이후로 선택해 주세요.」 ② 「도착 희망 일시는 픽업 일시 이후로 선택해 주세요.」 ③ 「도착 희망 일시는 현재 이후로 선택해 주세요.」 · ①~③ 미리보기 Dialog **안 열림**·에러 칸 `toBeInViewport` · ④ 미리보기 → 「등록」 → **201** · 픽업 입력칸 `min` = 지금(분 단위, ±1분) · 도착 칸 `min` ≥ 픽업 값 |
| AC-27 | API | `user.json` 세션 / `dongbang.json` 세션 | ① `POST /api/quick-request` 픽업 지금 −1시간 ② 도착 < 픽업 ③ 픽업 지금 −3분(여유 안) ④ dongbang `PATCH /api/quick-request/{번호}` 픽업 지금 −1일 | ① ② **400** 「입력값을 확인해 주세요.」 계열 기존 문구 + `errors`에 `origin.schedule`/`destination.schedule` 경로와 D-11 문구 ③ **201** ④ **200**(수정은 지난 시각 허용) |
| AC-28 (r1) | Playwright | M375·D1280 · 요청 폼 / `dongbang.json` 수정 Sheet(`dispatching` 건) | 「즉시 요청」·「날짜/시간 선택」·「최대한 빠르게」 라디오 카드 | 요청 폼·**수정 Sheet 모두** 카드 안 글자 묶음의 세로 중심과 카드 세로 중심 차이 **≤ 4px**(R6) |
| AC-29 | Playwright | M360·M375 · 빈 폼 / 출발·도착·차량 입력 | 하단 요약바 측정 → `quick-request-mobile-summary-trigger` 탭 | 바 높이 **≤ 76px** · 요약 글자 **한 줄**(`getClientRects().length === 1` · 넘치면 말줄임) · 빈 폼 「차량 미선택」이 한 단어로 보임(줄바꿈 0) · 「등록」 버튼 ≥ 44 · Drawer 요약에 입력값(86 AC-15 유지) |
| AC-30 | Playwright | M375 · `user.json` · 유효 폼 | 하단 「등록」 → 미리보기 「등록」 | **201** · `/dashboard/quick/{번호}` 이동(89 AC-08·86 AC-16 휴대폰 회귀) · 에러 시 첫 에러 칸으로 **페이지가** 스크롤(`toBeInViewport` · 86 AC-17) |

### D. 퀵 대화 (12)

| AC | 유형 | Given | When | Then |
|----|------|-------|------|------|
| AC-31 | Playwright | M375·M360 · `dongbang.json` · 메시지 3개 있는 건 / `user.json` 상세 `?chat=1` | 대화 목록 → 항목 탭 / 상세 「대화」 | 공통 상단바(`banner`) **보이지 않음**(뷰포트 밖이거나 가려짐 — `elementFromPoint` 상단 중앙이 대화 상단바) · 탭 바 0 · `quick-chat-header` 높이 **≤ 60px** · 「뒤로」 ≥ 44×44 · 요청번호 글자 **한 줄**(높이 ≤ 28px) · 상태 배지 보임 · `quick-chat-more` ≥ 44×44 · `quick-chat-messages` 높이 ÷ 뷰포트 높이 **≥ 0.70** |
| AC-32 | Playwright | AC-31 상태 | `quick-chat-more` 탭 → 「참여자 N」 / 다시 열어 「상세 보기」 · 상세 대화(`?chat=1`)에서 「⋯」 | 메뉴 항목 각 ≥ 44 · 「참여자 N」 → 참여자 Drawer(101 AC-18 흐름) · 「상세 보기」 → `/dashboard/quick/{번호}` · 상세 대화 메뉴에는 「상세 보기」 **0** |
| AC-33 | Playwright | M375(터치) · `user.json` 본인 건 대화 / D1280(마우스) | 「첫 줄」 입력 → Enter → 「둘째 줄」 입력 → 「전송」 탭 / D1280에서 Enter | M375: Enter 뒤 `POST …/messages` **0건** · 입력값에 줄바꿈 · `quick-chat-input` `enterkeyhint="enter"` · 「전송」 → **201** · 말풍선 `innerText`에 줄바꿈 · D1280: Enter → 201(93 AC-10) · Shift+Enter 줄바꿈(93 AC-11) 유지 |
| AC-34 | Playwright | M375 · `user.json` · 칩 보이는 대화 / D1280 | 1글자 입력 → 지우기 → 칩 탭 | M375: 입력 → `quick-chat-quick-replies-row` **숨김** → 지우면 다시 보임 → 칩 탭 → 입력칸 채워짐·칩 숨김 · 전송 0(채우기만) · D1280: 입력 중에도 칩 **보임**(100 불변) |
| AC-35 | Playwright | M375 · `dongbang.json` | ① 내역 → 「대화」 탭 → 항목 탭 → `quick-chat-back` → `page.goBack()` ② 목록 → 항목 → `page.goBack()` ③ `page.goto('/dashboard/quick/chat?request={번호}')` → `quick-chat-back` → `page.goBack()` ④ `user.json` 상세 → 「대화」 → `quick-detail-chat-back` → `page.goBack()` | ① 목록(`request` 없음) → goBack 결과가 대화방이 **아님**(`/dashboard/quick`) ② 목록으로 ③ 목록(replace) → goBack 결과가 그 대화방이 **아님** ④ 상세 → goBack 결과 URL에 `chat=1` **없음** |
| AC-36 | Playwright | M375 · `user.json` · 메시지 30개 · 맨 아래 | 입력칸 포커스 → `setViewportSize(375, 476)`(키보드 가정) → 다시 812 | 476에서: 마지막 말풍선 bottom이 `quick-chat-messages` bottom의 **16px 안** · `quick-chat-input` 뷰포트 안 · `scrollingElement.scrollHeight − innerHeight ≤ 1`(이중 스크롤 0) · 812 복귀 후에도 맨 아래 유지 · 위로 스크롤해 둔 상태에서는 강제로 내리지 않음(「새 메시지 N ↓」 93 동작 유지) |
| AC-37 | Playwright | M375 · `dongbang.json` · 대화 8건 이상 | `/dashboard/quick/chat` | 첫 항목 `top ≤ 300px` · 탭 바 위로 완전히 보이는 항목 **≥ 4개** · 검색칸 ≥ 44 · 「전체」「안 읽음」 탭 ≥ 44 · 기간은 「필터」 판(D-7과 같은 방식 · `quick-chat-filter-button`)으로 |
| AC-38 | Playwright | M375·D1280 · `dongbang.json` · fixture: 오늘 16:03:04(KST) 메시지 건 · 올해 다른 날 건 · 작년 건 | 목록 · 대화 | 목록 시각 **「16:03」·「MM-dd」·「yyyy-MM-dd」** · 각 `time`에 `dateTime`(ISO) · 말풍선 시각 **「HH:mm」** · 날짜 구분선 `yyyy-MM-dd` 유지 · 대화 영역 안 「전」「방금」「어제」 **0건** · M375 목록 미리보기 글자 폭 **≥ 180px** |
| AC-39 | 단위 (`node --test`) | — | `formatChatBubbleTimeKo` · `formatChatListTimeKo(date, now)` | KST 기준: UTC 15:30 → 「00:30」 · 같은 KST 날짜 → `HH:mm` · 같은 해 → `MM-dd` · 해 넘김(12-31 23:59 KST ↔ 01-01) → `yyyy-MM-dd` · 잘못된 입력 → `''` |
| AC-40 | grep | 구현 완료 | `grep -rn "formatChatBubbleTimeKo\|formatChatListTimeKo" src` · `grep -rn "from 'date-fns'" src/features/quick-request` · core-conventions | 정의는 `src/lib/format-datetime.ts` 1곳 · 퀵 feature에서 `date-fns` 직접 import **0** · `WakeOne-web/.cursor/rules/core-conventions.mdc`에 「퀵 대화 예외」 문구 1줄 · 상세·이력·알림 컴포넌트는 `formatAbsoluteDateTimeKo` 유지 |
| AC-41 | Playwright | M375·T768 / D1280 | `quick-chat-input` 계산 글자 크기 | M·T **≥ 16px** · D1280 14px(불변) |
| AC-42 | Playwright | M375 · `user.json` · 메시지 1개 | 상세 `?chat=1` · 대화방 | 96 AC-07 판정식 유지: 말풍선 bottom ↔ `quick-chat-messages` bottom **≤ 16px** · 말풍선 bottom < 입력칸 top · 상단 빈 공간 (96 AC-07·AC-10 휴대폰 재측정) |

### E. 퀵 상세 (9)

| AC | 유형 | Given | When | Then |
|----|------|-------|------|------|
| AC-43 | Playwright | M375 · 문구표 6상태 × (요청자 / 동방) fixture | 상세 | `quick-detail-status-summary` 글자 = 문구표 **그대로** · `top ≤ 200px` |
| AC-44 | Playwright | M375 · `dispatched` 건 | 스테퍼 | 신규요청·접수·배차완료 단계 `time` **보임** · 글자 = `yyyy-MM-dd (EEE) HH:mm:ss` 전체 · 각 `time` 높이 ≤ 2줄(≤ 34px) · 스테퍼 `scrollWidth ≤ clientWidth` |
| AC-45 | Playwright | M375·M360 · `user.json` · `dispatched` 건(기사 홍길동 · `21마 6543` · `01012345678` · 예상 20,000원) | 스크롤 없이 상세 | `quick-detail-driver-card`와 `quick-detail-section-amount`가 **첫 화면에 전부** 보임(bottom ≤ 하단 바 top) · `quick-detail-driver-phone` = `a[href="tel:01012345678"]` · 글자에 `010-1234-5678` · 높이 ≥ 44 · 폭 ≥ 120 · `21마 6543` 보임 |
| AC-46 | Playwright | M375 · `user.json` | 상세(이력 접힘) | 본문 안에서 요청 시각 전체 문자열이 보이는 곳 **1곳**(스테퍼) · 요청번호 글자 **1곳**(상태 카드 · 상단바 제외) |
| AC-47 | Playwright | M375 / D1280 · 승인까지 끝난 건 | 「처리 이력」 → 「전체 보기」 | M375: 처음엔 최신 1줄만 · 「전체 보기」 ≥ 44 · `aria-expanded=false` → 탭 → 전체(최신 위 · 94 AC-18 순서) · `aria-expanded=true` · D1280: 처음부터 전체(불변) |
| AC-48 | Playwright | M360·M375 · ① admin `dispatched`(최종금액 없음) ② admin `requested` ③ dongbang `dispatching` | 하단 바 측정 → 「⋯」 탭 | 바에 정확히 3개: 주 버튼(①「최종금액 입력」②「접수」③「배차완료」) · `quick-detail-chat-button` · `quick-detail-more` · 서로 **겹침 0** · 각 ≥ 44×44 · 모두 뷰포트 안 · `quick-detail-edit`·`quick-detail-cancel` 메뉴 열기 전 **안 보임** → 메뉴 항목 각 ≥ 44 · 「요청 취소」 빨강(destructive 토큰) |
| AC-49 | Playwright | M375 · `user.json` · 본인 `requested` 건 | 하단 바 → 「⋯」 → 「요청 취소」 → AlertModal 「확인」 | 바 = 「대화」 + 「⋯」 · AlertModal 제목 **「퀵 요청을 취소할까요?」** · 확인 → 상태 「취소」 · 상태 문구 「취소된 요청입니다.」 (89 AC-23 휴대폰판) |
| AC-50 | Playwright | M375 · `user.json` · `approved` 건 | 상세 | `quick-detail-actions` **0** · `quick-detail-chat-button` 보임 · ≥ 44×44 · 오른쪽 아래(right ≥ 뷰포트 폭 − 24) · 탭 → `?chat=1` |
| AC-51 | Playwright | M375 · `logistics.json` 타인 건 / `user2.json` 초대 참여자 | 상세 | 주 버튼 0 · 「⋯」 0 (수정·취소 권한 없음) · 「대화」만(떠 있는 버튼) · 101 AC-03 「액션바 버튼 0」 휴대폰판 |

### F. 활동 로그·품질 (4)

| AC | 유형 | Given | When | Then |
|----|------|-------|------|------|
| AC-52 | Playwright·API | AC-27 ①(400) · AC-49(취소 200) 이후 | `/dashboard/logs` · `GET /api/activity-logs` | 「퀵 요청 등록」 **실패(400)** 행 · metadata `error_code='validation'`·`validation_errors`에 schedule 경로 · 「퀵 요청 취소」 성공 행 · 신규 action **0** |
| AC-53 | grep | 구현 완료 | `git diff --stat -- src/components/ui` · `grep -rn "window.confirm" src` · 86 AC-20 패턴(`#hex`·`kq-`·`bg-white`·`text-black`·`rounded-[`·`shadow-[`)을 신규·수정 퀵 파일에 | ui 변경 **0** · `window.confirm` **0** · 패턴 **0** |
| AC-54 | 수동 QA | 아이폰(설치 앱 + 사파리) · 안드로이드(설치 앱 + 크롬) | §수동 QA 9항목 | 사용자 확인 · 결과를 수정 이력에 기록(verifier는 목록 전달까지) |
| AC-55 | CLI | — | `npx tsc --noEmit` · `npm run lint:strict` · `npm run build` · `node --test src/lib/__tests__/format-datetime-chat.test.mjs` 외 기존 단위 · `npx playwright test e2e/quick-mobile e2e/quick-request e2e/quick-workflow e2e/quick-chat e2e/quick-round2 e2e/quick-info` · react-doctor · `npm run e2e:cleanup` | 모두 통과 · cleanup remaining 0 · 기존 spec은 §기존 spec 판정 변경 표대로 고친 뒤 green |

**AC 총 55개**: A 12 · B 9 · C 9 · D 12 · E 9 · F 4. 유형은 Playwright 48(AC-04 DOM 판정 포함) · API 1(AC-27) · Playwright+API 1(AC-52) · 단위 1(AC-39) · grep 2(AC-40·53) · 수동 QA 1(AC-54) · CLI 1(AC-55).

### 수동 QA (AC-54 · 실기기 5분)

| # | 기기·환경 | 확인 |
|---|-----------|------|
| Q-1 | 아이폰 설치 앱 | 퀵 내역 하단 탭이 **홈 막대에 겹치지 않음** · 요청 폼 「등록」 바·상세 하단 바도 동일 |
| Q-2 | 아이폰 설치 앱 | 상세·요청 폼·대화방 어디서든 화면 안 「뒤로」로 돌아갈 수 있음(브라우저 뒤로 없음) |
| Q-3 | 아이폰 설치 앱·사파리 | 대화방에서 키보드가 올라와도 최신 메시지가 입력창 바로 위 · 화면이 위아래로 이중으로 밀리지 않음 · 키보드에서 「엔터」가 줄바꿈 |
| Q-4 | 아이폰 사파리 | 요청 폼 주소 칸 탭 → 바로 주소 검색 · 검색어 입력칸을 한 번 더 눌러야 하는지 기록(Daum iframe 포커스 제약 · R3) |
| Q-5 | 안드로이드 크롬·설치 앱 | 폰 뒤로가기: 대화방 → 목록 → 내역 순서 · 닫은 대화가 다시 열리지 않음 |
| Q-6 | 공통 | 대화 첨부(사진) 선택·전송 · 「⋯」 → 참여자 |
| Q-7 | 아이폰 가로 화면 | 상단바·본문이 노치에 가리지 않음(`viewport-fit=cover` · D-3) |
| Q-8 | 공통 | 상세 「전화 걸기」 → 전화 앱 열림 |
| Q-9 | 공통 | 내역 아래로 내리면 20건씩 이어 붙음 · 끝 문구 |

---

## 범위 (In / Out)

### In
1. **공통 틀**: `PageContainer` prop(lg 미만 헤더 숨김 · 예: `mobileHeader='hidden'`) · 퀵 breadcrumb 한국어(`use-breadcrumbs`) · 상단바 「뒤로」(퀵 하위 화면 · lg 미만) · 휴대폰 ⓘ(본문 첫 줄) · 퀵 하단 탭(`src/app/dashboard/quick/layout.tsx` 신규 또는 동등 위치) · 상단바 버튼 44px(md 미만 · 앱 전체) · `viewportFit: 'cover'` + body 좌우 safe-area · 앱 하단 고정 요소 점검
2. **내역**: 상태 칩 줄(같은 컴포넌트 반응형) · 검색 + 「필터」 판(기간·상태·달력 44px) · 카드 다이어트(stretched link · 금액 조건부 · 새 대화 44px) · 768 2열 · 휴대폰 무한 추가 로드 · PC 퀵 전용 한국어 페이지네이션 · 탭 바 여백
3. **요청 폼**: lg 미만 페이지 스크롤(`quick/request/layout.tsx`) · 주소 칸 readonly 탭=검색 + 「주소 직접 입력」 · 담당자/연락처 한 줄 · 경유 들여쓰기 · 차량 타일 축소 · `enterKeyHint`/Enter 다음 칸 · 요약바 1줄 · 라디오 카드 가운데 · 날짜 `min` + 등록 전용 검사(화면·서버)
4. **대화**: lg 미만 전체 화면 대화방·상세 대화 · 한 줄 상단바 + 「⋯」 · 목록 머리 압축 + 「필터」 판 · 터치 Enter 줄바꿈 · 입력 중 칩 숨김 · 뒤로 기록 정리 · 키보드 맨 아래 유지·이중 스크롤 제거 · lg 미만 16px · 짧은 시각 함수 2개(`@/lib/format-datetime`) + 단위 테스트 · core-conventions 예외 1줄
5. **상세**: lg 미만 순서 재배치 · 상태 문장(문구표) · 스테퍼 시각 표시 · 기사 카드 · 반복 제거 · 이력 접기 · 하단 바 주 버튼 + 대화 + ⋯ · 할 일 없을 때 떠 있는 「대화」
6. **E2E**: 신규 `e2e/quick-mobile/106-*.spec.ts`(공통·내역·요청·대화·상세·PC 회귀) · 공용 헬퍼(뷰포트 상수·44px 스캔·가로 스크롤) · 기존 spec 교체(§표) · `e2e/quick-request/helpers.ts` `fillLocationByPrefix` readonly 대응
7. **문서**: README 106 등록 · 86/89/90/93/94/96/97/100/101 수정 이력 1행(planner 완료) · core-conventions 「퀵 대화 예외」(FE 단계)

### Out
| 항목 | 이유 |
|------|------|
| 퀵이 아닌 메뉴의 화면 구조·breadcrumb(「Dashboard」 등) 한국어화 | D-1 · 후속 [TBD] |
| ui `DataTablePagination` 한국어화(앱 전체) | ui 직접 수정 금지 · 퀵만 feature 컴포넌트로 교체 · 앱 전체는 후속 [TBD] |
| 요청 폼 단계형(wizard) | Q4 A · 83 폐기 유지 |
| iOS 설치 배너 변경 | D-19 |
| 목록·대화 API·DB 변경 | 정찰 F-6 · BE 변경 없음 |
| 새 알림·이메일 | 이메일 정책 · 해당 없음 |
| 상세 요청자=출발 담당자 병합 표시 | designer 재량(AC 없음) |
| 다크·테마 10종 육안 QA | 86 AC-23 범위 유지 · 자동 스모크는 AC-10(3테마) |
| Main DB · git commit/PR | 파이프라인 밖 |

---

## UI 요구사항 (designer 지시)

| # | 화면 | 요구 |
|---|------|------|
| U-1 | 공통 | lg 미만: 큰 제목·설명·헤더 액션 숨김. 본문 위 여백 최소. 상단바 = [사이드바 44][뒤로 44(하위 화면)][화면 이름(breadcrumb 마지막 항목만 · truncate)] … [테마 모드][알림] — **r1:** 상단바 44px·검색 숨김·테마 프리셋 Select 숨김은 **lg 미만**(앱 전체 · 768~1023 포함). 하단 탭 = 아이콘 + 글자 3칸 균등, 현재 탭 강조(primary 토큰), 「대화」 배지(99+ · 사이드바와 같은 톤), safe-area 아래 여백 |
| U-2 | ⓘ | 내역 메타바 오른쪽 / 상세 상태 카드 오른쪽 위 / 대화 목록 머리 오른쪽 · `InfoButton` 재사용(`aria-label` 「퀵 권한 안내 보기」 · `size-11`) |
| U-3 | 내역 | 순서: 메타바(기간 라벨 · 새로고침 44 · ⓘ — 「갱신 {시각}」은 sm 미만에서 숨겨도 됨) → 상태 칩 줄 → [검색][필터(배지)] → 카드 목록 → 끝 문구 → 하단 안내. 칩: 점 색 + 「라벨 숫자」 · 선택 강조 89 규칙 |
| U-4 | 필터 판 | vaul Drawer(아래에서) · 제목 「필터」 · 섹션 「기간」(5개 큰 선택 + 직접 선택 → 달력 `[--cell-size:2.75rem]`) · 「상태」(전체 + 5종 · 각 44) · 아래 고정 「초기화」·「닫기」(safe-area) · Sheet 모바일 CTA 규칙(core-conventions) |
| U-5 | 카드 | 1줄 [요청번호 링크(굵게) · 참여 배지][상태 배지] / 2줄 경로 / 3줄 muted 「{전체 시각} · {요청자} · {물품} · {차량}」(넘치면 2줄 말줄임) / 금액 줄(있을 때) / 아래 [업무 버튼(넓게)][새 대화 N(44)] · 카드 패딩 12~16 |
| U-6 | 요청 폼 | 주소 칸: 읽기 전용 필드 모양(placeholder 「주소 검색」 · 오른쪽 돋보기 44) · 주소 검색 Dialog는 lg 미만 거의 전체 높이 · 하단 「주소 직접 입력」 텍스트 버튼(44). 경유 타임라인 점은 왼쪽 여백 안쪽으로. 차량 타일 3열 유지·이미지 축소 또는 가로 스크롤(designer 결정 · AC-23 높이 기준) |
| U-7 | 대화방 | 한 줄 상단바(뒤로 · 번호+상태(+경로 1줄) · ⋯) · 메시지 영역 · 「입력 중…」 · composer(칩 줄 · 첨부 · 입력 · 전송). 「⋯」은 lg 미만 Drawer 또는 DropdownMenu(44px 항목) |
| U-8 | 대화 목록 | 머리 1줄(「대화 N건 · 안 읽은 M」 + 실시간 배지 + ⓘ) · 검색 + 필터 · 탭 · 항목(아바타 · 번호·요청자 · 짧은 시각 · 경로 · 미리보기 · 안 읽은 수) |
| U-9 | 상세 | 상태 카드(번호·배지·ⓘ / 상태 문장 / 스테퍼) → 기사 카드(이름 · 등록번호 · 「전화 걸기 010-…」 primary 큰 버튼) → 금액 → 경로 → 물품 → 요청 정보 → 처리 이력(접힘). 하단 바 3칸. 떠 있는 「대화」 56px |
| U-10 | 테마 | 시맨틱 토큰·테마 radius/shadow만(86 규칙) · `cn()` · `Icons.*` · ui 수정 금지 |

---

## API / DB 요구사항

- **DB:** 변경 없음.
- **`POST /api/quick-request`**: `quickRequestCreateBodySchema`에 D-11 검사를 `superRefine`으로 추가(서버 시각 기준 · 5분 여유). 실패는 **기존 400 validation 분기**(`zodIssuesToValidationErrors` · `logger.respond` · 로그 metadata `validation_errors`) 그대로. 응답 문구·형식 불변.
- **공용 함수**: `src/features/quick-request/schemas/quick-request-schedule-rules.ts`(신규 예시) `refineQuickRequestScheduleOrder(data, ctx, { now, graceMs })` — 서버(등록 body · `datetimeIso`)와 FE 폼(`scheduledDatetime` local → ISO)이 같은 규칙·문구를 쓴다. `refineQuickRequestForm`(요청·수정 공용)에는 **넣지 않는다**.
- **PATCH·수정 Sheet**: 변경 없음(지난 시각 허용 · AC-27 ④).
- **목록 API**: 변경 없음. 근거: 휴대폰 무한 추가 로드는 기존 `GET /api/quick-request?page&perPage=20`을 `useInfiniteQuery`(`getNextPageParam = page*limit < total ? page+1 : undefined`)로 부른다(정찰 F-6).
- **backend-dev 범위**: 위 등록 검사 1건 + 단위 테스트(`node --test` · 과거·순서·여유·수정 무관). 그 밖 Route·SQL 없음.

---

## 활동 감사 로그 (기록 연동)

> `core-conventions.mdc` §활동 감사 로그 · [plan 08](./08_activity-audit-log-plan.md)

| Route | action | 이번 변경 | return 분기 |
|---|---|---|---|
| `POST /api/quick-request` | `quick_request.create` | 400 validation 사유에 날짜 검사 추가(새 분기 아님) | 201 · 400 · 401/403 · 500 — **전 분기 기존 로그 유지** |
| `POST …/cancel` | `quick_request.cancel` | 버튼 위치만 「⋯」 안으로 | 기존 유지 |
| 그 밖의 퀵 CUD | 기존 | 변경 없음 | 기존 유지 |

- 신규 action·label **0**. 검증: **AC-52**(400 행 + 취소 행).
- 삭제 UI: 없음. 요청 취소(상태 변경)는 기존 `AlertModal` 유지(AC-49) · `window.confirm` 0(AC-53).

---

## 영향 파일 & 패턴

| 팀 | 파일 |
|---|---|
| 공통 FE | `src/components/layout/page-container.tsx`(prop) · `src/components/layout/header.tsx`(버튼 className · 뒤로 슬롯) · `src/components/themes/theme-mode-toggle.tsx` · `src/features/notifications/components/notification-center.tsx`(트리거 className) · `src/hooks/use-breadcrumbs.tsx` · `src/app/layout.tsx`(viewport · body) · `src/app/dashboard/quick/layout.tsx`(신규 · 탭 바) · `src/features/quick-request/components/mobile/{quick-mobile-tabbar,quick-mobile-back-button,use-quick-back}.tsx`(신규 예시) |
| 내역 FE | `components/dashboard/{quick-dashboard-page,quick-dashboard-body,quick-status-cards,quick-dashboard-toolbar,quick-dashboard-meta-bar,quick-range-filter,quick-request-mobile-card,quick-dashboard-data-table}.tsx` · 신규 `quick-dashboard-filter-sheet.tsx`·`quick-dashboard-pagination.tsx`·`quick-dashboard-mobile-list.tsx` · `api/queries.ts`(무한 목록 옵션 · `lists()` 키 아래) · `app/dashboard/quick/page.tsx` |
| 요청 FE | `app/dashboard/quick/request/{layout,page}.tsx` · `components/{quick-request-order-page,quick-request-location-section,quick-request-field-controls,quick-request-address-section,quick-request-address-picker-dialog,quick-request-daum-postcode-embed,quick-request-vehicle-section,quick-request-schedule-section,quick-request-mobile-summary-bar}.tsx` · `schemas/quick-request-form.ts`(등록 전용 refine 연결) |
| 대화 FE | `components/chat/{quick-chat-messenger,quick-chat-header,quick-chat-conversation-list,quick-chat-conversation-item,quick-chat-composer,quick-request-conversation,quick-chat-message-list,quick-chat-bubble,quick-chat-system-line,quick-chat-quick-replies,quick-chat-participants-button,use-quick-chat-params,use-visual-viewport-height,quick-chat-constants}.ts(x)` · `components/detail/quick-request-detail-chat-view.tsx` · `src/lib/format-datetime.ts`(함수 2) · `src/lib/__tests__/format-datetime-chat.test.mjs`(신규) · `WakeOne-web/.cursor/rules/core-conventions.mdc`(1줄) |
| 상세 FE | `components/detail/{quick-request-detail-page,quick-request-detail-hero,quick-request-stepper,quick-request-action-bar,quick-request-chat-launcher,quick-request-history,quick-detail-section,quick-request-phone-link}.tsx` · 신규 `quick-request-status-summary.tsx`·`quick-request-driver-card.tsx` · `app/dashboard/quick/[requestNo]/page.tsx` |
| BE | `schemas/quick-request-workflow.ts`(`quickRequestCreateBodySchema`) · `schemas/quick-request-schedule-rules.ts`(신규) · `schemas/__tests__/quick-request-schedule-rules.test.mjs`(신규) |
| verifier | 신규 `e2e/quick-mobile/{helpers.ts,106-shell,106-dashboard,106-request,106-chat,106-detail,106-pc-regression}.spec.ts` · 기존 spec 교체(§표) · `e2e/quick-request/helpers.ts` |

**따를 패턴:** 69(lg 미만 분기 + PC 회귀 AC) · 86(테마 토큰·testid 분리 · 375 테마 3종) · 97(`quick-infinite-sentinel`·`useInfiniteQuery`·nuqs) · 93(`useMatchMedia`·visualViewport) · 14(AlertModal) · core-conventions §Sheet 폼 모바일 CTA · `cn()`·`Icons.*`·로딩 UI 규칙.

### Supersede 표 (조항 단위)

| Plan | 조항 / AC | 바뀌는 내용 |
|------|-----------|-------------|
| 86 | D1 · In#1 · Shell | lg 미만 안쪽 스크롤 → 페이지 스크롤 · 큰 제목 숨김(PC 불변) |
| 86 | UI 「주소 입력 InputGroup + 주소 검색 addon」 | lg 미만 readonly 탭=검색 + 아이콘 + 「주소 직접 입력」 |
| 89 | U-2(제목 오른쪽 「퀵 요청하기」 · 카드 4개 + 「취소 N」) · U-3 모바일 카드 · U-4 상세 섹션 순서·하단 액션바 · AC-36 판정 | lg 미만 탭 바 · 칩 줄 · 새 카드 · 상세 순서·3칸 바 (PC 불변) |
| 90 | UI-1 ⓘ 위치 | lg 미만 본문 첫 줄 |
| 93 | U-1 · AC-03(「목록」 버튼 위치) · U-6 Enter(터치) · U-4·AC-10 말풍선 시각 · U-2 목록 시각 · U-8 상세 모바일 대화 | 전체 화면 대화방 · 터치 Enter 줄바꿈 · 짧은 시각 |
| 94 | D-7·AC-15 「상세 보기」 링크 유지 | 휴대폰 카드 「상세 보기」 삭제 → `quick-card-link-{번호}` |
| 96 | AC-07·AC-10(375 위치) | 판정식 유지 · 새 레이아웃에서 재측정(AC-42) |
| 97 | D-6·AC-08 목록 시각 전체 · D-7/U-1 휴대폰 툴바 · U-2/AC-05 페이지네이션 문구·휴대폰 넘김 | 짧은 시각 · 「필터」 판 · 휴대폰 무한 · PC 한국어 |
| 100 | D-8 칩 줄(휴대폰) | lg 미만 입력 중 숨김 |
| 101 | U-1 「참여자 N」 헤더 버튼(휴대폰) | 「⋯」 안 |

### 기존 e2e spec 판정 변경 표 (verifier 교체 목록)

| spec | 현재 판정 | 바꿀 판정 |
|------|-----------|-----------|
| `e2e/quick-round2/97-period.spec.ts` AC-05 | `Page 1 of 3` · `Go to next page` | 「1 / 3 페이지」 · 「다음 페이지」(AC-20) |
| `e2e/quick-round2/97-period.spec.ts` AC-08 | 대화 항목 시각 `yyyy-MM-dd (EEE) HH:mm:ss` 전체 | D-14 짧은 시각(AC-38) · 잘림 0·말줄임 0 판정 유지 |
| `e2e/quick-round2/94-small-fixes.spec.ts` AC-15 | 카드 `quick-card-detail-{no}` 보임·href | `quick-card-link-{no}` 보임·href · 「상세 보기」 0(AC-17) |
| `e2e/quick-workflow/dashboard.spec.ts` (`quick-card-detail-*` · 89 AC-36 375) | 카드 「상세 보기」 클릭 · 카드 리스트 | `quick-card-link-*` 또는 카드 본문 탭 · 칩 줄(같은 testid) |
| `e2e/quick-chat/01-messenger.spec.ts` AC-02 | 항목 「절대 시각」 | 짧은 시각 |
| `e2e/quick-chat/03-send-detail.spec.ts` AC-10 · AC-35 | 말풍선 「절대 시각」 | 말풍선 `HH:mm` · 묶음 규칙(시각 마지막에만) 유지 |
| `e2e/quick-chat/08-mobile.spec.ts` AC-03 · AC-04 | 375 목록↔대화 · 「목록」 버튼 · 상세 「대화」 | 탭 바·전체 화면 상단바 · `quick-chat-back`(이름 「목록」 유지) · 뒤로 기록(AC-35) |
| `e2e/quick-round2/101-participants-mobile.spec.ts` AC-18 | 375 헤더 「참여자 N」 바로 탭 | 「⋯」 → 「참여자 N」 → Drawer |
| `e2e/quick-round2/96-preview-chat-align.spec.ts` AC-07(375)·AC-10 | 375 상세 전체 뷰 | 새 전체 화면에서 같은 판정식(AC-42) |
| `e2e/quick-round2/100-ai-suggest*.spec.ts` AC-14(375) | 375 칩 줄 항상 | 빈 입력일 때 판정 · 입력 중 숨김(AC-34) |
| `e2e/quick-request/responsive.spec.ts` AC-14~18 | 375 안쪽 스크롤·`-address-search` 버튼·요약바 | 페이지 스크롤 · 주소 칸 readonly · 아이콘 버튼 44 · 요약바 1줄 |
| `e2e/quick-request/helpers.ts` `fillLocationByPrefix` | `-road-address`에 `.fill()` | 칸이 `readonly`면 탭 → 「주소 직접 입력」 → `.fill()` (lg 이상은 그대로) |
| `e2e/quick-workflow/requester.spec.ts` · `realtime.spec.ts` · `vendor-flow.spec.ts` · `94-notify-unlock.spec.ts` (`quick-detail-cancel`/`-edit`) | 바로 보임·클릭 | **lg 미만 뷰포트에서 도는 경우만** 「⋯」 열고 판정 · `toHaveCount(0)` 판정은 메뉴를 연 뒤 해야 거짓 통과 방지 |
| `e2e/quick-request/order-page.spec.ts` AC-12 | 고정 `2026-12-25T14:30` | 「지금 + 1일」 동적 값 권장(2026-12-25 이후 과거가 되어 AC-26 규칙과 충돌 방지) |
| `e2e/quick-info/info-panel.spec.ts` AC-10 2개 (r2 추가) | 390 모바일(대시보드·상세) — 큰 제목 옆 ⓘ | ⓘ를 **본문 첫 줄** `quick-mobile-info-button` 기준으로 찾음(D-2 · AC-02) · 패널 내용 판정 불변 |
| `e2e/quick-round2/101-participants.spec.ts` AC-02 (r2 추가) | 시스템 줄 「{이름}님이 참여했습니다 · {절대 시각}」 | 시스템 줄 시각 **「· HH:mm」**(D-14 짧은 시각) |

---

## 리스크 & 완화 (프리모텀)

| 등급 | 리스크 | 완화 |
|---|---|---|
| HIGH | 휴대폰을 고치다 **PC 화면이 바뀜**(공용 컴포넌트·`PageContainer`·Header) | 모든 휴대폰 변경은 `lg:` 경계로 · PC 회귀 AC-12·20·47 · D1024·D1280 두 폭 · 기존 PC spec 전체 회귀(AC-55) |
| HIGH | 아이폰 키보드·standalone 동작이 자동 테스트와 다름(visualViewport·고정 오버레이) | AC-36 에뮬레이션 + 수동 QA Q-1~Q-5 · 대화방 구현 방식(오버레이 vs 상단바 숨김)은 키보드 기준으로 선택 · 실패 시 「상단바 숨김」 방식 우선 |
| HIGH | 주소 칸 readonly로 e2e 수십 개 깨짐(F-8) | 「주소 직접 입력」 탈출구 + `fillLocationByPrefix` 1곳 수정 · lg 이상 불변 |
| MED | 무한 추가 로드 + Realtime invalidate로 중복·건너뜀(offset 이동) | `id` 기준 중복 제거 · 새 건은 첫 페이지 refetch로 맨 위 · AC-18·19 |
| MED | 상태 칩·카드가 PC/휴대폰 DOM 두 벌이면 testid 중복(strict mode) | 같은 컴포넌트 CSS 배치 전환(D-6) · 목록은 `useMatchMedia`로 한 벌만 렌더(hydration 뒤 조회라 SSR 불일치 없음) |
| MED | 「⋯」 안으로 옮긴 `quick-detail-cancel`·`-edit` 때문에 기존 spec 거짓 통과·실패 | §spec 표에 명시 · 메뉴 연 뒤 판정 |
| MED | `viewport-fit=cover`로 앱 다른 화면 하단 요소가 홈 막대에 닿음 | 정찰 F-12(ui 밖 1곳만) · body 좌우 safe-area · 수동 QA Q-1·Q-7 · 문제 화면은 이번 plan에서 패딩 추가 |
| MED | 날짜 검사가 동방 수정·기존 데이터 처리를 막음 | 등록 전용 refine(F-9) · AC-27 ④ PATCH 200 · 서버 5분 여유 |
| MED | 짧은 시각 예외가 다른 화면으로 번짐 | 함수 2개를 `@/lib/format-datetime` 한 곳 · core-conventions 예외 문구에 「퀵 대화 말풍선·시스템 줄·목록만」 명시 · AC-40 grep |
| LOW | 탭 바·하단 바가 겹쳐 버튼을 가림 | 하위 화면 탭 숨김(D-4) · 본문 아래 여백 · AC-21·45 |
| LOW | 범위가 커서 한 번에 green이 어려움 | 화면별 체크포인트 4개 · 같은 AC 3회 실패 시 root 보고 |

**롤백:** Step 0 백업 tar로 퀵·공통 파일 복원(아래). 서버 변경은 스키마 1곳이라 되돌리기 쉽다. DB 변경 없음.

---

## Battle Plan (단계)

| # | 단계 | 산출물 | 확신도 | 의존 |
|---|---|---|---|---|
| 0 | **root: Step 0 백업** (아래 명령) | `../quick-mobile-baseline-plan106.tar.gz` | HIGH | — |
| 1 | **designer**: U-1~U-10 · 탭 바·상단바·「⋯」·필터 판·카드·기사 카드·상태 문장 배치 · 대화방 전체 화면 방식 결정(키보드 기준) · 44px·첫 화면 수치 확인 | 설계 메모 | MED | 0 |
| 2 | **backend-dev**: `quick-request-schedule-rules.ts` + 등록 body refine + 단위 테스트 → API AC-27 curl 확인 | 서버 검사 | HIGH | 0 |
| 3 | **FE-공통**: `PageContainer` prop · breadcrumb · 상단바 44px·뒤로 · viewport · 퀵 layout 탭 바 · 뒤로 훅 → **Checkpoint 1**(AC-01~08 · D1280 회귀 AC-12 일부) | 껍데기 | MED | 1 |
| 4 | **FE-내역**: 칩 줄 · 필터 판 · 카드 · 무한 추가 로드 · PC 페이지네이션 · 768 2열 → **Checkpoint 2**(AC-13~21) | 내역 | MED | 3 |
| 5 | **FE-요청**: 페이지 스크롤 · 주소 칸 · 한 줄 · Enter 다음 · 요약바 · 라디오 · 날짜 `min`·검사 연결 → **Checkpoint 3**(AC-22~30) | 요청 폼 | MED | 2·3 |
| 6 | **FE-대화**: 전체 화면 · 상단바·⋯ · 목록 압축 · Enter · 칩 · 뒤로 · 키보드 · 16px · 시각 함수·테스트·규칙 1줄 → **Checkpoint 4**(AC-31~42) | 대화 | LOW~MED | 3 |
| 7 | **FE-상세**: 순서 · 상태 문장 · 스테퍼 · 기사 카드 · 반복 제거 · 이력 접기 · 하단 바·⋯·떠 있는 대화 | 상세 | MED | 3 |
| 8 | **verifier**: 신규 `e2e/quick-mobile/*` + §spec 교체 + 회귀 + CLI + 수동 QA 목록 전달 | green 보고 | MED | 2~7 |

**Step 0 백업 (root 실행):**

```bash
cd /Users/hoon/Desktop/Wake_Auto/WakeOne-web
tar -czf ../quick-mobile-baseline-plan106.tar.gz \
  src/features/quick-request src/app/dashboard/quick src/app/api/quick-request \
  src/components/layout/page-container.tsx src/components/layout/header.tsx \
  src/components/themes/theme-mode-toggle.tsx src/features/notifications/components/notification-center.tsx \
  src/hooks/use-breadcrumbs.tsx src/app/layout.tsx src/lib/format-datetime.ts \
  .cursor/rules/core-conventions.mdc \
  e2e/quick-request e2e/quick-workflow e2e/quick-chat e2e/quick-round2 e2e/quick-info
tar -tzf ../quick-mobile-baseline-plan106.tar.gz | head
```

**ROLLBACK:** 신규 파일(`src/app/dashboard/quick/layout.tsx` · `components/mobile/**` · 신규 dashboard/detail 컴포넌트 · `e2e/quick-mobile/**` · schedule-rules)을 지우고 `tar -xzf ../quick-mobile-baseline-plan106.tar.gz`로 덮어쓴다. git 브랜치(`feat/quick-round2-2`)에 다른 작업 변경이 섞여 있으므로 `git checkout`으로 되돌리지 않는다.

### 추정

- 범위: 신규 약 14파일 · 수정 약 45파일 · e2e 신규 7 + 교체 약 14 → +2,600 / −900줄
- 복잡도: **Complex**
- designer 40~60분 · BE 30~45분 · FE 공통 60~90분 · 내역 90~120분 · 요청 90~120분 · 대화 120~180분 · 상세 90~120분 · verifier 150~240분 → **약 11~16시간**
- 체크포인트: Step 3·4·5·6 끝마다(위 표). 각 체크포인트에서 D1280 회귀 spec을 같이 돌린다.
- 확신도 LOW 단계 1개(6 · 키보드) — 수동 QA로 보완. 여러 단계가 LOW는 아니므로 스파이크 없이 진행.

---

## requirements-pipeline Express (Phase 3)

### 가정

| ID | 가정 | 출처 |
|----|------|------|
| A1 | 휴대폰이 주 사용 기기이며 PC는 현상 유지 | 사용자 답변(Q1 · 「휴대폰 사용이 더 많아서」) |
| A2 | 아이폰·안드로이드, 설치 앱·브라우저 모두 지원 | root 기본값(Q8 a·b 미선택 → 둘 다) |
| A3 | 휴대폰 경계는 lg(1024) — 태블릿 세로도 휴대폰 규칙 | Q1 확인 ② · 86·89 기존 lg 경계 |
| A4 | 목록 API는 페이지 파라미터로 무한 추가 로드가 가능하다 | 정찰 F-6 |
| A5 | 짧은 시각은 상대 시각이 아니므로 「절대 시각」 원칙의 취지(정확성)를 지킨다 | Q6 A · 날짜 구분선 존재 |
| A6 | 등록 날짜 검사는 수정 흐름에 영향이 없어야 한다 | Q4 가 · 정찰 F-9 |
| A7 | 아이폰 키보드·Daum iframe 포커스는 실기기에서만 확정된다 | **[INFERRED]** · 수동 QA Q-3·Q-4 |

### 검증 시나리오

| 시나리오 | 기대 |
|----------|------|
| 휴대폰 내역 첫 화면 | 카드 3장 · 칩 한 줄 · 필터 1버튼(AC-13~15) |
| 내역 끝까지 스크롤 | 20 → 40 → 45 · 끝 문구(AC-18) |
| 요청 폼 작성 | 페이지 스크롤 · 주소 탭=검색 · Enter 다음 칸 · 지난 시각 차단(AC-22~27) |
| 대화방 | 전체 화면 · 70% · 엔터 줄바꿈 · 키보드 맨 아래 · 뒤로 꼬임 없음(AC-31~36) |
| 상세 | 상태 문장 · 기사·금액 첫 화면 · 버튼 겹침 0 · 취소는 ⋯ + 확인창(AC-43~50) |
| PC | 지금과 같음(예외 3건만)(AC-12·20) |

---

## 구현 팀 전달 메모

### designer
- 휴대폰(lg 미만) 4화면 + 공통 틀(상단바·하단 탭·뒤로·ⓘ 위치) 설계. 수치 기준: 첫 카드 top ≤ 320 · 카드 ≤ 128 · 대화 메시지 70% · 상단바 ≤ 60 · 요약바 ≤ 76 · 폼 ≤ 2,400 · 주소 칸 ≥ 300 · 전부 44px.
- 대화방 전체 화면 방식(오버레이 vs 공통 상단바 숨김)을 키보드 동작 기준으로 정해 FE에 넘긴다.
- 상태 문장 문구표·카드 줄 구성·기사 카드·「⋯」 항목 확정. PC는 손대지 않는다.

### backend-dev
- `quick-request-schedule-rules.ts`(과거·순서·5분 여유 · 문구 D-11) → `quickRequestCreateBodySchema` `superRefine` 연결 → 단위 테스트. 기존 400 분기·로그 그대로. PATCH·수정 스키마는 건드리지 않는다.
- 목록·대화 API 변경 없음(근거: 기존 `page` 파라미터로 무한 추가 로드 가능). SQL 없음.

### frontend-dev
- `lg:` 경계 엄수. `PageContainer` prop · breadcrumb · 상단바 44px·뒤로 · viewport · 퀵 layout 탭 바 · 칩·필터 판·카드·무한 목록·PC 페이지네이션 · 요청 폼 페이지 스크롤·주소 readonly·「주소 직접 입력」·Enter 다음·요약바·라디오·날짜 `min`+공용 refine · 대화 전체 화면·⋯·터치 Enter·칩 숨김·뒤로·키보드·16px·짧은 시각 함수 · 상세 순서·상태 문장·스테퍼·기사 카드·이력 접기·하단 3칸·떠 있는 대화.
- ui 폴더 수정 금지(Calendar는 className 변수, InfoButton은 aria-label prop, DataTablePagination은 퀵 전용 컴포넌트로 교체).
- core-conventions에 「퀵 대화 예외」 1줄.

### verifier
- `e2e/quick-mobile/` 신규 spec(AC 1:1) · 공용 헬퍼(뷰포트 상수 · 44px 스캔 · 가로 스크롤) · §spec 표 교체 · `fillLocationByPrefix` readonly 대응.
- 메일 Route 호출 금지 · Main DB 금지 · cleanup 0.
- 수동 QA 9항목(§수동 QA)을 사용자에게 전달.

---

## 열린 질문

| # | 질문 | 기본값 |
|---|------|--------|
| OQ-1 | 대화방 전체 화면 구현을 오버레이로 할지, 공통 상단바를 숨길지 | designer가 키보드 기준으로 결정 · 수정 이력 기록 |
| OQ-2 | 아이폰에서 주소 검색을 열 때 검색칸 자동 포커스가 되는지(Daum iframe) | 수동 QA Q-4 결과로 판단 · 안 되면 「한 번 더 탭」 안내 문구만 |
| OQ-3 | 다른 메뉴 breadcrumb·페이지네이션 한국어화 | 후속 plan [TBD] |
| OQ-4 (r2) | `e2e/quick-round2/100-ai-suggest-off.spec.ts` AC-09 실패 — 실행 중 dev 서버가 시작 시점 `.env`의 AI 켜짐 값을 씀 | 후속 [TBD] · dev 서버 재시작 후 재실행(이번 검증에서는 재시작하지 않음) · plan 106 무관 |
| OQ-5 (r2) | `e2e/quick-request/notes.api.spec.ts` AC-12 실패 — 로그인 안 한 PATCH 401 응답에 `x-request-id` 없음(`src/proxy.ts`) | 후속 [TBD] · [92](./92_quick-web-only-notifications-plan.md) OQ-4와 같은 건 · plan 106 무관 |
| OQ-6 (r2) | e2e cleanup 스크립트가 한 번에 1,000건까지만 조회 → 1회차 166건 남아 exit 1, 2회차 exit 0 | 후속 [TBD] · cleanup 반복 조회(페이지 단위 루프) |

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-10-29 | 최초 작성 · Approved(/root 단일 게이트 · deep-interview 답 「1 전체 다 고쳐 / 다른 건 전부 추천으로 / 모바일 UI·UX가 굉장히 좋아야 함」). lg 미만 휴대폰 규칙 · 퀵 4화면 큰 제목 숨김·한국어 상단바·ⓘ 본문 첫 줄 · 상단바 44px·`viewport-fit=cover`(앱 전체) · 퀵 하단 탭(동방 2개)·뒤로 · 내역 칩 줄·필터 판·카드 다이어트·768 2열·휴대폰 무한 추가 로드·PC 한국어 페이지네이션 · 요청 폼 페이지 스크롤·주소 탭=검색·Enter 다음·요약바 1줄·라디오 가운데·등록 날짜 검사(화면+서버 · 수정 허용) · 대화 전체 화면·한 줄 상단바·⋯·터치 Enter 줄바꿈·입력 중 칩 숨김·뒤로 기록·키보드 맨 아래·짧은 시각(규칙 예외) · 상세 상태 문장·스테퍼 시각·기사 카드·이력 접기·하단 주 버튼+대화+⋯ · SQL 없음 · 신규 log action 없음 · AC 55 · 86/89/90/93/94/96/97/100/101 일부 supersede | planner |
| 2026-10-29 | **r1 (root 요청 · 구현 반영 사후 정정 · Status Approved 유지)**: ① D-3·U-1·AC-03 상단바 버튼 44px 기준 「md(768) 미만」 → **「lg(1024) 미만」**(Q1 확인 ② 태블릿 768~1023 = 휴대폰 규칙 · lg 이상 28/32/32 그대로) ② 같은 근거로 lg 미만 상단바 검색(「Search... ⌘K」)·테마 프리셋 Select 숨김 · breadcrumb 마지막 항목만 + truncate → T768 사이드바 펼침 때 상단바 가로 넘침(129~169px · plan 이전 문제) 해소, AC-07·AC-10에 「T768 사이드바 펼침(쿠키 `sidebar_state=true`)에서도 가로 스크롤 0」 추가 ③ R6 라디오 카드 세로 가운데를 **수정 Sheet에도** 적용(「전체 다 고쳐」) — X-3·AC-28 반영. AC 개수 55 유지 | planner |
| 2026-10-29 | **r2 (verifier 완료 반영 · Status Completed)**: AC 54 자동 green + AC-54 실기기 수동 QA 9항목 사용자 전달 · 회귀 퀵 6폴더 471건 중 plan 106 무관 2건만 실패(100-ai-suggest-off AC-09 dev 서버 환경 · notes.api AC-12 401 `x-request-id`) · tsc·lint:strict·build 0 · react-doctor 변경분 에러 0(경고 17) · 단위 통과 · cleanup remaining 0(2회차) · 신규 `e2e/quick-mobile/106-{shell,dashboard,request,chat,detail,be-log,static,pc-regression}.spec.ts` + `helpers.ts` · 공용 `e2e/helpers/dev-overlay.ts` · `playwright.config.ts` `chromium-quick-mobile`. 문서 정정: AC-21 끝 문구는 2페이지 이상일 때만(설계 §3.10 · 위치 판정은 AC-18) · §PC 영향 예외 X-4 상대 말풍선 폭 버그 수정(`items-start` · PC 포함) · spec 판정 변경 표에 quick-info AC-10(390 2개 · ⓘ 본문 첫 줄)·101 AC-02(시스템 줄 「· HH:mm」) 2행 추가 · 후속 [TBD] OQ-4~6(ai-suggest-off dev 재시작 · 401 `x-request-id` = 92 OQ-4 · cleanup 1,000건 조회 한계) | verifier · planner |
