# 개요 생일 카드 휠 목록 기획서

> Date: 2026-10-29
> Status: Completed
> **verifier (2026-10-29):** AC-01~21 전부 pass · `e2e/birthdays/102-overview-birthday-list.spec.ts` 25 passed(셋업 4 + 21) · 2회 연속 green · 95 spec AC-04 추가 20 passed · `node --test` 28/28 · tsc·lint:strict·build exit 0 · react-doctor birthday 파일 92/100(error 0) · `npm run e2e:cleanup` exit 0 · remaining 0 · 구현 수정 요청 0 · 루프 0회
> Author: planner
> **/root 단일 게이트** — deep-interview 답변(2026-10-29) 반영 후 Phase 2~4 연속 진행 · `go` 게이트 없음(워크스페이스 CLAUDE.md §/root 게이트)
> **Supersedes:** [10](./10_dashboard-birthday-profile-sheet-plan.md)의 **overview 생일 배너 부분**(캐러셀 · 「이번 달 생일」/31일 창 · 세션당 1회 컨페티 · AC #1~#6 · #11~#12 · `GET /api/birthdays/this-month`). plan 10의 프로필 Account Sheet 부분은 해당 없음(이미 [21](./21_user-profile-slim-migration-plan.md)에서 철회)
> **선행:** [10](./10_dashboard-birthday-profile-sheet-plan.md), [19](./19_user-single-name-plan.md), [26](./26_loading-spinner-unification-plan.md), [58](./58_approval-birthday-optional-user-add-removal-plan.md), [89](./89_quick-workflow-dongbang-openchat-plan.md), [95](./95_dongbang-visibility-audit-plan.md)
> **SQL:** 없음 · **BE:** 있음(조회 API 교체·순수 함수) · **activity log:** 해당 없음 · **이메일:** 없음

## 선행 plan 참조 (Phase 0)

| Plan | Status | 관계 |
|------|--------|------|
| **10** | Approved(README) | overview 생일 배너·컨페티를 처음 만든 plan. 이 plan이 **배너 부분을 대체**한다. 노출 필드 최소화(email·phone 제외)·KST 기준·service-role 조회·0명이면 카드 숨김은 **유지** |
| **19** | Completed | 이름은 `full_name` 단일 필드. 그대로 사용 |
| **21** | Completed | 본인 프로필 「수정」 Sheet 철회 — plan 10의 `patchProfileMutation` 생일 쿼리 invalidate도 함께 사라짐(코드 grep 0건). 이 plan과 충돌 없음 |
| **26** | Approved | **overview는 skeleton 유지**(Spinner 통일 대상 아님). 생일 카드 skeleton은 Skeleton 그대로 두고 모양만 새 목록에 맞춘다 |
| **58** | Completed | `birthday` null인 active 사용자 **제외** — 회귀 AC로 유지 |
| **89 · 95** | In Progress · Completed | 동방특송(`affiliation='dongbang'`)은 overview 자체에 못 들어오고(allowlist), 생일 명단에서도 **서버 기본 제외**(95 감사표 S-10a). 이번 쿼리는 95 원칙대로 `applyDongbangScope`로 옮긴다. 새 API는 동방 allowlist에 넣지 않는다(기본 403) |
| **63 · 89** | Approved · In Progress | 소속 상수 `ORG_AFFILIATIONS`(`wake`·`sans`·`sans_foundry`)·`ORG_AFFILIATION_OPTIONS` 라벨 재사용. 탭 순서는 사용자 지시(전체·웨이크·산스·산스파운드리) [r3] |
| **08** | Approved | 조회 전용이라 **activity log 해당 없음** |

### 정찰로 확인한 사실 (2026-10-29)

- **코드가 plan 10과 이미 다르다(기록 없음):** 지금은 「다가오는 생일」 31일 창(`BIRTHDAY_UPCOMING_WINDOW_DAYS = 31`) · 남은 날 순 정렬 · API 이름은 그대로 `/api/birthdays/this-month`.
- **컨페티:** 생일자가 1명이라도 있으면(당일이 아니어도) 탭 세션마다 하루 1번(`sessionStorage` `wakeone:birthday-confetti:{referenceDate}`). 사용자가 바꾸려는 동작.
- **생일 카드는 지금 눌러도 반응이 없다.** plan 10의 「프로필 Sheet」는 내 프로필 수정 화면이었고 생일 카드와 무관.
- **API 사용처:** `GET /api/birthdays/this-month`를 부르는 곳은 `features/birthday-celebrants/api/service.ts`뿐이고, 그 `queries.ts`를 쓰는 곳은 0건(overview는 RSC가 `getBirthdayCelebrantsServer()`를 직접 호출). `e2e/`·`proxy.ts`·동방 allowlist·SW에 참조 0건.
- **`embla-carousel-auto-height`** 는 생일 배너만 쓴다(첨부 lightbox는 `ui/carousel`만 사용).
- **e2e에 생일 배너 spec이 없다.**
- **카드 실측(현재):** 1440 → 567×414 · 1280 → 498×414 · 1024 → 389×414 · 390 모바일 → 358×375. 위치는 `overview/layout.tsx` 왼쪽 열(`col-span-4 md:col-span-3`) 맨 위(생일 → 공지 → 식대).
- **Dev DB 집계(읽기 전용):** active 비동방 35명(웨이크 21 · 산스 5 · 산스파운드리 8 · 소속 없음 1) 중 생일 등록 34명. 매달 1~4명씩 분포. active 35명 중 33명 아바타 없음 → 이니셜 아바타가 기본.

## 한 줄 요약

`/dashboard/overview`의 생일 카드를 캐러셀에서 **가운데 줄이 강조되는 세로 휠 목록**으로 바꾼다. 상단 탭(전체·웨이크·산스·산스파운드리)으로 소속을 거르고, 처음 열면 **생일이 가장 가까운 사람이 가운데 줄**에 오며(위: 지난 생일 · 아래: 나중 생일), 폭죽은 **오늘 생일인 사람이 있을 때만 브라우저당 하루 1번** 터진다.

## 시안

- 확정안: **A안 · 가운데 줄 강조 휠 목록** — `/private/tmp/claude-501/-Users-hoon-Desktop-Wake-Auto/9dd323e6-e2bc-4784-84f2-eeeb10869e76/scratchpad/birthday-mockups/option-a.png`
- 생일 당일·폭죽 규칙 3장면 — `…/birthday-mockups/birthday-today.png`
- 직접 만져 보는 시안(탭·스크롤·가운데 이동·컨페티 다시 보기) — `…/birthday-mockups/index.html` (같은 폴더 `happy-birthday-lottie.js` 필요)
- 시안은 세션 스크래치 경로라 사라질 수 있다. 사라져도 아래 §UI 요구사항만으로 구현 가능하도록 적었다.

## 정책 확정안 (deep-interview 2026-10-29)

| # | 항목 | 확정 |
|---|------|------|
| D-1 | 화면 방식 | **A안** 휠 목록 (Q1) |
| D-2 | 목록 대상 | overview를 볼 수 있는 사람 = **active · 동방특송 아님 · `birthday` 있음** 전원 (Q2 가). inactive·`pending_approval`·`rejected`·생일 미설정 제외 |
| D-3 | 순서 | 오늘(KST) 기준 **앞뒤 반년 순환**: `days_offset` = 다음 생일까지 남은 날(0~182)이면 그 값, 183일 이상이면 `-(지난 생일부터 지난 날)`. `days_offset` 오름차순 → 같은 값은 `full_name` 가나다(`localeCompare('ko')`). **앞뒤 거리가 같으면(2월 29일이 낀 366일 구간, 예: 기준 2027-12-01 · 생일 06-01 → 183일씩) 지난 생일 쪽 `-183`으로 둔다** [r1]. 위 = 지난 생일, 아래 = 나중 생일 |
| D-4 | 가운데 사람 | 지금 보이는 목록(탭 적용 후)에서 **`days_offset ≥ 0`인 첫 사람**. 없으면 목록의 마지막 사람(가장 최근 지난 생일). 오늘 생일이 여러 명이면 가나다 첫 사람 |
| D-5 | 컨페티 | **회사 전체 목록(탭과 무관)에 `days_offset = 0`인 사람이 1명 이상**일 때만, 그 브라우저에서 **하루 1번**(그날 처음 overview를 열 때). 저장소는 `localStorage` 키 `wakeone:birthday-confetti:{referenceDate}` (Q3 가) |
| D-6 | 기본 탭 | **전체** (Q4 가). 고른 탭은 기억하지 않음(URL·저장소 미사용) |
| D-7 | 줄 클릭 | 누른 사람이 **가운데로 부드럽게 이동** (Q5 가). 다른 화면·Sheet 없음 |
| D-8 | 탭 | 전체 · 웨이크 · 산스 · 산스파운드리 (이 순서 [r3]). 소속 없는 사람(`affiliation` null)은 **전체에만** |
| D-9 | 표시 정보 | 이니셜/사진 아바타 · 이름 · 「M월 d일」 · 남은 날 칩(`D-DAY` / `D-n` / `n일 전`) · **전체 탭에서만** 소속 칩. **연도·나이·이메일·연락처 미표시** |
| D-10 | API 개인정보 | 생일은 **월·일(`MM-DD`)만** 내려준다(연도 제거 — 전원 명단이 되면서 나이가 노출되지 않게). email·phone 미포함 유지 |
| D-11 | 오늘 생일 표시 | 헤더 배지 「D-DAY!」(채움) + 「오늘은 {이름}님의 생일이에요!」(2명 이상이면 「오늘은 {첫 이름}님 외 {N}명의 생일이에요!」) · 해당 줄 칩 `D-DAY` + 작은 케이크 Lottie + 부제 「M월 d일 · 팀원들이 함께 축하합니다.」 · 카드 톤 `border-primary/30 bg-primary/5`(현행 유지) |
| D-12 | 평소 헤더 | 배지 「다가오는 생일」(outline + sparkles, 현행) + 오른쪽 작은 글씨 「오늘 {M월 d일} · 생일 등록 {N}명」(N = 지금 탭의 인원) |
| D-13 | 빈 상태 | 탭에 사람이 0명 → 목록 자리에 「생일이 등록된 사람이 없어요.」 · 회사 전체가 0명 → 카드 자체를 숨김(plan 10 유지) |
| D-14 | 움직임 줄이기 | `prefers-reduced-motion: reduce`면 컨페티·링 회전·Lottie·부드러운 스크롤 끔(즉시 이동). 이때 컨페티 저장 키도 쓰지 않음 |
| D-15 | 카드 크기 | PC: 지금 칸 그대로(너비는 레이아웃이 정함) · 높이 **414px 고정** · 모바일: 너비 꽉 채움 · 높이 **414px**(현행 375보다 약 40px 증가 — 사용자 이의 없음) |
| D-16 | 로딩 | overview Suspense fallback은 **Skeleton 유지**(plan 26) — 헤더·탭·줄 5개 모양 |
| D-17 | 2월 29일 | 평년에는 2월 28일을 생일 당일로 계산(현행 `composeBirthdayOccurrence` 규칙 유지). 표시는 「2월 29일」 |
| D-18 | API 이름 | `GET /api/birthdays/this-month` **삭제** → **`GET /api/birthdays`** 신규. 사용처가 기능 내부의 미사용 client fetch 1곳뿐이라 하위 호환 alias를 두지 않는다(옛 경로는 404). 동방 allowlist 미등록(403) |

## 목표 & 완료 기준 (AC)

**공통 테스트 메모 (날짜 의존 대응)**
- 기준일은 **서버(KST)** 가 정해 RSC·API로 내려준다. 브라우저 시계는 쓰지 않으므로 **Playwright clock은 쓰지 않는다**(바꿔도 결과가 안 바뀜).
- E2E는 먼저 `GET /api/birthdays`로 `referenceDate`를 읽고, **그 날짜 기준 상대 생일**로 일회용 사용자를 만든다: `createOrgChartTestUser(prefix, { fullName, affiliation, birthday, status })` (`e2e/helpers/org-chart.ts` · 이메일 `…@example.com`). 생일 연도는 **1992**(윤년)로 고정해 2월 29일 전후도 안전하게 만든다.
  - `S_today` 산스파운드리 · 오늘 · `S_plus2` 산스 · +2일 · `S_minus3` 웨이크 · -3일 · `S_noaff` 소속 null · +5일
  - 제외 확인용: `S_dongbang` 동방 · 오늘 · `S_inactive` 웨이크 · inactive · 오늘 · `S_pending` 웨이크 · `pending_approval` · 오늘 · `S_null` 웨이크 · 생일 null
  - 이름은 `E2E생일-{역할}-{난수}` 형식. 실직원 데이터와 섞이므로 **위치·개수는 API 응답으로 계산해서 비교**한다(고정 개수 금지).
- **세션 갱신 [r1]:** `e2e/.auth/dongbang.json`·`dongbang2.json` 등 저장 세션은 만료되면 401이 난다. verifier는 spec 실행 전에 auth setup 프로젝트(`setup-dongbang` = `e2e/auth.dongbang.setup.ts`, 필요 시 `setup`·`setup-user`)를 먼저 돌려 세션을 다시 만든다.
- **AC-04 동방 시드 [r2]:** 공용 동방 fixture 계정은 `birthday`가 null이라 「생일 명단 제외」를 증명하지 못한다. 그래서 `95-dongbang-visibility.spec.ts`에서는 **생일이 오늘인 일회용 동방 사용자**를 만들어 명단에 없음을 확인한다(cleanup 대상).
- **정리(cleanup):** `afterAll`에서 만든 auth 사용자 삭제 + `npm run e2e:cleanup`(일회용 `@example.com` 사용자는 `cleanup_e2e_mock_data` RPC 대상) → remaining 0 확인.
- 연말·연초 넘김, 반년 경계, 2월 29일, 동점 정렬은 **단위 테스트(`node --test`)** 로 고정 날짜 검증한다(AC-19).
- 실직원 중 오늘 생일인 사람이 있으면 「오늘 생일 없음」 E2E(AC-15 ②)는 `test.skip` + annotation으로 남기고 단위 테스트로 판정한다.

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| AC-01 | API | admin 세션 · 시드 사용자 생성 완료 | `GET /api/birthdays` | **200** · `data.referenceDate` = KST 오늘(`YYYY-MM-DD`) · `data.celebrants[]` 각 항목 키가 정확히 `user_id`·`full_name`·`avatar_url`·`affiliation`·`month_day`·`days_offset` · `email`·`phone`·`birthday`(연도 포함) 키 **없음** · `month_day`는 `MM-DD` · `affiliation` ∈ {`wake`,`sans`,`sans_foundry`,null} · `days_offset` ∈ **[-183, 182]**(-183은 D-3 동점 규칙 [r1]) · 배열이 `days_offset` 오름차순(동점은 `full_name` 가나다) · `S_today`=0 · `S_plus2`=2 · `S_minus3`=-3 |
| AC-02 | API | `e2e/.auth/user.json`(non-admin) | `GET /api/birthdays` | **200** · AC-01 admin 응답과 `user_id` 목록 **동일** |
| AC-03 | API | 비로그인 | `GET /api/birthdays` | **401** |
| AC-04 | API | `dongbang.json` (plan 95 회귀) | `GET /api/birthdays` | **403** 「접근 권한이 없습니다.」 · 그리고 AC-01 응답에 `S_dongbang`·`affiliation='dongbang'` 행 **0건**(S-10a) |
| AC-05 | API | AC-01 | 응답 확인 | `S_inactive`·`S_pending`·`S_null` **없음**(plan 58 AC-04 회귀 포함) |
| AC-06 | API | admin 세션 | `GET /api/birthdays/this-month` | **404** (옛 경로 삭제) |
| AC-07 | Playwright | admin · 1440×900 · 시드 완료 | `/dashboard/overview` | `getByTestId('birthday-celebrants-card')`가 같은 열 **맨 위**(공지 카드 `announcements-overview-card`가 있으면 그보다 위) · 탭 4개 `getByRole('tab')` 이름 순서 「전체」「웨이크」「산스」「산스파운드리」 [r3] · 「전체」 `aria-selected="true"` · 줄 `getByTestId('birthday-row')`의 `data-days-offset`가 위→아래 **줄지 않는 순서** · `S_minus3` 줄이 `S_today` 줄보다 위, `S_today`가 `S_plus2`보다 위 · 행 수 = AC-01 응답 길이 |
| AC-08 | Playwright | AC-07 | 첫 화면(스크롤 조작 없음) | 가운데 줄(`aria-current="true"`, 1개뿐)의 `data-user-id` = AC-01 응답에서 `days_offset ≥ 0`인 **첫 항목** · 그 줄의 세로 중심이 목록 영역(`getByTestId('birthday-wheel')`) 세로 중심과 **±8px** · 가운데 줄 아바타에 링 표시 |
| AC-09 | Playwright | AC-07 | 「산스」 탭 클릭 | 모든 줄 `data-affiliation="sans"` · `S_plus2` 보임 · `S_minus3`·`S_today`·`S_noaff` 안 보임 · 가운데 줄 = 산스 인원 중 `days_offset ≥ 0` 첫 사람(API로 계산) · 「웨이크」 탭 → `S_minus3` 보임 · 「산스파운드리」 탭 → `S_today` 보임 · 세 소속 탭 어디에도 `S_noaff` 없음 · 「전체」로 돌아오면 `S_noaff` 보임 · **[r2] 헤더 인원 확인은 시드 전 실데이터 상태에서 따로 판정:** 오늘 생일자가 없을 때 「산스」 탭 헤더 「생일 등록 {N}명」의 N = API의 산스 인원. 시드(`S_today`)가 있거나 실데이터에 오늘 생일자가 있으면 헤더가 D-11 「오늘은 …생일이에요!」로 바뀌어 N이 안 보이므로 **이 부분만 skip**(annotation) |
| AC-10 | Playwright | AC-07 | 「전체」와 「웨이크」 탭 비교 | 「전체」 탭: 소속 있는 줄마다 소속 칩(「웨이크」「산스」「산스파운드리」) 표시 · `S_noaff` 줄은 칩 없음 · 「웨이크」 탭: 소속 칩 **0개** |
| AC-11 | Playwright | AC-07 | ① 목록을 한 줄(64px) 아래로 스크롤 ② 가운데가 아닌 줄 클릭 ③ 다른 줄에 포커스 후 Enter | ① 스크롤이 멈추면 다음 사람 줄이 가운데(`aria-current`) ② 클릭한 줄이 가운데로 이동(최대 1초 안) ③ 그 줄이 가운데로 이동 · 어떤 경우에도 페이지가 다른 곳으로 이동하지 않음 · Dialog·Sheet 안 열림 |
| AC-12 | Playwright | 시드 `S_today` 존재 | `/dashboard/overview` | 카드 헤더 배지 「D-DAY!」 · 헤더 문구가 「오늘은 」으로 시작하고 「생일이에요!」로 끝남 · `S_today` 줄 칩 「D-DAY」 · 부제에 「팀원들이 함께 축하합니다.」 · 카드 `aria-label="오늘 생일 축하"` |
| AC-13 | Playwright | `S_today` 존재 · 새 context(`localStorage` 비어 있음) | overview 첫 진입 | `birthday-celebrants-card`의 `data-confetti-fired="true"` · `localStorage['wakeone:birthday-confetti:{referenceDate}']` = `'1'` · `getByTestId('birthday-confetti-canvas')` 존재 |
| AC-14 | Playwright | AC-13 직후 같은 context | 새로고침 · 다른 메뉴 갔다가 overview 재진입 | 두 번 모두 `data-confetti-fired="false"` · 「D-DAY!」 배지는 그대로 |
| AC-15 | 단위 + Playwright(조건부) | ① 단위: 오늘 생일 없는 목록 ② E2E: 시드 **전**(serial 첫 테스트)에 `GET /api/birthdays`의 `days_offset=0`이 0건일 때만 실행 | ① `shouldFireBirthdayConfetti(list)` ② overview 진입 | ① `false` ② `data-confetti-fired="false"` · 배지 「다가오는 생일」 · 헤더 「오늘 M월 d일 · 생일 등록 N명」 · 「D-DAY!」 없음. 실데이터에 오늘 생일자가 있으면 ②는 skip + 사유 annotation |
| AC-16 | Playwright | `S_today` 존재 · `reducedMotion: 'reduce'` · 빈 `localStorage` | overview 진입 | `data-confetti-fired="false"` · 컨페티 저장 키 **없음** · Lottie 요소(`birthday-dday-lottie`) 0개 · 줄 클릭 시 즉시 가운데 이동 |
| AC-17 | Playwright | admin · 1440×900 / 1280×800 | overview | 생일 카드 높이 **414 ± 12px**(두 폭 모두) · 너비는 같은 열 아래 카드(공지 `announcements-overview-card`, 없으면 식대 요약 카드)와 **±2px** · 카드 밖으로 넘치는 글자 없음(`scrollWidth ≤ clientWidth`) · 가로 페이지 스크롤 없음 |
| AC-18 | Playwright | user · 390×844 | overview | 카드 좌우가 화면 안(x ≥ 0, right ≤ 390) · 높이 414 ± 12px · 탭 4개가 모두 카드 안에 보이고 탭 목록에 가로 스크롤 없음 · 목록을 손가락 스크롤(`mouse.wheel`/`scrollTop`)하면 가운데 줄이 바뀜 · `document.documentElement.scrollWidth ≤ 390` |
| AC-19 | 단위(`node --test`) | 고정 기준일 | `src/features/birthday-celebrants/lib/__tests__/birthday-order.test.mjs` | ① 기준 `2026-12-30` · 생일 `01-02` → `3` ② 기준 `2027-01-02` · `12-30` → `-3` ③ 기준 `2026-10-29` · `04-29`(다음 생일까지 182일) → `182` · `04-30`(다음 생일까지 183일 → 지난 생일 2026-04-30부터 182일) → `-182` ④ 기준 `2027-02-28` · `02-29` → `0` · 기준 `2028-02-28` · `02-29` → `1` · `2028-02-29` → `0` ⑤ 정렬: offset 같으면 가나다 ⑥ 가운데 index: `≥0` 첫 항목 / 전부 음수면 마지막 / 빈 배열 → -1 ⑦ `formatDaysOffsetLabel(0/2/-5)` → `D-DAY`/`D-2`/`5일 전` ⑧ 오늘 생일 헤더 문구 1명·2명 ⑨ `getBirthdayConfettiStorageKey('2026-10-31')` → `wakeone:birthday-confetti:2026-10-31` ⑩ `formatBirthdayMonthDay('10-31')`·`('1990-10-31')` → 둘 다 `10월 31일` · 전부 pass |
| AC-20 | 정적(grep·코드) | 구현 완료 | 코드 확인 | ① `overview/layout.tsx` 생일 Suspense fallback이 `BirthdayCelebrantsBannerSkeleton`(Skeleton 기반, `data-testid="birthday-celebrants-skeleton"`) — Spinner 아님(plan 26) ② `birthday-celebrants/api/service.server.ts`가 `applyDongbangScope` 사용(plan 95) ③ `src/features/birthday-celebrants`에 `embla`·`Carousel`·`sessionStorage` 0건 ④ `src/app/api/birthdays/this-month` 디렉터리 없음 ⑤ `package.json`에 `embla-carousel-auto-height` 없음 ⑥ 회사 전체 0명이면 섹션 `null` 반환 · 탭 0명이면 「생일이 등록된 사람이 없어요.」 분기 존재 |
| AC-21 | CLI | — | `npx tsc --noEmit` · `npm run lint:strict` · `node --test src/features/birthday-celebrants/lib/__tests__/*.test.mjs` · `npm run build` · 신규 spec · `npm run e2e:cleanup` | 전부 통과 · cleanup remaining 0 |

**회귀:** plan 95 AC-09(동방 제외) · plan 58 AC-04(생일 null 제외) · overview 공지·식대·Live·데모 차트 카드 표시 유지 · 첨부 lightbox 캐러셀(`ui/carousel`) 동작 유지.

## 범위 (In / Out)

### In

| 순서 | 영역 | 내용 |
|------|------|------|
| 1 | BE · 순수 함수 | `src/features/birthday-celebrants/lib/birthday-order.ts` 신규 — `getBirthdayDaysOffset(monthDay, referenceDate)` · `sortCelebrants` · `findCenterIndex` · `shouldFireBirthdayConfetti` · `formatDaysOffsetLabel` · `buildTodayBirthdayHeadline` · `getBirthdayConfettiStorageKey`(`lib/confetti.ts`에서 이동). **런타임 import 없이(타입 import만)** 작성해 `node --test`가 직접 불러오게 한다(`quick-request/lib/place-search.ts` 패턴). 단위 테스트 `lib/__tests__/birthday-order.test.mjs` |
| 2 | BE · 조회 | `api/service.server.ts` 재작성 — `applyDongbangScope` · `status='active'` · `birthday not null` · select에 `affiliation` 추가 · 31일 창 제거 · `month_day`·`days_offset` 계산 · D-3 정렬 · 응답에서 연도 포함 `birthday` 제거 |
| 3 | BE · Route | `src/app/api/birthdays/route.ts` **신규** GET(`requireSession` · 500 「생일자 목록을 불러오지 못했습니다.」 유지) · `src/app/api/birthdays/this-month/` **삭제** |
| 4 | BE · 타입·클라이언트 | `api/types.ts`(`BirthdayCelebrant` = `user_id`·`full_name`·`avatar_url`·`affiliation`·`month_day`·`days_offset` · `BirthdayCelebrantsResponse` = `referenceDate`·`celebrants`, `windowDays` 제거) · `api/service.ts`·`api/queries.ts` 경로·이름 정리(`fetchBirthdayCelebrants` · `birthdayCelebrantsKeys.list()`) |
| 5 | BE · 공용 lib 정리 | `src/lib/birthday.ts`의 `BIRTHDAY_UPCOMING_WINDOW_DAYS`·`isBirthdayWithinUpcomingWindow`·`getDaysUntilBirthday`·`getNextBirthdayOccurrence`는 이 기능만 쓰므로 순수 모듈로 옮기고 삭제(사용처 grep 0 확인 후) · `@/lib/format-date` `formatBirthdayMonthDay`가 `MM-DD`도 받도록 확장(기존 `YYYY-MM-DD` 호출 회귀 없음) |
| 6 | designer | A안 시안 기준 컴포넌트 명세(클래스·크기·토큰·light/dark·THEMES 10종 확인·reduced motion) |
| 7 | FE · 카드 | `components/birthday-celebrants-wheel-card.tsx`(client, 이름은 FE 재량) — 헤더(D-11·D-12) · shadcn `Tabs`(전체 폭) · 휠 목록(D-3·D-4·D-7) · 소속 칩(D-9) · D-DAY 줄(D-11) · 빈 탭(D-13) |
| 8 | FE · 컨페티 | `lib/confetti.ts`의 `fireBirthdayConfetti`(카드 안 canvas) 유지 · 조건을 D-5로 변경 · `localStorage`(try/catch — 막힌 브라우저에서는 mount당 1번) · 키를 쓸 때 다른 날짜의 `wakeone:birthday-confetti:*` 키 정리 · `data-confetti-fired` 표시 |
| 9 | FE · 정리 | `birthday-celebrants-banner.tsx`·`birthday-celebration-slide.tsx` 삭제 · `birthday-celebrants-section.tsx`는 새 카드 렌더 · skeleton 모양 갱신(testid 유지) · `embla-carousel-auto-height` 의존성 제거(`npm uninstall`) · `birthday-d-day-lottie.tsx`는 크기 prop을 받아 줄 안 작은 크기(약 40px)로 재사용 |
| 10 | verifier | AC-01~21 · 신규 spec `e2e/birthdays/102-overview-birthday-list.spec.ts`(`chromium` 프로젝트 · admin 기본, user는 `browser.newContext({ storageState: 'e2e/.auth/user.json' })`) · AC-04 동방 403은 dongbang 인증이 있는 `e2e/quick-round2/95-dongbang-visibility.spec.ts`에 1 test 추가 · 단위 테스트 · 회귀 |

### Out

| 항목 | 비고 |
|------|------|
| DB·SQL 변경 | 없음 (`profiles.affiliation`·`birthday`·`status` 그대로) |
| 이메일·푸시·인앱 생일 알림 | 없음 (이메일 정책 — 이 기능은 이메일과 무관) |
| 줄 클릭 시 연락처·프로필 표시 | Q5 (가) — 가운데 이동만 |
| 고른 탭 기억(URL·저장소) | D-6 |
| 페이지를 연 채 자정이 지났을 때 자동 갱신 | 다음 진입 시 반영 |
| 생일 축하 메시지 남기기 등 상호작용 | 후속 |
| 동방특송 노출 | plan 95 원칙대로 제외 |
| 조직도 탭 순서 변경 | 조직도는 그대로 |
| activity log | **해당 없음** — 조회(Read)만 · 신규 CUD Route 없음 · 삭제 UI 없음(`AlertModal` 대상 없음) |

## UI 요구사항 (designer 지시)

> 기준 시안: A안(`option-a.png`). 현재 앱 토큰(기본 vercel 테마)과 shadcn 기본 컴포넌트를 그대로 쓴다.

| 요소 | 요구 |
|------|------|
| 카드 | shadcn `Card` · `data-testid="birthday-celebrants-card"` · 높이 414px 고정(D-15) · `overflow-hidden` · 오늘 생일 있으면 `border-primary/30 bg-primary/5`(현행) · `aria-label` 「다가오는 생일 축하」/「오늘 생일 축하」(현행 문구 유지) |
| 컨페티 canvas | 카드 안 `absolute inset-0` · 내용 뒤(z 아래) · `pointer-events-none` · `aria-hidden` · `data-testid="birthday-confetti-canvas"` |
| 헤더 | 왼쪽 `Badge`: 평소 `variant="outline"` + `Icons.sparkles` 「다가오는 생일」 / 당일 기본(채움) + sparkles 「D-DAY!」 · 오른쪽 `text-xs text-muted-foreground` 「오늘 {M월 d일} · 생일 등록 {N}명」 / 당일 `text-sm font-semibold text-foreground` D-11 문구 · 한 줄 말줄임 |
| 탭 | shadcn `Tabs`·`TabsList`(전체 폭)·`TabsTrigger` 4개 · 라벨은 `ORG_AFFILIATION_OPTIONS` 재사용 + 「전체」 |
| 휠 영역 | `data-testid="birthday-wheel"` · 남은 높이 전부 · 줄 높이 64px 고정 · 가운데 띠(`bg-muted` + `border`, `rounded-lg`, 당일은 `bg-card` + `border-primary/25`) · 위아래 끝 흐림(mask 약 14%) · 가운데에서 멀수록 작게·흐리게(시안 기준: 1줄 거리마다 scale -0.05, opacity -0.22, 최소 0.3) · `scroll-snap-type: y mandatory` · 스크롤바 숨김 · 첫 화면은 가운데 사람에 **즉시** 맞춤(애니메이션 없음) · 탭 바꾸면 그 탭의 가운데 사람에 즉시 맞춤 |
| 줄 | `<button>` · `data-testid="birthday-row"` · `data-user-id` · `data-affiliation` · `data-days-offset` · 가운데 줄 `aria-current="true"` · `aria-label` 「{이름} {M월 d일} {칩 문구}」 · 구성: `ProfileAvatar`(가운데 줄은 회전 conic 링, 당일은 진한 링 — 현행 slide 스타일 재사용) · 이름(가운데 `text-base`~`text-lg font-bold`, 나머지 `font-semibold`) · 전체 탭에서만 소속 칩(`text-[11px]` outline) · 부제 「M월 d일」(당일 줄은 「· 팀원들이 함께 축하합니다.」 추가) · 오른쪽 칩: `D-DAY` 채움 / `D-n` outline 굵게 / `n일 전` muted |
| 당일 Lottie | 당일 줄 칩 왼쪽 약 40px · `data-testid="birthday-dday-lottie"` · reduced motion이면 렌더 안 함 |
| 빈 탭 | 목록 자리 가운데 「생일이 등록된 사람이 없어요.」 `text-sm text-muted-foreground` |
| 모바일(<640) | 카드 패딩 축소(px-4) · 탭 4개 한 줄 · 줄 구성 동일 · 터치 스크롤 |
| Skeleton | 헤더 배지 1 · 탭 바 1 · 줄 5개(아바타 원 + 두 줄 텍스트) · 높이 414px · `data-testid="birthday-celebrants-skeleton"` 유지 |
| 테마 | 색은 시맨틱 토큰만(`muted`·`primary`·`border`·`card`) · light/dark 둘 다 확인 · THEMES 10종에서 깨짐 없음 |

## API / DB 요구사항

### `GET /api/birthdays` (신규 · `this-month` 대체)

| 항목 | 내용 |
|------|------|
| 인증 | `requireSession` — 로그인 사용자 전원(admin·user 동일 목록) · 동방은 proxy allowlist 미등록으로 **403** |
| 데이터 | `getServiceRoleClient()` · `profiles` select `user_id, full_name, avatar_url, affiliation, birthday` · `eq('status','active')` · `not('birthday','is',null)` · `applyDongbangScope(query)` |
| 기준일 | `getKstTodayDateString()`(`@/lib/kst`) |
| 계산 | `month_day` = `birthday`의 `MM-DD` · `days_offset` = D-3 · 정렬 D-3 |
| 오류 | 401 미인증 · 500 「생일자 목록을 불러오지 못했습니다.」 |

```ts
// 200
{
  success: true,
  data: {
    referenceDate: string; // 'YYYY-MM-DD' (KST)
    celebrants: Array<{
      user_id: string;
      full_name: string;
      avatar_url: string | null;
      affiliation: 'wake' | 'sans' | 'sans_foundry' | null;
      month_day: string;   // 'MM-DD' (연도 없음)
      days_offset: number; // -183..182 · 0 = 오늘 (-183은 366일 구간 동점 · r1)
    }>;
  }
}
```

- overview는 지금처럼 **RSC가 `getBirthdayCelebrantsServer()`를 직접 호출**한다(같은 응답 모양). Route는 API 소비자·테스트용.
- **하위 호환:** 옛 경로 사용처가 기능 내부 미사용 코드 1곳뿐이므로 alias 없이 삭제(404). 외부 소비자 없음(grep: `e2e/`·`proxy.ts`·`config/dongbang-routes.ts`·`public/` 0건).
- **DB:** 변경 없음 · SQL 파일 없음.

## 활동 감사 로그

> **activity log 해당 없음** — 조회(Read) 전용. 신규 CUD Route 없음. 삭제 UI 없음(`AlertModal` 대상 없음).

## 이메일

> 이 기능은 이메일을 보내지 않는다(워크스페이스 CLAUDE.md §이메일 정책). 테스트에서도 메일 Route를 호출하지 않는다.

## 영향 파일 & 패턴

| 파일 | 변경 |
|------|------|
| `src/features/birthday-celebrants/lib/birthday-order.ts` | **신규** 순수 함수 |
| `src/features/birthday-celebrants/lib/__tests__/birthday-order.test.mjs` | **신규** 단위 테스트 |
| `src/features/birthday-celebrants/lib/confetti.ts` | 저장 키 함수 이동 · 발사 함수 유지 |
| `src/features/birthday-celebrants/api/{types,service.server,service,queries}.ts` | 응답 모양·쿼리·경로 변경 |
| `src/app/api/birthdays/route.ts` | **신규** GET |
| `src/app/api/birthdays/this-month/route.ts` | **삭제** |
| `src/features/birthday-celebrants/components/birthday-celebrants-wheel-card.tsx` | **신규**(client) |
| `src/features/birthday-celebrants/components/birthday-celebrants-banner.tsx` · `birthday-celebration-slide.tsx` | **삭제** |
| `src/features/birthday-celebrants/components/birthday-celebrants-section.tsx` · `birthday-celebrants-banner-skeleton.tsx` · `birthday-d-day-lottie.tsx` | 새 카드 연결 · skeleton 모양 · Lottie 크기 prop |
| `src/lib/birthday.ts` | 이 기능 전용 함수 4개 이동·삭제 |
| `src/lib/format-date.ts` | `formatBirthdayMonthDay`가 `MM-DD` 허용 |
| `package.json` · `package-lock.json` | `embla-carousel-auto-height` 제거 |
| `src/app/dashboard/overview/layout.tsx` | 변경 없음 예상(같은 Section·Skeleton 사용) |
| `e2e/birthdays/102-overview-birthday-list.spec.ts` · `e2e/quick-round2/95-dongbang-visibility.spec.ts` | 신규 spec · 동방 403 1 test 추가 |

**패턴:** `requireSession` · `getServiceRoleClient` · `applyDongbangScope` · RSC + client 카드 분리 · `Icons.*` · `cn()` · shadcn `Tabs`/`Badge`/`Card` · `ProfileAvatar` · `motion/react`의 `useReducedMotion` · `canvas-confetti`(카드 범위) · 날짜 표시 `@/lib/format-date`

## 리스크 & 완화

| # | 등급 | 리스크 | 완화 |
|---|------|--------|------|
| 1 | HIGH | 날짜에 따라 결과가 바뀌어 E2E가 들쭉날쭉 · 실직원 데이터와 섞임 | API `referenceDate` 기준 상대 날짜 시드 · 위치·개수는 API로 계산해 비교 · 경계 날짜는 단위 테스트 · 오늘 생일 실데이터 존재 시 조건부 skip |
| 2 | HIGH | 휠 가운데 맞춤이 흔들림(첫 렌더·탭 전환·snap·부드러운 스크롤이 서로 충돌) | 줄 높이 고정(64px) → `index × 64`로 계산 · 프로그램 스크롤 동안 snap 잠시 끄기 · 첫 맞춤은 `useLayoutEffect` 즉시 · 목록 높이는 ResizeObserver로 위아래 여백 계산 · scroll 처리 rAF 1회로 묶기 |
| 3 | MED | 회사 전원의 생일이 모든 직원에게 보임(전에는 31일 안만) | 사용자 결정(Q2) · 연도 제거(D-10) · email·phone 미포함 유지 |
| 4 | MED | 휴대폰에서 카드 안 스크롤과 페이지 스크롤이 겹침 | 목록 높이 약 280px로 제한 · 카드 밖은 페이지 스크롤 · AC-18로 확인 |
| 5 | MED | `localStorage`가 막힌 브라우저(사생활 보호 모드)에서 오류 | 모든 접근 try/catch · 실패 시 mount당 1번만 발사 |
| 6 | LOW | `embla-carousel-auto-height` 제거가 다른 캐러셀에 영향 | 사용처 grep 1곳(생일)뿐 · 첨부 lightbox는 `ui/carousel`만 사용 · 빌드·회귀로 확인 |
| 7 | LOW | 2월 29일·연말연초 계산 오류 | 순수 함수 + AC-19 단위 테스트 |
| 8 | LOW | 페이지를 연 채 자정이 지남 | Out(다음 진입 시 반영) |

## Battle Plan (단계)

| # | 단계 | 산출물 | 신뢰도 | 의존 |
|---|------|--------|--------|------|
| 1 | BE: 순수 함수 + 단위 테스트(AC-19) | `birthday-order.ts` · test green | HIGH | — |
| 2 | BE: service.server 재작성 · `GET /api/birthdays` · this-month 삭제 · 타입·client 경로 · lib 정리 · `formatBirthdayMonthDay` 확장 · tsc | API 200/401 · tsc 0 | HIGH | 1 |
| 3 | designer: A안 명세(UI 요구사항 표 구체화) | 설계 요약 | HIGH | — |
| 4 | FE: 휠 카드 · 탭 · 가운데 맞춤 · 클릭 이동 · 컨페티 조건 · skeleton · 배너/slide 삭제 · 의존성 제거 | overview 동작 | MED(스크롤 맞춤) | 2·3 |
| 5 | verifier: spec 작성 · AC-01~21 · 회귀 · tsc·lint·build · cleanup | 전부 green | MED(날짜 의존) | 4 |

- **체크포인트:** 2단계 후 `GET /api/birthdays` 응답 모양·정렬을 확인하고 FE로 넘어간다.
- **추정:** 약 14~18 파일 · 600~800줄 · 복잡도 Medium · 총 120~180분(BE 30~40 · designer 15~20 · FE 50~70 · verifier 30~50).
- **롤백:** FE 카드·Route 변경을 되돌리면 이전 배너·`this-month`로 복귀(DB 변경 없음). 의존성은 `npm install embla-carousel-auto-height@^8.6.0`로 복구.

## requirements-pipeline Express (Phase 3)

### 가정

| # | 가정 | 근거 |
|---|------|------|
| A1 | overview를 볼 수 있는 사람 = active 비동방 사용자 | plan 89 allowlist(동방은 overview 진입 시 `/dashboard/quick`로 이동) · Q2 답변 |
| A2 | 소속 없는 active 사용자는 관리자 계정뿐이며 전체 탭에만 보인다 | Dev 집계 1명 · D-8 |
| A3 | 생일 데이터는 `profiles.birthday`(date) 하나뿐 | plan 09·58 |
| A4 | 브라우저당 하루 1번 = 같은 브라우저 프로필의 `localStorage` 기준(기기·브라우저가 다르면 각각 1번) | Q3 (가) 설명 그대로 |
| A5 | 카드 높이 414px 고정이 공지·식대 카드 배치를 해치지 않는다 | 현재 높이와 같음(PC) [INFERRED: 모바일은 약 40px 증가] |

### 검증 시나리오 (요약)

1. 평범한 날 직원이 overview를 연다 → 「다가오는 생일」 · 가장 가까운 사람이 가운데 · 위로 굴리면 지난 생일.
2. 「산스」 탭 → 산스 사람만 · 산스에서 가장 가까운 사람이 가운데.
3. 누군가의 생일 당일 아침 처음 접속 → 폭죽 1번 · 「D-DAY!」 · 다시 들어오면 폭죽 없음.
4. 움직임 줄이기 설정 사용자 → 폭죽·회전 없음, 목록은 정상.
5. 동방특송 계정 → overview 진입 불가 · API 403 · 명단에 동방 없음.

## 구현 팀 전달 메모

### designer
- A안 시안 + §UI 요구사항 표를 shadcn 클래스 수준으로 확정. 가운데 띠·흐림 mask·링·칩 3종·소속 칩·빈 탭·Skeleton·모바일. light/dark·THEMES 확인.

### backend-dev
- In 1~5. SQL 없음. 순수 모듈은 런타임 import 금지(타입만). `applyDongbangScope` 사용. 응답에 연도 포함 `birthday` 금지. 옛 Route 삭제. activity log 없음.

### frontend-dev
- In 7~9. 카드는 client, Section은 RSC 유지. 가운데 맞춤 로직은 리스크 #2 완화책대로. 컨페티 D-5·D-14. 테스트 훅(`data-testid`·`data-*`·`aria-current`) 정확히.

### verifier
- §공통 테스트 메모의 시드·cleanup 전략. Playwright clock 미사용. 메일 Route 호출 금지(`E2E_REMINDER_DRY_RUN=1` 유지). AC-04는 95 spec에 추가.

## 후속 / 참고

plan 102와 **무관한** 기존 e2e 실패 9건(2026-10-29 verifier 회귀 중 발견). 별도 후속 과제 [TBD]:

| # | spec | AC | 원인(추정) |
|---|------|----|-----------|
| F-1 | spinner(로딩 통일) | AC-11 | `/dashboard/react-query` 데모 페이지 비활성 |
| F-2 | `users/birthday-table` | AC-01 | 헬퍼가 rank 「경영진」을 보내 400 |
| F-3 | `users/birthday-update.api` | AC-04 | POST 본문에 `position_level` 누락 |
| F-4 | attachments | AC-06 | 404를 기대하지만 overview 리다이렉트로 200 |
| F-5~F-8 | live-users | AC-02·03·04·11 | avatar null · 낡은 payload · AC-01과 모순 · sign-in 410 |

## 열린 질문

없음 (deep-interview Q1~Q5 · 기본값 전부 확정 2026-10-29).

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-10-29 | 최초 작성 · Approved(/root 단일 게이트). deep-interview Q1 A안 · Q2 전원 반년 순환 · Q3 하루 1번 · Q4 전체 · Q5 가운데 이동. `GET /api/birthdays` 신규·`this-month` 삭제 · 연도 제거 · `applyDongbangScope` · AC 21 · plan 10 overview 배너 부분 supersede | planner |
| 2026-10-29 | **r1** (root·backend-dev 결과 반영) · D-3에 366일 구간 동점 규칙(지난 생일 쪽 `-183`) 명시 · AC-01·API 주석 `days_offset` 범위 [-182, 182] → **[-183, 182]** · 공통 테스트 메모에 만료 세션 재생성(`setup-dongbang` 등) 1줄 추가 | planner |
| 2026-10-29 | **r2** (verifier 결과 반영) · AC-09 헤더 인원 N 확인을 시드 전 실데이터 판정으로 분리(오늘 생일자 있으면 그 부분만 skip) · 공통 테스트 메모에 AC-04 일회용 동방(생일 오늘) 시드 1줄 · 「후속 / 참고」에 무관한 기존 e2e 실패 9건 [TBD] · **Status Completed** | planner |
| 2026-10-29 | **r3** (사용자 지시) · D-8 탭 순서 전체·산스·산스파운드리·웨이크 → **전체·웨이크·산스·산스파운드리** · AC-07 탭 순서 기대값 동일 변경 · **커밋 분리:** plan 102는 plan 95(미커밋)보다 먼저 dev에 올라가므로 커밋 버전은 동방 제외를 `.or(EXCLUDE_DONGBANG_OR_FILTER)` 직접 필터로 쓰고, plan 95 반영 시 `applyDongbangScope`로 바뀐다(동작 동일) · AC-20 ②는 둘 다 허용 | root |
