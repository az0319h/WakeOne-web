# 106 퀵 휴대폰 화면 구조 개편 — UI 설계 (designer)

> Date: 2026-10-29
> Status: Approved
> Author: designer
> Plan: [106_quick-mobile-restructure-plan.md](./106_quick-mobile-restructure-plan.md) (Approved · AC 55)
> 참고: 직전 점검 스크린샷(375×812 · admin) · `measure.json`(요청 폼 섹션 높이 실측) · 선례 [88 design](./88_workflow-expense-design.md)
> 원칙: **휴대폰 품질 1순위**. 휴대폰 규칙은 `lg`(1024) 미만에만 적용하고 PC(≥1024)는 지금 화면을 지킨다(plan §PC 영향 예외 X-1~X-3만). `/root` 단일 게이트라 Designer gate(3 preview 선택)는 없다. 대안이 있던 곳은 비교만 적고 확정안 1개를 골랐다.
> 이 문서는 코드를 쓰지 않는다. backend-dev / frontend-dev / verifier가 바로 쓰는 기준이다.

---

## 0. 핵심 결정 요약

| # | 결정 | 근거 |
|---|------|------|
| K1 | **OQ-1 = 「공통 상단바·탭 바 숨김」(문서 흐름 안 전체 화면)**. 오버레이(`fixed inset-0`)는 쓰지 않는다. lg 미만에서 대화방·상세 대화 루트에 `data-quick-fullscreen`을 달고, 전역 CSS 1곳(`:has()`)이 상단바·iOS 안내 배너·퀵 탭 바를 숨기고 문서 스크롤을 잠근다 | §5.1 비교. iOS 키보드에서 `fixed` 레이어는 레이아웃 뷰포트가 밀리며 상단이 화면 밖으로 나가고, 배경 스크롤 잠금 hack이 필요하다. 문서 흐름 방식은 이미 운영 중인 `useVisualViewportHeight`(plan 93·96 검증)를 그대로 쓰고, 참여자 Drawer·AlertModal·라이트박스·토스트가 z-index 다툼 없이 위에 뜬다. plan 리스크 표도 「실패 시 상단바 숨김 우선」 |
| K2 | **testid 중복 금지 원칙**: 같은 testid를 가진 요소는 DOM에 한 벌만. ① SSR되는 셸(헤더·툴바·칩 줄·요약바)은 **CSS(`lg:`/`max-lg:`)로 배치만** 바꾼다 ② hydration 뒤에만 그려지는 트리(내역 목록 본문·상세 본문·대화 헤더)는 `useMatchMedia`로 **한 벌만 렌더** | plan 리스크 MED(strict mode). `useMatchMedia`는 SSR 스냅샷이 `false`라 SSR 트리에서 쓰면 PC 첫 페인트가 깜빡인다 |
| K3 | 퀵 하단 탭 바는 **`position: sticky; bottom: 0`(문서 흐름 안)**. `fixed` 금지 | T768에서 사이드바가 펼쳐져도 탭 바가 `SidebarInset` 폭 안에만 있어 겹치지 않는다(AC-07). 본문 끝이 자동으로 탭 바 위에서 끝나 AC-21도 구조로 만족 |
| K4 | 내역 카드의 상세 링크는 **카드 전체를 덮는 빈 `<a>`(aria-label 「{번호} 상세 보기」)**. 요청번호 글자는 일반 텍스트 | `::after` stretched link는 `<a>`의 boundingBox가 글자 크기(약 80×24)라 AC-09 44px 스캔에서 떨어진다. 덮는 링크는 박스 = 카드 |
| K5 | 「⋯」 메뉴는 대화 상단바·상세 하단 바 모두 **`DropdownMenu`**(항목 `min-h-11`) | 항목이 `role=menuitem`이라 AC-09·48의 「메뉴 항목」 정의와 맞다. Drawer → AlertModal 연쇄(포커스·스크롤 잠금 충돌)를 피한다. 파괴적 항목은 마지막·빨강(ui-design-brain) |
| K6 | 필터 판(내역·대화 목록)은 **vaul `Drawer`(아래에서)** + 본문 스크롤 + 아래 고정 footer. 「기간 직접 선택」 달력은 판 안에서 **펼침**(Popover 중첩 없음) | core-conventions §Sheet 모바일 CTA. 판 위에 Popover를 또 띄우면 포커스 트랩이 둘 |
| K7 | 달력 44px는 **`Calendar`의 `classNames` prop 덮어쓰기**로 한다(`day_button`·`weekday`·`button_previous/next`·`month_caption`) | 이 프로젝트 `ui/calendar.tsx`는 `--cell-size` 변수가 없다(react-day-picker classNames 방식). plan D-7의 `[--cell-size:…]`는 적용 불가 → 같은 목적을 ui 수정 없이 달성 |
| K8 | 요청 폼 주소 칸 `readonly`는 **휴대폰 기본(mobile-first)**: `useMatchMedia('(min-width: 1024px)')`가 `true`가 된 뒤에만 입력 가능으로 바뀐다. 아이콘 버튼·글자 등 **모양은 CSS**로 나눈다 | 사용자 대다수가 휴대폰. PC는 hydration 뒤 1프레임 안에 입력 가능(AC-12 `.fill()`은 editable 자동 대기). 모양이 CSS라 PC 레이아웃 깜빡임 없음 |
| K9 | 상세는 lg 미만에서 **휴대폰 전용 트리 1벌**(`QuickRequestDetailMobile`)을 그린다. 섹션 컴포넌트는 재사용, 순서·밀도만 다르다 | 상세 본문은 hydration 뒤 렌더(K2 ②). PC 트리는 손대지 않는다 |
| K10 | 처리 이력이 **「등록」 1건뿐이면 휴대폰에서 이력 카드 생략** | 스테퍼 1단계가 같은 시각을 이미 보여 준다. AC-46(요청 시각 문자열 1곳) 충족 |
| K11 | 기사 「전화 걸기」 버튼은 **하단 바에 활성 주 버튼이 없을 때만 primary**, 있으면 outline | 한 화면 primary 1개(ui-design-brain). 요청자 `dispatched`(승인 막힘)에서는 전화가 사실상 주 동작 |
| K12 | 할 일이 없는 상세의 떠 있는 「대화」는 **글자 있는 알약형(56px 높이)** `[대화 2]` | 아이콘만 있는 FAB보다 뜻이 분명하다(다른 버튼이 없는 화면) |
| K13 | 요청 폼 휴대폰 높이 줄이기: 섹션 간격 40→20 · 주소 카드 테두리 제거(평면) + 경로 점은 왼쪽 20px 여백 안 · 담당자/연락처 한 줄 · 차량 사진 5:2 · 물품 카드 한 줄 압축 · 메모 빈 칸 한 줄 | AC-23 ≤ 2,400px(§4.6 예산 2,334px · 실측 기준) · 주소 칸 ≥ 300px(323px) |
| K14 | 내역 칩 줄 = **기존 상태 카드 버튼 5개를 그대로**(같은 testid) `max-lg:` 클래스로 알약 모양 · 가로 밀기. 「취소 N」도 같은 줄 5번째. PC는 같은 그리드에서 `lg:col-span-4 lg:justify-self-end`로 지금처럼 오른쪽 아래 | AC-14(5개 같은 y) · AC-12(PC 카드 높이 ≥ 80) |
| K15 | 대화 목록 기간 버튼은 **「기간 7일」처럼 현재 값을 보여 주는 버튼**(`quick-chat-filter-button`) | 대화 목록에는 메타바가 없어 기간 라벨이 사라진다. 버튼이 값을 보여 주면 줄이 늘지 않는다 |
| K16 | `IosInstallBanner` 컴포넌트는 **수정하지 않는다**(D-19). 대화 전체 화면일 때만 dashboard layout의 감싸는 `div[data-app-banner]`가 숨는다 | 전체 화면 대화 위에 100px 배너가 남으면 D-12 위반 |
| K17 | shadcn **신규 add 0건** · `src/components/ui/` 수정 0건 · 아이콘은 기존 `Icons` 키만(`list`·`chat`·`add`·`adjustments`·`calendar`·`dots`·`phone`·`chevronLeft`·`teams`·`edit`·`circleX`·`info`·`refresh`·`search`·`user`) | shadcn MCP 조회(레지스트리 @shadcn·@shadcnblocks·@animate-ui·@reui) — 하단 탭 바는 블록 수준이 과해 feature 컴포넌트로 만든다 |

---

## 1. 공통 기준

### 1.1 폭 구간

| 이름 | 폭 | 규칙 |
|------|----|------|
| 휴대폰 | < 768 (M360·M375·M430) | 휴대폰 규칙 |
| 태블릿 | 768~1023 (T768) | 휴대폰 규칙 + 내역 카드 2열 · 상단바는 `md:h-14`(56) |
| PC | ≥ 1024 (D1024·D1280) | **지금 화면 그대로** (예외 X-1~3) |

- Tailwind 경계는 `lg:` / `max-lg:`만 쓴다. `md:`로 휴대폰 규칙을 끊지 않는다(태블릿도 휴대폰 규칙). 예외: 앱 전체 상단바 버튼 44px는 plan D-3대로 `md` 미만.
- 미디어 쿼리 상수: 기존 `QUICK_CHAT_MOBILE_MEDIA_QUERY = '(max-width: 1023px)'` 재사용. PC 판정은 `'(min-width: 1024px)'`.

### 1.2 측정 기준값 (높이 예산표 공통)

| 요소 | 높이(px) | 근거 |
|------|----------|------|
| 공통 상단바 | 64 (< md) / 56 (≥ md) | `header.tsx` `h-16 md:h-14` (변경 없음) |
| `PageContainer` 위 여백 | 8 (`pt-2`) / 16 (md `pt-4`) | 변경 없음 |
| 퀵 탭 바 | 56 + `env(safe-area-inset-bottom)` | 에뮬레이션에서는 inset 0 |
| 터치 타깃 | 44 (`h-11`/`size-11`) | M-1 |
| `text-sm` 줄 | 20 · `text-xs` 줄 16~18 · `text-base` 줄 24 | Tailwind 기본 |

- 실기기 아이폰 사파리(미설치)에서는 `IosInstallBanner`(약 100px)가 상단바 아래에 더 붙는다. 자동 검사(Chromium UA)에는 나오지 않으므로 예산표는 배너 없음 기준. 설치 앱·배너 닫음 상태에서는 예산표와 같다.

---

## 2. 공통 틀 (U-1 · U-2 · D-2~D-5)

### 2.1 와이어 — 상단바 3종 (M375)

```text
╭─ preview — zsh ───────────────────────────────────────╮
│ ~/WakeOne-web   $ npm run dev   ✓ ready                │
│                                                        │
│  ╭─ A. 탭 화면(내역·대화 목록) ─────────────────────╮  │
│  │ [≡]│ 퀵 내역                       [◐]  [알림9]  │  │  64px · 버튼 각 44
│  ╰──────────────────────────────────────────────────╯  │
│  ╭─ B. 하위 화면(요청 폼·상세) ─────────────────────╮  │
│  │ [≡]│ [<] 퀵 2026-1876              [◐]  [알림9]  │  │  [<] = quick-mobile-back
│  ╰──────────────────────────────────────────────────╯  │
│  ╭─ C. 대화방·상세 대화(전체 화면 · 공통 상단바 없음) ╮  │
│  │ [<]  2026-1876 [신규요청]                  [⋯]   │  │  56px · quick-chat-header
│  │      서울 중구 → 서울 종로구 · 홍성훈            │  │
│  ╰──────────────────────────────────────────────────╯  │
│ → ~/WakeOne-web                                        │
╰────────────────────────────────────────────────────────╯
```

- 화면 이름은 기존 `Breadcrumbs`의 마지막 항목(`BreadcrumbPage`)이 그대로 보여 준다. `use-breadcrumbs.tsx` routeMapping에 퀵 경로를 추가한다:

| 경로 | 항목 (lg 이상은 전부 · lg 미만은 마지막만 · r1) |
|------|------|
| `/dashboard/quick` | Dashboard / **퀵 내역** |
| `/dashboard/quick/request` | Dashboard / 퀵 내역 / **퀵 요청** |
| `/dashboard/quick/chat` | Dashboard / 퀵 내역 / **퀵 대화** |
| `/dashboard/quick/{번호}` | Dashboard / 퀵 내역 / **퀵 {번호}** (동적 — `isQuickRequestNo` 통과 시) |

- 「Dashboard」 한국어화는 Out(plan). 사용자 역할과 무관하게 「퀵 내역」(D-2).

### 2.2 상단바 변경 (`header.tsx` · 앱 전체 · lg(1024) 미만만 변화 · r1)

| 요소 | 지금 | 바꿈 |
|------|------|------|
| `<header>` | — | `data-app-header` 속성 추가(전체 화면 대화에서 CSS로 숨김) |
| `SidebarTrigger` | `size-7` | `className='-ml-1 size-11 lg:size-7'` (ui 안 고침 · className만 · r1: `md:` → `lg:`) |
| `ThemeModeToggle` 버튼 | `size-8` | `size-11 lg:size-8` (r1: `md:` → `lg:`) |
| `NotificationCenter` 트리거 | `h-8 w-8` | `size-11 lg:size-8` (배지 위치 유지 · r1: `md:` → `lg:`) |
| 검색 「Search... ⌘K」 | md 이상 보임 | **lg 이상만** 보임 (r1) |
| 테마 프리셋 Select | sm 이상 보임 | **lg 이상만** 보임 (r1) |
| `Breadcrumbs` | md 이상 전체 경로 | **lg 미만 마지막 항목만 + `truncate`** (r1 · T768 사이드바 펼침 때 상단바 가로 넘침 129~169px 해소) |
| 뒤로 슬롯 | 없음 | `Separator` 다음, `Breadcrumbs` 앞에 `<QuickMobileBackButton />`(client) |

- `QuickMobileBackButton`: `usePathname()`이 `/dashboard/quick/request` 또는 `/dashboard/quick/{번호}`일 때만 렌더, `lg:hidden`. `Button variant='ghost' size='icon' className='size-11'` · `aria-label='뒤로'` · `data-testid='quick-mobile-back'` · `Icons.chevronLeft`. 동작은 §7 `useQuickBack`.
- 375 폭 계산: 왼쪽 16 + 44 + 8 + 1(구분선) + 8 + 44 + 4 = 125 · 오른쪽 44 + 8 + 44 + 16 = 112 → 화면 이름 칸 ≈ 130px(「퀵 2026-1876」 약 85px) · M360 ≈ 115px. 넘치면 `truncate`.

### 2.3 `PageContainer` prop (`components/layout/page-container.tsx`)

| prop | 값 | 동작 |
|------|----|------|
| `mobileHeader` (신규) | `'visible'`(기본) \| `'hidden'` | `'hidden'`이면 헤더 묶음(Heading + `pageHeaderAction`) 래퍼에 `hidden lg:flex` — lg 미만에서 제목·설명·헤더 버튼이 **DOM에는 있되 보이지 않음**(SSR 동일 · PC 동일) |
| `viewportFill` (확장) | `boolean` \| `'lg'` | `'lg'`이면 `min-h-0 flex-1 overflow-hidden`을 **lg에서만**(`flex-1 lg:min-h-0 lg:overflow-hidden`), 안쪽 래퍼도 `lg:` 한정. lg 미만은 일반 문서 흐름(페이지 스크롤 · sticky 동작) |

- 퀵 4화면의 `page.tsx`와 `loading.tsx` 모두 `mobileHeader='hidden'`(로딩 중에도 제목이 튀어나오지 않게).
- `<Heading>`을 `sr-only`로 남기지 않는다: `sr-only`는 Playwright `isVisible`에서 「보임」(1px 박스)이라 AC-01이 떨어진다. 화면 이름은 상단바가 맡는다.

### 2.4 ⓘ 「퀵 권한 안내」 (D-2 · U-2)

- 신규 `QuickMobileInfoButton`: 기존 `InfoButton` 재사용 · `content={quickInfoContent}` · `aria-label='퀵 권한 안내 보기'`(props 뒤 펼침으로 덮어씀) · `className='size-11 lg:hidden'` · `data-testid='quick-mobile-info-button'`.
- 위치: 내역 = 메타바 오른쪽 끝 · 상세 = 상태 카드 1행 오른쪽 · 대화 목록 = 목록 머리(행 A) 오른쪽. 상단바에는 두지 않는다(정찰 F-3 — `InfobarProvider` 밖).
- PC는 `PageContainer` 제목 옆 기존 ⓘ 그대로.

### 2.5 viewport · safe-area (D-3 · 앱 전체)

| 파일 | 변경 |
|------|------|
| `app/layout.tsx` `viewport` | `viewportFit: 'cover'` 추가(`interactiveWidget`은 추가하지 않음 — 앱 전체 키보드 동작 변화는 범위 밖) |
| `app/layout.tsx` `<body>` | `pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]` (세로 화면·PC = 0 → 변화 없음 · AC-04) |
| 하단 고정 요소 | 퀵 탭 바 `pb-[env(safe-area-inset-bottom)]` · 요청 폼 요약바·상세 하단 바·대화 입력칸은 이미 `max(…, env(safe-area-inset-bottom))` 유지 · 떠 있는 「대화」 `bottom-[calc(1rem+env(safe-area-inset-bottom))]` |

### 2.6 전체 화면·스크롤 여백 전역 CSS (`src/styles/globals.css` · 1곳)

```css
@media (max-width: 1023.98px) {
  /* K1 — 대화방·상세 대화 전체 화면 */
  [data-slot='sidebar-inset']:has([data-quick-fullscreen]) > [data-app-header],
  [data-slot='sidebar-inset']:has([data-quick-fullscreen]) [data-app-banner],
  [data-slot='sidebar-inset']:has([data-quick-fullscreen]) [data-quick-tabbar] { display: none; }
  html:has([data-quick-fullscreen]) { overflow: hidden; overscroll-behavior: none; }

  /* web-interface-guidelines — sticky가 포커스된 칸을 가리지 않게 */
  html:has([data-quick-sticky-bottom]) { scroll-padding-top: 4.5rem; scroll-padding-bottom: 5.5rem; }
}
```

- `data-quick-sticky-bottom`: 퀵 탭 바 · 요청 폼 요약바 · 상세 하단 바에 단다(Tab 이동·`scrollToFirstError`·주소 선택 뒤 포커스가 바 뒤로 숨지 않음).
- `data-app-banner`: `app/dashboard/layout.tsx`에서 `<IosInstallBanner />`를 `<div data-app-banner className='contents'>`로 감싼다(배너 컴포넌트 불변 · K16).

### 2.7 퀵 레이아웃 · 하단 탭 바 (D-4 · U-1)

```text
╭─ preview — zsh ───────────────────────────────────────╮
│ ~/WakeOne-web   $ npm run dev   ✓ ready                │
│  ╭─ quick-mobile-tabbar (요청자·구매물류 · 3칸) ─────╮ │
│  │──────────────────────────────────────────────────│ │  border-t · bg-background/80 blur
│  │      [≣]              [말풍선]²            (+)    │ │  아이콘 24 · (+)는 primary 원
│  │      내역               대화             요청하기  │ │  text-xs · 높이 56
│  │                (홈 막대 safe-area 여백)            │ │
│  ╰──────────────────────────────────────────────────╯ │
│  ╭─ 동방특송 · 2칸 ─────────────────────────────────╮ │
│  │          [≣]                    [말풍선]²         │ │
│  │          내역                     대화            │ │
│  ╰──────────────────────────────────────────────────╯ │
│ → ~/WakeOne-web                                        │
╰────────────────────────────────────────────────────────╯
```

- 신규 `src/app/dashboard/quick/layout.tsx`(server · dashboard layout 상속 → Presence 자동):
  ```
  <div className='flex min-h-0 min-w-0 flex-1 flex-col'>
    <QuickBackTracker />                 ← §7
    {children}
    <QuickMobileTabbar canCreate={viewer.canCreate} />
  </div>
  ```
  `canCreate`는 `requireDashboardSession()` + `buildQuickRequestViewer(profile)`(page와 같은 계산).
- `QuickMobileTabbar`(client): `usePathname()`이 `/dashboard/quick` 또는 `/dashboard/quick/chat`일 때만 렌더(요청 폼·상세에서는 `null`). 대화방(`?request=`)은 전역 CSS(§2.6)가 숨긴다.
  - `<nav aria-label='퀵 메뉴' data-testid='quick-mobile-tabbar' data-quick-tabbar data-quick-sticky-bottom className='sticky bottom-0 z-30 mt-auto border-t bg-background/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden'>`
  - `<ul className='grid grid-cols-3'>`(canCreate 없으면 `grid-cols-2`) · 각 `<li>`에 `<Link>`: `flex h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium touch-manipulation` · 비활성 `text-muted-foreground` · 활성 `text-primary` + `aria-current='page'` · focus-visible ring.
  - testid: `quick-mobile-tab-list` 「내역」(`Icons.list`) · `quick-mobile-tab-chat` 「대화」(`Icons.chat`) · `quick-mobile-tab-request` 「요청하기」(`Icons.add`를 `size-7 rounded-full bg-primary text-primary-foreground` 원 안에 — 활성 여부와 무관하게 항상 강조: 사라진 「퀵 요청하기」 버튼의 무게를 탭이 이어받음).
  - 활성: 「내역」 = pathname `/dashboard/quick` · 「대화」 = `/dashboard/quick/chat`로 시작.
  - 「대화」 배지: 사이드바와 같은 `quickRequestUnreadTotalQueryOptions()` · 0이면 없음 · `formatUnreadBadge`(99+) · 아이콘 오른쪽 위 `absolute` · `rounded-full bg-primary px-1.5 text-xs text-primary-foreground tabular-nums` · `data-testid='quick-mobile-tab-chat-badge'` · 링크 접근 이름에 `<span className='sr-only'>, 안 읽은 대화 {n}건</span>`(글자 라벨 span은 따로 두어 verifier가 라벨만 읽을 수 있게 `data-slot='label'`).
- 본문과의 관계: 탭 바가 문서 흐름 끝의 sticky라 본문 마지막 요소가 항상 탭 바 위에서 끝난다(별도 `pb` 불필요). 대화 목록은 스크롤 상자 높이를 탭 바만큼 빼서 계산(§5.3).

---

## 3. 퀵 내역 `/dashboard/quick` (U-3~U-5 · D-6~D-9)

### 3.1 와이어 — M375 · 동방특송

```text
╭─ preview — zsh ───────────────────────────────────────╮
│ ~/WakeOne-web   $ npm run dev   ✓ ready                │
│  ╭─ M375 · /dashboard/quick ─────────────────────────╮ │
│  │ [≡]│ 퀵 내역                       [◐]  [알림9]  │ │ 0–64
│  │ 기간: 최근 7일                        [↻]  [i]   │ │ 72–116 메타바
│  │ (● 신규요청 3)(● 접수 및 배차중 1)(● 배차완료 및 ▸│ │ 128–172 칩 줄(옆으로 밀기)
│  │ [ 요청번호·요청자·주소 검색…      ] [⚙ 필터 (2)] │ │ 184–228
│  │ ╭──────────────────────────────────────────────╮ │ │ 240
│  │ │ 2026-1876  참여                    [신규요청] │ │ │
│  │ │ ○ 서울 중구 → ● 서울 종로구 · 경유 1          │ │ │
│  │ │ 2026-10-29 (목) 16:16:11 · 홍성훈 · 초소형 ·  │ │ │ muted · 최대 2줄
│  │ │ 오토바이 · 1대                                │ │ │
│  │ │ [            ✓ 접수            ] [말풍선 4]   │ │ │ 업무 버튼 + 새 대화(44)
│  │ ╰──────────────────────────────────────────────╯ │ │
│  │ ╭──────────────────────────────────────────────╮ │ │
│  │ │ 2026-02                                [승인] │ │ │
│  │ │ ○ 경기 동두천시 → ● 서울 중구                 │ │ │
│  │ │ 2026-10-27 (화) 17:54:09 · 홍성훈 · 중형 ·    │ │ │
│  │ │ 라보 · 1대                                    │ │ │
│  │ │ 예상 100,000원 · 최종 110,000원               │ │ │ 금액 있을 때만
│  │ ╰──────────────────────────────────────────────╯ │ │
│  │                 더 이상 요청이 없습니다           │ │ 2페이지 이상일 때
│  │ (i) 운송 완료 후 실제 금액을 확인하고 승인해주세요. │ │ footnote
│  │══════════════════════════════════════════════════│ │
│  │        [≣]                    [말풍선]²           │ │ 탭 바 756–812
│  │        내역                     대화              │ │
│  ╰──────────────────────────────────────────────────╯ │
│ → ~/WakeOne-web                                        │
╰────────────────────────────────────────────────────────╯
```

### 3.2 와이어 — T768 (2열 · AC-11)

```text
╭─ preview — zsh ───────────────────────────────────────────────────────────╮
│  ╭─ T768 · /dashboard/quick (사이드바 접힘) ──────────────────────────────╮ │
│  │ [≡] │ Dashboard / 퀵 내역                              [◐] [알림9]    │ │ 56
│  │ 기간: 최근 7일              갱신 2026-10-29 (목) 16:35:34  [↻] [i]   │ │
│  │ (● 신규요청 3)(● 접수 및 배차중 1)(● 배차완료 및 결과 0)(● 승인 1)(취소 1) │ │
│  │ [ 요청번호·요청자·주소 검색…                          ] [⚙ 필터]    │ │
│  │ ╭──────────────────────────────╮  ╭──────────────────────────────╮  │ │
│  │ │ 2026-1876        [신규요청]  │  │ 2026-02              [승인]  │  │ │ 같은 y
│  │ │ ○ 서울 중구 → ● 서울 종로구  │  │ ○ 경기 동두천시 → ● 서울 중구│  │ │
│  │ │ …                            │  │ …                            │  │ │
│  │ ╰──────────────────────────────╯  ╰──────────────────────────────╯  │ │
│  │══════════════════════════════════════════════════════════════════════│ │
│  │            [≣] 내역          [말풍선] 대화          (+) 요청하기       │ │
│  ╰──────────────────────────────────────────────────────────────────────╯ │
╰───────────────────────────────────────────────────────────────────────────╯
```

### 3.3 높이 예산 — AC-13 (M375 812 · `user.json` · 오늘 `requested` 5건 · 업무 버튼·금액·새 대화 없음)

| 구간 | top | 높이 | bottom |
|------|-----|------|--------|
| 공통 상단바 | 0 | 64 | 64 |
| `PageContainer pt-2` | 64 | 8 | 72 |
| 메타바(`min-h-11`) | 72 | 44 | 116 |
| 간격(`gap-3`) | | 12 | 128 |
| 칩 줄(`h-11`) | 128 | 44 | 172 |
| 간격 | | 12 | 184 |
| 검색 + 필터(`h-11`) | 184 | 44 | 228 |
| 간격 | | 12 | 240 |
| **카드 1** | **240** | ≤ 116 | 356 |
| 카드 2 (`gap-3`) | 368 | 116 | 484 |
| 카드 3 | 496 | 116 | **612** |
| 카드 4 | 624 | 116 | 740 |
| 탭 바 | **756** | 56 | 812 |

- 카드 높이 = `p-3` 12 + 1행 24 + 6 + 2행 20 + 6 + 3행(최대 2줄) 36 + 12 = **116 ≤ 128** (3행 1줄이면 98).
- M375: 첫 카드 top **240 ≤ 320** · 탭 바 위로 완전히 보이는 카드 **4장(≥ 3)**.
- M360(780): 탭 바 top 724 → 카드 1~3 bottom 612 → **3장(≥ 2)** · 첫 카드 top 240 ≤ 320.
- 갱신 시각은 `sm` 미만에서 숨긴다(U-3 허용) — 보이면 메타바가 2줄(+24)이 된다.

### 3.4 메타바 (`quick-dashboard-meta-bar.tsx`)

- 순서: [기간 라벨(`quick-dashboard-range-label` · 그대로)] … [갱신 시각 `hidden sm:inline`] [↻ `size-11 lg:size-9` 그대로] [`QuickMobileInfoButton`].
- lg 이상: 갱신 시각 보임 · ⓘ 버튼 `lg:hidden`이라 PC 동일.

### 3.5 상태 칩 줄 (`quick-status-cards.tsx` · K14)

| 항목 | lg 미만(칩) | lg 이상(지금 그대로) |
|------|-------------|---------------------|
| 컨테이너 | `role='group' aria-label='진행 상태'` · `flex gap-2 overflow-x-auto overscroll-x-contain -mx-4 px-4 scroll-px-4 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden` + 오른쪽 끝 흐림 마스크(빠른 답장 칩 줄과 같은 `mask-image`) · md에서는 `-mx-6 px-6` | `lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0` (가로 gap 8 · 세로 gap 8 = 지금과 같음) |
| 카드 4개 버튼 | `max-lg:h-11 max-lg:min-h-0 max-lg:shrink-0 max-lg:snap-start max-lg:flex-row max-lg:items-center max-lg:gap-1.5 max-lg:rounded-full max-lg:px-3` | 그대로(`min-h-20` 세로 카드) |
| 설명문 span | `max-lg:hidden` | 보임 |
| 숫자 span(`…-count`) | `max-lg:text-sm max-lg:font-semibold` · 라벨과 숫자 사이 실제 공백 `{' '}` (flex 렌더에는 영향 없음 · 글자 「신규요청 3」) | `text-2xl` 그대로 |
| 「취소 N」 버튼 | 같은 줄 5번째 · `max-lg:` 칩 모양(outline · 점 `bg-muted-foreground`) | `lg:col-span-4 lg:justify-self-end` + 지금 ghost 모양(지금의 `flex justify-end` 줄과 같은 위치) |
| 선택 | `aria-pressed` · `border-primary bg-primary/5 ring-1 ring-primary`(89 규칙 · 지금과 같음) · 선택이 바뀌면 그 칩을 `scrollIntoView({ inline: 'nearest', block: 'nearest' })` | 그대로 |

- 칩 폭(375): 약 100 · 135 · 150 · 72 · 64 → 합 ≈ 555 > 343 → 옆으로 밀기. 페이지 가로 스크롤은 0(칩 줄 안에서만 · `-mx-4`는 부모 패딩 안).
- verifier 메모: 칩 글자 판정은 `innerText`(숨은 설명문 제외) 또는 정규식 `^신규요청 3`으로.

### 3.6 툴바 (`quick-dashboard-toolbar.tsx`)

```
lg 미만:  [ InputGroup 검색 h-11 flex-1 ] [ 필터 버튼 h-11 ]
lg 이상:  (지금 그대로) 기간 ToggleGroup + 달력 / 검색 · 상태 Select · 초기화 · 총 N건
```

- 기간 줄(`QuickRangeFilter`) 래퍼 `hidden lg:flex` · 상태 Select/초기화/총 N건 묶음 `hidden lg:flex` · 필터 버튼 `lg:hidden`. DOM은 SSR 한 벌(K2 ①). lg 이상 클래스는 지금 값과 같게.
- 필터 버튼: `Button variant='outline' className='h-11 shrink-0 gap-1.5 px-3'` · `Icons.adjustments` + 「필터」 + 켜진 수 `Badge`(`quick-dashboard-filter-count` · 0이면 없음) · `aria-haspopup='dialog'` · `aria-label='필터 · 켜진 필터 {n}개'` · `data-testid='quick-dashboard-filter-button'`.
- 켜진 필터 수 = (기간 ≠ 기본 7일 ? 1 : 0) + (상태 있음 ? 1 : 0). 검색은 바깥에 보이므로 세지 않는다(AC-15 「2」→「1」).

### 3.7 필터 판 `QuickDashboardFilterSheet` (U-4 · D-7 · K6)

```text
╭─ preview — zsh ───────────────────────────────────────╮
│  ╭─ M375 · quick-dashboard-filter-sheet (Drawer 아래) ╮ │
│  │                    ────                           │ │ 손잡이
│  │ 필터                                              │ │ DrawerTitle
│  │ ───────────────────────────────────────────────── │ │
│  │ 기간                                              │ │ ┐
│  │ [  7일  ][ 30일 ][ 90일 ][ 전체 ]                 │ │ │ ToggleGroup h-11 · 4칸
│  │ [ 달력  기간 직접 선택                        ▾ ] │ │ │ h-11 · aria-expanded
│  │   시작일과 종료일을 차례로 선택하세요             │ │ │ ┐ 펼침(Collapsible)
│  │   [<]          2026년 10월           [>]          │ │ │ │ 44px 칸
│  │    일  월  화  수  목  금  토                     │ │ │ │
│  │    ..  ..  ..  ..  ..  ..  ..                     │ │ │ │
│  │   [ 지우기 ]                      [ 적용 ]        │ │ │ ┘ h-11
│  │ 상태                                              │ │ │ 스크롤 본문
│  │ ( ) 전체                                          │ │ │ RadioGroup 행 h-11
│  │ (●) 신규요청                                   3  │ │ │ 점 + 라벨 + 숫자
│  │ ( ) 접수 및 배차중                             1  │ │ │
│  │ ( ) 배차완료 및 결과                           0  │ │ │
│  │ ( ) 승인                                       1  │ │ │
│  │ ( ) 취소                                       1  │ │ ┘
│  │ ───────────────────────────────────────────────── │ │
│  │ [   초기화   ]              [     닫기     ]      │ │ footer 고정 · safe-area
│  ╰───────────────────────────────────────────────────╯ │
╰────────────────────────────────────────────────────────╯
```

- 구조(core-conventions §Sheet 모바일): `DrawerContent data-testid='quick-dashboard-filter-sheet' className='data-[vaul-drawer-direction=bottom]:max-h-[85dvh]'`(role dialog · 이름 「필터」) → `DrawerHeader`(`DrawerTitle` 「필터」 · `DrawerDescription className='sr-only'` 「기간과 진행 상태를 고르면 바로 적용됩니다.」) → **스크롤 본문** `min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4` → **`DrawerFooter`** `grid grid-cols-2 gap-2 border-t pb-[max(1rem,env(safe-area-inset-bottom))]`.
- 선택은 **바로 URL 반영**(적용 버튼 없음 · 달력만 「적용」). 판 밖 칩·메타바·목록이 뒤에서 함께 바뀐다(필터 셸은 Suspense 밖 · plan 40).
- 「기간」: 공용 신규 `QuickRangeSheetField`(§3.8) · testIdPrefix `quick-dashboard-filter`.
- 「상태」: `RadioGroup aria-label='진행 상태'` · 6행(전체 + 5종) · 각 행은 `FieldLabel` 전체가 누르는 영역(`min-h-11 px-3 rounded-md` · 라디오와 글자 한 타깃) · 점 색 = `QUICK_REQUEST_STATUS_DOT_CLASS` · 오른쪽 숫자 = summary 캐시(`useQuery` · 없으면 「—」) · testid `quick-dashboard-filter-status-{all|requested|dispatching|dispatched|approved|cancelled}`.
- 「초기화」 `variant='outline' h-11` (`quick-dashboard-filter-reset`) = 상태·검색만 지움, 기간 유지(89 K3 · AC-15) · 켜진 필터가 없으면 `disabled`. 「닫기」 `h-11` primary(`quick-dashboard-filter-close` · `DrawerClose`).
- 열 때 포커스: 판 제목(첫 컨트롤 자동 포커스 금지 — 휴대폰에서 원치 않는 스크롤).

### 3.8 공용 `QuickRangeSheetField` (신규 · `components/dashboard/quick-range-sheet-field.tsx`)

- `QuickRangeFilter`의 `PRESETS`·`QUICK_RANGE_FILTER_TEXT`·`toDraft`·`parseLocalDate`를 export해 재사용(문구·판정 동일).
- 구성: `<fieldset>` legend 「기간」 → `ToggleGroup type='single' variant='outline' className='grid w-full grid-cols-4'`(항목 `h-11`) → 「기간 직접 선택」 버튼(`h-11 w-full justify-between` · 직접 기간이면 글자 `2026-10-01 ~ 2026-10-27` · `aria-expanded` · `aria-controls`) → `Collapsible` 안에 힌트 + `Calendar mode='range' numberOfMonths={1} locale={ko} disabled={{ after: 오늘 }}` + [지우기][적용](`h-11`).
- 달력 44px(K7): `className='p-0'` + `classNames={{ day_button: cn(buttonVariants({ variant: 'ghost' }), 'size-11 p-0 font-normal aria-selected:opacity-100'), weekday: 'text-muted-foreground w-11 font-normal text-[0.8rem]', button_previous: cn(buttonVariants({ variant: 'outline' }), 'absolute left-0 size-11 bg-transparent p-0'), button_next: cn(…, 'absolute right-0 size-11 …'), month_caption: 'relative flex h-11 w-full items-center justify-center' }}` → 폭 7×44 = 308(M360 판 본문 328 안).
- testid: `{prefix}-range-{7d|30d|90d|all|custom|calendar|apply|clear}`. 판 testIdPrefix는 **`quick-dashboard-filter` / `quick-chat-filter`**(PC 툴바의 `quick-dashboard-range-*`·`quick-chat-range-*`가 CSS로 숨은 채 DOM에 있으므로 중복 방지 · K2).

### 3.9 카드 `QuickRequestMobileCard` (U-5 · D-8 · K4)

```
<li data-testid='quick-card-{no}' className='relative flex min-w-0 flex-col gap-1.5 rounded-xl border bg-card p-3 text-card-foreground has-[a[data-card-link]:focus-visible]:ring-2 ring-ring/50'>
  <Link data-card-link href=상세 aria-label='{no} 상세 보기' data-testid='quick-card-link-{no}'
        className='absolute inset-0 rounded-xl outline-none' />          ← 카드 전체 탭 = 상세
  1행  flex justify-between : [번호 text-base font-semibold tabular-nums · 참여 배지] [상태 배지]
  2행  text-sm : ○ 출발 → ● 도착 (· 경유 N)   (truncate 1줄)
  3행  text-xs muted line-clamp-2 : {formatAbsoluteDateTimeKo(요청시각)} · {요청자} · {물품} · {차량 요약}
  금액 text-sm tabular (값이 하나라도 있을 때만) : 예상 20,000원 · 최종 —   ← 둘 다 null이면 줄 없음
  아래 (업무 버튼 또는 새 대화가 있을 때만) grid gap-2 :
     [QuickRequestRowAction layout='card' · relative z-10 · flex-1 h-11] [새 대화 N · relative z-10 · h-11 min-w-11]
</li>
```

- 「상세 보기」 버튼(`quick-card-detail-*`) **삭제**. `li`의 `tabIndex`·`onClick`·`onKeyDown` 제거(링크가 키보드·탭을 맡음).
- 「새 대화 N」(`quick-unread-{no}` · 기존 `QuickUnreadChatBadge` 링크): 휴대폰 카드에서는 `Button variant='outline' asChild className='relative z-10 h-11 min-w-11 gap-1 rounded-full px-3 tabular-nums'` 모양(아이콘 `Icons.chat` + 숫자) · 접근 이름 기존 `quickChatText.newConversationsLink`. 업무 버튼이 없으면 오른쪽 정렬 단독.
- 금액 줄: 예상만 있으면 「예상 20,000원」, 둘 다 있으면 「예상 100,000원 · 최종 110,000원」, 최종만은 「최종 110,000원」(`formatQuickAmountWon`).
- 목록 래퍼: `ul data-testid='quick-dashboard-cards' className='grid min-w-0 gap-3 md:grid-cols-2'`(T768 2열 · AC-11).
- PC 표의 `QuickUnreadChatBadge`·`QuickParticipantBadge`는 그대로(카드에서만 모양 className 전달).

### 3.10 목록 본문 분기 (`quick-dashboard-body.tsx` · D-9)

| 폭 | 렌더 | 조회 |
|----|------|------|
| lg 이상(`useMatchMedia('(min-width: 1024px)')` true) | 지금 표 + **`QuickDashboardPagination`**(신규 · 한국어) | 지금 `useSuspenseQuery`(URL `page`·`perPage`) |
| lg 미만 | 신규 `QuickDashboardMobileList` | 신규 `quickRequestListInfiniteQueryOptions(filters)` — 키 `[...quickRequestKeys.lists(), 'infinite', {range,from,to,status,search}]` · `perPage 20` · `initialPageParam 1` · `getNextPageParam = page*limit < total ? page+1 : undefined` · URL `page`/`perPage` 무시 |

- 본문은 hydration 뒤에만 렌더되므로(`useIsHydrated`) `useMatchMedia` 사용이 안전(K2 ②).
- 평탄화 + `id` 중복 제거(대화 목록 `flattenConversations`와 같은 방식). Realtime `invalidate(lists())`가 불러온 페이지 전부를 다시 받아 새 건이 맨 위(AC-19).
- 끝: `QuickInfiniteSentinel testIdPrefix='quick-dashboard-list' endMessage='더 이상 요청이 없습니다' showEnd={pages.length > 1}` · 다음 페이지 로딩은 sentinel 안 compact 스피너.
- 빈 목록: 기존 `QuickDashboardEmpty` 그대로.

### 3.11 PC 한국어 페이지네이션 `QuickDashboardPagination` (신규 · D-9 · X-2)

- `DataTablePagination`(ui)과 **같은 배치·크기**(`size-8` 버튼 · `h-8 w-[4.5rem]` Select · `gap-2 sm:gap-6 lg:gap-8`)에서 글자만 바꾼다.

| 위치 | 지금 | 바꿈 |
|------|------|------|
| 왼쪽 | `3 row(s) total.` | 「총 45건」(`data.total` · `quick-dashboard-pagination-total`) |
| 페이지당 | `Rows per page` | 「페이지당」 + Select(10/20/50) |
| 가운데 | `Page 1 of 3` | 「1 / 3 페이지」 |
| 버튼 aria-label | `Go to first/previous/next/last page` | 「첫 페이지」「이전 페이지」「다음 페이지」「마지막 페이지」 |

- `quick-dashboard-data-table.tsx`의 `DataTablePagination` 1곳을 이것으로 교체(ui 파일 불변). 루트 `data-testid='quick-dashboard-pagination'`.

---

## 4. 퀵 요청 폼 `/dashboard/quick/request` (U-6 · D-10 · D-11)

### 4.1 와이어 — M375 (빈 폼 · 맨 위 / 중간 / 맨 아래)

```text
╭─ preview — zsh ───────────────────────────────────────╮
│  ╭─ M375 · /dashboard/quick/request ─────────────────╮ │
│  │ [≡]│ [<] 퀵 요청                   [◐]  [알림9]  │ │ 64 · 큰 제목 없음
│  │ 주소 정보                         [+ 경유지 추가] │ │ 72
│  │ ○ 출발지                                          │ │ 제목 줄 32
│  │ │ 주소 *                                          │ │
│  │ │ [ 주소 검색…                          (돋보기)] │ │ readonly · 탭=검색 · 돋보기 44
│  │ │ 상세 주소 *                                     │ │
│  │ │ [ 예: 3층 301호…                              ] │ │
│  │ │ 담당자 *              연락처 *                  │ │ 한 줄(같은 y)
│  │ │ [ 홍성훈           ]  [ 010-1234-5678…       ]  │ │
│  │ │                       숫자만 9~11자리            │ │
│  │ ● 도착지                                          │ │
│  │   주소 * / 상세 주소 * / 담당자 · 연락처          │ │
│  │                                                   │ │
│  │ 배송 수단                                         │ │
│  │ 복수 선택 가능                                    │ │
│  │ 차량 종류 *                                       │ │
│  │ [ 사진 5:2 ][ 사진 5:2 ][ 사진 5:2 ]               │ │ 3열 유지 · 사진 낮게
│  │  오토바이     다마스      라보                     │ │
│  │ ... (물품 · 기사님 전달사항 · 운임 결제 페이지 스크롤) │ │
│  │══════════════════════════════════════════════════│ │ sticky · 62px
│  │ 출발지 → 도착지 · 차량 미선택 · 1대 [^] [등록하기]│ │ 1줄 · 말줄임
│  ╰──────────────────────────────────────────────────╯ │
╰────────────────────────────────────────────────────────╯
```

### 4.2 페이지 스크롤 (D-10 ① · AC-22)

| 파일 | lg 미만 | lg 이상(지금) |
|------|---------|---------------|
| `app/dashboard/quick/request/layout.tsx` | 높이 고정 없음 · `overflow` 없음 | `lg:h-[calc(100dvh-3.5rem)] lg:overflow-hidden lg:min-h-0 lg:shrink-0 lg:flex lg:flex-col` (lg에서 상단바 56 → 지금 `md:` 값과 같음) |
| `request/page.tsx`·`loading.tsx` | `PageContainer viewportFill='lg' mobileHeader='hidden'` | 같음 |
| `quick-request-order-page.tsx` 왼쪽 열 | `overflow` 없음 · `pb-6` | `lg:overflow-y-auto lg:overscroll-contain lg:pb-8` |
| 그리드 | `grid-rows-[minmax(0,1fr)]`·`min-h-0`·`flex-1`은 `lg:`로만 | 그대로 |
| 요약바 | **`sticky bottom-0 z-20`**(문서 흐름 끝 · `-mx-4 -mb-4 md:-mx-6` 유지) + `data-quick-sticky-bottom` | `lg:hidden` 그대로 |

- 요약바는 `form` 끝의 sticky라 위·가운데·맨 아래 어디서든 bottom = `innerHeight`(맨 아래에서는 자기 자리 = 문서 끝 · `-mb-4`가 `PageContainer pb-4`를 상쇄).
- `quick-request-order-page` 안에 스스로 스크롤되는 상자 0: 왼쪽 열 overflow 제거 · 메모 `textarea`는 `field-sizing-content`(글자만큼 늘어남 · 안쪽 스크롤 없음) · 칩 줄은 줄바꿈(`flex-wrap`).

### 4.3 주소 칸 (D-10 ② · U-6 · K8)

| 상태 | lg 미만 | lg 이상 |
|------|---------|---------|
| 기본 | `readOnly` · `aria-haspopup='dialog'` · placeholder 「주소 검색…」 · `cursor-pointer` · 탭/클릭/Enter/Space → 주소 검색 Dialog | 지금 그대로(입력 가능 · placeholder 「주소 입력…」) |
| 오른쪽 버튼 `-address-search` | 아이콘만 `size-11`(글자 「주소 검색」은 `max-lg:sr-only` → 접근 이름 유지) | 지금 「돋보기 + 주소 검색」 버튼 |
| 「주소 직접 입력」 뒤 | 그 칸만 `manual=true` → `readOnly` 해제 · placeholder 「주소 입력…」 · 포커스 · 값 유지 | — |

- 판정: `const isDesktop = useMatchMedia('(min-width: 1024px)')` → `readOnly = !isDesktop && !manual`(서버·hydration 중 readonly). 모양(아이콘/글자)은 CSS라 PC 레이아웃 불변.
- 적용 범위: **요청 폼만**(`QuickRequestAddressSection`에 `pickerFirstOnMobile` prop → 요청 폼만 `true`). 수정 Sheet(동방·admin)는 지금 그대로.

### 4.4 주소 검색 Dialog 「주소 직접 입력」 (`quick-request-address-picker-dialog.tsx`)

```text
╭─ preview — zsh ───────────────────────────────────────╮
│  ╭─ M375 · quick-request-address-picker (h-dvh) ─────╮ │
│  │ 주소 검색                                    [X]  │ │ 44
│  │ 주소·가게 이름으로 검색하거나 최근 이용 내역…     │ │
│  │ [ 주소 검색 ][ 장소 검색 ][ 최근 이용 내역 ]      │ │
│  │ ┌ Daum 검색 (iframe) ─────────────────────────┐   │ │
│  │ │ 도로명, 건물명, 지번 검색                    │   │ │
│  │ │ ...                                          │   │ │
│  │ └──────────────────────────────────────────────┘   │ │
│  │ ───────────────────────────────────────────────── │ │ footer 고정
│  │ 찾는 주소가 없나요?          [ 주소 직접 입력 > ] │ │ h-11 · safe-area
│  ╰───────────────────────────────────────────────────╯ │
╰────────────────────────────────────────────────────────╯
```

- 이미 lg 미만 `fixed inset-0 h-dvh`(높이 100% ≥ 90% · AC-24). 신규 prop `onManualEntry?: () => void` — 있을 때만 footer 렌더(요청 폼 · lg 미만에서만 전달).
- footer: `shrink-0 border-t px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-center justify-between` · 왼쪽 `text-sm text-muted-foreground` 「찾는 주소가 없나요?」 · 오른쪽 `Button variant='ghost' className='h-11'` 「주소 직접 입력」 + `Icons.chevronRight` · `data-testid='quick-request-address-picker-manual'`.
- 누르면: Dialog 닫기(`onCloseAutoFocus`에서 포커스 대상 = 그 주소 칸) → 칸 `manual=true` → 포커스.
- OQ-2(아이폰 Daum iframe 자동 포커스)는 수동 QA Q-4로 판단. 안 되면 「검색어 칸을 한 번 더 눌러 주세요」 안내 1줄만(plan 기본값).

### 4.5 칸 배치

| 항목 | lg 미만 설계 | 근거 |
|------|-------------|------|
| 주소 카드 | `Card`에 `className='max-lg:border-0 max-lg:bg-transparent max-lg:p-0 max-lg:shadow-none max-lg:rounded-none'`(평면) | K13 · 다른 섹션도 카드 없이 평면 |
| 경로 블록(`QuickRequestRouteBlock`) | 점은 **왼쪽 20px 여백 안**(`relative pl-5` · 점 `absolute left-0` · 세로선 `absolute left-[4px] top-8 bottom-0 w-0.5 bg-border`) · 제목 줄 `min-h-8`(경유지는 삭제 버튼 때문에 `min-h-11`) | 칸 폭 375 → 343 − 20 = **323 ≥ 300**(AC-23) · M360 308 |
| 주소 라벨 「주소 *」 | **보이는 라벨 유지** | ui-design-brain 「placeholder만으로 라벨 대체 금지」 |
| 담당자·연락처 | `@[18rem]:grid-cols-2`(컨테이너 288px 이상이면 한 줄 → M360 308·M375 323에서 한 줄 · AC-23 같은 y) · 연락처 placeholder lg 미만 「010-1234-5678…」(짧게) · 도움말 「숫자만 9~11자리」 유지 | 열 폭 M360 ≈ 148 |
| 섹션 간격 | `space-y-5 lg:space-y-10` | |
| 차량 타일 | 3열 유지 · 사진 `aspect-[5/2] object-contain lg:aspect-4/3 lg:object-cover` · 타일 `gap-1.5 lg:gap-2` | U-6 「3열 유지·이미지 축소」 선택(가로 스크롤은 9종 중 뒤쪽이 안 보여 발견성 낮음) · 차량 사진은 옆모습이라 5:2에서 `contain`이면 잘리지 않음 |
| 물품 크기 카드 | `max-lg:min-h-14` · 제목·설명 한 줄(「초소형 · 휴대폰」) · 사진 `max-lg:static max-lg:size-9`(라디오 왼쪽 · 세로 가운데) · 2×2 유지 | 128 → 56 |
| 기사님 전달사항 | 메모 `className='bg-muted/50 max-lg:min-h-11'`(빈 칸 한 줄 · 글자 따라 늘어남) · 열 간격 `gap-4 lg:gap-6` · 칸 묶음 `space-y-3 lg:space-y-4` | ui `Textarea`가 `field-sizing-content` + `min-h-16` → `rows` 대신 `min-h`로 조절 |
| 라디오 카드(R6 · PC 포함) | `Field` 안 글자 묶음 세로 가운데: `FieldContent`에 `justify-center self-stretch` + 라디오 `self-center`(현재 `FieldLabel`의 `[&>*]:data-[slot=field]:py-2`와 제목 `leading` 차이로 위로 붙음 — FE가 원인 확인) · 기준 카드 중심 ±4px | AC-28 |

### 4.6 높이 예산 — AC-23 (M375 · 빈 기본 폼 · `quick-request-order-page`)

| 섹션 | 지금(실측) | 설계 | 줄인 방법 |
|------|-----------:|-----:|-----------|
| 주소 정보 | 924 | 694 | 카드 패딩 −32 · 담당자/연락처 한 줄 −87×2 · 출발/도착 제목 줄 44→32 −24 · (「주소 *」 라벨·연락처 도움말 유지) |
| 배송 수단 | 551 | 453 | 차량 사진 높이 약 66→36(`aspect-[5/2] object-contain`) −30×3줄 · 타일 간격 −8 |
| 배송 일정 | 236 | 236 | — |
| 물품 정보 | 356 | 204 | 카드 128→56(제목·설명 한 줄 + 작은 사진) ×2줄 |
| 기사님 전달사항 | 511 | 455 | 메모 칸 최소 높이 64→44(`field-sizing-content`라 `rows`가 아니라 `min-h`가 높이를 정함 · 글자를 쓰면 늘어남) −20×2 · 간격 −16 |
| 운임 결제 | 106 | 106 | — |
| 섹션 간격 | 5×40 = 200 | 5×20 = 100 | `space-y-5 lg:space-y-10` |
| 아래 여백 | 32 | 24 | `pb-6` |
| 요약바(sticky · 같은 요소 안) | (밖) | 62 | 1줄 |
| **합계** | **2,916** | **2,334** | **≤ 2,400 ✓** (여유 66) |

- 지금 값은 `measure.json`(M375 실측) 기준이고, 설계 값은 실측에서 뺀 값이다(추정 합산이 아님).
- 경유 1개 추가 시 +약 300(AC-23 경유 조건은 폭만 본다 · 경유 칸 폭도 323).
- FE 실측이 2,400을 넘으면 줄이는 순서: ① 「복수 선택 가능」을 제목 줄 오른쪽 작은 글자로(−20) ② 차량 대수 버튼 줄 위 간격 `space-y-5 → space-y-4`(−4) ③ 물품 카드 `min-h-14 → min-h-12`(−16). 라벨·도움말을 숨겨서 줄이지 않는다.

### 4.7 Enter → 다음 칸 (D-10 ⑥ · AC-25)

- 글자 `input`(text·tel·number)에 `enterKeyHint='next'`, 폼 안 **마지막** 글자 칸은 `'done'`(렌더 시 순서로 계산 · `data-quick-enter-next` 표시). `datetime-local`·`textarea`·readonly 주소 칸은 제외.
- `<form>`의 `onKeyDown`(capture): Enter + `!isComposing && keyCode !== 229` + 대상이 `[data-quick-enter-next]` + **`matchMedia('(max-width: 1023px)')`일 때만** → `preventDefault()`(미리보기 열림 방지) → 다음 `[data-quick-enter-next]:not([readonly]):not([disabled])`(보이는 것)로 포커스, 마지막이면 `blur()`.
- 순서 예: 출발 상세 주소 → 담당자 → 연락처 → 도착 상세 주소 → … (readonly 주소 칸 건너뜀).
- PC는 지금 동작 그대로(Enter = 폼 제출 → 미리보기).

### 4.8 날짜 칸 (D-11 · AC-26)

- `QuickRequestNativeInputField`의 `min` 타입을 `number | string`으로 넓힌다. 픽업 `min` = 지금(로컬 `yyyy-MM-ddTHH:mm` · `lib/datetime-local.ts` 재사용) · 도착 `min` = 픽업이 예약이면 픽업 값, 아니면 지금. 값은 칸에 포커스할 때 다시 계산(오래 열어 둔 화면).
- 에러 문구는 D-11 3종 그대로, 위치는 해당 날짜 칸 아래 `FormFieldError`. 등록 시 첫 에러 칸으로 **페이지가** 스크롤(§2.6 scroll-padding으로 상단바·요약바 밑에 숨지 않음).

### 4.9 하단 요약바 (D-10 ⑦ · AC-29)

```text
╭─ M360 · quick-request-mobile-bar (62px) ───────────────╮
│ [ 출발지 → 도… · 차량 미선택 · 1대   ^ ] [ 등록하기 ]   │
╰────────────────────────────────────────────────────────╯
```

- 높이 = border 1 + `pt-2` 8 + 44 + `pb-[max(0.5rem,env(safe-area-inset-bottom))]` 8 = **61~62 ≤ 76**.
- 트리거(`quick-request-mobile-summary-trigger` · `aria-label='요청 요약 보기'`): 「요청 요약」 작은 줄 삭제. 글자 = 한 줄 flex: `<span class='min-w-0 truncate'>{출발} → {도착}</span><span class='shrink-0 whitespace-nowrap'> · {차량} · {대수}</span>` → 경로만 말줄임, 「차량 미선택」은 통째로 보임(AC-29). 바깥 래퍼 `data-testid='quick-request-mobile-summary-text'`(한 줄 · `getClientRects().length === 1`).
  - `quick-request-summary-content.tsx`에 `formatQuickRequestSummaryParts(values) → { route, rest }` 추가(기존 `formatQuickRequestSummaryLine`은 그대로 = parts 합친 값).
- 등록 버튼: 보이는 글자 「등록하기」 · `aria-label='퀵 요청 등록하기'`(라벨 포함 규칙 충족) · `h-11 px-5` · testid 그대로. Drawer 안 버튼 글자 「퀵 요청 등록하기」 그대로(기존 spec).

---

## 5. 퀵 대화 `/dashboard/quick/chat` · 상세 대화 `?chat=1` (U-7 · U-8 · D-12~D-14)

### 5.1 OQ-1 비교 → 결정 B

```text
╭─ preview — zsh ─────────────────────────────────────────────────────────────╮
│  ╭─ A. 오버레이 fixed inset-0 ────────╮  ╭─ B. 상단바·탭 바 숨김(채택) ──────╮ │
│  │ (키보드 올라옴 · iOS 사파리)        │  │ (키보드 올라옴 · iOS 사파리)       │ │
│  │   ↑ 레이아웃 뷰포트가 위로 밀림     │  │ [<] 2026-1876 [신규요청]   [⋯]  │ │ 헤더 유지
│  │ ...(헤더가 화면 밖)...             │  │ 말풍선                           │ │
│  │ 말풍선                             │  │ 말풍선           16:05           │ │
│  │ [클립][메시지 입력      ][전송]     │  │ [클립][메시지 입력     ][전송]    │ │
│  │ ███████ 키보드 ███████             │  │ ███████ 키보드 ███████            │ │
│  ╰────────────────────────────────────╯  ╰──────────────────────────────────╯ │
╰─────────────────────────────────────────────────────────────────────────────╯
```

| 기준 | A 오버레이 | **B 상단바 숨김(채택)** |
|------|-----------|------------------------|
| iOS 키보드(사파리·설치 앱) | `fixed`는 레이아웃 뷰포트 기준 → 키보드가 뜨면 화면이 밀려 헤더가 밖으로 나가거나 입력칸이 가려짐. `visualViewport.offsetTop`로 매번 `translateY` 보정 필요 | 문서 흐름 + 기존 `useVisualViewportHeight`(운영 검증). 문서 스크롤 잠금(`html:has(...) overflow:hidden`) + vv `scroll` 때 `scrollTo(0,0)`으로 헤더 유지 |
| 안드로이드 크롬(resizes-visual) | 같은 보정 필요 | vv `resize`로 같은 훅이 처리 |
| 배경 스크롤 | body 잠금 hack 필요(뒤로 갈 때 스크롤 위치 복원 깨짐) | 문서가 컨테이너 높이 = 뷰포트라 스크롤할 것이 없음 |
| 겹쳐 뜨는 것 | 참여자 Drawer·AlertModal·라이트박스·토스트와 z-50 다툼 | 지금과 같은 순서 |
| 이중 스크롤(AC-36) | 배경 문서 + 메시지 상자 | 메시지 상자 하나 |
| 구현 범위 | 새 레이어·포털·잠금 | 전역 CSS 1곳 + 마커 속성 + 훅 모드 1개 |

- 결정: **B**. 실기기 Q-3에서 아이폰 키보드가 헤더를 밀어 올리면(대비책) 전체 화면 루트에만 `position: fixed; top: vv.offsetTop; height: vv.height`를 iOS에서만 적용 — 문서 구조는 B 그대로.

### 5.2 전체 화면 구조 (lg 미만)

| 요소 | 규칙 |
|------|------|
| 마커 | 대화방: `quick-chat-messenger`(request 있을 때) · 상세 대화: `quick-detail-chat` 루트에 `data-quick-fullscreen` (lg 이상에서도 달려 있어도 CSS가 `max-width` 안이라 무해) |
| 위치 | 루트에 `max-lg:-mx-4 max-lg:-mt-2 max-lg:-mb-4 md:max-lg:-mx-6 md:max-lg:-mt-4`(PageContainer 패딩 상쇄 → 화면 끝까지) · 대화 pane `max-lg:rounded-none max-lg:border-0` · grid `max-lg:gap-0` |
| 높이 | `useVisualViewportHeight(ref, { mode: 'fullscreen' })`: `height = vv.height` · `MIN_HEIGHT_PX` 0(키보드 476에서도 문서보다 커지지 않게) · vv `scroll`에서 `vv.offsetTop > 0`이면 `window.scrollTo(0, 0)` |
| 맨 아래 유지(D-13 ④) | `QuickChatMessageList` 스크롤 상자에 `ResizeObserver` → 높이가 줄 때 직전 `nearBottomRef`가 true면 `scrollTop = scrollHeight`. 위로 올려 둔 상태면 그대로(「새 메시지 N ↓」 유지) |
| 포커스 | 상세 대화 `autoFocus` 유지(키보드가 바로 올라옴 — 기존 동작) · 대화방은 자동 포커스 없음(목록에서 들어오면 읽기 먼저) |

### 5.3 대화 목록 와이어 — M375 (U-8 · AC-37)

```text
╭─ preview — zsh ───────────────────────────────────────╮
│  ╭─ M375 · /dashboard/quick/chat (동방특송) ─────────╮ │
│  │ [≡]│ 퀵 대화                       [◐]  [알림9]  │ │ 0–64
│  │──────────────────────────────────────────────────│ │ 패널 끝까지(border-y만)
│  │ 대화 3건 · 안 읽은 대화 2건      [실시간]   [i]   │ │ 행 A 81–125
│  │ [ 요청번호·요청자·주소 검색      ] [달력 기간 7일]│ │ 행 B 133–177
│  │ [        전체        |      안 읽음 2        ]    │ │ 행 C 185–237 (탭 44)
│  │──────────────────────────────────────────────────│ │ 245
│  │ (홍) 2026-1876 · 홍성훈                       (4) │ │
│  │      [신규요청] 서울 중구 → 서울 종로구           │ │
│  │      동방특송(A): 저희 도착 예정…        16:24    │ │ 짧은 시각
│  │──────────────────────────────────────────────────│ │
│  │ (홍) 2026-02 · 홍성훈                         (2) │ │
│  │      [승인] 경기 동두천시 → 서울 중구             │ │
│  │      홍성훈: 확인해 주셔서…               10-27   │ │ 같은 해
│  │──────────────────────────────────────────────────│ │
│  │ (홍) 2025-118 · 홍성훈                            │ │
│  │      [취소] 경기 동두천시 → 서울 종로구           │ │
│  │      홍성훈: 감사합니다.             2025-12-30   │ │ 이전 해
│  │══════════════════════════════════════════════════│ │
│  │        [≣]                    [말풍선]²           │ │ 탭 바 756
│  │        내역                     대화              │ │
│  ╰──────────────────────────────────────────────────╯ │
╰────────────────────────────────────────────────────────╯
```

| 구간 | top | 높이 | bottom |
|------|-----|------|--------|
| 상단바 + `pt-2` | 0 | 72 | 72 |
| 패널 `border-t` + `pt-2` | 72 | 9 | 81 |
| 행 A (요약 · 실시간 · ⓘ 44) | 81 | 44 | 125 |
| 행 B (검색 44 · 기간 버튼 44) | 133 | 44 | 177 |
| 행 C (`TabsList h-[3.25rem]` → 탭 45) | 185 | 52 | 237 |
| `pb-2` + `border-t` | | 8 | 245 |
| **항목 1** | **245 ≤ 300** | ≈ 88 | 333 |
| 항목 4 bottom | | | **597** |
| 패널 bottom = 탭 바 top 756 − `pb-4` 16 | | | 740 → 완전히 보이는 항목 **5개(≥ 4)** |

- 패널(`aside`): `max-lg:-mx-4 md:max-lg:-mx-6 max-lg:rounded-none max-lg:border-x-0`(가장자리까지 · 앱 목록 느낌).
- 행 A: lg 미만 `h2 「퀵 대화」` **숨김**(`hidden lg:block` · AC-01 heading 0) · `quick-chat-list-summary` 그대로 · `RealtimeStatusBadge` · `QuickMobileInfoButton`.
- 행 B: 검색 `InputGroup h-11 flex-1` + 기간 버튼(K15) `Button variant='outline' className='h-11 shrink-0 gap-1.5 px-3 tabular-nums'` · `Icons.calendar` + 「기간」 + 값(「7일」「30일」「90일」「전체」 · 직접 선택이면 「10-01~10-27」) · `aria-label='기간 필터 · {quickRangeLabel}'` · `aria-haspopup='dialog'` · `data-testid='quick-chat-filter-button'` · `lg:hidden`. 지금의 `QuickRangeFilter size='sm'` 줄은 `hidden lg:flex`(PC 그대로 · `quick-chat-range-label` PC 유지).
- 대화 기간 판 `QuickChatFilterSheet`: 구조는 §3.7과 같고 제목 「기간」 · 본문 `QuickRangeSheetField testIdPrefix='quick-chat-filter'` 하나 · footer 「닫기」 한 개(`quick-chat-filter-close`) · `data-testid='quick-chat-filter-sheet'`.
- 행 C: `TabsList className='grid w-full grid-cols-2 max-lg:h-[3.25rem]'` → 트리거 높이 45(≥ 44).
- 항목 배치는 PC와 같은 3행 그리드 그대로(시각만 짧아짐 · X-1). 미리보기 폭(375): 375 − 32 − 36 − 12 − 시각 약 40 − 8 ≈ **247 ≥ 180**(AC-38).
- 스크롤 상자 높이: `useVisualViewportHeight(ref, { bottomBoundary: '[data-quick-tabbar]', bottomGapPx: 16 })` — 탭 바가 보이면 그 `getBoundingClientRect().top`을 바닥으로 쓴다(safe-area 포함 실측 · 상수 금지).

### 5.4 대화방 와이어 — M375 (U-7 · AC-31~36)

```text
╭─ preview — zsh ───────────────────────────────────────╮
│  ╭─ M375 · /dashboard/quick/chat?request=2026-1876 ──╮ │
│  │ [<]  2026-1876 [신규요청]                   [⋯]  │ │ quick-chat-header 56
│  │      서울 중구 → 서울 종로구 · 홍성훈             │ │
│  │──────────────────────────────────────────────────│ │ 57
│  │                ── 2026-10-29 ──                   │ │ 날짜 구분선 그대로
│  │ (동) 동방특송(A) [동방특송]                        │ │
│  │      ┌─────────────────────────┐                  │ │
│  │      │ 확인해 주셔서 감사합니다. │ 16:02            │ │ HH:mm
│  │      └─────────────────────────┘                  │ │
│  │              ── 여기부터 새 메시지 ──              │ │
│  │                    ┌──────────────────────┐       │ │
│  │              16:05 │ 도착 예정 시간도 알려 │       │ │
│  │                    │ 주세요.               │       │ │
│  │                    └──────────────────────┘       │ │
│  │                                                   │ │ quick-chat-messages ≥ 70%
│  │ 동방특송(A) 입력 중…                               │ │ 20
│  │──────────────────────────────────────────────────│ │
│  │ [AI 추천] (네, 40분 뒤에도 괜찮습니다.)(죄송…▸    │ │ 칩 줄 52 (글자 있으면 숨김)
│  │ [클립] [ 메시지 입력                    ] [전송]  │ │ 44 · 글자 16px
│  ╰──────────────────────────────────────────────────╯ │
╰────────────────────────────────────────────────────────╯
```

| 구간 | 높이 | M375 812 | M360 780 | 키보드 476(칩 보임) | 476(입력 중 · 칩 숨김) |
|------|------|---------|---------|------|------|
| 대화 상단바 + 선 | 57 | | | | |
| 입력 중… 줄 | 20 | | | | |
| 입력부(선 1 + `pt-2` 8 + 칩 52 + 입력 44 + `pb` 8) | 113 (칩 숨김 61) | | | | |
| **메시지 영역** | 나머지 | **622 = 76.6%** | **590 = 75.6%** | 286 | 338 |

- 상단바 ≤ 60 ✓ · 요청번호 `text-base whitespace-nowrap`(높이 24 ≤ 28) ✓ · 메시지 ≥ 70% ✓(AC-31).

### 5.5 대화 상단바 `QuickChatMobileHeader` (신규 · lg 미만 · 대화방·상세 대화 공용)

```
<div data-testid='quick-chat-header' className='flex h-14 items-center gap-1 border-b bg-background px-1'>
  [<] size-11 · Icons.chevronLeft · 대화방: aria-label 「목록」 testid quick-chat-back
                                  · 상세 대화: aria-label 「상세로」 testid quick-detail-chat-back
  <div className='min-w-0 flex-1'>
    1줄: <h2 translate='no' className='text-base font-semibold tabular-nums whitespace-nowrap'>{번호}</h2> + 상태 배지(sm)
    2줄: <p className='truncate text-xs text-muted-foreground'>{출발} → {도착} · {요청자}</p>
  </div>
  [⋯] size-11 · Icons.dots · aria-label 「더보기」 · testid quick-chat-more  → DropdownMenu
</div>
```

- 「⋯」 메뉴(`DropdownMenuContent align='end' className='min-w-48'` · 항목 `min-h-11 gap-2`):
  1. 「참여자 N」(`Icons.teams` · testid `quick-chat-more-participants`) → 메뉴가 닫힌 뒤 기존 참여자 **Drawer** 열기(`onCloseAutoFocus` preventDefault — 포커스가 트리거로 돌아가며 Drawer를 닫지 않게). 참여자 컴포넌트는 `QuickChatParticipantsButton`에서 Drawer 부분을 `QuickChatParticipantsDrawer({ requestNo, variant, open, onOpenChange })`로 꺼내 재사용(lg 이상 Popover 버튼은 그대로).
  2. 「상세 보기」(`Icons.chevronRight` · `DropdownMenuItem asChild` + `<Link>` · testid `quick-chat-detail-link` · 접근 이름 「{번호} 상세 보기」) — **상세 대화에는 없음**.
- 렌더 분기: `QuickChatHeader`(기존 · lg 이상 그대로)와 `QuickChatMobileHeader`를 `useMatchMedia(QUICK_CHAT_MOBILE_MEDIA_QUERY)`로 **하나만**(대화 헤더는 메시지 조회 뒤 렌더 = hydration 뒤 · K2 ②). 그래서 `quick-chat-detail-link`·「참여자 N」 testid가 한 벌.
- 상세 대화 1024~1279: 지금 헤더(「요청 대화」 + 참여자 버튼) 그대로.
- **로딩·오류 중에도 「뒤로」**: `QuickRequestConversation`에 `frameHeader?: ReactNode` prop 추가 → 로딩 fallback·오류 화면 위에 `QuickChatHeaderFrame`(뒤로 + URL의 번호 + 「⋯」 disabled · 배지 없음 · 같은 testid `quick-chat-header`)을 그린다. 전체 화면에서 공통 상단바가 없으므로 필수(설치 앱 탈출 경로 · M-6).

### 5.6 입력부 (D-13 · AC-33·34·41)

| 항목 | 터치/휴대폰 | PC(마우스) |
|------|-------------|-----------|
| Enter | `useMatchMedia('(pointer: coarse)')` true → **줄바꿈**(handleKeyDown이 아무것도 안 함) · `enterKeyHint='enter'` | 지금처럼 Enter 전송 · Shift+Enter 줄바꿈 · `enterKeyHint='send'` |
| 숨은 안내문 | 「Enter는 줄바꿈, 보내기는 전송 버튼」 | 「Enter 전송, Shift+Enter 줄바꿈」(그대로) |
| 칩 줄(`quick-chat-quick-replies-row`) | lg 미만 + `draft.trim() !== ''`이면 **렌더 안 함**(빈 입력이면 다시) · 칩 탭 → 채워지고 숨김 | 항상 보임(100 불변) |
| 글자 크기 | `text-base md:text-base lg:text-sm` — ui `Textarea` 기본에 `md:text-sm`이 있어 `md:text-base`로 덮어야 T768도 16px(AC-41 · `cn` 병합에서 같은 변형끼리 뒤가 이김) | 14px 그대로 |
| 버튼 | 첨부 `size-11 lg:size-10` · 전송 `h-11 lg:h-10`(지금 `md:` → `lg:`) | 같음 |

- 칩 숨김 판정은 `ConversationBody`(draft 보유)에서 `isMobile && draft.trim()` → `QuickChatQuickReplies` 렌더 생략. `isMobile`은 `useMatchMedia(QUICK_CHAT_MOBILE_MEDIA_QUERY)`.

### 5.7 대화 시각 (D-14 · X-1)

| 위치 | 함수 | 예 |
|------|------|----|
| 말풍선 · 대화 안 시스템 줄 | `formatChatBubbleTimeKo(date)` (신규 · `@/lib/format-datetime`) | 「16:03」 |
| 대화 목록 항목 | `formatChatListTimeKo(date, now)` (신규) | 오늘 「16:03」 · 같은 해 「10-27」 · 이전 해 「2025-12-30」 |
| 날짜 구분선 | `formatAbsoluteDateKo`(그대로) | 「2026-10-29」 |
| 읽음 tooltip · 참여자 초대 시각 · 상세·이력·알림·내역 카드 | `formatAbsoluteDateTimeKo`(그대로) | 「2026-10-29 (목) 16:03:04」 |

- 모든 `<time>`에 `dateTime`(ISO) 유지. 「전」「방금」「어제」 금지.

---

## 6. 퀵 상세 `/dashboard/quick/{번호}` (U-9 · D-15 · D-16)

### 6.1 와이어 — M375 · 요청자 · `dispatched`(최종금액 없음)

```text
╭─ preview — zsh ───────────────────────────────────────╮
│  ╭─ M375 · /dashboard/quick/2026-1876 ───────────────╮ │
│  │ [≡]│ [<] 퀵 2026-1876              [◐]  [알림9]  │ │ 0–64
│  │ ╭──────────────────────────────────────────────╮ │ │ 72 상태 카드
│  │ │ 2026-1876 [배차완료 및 결과]             [i] │ │ │ 44
│  │ │ 배차가 완료되었습니다. 최종금액이 입력되면   │ │ │ 상태 문장 16px
│  │ │ 승인할 수 있습니다.                          │ │ │
│  │ │  (v)──────(v)──────(3)──────(4)              │ │ │
│  │ │ 신규요청  접수 및   배차완료   승인           │ │ │
│  │ │           배차중    및 결과                   │ │ │
│  │ │ 2026-10-27 2026-10-27 2026-10-27             │ │ │ 날짜 / (요일) 시각
│  │ │ (화)      (화)      (화)                     │ │ │ 두 줄
│  │ │ 17:54:09  17:57:24  18:01:39                 │ │ │
│  │ ╰──────────────────────────────────────────────╯ │ │ 330
│  │ ╭──────────────────────────────────────────────╮ │ │ 342 기사 카드
│  │ │ (사람) 홍길동                    21마 6543   │ │ │
│  │ │        배차 기사                              │ │ │
│  │ │ [ 전화  전화 걸기 · 010-1234-5678          ] │ │ │ h-11 · primary(K11)
│  │ ╰──────────────────────────────────────────────╯ │ │ 470
│  │ ╭──────────────────────────────────────────────╮ │ │ 482 금액
│  │ │ 금액                                         │ │ │
│  │ │ 예상금액                          20,000원   │ │ │
│  │ │ 최종금액                                —    │ │ │
│  │ │ 예상금액·최종금액은 부가세 포함 금액입니다.  │ │ │
│  │ ╰──────────────────────────────────────────────╯ │ │ 638
│  │ (이동 경로 · 물품·차량·운임 · 요청 정보 · 처리 이력 — 스크롤) │
│  │══════════════════════════════════════════════════│ │ sticky 하단 바 715
│  │ (i) 최종금액이 입력되면 승인할 수 있습니다.        │ │
│  │ [        승인(비활성)        ] [대화 2]  [⋯]      │ │ ⋯는 수정·취소 권한 있을 때만
│  ╰──────────────────────────────────────────────────╯ │
╰────────────────────────────────────────────────────────╯
```

- 위 예는 요청자 `dispatched`라 수정·취소 권한이 없어 실제로는 「⋯」가 없다(바 = [승인][대화]). 「⋯」는 §6.7 표.

### 6.2 휴대폰 트리 순서 (K9 · `QuickRequestDetailMobile`)

```
div.flex.flex-col.gap-3 (FAB 있을 때 pb-24)
├── ① 상태 카드     QuickRequestDetailHero variant='mobile'
│     1행: 번호(h2 quick-detail-request-no) · 상태 배지(quick-detail-status) · ml-auto QuickMobileInfoButton
│     2행: QuickRequestStatusSummary (quick-detail-status-summary · text-base font-medium · aria-live=polite)
│     3행: 취소면 QuickRequestCancelledBanner · 아니면 QuickRequestStepper(시각 표시 · §6.4)
│     (「요청 {시각}」 줄 없음)
├── ② QuickRequestDriverCard (quick-detail-driver-card)
├── ③ 금액            QuickDetailSection density='compact' (quick-detail-section-amount · 기존 testid 3개)
├── ④ 이동 경로       QuickDetailSection compact (quick-detail-section-route · QuickRequestRouteView 그대로)
├── ⑤ 물품·차량·운임  QuickDetailSection compact (quick-detail-section-goods)
├── ⑥ 요청 정보       QuickDetailSection compact (quick-detail-section-request) — 요청자 · 연락처만
├── ⑦ 처리 이력       QuickRequestHistorySection collapsible (이벤트 1건이면 생략 · K10)
└── 하단: QuickRequestMobileActionBar 또는 떠 있는 「대화」(§6.6)
```

- 공용 섹션 `QuickDetailSection`에 `density?: 'default' | 'compact'` 추가: compact = `py-4` · 헤더/본문 `px-4` · `gap-3`(기본값은 지금과 같음 → PC 불변).
- 금액 섹션은 `QuickRequestAmountSection`으로 꺼내 PC·휴대폰 트리가 같이 쓴다(testid·문구 동일).
- 「배차 정보」 카드는 휴대폰 트리에 없다(기사 카드가 대신 · `quick-detail-driver-phone`이 한 벌).

### 6.3 상태 문장 (D-15 문구표 · AC-43)

`resolveQuickStatusSummary(detail): string` — 순수 함수(`src/features/quick-request/lib/quick-request-status-summary.ts`). 판정은 `detail.permissions`만(역할 문자열 금지).

| 상태 | 판정 | 문구 |
|------|------|------|
| `requested` | `canAccept` ? R : L | R 「새 요청입니다. 확인 후 접수해 주세요.」 / L 「동방특송이 요청을 확인하고 있습니다.」 |
| `dispatching` | `canDispatch` ? R : L | R 「배차가 끝나면 배차완료를 입력해 주세요.」 / L 「동방특송이 배차하고 있습니다.」 |
| `dispatched` · 최종금액 없음 | `canSetFinal` ? R : L | R 「운송이 끝나면 최종금액을 입력해 주세요.」 / L 「배차가 완료되었습니다. 최종금액이 입력되면 승인할 수 있습니다.」 |
| `dispatched` · 최종금액 있음 | `canApprove` ? L : (`canSetFinal` ? R : L) | L 「최종금액을 확인하고 승인해 주세요.」 / R 「요청자의 승인을 기다리고 있습니다.」 |
| `approved` | — | 「승인이 끝난 요청입니다.」 |
| `cancelled` | — | 「취소된 요청입니다.」 (사유는 아래 취소 배너) |

- admin이 요청자 본인인 `dispatched`: 최종금액 없음 → `canSetFinal` R(주 버튼 「최종금액 입력」과 일치) · 있음 → `canApprove` L(plan 주석과 일치).
- 위치: 상태 카드 2행 → top = 72 + 16 + 44 + 12 = **144 ≤ 200**.

### 6.4 스테퍼 시각 (D-15 ① · AC-44)

- `hidden sm:block` 제거 → 완료·현재 단계의 `<time>` 항상 보임.
- lg 미만 표기: `<time dateTime className='flex flex-col text-xs leading-4 text-muted-foreground tabular-nums'><span>2026-10-27</span> <span>(화) 17:54:09</span></time>` — 두 span 사이 실제 공백 → `textContent` = 「2026-10-27 (화) 17:54:09」(`formatAbsoluteDateTimeKo` 결과를 날짜·나머지로 나눔) · 높이 2×16 = **32 ≤ 34**. PC(`lg:`)는 `lg:block`·한 줄 그대로.
- 폭: 상태 카드 `px-3`(lg 미만) + 스테퍼 `gap-0 lg:gap-1` → 칸 폭 M375 (343−24)/4 ≈ 79 · M360 76. 「(화) 17:54:09」 12px ≈ 73 → 한 줄. `whitespace-nowrap` 금지(모노 테마에서는 3줄로 접혀도 넘치지 않게) · 스테퍼 `scrollWidth ≤ clientWidth`.

### 6.5 기사 카드 `QuickRequestDriverCard` (신규 · D-15 ②)

```text
╭─ quick-detail-driver-card (배차 후) ───────────────╮   ╭─ (배차 전) ─────────────────────────────╮
│ (사람)  홍길동                       21마 6543     │   │ 배차 완료 후 기사 정보가 표시됩니다.     │
│         배차 기사                                   │   ╰─────────────────────────────────────────╯
│ [ 전화  전화 걸기 · 010-1234-5678              ]   │
╰────────────────────────────────────────────────────╯
```

- `Card className='gap-3 p-4 shadow-none'`(height 16 + 40 + 12 + 44 + 16 = **128**).
- 1행: 원형 아이콘(`size-10 rounded-full bg-muted` + `Icons.user`) · 이름 `font-semibold` / 「배차 기사」 `text-xs muted` · 오른쪽 등록번호 `tabular-nums font-medium translate='no'`(없으면 줄 생략).
- 전화 버튼: `Button asChild className='h-11 w-full'` + `<a href='tel:{digits}' data-testid='quick-detail-driver-phone'>` · `Icons.phone` + 「전화 걸기 · 010-1234-5678」(`formatPhoneDisplay`) · variant는 K11(하단 바에 **활성** 주 버튼 없으면 `default`, 있으면 `outline` · 승인 막힘=비활성은 「없음」으로 봄). 번호 없으면 버튼 대신 「연락처 없음」 muted.
- 배차 전(`dispatch` 3필드 모두 없음): 한 줄 카드 `p-4 text-sm muted` 「배차 완료 후 기사 정보가 표시됩니다.」 · 취소된 건이고 배차 정보가 없으면 **카드 생략**(오해 방지).

### 6.6 처리 이력 접기 (D-15 ⑦ · AC-47)

- `QuickRequestHistorySection`(lg 미만): 접힘 = 최신 1줄(`QuickRequestHistoryList`에 `limit={1}`) · 섹션 헤더 오른쪽 `Button variant='ghost' className='-mr-2 h-11'` 「전체 보기」/「접기」 · `aria-expanded` · `aria-controls`(목록 id) · `data-testid='quick-detail-history-toggle'`. 펼치면 94 순서(최신 위) 전체.
- 이벤트 1건(「등록」뿐)이면 섹션 자체를 그리지 않는다(K10).
- PC는 처음부터 전체(그대로).

### 6.7 하단 바 · 떠 있는 「대화」 (D-16 · AC-48~51)

| 경우 | lg 미만 화면 |
|------|-------------|
| 주 버튼 있음 + 수정/취소 권한 있음 | `[주 버튼 flex-1][대화 N][⋯]` |
| 주 버튼 있음 + 수정/취소 없음 | `[주 버튼 flex-1][대화 N]` |
| 주 버튼 없음 + 수정/취소 있음 | `[대화 N flex-1][⋯]` (AC-49 요청자 `requested`) |
| 셋 다 없음 | 하단 바 **없음**(`quick-detail-actions` 0) + 떠 있는 「대화」 (AC-50·51) |

```text
╭─ AC-48 ① admin · dispatched · 최종금액 없음 (M360 328폭) ─────╮
│ [ 원 최종금액 입력           ] [대화 2] [⋯]                   │  184 / 84 / 44 · gap 8
╰───────────────────────────────────────────────────────────────╯
╭─ 「⋯」 DropdownMenu (side=top · align=end) ─╮
│  (연필) 수정                                │  min-h-11 · quick-detail-edit
│  ───────────────────────────────────────── │
│  (X) 요청 취소                              │  variant=destructive · quick-detail-cancel
╰─────────────────────────────────────────────╯
╭─ 떠 있는 「대화」 (승인 끝난 건) ─╮
│                       ( 말풍선 대화 ² ) │  h-14 px-5 rounded-full shadow-lg · 오른쪽 아래 16px + safe-area
╰──────────────────────────────────╯
```

- 바: 신규 `QuickRequestMobileActionBar` — `data-testid='quick-detail-actions' data-quick-sticky-bottom className='sticky bottom-0 z-10 -mx-4 md:-mx-6 mt-4 flex flex-col gap-2 border-t bg-background px-4 md:px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]'`.
  - 승인 막힘 안내(`quick-detail-approve-hint`) 유지 · 주 버튼 testid 그대로(`quick-detail-accept|dispatch|set-final|approve`) · `h-11 min-w-0 flex-1`.
  - 「대화 N」: 기존 `QuickRequestChatLauncher`(`quick-detail-chat-button` · 배지 `quick-detail-chat-unread`) · 주 버튼 있으면 `h-11 shrink-0 px-3`, 없으면 `flex-1`.
  - 「⋯」: `Button variant='outline' size='icon' className='size-11 shrink-0' aria-label='더보기'` · `data-testid='quick-detail-more'` → `DropdownMenu`(K5) · 항목 순서 수정 → 구분선 → 요청 취소(마지막·빨강). 「요청 취소」 선택 → 메뉴 닫힘 → 기존 `QuickCancelAlert`(AlertModal 「퀵 요청을 취소할까요?」 · AC-49).
  - `quick-detail-edit`·`quick-detail-cancel`은 **메뉴가 열릴 때만 DOM**(Radix Portal) → 휴대폰에서 메뉴 열기 전 0개.
- 떠 있는 「대화」: 같은 `QuickRequestChatLauncher`에 `variant='fab'` — `fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 h-14 gap-2 rounded-full px-5 shadow-lg` · 글자 「대화」 + 배지 · 접근 이름 기존 `chatButtonLabel`. 오른쪽 끝 = 375 − 16 = 359 ≥ 351(AC-50). 본문에 `pb-24`.
- 분기: 상세 본문은 hydration 뒤라 `useMatchMedia(QUICK_CHAT_MOBILE_MEDIA_QUERY)`로 바/FAB 한 벌만. 1024~1279·1280 이상은 기존 `QuickRequestActionBar` 그대로(AC-12 D1024).

### 6.8 높이 예산 — AC-45 (`user.json` · `dispatched` · 기사 홍길동 · 예상 20,000원 · 최종금액 없음)

| 구간 | M360(780) | M375(812) |
|------|-----------|-----------|
| 상단바 + `pt-2` | 0–72 | 0–72 |
| 상태 카드 (16 + 44 + 12 + 문장 2줄 48 + 16 + 스테퍼 원32·6·라벨2줄32·4·시각2줄32 = 106 + 16) | 72–330 | 72–330 |
| 간격 12 + 기사 카드 128 | 342–470 | 342–470 |
| 간격 12 + 금액 카드(16 + 24 + 12 + 64 + 24 + 16 = 156) | 482–**638** | 482–**638** |
| 하단 바 (선 1 + `pt-3` 12 + 안내 20 + 8 + 44 + 12 = 97) | top **683** | top **715** |
| 판정 | 638 ≤ 683 ✓ (여유 45) | 638 ≤ 715 ✓ (여유 77) |

- AC-43: 상태 문장 top 144 ≤ 200 · AC-46: 요청 시각 전체 문자열은 스테퍼 1곳(상태 카드 「요청 …」 줄 없음 · 요청 정보 「요청 시각」 행 없음 · 이력 1건이면 카드 없음 · 2건 이상이면 최신 줄은 「등록」이 아님) · 요청번호 글자는 상태 카드 1곳.

### 6.9 상세 대화 `?chat=1` (lg 미만)

- `QuickRequestDetailChatView`: lg 미만이면 루트에 `data-quick-fullscreen` + §5.2 규칙 + 헤더 = `QuickChatMobileHeader`(뒤로 「상세로」 `quick-detail-chat-back` · 둘째 줄 「요청 대화 · {출발} → {도착}」 · 「⋯」에는 「참여자 N」만). 1024~1279는 지금 화면.

---

## 7. 「뒤로」 동작 `useQuickBack` (D-5 · AC-08·35 · T5)

### 7.1 부모 화면 표

| 화면 | 화면 안 「뒤로」 | 부모(바로 들어온 경우 `replace`) |
|------|-----------------|------|
| 요청 폼 | `quick-mobile-back` | `/dashboard/quick` |
| 상세 | `quick-mobile-back` | `/dashboard/quick` |
| 대화방 `?request=` | `quick-chat-back` | `/dashboard/quick/chat`(나머지 q·tab·range 유지 · `request`만 제거) |
| 상세 대화 `?chat=1` | `quick-detail-chat-back` | 같은 상세(`chat` 제거) |

### 7.2 알고리즘 (권장)

1. `QuickBackTracker`(client · 퀵 layout에 1개): 모듈 변수 `quickInAppDepth`. 처음 마운트 = 0(주소창·알림·새 창으로 바로 들어옴). 이후 URL(pathname+search)이 바뀔 때마다:
   - 직전에 `popstate`가 있었다 → 뒤로/앞으로 이동 → `depth = max(0, depth − 1)`
   - 아니고 `history.length`가 늘었다 → push → `depth + 1`
   - 아니면(replace: 검색·탭·기간 nuqs) → 그대로
2. `useQuickBack(parentHref)` → `goBack()`: `depth > 0`이면 `router.back()`, 아니면 `router.replace(parentHref)`.
3. 대화방 닫기·상세 대화 닫기는 지금의 `setRequest(null)`/`setChatParam(null)`(= push → T5 버그) 대신 `goBack()`.

### 7.3 AC 따라가기

| 시나리오 | 기록 | 결과 |
|----------|------|------|
| AC-35 ① 내역 → 대화 탭(push) → 항목(push) → `quick-chat-back` → `goBack()` | [내역, 목록, 방] → back → [내역, **목록**] → goBack → **내역** | 방 아님 ✓ |
| AC-35 ③ `goto(?request=X)` → 뒤로 | depth 0 → replace [목록] → goBack → 그 이전 | 방 아님 ✓ |
| AC-35 ④ 상세 → 대화(push) → `quick-detail-chat-back` → `goBack()` | [상세, 상세?chat=1] → back → [**상세**] → goBack → 이전 | `chat=1` 없음 ✓ |
| AC-08 ② 내역 → 카드 → 상세 → 뒤로 → `goBack()` | [내역, 상세] → back → [**내역**] → goBack → 이전 | 상세 아님 ✓ |
| AC-08 ①③ 바로 들어온 상세·요청 폼 | depth 0 → replace | `/dashboard/quick` ✓ |

- 다른 메뉴에서 퀵으로 들어온 경우(퀵 layout 새 마운트)는 depth 0 → 「뒤로」 = 부모(퀵 안 위계). 폰 뒤로가기는 브라우저 기록대로.

---

## 8. 로딩 상태 명세 (plan 26 · 40)

| 위치 | fallback | variant | 헤더 |
|------|----------|---------|------|
| `/dashboard/quick/loading.tsx` | `PageLoadingSpinner` | `fill` | `PageContainer`(제목 · `mobileHeader='hidden'`) · 탭 바는 퀵 layout이라 로딩 중에도 보임 |
| 내역 본문(hydration 전 · 필터 key 변경) | `PageLoadingSpinner` | `fill` | 메타바·칩·툴바는 Suspense 밖(그대로) |
| 휴대폰 무한 다음 페이지 | `QuickInfiniteSentinel` 안 스피너 + 「불러오는 중…」 | `compact` | — |
| 필터 판 상태 숫자 | 조회 없음(summary 캐시 · 없으면 「—」) | — | — |
| `/dashboard/quick/chat/loading.tsx` | | `fill` | `mobileHeader='hidden'` |
| 대화 목록 항목 | (기존) | `compact` | 목록 머리·검색·탭은 밖 |
| 대화방·상세 대화 본문 | (기존) + **`QuickChatHeaderFrame`**(뒤로 가능) | `compact` | §5.5 |
| 참여자 Drawer | (기존) | `compact` | — |
| `/dashboard/quick/request/loading.tsx` | | `fill` | `viewportFill='lg'` · `mobileHeader='hidden'` |
| 주소 검색 Dialog 탭 | (기존) | `compact` | — |
| `/dashboard/quick/[번호]/loading.tsx` · 상세 본문 | | `fill` | `mobileHeader='hidden'` |
| 「⋯」 메뉴 | 조회 없음 | — | — |
| CUD 버튼(접수·배차·금액·승인·취소·등록) | Button `isLoading`(기존) | — | — |

- 스켈레톤·pulse 금지(overview 아님). 스피너는 콘텐츠 영역 가운데.

---

## 9. Drawer · DropdownMenu · Dialog 구조

| 컴포넌트 | 종류 | Header | Scroll Body | Footer CTA |
|----------|------|--------|-------------|-----------|
| `QuickDashboardFilterSheet` | vaul Drawer(bottom · `max-h-[85dvh]`) | 「필터」 | 기간 + 상태 (`flex-1 overflow-y-auto overscroll-contain`) | [초기화][닫기] `border-t` · safe-area |
| `QuickChatFilterSheet` | vaul Drawer(bottom) | 「기간」 | 기간 | [닫기] |
| 요청 요약 Drawer | (기존) | 「요청 요약」 | 요약 | [퀵 요청 등록하기][닫기] (기존 유지) |
| 참여자 Drawer | (기존 · controlled로 꺼냄) | 「참여자」 | 목록 | (기존) |
| 주소 검색 | Dialog 전체 화면(기존) | 제목 + 닫기 | 탭 본문 | **「주소 직접 입력」 footer**(요청 폼 · lg 미만) |
| 대화 「⋯」 | DropdownMenu `align='end'` | — | 항목 2개(상세 대화 1개) | — |
| 상세 「⋯」 | DropdownMenu `side='top' align='end'` | — | 수정 / 구분선 / 요청 취소 | — |
| 요청 취소 | AlertModal(기존 `QuickCancelAlert`) | 「퀵 요청을 취소할까요?」 | — | 확인/취소 |

- DropdownMenu 항목은 `className='min-h-11 gap-2 text-sm'`(ui 기본 `py-1.5`라 44 미만 → className으로만 확장).

---

## 10. 컴포넌트 트리 · 파일

### 10.1 shadcn (전부 설치됨 · 신규 add 0건)

`Button` · `Badge` · `Card` · `Drawer` · `DropdownMenu` · `RadioGroup` · `ToggleGroup` · `Calendar`(classNames 확장) · `Collapsible` · `Tabs` · `InputGroup` · `Avatar` · `Separator` · `Field*`(form-context) · `InfoButton` · `PageLoadingSpinner` · `AlertModal`(modal)

### 10.2 신규 파일

| 파일 | 역할 |
|------|------|
| `src/app/dashboard/quick/layout.tsx` | 퀵 공통 layout(server) — `QuickBackTracker` + children + `QuickMobileTabbar` |
| `src/features/quick-request/components/mobile/quick-mobile-tabbar.tsx` | 하단 탭 바(§2.7) |
| `…/mobile/quick-mobile-back-button.tsx` | 상단바 「뒤로」 슬롯(§2.2) |
| `…/mobile/use-quick-back.ts` | `QuickBackTracker` + `useQuickBack`(§7) |
| `…/mobile/quick-mobile-info-button.tsx` | 휴대폰 ⓘ(§2.4) |
| `…/dashboard/quick-dashboard-filter-sheet.tsx` | 내역 필터 판(§3.7) |
| `…/dashboard/quick-range-sheet-field.tsx` | 판용 기간 선택(§3.8 · 대화 판 공용) |
| `…/dashboard/quick-dashboard-mobile-list.tsx` | 휴대폰 무한 목록(§3.10) |
| `…/dashboard/quick-dashboard-pagination.tsx` | PC 한국어 페이지네이션(§3.11) |
| `…/chat/quick-chat-filter-sheet.tsx` | 대화 목록 기간 판(§5.3) |
| `…/chat/quick-chat-mobile-header.tsx` | 전체 화면 대화 상단바 + `QuickChatHeaderFrame`(§5.5) |
| `…/chat/quick-chat-participants-drawer.tsx` | 참여자 Drawer controlled(기존 버튼에서 분리 · 선택) |
| `…/detail/quick-request-detail-mobile.tsx` | 상세 휴대폰 트리(§6.2) |
| `…/detail/quick-request-status-summary.tsx` | 상태 문장(§6.3) |
| `…/detail/quick-request-driver-card.tsx` | 기사 카드(§6.5) |
| `…/detail/quick-request-mobile-action-bar.tsx` | 3칸 하단 바 + 「⋯」(§6.7) |
| `…/detail/quick-request-amount-section.tsx` | 금액 섹션(PC·휴대폰 공용으로 꺼냄) |
| `src/features/quick-request/lib/quick-request-status-summary.ts` | `resolveQuickStatusSummary`(순수 함수) |
| `src/lib/__tests__/format-datetime-chat.test.mjs` | AC-39 단위 |

### 10.3 수정 파일 (요점)

| 파일 | 변경 |
|------|------|
| `components/layout/page-container.tsx` | `mobileHeader` · `viewportFill: boolean \| 'lg'` |
| `components/layout/header.tsx` | `data-app-header` · 버튼 className(lg 미만 44 · r1) · lg 미만 검색·테마 프리셋 숨김 · 뒤로 슬롯 |
| `components/themes/theme-mode-toggle.tsx` · `features/notifications/components/notification-center.tsx` | `size-11 lg:size-8` (r1) |
| `hooks/use-breadcrumbs.tsx` | 퀵 한국어 매핑(동적 번호 포함) |
| `app/layout.tsx` | `viewportFit: 'cover'` · body 좌우 safe-area |
| `app/dashboard/layout.tsx` | `IosInstallBanner`를 `div[data-app-banner].contents`로 감쌈(컴포넌트 불변) |
| `styles/globals.css` | §2.6 규칙 |
| `app/dashboard/quick/**/page.tsx`·`loading.tsx`·`request/layout.tsx` | `mobileHeader='hidden'` · `viewportFill='lg'` · lg 한정 높이 |
| dashboard: `quick-dashboard-page`(lg 미만 `gap-3` · 필터 판 연결) · `quick-dashboard-body`(분기) · `quick-status-cards`(칩) · `quick-dashboard-toolbar`(lg 미만 한 줄) · `quick-dashboard-meta-bar`(ⓘ · 갱신 `hidden sm:inline`) · `quick-range-filter`(상수·헬퍼 export) · `quick-request-mobile-card`(재작성) · `quick-dashboard-data-table`(페이지네이션 교체) · `api/queries.ts`(무한 옵션) | |
| request: `quick-request-order-page`(lg 한정 스크롤 · Enter 다음) · `quick-request-location-section`(readonly·manual · 한 줄) · `quick-request-field-controls`(주소 칸 변형 · `enterKeyHint` · 라디오 가운데 · `min` 문자열) · `quick-request-address-section`(평면 · 점 여백 · `pickerFirstOnMobile`) · `quick-request-address-picker-dialog`(footer) · `quick-request-vehicle-section` · `quick-request-goods-size-grid` · `quick-request-order-form-sections` · `quick-request-driver-notes-section` · `quick-request-schedule-section` · `quick-request-mobile-summary-bar` · `quick-request-summary-content` | |
| chat: `quick-chat-messenger`(마커·높이 모드) · `quick-chat-conversation-list`(lg 미만 머리 3행·가장자리·판) · `quick-chat-conversation-item`(짧은 시각) · `quick-chat-conversation-pane`(전체 화면 클래스·frame) · `quick-chat-header`(분기) · `quick-request-conversation`(`frameHeader` · 칩 숨김) · `quick-chat-composer`(coarse Enter · `lg:`) · `quick-chat-message-list`(크기 변화 맨 아래 유지) · `quick-chat-bubble`·`quick-chat-system-line`(짧은 시각) · `quick-chat-participants-button`(Drawer 분리) · `use-quick-chat-params`(닫기 = `goBack`) · `use-visual-viewport-height`(fullscreen·bottomBoundary 옵션) · `quick-chat-constants`(문구) | |
| detail: `quick-request-detail-page`(분기 · 금액 섹션 추출 · 닫기 = `goBack`) · `quick-request-detail-hero`(`variant='mobile'`) · `quick-request-stepper`(시각 표시) · `quick-request-action-bar`(lg 이상만) · `quick-request-chat-launcher`(`variant: 'bar' \| 'fab'`) · `quick-request-history`(`limit` · 접기 섹션) · `quick-detail-section`(`density`) · `quick-request-detail-chat-view`(lg 미만 전체 화면) | |
| `src/lib/format-datetime.ts` | `formatChatBubbleTimeKo` · `formatChatListTimeKo` |
| `WakeOne-web/.cursor/rules/core-conventions.mdc` | 「퀵 대화 예외」 1줄(FE 단계) |

---

## 11. testid 목록 (plan AC 표기와 일치)

| 영역 | testid | AC |
|------|--------|----|
| 공통 | `quick-mobile-tabbar`(nav 「퀵 메뉴」) · `quick-mobile-tab-list` · `quick-mobile-tab-chat` · `quick-mobile-tab-request` · `quick-mobile-tab-chat-badge` | 05·06·07 |
| 공통 | `quick-mobile-back`(「뒤로」) · `quick-mobile-info-button`(「퀵 권한 안내 보기」) | 02·08 |
| 내역 | `quick-dashboard-card-{requested,dispatching,dispatched,approved,cancelled}` + `-count`(칩 · 기존) | 14 |
| 내역 | `quick-dashboard-filter-button` · `quick-dashboard-filter-count` · `quick-dashboard-filter-sheet` · `quick-dashboard-filter-range-{7d,30d,90d,all,custom,calendar,apply,clear}` · `quick-dashboard-filter-status-{all,…}` · `quick-dashboard-filter-reset` · `quick-dashboard-filter-close` | 15·16 |
| 내역 | `quick-dashboard-cards` · `quick-card-{no}` · `quick-card-link-{no}`(「{no} 상세 보기」) · `quick-card-action-{no}` · `quick-unread-{no}` · `quick-participant-badge-{no}` · `quick-dashboard-list-sentinel` · `quick-dashboard-list-load-more` | 13·17·18·19 |
| 내역 PC | `quick-dashboard-table` · `quick-dashboard-pagination` · `quick-dashboard-pagination-total` · `quick-request-new-button` · (기존 툴바 testid 전부 유지) | 12·20 |
| 요청 | `quick-request-order-page` · `quick-request-{origin,destination,stopover-N}-road-address` · `…-address-search` · `quick-request-address-picker` · `quick-request-address-picker-manual` | 22~24 |
| 요청 | `quick-request-mobile-bar` · `quick-request-mobile-summary-trigger` · `quick-request-mobile-summary-text` · `quick-request-mobile-register-button` · `quick-request-summary-drawer` · `quick-request-summary`(PC) | 12·29·30 |
| 대화 | `quick-chat-messenger` · `quick-chat-header` · `quick-chat-back`(「목록」) · `quick-chat-more` · `quick-chat-more-participants` · `quick-chat-detail-link` · `quick-chat-messages` · `quick-chat-input` · `quick-chat-send` · `quick-chat-quick-replies-row` | 31~36·41·42 |
| 대화 목록 | `quick-chat-list-summary` · `quick-chat-search` · `quick-chat-filter-button` · `quick-chat-filter-sheet` · `quick-chat-filter-range-*` · `quick-chat-filter-close` · `quick-chat-tab-all` · `quick-chat-tab-unread` · `quick-chat-list-item-{no}` | 37·38 |
| 상세 대화 | `quick-detail-chat`(전체 화면 루트) · `quick-detail-chat-back`(「상세로」) | 31·35 |
| 상세 | `quick-detail-request-no` · `quick-detail-status` · `quick-detail-status-summary` · `quick-detail-stepper` · `quick-detail-step-{s}` | 43·44·46 |
| 상세 | `quick-detail-driver-card` · `quick-detail-driver-phone`(`a[href^=tel:]`) · `quick-detail-section-amount` · `quick-detail-estimated-amount` · `quick-detail-final-amount` · `quick-detail-section-{route,goods,request,history}` · `quick-detail-history-toggle` · `quick-detail-history-{key}` | 45~47 |
| 상세 | `quick-detail-actions` · `quick-detail-more` · `quick-detail-edit` · `quick-detail-cancel` · `quick-detail-chat-button` · `quick-detail-chat-unread` · `quick-detail-{accept,dispatch,set-final,approve}` · `quick-detail-approve-hint` | 48~51 |

- 삭제: `quick-card-detail-{no}`(휴대폰 카드 「상세 보기」 · plan §spec 표).
- 숨은 채 DOM에 남는 PC 요소: `quick-dashboard-range-*`·`quick-dashboard-status-filter`·`quick-dashboard-reset`·`quick-dashboard-total`·`quick-chat-range-*`(lg 미만 CSS 숨김) — 판 testid와 이름이 달라 중복 없음.

---

## 12. 다크 모드 · 테마 10종

- 색은 시맨틱 토큰만: `bg-background`·`bg-card`·`bg-muted`·`text-muted-foreground`·`text-primary`·`bg-primary`·`border`·`ring-ring`·`text-destructive`. 상태 점·배지는 기존 `quick-request-status.ts` 한 곳 팔레트(89 K1 예외) 그대로.
- 모양은 테마 radius·shadow 토큰(`rounded-xl`·`rounded-md`·`rounded-full` · `shadow-lg`). `#hex`·`kq-`·`bg-white`·`text-black`·`rounded-[`·`shadow-[` 0(AC-53).
- 탭 바·상단바 반투명: `bg-background/80 backdrop-blur-md`(다크에서도 토큰).
- neobrutualism·notebook·mono(넓은 글꼴 · AC-10): 칩 줄은 원래 가로 밀기 · 카드 3행 `line-clamp-2` · 스테퍼 시각은 `nowrap` 없음 · 요약바 경로 `truncate` · 대화 상단바 2줄 `truncate` → 페이지 가로 스크롤 0.

---

## 13. PC 무변경 확인 방법

1. **규칙**: 공용 파일(`PageContainer`·`header`·퀵 셸 컴포넌트)에 추가한 클래스는 전부 `max-lg:`·`lg:` 쌍이거나 lg 미만 전용 분기 안. `md:` 미만 크기 변경은 앱 상단바 버튼 3개뿐(PC 영향 0).
2. **분기 위치**: `useMatchMedia` 분기는 hydration 뒤 트리(내역 본문 · 상세 본문 · 대화 헤더 · 주소 칸 readonly)에만. SSR 셸(헤더·툴바·칩·요약바·탭 바)은 CSS로만.
3. **자동**: AC-12(4화면 D1280·D1024) · AC-20(페이지네이션 한국어 · 판정 유지) · AC-47 D1280(이력 전체) · AC-33/34/41 D1280 · 기존 PC spec 전체(AC-55) — 체크포인트마다 D1280 회귀를 같이 돈다(plan Battle Plan).
4. **허용 변화(예외)**: X-1 대화 시각 · X-2 페이지네이션 글자 · X-3 breadcrumb 퀵 한국어 · 등록 날짜 검사 · 라디오 카드 세로 가운데. 이 밖의 PC 차이가 보이면 버그.
5. **FE 자가 점검**: 변경 전 Step 0 기준(tar)으로 D1280·D1024 화면을 열어 4화면 + 상세 1024(액션바) + 대화 1280(2단 · 헤더 「참여자 N」·「상세 보기」 바로 보임)을 눈으로 비교(픽셀 비교 판정은 쓰지 않음).

---

## 14. 활동 감사 로그 UI

- 변경 없음. 신규 action 0(plan). 요청 취소는 「⋯」 안으로 옮겨도 같은 Route·AlertModal. 기존 `/dashboard/logs`·`ActivityLogsTable` 그대로(AC-52).

---

## 15. 품질 검토 (Step 5 · web-design-guidelines + designer 체크리스트)

| 항목 | 결과 | 조치 |
|------|------|------|
| 아이콘만 있는 버튼 이름 | 통과 | 뒤로 「뒤로」/「목록」/「상세로」 · ⋯ 「더보기」 · ⓘ 「퀵 권한 안내 보기」 · 주소 돋보기 「주소 검색」(sr-only 글자) · 카드 덮는 링크 「{번호} 상세 보기」 |
| 이동은 링크, 동작은 버튼 | 통과 | 탭 바·카드·「상세 보기」 메뉴 항목 = `Link`(새 탭 열기 가능) · 필터·⋯·전화(`a tel:`) 구분 |
| 터치 44px | 통과(설계) | AC-09 위험 지점: DropdownMenu 항목(`min-h-11` 필수) · `TabsList` 높이 · 칩 · 달력 칸 · 기사 전화 · 히스토리 토글 · 카드 새 대화 · 요청 폼 「편집」「+ 추가」 버튼(현재 크기 FE 실측) · 참여자 Drawer 항목 |
| 입력 16px · 확대 방지 | 통과 | 대화 입력 `text-base md:text-base lg:text-sm`(ui 기본 `md:text-sm` 덮기) · 폼 칸 기존 16px(요청 폼 메모 `Textarea`도 T768에서 14px가 되므로 같은 덮기 권장) |
| `inputmode`·`enterkeyhint`·`autocomplete` | 통과 | 연락처 `tel`/`numeric` 유지 · `enterKeyHint` next/done/enter · 비인증 칸 `autoComplete='off'` 유지 |
| placeholder 끝 줄임표 | 통과 | 「주소 검색…」「주소 입력…」「010-1234-5678…」 |
| sticky가 포커스 칸을 가리지 않음 | 통과 | §2.6 `scroll-padding` |
| safe-area | 통과 | `viewport-fit=cover` · 하단 4요소 `env()` · body 좌우 |
| 가로 스크롤 0 | 통과(설계) | 칩 줄·빠른 답장은 내부 스크롤 · `-mx-4`는 부모 패딩 안 · 달력 308 ≤ 328 |
| 스크롤 가둠(modal·drawer) | 통과 | 판 본문 `overscroll-contain` · 대화 메시지 `overscroll-contain`(기존) |
| 상태를 URL에 | 통과 | 필터·기간·탭·대화방·상세 대화 = URL · 이력 펼침·⋯는 일시 UI |
| 파괴적 동작 확인 | 통과 | 요청 취소 = AlertModal · `window.confirm` 0 |
| 빈·로딩·오류 상태 | 통과 | §8 · 빈 목록 `QuickDashboardEmpty` · 대화 오류에도 뒤로(`QuickChatHeaderFrame`) |
| 긴 글자 | 통과 | 카드 경로 `truncate` · 3행 `line-clamp-2` · 대화 상단바 2줄 `truncate` · 요약바 경로 말줄임 |
| 숫자 `tabular-nums` | 통과 | 칩 숫자·금액·시각·요청번호 |
| 시각 규칙 | 통과 | 대화 3곳만 짧은 시각(D-14) · 나머지 `formatAbsoluteDateTimeKo` · 상대 표현 0 |
| 줄인 모션 | 통과 | Drawer·Collapsible 기본 · 새 애니메이션 없음(`motion-reduce` 기존 유지) |
| hydration 안전 | 통과 | `useMatchMedia`는 hydration 뒤 트리만 · 주소 칸은 mobile-first 기본값 |
| 제목 위계 | 주의 | lg 미만은 보이는 h1이 없다(AC-01 요구 · `sr-only`는 Playwright에서 「보임」이라 사용 불가). 화면 이름은 상단바 `BreadcrumbPage`(aria-current=page)가 맡는다 → 허용 |
| 라벨 유지 | 통과 | 주소 칸 「주소 *」 보이는 라벨 유지(높이 예산에 포함) |
| `cn()`·`Icons.*`·ui 무수정·`PageContainer` props | 통과 | §10 |
| 375에서 동작 | 통과(설계) | §3.3·4.6·5.3·5.4·6.8 예산표 |

---

## 16. 팀 전달 요약 (Step 6)

### — /backend-dev 에게 —

- UI 쪽 신규 API·필드 요구 **없음**. 목록 무한 로드는 기존 `GET /api/quick-request?page&perPage=20` 응답 `{rows,page,limit,total}`로 충분(§3.10).
- 상세 상태 문장·기사 카드는 기존 `detail.permissions`(`canAccept`·`canDispatch`·`canSetFinal`·`canApprove`·`canEdit`·`canCancel`)·`detail.dispatch`(`vehicleInfo`·`driverName`·`driverPhone`·`estimatedAmount`)·`finalAmount`만 쓴다.
- 등록 날짜 검사(plan D-11 · AC-27): 화면과 같은 문구 3종을 `errors[].path` = `origin.schedule`/`destination.schedule`로. FE는 같은 공용 함수를 폼 등록 스키마에 붙인다.
- 신규 activity action 0 · HTTP Method 변화 0.

### — /frontend-dev 에게 —

- **순서**: 공통(§2) → 내역(§3) → 요청(§4) → 대화(§5) → 상세(§6) → 뒤로(§7). 체크포인트마다 D1280·D1024 회귀.
- **원칙**: lg 경계만 · testid 한 벌(K2) · ui 무수정(Calendar는 `classNames`, DropdownMenu 항목은 className) · 탭 바 sticky(K3) · 카드 덮는 링크(K4) · ⋯ = DropdownMenu(K5).
- **OQ-1 결정**: 상단바·탭 바 숨김 + 문서 흐름 전체 화면 · 전역 CSS 1곳(§2.6) · `useVisualViewportHeight` fullscreen 모드(§5.2). 대비책은 §5.1 끝.
- **수치 목표**(예산표로 증명됨): 내역 첫 카드 240 · 카드 116 · 대화 메시지 76% · 대화 상단바 56 · 대화 목록 첫 항목 245 · 요청 폼 2,334 · 주소 칸 323 · 요약바 62 · 상세 금액 bottom 638(바 top 683/715).
- **여유가 작은 곳**: 요청 폼 높이(여유 66px) — §4.6 끝의 줄이는 순서. 스테퍼 시각 폭(M360 76px 칸).
- 경로: 페이지 `src/app/dashboard/quick/{page,chat/page,request/page,[requestNo]/page}.tsx` · 신규 `src/app/dashboard/quick/layout.tsx` · 컴포넌트 `src/features/quick-request/components/{mobile,dashboard,chat,detail}/`.
- 참고 패턴: 69(lg 분기 + PC 회귀) · 86(테마 토큰·testid) · 97(`QuickInfiniteSentinel`·`flattenConversations`) · 93(`useMatchMedia`·visualViewport) · 14(AlertModal) · `quick-request-address-picker-dialog.tsx`(전체 화면 Dialog 직접 조합).

### — /verifier 에게 (참고) —

- 칩 글자 판정은 `innerText` 또는 정규식(숨은 설명문이 `textContent`에 남음 · §3.5).
- 휴대폰 상세에서 `quick-detail-edit`·`-cancel`은 `quick-detail-more`를 연 뒤에만 존재(`toHaveCount(0)`은 메뉴 열기 전·후 둘 다 확인).
- 판 testid는 `quick-dashboard-filter-*`·`quick-chat-filter-*`(PC 툴바 `*-range-*`와 별개).
- Chromium 에뮬레이션에는 `IosInstallBanner`가 없다(아이폰 UA 아님) — 예산표 기준과 같음.

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-10-29 | 최초 작성 · Approved. OQ-1 = 상단바·탭 바 숨김(문서 흐름 · 전역 `:has()` CSS) 결정 · 탭 바 sticky · 카드 덮는 링크 · ⋯ = DropdownMenu · 필터 판 = Drawer + 달력 펼침 · 달력 44px는 `classNames`(plan D-7의 `--cell-size` 대체) · 주소 칸 mobile-first readonly · 상세 휴대폰 트리 · 이력 1건 생략 · 상태 문장 판정표 · 뒤로 알고리즘 · 화면별 높이 예산표(AC-13·23·29·31·37·43·45) | designer |
| 2026-10-29 | **r1 (planner 대리 정정 · root 요청 · 구현 반영)**: §2.2 상단바 크기 기준 「md 미만」 → **「lg(1024) 미만」**(`size-11 lg:size-7/8` · plan Q1 확인 ② 태블릿 = 휴대폰 규칙) · lg 미만 검색 「Search... ⌘K」·테마 프리셋 Select 숨김 · breadcrumb 마지막 항목만 + truncate(T768 사이드바 펼침 상단바 넘침 해소) · R6 라디오 카드 가운데 정렬은 수정 Sheet에도 적용(plan X-3·AC-28 r1) | planner |
