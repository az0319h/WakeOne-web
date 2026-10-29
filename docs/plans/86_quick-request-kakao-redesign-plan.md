# 퀵 배송 요청 카카오 스타일 단일 화면 리디자인 기획서

> Date: 2026-10-20
> Status: Approved
> Author: planner
> **Partially superseded by:** [87](./87_quick-request-goods-notes-address-picker-plan.md) (2026-10-21): 일부 AC(07·12·13·16·18 등)·testid(`-note-{문구}`)·Out 범위(물품 크기·최근 이용 내역·schema/메시지 불변·DB·activity log) — 87 §86 supersede 표 참조
> **Supersedes:** [83](./83_quick-request-wizard-plan.md) **UI·AC** (4단계 wizard 폐기) — 폼 모델·경유 무제한·notify 계약·결제 정책·Out 범위는 83/82 상속
> **선행:** [07](./07_auth-route-guard-plan.md), [08](./08_activity-audit-log-plan.md), [14](./14_delete-confirm-dialog-plan.md), [26](./26_loading-spinner-unification-plan.md), [31](./31_global-kbar-search-plan.md), [49](./49_live-users-presence-plan.md), [76](./76_hr-benefits-manager-access-plan.md), [82](./82_quick-request-plan.md), [83](./83_quick-request-wizard-plan.md)
> **디자인 레퍼런스:** `/Users/hoon/Desktop/Wake_Auto/kakao-quick-lab/` (카카오 T 퀵 `/orders/quick` 클론 · 1440px 고정폭 · `kq-*` 하드코딩 색)

## 선행 plan 참조 (Phase 0)

| Plan | Status | 관계 |
|------|--------|------|
| **82** | Approved | notify **501** placeholder · 복사 fallback · nav「퀵」· RBAC · Daum · Dialog **상속** · activity log Out 근거 상속 |
| **83** | Approved | **UI/AC를 본 plan이 대체** — stepper·`goToStep` jump **폐기**. 폼 모델·경유 무제한·notify body·`💳 결제: 월정산` 고정 표기 **상속** |
| **07** | Completed | 미로그인 → sign-in · pending/inactive 차단 (`page.tsx` 가드 유지) |
| **08** | Approved | placeholder 501 → **activity log 해당 없음** |
| **14** | Completed | DELETE 없음 · 경유지 제거 = **클라이언트 폼 행 제거**(서버 데이터 삭제 아님) → AlertModal **해당 없음** (83 동일) |
| **26** | Approved | `loading.tsx` → `PageLoadingSpinner variant='fill'` 유지 |
| **31** | Revised | kbar「퀵 요청하기」 변경 없음 |
| **49** | Approved | `/dashboard/quick/request`는 **`dashboard/layout` 하위** → **`DashboardPresenceTrack` 상속** · 별도 track 0건 |
| **76** | Completed | nav 그룹 선례 · 변경 없음 |

**drift 정정:** plan 83 D8은「선불/착불」로 적혀 있으나 실제 코드는 `freightPayment: 'monthly' | 'collect'`(월정산/착불). 본 plan은 **현재 코드 기준**(사용자 확정「월결제/착불」과 일치).

---

## 한 줄 요약

`/dashboard/quick/request`를 **카카오 T 퀵 디자인 언어의 반응형 단일 화면**(PC: 좌 폼 + 우 sticky 요약 · 모바일: 하단 고정 바 + Drawer 요약)으로 교체한다. **기능·폼 모델·검증·메시지·notify 계약은 불변**이며, **WakeOne 테마 10종 × 라이트/다크** 모두에서 시맨틱 토큰만으로 렌더링된다.

---

## 정책 확정안 (deep-interview · 메인 세션 · 2026-10-20)

| # | 항목 | 확정 |
|---|------|------|
| D1 | **화면 구성** | 83 wizard **폐기** · 한 화면. **`lg`(≥1024) 이상:** 좌 입력 폼 + 우 요약(sticky) · **`lg` 미만(375·768 포함):** 하단 고정 바(요약 1줄 + 등록 버튼) → 탭 시 **Drawer** 전체 요약 |
| D2 | **반응형** | 375px 모바일 ~ PC · **가로 스크롤 0** · 터치 타깃 **≥44px** |
| D3 | **테마** | 기본 테마 **`vercel`** · **`THEMES`(theme.config.ts) 10종 전부 × `.dark`** 에서 깨지지 않아야 함. 시맨틱 토큰(`primary`·`muted`·`border`·`card` …)과 테마 토큰(`--radius`→`rounded-*`, `shadow-*`, `font-sans`)만 사용 · 하드코딩 색·`kq-*`·Roboto·고정 radius/shadow 임의값 **금지** · shadcn · `Icons.*` · `cn()` · `PageContainer` |
| D4 | **카카오 전용 기능** | **넣지 않음** (Out 표 참조) · 현재 기능 **전부 유지** |
| D5 | **카카오 이미지** | 사내용으로 **사용** (공개배포 리스크 사용자 인지) · `public/quick-request/vehicles/` 한 폴더 · 매핑 1파일 |
| D6 | **완료 기준** | ① 기존 기능 동일 동작 ② 375/768/1280 무스크롤·터치 타깃 ③ **THEMES 전체 × light/dark** 자동 스모크 + `vercel`·`supabase`·`claude` × light/dark 육안 QA ④ e2e 재작성 green + build |
| D7 | **베이스라인** | git 커밋 **하지 않음** (사용자가 전체 수정 후 최초 커밋 예정) → root가 FE 착수 전 **tar 파일 스냅샷 백업** · 커밋/PR은 파이프라인 밖(사용자 `@commit-pr`) |

### 차량 이미지 매핑 (D5)

| 차량 타입 (`QUICK_REQUEST_VEHICLE_TYPES`) | 이미지 | 표시 |
|---|---|---|
| 오토바이 | `vehicle-quick.png` | 라벨 |
| 다마스 | `vehicle-damas.png` | 라벨 |
| 라보 | `vehicle-labo.png` | 라벨 |
| 1톤 탑차(윙바디) | `vehicle-1ton-wingbody.png` | 사용자 제공 이미지 (2026-10-20) |
| 1톤 오픈형 | `vehicle-1ton.png` | |
| 1톤 냉장(냉동) | `vehicle-1ton-refrigerated.png` | 사용자 제공 이미지 (2026-10-20) |
| 2.5톤 | `vehicle-2-5ton.png` | 사용자 제공 이미지 (2026-10-20) · 전용 이미지라 톤수 배지 제거, 톤수는 카드 라벨로 표시 |
| 5톤 | `vehicle-5ton.png` | 사용자 제공 이미지 (2026-10-20) · 동일 |
| 기타 | 이미지 없음 · `Icons.*` 아이콘 | 선택 시 직접 입력칸 |

- 원본: `kakao-quick-lab/public/sites/quick-kakaomobility-com-a111b9e5/orders-quick-98794f9e/images/vehicle-{quick,damas,labo,1ton}.png` (448×448 RGBA 투명 · 합계 ~0.3MB)
- **미사용:** 소형차·방문택배 PNG, goods·옵션 아이콘 SVG, logo, favicon, 클론 SVG 아이콘, `kakao-quick.css`
- 차량 무게/용량 설명 문구 **Out** (근거 없는 정보 생성 방지)

---

## 목표 & 완료 기준 (AC)

**공통:**
- E2E **`storageState` active user** (`e2e/.auth/user.json`)
- 셀렉터 **`getByRole` / `getByPlaceholder` / `getByTestId`만** — CSS 클래스·DOM 구조 의존 **금지**
- 레이아웃 측정은 `page.evaluate`(scrollWidth/clientWidth) · `locator.boundingBox()`만 — **픽셀 비교 금지**
- **`/dashboard/quick/request`는 `dashboard/layout` 하위 → `DashboardPresenceTrack` 상속 확인** (plan 49)
- 시각 표기 **`formatAbsoluteDateTimeKo`** only · 상대 시각 금지
- 테마 목록은 spec에 **하드코딩 금지** — `src/components/themes/theme.config.ts`의 **`THEMES` import**

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| AC-01 | Playwright | active user | 사이드바 **「퀵」→「퀵 요청하기」** 클릭 | URL `/dashboard/quick/request` · heading `/퀵 배송 요청/` 표시 |
| AC-02 | Playwright | 미로그인 / pending user | `/dashboard/quick/request` 이동 | 각각 `/auth/sign-in` (dashboard 셸 미노출) / `/auth/sign-in?authStatus=pending_approval` |
| AC-03 | Playwright | active user | Cmd+K → **「퀵 요청하기」** | `/dashboard/quick/request` 이동 |
| AC-04 | Playwright | active user · 최초 로드 | 페이지 진입 | `PageLoadingSpinner`(role=status "Loading") → `quick-request-order-page` 표시 |
| AC-05 | grep | 구현 완료 | `src/app/dashboard/quick/request` 트리 검사 | quick 전용 `DashboardPresenceTrack` **0건** · `dashboard/layout.tsx` 상속 |
| AC-06 | Playwright | viewport 1280 | 페이지 로드 | `quick-request-order-page` 안에 폼 섹션과 **`quick-request-summary`가 동시에 보임** · `quick-request-step-indicator`·`quick-request-next-button` **0건** · 출발 담당/연락 = **프로필 `full_name`·`phone`** 기본값 (`phone` null → 빈칸) |
| AC-07 | Playwright | 1280 · 물품 내용 비움 | `quick-request-register-button` 클릭 | 한국어 에러 **「물품 내용을 입력해 주세요.」** 노출 · `quick-request-preview-message` **미노출** |
| AC-08 | Playwright | 1280 · 차량 **5톤 + 오토바이 + 기타** 선택 · 기타 입력 비움 | 등록 클릭 | 기타 에러 노출 · Dialog 차단 → 기타 입력 후 등록 시 Dialog 본문에 **차량 3종 + 기타 입력값** 반영 |
| AC-09 | Playwright | 차량 카드 영역 | 렌더 확인 | 오토바이·다마스·라보·1톤 3종·2.5톤·5톤 카드에 **alt=차량명 `img`** 존재 (`getByRole('img', { name })`) · 2.5톤/5톤 카드에 **톤수** 표시 · 기타 카드는 이미지 없이 아이콘 |
| AC-10 | Playwright | 대수 **「3대」** / **「직접」+ 7** | 요약 · Dialog 확인 | 각각 **`3대`** / **`7대`** 반영 |
| AC-11 | Playwright | 경유 0 | `quick-request-add-stopover` **3회** → `quick-request-stopover-remove-1` | 경유 블록 **2개** (`stopover-remove-2` 0건) · 상한 안내/비활성 없음 · 남은 경유 2곳이 **요약 타임라인·Dialog에 순서대로** 반영 |
| AC-12 | Playwright | 픽업 **「날짜/시간 선택」** `2026-12-25T14:30` · 도착 **「최대한 빠르게」** · 출발 특이 칩 1개 · **「착불」** | 요약 확인 | 픽업 **절대시각 문자열** · `최대한 빠르게` · 칩 문구 · **`착불` + `월정산` 동시 표시** |
| AC-13 | Playwright | 1280 · 전 필수 유효 | 등록 → Dialog **「확인」** | `POST /api/quick-request/notify` **501** · toast **「카톡 API 연동 후 자동 전송됩니다.」** · **「메시지가 복사되었습니다.」** · Dialog 닫힘 · 물품 **빈값** · 출발 담당 = 프로필 기본값 (**form reset**) |
| AC-14 | Playwright | 테마 `vercel` · viewport **375 / 768 / 1280** (375는 Drawer 열린 상태 포함) + 추가로 **375에서 `neobrutualism`(4px offset shadow·radius 0)·`notebook`(Architects Daughter·tracking 0.5px)·`mono`(monospace)** | 페이지 로드 | 모든 경우 `document.documentElement.scrollWidth <= clientWidth` |
| AC-15 | Playwright | viewport 375 | 페이지 로드 | `quick-request-mobile-bar` 보임 · `quick-request-summary` **미노출** · `quick-request-mobile-summary-trigger` 탭 → `quick-request-summary-drawer` 열림 · 입력값 반영 |
| AC-16 | Playwright | 375 · 전 필수 유효 | `quick-request-mobile-register-button` | Dialog 열림 → 확인 → **AC-13과 동일 결과** (501 · 복사 · reset) |
| AC-17 | Playwright | 375 · 물품 비움 | 모바일 등록 | 에러 노출 · Dialog 미오픈 · 에러 필드 **`toBeInViewport()`** (scrollToFirstError) |
| AC-18 | Playwright | 375 | 주요 컨트롤 `boundingBox()` 측정 — 차량 카드 1 · 대수 프리셋 1 · 특이 칩 1 · `add-stopover` · `origin-address-search` · `freight-collect` · `mobile-register-button` | 각 높이 **≥ 44px** |
| AC-19 | Playwright | cookie `active_theme` = **`THEMES` 각 value** × light/dark(addInitScript localStorage `theme`) — **20조합** · viewport 1280 | 페이지 로드 | 각 조합에서 `quick-request-order-page` · `quick-request-register-button` 표시 · `scrollWidth <= clientWidth` (테마 목록은 `THEMES` import) |
| AC-20 | grep | 구현 완료 | `src/features/quick-request/**` 검색: `#[0-9a-fA-F]{3,8}\b`(색), `kq-`, `bg-white`, `text-black`, `-\[#`, `Roboto`, **`rounded-\[`**, **`shadow-\[`** | **0건** (radius/shadow는 `rounded-{sm,md,lg,xl}`·`shadow-{xs,sm,md…}` 테마 토큰만) |
| AC-21 | grep | 구현 완료 | `src/features/quick-request/**` 검색: `useFormStepper`, `quick-request-wizard`, `step-indicator`, `@tabler/icons-react` | **0건** |
| AC-22 | API · grep | active 세션 · 유효 body · stopovers 2건 | `POST /api/quick-request/notify` | **501** · `x-request-id` 헤더 (기존 `notify.api.spec.ts` 유지) · Route `recordActivityLog` **0건** |
| AC-23 | 수동 QA | **`vercel`·`supabase`·`claude` × light/dark** (6조합) · 1280 + 375 | 사용자 육안 1회 | 텍스트·선택 상태·에러·차량 이미지 가독성 이상 없음. **나머지 7테마는 AC-19·AC-14·AC-20 자동 스모크로 대체** (e2e 판정 대상 아님 — 픽셀 검증 금지 규칙) |
| AC-24 | CLI | — | `bunx playwright test e2e/quick-request` · `npm run build` | **green** · **통과** |

**최종 AC 개수: 24** (Playwright 18: AC-01~04·06~19 · grep 3: AC-05·20·21 · API+grep 1: AC-22 · 수동 QA 1: AC-23 · CLI 1: AC-24)

### e2e testid 규칙

| 구분 | testid |
|------|--------|
| **보존 (기존)** | `quick-request-item-description` · `quick-request-vehicle-{type}` · `quick-request-vehicle-other` · `quick-request-vehicle-count-{n}` · `-count-custom-toggle` · `-count-custom-input` · `quick-request-{origin\|destination\|stopover-N}-{road-address\|detail-address\|contact-name\|contact-phone\|address-search}` · `quick-request-add-stopover` · `quick-request-stopover-remove-N` · `quick-request-{origin\|destination}-note-{문구}` · `quick-request-origin-memo` · `quick-request-destination-extra-memo` · `quick-request-{origin\|destination}-scheduled-datetime` · `quick-request-freight-{monthly\|collect}` · `quick-request-register-button`(**데스크톱 aside 전용**) · `quick-request-summary`(**데스크톱 aside 전용**) · `quick-request-preview-message` · `quick-request-confirm-button` |
| **신규** | `quick-request-order-page` (페이지 앵커 · AC-04/06/19) · `quick-request-mobile-bar` · `quick-request-mobile-summary-trigger` · `quick-request-mobile-register-button` · `quick-request-summary-drawer` |
| **삭제** | `quick-request-step-indicator` · `quick-request-step-N` · `quick-request-next-button` · `quick-request-prev-button` · `quick-request-edit-origin` · `quick-request-edit-direct` |

- 데스크톱 aside와 모바일 바가 CSS로 동시에 DOM에 존재 → **testid 분리 필수** (strict-mode 중복 방지). Drawer 요약은 portal로 **열릴 때만** 마운트.
- 라디오: `getByRole('radio', { name: '즉시 요청' | '날짜/시간 선택' | '최대한 빠르게' })` — 카드형 디자인이어도 **role=radio 유지**.

---

## 범위 (In / Out)

### In Scope

| # | 영역 | 내용 |
|---|------|------|
| 1 | **Layout** | D1. `PageContainer viewportFill` 유지 · 하단 바·Drawer는 viewportFill 컬럼 안 **shrink-0 형제**(`position: fixed` 지양 · safe-area inset) · `lg` 2단 |
| 2 | **섹션 (카카오 순서)** | 주소 정보(출발 → 경유 N → 도착 · 타임라인 점) → 배송 수단(차량 카드 9 + 기타 입력 + 대수 1~5/직접) → 배송 일정(픽업 즉시/예약 · 도착 최대한 빠르게/예약 — **카드형 radio**) → 물품 정보 → 기사님 전달사항(출발/도착 특이 칩 + 메모 2) → 운임 결제(월정산/착불) |
| 3 | **카카오 → 토큰 매핑** | 아래 표 |
| 4 | **차량 이미지** | 4 PNG → `public/quick-request/vehicles/` · `lib/quick-request-vehicle-visuals.ts` (type → `{ src, badge? }`) · `next/image` · 이미지는 **`bg-muted` 라운드 타일** 위 (다크모드 대비) · alt=차량명 |
| 5 | **요약 패널** | 경로 타임라인(출발/경유 전부/도착) · 차량·대수 · 물품 · 픽업/도착 일정(절대시각) · 특이사항 · 결제 + `💳 결제: 월정산` 고정 표기(83 정책) · **「퀵 요청 등록하기」** · 기존 「예상 요금 0원」 블록 **제거** · 본문 `QuickRequestSummaryContent`로 추출해 aside·Drawer 공유 |
| 6 | **검증 UX** | `onSubmitInvalid: scrollToFirstError` · 필수 미입력 → 한국어 필드 에러 + Dialog 미오픈 · 모바일 바 등록도 동일 |
| 7 | **정리** | page-content → `QuickRequestOrderPage` 전환 · wizard 전용 파일·step schema·`QUICK_REQUEST_WIZARD_STEPS` 삭제 (**마지막 단계**) |
| 8 | **E2E** | helpers 재작성 · `wizard.spec.ts` → `order-page.spec.ts` · `responsive.spec.ts`·`theme.spec.ts` 신규 · `nav-and-guard.spec.ts` AC-27 앵커 교체 · `notify.api.spec.ts` 불변 |

#### 카카오 → WakeOne 토큰 매핑 (designer 확정 · 가이드)

| 카카오 (`kq-*` / 고정값) | WakeOne |
|---|---|
| `kq-ink` | `text-foreground` |
| `kq-ink-72` / `kq-ink-52` | `text-muted-foreground` |
| `kq-ink-08` / `kq-ink-16` 테두리 | `border-border` (`border`) |
| `kq-field` / `kq-field-2` 입력 배경 | `bg-muted/50` (Input은 className 확장 · `components/ui` 수정 금지) |
| 선택 카드 `kq-blue-soft` + `kq-blue-line` | `bg-primary/5` + `border-primary` (또는 `ring-primary`) |
| `kq-blue-text` 안내 문구 | `text-primary` |
| `kq-red` 도착 점 | `bg-destructive` 또는 `bg-foreground` (designer 결정) |
| 출발 점(외곽선) | `border-foreground` |
| `rounded-[8px]` / `rounded-[4px]` / `rounded-[30px]` | `rounded-lg` / `rounded-md` / `rounded-full` (테마 `--radius` 연동) |
| 그림자 | `shadow-xs`/`shadow-sm` 등 테마 토큰 |
| Roboto / 고정 px 폰트 | 테마 `font-sans` · Tailwind `text-sm/base/lg` |
| 클론 SVG 아이콘 | `Icons.*` |

### Out of Scope

| 항목 | 비고 |
|------|------|
| 배송 속도(이코노미/일반/급송) · 물품 크기 카드 · 왕복 | 카카오 전용 |
| 주소록 · 최근 이용 내역 · 주소록 저장 체크 | 카카오 전용 |
| 비즈니스/일반 고객 선택 · 프로모 배너 · 사이트 헤더/푸터 · 학습 안내 · 「차량 안내」 pill · 요금 표시 | 카카오 전용 |
| 클론 `kakao-quick.css` · `kq-*` 토큰 · Roboto · 클론 SVG 아이콘 · logo/favicon · 소형차/방문택배/goods/옵션 이미지 | D3·D5 |
| 차량 무게/용량 설명 문구 | 근거 없는 정보 |
| 폼 schema 필드 · notify payload · notify Route · **메시지 포맷**(`format-quick-request-message.ts`) | **불변** |
| `src/hooks/use-stepper.tsx` | `multi-step-product-form` 사용 중 → **변경 금지** |
| DB 저장 · 실카톡/오픈채팅 API · `redirectUrl` 2차 | 82/83 Phase 2 `[TBD]` |
| activity log · DELETE · AlertModal | 해당 없음 |
| git 커밋 · PR | 파이프라인 밖 (사용자 `@commit-pr`) |
| `.theme-scaled` 변형 | 자동 검증 대상 아님 `[INFERRED]` — 토큰만 쓰면 자동 대응 |

---

## UI 요구사항 (designer 지시)

| 항목 | 규칙 |
|------|------|
| Shell | `PageContainer` `pageTitle='🚚 퀵 배송 요청'` · 기존 `pageDescription` 유지 · `viewportFill` |
| 브레이크포인트 | **`lg`(≥1024)** 2단 (좌 `minmax(0,1fr)` + 우 ~22–24rem sticky) · `lg` 미만 단일 컬럼 + 하단 바 (768은 사이드바 포함 실폭 ~500px → 모바일 모드) |
| 테마 토큰 | **테마별 radius·shadow·font 토큰(`--radius` → `rounded-*`, `shadow-*`, `font-sans`)만 사용 · 고정 radius/shadow 임의값(`rounded-[…]`, `shadow-[…]`) 금지** · 색은 시맨틱 토큰만 |
| 폭 안정성 | grid/flex 자식 `min-w-0` · 긴 라벨(`1톤 탑차(윙바디)`) `whitespace-normal break-keep` · 입력 `w-full min-w-0` · iOS `datetime-local` 최소폭 고려 · neobrutualism 4px offset shadow·notebook 폰트 폭 고려 |
| 차량 그리드 | 375 기준 `grid-cols-3` 권장 · PC 좌 컬럼 폭에 맞춰 확장 (designer) |
| 터치 타깃 | 칩·대수 프리셋·주소 검색·결제·차량 카드·모바일 등록 **min-h-11 (44px)** · radio는 카드 전체 label 클릭 |
| 주소 입력 | `InputGroup` + 「주소 검색」 addon (Daum) · 상세 · 이름/연락처 `sm`↑ 2열 |
| 요약 | 카카오 OrderSummary 구조(타임라인 · 불릿 행 · 하단 풀폭 CTA) · 요금 블록 없음 |
| 모바일 바 | 요약 1줄(예: 출발 → 도착 · 차량 · 대수) + 등록 버튼 · 탭 → `Drawer`(vaul) 전체 요약 + 등록 |
| 미리보기 | 기존 `QuickRequestPreviewDialog` 재사용 |
| 아이콘 | `Icons.*` only (「기타」 아이콘이 없으면 `src/components/icons.tsx` 레지스트리에 키 추가 허용) |
| 폼 | `useAppForm` · `form.AppField` · **AppField 내부 useState 금지** → 섹션 컴포넌트 분리 |
| 로딩 | `loading.tsx` `PageLoadingSpinner variant='fill'` 유지 |

---

## API / DB 요구사항

- **DB:** 변경 없음
- **`POST /api/quick-request/notify`:** **변경 없음** — `requireSession` + active · Zod `quickRequestNotifyBodySchema` · **501** `{ success: false, message: '카톡 API 연동 후 자동 전송됩니다.' }` · `x-request-id`
- **FE service layer:** `api/{types,service,mutations}.ts` 불변 · 컴포넌트는 `useMutation({ ...notifyQuickRequestMutation, onSuccess })` → 복사·toast·`form.reset(emptyDefaults)` (성공 UX 기준 82/83 동일)
- **backend-dev:** **생략** — Route·schema·DB 변경 0

---

## 활동 감사 로그

**activity log 해당 없음** — notify Route는 여전히 **501 placeholder**(DB·외부 전송 없음 · 실질 CUD 없음)로 plan 82·83의 Out 판단을 상속한다. 로그인/로그아웃 무관. Route 코드 **변경 없음** · `recordActivityLog` **0건** grep 유지(AC-22). 실전송 2xx 전환 시 **신규 plan**에서 plan 08 연동.

---

## 영향 파일 & 패턴

| 팀 | 경로 | 작업 |
|----|------|------|
| FE 수정 | `src/features/quick-request/components/quick-request-page-content.tsx` | Wizard → `QuickRequestOrderPage` |
| FE 수정 | `.../quick-request-order-page.tsx` | 반응형 shell · `scrollToFirstError` · 모바일 바·Drawer 연결 |
| FE 수정·분할 | `.../quick-request-order-form-sections.tsx` | 카카오 스타일 재작성 · 섹션 파일 분할 권장 (`-address-section` · `-vehicle-section` · `-schedule-section` · `-goods-section` · `-driver-notes-section` · `-freight-section`) · **기존 testid 보존** |
| FE 수정 | `.../quick-request-location-section.tsx` | InputGroup 주소 검색 · 2열 연락 |
| FE 수정 | `.../quick-request-confirm-board.tsx` | 카카오 요약 스타일 · 요금 블록 제거 · `QuickRequestSummaryContent` 추출 |
| FE 수정 | `.../quick-request-note-cards.tsx` · `.../quick-request-section-shell.tsx` | 칩 44px · 섹션 라벨 |
| FE 신규 | `.../quick-request-mobile-summary-bar.tsx` | 요약 1줄 + 등록 + Drawer |
| FE 신규 | `src/features/quick-request/lib/quick-request-vehicle-visuals.ts` | 이미지·배지 매핑 |
| FE 신규 | `public/quick-request/vehicles/vehicle-{quick,damas,labo,1ton}.png` | 클론에서 복사 |
| FE 삭제 (마지막) | `quick-request-wizard.tsx` · `quick-request-step-indicator.tsx` · `quick-request-step-{1-items,2-origin,3-destination,4-summary}.tsx` | wizard 폐기 |
| FE 수정 (마지막) | `schemas/quick-request-form.ts` (step schema export 제거) · `lib/quick-request-constants.ts` (`QUICK_REQUEST_WIZARD_STEPS` 제거) | dead code |
| 유지 | `src/app/dashboard/quick/request/{page,loading}.tsx` · `api/*` · `lib/{default-form-values,map-quick-request-notify,format-quick-request-message,datetime-local}.ts` · `daum-postcode-button.tsx` · `quick-request-preview-dialog.tsx` · `app/api/quick-request/notify/route.ts` | 불변 |
| 선택 | `src/components/icons.tsx` | 「기타」 아이콘 키 추가 시만 |
| verifier | `e2e/quick-request/{helpers.ts, order-page.spec.ts(신규·wizard.spec.ts 대체), responsive.spec.ts(신규), theme.spec.ts(신규), nav-and-guard.spec.ts(AC-27 앵커)}` · `notify.api.spec.ts` 불변 | |

**패턴:** `useAppForm` + `form.AppField`(경유 `mode='array'`) · `mutations.ts` 경유 notify · `onSuccess` UI + reset · `formatAbsoluteDateTimeKo` · `PageContainer viewportFill` · Sheet/Drawer CTA 도달성(core-conventions §Sheet 폼 모바일 대응 준용)

**의존성/호출자:** `QuickRequestWizard`는 `quick-request-page-content.tsx`에서만 import · `useFormStepper`는 `multi-step-product-form.tsx`도 사용(훅 유지) · e2e `helpers.gotoQuickRequest`·nav-and-guard AC-27이 `step-indicator`에 의존(교체 필요) · `playwright.config.ts`의 `E2E_SLOW_QUICK_REQUEST` 유지

---

## 리스크 & 완화

| 수준 | 리스크 | 완화 |
|------|--------|------|
| HIGH | 데스크톱 aside·모바일 바 동시 DOM → testid 중복으로 e2e strict-mode 실패 | 등록 버튼·요약 testid 분리 · Drawer는 열릴 때만 마운트 · spec은 viewport별 testid 사용 |
| HIGH | 375/768 가로 overflow (9카드 그리드 · 긴 라벨 · `datetime-local` · 2열 연락 · 테마별 폰트/offset shadow) | `min-w-0`·`break-keep`·`w-full` · AC-14(3폭 + neobrutualism·notebook·mono 375) · AC-19(20조합 1280) |
| HIGH | quick-request 전체가 **git untracked** → git 롤백 불가 | **Step 0 tar 스냅샷**(아래) · wizard 삭제는 **마지막 단계** |
| MED | 카카오 색·폰트·고정 radius/shadow 유입 → 테마/다크 깨짐 | AC-20 grep (`#hex`·`kq-`·`bg-white`·`text-black`·`-[#`·`Roboto`·`rounded-[`·`shadow-[`) · AC-19 |
| MED | 단일 화면 검증 시 에러 필드가 화면 밖 | `scrollToFirstError` · AC-17 |
| MED | wizard 삭제 후 AC-27 nav spec·helpers 깨짐 | 앵커 `quick-request-order-page`로 교체 (Step 5) |
| MED | 차량 PNG 다크모드 대비 | `bg-muted` 타일 · AC-23 육안 |
| LOW | **카카오 이미지 권리** — 사내용 한정 사용 (클론 README 공개배포 경고, 사용자 인지) | 이미지 한 폴더 + 매핑 1파일로 격리 → 교체 비용 최소 |
| LOW | 메시지가 착불 선택 시에도 `💳 결제: 월정산` 고정줄 출력 (83 정책, 기존 동작) | 범위 밖 · 정책 변경 시 별도 plan |

---

## Battle Plan (단계)

| # | 단계 | 산출물 | Confidence | 의존 |
|---|------|--------|------------|------|
| 0 | **파일 스냅샷 백업 (git 없이)** — root가 FE 착수 전 현재 untracked quick-request 파일 + `use-stepper.tsx`를 tar로 백업 (아래 명령) | `quick-request-baseline-20261020.tar.gz` | HIGH | — |
| 1 | **designer** — D1 레이아웃 명세 · 토큰 매핑표 확정 · 차량 카드(이미지 타일·배지·선택 상태) · 카드형 radio · 44px · 테마 토큰 only 지시 | 디자인 산출물 | MED | 0 |
| 2 | **자산 + 매핑** — PNG 4장 복사 · `quick-request-vehicle-visuals.ts` | public 폴더 · 매핑 | HIGH | 1 |
| 3 | **frontend-dev 본체** — OrderPage 반응형 shell · 섹션 재작성/분할 · location InputGroup · 요약 공유 컴포넌트 · 모바일 바 + Drawer · `scrollToFirstError` · page-content 전환 | 동작하는 단일 화면 | MED | 1, 2 |
| 4 | **정리 (마지막)** — wizard 파일·step schema·`WIZARD_STEPS` 삭제 · `use-stepper.tsx` 불변 | dead code 0 | HIGH | 3 |
| 5 | **e2e** — helpers 재작성 · `order-page.spec.ts` · `responsive.spec.ts` · `theme.spec.ts`(`THEMES` import) · AC-27 앵커 교체 | spec | MED | 3 |
| 6 | **verifier** — `bunx playwright test e2e/quick-request` · tsc · lint · `npm run build` · grep AC · `npm run e2e:cleanup` | green 보고 | HIGH | 4, 5 |

**체크포인트:** Step 3 직후 — 1280·375에서 렌더 · 미리보기 → 확인 → reset 수동 1회 통과.

**Step 0 백업 (root 실행 · 예시):**

```bash
cd /Users/hoon/Desktop/Wake_Auto/WakeOne-web
tar -czf ../quick-request-baseline-20261020.tar.gz \
  src/features/quick-request \
  src/app/dashboard/quick \
  src/app/api/quick-request \
  e2e/quick-request \
  src/hooks/use-stepper.tsx \
  docs/plans/82_quick-request-plan.md \
  docs/plans/83_quick-request-wizard-plan.md
tar -tzf ../quick-request-baseline-20261020.tar.gz | head   # 내용 확인
```

- 백업 위치는 **레포 밖**(`/Users/hoon/Desktop/Wake_Auto/`) — 커밋 대상에 섞이지 않도록.

### ROLLBACK (스냅샷 기준)

1. **부분 롤백 (UI만 되돌림):** Step 4 이전이면 `quick-request-page-content.tsx`만 `QuickRequestWizard` import로 되돌리면 83 wizard 복귀 (wizard 파일이 아직 존재).
2. **전체 롤백:** 변경·신규 파일 제거 후 스냅샷 복원
   ```bash
   cd /Users/hoon/Desktop/Wake_Auto/WakeOne-web
   rm -rf src/features/quick-request src/app/dashboard/quick src/app/api/quick-request e2e/quick-request public/quick-request
   tar -xzf ../quick-request-baseline-20261020.tar.gz
   ```
   - `src/components/icons.tsx`에 키를 추가했다면 해당 키만 수동 제거.
3. 커밋·PR은 파이프라인 밖 — 사용자가 전체 수정 확인 후 `@commit-pr`로 최초 커밋.

### 추정

- 범위: 신규 ~5 · 수정 ~10 · 삭제 6 · e2e 5 → ~1,000–1,400줄
- 복잡도: **Medium**
- designer ~20–30분 · FE ~90–130분 · e2e ~50–70분(테마 20조합 포함) · 검증 ~20–30분 → **~180–260분**

---

## 팀별 구현 순서

1. **root** — Step 0 tar 스냅샷
2. **designer** — UI 요구사항·토큰 매핑·테마 토큰 only
3. ~~backend-dev~~ — **생략** (notify Route·schema·DB 변경 없음)
4. **frontend-dev** — Step 2~4
5. **verifier** — Step 5~6 · AC-01~24

## 검증 체크리스트 (verifier)

- [ ] `bunx playwright test e2e/quick-request` green (AC-01~04 · 06~19 · 22)
- [ ] grep AC-05 · AC-20 · AC-21 · AC-22(Route `recordActivityLog` 0)
- [ ] `tsc` · lint · `npm run build`
- [ ] `npm run e2e:cleanup` exit 0
- [ ] AC-23 육안 QA 체크리스트(`vercel`·`supabase`·`claude` × light/dark) 사용자 전달

---

## 열린 질문

- 없음 (2026-10-20 사용자 답변: 베이스라인 커밋 안 함 → tar 스냅샷 · 기본 테마 `vercel` + **THEMES 전체** 무손상)

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-10-20 | 최초 작성 · Approved · 83 UI/AC supersede · 카카오 디자인 단일 화면 · THEMES 10종 × light/dark · tar 스냅샷 롤백 | planner |
| 2026-10-21 | 일부 AC·testid·Out 범위 superseded by [87](./87_quick-request-goods-notes-address-picker-plan.md) (물품 크기·사용자별 특이사항 칩·주소 검색 Dialog·최근 주소) | planner |
| 2026-10-28 | [96](./96_quick-preview-card-chat-bottom-align-plan.md) 구현 반영 — 미리보기 Dialog의 `<pre data-testid="quick-request-preview-message">` 텍스트 덩어리를 **구조화 카드**(`quick-request-preview-card` · 출발/도착 2칸 · 경유 · 칩 4종)로 교체 → AC-13의 `<pre>`·`previewMessage()` 판정은 `dialog[name=퀵 요청 미리보기]` 가시성 + 칩/카드 testid로 supersede · `formatQuickRequestKakaoMessage`→(92)`formatQuickRequestPreviewText` 계열 포맷터 **삭제** · `DialogFooter gap-2`. 레이아웃·테마·반응형 규칙은 유지 | planner |
