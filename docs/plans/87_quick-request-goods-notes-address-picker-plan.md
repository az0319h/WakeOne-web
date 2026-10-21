# 퀵 요청 물품 크기 · 특이사항 칩 관리 · 주소 검색 모달 · 최근 주소 기획서

> Date: 2026-10-21
> Status: Approved
> **Revision 2026-10-21 (r1):** 물품 내용 입력칸은 **「기타」 선택 시에만** 노출·필수. `goodsSizeOtherText` 제거 → `itemDescription` 하나로 통합. 칩·최근 주소 DB 저장은 변경 없음. 재구현 대상: FE + notify schema + e2e (DB·SQL 변경 0)
> Author: planner
> **Partially supersedes:** [86](./86_quick-request-kakao-redesign-plan.md): 일부 AC·testid·Out 범위 (아래 §86 supersede 표). 레이아웃·테마·반응형 규칙과 notify 501 계약은 86/83/82를 상속
> **선행:** [07](./07_auth-route-guard-plan.md), [08](./08_activity-audit-log-plan.md), [14](./14_delete-confirm-dialog-plan.md), [26](./26_loading-spinner-unification-plan.md), [49](./49_live-users-presence-plan.md), [51](./51_wallet-balance-email-plan.md) (사용자별 테이블 선례 · SQL 50), [81](./81_kanban-google-tasks-plan.md) (SQL 83 RLS 선례), [82](./82_quick-request-plan.md), [83](./83_quick-request-wizard-plan.md), [86](./86_quick-request-kakao-redesign-plan.md)
> **디자인 레퍼런스:** `/Users/hoon/Desktop/Wake_Auto/kakao-quick-lab/`: `GoodsSection.tsx`, `AddressSection.tsx`, `public/sites/.../images/goods-{xs,s,m}.svg`

## 선행 plan 참조 (Phase 0)

| Plan | Status | 관계 |
|------|--------|------|
| **86** | Approved (구현 완료) | **확장 + 일부 supersede**: Out이던 「물품 크기 카드」「최근 이용 내역」을 In으로 전환. 「폼 schema·notify payload·메시지 포맷 불변」「DB 변경 없음」은 해제. 신규 Route에는 activity log를 연동하고, notify Route는 계속 로그 0건(86 AC-22 유지) |
| **83** | Approved (UI는 86이 supersede) | 폼 모델·경유 무제한·`💳 결제: 월정산` 고정 줄 상속. 83 D2 「자주 쓰는 주소 Out」은 **본 plan에서 번복**(최근 주소만, 주소록은 여전히 Out) |
| **82** | Approved | notify **501** placeholder·복사 fallback·RBAC(active user 전원) 상속. 82 리스크 「Daum 모바일 → embed 모드」를 본 plan이 실현 |
| **08** | Approved | 신규 CUD Route 4종은 **모든 return 분기**에서 `recordActivityLog` 호출 + `x-request-id` 헤더. GET은 Out |
| **14** | Completed | 특이사항 칩 삭제는 `AlertModal` 필수, `window.confirm` 금지 |
| **26** | Approved | `loading.tsx` `PageLoadingSpinner variant='fill'` 유지 |
| **49** | Approved | `/dashboard/quick/request`는 `dashboard/layout` 하위이므로 **`DashboardPresenceTrack` 상속**, 별도 track 0건 |
| **51 / 81** | Approved | 패턴: 사용자별 테이블 + RLS 본인 select + authenticated 쓰기 revoke + service-role Route + activity log (SQL 50·83) |
| **60** | Approved | 개인정보처리방침에 「퀵 요청 최근 주소(제3자 이름·연락처)」 처리 항목을 반영할지는 **별도 plan `[TBD]`** (본 plan Out) |

---

## 한 줄 요약

`/dashboard/quick/request`에 다섯 가지를 더한다.
1. **물품 크기 카드**(초소형·소형·중형·기타 필수)
2. **사용자별 특이사항 칩 목록**(DB, 최대 10개, 추가·수정·삭제, 기본 「동승 필요」)
3. **페이지 내 주소 검색 모달**(Daum `embed` + 「주소 검색 / 최근 이용 내역」 탭, popup 제거)
4. **최근 주소 재사용**(확인 시 저장, 최근 10개)
5. **shadcn 5곳 정리**

---

## 정책 확정안 (deep-interview · battle-plan · 사용자 `go` 2026-10-21)

| # | 항목 | 확정 |
|---|------|------|
| D1 | **특이사항 칩** | **사용자별 목록 1개**. 출발·도착 두 칸에 같은 목록을 보여 주고 각 칸에서 따로 선택한다. **합계 최대 10개는 서버(DB trigger)에서 강제**. 라벨은 trim 후 1~30자이고 사용자 안에서 중복을 금지한다. 신규·기존 사용자 모두 「동승 필요」 1개를 seed하며, seed 칩도 수정·삭제할 수 있다. **전부 지워도 다시 seed하지 않는다.** 기존 상수 칩 10개(`QUICK_REQUEST_{ORIGIN,DESTINATION}_NOTE_OPTIONS`)는 제거한다 |
| D2 | **최근 주소** | 미리보기 Dialog **「확인」** 시 출발·경유·도착의 **도로명 주소·상세 주소·담당자·연락처**를 사용자별로 저장한다. 본인만 조회하며 최근 **10개**까지 둔다. (도로명+상세) 기준으로 dedupe하고 `last_used_at`과 담당자·연락처를 최신값으로 갱신한다. **주소록 탭과 최근 기록 개별·전체 삭제는 Out**. **담당자 이름·연락처 저장은 사용자 승인됨(2026-10-21)** |
| D3 | **주소 검색 UI** | shadcn `Dialog` 1개. `lg`(≥1024)에서는 가운데 창, `lg` 미만에서는 전체화면 className. vaul Drawer는 **사용하지 않는다**(iframe 스크롤과 드래그 충돌). 내부 `Tabs`: 「주소 검색」(Daum `embed`, 기본 탭) / 「최근 이용 내역」. 도로명 입력칸 **직접 입력 유지** |
| D4 | **물품 크기** | `xs`·`s`·`m`·`other` 중 **필수 1개**(미선택 시 「물품 크기를 선택해 주세요.」), 대형 제외. 카드 문구는 **이름+예시만**(초소형 · 휴대폰 / 소형 · A4박스 / 중형 · 라면박스 / 기타)이고 cm·kg 문구는 넣지 않는다. **(r1 2026-10-21)** 「물품 내용」 textarea(최대 500자)는 **「기타」를 고른 경우에만** 보이고 그때만 **필수**(비면 「물품 내용을 입력해 주세요.」). 초소형·소형·중형이면 입력칸 미노출 + `itemDescription`은 **빈 문자열로 전송**. 별도 「물품 크기 (기타)」 입력칸(`goodsSizeOtherText`)은 **제거**. 카톡 메시지: 카드 선택 시 `크기: 소형`만(**`물품:` 줄 없음**), 기타 선택 시 `크기: 기타` 다음 줄에 `물품: {입력값}` |
| D5 | **shadcn 정리** | 5곳 교체를 In으로 한다. 「50만 원 초과」 체크는 Out |
| D6 | **환경** | DB 적용은 **`WakeOne-Dev-Supabase-Mcp` `apply_migration`(개발 DB `dgjtcxzfwlvpmryrkgzc`)만** 사용하고 운영 Main MCP는 **사용 금지**. 명령은 `npx playwright test` / `npm run …`로 실행한다(이 머신에 bun 없음) |

---

## 목표 & 완료 기준 (AC)

**공통 규칙:**
- E2E는 `storageState` active user(`e2e/.auth/user.json`)로 실행한다. 셀렉터는 **`getByRole`·`getByPlaceholder`·`getByTestId`만** 쓰며, CSS·DOM 구조 의존은 금지한다
- **`/dashboard/quick/request`는 `dashboard/layout` 하위이므로 `DashboardPresenceTrack`을 상속하고 quick 전용 track은 0건이다** (86 AC-05 grep 유지)
- 시각 표기는 `formatAbsoluteDateTimeKo`만 사용한다
- 테마 목록은 `src/components/themes/theme.config.ts`의 `THEMES`를 import해서 쓰고 하드코딩하지 않는다
- 레이아웃 측정은 `page.evaluate`(scrollWidth/clientWidth)와 `boundingBox()`만 사용한다. 픽셀 비교 금지
- activity log 검증은 **API 테스트**로 한다(UI E2E가 아님)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| AC-01 | Playwright | viewport 1280 | 페이지 로드 | `radiogroup` 「물품 크기」 안에 radio **초소형·소형·중형·기타** 4개가 있다. 초소형·소형·중형 카드에는 alt=크기명 `img`가 있다. 「대형」은 0건이다. **(r1)** 크기 미선택 상태에서 `quick-request-item-description`은 **보이지 않고**(`toBeHidden`), `quick-request-goods-size-other-input`은 **0건** |
| AC-02 | Playwright | 크기 미선택 · 나머지 필수 유효 | `quick-request-register-button` 클릭 | 「물품 크기를 선택해 주세요.」가 보이고 `quick-request-preview-message`는 미노출 |
| AC-03 | Playwright | **(r1)** 「기타」 선택 → `quick-request-item-description`이 **보인다** · 비움 | 등록 클릭 | 「물품 내용을 입력해 주세요.」가 보이고 미리보기 미노출. `철판 2m`를 입력하고 다시 등록하면 미리보기에 **`크기: 기타`** 줄과 그 **다음 줄 `물품: 철판 2m`**. `quick-request-summary`에 물품 크기 「기타」, 물품 「철판 2m」 |
| AC-04 | Playwright | **(r1)** 「소형」 선택 · 나머지 필수 유효 | 등록 클릭 | `quick-request-item-description` **미노출**이고 「물품 내용을 입력해 주세요.」 **0건**. 미리보기가 열리고 **`크기: 소형`** 줄이 있으며 **`물품:` 으로 시작하는 줄은 0건**. `quick-request-summary`에 물품 크기 「소형」, 「물품」 행 **0건**. 추가: 「기타」에서 `철판 2m` 입력 → 「소형」으로 변경 후 등록하면 미리보기에 `물품:` 줄 0건(값 미전송) |
| AC-05 | API | active 세션 | **(r1)** `POST /api/quick-request/notify`: ① `goodsSize:'xs'` + `itemDescription:''` ② `goodsSize` 누락 ③ `'other'` + `itemDescription:''`(또는 공백만) ④ `'other'` + `itemDescription:'철판 2m'` | ① **501** ② **400** ③ **400** ④ **501**. 모든 경우 `x-request-id` 헤더. notify 로그 0건은 AC-23 |
| AC-06 | Playwright | fixture 칩이 seed 상태 | 페이지 로드 | `quick-request-origin-notes`와 `quick-request-destination-notes` 각각에 button 「동승 필요」 **1개만** 있다. 「주차 협조 필요」는 0건 |
| AC-07 | Playwright | seed 상태 | `quick-request-note-add` → 입력 「E2E 칩 A」 → 저장 | toast 「특이사항이 추가되었습니다.」. 새로고침 없이 **두 group 모두**에 「E2E 칩 A」 |
| AC-08 | Playwright | 출발 group에서 「E2E 칩 A」 선택 | 해당 칩 수정 → 「E2E 칩 B」 저장 | 두 group 모두 「E2E 칩 B」로 바뀌고, 요약 출발 특이사항도 「E2E 칩 B」(폼 선택값 치환) |
| AC-09 | Playwright · grep | AC-08 상태 | 「E2E 칩 B」 삭제 클릭 | **`AlertModal`** 제목 「특이사항 삭제」, 설명에 라벨이 포함된다. 확인하면 두 group과 요약에서 모두 제거된다. grep: `src/features/quick-request/**`에서 `window.confirm`·`confirm(`·`window.alert` **0건** |
| AC-10 | Playwright · API | 칩 10개 보유 | UI에서 추가 시도 / `POST /api/quick-request/notes` 11번째 | UI 「특이사항은 최대 10개까지 등록할 수 있습니다.」 / API **409** + 같은 message |
| AC-11 | API | active 세션 | POST ① 빈 라벨 ② 31자 ③ 기존과 같은 라벨 | ① **400** 「특이사항을 입력해 주세요.」 ② **400** 「30자 이내로 입력해 주세요.」 ③ **409** 「이미 등록된 특이사항입니다.」 |
| AC-12 | API | 사용자 A의 칩 id | ① 미인증 PATCH ② 사용자 B 세션 PATCH·DELETE | ① **401** ② **404**. 사용자 A의 행은 불변 |
| AC-13 | API (activity log) | active 세션 | 칩 POST(201) → PATCH(200) → DELETE(200) → 중복 POST(409) | 각 응답에 `x-request-id`. `GET /api/activity-logs`(action filter)에 해당 request_id로 `quick_request.note_create`(201)·`quick_request.note_update`(200)·`quick_request.note_delete`(200)·`quick_request.note_create`(409) 행이 있다 |
| AC-14 | API · SQL | ① 칩을 모두 삭제한 사용자 ② SQL 85 적용 후 신규 profile insert | ① `GET /api/quick-request/notes` ② `quick_request_notes` 조회 | ① **빈 배열**(re-seed 없음) ② 신규 user_id에 「동승 필요」 **1행** |
| AC-15 | Playwright | viewport 1280 | `quick-request-origin-address-search` 클릭 | `getByRole('dialog', { name: '주소 검색' })`가 열린다. tab 「주소 검색」·「최근 이용 내역」이 있고, `quick-request-address-picker-postcode`가 표시된다. `page.on('popup')` **0건** |
| AC-16 | Playwright | viewport 375 | AC-15와 같은 동작 | dialog `boundingBox` 폭이 viewport와 같고 높이는 viewport의 **90% 이상**. `scrollWidth <= clientWidth`. 닫기 버튼 높이 **44px 이상** |
| AC-17 | Playwright | 출발 「서울 중구 세종대로 110 / 1층 / E2E 출발 / 01011112222」로 등록 → 확인(501) 완료 | 출발 주소 검색 재오픈 → 「최근 이용 내역」 → 해당 행(`quick-request-recent-address-0`) 클릭 | 출발 **도로명·상세·담당자·연락처 4칸이 자동으로 채워지고** dialog가 닫힌다 |
| AC-18 | API | active 세션 | `POST /api/quick-request/recent-addresses`로 같은 주소 2회 → 서로 다른 주소 11개 → `GET` | 중복 주소는 1행(가장 최근이 맨 앞). 최종 GET은 **10행**, `last_used_at` 내림차순 |
| AC-19 | API (activity log) | active 세션 | recent POST ① 유효(200) ② 잘못된 body(400) | `x-request-id`. `quick_request.recent_address_record` 행이 200·400 두 건. 각 행 metadata 키에 주소·이름·전화가 **없다**(`count`·`error_code`만) |
| AC-20 | API | 사용자 A가 최근 주소 기록 | 사용자 B 세션으로 `GET /api/quick-request/recent-addresses` | 사용자 A의 주소 **0건** |
| AC-21 | Playwright | `GET recent-addresses`를 `page.route`로 빈 배열 응답 | 「최근 이용 내역」 탭 클릭 | 「최근 이용 내역이 없습니다.」 |
| AC-22 | Playwright | 1280 · 「기타」 + 물품 내용 입력 · 전 필수 유효 | 등록 → `quick-request-confirm-button` | 86 AC-13 결과를 유지한다: toast 「카톡 API 연동 후 자동 전송됩니다.」·「메시지가 복사되었습니다.」, Dialog 닫힘, **물품 크기 미선택으로 reset**되고 물품 내용 입력칸은 **미노출**(값 빈 문자열), 출발 담당은 프로필 기본값(reset). 추가로 `recent-addresses` POST를 `page.route`로 **500** 처리해도 복사·reset은 같게 동작한다 |
| AC-23 | API · grep | active 세션 | notify POST(유효) / `src/app/api/quick-request/notify/route.ts` grep | **501** + `x-request-id`. `recordActivityLog` **0건**(86 AC-22 유지) |
| AC-24 | grep · Playwright | 구현 완료 | `src/features/quick-request/components/**`에서 raw `<button`·`<label` 검색 | **0건**. 86 AC-09(차량 카드 alt=차량명 `img`)와 `getByRole('radio', { name: '즉시 요청' \| '날짜/시간 선택' \| '최대한 빠르게' })`가 유지되고, 운임 testid `quick-request-freight-{monthly\|collect}`도 유지 |
| AC-25 | grep | 구현 완료 | `src/**`에서 `QUICK_REQUEST_ORIGIN_NOTE_OPTIONS`, `QUICK_REQUEST_DESTINATION_NOTE_OPTIONS`, `주차 협조 필요`, `t1.daumcdn.net`, `}).open()`, **(r1)** `goodsSizeOtherText`, `quick-request-goods-size-other-input` 검색 | **0건** |
| AC-26 | Playwright · grep | `THEMES` 각 value × light/dark **20조합** · 1280 / `vercel` · 375 · 주소 검색 dialog 열림 | 페이지 로드 | 86 AC-19·AC-14와 같이 `quick-request-order-page` 표시, `scrollWidth <= clientWidth`. 86 AC-20 grep(`#hex`·`kq-`·`bg-white`·`text-black`·`-[#`·`Roboto`·`rounded-[`·`shadow-[`)이 신규 파일 포함 **0건** |
| AC-27 | SQL (MCP `execute_sql`, dev) | SQL 85 적용 | `pg_class.relrowsecurity`, `information_schema.role_table_grants`, `has_function_privilege` 조회 | `quick_request_notes`·`quick_request_recent_addresses` 모두 RLS on. `authenticated`·`anon`에 INSERT/UPDATE/DELETE 권한 없음. `record_quick_request_recent_addresses` execute 권한은 `service_role`에만 있음 |
| AC-28 | 수동 QA | PC Chrome + iPhone Safari · `vercel`·`supabase`·`claude` × light/dark | 실제 Daum 검색 → 결과 선택 | iframe 스크롤·터치가 정상이고 도로명이 채워진다. Daum 하단 로고가 노출된다. 물품 크기 SVG와 칩의 가독성에 이상이 없다 (e2e 판정 대상 아님) |
| AC-29 | CLI | — | `npx playwright test e2e/quick-request` · `npm run build` · `npm run e2e:cleanup` | **green** · **통과** · **exit 0** |

**최종 AC 개수: 29**
- Playwright 단독 12: AC-01~04·06~08·15~17·21·22
- Playwright+grep/API 복합 4: AC-09·10·24·26
- API 8: AC-05·11·12·13·14·18·19·20
- API+grep 1: AC-23
- grep 1: AC-25
- SQL 1: AC-27
- 수동 QA 1: AC-28
- CLI 1: AC-29

### e2e testid 규칙

| 구분 | testid |
|------|--------|
| **보존** | 86 표의 보존 항목 전부(단, 아래 「변경」 제외). `quick-request-{origin\|destination\|stopover-N}-address-search`는 **유지**하되 동작만 popup에서 Dialog 열기로 바뀐다 |
| **신규** | `quick-request-goods-size-{xs\|s\|m\|other}` · `quick-request-{origin\|destination}-notes`(group) · `quick-request-{origin\|destination}-note-{id}` · `quick-request-note-add` · `quick-request-note-editor-input` · `quick-request-note-editor-save` · `quick-request-note-edit-{id}` · `quick-request-note-delete-{id}` · `quick-request-address-picker` · `quick-request-address-picker-postcode` · `quick-request-recent-address-{n}` |
| **삭제 (r1)** | `quick-request-goods-size-other-input` 제거. `quick-request-item-description`은 유지(「기타」 선택 시에만 보임) |
| **변경(삭제)** | `quick-request-{origin\|destination}-note-{문구}` → **id 기반**으로 변경. spec은 group + `getByRole('button', { name })` 사용 권장 |

- 칩 편집·삭제 진입 방식(칩 옆 아이콘, 편집 모드 토글, 관리 Dialog)은 **designer가 결정**한다. 단 위 testid와 44px 터치 타깃은 지킨다.

---

### 물품 메시지·요약 포맷 (r1 · 2026-10-21)

| 선택 | 카톡 메시지 (요청 시각 빈 줄 다음) | 요약 「물품 크기」 | 요약 「물품」 행 | notify `itemDescription` |
|------|-----------------------------------|-------------------|-----------------|--------------------------|
| 초소형·소형·중형 | `크기: 소형` (**`물품:` 줄 없음**) → `차량: …` | 크기명만 (예: 소형) | **미노출** | `''` (폼 값이 남아 있어도 map에서 `''`로 보냄) |
| 기타 | `크기: 기타` → `물품: {trim 입력값}` → `차량: …` | 「기타」 | 입력값 (line-clamp-3) | trim 값 (1~500자) |
| 미선택 (요약 실시간) | — (등록 불가) | — | 미노출 | — |

- 크기 줄은 `물품:` 줄보다 **앞**에 온다(기존 `물품:` → `크기:` 순서에서 변경).

---

## 범위 (In / Out)

### In Scope

| # | 영역 | 내용 |
|---|------|------|
| 1 | **물품 크기** | shadcn `RadioGroup` choice card 4종 + **「기타」 선택 시에만 「물품 내용」 textarea(r1)**. 폼·notify schema, `map`, 메시지 `크기:` 줄, 요약 행, `public/quick-request/goods/goods-{xs,s,m}.svg`(클론 복사, `bg-muted` 타일), `lib/quick-request-goods-visuals.ts` |
| 2 | **특이사항 칩 DB** | SQL 85 테이블, seed trigger, backfill, 10개 상한 trigger, RLS. Route `notes` GET/POST, `notes/[id]` PATCH/DELETE |
| 3 | **특이사항 칩 UI** | `useSuspenseQuery`로 칩 목록 조회, 추가·수정 Dialog, 삭제 `AlertModal`. 라벨 변경·삭제 성공 시 폼 `origin.notes`/`destination.notes`를 치환·제거 |
| 4 | **주소 검색 모달** | Daum 로더를 `embed`로 리팩터한다(타입: `embed`·`onresize`·`onclose`·`width/height`, 스크립트 `//t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js`). popup `.open()`은 제거한다. `Dialog` + `Tabs`이고 모바일은 전체화면 |
| 5 | **최근 주소** | SQL 85 테이블과 RPC. Route `recent-addresses` GET/POST. 확인 시 notify와 **병렬** 기록하며 실패해도 복사·reset 흐름은 유지하고 오류 toast 1회. 최근 행을 선택하면 4칸 채움 |
| 6 | **shadcn 5곳** | ① 차량 카드 raw `<button>` → `Toggle`(aria-pressed) ② `QuickRequestRadioCard` raw `<label>`(일정·운임 공용) → `Field`+`FieldLabel`+`RadioGroupItem` choice card ③ 모바일 요약 트리거 raw `<button>` → `Button` ④ 주소 정보 박스 div → `Card` ⑤ 요약 보드 div → `Card`. `src/components/ui/*`는 수정하지 않는다(className 확장만) |
| 7 | **activity log** | `ActivityAction` 4개, `ActivityTargetType` 2개, `labels.ts` 한국어 라벨 |
| 8 | **E2E** | helpers·기존 spec 수정, 신규 spec 4개, `scripts/cleanup-e2e-mock-data.mjs`에 quick 테이블 fixture 정리 추가 |

### Out of Scope

| 항목 | 비고 |
|------|------|
| 대형 물품 카드(`goods-l.svg`) · cm·kg 문구 · **「50만 원 초과」 체크** | D4·D5 |
| 회사 공용 칩 · 출발/도착 별도 칩 목록 · 칩 순서 드래그 | D1 |
| **주소록 탭** · 최근 주소 개별/전체 삭제 · 주소록 저장 체크 | D2 |
| 퀵 요청 자체의 DB 이력·관리자 목록 · 실카톡 API · `redirectUrl` | 82/83 Phase 2 `[TBD]` |
| notify Route activity log | 501 placeholder 유지 (86 AC-22) |
| Daum `zonecode`·`buildingName`·지번 저장/표시 | 도로명만 사용(현행 유지) |
| 개인정보처리방침(plan 60 계열) 개정 | 별도 plan `[TBD]` |
| 운영(Main) Supabase 적용 | 사용자 지시 전 금지 (D6) |
| git 커밋·PR | 파이프라인 밖 (사용자 `@commit-pr`) |

---

## UI 요구사항 (designer 지시)

| 항목 | 규칙 |
|------|------|
| 공통 | 86 UI 규칙 상속: 시맨틱 토큰·테마 radius/shadow 토큰만 사용, `Icons.*`, `cn()`, 터치 타깃 **min-h-11**, `min-w-0`·`break-keep`, 가로 스크롤 0 |
| 물품 크기 | 카드 4개(375에서는 `grid-cols-2` 권장, PC에서는 4열 또는 2열은 designer 결정). 이름 + 예시 1줄 + 일러스트(`bg-muted` 타일). 선택 상태는 `border-primary`+`bg-primary/5` 계열. 「기타」는 `Icons.*` 아이콘. **(r1)** 「물품 내용」 textarea(label 「물품 내용」, required, 500자, testid `quick-request-item-description`)는 **「기타」 선택 시에만** 카드 그리드 아래에 보인다. 별도 「물품 크기 (기타)」 Input은 없다. 숨김은 기존 패턴대로 **항상 마운트 + `hidden`**(TanStack unmount 시 meta 초기화 회피) |
| 특이사항 칩 | 출발·도착 각 group에 같은 칩. 「+」(`quick-request-note-add`) 위치와 편집·삭제 진입 방식은 designer가 결정한다. 칩이 10개면 「+」 비활성 또는 안내. 추가·수정은 shadcn `Dialog` + `Input`(30자, 카운터 권장). 삭제는 `AlertModal`(title 「특이사항 삭제」, description에 라벨 포함, confirmLabel 「삭제」, cancelLabel 「취소」) |
| 주소 검색 | `Dialog` title 「주소 검색」. `lg`↑에서는 가운데(폭 ~32–36rem, Daum 컨테이너 높이 ≥ 400px). `lg` 미만에서는 `h-dvh w-full max-w-none`, 모서리 없음(테마 토큰 `rounded-none`). Tabs 기본은 「주소 검색」. 스크롤 컨테이너는 1개이고 Daum `onresize`로 높이를 맞춘다. **Daum 하단 로고를 숨기지 않는다** |
| 최근 이용 내역 | 행 = 도로명 + 상세(2줄) + 담당·연락처(muted 1줄). 행 전체가 클릭 영역(≥44px). 빈 상태 문구 「최근 이용 내역이 없습니다.」. 로딩은 `PageLoadingSpinner variant='compact'` |
| shadcn 5곳 | In #6. 기존 testid·`role=radio` 이름·이미지 alt를 보존한다 |
| 로딩 | 칩 목록과 최근 주소 Read는 서버 prefetch + `useSuspenseQuery`. Suspense fallback은 Dialog 안에서 `compact`, 페이지는 기존 `loading.tsx` |

---

## API / DB 요구사항

### SQL — `supabase/sql/85_quick_request_notes_recent_addresses.sql`

> **번호 85는 원격 `list_migrations`로 확인하지 않은 값이다. backend-dev가 `WakeOne-Dev-Supabase-Mcp` `list_migrations`와 로컬 `supabase/sql/` 최대값으로 최종 확인한 뒤 확정한다.**
> 파일 상단에 메타(`Date`·`Status`·`Plan: 87_quick-request-goods-notes-address-picker-plan.md`·`Remote migration`)를 둔다(SQL 50·83 관례).

| 객체 | 정의 |
|------|------|
| `public.quick_request_notes` | `id bigint generated always as identity pk` · `user_id uuid not null → auth.users(id) on delete cascade` · `label text not null check (char_length(btrim(label)) between 1 and 30)` · `created_at timestamptz default now()` · `updated_at timestamptz default now()` · `unique (user_id, label)` · index `(user_id, created_at)` |
| 10개 상한 | `before insert` trigger: 같은 `user_id` 행이 10개 이상이면 `raise exception`(전용 errcode/메시지). Route는 이를 **409** 「특이사항은 최대 10개까지 등록할 수 있습니다.」로 매핑한다 |
| seed | `after insert on public.profiles` trigger로 `insert ('동승 필요') on conflict do nothing`. 실패해도 profile 생성을 막지 않도록 예외를 처리한다. **기존 profiles backfill**은 1회 실행한다 |
| `public.quick_request_recent_addresses` | `id bigint identity pk` · `user_id uuid not null → auth.users on delete cascade` · `road_address text not null` · `detail_address text not null` · `contact_name text not null` · `contact_phone text not null` · `last_used_at timestamptz not null default now()` · `created_at` · `unique (user_id, road_address, detail_address)` · index `(user_id, last_used_at desc)` · 길이 check(주소 ≤ 300, 이름 ≤ 100, 연락처 ≤ 20) |
| RPC | `public.record_quick_request_recent_addresses(p_user_id uuid, p_items jsonb) returns integer`. `security definer` + `set search_path = public`. upsert(충돌 시 contact·`last_used_at` 갱신) 후, 해당 사용자의 `last_used_at` 기준 11번째 이후 행을 delete하는 것을 **한 트랜잭션**으로 처리한다. `revoke execute … from public, anon, authenticated` → **service_role 전용** |
| RLS | 두 테이블 `enable row level security`. `*_self_select for select to authenticated using (user_id = auth.uid())`. `revoke insert, update, delete … from authenticated, anon` |
| down (파일 하단 주석) | drop RPC → drop seed trigger·함수 → drop limit trigger·함수 → `drop table quick_request_recent_addresses, quick_request_notes` |

- 적용은 **`WakeOne-Dev-Supabase-Mcp` `apply_migration`(dev `dgjtcxzfwlvpmryrkgzc`)만** 사용한다. 운영 Main MCP는 금지.

### API Route (backend-dev)

모든 Route에 공통으로 다음을 적용한다:
- `requireSession` + `profile.status === 'active'`
- 쓰기는 `getServiceRoleClient()` + **`user_id = session.userId` 조건 강제**
- 서버 로직은 `src/features/quick-request/api/service.server.ts`

| Route | Method | 요청 | 성공 응답 | action · target_type | 로그 |
|---|---|---|---|---|---|
| `src/app/api/quick-request/notes/route.ts` | GET | — | 200 `{ success, data: { notes: { id, label }[] } }` (`created_at` asc) | — | **Out (Read)** |
| 〃 | POST | `{ label }` | **201** `{ success, data: { note } }` | `quick_request.note_create` · `quick_request_note` | 전 분기 |
| `src/app/api/quick-request/notes/[id]/route.ts` | PATCH | `{ label }` | 200 `{ success, data: { note, previousLabel } }` | `quick_request.note_update` · `quick_request_note` | 전 분기 |
| 〃 | DELETE | — | 200 `{ success, data: { id, label } }` | `quick_request.note_delete` · `quick_request_note` | 전 분기 |
| `src/app/api/quick-request/recent-addresses/route.ts` | GET | — | 200 `{ success, data: { addresses: { roadAddress, detailAddress, contactName, contactPhone, lastUsedAt }[] } }` (≤10, desc) | — | **Out (Read)** |
| 〃 | POST | `{ locations: { roadAddress, detailAddress, contactName, contactPhone }[] }` (1~N, Zod · 연락처 `PHONE_REGEX`) | 200 `{ success, data: { count } }` | `quick_request.recent_address_record` · `quick_request_address` | 전 분기 |
| `src/app/api/quick-request/notify/route.ts` | POST | body schema `goodsSize` 필수. **(r1)** `goodsSizeOtherText` **제거**. `itemDescription`은 `goodsSize==='other'`일 때만 trim 후 1자 이상 필수(최대 500), 그 외는 빈 문자열 허용 | **501** 유지 | — | **0건 유지** |

#### return 분기 매트릭스 (CUD 공통 · 모든 분기에서 `recordActivityLog` + `x-request-id`)

| HTTP | 조건 | message (예) | metadata |
|------|------|--------------|----------|
| 401 | 미인증 | 인증이 필요합니다. | `error_code` |
| 403 | 비활성/pending | 활성화된 계정만 접근할 수 있습니다. | `error_code` |
| 400 | JSON 파싱 실패 · Zod 실패(빈 라벨, 31자, 잘못된 locations) | 특이사항을 입력해 주세요. / 30자 이내로 입력해 주세요. / 필수 항목을 확인해 주세요. | `error_code`, `validation_errors` |
| 404 | PATCH/DELETE: id 없음 또는 타인 소유 | 특이사항을 찾을 수 없습니다. | `error_code` |
| 409 | 중복 라벨 / 10개 상한 | 이미 등록된 특이사항입니다. / 특이사항은 최대 10개까지 등록할 수 있습니다. | `error_code` |
| 500 | DB 오류 | 처리 중 오류가 발생했습니다. | `error_code` |
| 201/200 | 성공 | — | 칩: `changed_fields` · 최근 주소: `count` |

- **target_label:** 칩은 라벨 문자열, 최근 주소는 `최근 주소 {count}건`.
- **주소·이름·전화는 activity log에 절대 기록하지 않는다.** 기존 `METADATA_ALLOWLIST` 키(`error_code`·`validation_errors`·`changed_fields`·`count`)로 충분하며 allowlist 추가는 없다.
- 수정 파일: `src/features/activity-logs/api/types.ts`(`ActivityAction` 4개, `ActivityTargetType` `quick_request_note`·`quick_request_address`), `src/features/activity-logs/labels.ts`(`Record<ActivityAction,string>`이므로 **누락 시 tsc 실패**). 한국어 라벨 예: 「퀵 특이사항 추가」·「퀵 특이사항 수정」·「퀵 특이사항 삭제」·「퀵 최근 주소 기록」.

### FE service layer

```
src/features/quick-request/api/
  types.ts       ← QuickRequestNote · QuickRequestRecentAddress · payload/response
  service.ts     ← fetch /api/quick-request/{notes,notes/[id],recent-addresses,notify}
  queries.ts     ← (신규) quickRequestNotesQueryOptions · quickRequestRecentAddressesQueryOptions
  mutations.ts   ← createNote · updateNote · deleteNote · recordRecentAddresses · notify (onSettled invalidate)
  keys.ts        ← (선택) quickRequestKeys.all / notes() / recentAddresses()
```

- 서버 prefetch는 `page.tsx`에서 `void queryClient.prefetchQuery` + `HydrationBoundary`로 한다(announcements 패턴, 서버 queryFn은 `service.server.ts`).
- 컴포넌트는 `useSuspenseQuery`와 `useMutation({ ...xxxMutation, onSuccess: UI })`만 쓴다. invalidate는 `mutations.ts`의 `onSettled`에서만 한다.
- 칩 추가·수정 Dialog 폼은 성공 시 **reset**, 실패·취소 시 유지한다(core-conventions §폼 초기화).

---

## 활동 감사 로그 (기록 연동)

> `core-conventions.mdc` §활동 감사 로그 · [plan 08](./08_activity-audit-log-plan.md)

| Route | Method | action | target_type | 기록 분기 |
|-------|--------|--------|-------------|-----------|
| `/api/quick-request/notes` | POST | `quick_request.note_create` | `quick_request_note` | 401·403·400·409·500·201 |
| `/api/quick-request/notes/[id]` | PATCH | `quick_request.note_update` | `quick_request_note` | 401·403·400·404·409·500·200 |
| `/api/quick-request/notes/[id]` | DELETE | `quick_request.note_delete` | `quick_request_note` | 401·403·404·500·200 |
| `/api/quick-request/recent-addresses` | POST | `quick_request.recent_address_record` | `quick_request_address` | 401·403·400·500·200 |
| `/api/quick-request/notes` · `/recent-addresses` | GET | — | — | **Out (Read)** |
| `/api/quick-request/notify` | POST | — | — | **Out**: 501 placeholder (86 AC-22 / 본 AC-23) |

- 검증 AC: **AC-13 · AC-19** (API 테스트로 `GET /api/activity-logs` 행 확인). 삭제 확인 `AlertModal`: **AC-09**.

---

## 86 supersede 표

| 86 항목 | 87에서 |
|---------|--------|
| AC-07 (물품 내용 필수) | **(r1) supersede**: 「물품 내용을 입력해 주세요.」는 **「기타」 선택 시에만** 발생. 크기 카드 선택 시 입력칸 미노출·검증 없음. 크기 미선택 에러는 AC-02 (AC-02·03·04) |
| AC-12 (출발 특이 칩 1개 = 「주차 협조 필요」) | 칩을 seed 「동승 필요」로 교체하고 group + role 셀렉터 사용 (AC-06) |
| AC-13 · AC-16 (확인 → 501·복사·reset) | reset 대상에 `goodsSize` 추가 + 최근 주소 병렬 기록, 기록 실패 시 흐름 유지 (AC-22) |
| AC-14 · AC-19 (반응형·THEMES 스모크) | **유지** + 375 주소 검색 dialog 스모크 추가 (AC-16·26) |
| AC-18 (터치 타깃 측정 「특이 칩 1」) | 측정 대상을 「동승 필요」 칩(role 셀렉터)으로 변경 |
| AC-20 (색·radius grep) · AC-05 (Presence) · AC-22 (notify 로그 0) | **유지** (AC-26·공통·AC-23) |
| testid `quick-request-{origin\|destination}-note-{문구}` | `-note-{id}` + group testid로 변경 |
| `-address-search` 동작 (Daum popup) | Dialog 열기 (testid 유지) |
| Out 「물품 크기 카드」「최근 이용 내역」 | **In** (주소록·주소록 저장 체크는 계속 Out) |
| Out 「폼 schema·notify payload·메시지 포맷 불변」 | **해제**: `goodsSize` 추가, 메시지 `크기:` 줄. **(r1)** `물품:` 줄은 「기타」일 때만 |
| Out 「DB 저장」 | 칩·최근 주소 테이블은 **In**, 퀵 요청 이력 DB는 계속 Out |
| 「activity log 해당 없음」 | 신규 CUD Route 4종 **In**, notify만 계속 Out |
| 「backend-dev 생략」 | **backend-dev 실행** (SQL 85 + Route 3파일) |
| 미사용 자산 「goods 이미지」 | `goods-{xs,s,m}.svg` 사용 (`goods-l.svg`는 계속 미사용) |

---

## 영향 파일 & 패턴

| 팀 | 경로 | 작업 |
|----|------|------|
| BE 신규 | `supabase/sql/85_quick_request_notes_recent_addresses.sql` | 테이블 2, trigger 2, RPC, RLS, backfill, down 주석 |
| BE 신규 | `src/app/api/quick-request/notes/route.ts` · `notes/[id]/route.ts` · `recent-addresses/route.ts` | GET/POST/PATCH/DELETE + 로그 |
| BE 신규 | `src/features/quick-request/api/service.server.ts` | service-role 데이터 접근 · RPC 호출 |
| BE 수정 | `src/features/activity-logs/api/types.ts` · `src/features/activity-logs/labels.ts` | action 4 · target_type 2 · 라벨 |
| BE 수정 | `src/features/quick-request/schemas/quick-request-notify.ts` · `src/app/api/quick-request/notify/route.ts`(schema만) | `goodsSize` · (r1) `goodsSizeOtherText` 제거 · `itemDescription` 조건부 필수 |
| FE 수정 | `src/features/quick-request/api/{types,service,mutations}.ts` + 신규 `queries.ts`(·`keys.ts`) | service layer |
| FE 수정 | `src/app/dashboard/quick/request/page.tsx` | prefetch + HydrationBoundary |
| FE 수정 | `schemas/quick-request-form.ts` · `lib/{default-form-values,map-quick-request-notify,format-quick-request-message,quick-request-constants}.ts` | 크기 필드 · 메시지 · 칩 상수 제거 |
| FE 신규 | `lib/quick-request-goods-visuals.ts` · `public/quick-request/goods/goods-{xs,s,m}.svg` | 크기 이미지 |
| FE 수정 | `components/quick-request-goods-section.tsx` · `quick-request-goods-size-grid.tsx` · `quick-request-summary-content.tsx` · `lib/quick-request-goods-visuals.ts`(`formatQuickRequestGoodsSizeLabel` other 인자 제거) | 크기 카드 · 기타 시 물품 내용 · 요약 |
| FE 수정 | `components/quick-request-driver-notes-section.tsx` · `quick-request-note-cards.tsx` | DB 칩 · id testid |
| FE 신규 | `components/quick-request-note-editor-dialog.tsx` | 추가·수정 + 삭제 `AlertModal` 연동 |
| FE 수정/신규 | `components/daum-postcode-button.tsx` → embed 로더(파일명 변경 허용) · 신규 `quick-request-address-picker-dialog.tsx` | embed · Tabs · 최근 목록 |
| FE 수정 | `components/quick-request-field-controls.tsx` · `quick-request-location-section.tsx` | picker 연결 · 4칸 채움 · RadioCard shadcn |
| FE 수정 | `components/quick-request-order-page.tsx` | 확인 시 notify + recent 병렬 · reset |
| FE 수정 | `components/quick-request-vehicle-section.tsx` · `quick-request-mobile-summary-bar.tsx` · `quick-request-address-section.tsx` · `quick-request-confirm-board.tsx` | shadcn 5곳 |
| 선택 | `src/components/icons.tsx` | 편집·기타 아이콘 키 추가 시만 |
| verifier 수정 | `e2e/quick-request/{helpers.ts, order-page.spec.ts, responsive.spec.ts, theme.spec.ts, notify.api.spec.ts}` | 크기 선택 · 칩 셀렉터(`order-page.spec.ts:173`, `responsive.spec.ts:141`, `helpers.ts:201`) · body `goodsSize` · picker 스모크 |
| verifier 신규 | `e2e/quick-request/{notes.spec.ts, address-picker.spec.ts, notes.api.spec.ts, recent-addresses.api.spec.ts}` | AC-06~21 |
| verifier 수정 | `scripts/cleanup-e2e-mock-data.mjs` | fixture 칩을 seed 1개로 되돌리고 E2E 최근 주소 삭제 |

**패턴:** SQL 50/83 RLS(본인 select + 쓰기 revoke), `wallet/balance-email/preferences/route.ts`·`announcements/[id]/route.ts`의 `jsonWithActivityLog` 전 분기, announcements `queries.ts` + 서버 prefetch, `AlertModal`(`confirmLabel`), `useAppForm`, e2e `*.api.spec.ts`의 `x-request-id` 패턴(`e2e/contracts/import.api.spec.ts` 등).

**의존성/호출자:** `QUICK_REQUEST_*_NOTE_OPTIONS`는 `driver-notes-section`만 사용한다. `DaumPostcodeButton`은 `field-controls`만 사용한다. `QuickRequestRadioCard`는 schedule·freight 섹션이 사용한다. `labels.ts`의 `Record` 타입이 action 추가 누락을 build 단계에서 잡는다.

---

## 리스크 & 완화

| 수준 | 리스크 | 완화 |
|------|--------|------|
| HIGH | 모바일에서 Daum embed iframe이 Dialog 안에서 스크롤·터치가 안 되거나 높이가 0으로 렌더됨 (Radix `position:fixed`, iOS Safari, 열린 직후 컨테이너 크기 0) | Drawer 미사용. Dialog가 열린 뒤 ref 콜백에서 `embed`. 스크롤 컨테이너 1개. 높이 ≥ 400px + `onresize`. `lg` 미만은 `h-dvh` 전체화면. **FE Step 3a spike → Checkpoint 1**에서 iPhone 확인. 실패하면 「모바일은 주소 칸 아래 inline 펼침」으로 축소하는 안을 사용자에게 보고 |
| HIGH | **제3자 개인정보(담당자 이름·연락처) 저장** — 사용자 승인됨(2026-10-21) | 본인만 select(RLS), 쓰기는 service role만, 사용자당 10개 prune, auth.users 삭제 시 cascade, activity log에 주소·이름·전화 미기록(AC-19), 처리방침 개정은 별도 plan `[TBD]`. 대안 B(주소+상세만)로 바꿀 경우 비용: 컬럼 2개, RPC, 매핑 1곳, AC 1~2개, 약 15~20분 |
| HIGH | e2e가 iframe 안의 실제 Daum 검색을 판정할 수 없음 (외부 서비스, 네트워크 불안정) | AC는 dialog 열림, popup 0건, 컨테이너 표시, 최근 선택 채움까지만 판정. 실제 검색은 AC-28 수동 QA. 도로명 직접 입력을 유지해 기존 e2e 경로 보존 |
| MED | fixture 계정 데이터 오염(10개 상한 테스트, 최근 주소 누적)으로 spec 순서 의존 실패 | spec `beforeEach`·`afterEach`에서 API로 `E2E` 접두 칩 정리, 상한 테스트 후 정리, cleanup 스크립트 확장, 최근 주소는 10개 prune으로 크기 고정 |
| MED | 칩 이름 변경·삭제 후 폼에 남은 옛 문자열이 메시지로 전송됨 | mutation 성공 콜백에서 폼 notes 치환·제거 (AC-08·09) |
| MED | `labels.ts`·`ActivityTargetType` 누락 → tsc/build 실패, 또는 Route 분기 일부에서 로그 누락 | BE 체크리스트 + verifier grep(Route 파일별 return 수 = `recordActivityLog`/`jsonWithActivityLog` 수) + AC-13·19 |
| MED | 86 spec(칩 문구 testid, 터치 타깃 대상)이 깨짐 | 86 supersede 표에 따라 helpers와 spec 3곳을 먼저 수정 |
| LOW | seed trigger가 profiles insert 체인(SQL 02·56·72)과 충돌 | `on conflict do nothing` + 예외 처리. dev에서 신규 profile insert로 AC-14 확인 |
| LOW | SQL 번호 85 충돌 (원격 미확인) | backend-dev가 `list_migrations`로 확인한 뒤 확정하고, 바뀌면 이 plan의 SQL 번호만 수정 이력에 기록 |
| LOW | goods SVG의 고유 hex 색이 다크모드에서 튐 | `bg-muted` 타일 + AC-28 육안. `public/`이라 AC-26 grep 대상 아님 |

---

## Battle Plan (단계)

| # | 단계 | 산출물 | Confidence | 의존 |
|---|------|--------|------------|------|
| 0 | **root**: tar 스냅샷 (레포 밖) | `quick-request-baseline-plan87.tar.gz` | HIGH | — |
| 1 | **designer**: 크기 카드, 칩 + 추가·편집·삭제 UX, 주소 picker(PC/모바일, Tabs, 최근 행, 빈 상태), shadcn 5곳 매핑, 44px, 테마 토큰 | 디자인 산출물 | MED | 0 |
| 2 | **backend-dev**: `list_migrations`로 번호 확인 → SQL 85 작성·dev `apply_migration` → `service.server.ts` → Route 3파일(전 분기 로그) → activity types/labels → notify schema `goodsSize` → AC-27 SQL 확인 | Route 동작 · 로그 행 | HIGH | 1 |
| 3a | **frontend-dev (위험 우선)**: Daum embed + Dialog spike (PC·375) | embed 동작 | **MED~LOW** | 2 |
| 3b | **frontend-dev**: picker Tabs·최근 이용 내역 query·선택 채움·확인 시 병렬 기록 | 최근 주소 | MED | 3a |
| 4 | **frontend-dev**: 물품 크기 (schema·map·메시지·요약·SVG) | 크기 반영 | HIGH | 1 |
| 5 | **frontend-dev**: 칩 CRUD UI + AlertModal + 폼 notes 동기화 + 상수 제거 | 칩 관리 | MED | 2 |
| 6 | **frontend-dev**: shadcn 5곳 교체 (testid·role·alt 보존) | 교체 완료 | HIGH | 1 |
| 7 | **verifier**: e2e 수정·신규 + cleanup 확장 → `npx playwright test e2e/quick-request` · tsc · lint · react-doctor · `npm run build` · grep AC · `npm run e2e:cleanup` | green 보고 | MED | 2~6 |

- **Checkpoint 1 (Step 3a 직후):** PC Chrome과 iPhone Safari(최소 375 에뮬레이터 + 실기기 1회)에서 검색 → 선택 → 도로명 채움을 확인한다.
- **Checkpoint 2 (Step 5 직후):** 칩 추가·수정·삭제 → 미리보기 메시지에 반영 → `/dashboard/logs`에 action 3행.

**Step 0 백업 (root 실행 · 예시):**

```bash
cd /Users/hoon/Desktop/Wake_Auto/WakeOne-web
tar -czf ../quick-request-baseline-plan87.tar.gz \
  src/features/quick-request \
  src/app/dashboard/quick \
  src/app/api/quick-request \
  e2e/quick-request \
  src/features/activity-logs/api/types.ts \
  src/features/activity-logs/labels.ts \
  scripts/cleanup-e2e-mock-data.mjs
tar -tzf ../quick-request-baseline-plan87.tar.gz | head
```

### ROLLBACK

1. **FE/BE 코드:** 신규 파일(`public/quick-request/goods`, 신규 Route·컴포넌트·spec)을 삭제하고 스냅샷을 복원한다.
   ```bash
   cd /Users/hoon/Desktop/Wake_Auto/WakeOne-web
   rm -rf src/features/quick-request src/app/dashboard/quick src/app/api/quick-request e2e/quick-request public/quick-request/goods
   tar -xzf ../quick-request-baseline-plan87.tar.gz
   ```
2. **DB (dev):** SQL 85 하단의 down 주석을 `WakeOne-Dev-Supabase-Mcp`로 실행한다(RPC → trigger·함수 → 테이블 drop).
3. **activity log:** 이미 쌓인 로그 행은 append-only이므로 그대로 둔다.
4. `src/components/icons.tsx`에 키를 추가했다면 해당 키만 수동으로 제거한다.

### 추정

- 범위: SQL 1 · Route 3 + server service 1 · FE 신규 ~6 · FE 수정 ~16 · public SVG 3 · e2e 수정 5 + 신규 4 · cleanup 1 → **약 1,800–2,400줄**
- 복잡도: **Complex**
- designer 25–35분 · BE 60–90분 · FE 150–210분(embed spike 30–45분 포함) · e2e 70–100분 · 검증 30–40분 → **약 335–475분**

---

## 팀별 구현 순서

1. **root**: Step 0 tar 스냅샷
2. **designer**: UI 요구사항 · testid 보존 · 테마 토큰
3. **backend-dev**: Step 2 (Dev MCP만, Main 금지)
4. **frontend-dev**: Step 3a → 3b · 4 · 5 · 6
5. **verifier**: Step 7 · AC-01~29

## 검증 체크리스트 (verifier)

- [ ] `npx playwright test e2e/quick-request` green (UI + API spec)
- [ ] activity log API AC-13 · AC-19 (`x-request-id` + action 행)
- [ ] grep AC-09 · AC-23 · AC-24 · AC-25 · AC-26 · 86 AC-05(Presence)
- [ ] SQL AC-27 (Dev MCP `execute_sql`)
- [ ] tsc · lint · react-doctor · `npm run build`
- [ ] `npm run e2e:cleanup` exit 0
- [ ] AC-28 수동 QA 체크리스트 사용자 전달 (PC + iPhone · 3테마 × light/dark)

---

## 열린 질문

- 개인정보처리방침에 「퀵 요청 최근 주소(제3자 이름·연락처)」 처리 항목을 반영할지 → 별도 plan `[TBD]`
- SQL 번호 85 → backend-dev가 `list_migrations`로 최종 확인

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-10-21 | 최초 작성 · Approved · 물품 크기 카드 · 사용자별 특이사항 칩(SQL 85, 10개, 「동승 필요」 seed) · Daum embed 주소 검색 Dialog · 최근 주소 10개(담당자·연락처 포함, 사용자 승인) · shadcn 5곳 · 86 일부 AC·Out supersede | planner |
| 2026-10-21 | **r1 (사용자 요청)**: 「물품 내용」 입력칸을 **「기타」 선택 시에만** 노출·필수로 변경. `goodsSizeOtherText`·「물품 크기 (기타)」 입력칸 제거 → `itemDescription` 통합. notify schema 조건부 필수(501·로그 0 유지). 메시지 `크기:` 줄 우선, `물품:` 줄은 기타만. 요약 「물품」 행 기타만. AC-01·03·04·05·22·25 수정, 86 AC-07 supersede. DB·SQL·칩·최근 주소 변경 없음. Status Approved 유지(재구현) | planner |
