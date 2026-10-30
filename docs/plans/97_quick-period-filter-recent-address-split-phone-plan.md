# 퀵 기간 필터·페이지네이션 · 최근 주소 출발/도착 분리 · 전화번호 9~11자리 기획서

> Date: 2026-10-27
> Status: Completed
> Author: planner
> **퀵 2차(94~101) 중 4번째.** 선행: [96](./96_quick-preview-card-chat-bottom-align-plan.md) 완료 후(순서 규칙). [94](./94_quick-realtime-and-small-fixes-plan.md)의 Realtime 훅(`useQuickRealtimeChannel`)·[93](./93_quick-request-chat-plan.md) 대화 목록 API를 전제
> **SQL 예정:** `supabase/sql/95_quick_period_recent_address_phone.sql` (95가 SQL을 만들지 않으면 `94`. backend-dev가 적용 직전 `ls supabase/sql` 최대+1 확정). Dev DB만
> **brief 항목:** 5(기간 필터·페이지네이션·대화 목록 무한스크롤·시각 잘림) · 6(최근 주소 출발/도착 분리 · 상한 없음) · 10(전화번호 9~11자리)
> **Supersedes:** [89](./89_quick-workflow-dongbang-openchat-plan.md) D-14(최근 7일 고정)·AC-33(8일 전 행 미노출)·U-2 「최근 7일 기준」 · [87](./87_quick-request-goods-notes-address-picker-plan.md) D2(10개 상한·dedupe 단일 목록)·AC-17·18(10행·단일 목록) · [93](./93_quick-request-chat-plan.md) U-2 범위(7일 + 안 읽음)·`GET /api/quick-request/conversations` 응답(페이지 없음) · [09](./09_profile-phone-birthday-plan.md)/[30](./30_admin-user-phone-edit-plan.md) 「연락처 11자리」 규칙 · [89](./89_quick-workflow-dongbang-openchat-plan.md) `driver_phone`·`requester_phone` 11자리 CHECK
> **선행:** [08](./08_activity-audit-log-plan.md), [09](./09_profile-phone-birthday-plan.md), [25](./25_activity-logs-ui-improvement-plan.md), [30](./30_admin-user-phone-edit-plan.md), [40](./40_filter-shell-loading-ux-plan.md), [73](./73_benefits-url-filters-plan.md), [87](./87_quick-request-goods-notes-address-picker-plan.md), [89](./89_quick-workflow-dongbang-openchat-plan.md), [93](./93_quick-request-chat-plan.md), [94](./94_quick-realtime-and-small-fixes-plan.md)

## 선행 plan 참조 (Phase 0)

| Plan | Status | 관계 |
|------|--------|------|
| **89** | In Progress | 대시보드 조회 기간을 「최근 7일 고정」에서 **선택 가능(기본 7일)**으로 넓힌다. 메모리 페이지네이션(`listWindowRows` 2,000행 상한)을 **DB 페이지네이션**으로 바꾼다. 카드 숫자는 선택 기간 기준 |
| **93** | Completed | 대화 목록(`listQuickRequestConversations`)은 「7일 + 안 읽음 있는 건, 최대 100」 → **기간 선택 + 커서 무한스크롤 20건**, 안 읽음 있는 건은 기간과 무관하게 **항상 포함**. 사이드바 안 읽은 합계 90일 상한은 유지 |
| **87** | Approved | 최근 주소 10개 상한·단일 목록을 **출발/도착 분리·상한 없음·무한스크롤 10개**로 바꾼다. 기존 행은 **전부 삭제**(사용자 결정 Q3) |
| **09 · 30** | Approved | `src/lib/phone.ts` `PHONE_REGEX` 11자리 → **9~11자리**. 사용자 연락처 입력(users·profile)도 같은 규칙을 따르므로 회귀 범위에 포함 |
| **25 · 40 · 73** | Approved | 페이지 크기 선택(`DataTablePagination` 10/20/50) · filter shell 유지 · nuqs URL 상태 패턴 |
| **94** | Approved | 기간 필터를 바꿔도 Realtime invalidate 키(`lists`·`conversations`)는 동일 |
| **08** | Approved | 신규 CUD Route 없음(최근 주소 기록은 기존 Route · schema만 변경). READ 필터 |

### 정찰로 확인한 사실

| 항목 | 사실 | 근거 |
|------|------|------|
| 목록 API | `GET /api/quick-request?status&search&page&limit` — `listWindowRows`가 7일치(≤2,000행)를 읽고 메모리에서 검색·페이지 | `workflow.server.ts:259~350` |
| URL 상태 | 대시보드 nuqs `page`·`perPage`(기본 20)·`status`·`search`(`use-quick-dashboard-params.ts`) | 정찰 |
| 대화 목록 | `q`·`tab`만 · 최대 100 · `useSuspenseQuery`(무한 아님) | `conversations/route.ts:24~30` · `quick-chat-conversation-list.tsx:40` |
| 시각 잘림 | 항목 1줄이 `flex justify-between` + `<time className='shrink-0 text-[11px]'>`인데 좁은 폭에서 **제목 `truncate`보다 time이 먼저 밀려** 「2026-10…」로 잘림(사용자 보고) | `quick-chat-conversation-item.tsx:53~62` |
| 날짜 범위 UI | `src/components/ui/table/data-table-date-filter.tsx`(react-day-picker `DateRange` + `Calendar` + `Popover`) · `workflow-inbox-filters.tsx`도 같은 조합 | 정찰 |
| 최근 주소 | unique `(user_id, road_address, detail_address)` · RPC upsert + 11번째 이후 prune · GET `limit 10` · 등록 Route가 출발·경유·도착을 한 배열로 기록 | SQL 85 L111~ · `service.server.ts:172~`, `route.ts:139` |
| 전화 규칙 | `PHONE_REGEX=/^\d{11}$/` · `formatPhoneDisplay` 11자리만 하이픈 · 사용처 18파일 · DB CHECK 3곳(`profiles_phone_format`, `quick_requests.requester_phone`, `driver_phone`) + RPC `create_quick_request`가 `~ '^\d{11}$'`로 요청자 연락처 스냅샷 | `src/lib/phone.ts` · SQL 11 L19, SQL 89 L95·110·271 |

---

## 한 줄 요약

퀵 대시보드·내역에 **기간 버튼(7일·30일·90일·전체) + 시작일~종료일 달력**과 **페이지 넘김(20건 기본, 10/20/50)**을 넣고 카드 숫자도 그 기간을 따른다. 「퀵 대화」 목록도 같은 기간 선택에 **무한스크롤(20건)**로 바꾸고, 잘리던 시각을 고친다. 최근 이용 주소는 **출발용·도착용으로 따로 저장·표시**하고(경유 칸은 도착 목록), **상한 없이 10개씩 무한스크롤**한다(기존 저장분은 삭제). 전화번호는 **숫자 9~11자리**를 허용하고 02 지역번호를 바르게 표시한다(공통 규칙이라 사용자·계약서 화면 회귀 포함).

---

## 정책 확정안 (deep-interview Q2·Q3 · brief 5·6·10)

| # | 항목 | 확정 |
|---|------|------|
| D-1 | 기간 파라미터 | nuqs `range` ∈ `7d`(기본) · `30d` · `90d` · `all` · `custom`, `from`·`to`(`yyyy-MM-dd` · `custom`일 때만). KST 기준 **오늘 포함** N일(89 `getQuickDashboardRange` 확장). `custom`은 `from ≤ to`, 상한 없음. 잘못된 값은 기본(7d)으로 정정. 대시보드·내역·대화 목록 **공통** |
| D-2 | 페이지 | `page`(1~) · `perPage` ∈ {10, 20, 50}, 기본 **20**. 기간·상태·검색이 바뀌면 `page=1`. `DataTablePagination`(기존 ui) 사용 |
| D-3 | 서버 페이지네이션 | 메모리 window를 버리고 **DB에서** 기간·상태·검색·권한 필터 + `range(offset, limit)` + `count:'exact'`. 검색은 요청번호·요청자 이름·출발/도착 **도로명**(`ilike`)으로 PostgREST `or()`; 경유지 검색은 SQL RPC `search_quick_requests(...)` **[INFERRED: PostgREST로 jsonb 배열 `ilike`가 어려우면 RPC로 전환 · backend-dev 결정]** |
| D-4 | 카드 숫자 | `GET /api/quick-request/summary?range&from&to` — 선택 기간 기준 5상태 count(검색·상태 필터 무관) |
| D-5 | 대화 목록 | `GET /api/quick-request/conversations?q&tab&range&from&to&cursor&limit=20`. 정렬 유지(마지막 메시지 시각 desc, 없으면 요청 시각). **cursor** = `{sortAt, requestId}` base64. **안 읽은 메시지가 있는 건은 기간 밖이어도 포함**(93 U-2 유지). FE `useInfiniteQuery` + 하단 IntersectionObserver. `totals`는 첫 페이지에만 |
| D-6 | 시각 잘림 | 항목 1줄을 `grid grid-cols-[minmax(0,1fr)_auto]`로 바꾸고 제목 `min-w-0 truncate`, 시각 `whitespace-nowrap tabular-nums`. 패널 폭이 320px 미만이면 시각을 **2줄째**(상태 배지 줄 오른쪽)로 내린다. 형식은 `formatAbsoluteDateTimeKo` 유지 |
| D-7 | 기간 UI | 상단 툴바에 `ToggleGroup`(7일·30일·90일·전체) + 「기간 직접 선택」 버튼 → `Popover` + `Calendar mode='range'`(기존 `data-table-date-filter` 조합). 선택 시 `range=custom&from&to`. 보조 문구 「기간: 최근 7일」 / 「기간: 2026-10-01 ~ 2026-10-27」 / 「기간: 전체」(`formatAbsoluteDateKo`) — 89 「최근 7일 기준」 대체 |
| D-8 | 최근 주소 분리 | `quick_request_recent_addresses.direction text not null check in ('origin','destination')`. unique `(user_id, direction, road_address, detail_address)`. **기존 행 전부 삭제**(사용자 Q3 · dev만 존재). prune 제거(상한 없음). 등록 Route: 출발 → `origin`, 경유·도착 → `destination`. picker: 출발 칸 → origin 목록, 경유·도착 칸 → destination 목록 |
| D-9 | 최근 주소 조회 | `GET /api/quick-request/recent-addresses?direction=origin\|destination&cursor&limit=10` → `last_used_at desc, id desc` 커서. picker 「최근 이용 내역」 탭 무한스크롤(`useInfiniteQuery`). 삭제 UI는 계속 Out(87 D2) |
| D-10 | 전화 규칙 | `PHONE_REGEX = /^\d{9,11}$/` · `parsePhoneDigits` 11자리 slice 유지 · `formatPhoneDisplay`: 02로 시작 → `02-XXX-XXXX`(9) / `02-XXXX-XXXX`(10); 그 외 → `0XX-XXX-XXXX`(10) / `0XX-XXXX-XXXX`(11); 9자리 비-02는 하이픈 없이 그대로(국번 불명). 에러 문구 공용 상수 `PHONE_INPUT_ERROR = '연락처는 숫자 9~11자리로 입력해 주세요.'`로 통일(「11자리」 문구 전부 교체). DB CHECK 3곳 + RPC 스냅샷 조건을 `^\d{9,11}$`로 완화(SQL) |
| D-11 | 회귀 범위 | 전화 규칙 사용처 18파일: 퀵(폼·배차·최근 주소·수정·상세)·users(추가/수정 Sheet·표·모달)·profile(필드·읽기 전용)·org-chart hover·`PUT /api/users/[id]`. 각 화면에서 9·10·11자리 입력·표시 AC |

---

## 목표 & 완료 기준 (AC)

공통: 시각 `formatAbsoluteDateTimeKo`, 날짜 `formatAbsoluteDateKo`(`yyyy-MM-dd`). 계정 `user.json`·`dongbang.json`·`admin.json`. DB fixture는 service role로 `requested_at` 조정.

### A. 기간·페이지 (5)

| AC | 유형 | 전제 | 동작 | 기대 |
|----|------|------|------|------|
| AC-01 | Playwright | `dongbang.json` · fixture: 오늘 3건 · 20일 전 2건 · 60일 전 1건 · 200일 전 1건 | `/dashboard/quick` 기본 | 보조 문구 **「기간: 최근 7일」** · 표 3건 · 카드 합계 3 · URL에 `range` 없음(기본) |
| AC-02 | Playwright | 〃 | 「30일」 → 「90일」 → 「전체」 클릭 | 표 5 → 6 → 7건 · 카드 합계 동일하게 · URL `range=30d`/`90d`/`all` · 각 전환 시 `page=1` · 200일 전 건도 「전체」에서 보임(삭제 없음) |
| AC-03 | Playwright | 〃 | 「기간 직접 선택」 → 달력에서 25일 전 ~ 15일 전 | 표 2건(20일 전) · URL `range=custom&from=yyyy-MM-dd&to=yyyy-MM-dd` · 보조 문구 「기간: {from} ~ {to}」 · 새로고침 후 유지 |
| AC-04 | API | `dongbang.json` | `GET /api/quick-request?range=custom&from=2026-10-20&to=2026-10-01` / `?range=zzz` / `?perPage=999` | 400 「기간을 확인해 주세요.」 / 200 + 기본 7d / 200 + limit 50 클램프 |
| AC-05 | Playwright | fixture 45건(오늘) · `dongbang.json` | 기본 페이지 → 2페이지 → perPage 50 | 1페이지 **20행** · 페이지네이션 「1 / 3」 · 2페이지 URL `page=2` 행 21~40 · 50 선택 시 1페이지 45행 · 상태 카드 클릭(필터) 시 `page=1` |
| AC-06 | Playwright | `user.json`(본인 2건) | 「전체」 | 본인 건만(권한 유지 · 89 AC-29) |
| AC-07 | Playwright | `dongbang.json` · 대화 fixture 25건(최근 7일) + 30일 전 1건(안 읽음 있음) + 30일 전 1건(안 읽음 없음) | 「퀵 대화」 기본 | 목록 **20건** → 아래로 스크롤 → 추가 6건(안 읽음 있는 30일 전 건 **포함**, 안 읽음 없는 30일 전 건 **제외**) · 「전체」 선택 시 27건 · `tab=unread` 유지 |
| AC-08 | Playwright | `dongbang.json` · 「퀵 대화」 패널 폭 ~300px(뷰포트 1024) | 항목 시각 확인 | `time` 요소 텍스트가 `yyyy-MM-dd (EEE) HH:mm:ss` **전체** · `scrollWidth <= clientWidth` · 말줄임 `…` 0 · 제목이 대신 truncate |
| AC-09 | Playwright (2 context) | 94 Realtime · `dongbang.json` 「30일」 보기 | `user.json` 등록 | 5초 안에 행 등장(기간 안) · 카드 +1 |
| AC-10 | grep | 구현 완료 | `grep -rn "최근 7일 기준\|QUICK_REQUEST_DASHBOARD_DAYS\|WINDOW_ROW_LIMIT\|listWindowRows" src e2e` | **0건**(상수·함수 제거 · 대화 목록도 공용 range 사용) |

### B. 최근 주소 (6)

| AC | 유형 | 전제 | 동작 | 기대 |
|----|------|------|------|------|
| AC-11 | SQL (Dev MCP) | SQL 적용 | `select count(*) from quick_request_recent_addresses` · 컬럼·unique 확인 | **0행**(기존 삭제) · `direction` not null CHECK · unique `(user_id, direction, road_address, detail_address)` · RPC에 prune 없음(함수 정의 grep `delete` 0) |
| AC-12 | API | `user.json` | 출발 A·경유 B·도착 C로 등록 → `GET …/recent-addresses?direction=origin` / `destination` | origin = [A] · destination = [C, B](최근순) · A는 destination에 **없음** |
| AC-13 | Playwright | 〃 | 요청 화면 출발 칸 「최근 이용 내역」 / 경유 칸 / 도착 칸 | 출발: A만 · 경유: C·B · 도착: C·B · 행 클릭 시 4칸 채움(87 AC-17 회귀) |
| AC-14 | API·Playwright | `user.json` · 서로 다른 도착 주소 **25개** 기록 | `GET …?direction=destination&limit=10` → cursor 2회 | 10 · 10 · 5건, `nextCursor` null · picker 탭에서 스크롤 3회로 25행 모두 · 상한 prune **없음** |
| AC-15 | API | 같은 (direction, 도로명, 상세)로 2회 | GET | 1행 · `last_used_at`·담당자·연락처 최신값(dedupe 유지) |
| AC-16 | API | 잘못된 `direction=zzz` | GET | 400 「요청 형식이 올바르지 않습니다.」 |

### C. 전화번호 (10)

| AC | 유형 | 전제 | 동작 | 기대 |
|----|------|------|------|------|
| AC-17 | 단위(`node --test`) | — | `formatPhoneDisplay('0212345678')` `('021234567')` `('0311234567')` `('01012345678')` `('012345678')` `('1234')` | `02-1234-5678` · `02-123-4567` · `031-123-4567` · `010-1234-5678` · `012345678`(그대로) · `1234`(그대로) · `PHONE_REGEX.test` 9·10·11자리 true, 8·12 false |
| AC-18 | Playwright·API | `user.json` 퀵 요청 폼 | 출발 담당 연락처 `021234567` / `0311234567` / `01012345678` / `0101234` | 앞 3개 등록 성공 · 상세·표 표시 `02-123-4567`·`031-123-4567`·`010-1234-5678` · `tel:` href는 숫자 그대로 · 4번째 **「연락처는 숫자 9~11자리로 입력해 주세요.」** + API 400 |
| AC-19 | Playwright·API | `dongbang.json` 배차 Dialog | 기사 연락처 `0212345678` 저장 | 성공 · DB `driver_phone='0212345678'`(CHECK 완화) · 알림 본문에 연락처 없음(92 유지) |
| AC-20 | Playwright·API | `admin.json` `/dashboard/users` 수정 Sheet · `PUT /api/users/{id}` | 연락처 `0212345678` 저장 / `12345678` | 성공 · 표 `02-1234-5678` · 프로필 읽기 전용 동일 · 8자리 400 「연락처는 숫자 9~11자리로 입력해 주세요.」 · DB `profiles_phone_format` 통과 |
| AC-21 | Playwright | `user.json` 조직도 hover 카드(68) · 프로필 페이지 | 02 번호 사용자 | `02-XXXX-XXXX` 표시 · 회귀 green |
| AC-22 | grep | 구현 완료 | `grep -rn "11자리" src` · `grep -rn "\\\\d{11}" src supabase/sql/9[5-9]_*.sql` | 「11자리」 문구 0건 · 신규 SQL·src 정규식 `\d{11}` 0건(SQL 11·89 원본은 수정하지 않음) |
| AC-23 | SQL (Dev MCP) | SQL 적용 | `pg_constraint` `profiles_phone_format`·`quick_requests_requester_phone_check`·`quick_requests_driver_phone_check` 정의 · `create_quick_request` 함수 본문 | 모두 `^\d{9,11}$` · 함수 스냅샷 조건도 동일 |

### D. 품질

| AC | 유형 | 전제 | 동작 | 기대 |
|----|------|------|------|------|
| AC-24 | Playwright·API | 최근 주소 POST(기존 Route) 200/400 | `/dashboard/logs` | `quick_request.recent_address_record` 행 metadata `count`·`error_code`만(87 AC-19 유지 · 주소·이름·전화 0) |
| AC-25 | CLI | — | `npx tsc --noEmit` · `npm run lint` · `npm run build` · `node --test src/lib/__tests__/phone.test.mjs` · `npx playwright test e2e/quick-request e2e/quick-workflow e2e/quick-chat e2e/users e2e/profile e2e/org-chart` | 통과(89 AC-33 → AC-01·02 · 87 AC-17·18 → AC-12~15 교체) |

**AC 총 25개**: A 10 · B 6 · C 7 · D 2.

---

## 범위 (In / Out)

### In
1. **SQL**: 최근 주소 `direction`·unique·기존 행 삭제·RPC(prune 제거, direction 파라미터) · 전화 CHECK 3곳 완화(`alter table … drop constraint … add constraint … check (~ '^\d{9,11}$')`) · `create_quick_request` 스냅샷 조건 완화(create or replace) · (D-3 선택 시) `search_quick_requests` RPC
2. **BE**: `GET /api/quick-request`·`/summary` range·페이지 DB 처리 · `conversations` cursor · `recent-addresses` direction·cursor · 등록 Route direction 매핑 · zod `range/from/to` 검증 · `src/lib/phone.ts` · 에러 문구 상수 · 사용처 schema 교체
3. **FE**: `use-quick-dashboard-params`(range·from·to) · 툴바 ToggleGroup + 달력 Popover · 보조 문구 · `DataTablePagination`(10/20/50) · 「퀵 대화」 기간 UI + `useInfiniteQuery` + 센티널 · 항목 그리드 · picker 탭 무한스크롤 + direction prop · phone 표시 공용 함수 사용처 확인(18파일)
4. **E2E**: `e2e/quick-round2/97-*.spec.ts` 신규 · 기존 spec 교체 · `node --test` phone 단위 테스트
5. **문서**: README 97 등록 · 87/89/93/09/30 수정 이력 1행

### Out
| 항목 | 이유 |
|------|------|
| CSV 다운로드 | 89 Out 유지 · 후속 [TBD] |
| 최근 주소 개별·전체 삭제 UI | 87 D2 유지 |
| 주소록(즐겨찾기) | 87 Out 유지 |
| 국제전화·`+82` 형식 | 국내 숫자만 |
| 사이드바 안 읽은 합계 90일 상한 변경 | 93 유지(성능) |
| 대시보드 상태 카드 Realtime 외 시각 효과 | 92 U-5 유지 |
| 과거 activity log 재작성 | 없음 |
| Main DB 적용 | 사용자 수동 |

---

## UI 요구사항 (designer 지시)

| # | 화면 | 요구 |
|---|------|------|
| U-1 | 대시보드 툴바 | 왼쪽: `ToggleGroup type='single'`(「7일」「30일」「90일」「전체」, 각 `min-h-11`), 「기간 직접 선택」 `Button variant='outline'` + `Icons.calendar` → `Popover` + `Calendar mode='range' numberOfMonths={lg?2:1}` + 하단 「적용」/「지우기」. 오른쪽: 기존 검색·상태 Select. 보조 문구(D-7)는 제목 아래. filter shell은 유지하고 body만 Spinner(40) |
| U-2 | 표 하단 | `DataTablePagination` `pageSizeOptions={[10,20,50]}` · 「총 N건」 |
| U-3 | 「퀵 대화」 패널 | 검색 아래에 같은 기간 ToggleGroup(소형 `size='sm'`) + 달력 버튼. 목록 하단 센티널 + 「불러오는 중…」 `PageLoadingSpinner variant='compact'` · 끝이면 「더 이상 대화가 없습니다」 |
| U-4 | 대화 항목 | 1줄 grid: 제목(truncate) \| 시각(nowrap). 패널 폭 < 320px면 시각을 2줄째 오른쪽으로 |
| U-5 | 주소 picker | 「최근 이용 내역」 탭 상단 보조 문구 「출발지에서 쓴 주소」/「도착지에서 쓴 주소」(경유 칸도 후자). 무한스크롤 센티널 · 빈 상태 문구 유지 |
| U-6 | 전화 입력 | placeholder `예: 0212345678` 또는 `01012345678` · 도움말 「숫자만 9~11자리」 · 에러 문구 D-10 |

---

## API / DB 요구사항

### SQL — `supabase/sql/95_quick_period_recent_address_phone.sql`

```sql
-- Plan: 97_quick-period-filter-recent-address-split-phone-plan.md · Date: 2026-10-27 · Status: Approved
-- 1) 최근 주소: 기존 행 삭제(사용자 결정) → direction 추가 → unique 교체 → RPC 재정의(prune 제거 · direction)
delete from public.quick_request_recent_addresses;
alter table public.quick_request_recent_addresses
  add column direction text not null check (direction in ('origin','destination')),
  drop constraint quick_request_recent_addresses_user_address_key,
  add constraint quick_request_recent_addresses_user_dir_address_key unique (user_id, direction, road_address, detail_address);
drop index if exists idx_quick_request_recent_addresses_user_last_used;
create index idx_qrra_user_dir_last_used on public.quick_request_recent_addresses (user_id, direction, last_used_at desc, id desc);
create or replace function public.record_quick_request_recent_addresses(p_user_id uuid, p_items jsonb) returns integer … -- item: {direction, roadAddress, detailAddress, contactName, contactPhone} · upsert만
-- 2) 전화 9~11자리
alter table public.profiles drop constraint if exists profiles_phone_format;
alter table public.profiles add constraint profiles_phone_format check (phone is null or phone ~ '^\d{9,11}$') not valid;  -- 기존 행 검증 생략
alter table public.quick_requests drop constraint if exists quick_requests_requester_phone_check, add constraint … check (requester_phone is null or requester_phone ~ '^\d{9,11}$');
alter table public.quick_requests drop constraint if exists quick_requests_driver_phone_check, add constraint … check (driver_phone is null or driver_phone ~ '^\d{9,11}$');
create or replace function public.create_quick_request(...)  -- SQL 89 본문에서 스냅샷 조건만 '^\d{9,11}$'
-- 3) (선택) search_quick_requests(p_user, p_view_all, p_from, p_to, p_status, p_q, p_offset, p_limit) returns setof + total  — D-3 결정 시
-- 롤백: 역순(제약 복원 · direction drop · RPC 85 본문) — 삭제된 최근 주소 행은 복구 불가(사용자 승인)
```

- CHECK 제약 이름은 backend-dev가 `pg_constraint`에서 실제 이름을 확인해 쓴다(SQL 89는 inline check라 자동 이름).

### Route

| Method · Path | 변경 |
|---|---|
| `GET /api/quick-request` | `range`·`from`·`to`·`page`·`limit`(≤50)·`status`·`search` → DB 필터·정렬·`range()`·`count:'exact'` · 응답 `{rows, page, limit, total, range:{from,to,kind}}` |
| `GET /api/quick-request/summary` | `range`·`from`·`to` → 상태별 count(권한 적용) · `range` 에코 |
| `GET /api/quick-request/conversations` | `range`·`from`·`to`·`cursor`·`limit`(≤50, 기본 20) → `{conversations, nextCursor, totals?}` · 안 읽음 있는 건은 기간 무관 포함(unread 집합을 먼저 구해 기간 집합과 합집합 → 정렬 → 커서) |
| `GET /api/quick-request/recent-addresses` | `direction`(필수) · `cursor` · `limit`(≤50, 기본 10) → `{addresses, nextCursor}` |
| `POST /api/quick-request/recent-addresses` | body item에 `direction` 필수(zod enum) · 로그 유지 |
| `POST /api/quick-request` | 등록 시 origin→`origin`, stopovers·destination→`destination`로 기록 |
| 연락처 zod 전부 | `PHONE_REGEX` 공용 → 자동 반영 · 메시지 상수 교체 |

공용: `src/features/quick-request/lib/quick-request-range.ts` `parseQuickRange({range, from, to}) → {fromIso, toIso, kind}`(KST · 서버·FE 공용) · `quickRangeLabel()`.

---

## 활동 감사 로그

> READ Route(목록·요약·대화·최근 주소 GET)는 Out. 기존 CUD Route(`POST recent-addresses`·`POST /api/quick-request`·`PATCH /api/users/[id]`)는 **분기·action 변경 없음**(zod 400 메시지만 변경 · 전 분기 로그 유지). 신규 CUD Route 없음. 삭제 UI 없음. 검증: **AC-24**(87 AC-19 회귀).

---

## 영향 파일 & 패턴

| 팀 | 파일 |
|---|---|
| BE | `supabase/sql/95_quick_period_recent_address_phone.sql`(신규) · `src/lib/phone.ts` · `src/lib/phone-messages.ts`(신규 · 문구 상수) · `src/features/quick-request/lib/quick-request-range.ts`(신규) · `api/{workflow.server,messages.server,service.server}.ts` · `src/app/api/quick-request/{route,summary/route,conversations/route,recent-addresses/route}.ts` · `schemas/{quick-request-workflow,quick-request-recent-address,quick-request-form,quick-request-dispatch,quick-request-notify,quick-request-edit}.ts` · `src/features/users/schemas/user.ts` · `src/features/auth/schemas/profile.ts` · `src/app/api/users/[id]/route.ts` |
| FE | `components/dashboard/{use-quick-dashboard-params,quick-dashboard-toolbar,quick-dashboard-page,quick-dashboard-body,quick-dashboard-meta-bar,quick-status-cards}.tsx` · `components/dashboard/quick-range-filter.tsx`(신규 · 대시보드·대화 공용) · `components/chat/{quick-chat-conversation-list,quick-chat-conversation-item,use-quick-chat-params}.tsx` · `components/{quick-request-address-picker-dialog,quick-request-field-controls,quick-request-location-section}.tsx` · `api/{keys,queries,service,types}.ts` · `src/lib/searchparams.ts` · `src/features/auth/components/phone-field.tsx` · users/profile/org-chart 표시 컴포넌트(함수 재사용 확인만) |
| verifier | `e2e/quick-round2/97-{period,recent-address,phone}.spec.ts`(신규) · `src/lib/__tests__/phone.test.mjs`(신규) · `e2e/quick-workflow/dashboard.spec.ts`(AC-33 교체) · `e2e/quick-request/{address-picker,recent-addresses.api}.spec.ts`(교체) · `e2e/users`·`e2e/profile`·`e2e/org-chart` 회귀 |

**패턴:** `data-table-date-filter.tsx`(Calendar+Popover) · `DataTablePagination` · nuqs(73) · `useInfiniteQuery`(notifications 무한 목록) · PostgREST `range()`+`count` · `jsonWithActivityLog`.

---

## 리스크 & 완화

| 등급 | 리스크 | 완화 |
|---|---|---|
| HIGH | 전화 규칙 완화가 사용자·계약서·프로필 화면에 회귀(문구·검증·표시) | 사용처 18파일 전수 교체 · AC-17~23 · 회귀 디렉터리 3개 |
| HIGH | DB 페이지네이션으로 바꾸며 경유지 검색이 빠짐 | D-3 대안(RPC) · AC-05 검색 포함 fixture로 판정(요청번호·이름·도착 주소 · 경유 1건) |
| MED | `custom` 범위 「전체」가 커져 count 쿼리 느림 | 인덱스 `(requested_at desc)`·`(status, requested_at desc)`(89) 활용 · 상한 없음은 사용자 결정 · 느리면 후속 |
| MED | 대화 목록 커서 + 「안 읽음 있는 건 항상 포함」 합집합의 안정 정렬 | 커서에 `(sortAt, requestId)` 복합 · 서버 단위 테스트 |
| MED | 기존 최근 주소 삭제에 대한 사용자 혼란 | 사용자 결정(Q3) · 수정 이력 명시 |
| LOW | `profiles_phone_format not valid`로 기존 데이터 미검증 | 기존 행은 11자리라 영향 없음 · `validate constraint` 후속 |

**롤백:** SQL 롤백 블록(삭제 행 제외) · 코드 revert.

---

## Battle Plan (단계)

| # | 단계 | 산출물 | 확신도 | 의존 |
|---|---|---|---|---|
| 0 | root Step 0 백업 | — | HIGH | — |
| 1 | designer: 기간 툴바·달력·페이지네이션·대화 목록 항목 grid·picker 탭 문구·전화 입력 도움말 | 설계 메모 | HIGH | — |
| 2 | BE: `phone.ts` + 문구 상수 + 단위 테스트 → SQL 적용(dev) → 사용처 schema 교체 → tsc | 전화 규칙 | HIGH | 0 |
| 3 | BE: `quick-request-range.ts` → 목록·요약 DB 페이지네이션(+검색 RPC 결정) → 대화 커서 → 최근 주소 direction·cursor → **Checkpoint 1**(API AC-04·12·14·15) | API | MED | 2 |
| 4 | FE: 기간 필터 컴포넌트 · 대시보드 툴바·페이지네이션 · 요약 range · 보조 문구 | UI | HIGH | 3 |
| 5 | FE: 「퀵 대화」 기간 + 무한스크롤 + 항목 grid · picker 무한스크롤·direction | UI | MED | 3 |
| 6 | verifier: 신규 spec 3 + 단위 + 교체 + 회귀 | green | MED | 4·5 |

**추정:** 신규 6파일 · 수정 약 35파일 · +1,100/−350줄 · **Complex** · 약 7~9시간. Checkpoint 1 = 3단계 직후, Checkpoint 2 = 5단계 직후(AC-07·13).

---

## requirements-pipeline Express (Phase 3)

### 가정

| ID | 가정 | 출처 |
|----|------|------|
| A1 | 기간 기본 7일 · 선택지 7/30/90/전체 + 달력 · 20건 | 사용자 답변 Q2 |
| A2 | 기존 최근 주소는 버리고 새로 시작 · 경유 칸 = 도착 목록 | 사용자 답변 Q3 |
| A3 | 전화는 국내 번호 숫자 9~11자리만 | brief 10 |
| A4 | 데이터 삭제는 없고 7일은 기본 필터일 뿐 | brief 5 |
| A5 | PostgREST `or(ilike)`로 도로명 검색이 되고, 경유지는 RPC가 필요할 수 있다 | **[INFERRED]** |

### 검증 시나리오

| 시나리오 | 기대 |
|----------|------|
| 기간 전환 | 7일 → 30일 → 전체 행·카드 수 증가(AC-01·02) |
| 달력 | from~to 범위만(AC-03) |
| 페이지 | 20·50건 · page=1 리셋(AC-05) |
| 대화 무한스크롤 | 20 + 6 · 안 읽음 포함 규칙(AC-07) |
| 최근 주소 | 출발/도착 분리 · 상한 없음(AC-12~14) |
| 전화 | 9·10·11자리 입력·표시·DB(AC-17~23) |

---

## 구현 팀 전달 메모

### designer
- 기간 ToggleGroup + 달력 Popover(공용 컴포넌트 1개 · 대시보드/대화 2곳) · 페이지네이션 옵션 · 대화 항목 grid · picker 탭 문구 · 전화 placeholder/도움말.

### backend-dev
- `phone.ts` 먼저(단위 테스트 포함) → SQL(최근 주소 삭제·direction·RPC · 전화 CHECK 3 + RPC 스냅샷) → `quick-request-range.ts` → 목록·요약·대화·최근 주소 Route(DB 페이지·커서) → 검색 RPC 여부 결정·기록.

### frontend-dev
- nuqs `range/from/to/page/perPage` · 공용 기간 필터 · `DataTablePagination` · 대화 `useInfiniteQuery` + 센티널 · 항목 grid(시각 nowrap) · picker direction + 무한스크롤 · 전화 문구 상수 사용.

### verifier
- fixture는 service role로 `requested_at` 조정 · 기간·페이지·커서 판정 · 최근 주소 direction·25건 스크롤 · 전화 단위 + 3화면 회귀 · 87 AC-17·18, 89 AC-33 spec 교체.

---

## 열린 질문

| # | 질문 | 기본값 |
|---|---|---|
| OQ-1 | 경유지 검색을 RPC로 할지 | backend-dev가 PostgREST로 안 되면 RPC(수정 이력 기록) |

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-10-27 | 최초 작성 · Approved(/root 단일 게이트 · Q2·Q3 답변 + brief 5·6·10). 기간 7/30/90/전체 + 달력 · 기본 7일 · 20건(10/20/50) · DB 페이지네이션 · 대화 목록 기간+커서 무한스크롤 · 시각 잘림 grid · 최근 주소 direction 분리(기존 삭제 · 상한 없음 · 10개 커서) · 전화 9~11자리(공통 · DB CHECK 3곳 · 사용처 18파일) · SQL 95(예정) · AC 25 | planner |
| 2026-10-28 | backend-dev: SQL 95 Dev 적용(20261027160355 · 최근 주소 4행 삭제 → 0 · direction/unique/인덱스 · RPC prune 제거 · 전화 CHECK 3곳+RPC 스냅샷 `^\d{9,11}$`). **OQ-1 결정:** 경유지 검색은 RPC 대신 `quick_requests.search_text` generated stored column(요청번호·요청자·출발/경유/도착 도로명+상세 lower) + PostgREST `ilike`+`range()`+`count` — D-3 「도로명」을 상세주소까지 넓혀 기존 메모리 검색 범위 유지(e2e 태그가 상세주소에 있음). **D-5 추가:** 대화 목록은 RPC `quick_request_conversations_page`(기간 ∪ 안 읽음 · keyset `(has_message, sort_at, id)` · totals jsonb). 안 읽음 포함 집합은 93과 같이 90일 상한(사이드바 합계와 일치). 목록 응답에서 `counts` 제거(요약 API로 분리) · `limit` 별칭 `perPage` 허용 | backend-dev |
| 2026-10-28 | verifier: 신규 spec `e2e/quick-round2/97-{period,recent-address,phone}.spec.ts` 22/22 green(AC 1:1) · 단위 9/9 · SQL AC-11·23(Dev MCP) · grep AC-10·22 → **AC 25/25 pass** · 회귀 quick 5디렉터리 280 pass(실패 2 = 기존 access AC-02·notes.api AC-12) · users/auth/org-chart 73 pass(실패 22 = 기존 plan 57 폐기 auth 13 · `경영진` fixture 조직 검증 7 · dev-provision 2) · tsc 0 · lint 0 · react-doctor 79 · build 0 · cleanup remaining 0. 소규모 직접 수정: `quickRequestLocationSchema` 전화 zod 메시지 누락 · 등록 Route 최근 주소 기록 순서(destination [C, B]) · `PUT /api/users/[id]` 전화 400 문구 · users Sheet placeholder 명시값 제거 · `use-quick-dashboard-params` deps · SQL 95 롤백 주석. **Status Completed** | verifier |
| 2026-10-29 | [106](./106_quick-mobile-restructure-plan.md): D-6·AC-08 대화 목록 시각 전체 표기 → 퀵 대화 짧은 시각(규칙 예외), D-7/U-1 휴대폰 툴바 → 검색 + 「필터」 판, U-2/AC-05 → 휴대폰 20건 자동 추가 로드(같은 `page` API) · PC 퀵 전용 한국어 페이지네이션(「1 / 3 페이지」·「다음 페이지」). API·DB 불변 | planner |
