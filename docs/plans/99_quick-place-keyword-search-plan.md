# 퀵 주소 검색 「장소 검색」 탭(카카오 로컬 키워드 API) 기획서

> Date: 2026-10-27
> Status: Completed
> Author: planner
> **퀵 2차(94~101) 중 7번째(실행 순서 기준).** 선행: [101](./101_quick-chat-participants-plan.md)까지 완료 후 · **사용자가 `KAKAO_REST_API_KEY`를 제공한 뒤 착수**(키 없으면 Status Approved로 대기). **BE Route 1 + FE · SQL 없음**
> **brief 항목:** 1(장소 이름으로 주소 검색)
> **확장:** [87](./87_quick-request-goods-notes-address-picker-plan.md) D3 주소 검색 Dialog에 탭 1개 추가(「주소 검색」·「장소 검색」·「최근 이용 내역」) · 「주소 검색」 기본 탭·Daum embed·최근 내역(97 분리)은 그대로
> **선행:** [07](./07_auth-route-guard-plan.md), [08](./08_activity-audit-log-plan.md), [81](./81_kanban-google-tasks-plan.md)(외부 API mock 패턴), [86](./86_quick-request-kakao-redesign-plan.md), [87](./87_quick-request-goods-notes-address-picker-plan.md), [89](./89_quick-workflow-dongbang-openchat-plan.md), [97](./97_quick-period-filter-recent-address-split-phone-plan.md)

## 선행 plan 참조 (Phase 0)

| Plan | Status | 관계 |
|------|--------|------|
| **87** | Approved | `quick-request-address-picker-dialog.tsx`의 `Tabs`(`search`·`recent`)에 **`place` 탭 추가**. 선택 시 4칸 채움 로직(`onSelect`)은 재사용. Daum 스크립트·popup 금지 규칙 유지 |
| **97** | Approved | 최근 내역 탭이 direction별·무한스크롤로 바뀐 뒤의 Dialog 구조를 전제 |
| **81** | Approved | `E2E_GOOGLE_TASKS_MOCK` 같은 **외부 API mock 플래그** 패턴을 `E2E_KAKAO_PLACES_MOCK`에 재사용 |
| **89** | In Progress | 동방특송은 `/dashboard/quick/request` 진입 불가 · `/api/quick-request/**` 중 `notes`·`recent-addresses`·등록 POST가 403 → 신규 `places` Route도 **동방 403 목록에 추가**(`isDongbangAllowedApi`) |
| **07** | Completed | Route는 `requireSession` + active |
| **08** | Approved | 외부 검색 프록시는 **READ** → activity log Out. 외부 호출 실패 로그는 `console.error`만 |

### 정찰로 확인한 사실

| 항목 | 사실 | 근거 |
|------|------|------|
| Dialog | `Tabs` `search`(Daum embed) / `recent`(최근 내역) · 선택 시 `roadAddress`·`detailAddress`·`contactName`·`contactPhone` 채움 | `quick-request-address-picker-dialog.tsx:148~169` |
| 카카오 API | `GET https://dapi.kakao.com/v2/local/search/keyword.json?query=&page=&size=` · 헤더 `Authorization: KakaoAK {REST_API_KEY}` · 응답 `documents[]{id, place_name, road_address_name, address_name, phone, category_name, x, y}` · `meta{is_end, total_count, pageable_count}` · `size` ≤ 15 · `page` ≤ 45 | 카카오 developers 로컬 API 문서 **[INFERRED: 구현 시 공식 문서 재확인]** |
| 키 | 서버 전용 env(`KAKAO_REST_API_KEY`) · 브라우저에 노출 금지 · 현재 미보유 | brief 1 |
| env | `env.example.txt`에 `KAKAO_*` 없음 | grep |

---

## 한 줄 요약

주소 검색 창에 **「장소 검색」 탭**을 더한다. 「익선 산스」처럼 **가게·건물 이름**으로 검색하면 서버가 카카오 로컬 키워드 API를 대신 호출해 결과(장소명·도로명·지번·전화)를 보여 주고, 하나를 고르면 **도로명 주소 칸**이 채워지고 **상세주소 칸에 장소명**이 들어간다(수정 가능). 카카오 키가 없으면 탭이 **아예 보이지 않는다**.

---

## 정책 확정안 (brief 1 · planner 결정)

| # | 항목 | 확정 |
|---|------|------|
| D-1 | 키·설정 | 서버 env **`KAKAO_REST_API_KEY`**(사용자 제공). `isPlaceSearchConfigured()`가 false면 ① 요청 페이지 서버 컴포넌트가 `placeSearchEnabled=false`를 내려 **탭 미렌더** ② Route는 **503** `{success:false, message:'장소 검색이 아직 설정되지 않았습니다.'}`. `env.example.txt`에 키 이름 추가(값 없음) |
| D-2 | Route | `GET /api/quick-request/places?q=&page=` — `requireSession`(active) · 동방 403(allowlist) · `q` 1~50자(trim) · `page` 1~3(기본 1) · `size=15` 고정 · 카카오 호출 timeout **4초** · 응답을 WakeOne 형태로 정규화 `{places:[{id, name, roadAddress, address, phone, category}], isEnd, total}` · 카카오 4xx/5xx·timeout → **502** 「장소 검색에 실패했습니다. 잠시 후 다시 시도해 주세요.」 · 429 → 502 같은 문구 + `console.error`. 응답 헤더 `x-request-id` |
| D-3 | 검색 UX | 탭 「장소 검색」(순서: **주소 검색 · 장소 검색 · 최근 이용 내역**, 기본 탭은 계속 「주소 검색」). 검색 `Input`(placeholder 「가게·건물 이름으로 검색 (예: 익선 산스)」, 자동 포커스) · **2자 이상 · 400ms debounce** 후 자동 검색 · Enter 즉시 · 결과 행 = 장소명(굵게) · 도로명(없으면 지번 + 「지번」 배지) · 전화(muted) · 카테고리(muted 끝) · 「더 보기」(page ≤ 3) · 빈 결과 「검색 결과가 없습니다.」 · 로딩 `PageLoadingSpinner variant='compact'` · 결과는 React Query `staleTime 60s`(같은 검색어 재호출 억제) |
| D-4 | 선택 동작 | 행 클릭 → `roadAddress = road_address_name`(없으면 `address_name` + toast 「도로명 주소가 없어 지번 주소를 넣었습니다.」) · `detailAddress = place_name`(**장소명 채움 · 사용자 수정 가능** · 이미 입력된 상세주소가 있으면 덮어쓰지 않음) · 담당자·연락처는 **건드리지 않음**(장소 전화는 담당자 번호가 아님) · Dialog 닫힘. 최근 내역 저장은 기존 등록 흐름(97 direction) 그대로 |
| D-5 | 쿼터·남용 | 카카오 무료 쿼터(일 10만 건 **[INFERRED]**)로 충분. 서버 측 사용자당 **분당 30회** 간단 메모리 제한(초과 429 「잠시 후 다시 시도해 주세요.」) · 2자 미만 차단 · debounce |
| D-6 | 로그 | READ 프록시 → activity log **Out**. 외부 호출 실패는 `console.error('[quick-places]', status)`만 |
| D-7 | E2E | `E2E_KAKAO_PLACES_MOCK=1`이면 Route가 카카오를 호출하지 않고 fixture(`e2e/fixtures/kakao-places.json` · 「익선」 → 2건, 「없는장소」 → 0건, 「에러」 → 502)를 돌려준다(81 mock 패턴). 미설정 AC는 `E2E_KAKAO_PLACES_UNCONFIGURED=1`로 서버가 미설정으로 판단(91 AC-20 패턴 · 별도 project 또는 수동 QA 이관 가능) |
| D-8 | 개인정보 | 검색어만 카카오로 전송(사용자 식별 정보 없음). 결과를 저장하지 않는다. 처리방침 개정 **Out**(검색어는 개인정보 아님 · 필요 시 후속) |

---

## 목표 & 완료 기준 (AC)

공통: `user.json` · mock 플래그 켜진 퀵 e2e run.

| AC | 유형 | 전제 | 동작 | 기대 |
|----|------|------|------|------|
| AC-01 | Playwright | 1280 · 키 설정(mock) | 출발 「주소 검색」 버튼 → Dialog | tab 3개 순서 **「주소 검색」「장소 검색」「최근 이용 내역」** · 기본 선택 「주소 검색」 · `page.on('popup')` 0 |
| AC-02 | Playwright | 〃 | 「장소 검색」 탭 → `익선` 입력 | 400ms 후 자동 검색(요청 1회) · 결과 2행(`quick-request-place-0/1`) 장소명 굵게·도로명·전화 · 「익」 1자만 입력 시 요청 0 |
| AC-03 | Playwright | 〃 | `quick-request-place-0` 클릭 | Dialog 닫힘 · 출발 도로명 = fixture `road_address_name` · 출발 상세주소 = fixture `place_name` · 담당자·연락처 **변경 없음**(프로필 기본값 유지) |
| AC-04 | Playwright | 상세주소에 `3층` 미리 입력 | 장소 선택 | 도로명만 채워지고 상세주소 **`3층` 유지** |
| AC-05 | Playwright | fixture 중 도로명 없는 행 | 선택 | 도로명 칸에 지번 주소 · toast **「도로명 주소가 없어 지번 주소를 넣었습니다.」** · 결과 행에 「지번」 배지 |
| AC-06 | Playwright | `없는장소` 입력 | 검색 | **「검색 결과가 없습니다.」** |
| AC-07 | Playwright | `에러` 입력(mock 502) | 검색 | toast/인라인 **「장소 검색에 실패했습니다. 잠시 후 다시 시도해 주세요.」** · 탭 유지 |
| AC-08 | API | `user.json` | `GET /api/quick-request/places?q=익선` / `?q=` / `?q={51자}` / `?page=4` / 비로그인 / `dongbang.json` | 200 `{places:[2], isEnd, total}` · 400 「검색어를 입력해 주세요.」 · 400 「검색어는 50자 이내로…」 · 400 · 401 · **403**(proxy allowlist) · `x-request-id` |
| AC-09 | API | 같은 세션 분당 31회 | 호출 | 31번째 **429** 「잠시 후 다시 시도해 주세요.」 |
| AC-10 | Playwright·API | `E2E_KAKAO_PLACES_UNCONFIGURED=1` 서버 | 요청 페이지 Dialog · `GET …/places?q=익선` | 탭 **2개**(「장소 검색」 없음) · API **503** 「장소 검색이 아직 설정되지 않았습니다.」 **[verifier: 별도 project 불가 시 수동 QA 이관 후 수정 이력 기록]** |
| AC-11 | grep | 구현 완료 | `grep -rn "KAKAO_REST_API_KEY" src` · `grep -rn "dapi.kakao.com" src` | 서버 파일(`*.server.ts`·Route)에만 · `NEXT_PUBLIC_KAKAO` 0건 · `env.example.txt`에 키 이름 1줄 |
| AC-12 | Playwright | 375 | 「장소 검색」 탭 | Dialog 전체화면(87 AC-16 유지) · 결과 행 높이 ≥ 44px · 가로 스크롤 없음 |
| AC-13 | Playwright | `THEMES` × light/dark 20조합 | 장소 탭 결과 표시 | 86 AC-19·87 AC-26 패턴 · grep(`#hex` 등) 0 |
| AC-14 | 수동 QA | 실제 키 · dev 배포 | 「익선 산스」 검색 → 선택 → 등록 | 실제 도로명 채움 · 등록 성공 · 최근 내역(출발)에 저장 |
| AC-15 | CLI | — | `npx tsc --noEmit` · `npm run lint` · `npm run build` · `npx playwright test e2e/quick-request e2e/quick-round2/99-*` | 통과 |

**AC 총 15개**(수동 QA 1).

---

## 범위 (In / Out)

### In
1. `src/features/quick-request/api/places.server.ts`(카카오 호출·정규화·timeout·mock 분기·rate limit) · `src/app/api/quick-request/places/route.ts`
2. `src/config/dongbang-routes.ts` 403 목록 추가 · `env.example.txt` · `isPlaceSearchConfigured()`
3. FE: Dialog 탭 `place` · `quick-request-place-search-tab.tsx`(신규) · `api/{service,queries,types}.ts` · 선택 채움 로직(D-4) · 요청 페이지 `placeSearchEnabled` prop
4. E2E fixture·spec · `playwright.config.ts` webServer env `E2E_KAKAO_PLACES_MOCK=1`
5. README 99 · 87 수정 이력

### Out
| 항목 | 이유 |
|------|------|
| 지도 표시·좌표 저장(x·y) | 요청 없음 |
| 수정 Sheet(동방·admin)의 주소 picker에 장소 탭 | 수정 Sheet도 같은 Dialog를 쓰면 자동 포함 · 별도 작업 없음 **[INFERRED]** |
| 카카오 주소 검색(address.json)으로 Daum embed 대체 | Daum embed 유지 |
| 검색어·결과 저장·분석 | 개인정보 최소화 |
| 처리방침 개정 | 검색어는 개인정보 아님 |
| Vercel env 등록 | 사용자 수동 |

---

## UI 요구사항 (designer 지시)

| # | 화면 | 요구 |
|---|------|------|
| U-1 | 탭 | `TabsTrigger value='place'` 「장소 검색」 `min-h-11` · 3탭 균등 |
| U-2 | 검색 | `Input` + `Icons.search` · 자동 포커스 · 아래 보조 문구 「가게·건물 이름으로 찾습니다. 주소를 아시면 「주소 검색」 탭을 이용하세요.」 |
| U-3 | 결과 행 | `Button variant='ghost'` 전체 폭 · 1줄 장소명(`font-medium truncate`) + 카테고리 끝(`text-xs muted`) · 2줄 도로명 또는 지번 + `Badge variant='outline'` 「지번」 · 3줄 전화(muted) · 행 ≥ 44px · 구분선 |
| U-4 | 상태 | 로딩 `compact` Spinner · 빈 결과 · 오류 inline `Alert`(destructive 토큰) · 「더 보기」 `Button variant='outline'` |
| U-5 | 테마 | 시맨틱 토큰만 · 20조합 |

---

## API / DB 요구사항

- **SQL 없음.**
- Route 계약(D-2). 내부 fetch: `fetch('https://dapi.kakao.com/v2/local/search/keyword.json?' + params, { headers: { Authorization: \`KakaoAK ${key}\` }, signal: AbortSignal.timeout(4000) })`.
- 정규화: `road_address_name || null`, `address_name`, `phone || null`, `category_name` 마지막 세그먼트(`>` split) · `id`.
- rate limit: `Map<userId, {count, windowStart}>` 모듈 스코프(서버리스 인스턴스별 · 근사치 · **[INFERRED]**).

---

## 활동 감사 로그

> **activity log 해당 없음** — 외부 검색 프록시(READ)만. 신규 CUD Route 없음. 삭제 UI 없음. 외부 호출 실패는 `console.error`.

---

## 영향 파일 & 패턴

| 팀 | 파일 |
|---|---|
| BE | `src/features/quick-request/api/places.server.ts`(신규) · `src/app/api/quick-request/places/route.ts`(신규) · `src/config/dongbang-routes.ts` · `env.example.txt` · `src/lib/env.ts`(있으면 키 읽기 helper) |
| FE | `components/quick-request-address-picker-dialog.tsx` · `components/quick-request-place-search-tab.tsx`(신규) · `components/quick-request-field-controls.tsx`(선택 채움 D-4) · `api/{service,queries,types,keys}.ts` · `src/app/dashboard/quick/request/page.tsx`(prop) |
| verifier | `e2e/fixtures/kakao-places.json` · `e2e/quick-round2/99-place-search.spec.ts` · `playwright.config.ts` |

**패턴:** 81 외부 mock 플래그 · 87 Dialog/Tabs · 91 AC-20 미설정 project · `requireSession`.

---

## 리스크 & 완화

| 등급 | 리스크 | 완화 |
|---|---|---|
| HIGH | 키 노출(클라이언트 번들) | 서버 전용 env · AC-11 grep · `NEXT_PUBLIC_` 금지 |
| MED | 카카오 API 응답 형식이 가정과 다름 | 구현 시 공식 문서 재확인 · 정규화 계층 1곳 · 수동 QA AC-14 |
| MED | 쿼터 초과·429 | debounce·2자·staleTime·분당 제한 · 502 문구 |
| LOW | 지번만 있는 장소 | D-4 toast + 배지 |

**롤백:** Route·탭 제거(git revert) · env 삭제.

---

## Battle Plan (단계)

| # | 단계 | 산출물 | 확신도 | 의존 |
|---|---|---|---|---|
| 0 | 사용자 키 수령 확인 · root Step 0 백업 · `.env`에 키(사용자) | — | HIGH | 키 |
| 1 | designer: 탭·검색·결과 행·상태 | 설계 메모 | HIGH | — |
| 2 | BE: `places.server.ts`(mock·timeout·정규화·rate limit) → Route → allowlist → env example → curl AC-08·09 | API | MED | 0 |
| 3 | FE: 탭·검색·결과·선택 채움·prop | UI | HIGH | 2 |
| 4 | verifier: fixture·spec·미설정 project·테마 → 수동 QA 사용자 전달 | green | MED | 3 |

**추정:** 신규 5파일 · 수정 7파일 · +500줄 · **Medium** · 약 3~4시간.

---

## requirements-pipeline Express (Phase 3)

### 가정

| ID | 가정 | 출처 |
|----|------|------|
| A1 | 사용자가 카카오 REST API 키를 제공한다 · 키 없으면 탭 숨김 | brief 1 |
| A2 | 키워드 검색 API는 도메인 등록 없이 REST 키로 호출된다 | 카카오 문서 **[INFERRED]** |
| A3 | 장소명을 상세주소에 넣는 것이 사용자 기대와 맞는다 | planner 결정 D-4(수정 가능) |

### 검증 시나리오

| 시나리오 | 기대 |
|----------|------|
| 가게 이름 검색·선택 | 도로명+장소명 채움(AC-02·03) |
| 미설정 | 탭 없음·503(AC-10) |
| 실패 | 502 문구(AC-07) |

---

## 구현 팀 전달 메모

### designer — 탭 1개·검색·결과 행·상태 4종.
### backend-dev — 서버 전용 키 · mock 분기 · 정규화 · timeout 4초 · rate limit · 동방 403 · 로그 Out.
### frontend-dev — debounce 400ms·2자 · 선택 채움(D-4) · `placeSearchEnabled`로 탭 조건부.
### verifier — mock fixture 3케이스 · 미설정 project(불가 시 수동 QA 이관) · 수동 QA AC-14.

---

## 열린 질문

| # | 질문 | 기본값 |
|---|---|---|
| OQ-1 | 장소명을 상세주소에 넣는 동작이 불편하면 | 도로명만 채움으로 변경(1줄 수정 · 수정 이력) |

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-10-27 | 최초 작성 · Approved(/root 단일 게이트 · brief 1). 「장소 검색」 탭 · 서버 프록시 Route(`KAKAO_REST_API_KEY` · 503 미설정 · 502 실패 · 분당 30회) · 선택 시 도로명+장소명 채움 · mock·미설정 e2e · SQL 없음 · 로그 Out · AC 15. **키 도착 후 착수** | planner |
| 2026-10-28 | **verifier — Completed** (99+100 통합 검증). spec `e2e/quick-round2/99-*`(UI·API·grep·theme·미설정) — mock 서버 AC-01~09·11~13 + 보조 2 green · 미설정 서버(`E2E_KAKAO_PLACES_UNCONFIGURED=1`) AC-10 2/2 · `e2e/quick-request/address-picker.spec.ts` green · AC-15 CLI(tsc·lint:strict·build·`e2e/quick-request`) 통과(`notes.api` AC-12 기존 실패 1 제외). AC-14 수동 QA는 사용자 이관(실제 키 · dev 배포). 경미 차이 수용: AC-08 `x-request-id`는 Route 응답(200·400·429·502·503)만 · proxy 401/동방 403은 헤더 없음(전 API 공통). 구현 수정 없음 | verifier |
