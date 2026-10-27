# 88 워크플로우(전자결재) 지출결의서 — UI 설계 (designer)

> Date: 2026-10-21 · Author: designer · 입력: [88_workflow-expense-plan.md](./88_workflow-expense-plan.md) (Approved) · [FINDINGS](../research/flex-workflow/FINDINGS.md) · [PERMISSIONS](../research/flex-workflow/PERMISSIONS.md) · flex 스크린샷 `flex-workflow-lab/steps/*.png`
> 원칙: **flex와 같은 구성·흐름**을 WakeOne 테마 토큰 + shadcn(New York)으로 만든다. 대안이 있을 때는 flex와 가장 같은 안을 골랐다(근거 한 줄씩 표기). `/root` 단일 게이트 규칙에 따라 Designer gate(3 preview 선택)는 쓰지 않았다. 아래 ASCII 와이어는 확정안 1개씩이다.
> 코드는 쓰지 않는다. 이 문서는 backend-dev / frontend-dev가 바로 구현에 쓰는 기준이다.

---

## 0. 핵심 결정 요약

| # | 결정 | 근거 |
|---|------|------|
| D1 | 상세·작성 폼·양식 선택은 모두 **`DialogPortal` + `DialogOverlay` + `DialogPrimitive.Content`** 직접 조합(참조: `quick-request-address-picker-dialog.tsx`). `components/ui` 수정 없음 | shadcn `SheetContent`/`DialogContent`는 내장 X 버튼을 항상 그려서 testid가 있는 자체 닫기 버튼(`workflow-detail-close`·`workflow-compose-close`)과 겹친다. 이미 쓰고 있는 패턴이다 |
| D2 | **상세 = PC 오른쪽 큰 패널(목록 위 overlay, 목록은 흐리게 보임)** / 모바일 전체 화면 | flex `03-expense-detail` 그대로. 패널/전체화면 전환 버튼, ↑↓ 이동, 공유는 Out(plan) |
| D3 | **작성 폼 = 가운데 큰 모달(좌 폼 / 우 「승인 · 참조」)** / 모바일 전체 화면, 결재선은 본문 아래 | flex `08-compose-form` 그대로 |
| D4 | lg 이상 2열(본문 + 오른쪽 열) ↔ lg 미만 1열을 **DOM 한 벌**로 처리한다: 스크롤 래퍼에 `lg:contents`를 줘서 lg에서는 자식이 grid 셀이 되고, lg 미만에서는 한 스크롤 안에 본문→결재선 순으로 쌓인다 | 반응형에서 결재선 컴포넌트를 두 번 렌더링하면 testid가 중복된다. 이 방식이면 한 번만 렌더링한다 |
| D5 | 하단 CTA(승인/반려, 임시저장/보내기)는 **스크롤 영역 밖 footer**에 둔다. lg에서는 flex처럼 왼쪽 본문 열 아래에만 있다 | core-conventions §Sheet 폼 모바일, flex 동일 |
| D6 | 상태 뱃지 색은 **`SupportStatusBadge`와 같은 클래스 체계**(Tailwind 팔레트 `/10` 배경 + `dark:` 글자색)를 쓴다. 반려는 `destructive`, 취소는 `muted` 시맨틱 토큰을 쓴다 | 테마 10종 공통으로 노랑·파랑·초록을 나타낼 시맨틱 토큰이 없다(`--chart-*`는 테마마다 색상이 다름). 제품 안에서 같은 상태색 체계를 쓴다. hex 0건 |
| D7 | 필수 표시는 라벨 옆 **빨간 점**이다. 필수가 아니면 DOM에서 **아예 렌더링하지 않는다**(CSS 숨김 금지). 요청 유형 값이 바뀌면 같은 렌더에서 즉시 바뀐다 | AC-08·09·11이 testid 개수로 판정한다 |
| D8 | 시각은 전부 절대 시각(`formatAbsoluteDateTimeKo`), 날짜는 `formatAbsoluteDateKo`로 표시한다(flex의 「47분 전」·「2026년 10월 21일」 표기는 쓰지 않음) | core-conventions §날짜·시각, plan AC-47 |
| D9 | shadcn **신규 add 0건**. 리치텍스트는 Tiptap(plan 허용) + 기존 `Toggle`/`ToggleGroup`/`Select`/`Popover`로 툴바를 만든다 | shadcn 레지스트리(@shadcn)에 editor가 없다(MCP 검색 결과) |
| D10 | 아이콘은 `Icons` 레지스트리(`src/components/icons.tsx`)에 **키를 추가**해서만 쓴다(§9). feature에서 tabler 직접 import 금지 | 규칙 |

---

## 1. 라우트 · 레이아웃

| 라우트 | 파일 | 레이아웃 | 비고 |
|--------|------|----------|------|
| `/dashboard/workflow` | `src/app/dashboard/workflow/page.tsx` · `loading.tsx` | dashboard layout(사이드바·Presence 상속) | 문서함. 상세는 `?doc={id}`로 같은 페이지에서 패널로 연다 |
| `/dashboard/workflow/settings` | `settings/page.tsx` · `settings/loading.tsx` | dashboard layout | 서버 가드 `requireWorkflowAdminPage()` |
| `/workflow-print/[id]` | `src/app/workflow-print/[id]/page.tsx` (+ 선택 `loading.tsx`) | **dashboard layout 밖**. 사이드바·헤더·Presence track **0** | 인쇄 전용 |

### 사이드바 · kbar (`nav-config.ts`)

`퀵` 그룹 다음에 그룹을 추가한다.

```
label: '워크플로우'
  - title '문서함'          url '/dashboard/workflow'          icon 'clipboardText'  shortcut ['w','f']
  - title '워크플로우 설정'  url '/dashboard/workflow/settings'  icon 'settings'       shortcut ['w','s']  access { hasWorkflowAdminNav: true }
```
- 단축키 `w f`·`w s`는 현재 미사용이다(확인함). kbar는 nav-config에서 자동 생성된다.
- `NavAccessProvider`에 `hasWorkflowAdminNav`를 추가한다(`hasHrBenefitsNav`와 같은 방식).

---

## 2. 문서함 `/dashboard/workflow`

### 2.1 PC 와이어 (≥ md, 1280 기준)

```text
╭─ preview — zsh ──────────────────────────────────────────────────────────────────────╮
│ ~/WakeOne-web   $ npm run dev   ✓ ready                                              │
│  ╭─ /dashboard/workflow ───────────────────────────────────────────────────────────╮ │
│  │ 문서함                                                     [✎ 문서 작성하기]     │ │
│  │ 내가 작성하거나 승인·참조하는 문서를 확인합니다.                                    │ │
│  │                                                                                  │ │
│  │ 진행중 3   완료 12   중요 1   전체 16          [🔍 문서번호·내용 검색…] [⇅ 정렬 ▾] │ │
│  │ ─────────────────────────────────────────────────────────────────────────────── │ │
│  │ [ 전체 | 내가 작성한 | 회사 전체 ]  [작성자 ▾] [양식 ▾] [업데이트일 ▾]   3건 [초기화] │ │
│  │ ─────────────────────────────────────────────────────────────────────────────── │ │
│  │ 승인 필요 문서 1                                                         접기 ▴  │ │
│  │ ┌──┐ 김웨이크  2026-10-21 (화) 13:53:00  [승인 필요]                              │ │
│  │ │📄│ 지출결의서  2026-0003  요청 유형: 구매 요청 · 사용 브랜드: 산스 · 금액: ₩…   │ │
│  │ └──┘                                          [📎 첨부파일 1건] (김)(박) +1명   │ │
│  │                                   더보기 ▾                                     │ │
│  │ 진행중 문서 2                                                            접기 ▴  │ │
│  │ ┌──┐ 홍길동  2026-10-21 (화) 11:02:10  [진행중 1/2]                              │ │
│  │ │📄│ 지출결의서  2026-0002  요청 유형: 입, 출금 요청 · 사용 브랜드: 웨이크 · …    │ │
│  │ └──┘                                          [📎 첨부파일 2건] (이)(최)        │ │
│  ╰──────────────────────────────────────────────────────────────────────────────────╯ │
╰──────────────────────────────────────────────────────────────────────────────────────╯
```

### 2.2 모바일 와이어 (375)

```text
╭─ 375 ────────────────────────────╮
│ 문서함              [✎ 작성]      │
│ 진행중 3 완료 12 중요 1 전체 16 →  │  ← TabsList 가로 스크롤
│ [🔍 문서번호·내용 검색…        ]  │
│ [전체|내가 작성한|회사 전체]   →   │  ← 가로 스크롤
│ [작성자▾][양식▾][업데이트일▾]      │
│ [정렬▾]             3건 [초기화]  │
│ 승인 필요 문서 1           접기 ▴ │
│ ┌──┐ 김웨이크  [승인 필요]         │
│ │📄│ 2026-10-21 (화) 13:53:00     │
│ └──┘ 지출결의서 2026-0003         │
│      요청 유형: 구매 요청 · 사용…  │  ← line-clamp-2
│      [📎 첨부파일 1건] (김)(박)+1 │
╰──────────────────────────────────╯
```

### 2.3 컴포넌트 트리

```
page.tsx (server)
  getSessionProfile 가드 · searchParamsCache.parse · isWorkflowAdmin 계산
  <WorkflowComposeProvider>                         ← 작성·이어쓰기·복제·수정 Dialog 상태 context (support-sheet-context 패턴)
    <PageContainer pageTitle='문서함'
                   pageDescription='내가 작성하거나 승인·참조하는 문서를 확인합니다.'
                   pageHeaderAction={<WorkflowComposeButton/>}>   ← testid workflow-compose-button
      <WorkflowPage isWorkflowAdmin>                ← client · testid workflow-page
        ├── WorkflowInboxToolbar                     ← Suspense 밖 (plan 40)
        │     ├── Tabs(nuqs tab) TabsList            ← 진행중/완료/중요/전체 + 건수
        │     ├── WorkflowSearchInput                ← testid workflow-search-input (debounce 500ms, nuqs q)
        │     ├── WorkflowSortMenu                   ← testid workflow-sort (DropdownMenu + RadioGroup)
        │     ├── WorkflowScopeToggle                ← ToggleGroup single · testid workflow-scope-{related|mine|company}
        │     ├── WorkflowWriterFilter               ← testid workflow-filter-writer (Popover+Command 다중)
        │     ├── WorkflowTemplateFilter             ← testid workflow-filter-template (Popover+Command 다중)
        │     ├── WorkflowUpdatedFilter              ← testid workflow-filter-updated (Popover 3뷰)
        │     ├── 결과 건수 "n건" (aria-live=polite)
        │     └── 초기화 Button                      ← testid workflow-reset
        ├── WorkflowListErrorBoundary                ← QueryErrorResetBoundary (quick-request-query-boundary 패턴)
        │     └── Suspense key={querySignature} fallback=<PageLoadingSpinner variant='fill'/>
        │           └── WorkflowInboxBody
        │                 ├── [tab=in_progress] WorkflowListGroup kind=approval_required   ← testid workflow-group-approval-required
        │                 │        rows 5 + 「더보기」(workflow-load-more)
        │                 ├── [tab=in_progress] WorkflowListGroup kind=in_progress         ← testid workflow-group-in-progress
        │                 │        rows 20 + 「더보기」(workflow-load-more)
        │                 └── [그 외 탭] WorkflowFlatList (20개씩 + 「더보기」 workflow-load-more)
        │                       └── WorkflowListRow ← testid workflow-row-{code}
        ├── WorkflowDetailPanel (nuqs doc)           ← §3
        ├── WorkflowTemplatePickerDialog             ← §4.1
        └── WorkflowComposeDialog                    ← §4.2
```

### 2.4 툴바 상세

| 요소 | 구현 | 문구·동작 |
|------|------|-----------|
| 탭 | shadcn `Tabs`(variant 기본, URL `tab` = `in_progress`·`done`·`star`·`all`, 기본 `in_progress`) | 라벨 「진행중」「완료」「중요」「전체」. 건수는 라벨 옆 `<span aria-hidden className='text-muted-foreground tabular-nums'>3</span>`로 둬서 **접근 가능한 이름이 정확히 탭 이름**이 되게 한다(e2e `getByRole('tab',{name})`). 건수는 `GET …/counts`를 **non-suspense `useQuery`**로 읽고, 로딩 중에는 숫자를 생략한다 |
| 범위 토글 | `ToggleGroup type='single' variant='outline' size='sm'` | 「전체」(`related`, 기본) · 「내가 작성한」(`mine`) · 「회사 전체」(`company`, **워크플로우 관리자만 렌더링**). 선택을 해제할 수 없게 한다(빈 값이 오면 무시) |
| 작성자 | `Popover` + `Command`(검색, 체크박스 다중) — `support-list-filters` 상태 필터 패턴 + 구성원 목록 | trigger `Button variant='outline' size='sm' className='border-dashed'` 「작성자」 + 선택 수 Badge. 구성원은 `GET /api/workflow/members`(1회 캐시, 클라이언트 필터). 목록 로딩은 `PageLoadingSpinner compact` |
| 양식 | 위와 동일 | 옵션 = 작성 가능한 양식(`GET /api/workflow/templates`) · 이모지 + 이름 |
| 업데이트일 | `Popover` 안에 3개 뷰 | ① 메뉴(`Command`): 오늘 · 지난 1주일 · 지난 1개월 · 지난 3개월 ─ 월별 조회 ─ 직접 입력 ② 월별 조회: 연도 ‹ › + 12개월 버튼 grid(3×4) → `month:YYYY-MM` ③ 직접 입력: `Calendar mode='range'` + 「적용」 → `range:from..to`. trigger 라벨: 「업데이트일」 / 「오늘」 / 「2026-10」 / 「2026-10-01 ~ 2026-10-21」 (flex `13-menu-업데이트일`) |
| 검색 | `Input` + `Icons.search` 왼쪽 아이콘(InputGroup), placeholder 「문서번호·내용 검색…」, `type='search'`, X로 지우기 | debounce 500ms → nuqs `q` |
| 정렬 | `DropdownMenu` + `DropdownMenuRadioGroup` | trigger 「정렬」 + 아이콘. 항목: 최근 업데이트순(기본) · 오래된 업데이트순 · 최근 작성순 · 오래된 작성순 (`sort` = `updated_desc`·`updated_asc`·`written_desc`·`written_asc`). e2e는 `getByRole('menuitemradio',{name})` |
| 건수 | `<p aria-live='polite'>3건</p>` | 현재 탭·범위·필터 결과 total |
| 초기화 | `Button variant='ghost' size='sm'` 「초기화」 | **항상 렌더링**하고(flex 동일), 조건이 없으면 `disabled`. 누르면 q·writer·template·updated·sort·scope를 null로 한다(tab은 유지) |

- **PC 배치(md↑)**: 1행 = Tabs(왼쪽) · 검색 · 정렬(오른쪽), 2행 = 범위 · 필터 칩 · (오른쪽) 건수 · 초기화. flex 배치 그대로다.
- **모바일**: TabsList는 `w-full justify-start overflow-x-auto`(줄바꿈 금지, 페이지 가로 스크롤 0). 검색은 한 줄 전체 너비. 범위 토글은 별도 줄(`overflow-x-auto`). 필터 칩은 `flex-wrap`. 칩·탭 높이는 모바일에서 `h-9` 이상이다.

### 2.5 목록 그룹

- **진행중 탭**만 2그룹이다. 그룹 header = `Collapsible`(기본 펼침): 「승인 필요 문서 {total}」 / 「진행중 문서 {total}」 + 오른쪽 「접기 ▴ / 펼치기 ▾」(`Button variant='ghost' size='sm'`, `aria-expanded`).
  - `승인 필요`: 5개 + 「더보기」. `진행중 문서`: 20개 + 「더보기」. 둘 다 `useSuspenseInfiniteQuery`이고 「더보기」 버튼은 `isLoading` 상태를 표시한다.
  - **total이 0인 그룹은 렌더링하지 않는다**. 두 그룹이 모두 0이면 빈 상태 1개를 보여 준다.
- 「더보기」 testid는 그룹마다 `workflow-load-more`이다. **e2e는 그룹 testid 안에서 찾는다**(`getByTestId('workflow-group-in-progress').getByTestId('workflow-load-more')`). 완료·중요·전체 탭은 그룹 없이 평면 목록이므로 하나뿐이다.
- 체크박스(일괄 선택), 그룹 보기 설정, 「+ 필터 추가」, 보기 저장은 **Out**(plan)이다.

### 2.6 목록 행 `WorkflowListRow`

행 전체를 **클릭 요소 1개**로 만든다(support 행과 같은 구조). 단 raw `<button` 0건 규칙(AC-47) 때문에 shadcn `Button variant='ghost'`을 쓰고 `className='h-auto w-full justify-start whitespace-normal rounded-none px-0 py-3 text-left font-normal'`로 덮어쓴다. testid `workflow-row-{code}`.

| 슬롯 | 내용 | 스타일 |
|------|------|--------|
| 이모지 타일 | `template.emoji` (📄) | `size-10 rounded-lg bg-muted text-xl grid place-items-center shrink-0`, `aria-hidden` |
| 1줄 | 작성자 이름 · `<time>` 업데이트 시각(`formatAbsoluteDateTimeKo`) · `WorkflowStatusBadge` | 이름 `text-sm font-medium`, 시각 `text-xs text-muted-foreground tabular-nums` |
| 2줄 | 양식명(`font-medium`) · 문서번호(`font-mono text-xs text-muted-foreground`) · **요약** | 요약은 `truncate`(md↑) / `line-clamp-2`(모바일), `text-muted-foreground text-sm`. 요약 문자열은 **「요청 유형: …」으로 시작**한다(문서번호는 별도 span, AC-12) |
| 오른쪽(md↑) / 3줄(모바일) | 첨부 칩 「첨부파일 n건」(`Badge variant='outline'` + `Icons.paperclip`, n=0이면 생략) · `ApproverAvatarStack` | 아바타 `size-7`, `-space-x-2`, `ring-2 ring-background`, 최대 3명 + 「+n명」. 아바타 `title`·sr-only에 이름 |

- 행 높이는 최소 64px이다. hover `bg-muted/50`, focus-visible ring, `border-b`.
- **요약 규칙(`lib/summary.ts`, 서버가 만들어 `summary`로 내려줌)**: 양식 필드를 display_order 순으로 「{필드명}: {값}」 형식으로 만들어 ` · `로 잇는다. **빈 값은 건너뛴다**(AC-12). SELECT는 값 그대로, MULTISELECT는 `, `로 연결, AMOUNT는 `₩194,840`(flex 목록 표기), DATE는 `yyyy-MM-dd`이고 TASK_REFERENCE는 제외한다.

### 2.7 상태 뱃지 `WorkflowStatusBadge`

`Badge variant='outline'` + `rounded-full px-2 py-0.5 text-xs font-normal shadow-none border-transparent` (SupportStatusBadge와 동일 베이스)

| 표시 | 조건 | 클래스 |
|------|------|--------|
| `승인 필요` | 보는 사람이 현재 ONGOING 단계의 WAITING actor일 때(`my_state.approval_required`) — **목록·상세 모두 상태보다 우선** | `bg-amber-500/10 text-amber-700 dark:text-amber-400` |
| `진행중 n/N` | IN_PROGRESS (n = current_step, N = total_steps) | `bg-blue-500/10 text-blue-700 dark:text-blue-400` + `tabular-nums` |
| `완료` | DONE | `bg-green-500/10 text-green-700 dark:text-green-400` |
| `반려` | DECLINED | `bg-destructive/10 text-destructive` |
| `취소` | CANCELED | `bg-muted text-muted-foreground` |

- 상세 상단 뱃지는 같은 컴포넌트를 쓰고 `size='lg'` 변형(`px-2.5 py-1 text-sm`)을 둔다. 래퍼 testid는 `workflow-detail-status`다. **AC-17은 `진행중 1/2`를 기대한다** → 상세 상단 뱃지는 `승인 필요`로 바꾸지 않고 **문서 상태(진행중 n/N)**를 표시한다. 목록 행만 `승인 필요`가 우선한다(AC-16). (flex는 상세에도 「승인필요」를 표시하지만 AC를 따른다.)

### 2.8 상태별 UI (문서함)

| 상태 | UI |
|------|----|
| 로딩(라우트) | `loading.tsx`: `PageContainer`(title·description 동일) + `PageLoadingSpinner variant='fill'` |
| 로딩(필터 변경) | 툴바는 그대로 두고 본문만 `Suspense key={querySignature}` → `fill` |
| 더보기 | 버튼 `isLoading`(목록 위 overlay spinner 금지) |
| 빈 상태 | 가운데 `Icons.clipboardText`(muted, size-10) + 「문서가 없습니다.」(AC-38 정확 문구) + 보조 문구(필터가 있으면 「검색 조건을 바꾸거나 초기화해 보세요.」, 없으면 없음) |
| 에러(AC-45) | `Alert variant='destructive'` + 「문서함을 불러오지 못했습니다.」 + `Button` 「다시 시도」(h-11) → `QueryErrorResetBoundary` reset. 툴바와 사이드바는 그대로 동작한다 |
| 권한 없음 | `scope=company`를 비관리자가 URL로 넣으면 → 클라이언트에서 `related`로 정규화한다(토글 미렌더링). API 403은 에러 UI로 표시 |

---

## 3. 문서 상세 `WorkflowDetailPanel`

### 3.1 PC 와이어 (1280 · `?doc={id}`)

```text
╭─ /dashboard/workflow?doc=… ─────────────────────────────────────────────────────────────╮
│ (사이드바) │ 문서함 목록(흐리게)  ┃                              [☆] [···] [✕]  ┃ 승인 · 참조          │
│            │                    ┃ [진행중 1/2]                                 ┃ 참조 ────────────     │
│            │ 승인 필요 문서 1     ┃ 지출결의서                                   ┃ (관) 관리자  [🔔 참조] │
│            │ ┌──┐ 김웨이크 …      ┃ 문서번호 2026-0003 · 작성 2026-10-21 (화)…  ┃ 1 단계 진행 중 ─────  │
│            │                    ┃                                              ┃ (승) 승인자A  [대기중] │
│            │                    ┃ (김) 김웨이크님이 글을 작성했어요. 2026-10-… ┃ 2 단계 대기중 ──────  │
│            │                    ┃ (↻) 김웨이크님이 승인·참조자를 변경했어요.    ┃ (승) 승인자B  [대기중] │
│            │                    ┃      2단계: 승인자B(승인) → 관리자(승인)      ┃                       │
│            │                    ┃ [댓글 입력…                         ][등록]  ┃                       │
│            │                    ┃ ─────────────────────────────────────────── ┃                       │
│            │                    ┃ ◎ 요청 유형      [구매 요청]                  ┃                       │
│            │                    ┃ Tт 작성자        김웨이크                     ┃                       │
│            │                    ┃ ▦ 작성일         2026-10-21                   ┃                       │
│            │                    ┃ ₩ 금액           194,840 원                   ┃                       │
│            │                    ┃ 🔗 참조문서      [📄 지출결의서 2026-0001]      ┃                       │
│            │                    ┃ 첨부파일 (1)  [🖼 견적서.png  ⤓]               ┃                       │
│            │                    ┃ (본문 HTML)                                   ┃                       │
│            │                    ┃ ┌────────────┐ ┌──────────────────────────┐   ┃                       │
│            │                    ┃ │ ⊘ 반려      │ │ ✓ 승인                    │   ┃  ← footer(본문 열)     │
╰─────────────────────────────────────────────────────────────────────────────────────────╯
```

### 3.2 모바일 와이어 (375 · 전체 화면)

```text
╭─ 375 ────────────────────────────╮
│ [진행중 1/2] 지출결의서 [☆][···][✕]│  ← header(고정)
├──────────────────────────────────┤
│ 지출결의서                        │  ↑
│ 문서번호 2026-0003                │  │
│ 작성 2026-10-21 (화) 13:53:00     │  │
│ (김) 김웨이크님이 글을 작성했어요. │  │ 스크롤
│ [댓글 입력…              ][등록]  │  │
│ 요청 유형                         │  │
│   [구매 요청]                     │  │
│ … 필드 · 첨부 · 본문 …            │  │
│ 승인 · 참조 ───────────────       │  │ ← 본문 아래(lg 미만)
│ 1 단계 진행 중  (승) 승인자A 대기중│  ↓
├──────────────────────────────────┤
│ [ ⊘ 반려 ]   [   ✓ 승인        ] │  ← footer(고정, h-11+, safe-area)
╰──────────────────────────────────╯
```

### 3.3 구조

```
Dialog open={!!doc} onOpenChange(false → setParams({doc:null}))
  DialogPortal
    DialogOverlay                                   ← 기본 overlay(flex처럼 목록이 흐리게 보임)
    DialogPrimitive.Content  testid workflow-detail  aria-describedby={metaId}
      className:
        모바일: fixed inset-0 h-dvh w-full flex flex-col bg-background
        md↑   : md:inset-y-0 md:right-0 md:left-auto md:w-[min(72rem,calc(100vw-4rem))] md:border-l md:shadow-lg
                 slide-in-from-right / slide-out-to-right (reduced-motion이면 fade만)
        lg↑   : lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[auto_minmax(0,1fr)_auto]
      ├── header (lg:col-start-1 lg:row-start-1, shrink-0, h-14, px-4 md:px-6, border-b)
      │     ├── (모바일만) 상태 뱃지 + 양식명 1줄 truncate
      │     └── 오른쪽: StarToggle(workflow-star) · MoreMenu(workflow-more-menu) · Close(workflow-detail-close)
      ├── div.scroll  className='min-h-0 flex-1 overflow-y-auto overscroll-contain lg:contents'
      │     ├── main (lg:col-start-1 lg:row-start-2 lg:min-h-0 lg:overflow-y-auto overscroll-contain, px-4 md:px-12 py-6)
      │     │     ├── Suspense fallback=<PageLoadingSpinner variant='compact'/>
      │     │     │   ├── WorkflowDetailHeading   ← 뱃지(workflow-detail-status) · DialogTitle h2 「지출결의서」 · meta
      │     │     │   │        meta: 「문서번호 <span testid workflow-detail-code>2026-0003</span> · 작성 2026-10-21 (화) 13:53:00」
      │     │     │   ├── WorkflowTimeline (ol, testid workflow-timeline)
      │     │     │   ├── WorkflowCommentForm
      │     │     │   ├── Separator
      │     │     │   ├── WorkflowFieldTable (dl)
      │     │     │   ├── WorkflowAttachmentList (mode='view')
      │     │     │   └── WorkflowRichContent (본문 HTML)
      │     └── aside 「승인 · 참조」 (lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:overflow-y-auto lg:border-l, 모바일은 border-t + 본문 아래)
      │           └── WorkflowApprovalLineView
      └── footer (lg:col-start-1 lg:row-start-3, shrink-0, border-t, px-4 md:px-12 py-3, pb-[max(0.75rem,env(safe-area-inset-bottom))])
            렌더링 조건: permissions.can_approve
            ├── Button variant='outline' 「반려」 Icons.ban  testid workflow-decline  className='h-11 flex-1'
            └── Button 「승인」 Icons.check                  testid workflow-approve  className='h-11 flex-[2]'
```

- 패널 안의 `Suspense`는 header 밖에 둔다. 로딩 중에도 닫기·별·메뉴 위치가 유지된다(별·메뉴는 데이터가 오기 전까지 렌더링하지 않고, 닫기만 표시).
- 다른 문서로 이동(참조문서 카드, 알림 클릭)은 `setParams({doc})`만 바꾼다. 패널은 그대로 두고 내용만 다시 Suspense한다(`key={doc}`).
- 열고 닫을 때 포커스: 열리면 DialogTitle로, 닫히면 원래 행으로 돌아간다(Radix 기본). deep link로 열렸을 때는 body로 돌아간다.

### 3.4 타임라인 `WorkflowTimeline`

`<ol testid=workflow-timeline>` → `<li testid=workflow-timeline-item>`. 각 항목 = 왼쪽 24px 슬롯(아바타 또는 아이콘) + 본문.

| event.type | 왼쪽 슬롯 | 문구(굵게는 이름) | 추가 블록 |
|------------|-----------|-------------------|-----------|
| WRITE | 작성자 아바타 | 「**{이름}**님이 글을 작성했어요.」 | — |
| CHANGE_STAGE_STAKE_HOLDERS | `Icons.refresh` muted | 「**{이름}**님이 승인·참조자를 변경했어요.」 | diff 줄 목록: 「2단계: {A}(승인) → {B}(승인)」, 「3단계: 없음 → {C}(승인)」, 참조 변경은 「참조: {A} → 없음」. `text-sm text-muted-foreground` |
| APPROVE | `Icons.circleCheck` `text-green-600 dark:text-green-400` | 「**{이름}**님이 승인했어요.」 | 의견이 있으면 인용 박스 `rounded-md bg-muted px-3 py-2 text-sm whitespace-pre-wrap` |
| DECLINE | `Icons.ban` `text-destructive` | 「**{이름}**님이 반려했어요.」 | 사유 인용 박스 |
| CANCEL | `Icons.circleX` muted | 「**{이름}**님이 문서를 취소했어요.」 | — |
| UPDATE | `Icons.edit` muted | 「**{이름}**님이 문서를 수정했어요.」 | 「바뀐 항목: 비고, 금액」 (`changed_field_keys` → 스냅샷 필드 이름, 본문은 「본문」, 첨부는 「첨부파일」) |
| COMMENT | 작성자 아바타 | 첫 줄 **{이름}** + 시각, 둘째 줄 댓글 내용(`whitespace-pre-wrap break-words`) | — |

- 모든 항목 오른쪽에 `<time>` 절대 시각(`formatAbsoluteDateTimeKo`, `text-xs text-muted-foreground tabular-nums`)을 둔다. 「활동 모두 보기」 접기는 **Out**(전부 표시)이다.
- 이름은 `font-medium text-foreground`, 나머지는 `text-sm`.

### 3.5 댓글 입력 `WorkflowCommentForm`

- `Textarea` 1줄 auto-grow(`field-sizing-content min-h-10 max-h-40`), placeholder 「댓글 입력…」, `aria-label='댓글'`, testid `workflow-comment-input`. 배경은 flex처럼 `bg-muted/50 border-transparent`.
- 오른쪽 `Button size='sm'` 「등록」 testid `workflow-comment-submit`. trim이 빈 값이면 `disabled`이고, 제출 중에는 `isLoading`. ⌘/Ctrl+Enter로 제출한다.
- 2000자를 넘으면 클라이언트에서 막는다: 1900자부터 `n/2000` 카운터를 보여 주고, 초과하면 FieldError 「댓글은 2000자 이내로 입력해 주세요.」 + 버튼 비활성. 성공하면 입력을 비우고 타임라인이 invalidate된다.
- 완료·반려·취소 문서에서도 댓글을 쓸 수 있다(PERMISSIONS §3).

### 3.6 필드 표 `WorkflowFieldTable`

`<dl>` grid: md↑ `grid-cols-[11rem_minmax(0,1fr)] gap-x-6 gap-y-4` / 모바일은 라벨 위, 값 아래로 쌓는다(`grid-cols-1 gap-y-1`, 항목 간 `gap-y-4`).

| type | dt 아이콘 | dd 표시 |
|------|-----------|---------|
| SELECT | `Icons.circleCheck` | `Badge variant='secondary' className='rounded-md font-normal'` 칩 |
| MULTISELECT | `Icons.list` | 칩 여러 개(`flex-wrap gap-1`) |
| STRING | `Icons.text` | `whitespace-pre-wrap break-words`. 값이 `http(s)://`로 시작하면 `<a target='_blank' rel='noopener noreferrer' className='text-primary underline-offset-4 hover:underline break-all'>` |
| DATE | `Icons.calendar` | `yyyy-MM-dd` (`formatAbsoluteDateKo`) |
| AMOUNT_OF_MONEY | `Icons.currencyWon` | 「194,840 원」 — `Intl.NumberFormat('ko-KR')` + 「 원」, `tabular-nums` (AC-17) |
| TASK_REFERENCE | `Icons.link` | `WorkflowReferenceCard` 목록, 없으면 「-」 |

- 빈 값은 「-」(`text-muted-foreground`)로 표시한다. 라벨은 문서의 `template_snapshot` 필드 이름을 쓴다.
- `WorkflowReferenceCard`(testid `workflow-reference-card-{code}`): `Button variant='outline' size='sm' className='h-auto justify-start gap-2'` → 「📄 지출결의서 2026-0001」 + 작성자(muted). 누르면 `setParams({doc: referenced.id})`. 열람할 수 없는 참조는 서버가 내려주지 않는다.

### 3.7 첨부 `WorkflowAttachmentList` (view)

- 제목 「첨부파일 (n)」(`text-sm font-medium`). 0개면 섹션을 렌더링하지 않는다. 「모두 저장」은 **Out**이다.
- 카드: `rounded-lg border p-2 flex items-center gap-3 min-w-0` · 파일 유형 아이콘(`fileTypePdf`/`media`/`page`) · 파일명(`break-all line-clamp-2`) + 크기(`formatBytes`) · 오른쪽 다운로드 아이콘 버튼(`aria-label='{파일명} 다운로드'`).
- 카드 본문을 누르면 이미지·PDF는 **`openAttachmentLightbox`**(plan 72), 그 밖의 파일은 다운로드한다. 배치는 `grid sm:grid-cols-2 gap-2`.
- testid: 각 카드 `workflow-attachment-{id}`(작성 폼과 같은 규칙).
- **attachments feature 최소 확장 필요(FE)**: 현재 `LightboxSource`·`AttachmentLightboxItem.id`·`parentId`가 `number`뿐이다. ① `LightboxSource`에 `{ kind: 'workflow'; parentId: string }`를 추가 ② `id`·`parentId`·`initialAttachmentId`를 `number | string`으로 넓힘 ③ `fetch-attachment-blob.ts` switch에 `workflow` → `GET /api/workflow/documents/{id}/attachments/{attId}/download`(signed URL → blob)를 추가. 기존 contract·announcement 동작은 바꾸지 않는다.

### 3.8 본문 `WorkflowRichContent`

- 서버에서 정화한 `content_html`만 `dangerouslySetInnerHTML`로 그린다. 빈 문자열이거나 `<p></p>`면 섹션을 렌더링하지 않는다.
- typography 플러그인이 없으므로 **공유 클래스 상수**(`lib/rich-content-class.ts`)로 스타일을 준다. 편집기·상세·인쇄가 같은 상수를 쓴다.
  `text-sm leading-7 break-words [&_p]:my-2 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-primary [&_a]:underline [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:bg-muted [&_th]:px-2 [&_th]:py-1 [&_th]:text-left`
- 표가 넓으면 래퍼에 `overflow-x-auto`를 준다(페이지 가로 스크롤 0, AC-43).

### 3.9 「승인 · 참조」 보기 `WorkflowApprovalLineView`

```
h3 「승인 · 참조」(text-sm font-semibold)
섹션 「참조」 ──────────            ← 라벨 + 오른쪽으로 Separator가 이어짐(flex)
  (아바타32) 이름 / 소속·직급(muted xs)        [🔔 참조]   ← Badge outline + Icons.notification. Tooltip: 알림 설정 라벨
섹션 「1 단계 진행 중」(text-primary font-medium) / 「2 단계 대기중」(muted) / 「1 단계 완료」(muted) / 「1 단계 반려」(text-destructive)
  (아바타) 이름 / 소속   [대기중](Badge outline muted) | [✓ 승인](green 계열 Badge) | [반려](destructive/10)
```
- 소속 표기는 `AFFILIATION_OPTIONS` 라벨 + `position_level`(예: 「웨이크 · 대리」)이고, 없으면 생략한다.
- 참조자가 0명이면 「참조」 섹션을 생략한다.
- 사람 행 높이 48px, 아바타 `size-8`, `AvatarImage` → `AvatarFallback` 이니셜.

### 3.10 `···` 메뉴 `WorkflowDetailMoreMenu` (testid `workflow-more-menu` = trigger)

`DropdownMenu` · trigger `Button variant='ghost' size='icon' aria-label='더 보기'`(`Icons.moreHorizontal`). 노출 조건은 **서버가 내려주는 `permissions` 플래그**를 그대로 쓴다.

| 항목(아이콘) | 노출 조건 | 동작 |
|--------------|-----------|------|
| 문서 수정 (`edit`) | `can_edit` = IN_PROGRESS AND (작성자 OR 결재선 actor) | 작성 Dialog를 **수정 모드로 패널 위에 중첩**해서 연다(§4.2). 저장하면 Dialog를 닫고 상세를 갱신하며 toast 「문서를 수정했습니다.」 |
| 승인·참조 변경 (`refresh`) | `can_change_line` = IN_PROGRESS AND 작성자 AND `approval_step_edit_enabled` | `WorkflowApprovalLineDialog`(§5.3) |
| 복제하기 (`copy`) | `can_duplicate` = 작성자 | 상세를 닫고(`doc=null`) 작성 Dialog를 복제 모드로 연다(첨부 비움, 작성일 오늘, 작성자 = 현재 사용자 이름) |
| PDF 인쇄 (`printer`) | 열람자 전원 | `window.open('/workflow-print/{id}', '_blank', 'noopener')` |
| ─ separator ─ | | |
| 문서 취소 (`circleX`, `variant='destructive'`) | `can_cancel` = IN_PROGRESS AND 작성자 | `AlertModal` 제목 「문서 취소」, 설명 「{code} 문서를 취소합니다. 취소한 문서는 되돌릴 수 없습니다.」, 확인 「문서 취소」, 취소 「닫기」. 성공하면 toast 「문서를 취소했습니다.」 + `setParams({tab:'done'})`(패널은 유지하고 뱃지는 「취소」) |

- 보이는 항목이 「PDF 인쇄」 하나뿐이어도 메뉴를 유지한다(flex 동일). 히스토리는 **Out**이다.
- 항목은 `DropdownMenuItem`(role menuitem)이다. e2e는 `getByRole('menuitem',{name})`를 쓴다.

### 3.11 중요 ★ `WorkflowStarToggle`

- `Toggle`(shadcn) `aria-label='중요 표시'` `aria-pressed={starred}` testid `workflow-star`. 아이콘은 `Icons.star` / `Icons.starFilled`(`text-amber-500`)이다.
- 낙관적 업데이트(plan 37 방식): 실패하면 롤백 + toast. 목록의 「중요」 탭 건수도 invalidate한다.

### 3.12 승인 / 반려 Dialog

| | 승인 `WorkflowApproveDialog` | 반려 `WorkflowDeclineDialog` |
|-|------|------|
| 형태 | shadcn `Dialog`(기본 `DialogContent`, sm:max-w-md) | 동일 |
| 제목 / 설명 | 「승인」 / 「{code} 문서를 승인합니다.」 | 「반려」 / 「{code} 문서를 반려합니다. 반려하면 이후 단계는 진행하지 않아요.」 |
| 입력 | `Textarea` 라벨 「의견 (선택)」, placeholder 「의견을 입력해 주세요…」 | `Textarea` 라벨 「반려 사유 (선택)」, placeholder 「반려 사유를 입력해 주세요…」 |
| 버튼 | 「취소」(outline) · 「승인」(primary, `isLoading`) | 「취소」 · 「반려」(`variant='destructive'`, `isLoading`) |
| 성공 | toast 「승인했습니다.」, 상세·목록·건수 invalidate | toast 「반려했습니다.」 |
| 409 | toast 「이미 처리된 문서입니다.」 + 상세 refetch | 동일 |

- 입력이 있으므로 AlertModal이 아니라 Dialog를 쓴다(취소·삭제류가 아님). 모바일에서는 기본 Dialog(가운데)이고 버튼 높이는 h-11이다.

### 3.13 상세 상태별 UI

| 상태 | UI |
|------|----|
| 로딩 | 패널 header(닫기)는 유지하고, 본문에 `PageLoadingSpinner variant='compact'` |
| 404 / 권한 없음(AC-23) | 본문 가운데 `Icons.alertCircle` + 「문서를 찾을 수 없거나 열람 권한이 없습니다.」 + `Button variant='outline'` 「닫기」. 상세 내용 0건. aside·footer는 렌더링하지 않는다 |
| 기타 에러 | `Alert variant='destructive'` 「문서를 불러오지 못했습니다.」 + 「다시 시도」 |
| 처리 완료 문서 | footer 없음, `···`에는 PDF 인쇄(+작성자는 복제하기)만 |

---

## 4. 작성 흐름

### 4.1 양식 선택 `WorkflowTemplatePickerDialog` (testid `workflow-template-picker`)

```text
╭─ PC: 가운데 max-w-xl · h-[min(44rem,calc(100dvh-4rem))] / 모바일: 전체 화면 ─╮
│ [🔍 양식 검색…                                         ] [✕]          │  ← header
│ 이어서 작성하기 1개                                                    │  ← workflow-draft-list
│ ┌──┐ 지출결의서 [임시저장]                                        [✕]  │  ← workflow-draft-{id} · 삭제 workflow-draft-delete-{id}
│ │📄│ 2026-10-21 (화) 09:40:12                                         │
│ └──┘                                                                  │
│ 더 보기 ▾                                                              │
│ 워크플로우 양식 선택                                                    │
│ (태그 칩: 태그가 있을 때만 — 1단계 seed는 tags='{}'이라 렌더링 0)        │
│ ┌──┐ 지출결의서                                                        │  ← workflow-template-option-expense
│ │📄│                                                                  │
╰──────────────────────────────────────────────────────────────────────╯
```
- 구조는 quick-request 주소 선택 Dialog와 같다(모바일 `inset-0 h-dvh`, lg 가운데).
- 검색 `Input` testid `workflow-template-search`, placeholder 「양식 검색…」, PC에서만 autoFocus. 검색은 양식 이름을 클라이언트에서 필터한다. 임시저장 목록에도 같은 검색을 적용한다.
- 임시저장 섹션: 제목은 **「이어서 작성하기 {n}개」**(AC-33 문구). 기본 3개 + 「더 보기」(Collapsible). 0개면 섹션을 렌더링하지 않는다. 「모두 지우기」는 Out이다.
  - 행(`workflow-draft-{id}`): 행 본문 Button(이모지 타일 + 양식명 + `Badge variant='secondary'` 「임시저장」 + 저장 시각) + 오른쪽 `Button variant='ghost' size='icon'` X `aria-label='임시저장 삭제'` testid `workflow-draft-delete-{id}` → `AlertModal` 제목 「임시저장 삭제」, 설명 「임시저장한 내용과 첨부파일이 삭제됩니다.」, 확인 「삭제」, 취소 「취소」. 성공하면 toast 「임시저장을 삭제했습니다.」
- 양식 옵션(`workflow-template-option-{template_key}`, 지출결의서는 `expense`): 행 Button(이모지 타일 + 이름). 누르면 picker를 닫고 작성 Dialog를 연다.
- 빈 검색 결과: 「검색 결과가 없습니다.」. 로딩: `compact`. 에러: Alert + 다시 시도.

### 4.2 작성·수정 폼 `WorkflowComposeDialog` (form testid `workflow-compose-form`)

```text
╭─ PC(lg↑): 가운데 · w-[min(80rem,calc(100vw-4rem))] · h-[calc(100dvh-4rem)] ───────────────────────────╮
│ [작성하기]                                               [✕]  ┃ 승인 · 참조                          │
│ ────────────────────────────────────────────────────────────── ┃ 참조 ───────────────────── [+]       │
│ 지출결의서 (h2)                                                 ┃ (관) 관리자  웨이크·팀장  [🔔 알림 ▾][✕]│
│ ┌ 작성 가이드(workflow-guide) ─────────────────────────────┐   ┃ 1 단계 승인 ──────────── [+][🗑]      │
│ │ 일하는 데 필요한 비용 신청 및 입, 출금 요청 시 작성해주세요. │   ┃ (승) 승인자A          [승인] [✕]      │
│ │ ✅ 공통 필수 값 : 요청 유형 / 작성자 / 작성일 / …           │   ┃ 2 단계 승인 ──────────── [+][🗑]      │
│ │ … 요청 유형을 고르면 필요한 칸에 빨간 점이 표시돼요. …      │   ┃ (승) 승인자B          [승인] [✕]      │
│ └──────────────────────────────────────────────────────────┘   ┃ [ ＋ 승인 단계 추가하기 ]              │
│ ◎ 요청 유형 •      [입, 출금 요청 ▾]                            ┃                                      │
│ Tт 작성자 •        [김웨이크                    ]               ┃                                      │
│ ▦ 작성일 •         [2026-10-21               ▦]               ┃                                      │
│ ◎ 사용 브랜드 •    [옵션을 선택해 주세요.      ▾]               ┃                                      │
│ ₩ 금액 •           [                      ] 원                 ┃                                      │
│ ▦ 입금 ,구매 요청기한 [날짜를 입력해 주세요.   ▦]               ┃                                      │
│ Tт 업체명 및 예금주 • [내용을 입력해 주세요.     ]               ┃                                      │
│      ⚠ 업체명 및 예금주 항목을 입력해 주세요.                    ┃                                      │
│ Tт 품명 및 수량     [내용을 입력해 주세요.       ]   ← 필수 아님: 점 없음 ┃                               │
│ 🔗 참조문서         [문서를 추가해 주세요.]                       ┃                                      │
│ 📎 첨부파일 •       ┌ 파일 추가 혹은 여기로 드래그 (20MB 이하, 최대 30개) ┐ ┃                          │
│                    └────────────────────────────────────────┘ ┃                                      │
│ ┌ B I U S │ 14px ▾ │ • 1. │ ⟸ ⟺ ⟹ │ ▦ 🔗 │ ↶ ↷ ┐  (workflow-editor) ┃                                      │
│ │ 내용을 입력하세요                                            │ ┃                                      │
│ └─────────────────────────────────────────────────────────────┘ ┃                                      │
│ ────────────────────────────────────────────────────────────── ┃                                      │
│ [ 임시저장 ]  [                 보내기                      ]   ┃  ← footer(왼쪽 열)                    │
╰─────────────────────────────────────────────────────────────────────────────────────────────────────╯
```
모바일(375): 전체 화면. header(배지 + 닫기) → 스크롤(제목·가이드·입력칸·참조문서·첨부·편집기·**승인 · 참조**) → footer 고정([임시저장] [보내기], h-11, safe-area).

```
WorkflowComposeDialog (mode: 'new' | 'draft' | 'duplicate' | 'edit')
  Dialog open onOpenChange → 닫기 가드
  DialogPortal · DialogOverlay
  DialogPrimitive.Content  (onEscapeKeyDown·onInteractOutside: dirty면 preventDefault 후 가드 AlertModal)
    className:
      모바일: fixed inset-0 h-dvh flex flex-col
      lg↑  : lg:inset-auto lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2
             lg:w-[min(80rem,calc(100vw-4rem))] lg:h-[calc(100dvh-4rem)] lg:rounded-xl lg:border
             lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:grid-rows-[auto_minmax(0,1fr)_auto]
    form#workflow-compose-form  testid workflow-compose-form  className='contents'
      ├── header (lg:col-start-1 lg:row-start-1): Badge 「작성하기」/「수정하기」(variant default, rounded-full) · 닫기 Button(icon, aria-label='닫기', testid workflow-compose-close)
      ├── div.scroll 'min-h-0 flex-1 overflow-y-auto overscroll-contain lg:contents'
      │     ├── main (lg:col-start-1 lg:row-start-2 lg:overflow-y-auto, px-4 md:px-12 py-6, space-y-8)
      │     │     ├── DialogTitle h2 「지출결의서」(text-2xl font-bold)
      │     │     ├── WorkflowGuide (testid workflow-guide) — description을 whitespace-pre-wrap text-sm leading-7으로 그대로 표시(이모지 포함)
      │     │     ├── Separator
      │     │     ├── WorkflowDynamicFields — 필드 정의 순서대로 WorkflowDynamicField × 15
      │     │     ├── WorkflowAttachmentField (mode='edit')
      │     │     └── WorkflowRichTextEditor (content_visible일 때)
      │     └── aside (lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:overflow-y-auto lg:border-l bg-muted/30, 모바일 border-t px-4 py-6)
      │           └── WorkflowApprovalLineEditor mode='compose' (수정 모드에서는 WorkflowApprovalLineView 읽기 전용)
      └── footer (lg:col-start-1 lg:row-start-3, border-t px-4 md:px-12 py-3 safe-area, flex gap-2)
            ├── Button variant='outline' 「임시저장」 testid workflow-save-draft className='h-11'   ← 수정 모드에서는 렌더링하지 않음
            └── Button type='submit' form='workflow-compose-form' 「보내기」/「저장」 testid workflow-submit className='h-11 flex-1' isLoading
```

- **TASK_REFERENCE 필드는 15칸 순서 안에서 `reference_documents` 행으로 렌더링한다**(testid `workflow-field-reference_documents`). 「문서를 추가해 주세요.」 버튼 → 참조문서 선택 Dialog(§4.6). 첨부 행은 필드 목록 **다음**에 둔다(flex `09-compose-bottom` 순서: …비고 → 참조문서 → 첨부파일 → 편집기).
- 로딩: 양식 정의를 불러오는 동안 main 자리에 `compact`를 표시한다(header·닫기는 유지). 복제·임시저장 불러오기도 같다.
- 모드별 초기값

| mode | 입력값 | 결재선 | 첨부 | 본문 | footer |
|------|--------|--------|------|------|--------|
| new | prefill(작성자 = 내 이름, 작성일 = 오늘 KST) | 양식 기본 결재선 자동 채움(AC-05) | 빈 값 | `content_default` | 임시저장 + 보내기 |
| draft | draft payload | draft payload | draft의 staged 첨부 | draft | 임시저장(같은 draft PUT) + 보내기 |
| duplicate | 원본 값 + 작성일 오늘 + 작성자 = 내 이름 | 원본 결재선·참조자 | **빈 값** | 원본 | 임시저장 + 보내기 |
| edit | 문서 현재 값 | **읽기 전용 보기**(변경은 별도 메뉴) | 현재 첨부(추가·제거 가능) | 현재 | 「저장」만 |

- **닫기 가드(AC-34)**: dirty = 폼 dirty OR 첨부 1개 이상 OR 편집기 변경 OR 결재선이 초기값과 다름. dirty면 `AlertModal` 제목 「작성을 그만둘까요?」, 설명 「임시저장하지 않은 내용은 사라집니다.」, 확인 「나가기」, 취소 「계속 작성」을 띄운다. 「계속 작성」은 모달만 닫는다(입력 유지). 수정 모드 설명은 「저장하지 않은 수정 내용은 사라집니다.」이다.
- **보내기 성공(AC-12)**: toast 「문서를 보냈습니다.」 → Dialog 닫기 → `form.reset` → `workflowKeys.all` invalidate(새로고침 없이 목록 반영). **임시저장 성공**: toast 「임시저장했습니다.」, Dialog는 열어 둔다(flex 동작 미확인 `[INFERRED]` — 계속 작성할 수 있게 유지). 첫 저장 후에는 draftId를 기억해 다음 임시저장은 PUT으로 보낸다.
- **첨부 업로드 중 보내기**: 업로드가 진행 중이면 「보내기」를 `disabled`하고 라벨을 「첨부 업로드 중…」으로 바꾼다(이유를 표시).

### 4.3 동적 입력칸 `WorkflowDynamicField` — 행 구조

```
div  testid workflow-field-{field_key}  data-invalid={hasError}  role='group' aria-labelledby={labelId}
  className: md↑ grid grid-cols-[11rem_minmax(0,1fr)] items-start gap-x-6 / 모바일 flex flex-col gap-1.5
  ├── FieldLabel id={labelId} htmlFor={controlId}  (min-h-9 flex items-center gap-2 text-sm text-muted-foreground)
  │     ├── 타입 아이콘(aria-hidden, size-4)
  │     ├── 필드 이름 (text-foreground)
  │     └── {required && <span testid workflow-field-required-{field_key}
  │                         className='inline-block size-1.5 rounded-full bg-destructive'>
  │                         <span className='sr-only'>필수</span></span>}
  └── div.min-w-0
        ├── 위젯(아래 표) — aria-required={required} aria-invalid={hasError} aria-describedby={errorId}
        └── {hasError && <FieldError id={errorId} testid workflow-field-error-{field_key}>{message}</FieldError>}
```

- `required = isFieldRequired(field, values)`(공유 `lib/required-rules.ts`). 행 컴포넌트는 `useStore(form.store, s => s.values)` 중 **`required_when.field_key`가 가리키는 값만** 구독한다(리렌더 최소화).
- **위젯 기본 톤(flex 미니멀)**: 입력 위젯에 className 확장 `border-transparent bg-transparent shadow-none hover:bg-muted/50 focus-visible:border-ring` → 평소에는 표처럼 보이고 hover·focus 때 입력칸임이 보인다. `aria-invalid`면 shadcn 기본 destructive border가 나온다. `components/ui` 수정 없이 className만 넘긴다.

### 4.4 타입별 위젯 매핑

| type | 위젯 | placeholder · 표시 | 값 형식(폼 → API) | e2e 조작 |
|------|------|--------------------|-------------------|-----------|
| **STRING** | `Textarea` 1줄 auto-grow (`rows={1}` `field-sizing-content min-h-9 resize-none`) — 긴 사유도 줄바꿈 | 「내용을 입력해 주세요.」(flex 문구) | trim 전 문자열 | `getByTestId('workflow-field-x').getByRole('textbox')` |
| **DATE** | `Popover` + `Button variant='ghost'`(trigger, `Icons.calendar` 오른쪽) + `Calendar mode='single'` (ko locale, 오늘 강조) + 선택 필드는 「지우기」 버튼 | 값 `yyyy-MM-dd` / 빈 값 「날짜를 입력해 주세요.」 | `'yyyy-MM-dd'` (KST) | trigger 클릭 → `getByRole('gridcell')` |
| **SELECT** | shadcn `Select`. trigger는 ghost 톤, 선택 값은 **칩**(`Badge variant='secondary'`)으로 표시(flex `08-compose-form`) | 「옵션을 선택해 주세요.」 | 옵션 문자열 | `getByRole('combobox')` → `getByRole('option',{name})` |
| **MULTISELECT** (seed 미사용) | `Popover` + `Command` 체크 다중(support 상태 필터 패턴), 선택값 칩 나열 + 칩 X | 「옵션을 선택해 주세요.」 | `string[]` → API는 JSON 배열 문자열 | — |
| **AMOUNT_OF_MONEY** | `InputGroup` + `InputGroupInput`(`inputMode='numeric'`, `autoComplete='off'`) + `InputGroupAddon align='inline-end'` 「원」 | 「금액을 입력해 주세요.」 · 입력하면 천 단위 콤마(`Intl.NumberFormat('ko-KR')`), 숫자 외 문자는 제거, 붙여넣기 허용 | 콤마 제거 정수 문자열 | `getByRole('textbox')` fill('194840') |
| **TASK_REFERENCE** | 선택된 카드 목록(`WorkflowReferenceCard` + 제거 X) + `Button variant='ghost'` 「문서를 추가해 주세요.」 → §4.6 Dialog | 비었을 때 버튼 문구가 placeholder 역할 | `string[]`(document ids) | 버튼 → `workflow-reference-picker` |

- 금액 검증 문구(공유 모듈): 「금액은 0보다 큰 숫자로 입력해 주세요.」. SELECT에 없는 값: 「{필드 이름} 값이 올바르지 않습니다.」
- prefill된 「작성자」·「작성일」도 수정할 수 있는 일반 위젯이다(flex 동일).

### 4.5 조건부 필수 동작 (핵심 · AC-08~11)

| 시점 | 동작 |
|------|------|
| 첫 렌더 (요청 유형 없음) | 빨간 점 6칸: request_type · writer_name · written_date · brand · amount · purchase_reason. 첨부 점 **없음** |
| 요청 유형 = 「입, 출금 요청」 | **같은 렌더에서** 점 8칸(+ vendor_account_holder · bank_account) + 첨부 점(`workflow-attachment-required`) |
| 요청 유형 = 「구매 요청」 | 점 10칸(공통 6 + item_quantity · delivery_address · recipient · link_url) + 첨부 점. vendor·bank 점 제거 |
| 칸 숨김 | **0건**. 모든 칸은 항상 보인다 |
| 제출 실패 | 공유 검증 결과를 각 칸 `FieldError`에 표시하고, 첨부 오류는 `workflow-attachment-error`에, 결재선 오류는 결재선 섹션에 표시. `onSubmitInvalid: scrollToFirstError` → 첫 `data-invalid='true'` 칸으로 스크롤 + 포커스. POST 0건 |
| 요청 유형 변경 후(오류가 떠 있는 상태) | **지금 오류가 있는 칸만 다시 검증**한다. 필수에서 빠진 칸의 오류는 즉시 사라진다(AC-11). 새로 필수가 된 빈 칸은 다음 제출 때 표시한다(입력 전부터 빨간 문구가 쏟아지지 않게) |
| 입력 중 | 오류가 있는 칸은 onChange로 다시 검증해 고치면 바로 사라진다. 처음 입력하는 칸은 blur·submit 때 검증 |

- 오류 문구는 서버와 **같은 함수·같은 문자열**을 쓴다(「{필드 이름} 항목을 입력해 주세요.」, 「첨부파일을 1개 이상 올려 주세요.」, 「승인자를 1명 이상 지정해 주세요.」).
- 가이드 마지막 줄 문구(plan): 「요청 유형을 고르면 필요한 칸에 빨간 점이 표시돼요. 필수가 아닌 칸은 비워 두셔도 됩니다.」

### 4.6 참조문서 선택 Dialog `WorkflowReferencePickerDialog` (testid `workflow-reference-picker`)

- 기본 `Dialog`(작성 Dialog 위에 중첩, `sm:max-w-lg`. 모바일은 `DialogContent` className으로 `max-h-[85dvh]`). 「모달 안 모달」이지만 plan이 Dialog로 지정했고, 범위가 작은 선택 작업이라 허용한다.
- 검색 `Input` 「문서번호·내용 검색…」(debounce 300ms) → `GET /api/workflow/documents?tab=all&q=`(RLS → **내가 열람할 수 있는 문서만**). 수정 모드에서는 자기 자신을 제외한다.
- 결과 행: `Checkbox` + 이모지 + 양식명 + `font-mono` code + 작성자 + 상태 뱃지. 다중 선택. 행 전체가 label 히트 영역이다.
- footer: 「취소」 · 「선택 완료 ({n})」. 결과 없음: 「검색 결과가 없습니다.」. 로딩: `compact`.

### 4.7 첨부 `WorkflowAttachmentField` (mode='edit')

```
div testid workflow-field-attachments(선택)  data-invalid
  라벨 행: Icons.paperclip · 「첨부파일」 · {attachmentRequired && <span testid workflow-attachment-required … 빨간 점/>}
  dropzone (react-dropzone, multiple)  testid workflow-attachments-dropzone
     role='button' tabIndex=0  aria-label='첨부파일 추가'
     문구 「파일 추가 혹은 여기로 드래그 (20MB 이하, 최대 30개)」(flex 문구)  · drag-over: border-primary bg-primary/5
     className: rounded-lg border border-dashed p-4 text-sm text-muted-foreground min-h-11
  <p testid workflow-attachment-error role='alert'>  ← 마지막 오류 1개 (크기·개수·필수·업로드 실패)
  ul (grid gap-2)
     li testid workflow-attachment-{id}: 파일 아이콘 · 파일명(break-all) · 크기 · 상태(업로드 중 Spinner / 실패 「다시 시도」) · 삭제 X(aria-label '{파일명} 삭제')
```
- 클라이언트 사전 검증(AC-40): 20MB를 넘으면 「파일당 20MB 이하만 올릴 수 있습니다.」, 합계가 30개를 넘으면 「첨부파일은 최대 30개까지 올릴 수 있습니다.」 → 해당 파일은 업로드하지 않는다. 문구는 `workflow-attachment-error`에 표시한다(toast 중복 없음).
- 업로드: 파일마다 prepare → PUT(signed) → complete(plan 53). 진행 중에는 행에 `Spinner`(진행률 바는 Out — 계약 첨부와 동일 수준).
- **삭제 확인**: 업로드가 끝난(staged·bound) 첨부를 제거할 때 `AlertModal` 제목 「첨부파일 삭제」, 설명 「"{파일명}" 파일을 삭제합니다.」, 확인 「삭제」(plan 14 · plan §선행 14 「첨부 제거」). 업로드에 실패한 행 제거는 확인 없이 한다.
- 편집기 이미지 삽입은 없다 → 이미지는 여기에 올린다.

### 4.8 본문 편집기 `WorkflowRichTextEditor` (testid `workflow-editor` = 래퍼)

- Tiptap: StarterKit + Underline + TextAlign(left·center·right) + Table(+row/cell/header) + Link(autolink, `http(s)`·`mailto`만) + TextStyle(fontSize 커스텀 mark). 이미지 extension **없음**.
- 래퍼: `rounded-lg border focus-within:ring-2 focus-within:ring-ring/50`.
- 툴바: `div role='toolbar' aria-label='본문 서식'`, `sticky top-0 bg-background border-b`, **한 줄 `overflow-x-auto`**(모바일에서 줄바꿈 금지, 페이지 가로 스크롤 0). 그룹 사이는 `Separator orientation='vertical'`.

| 그룹 | 컨트롤 | aria-label |
|------|--------|-----------|
| 서식 | `Toggle size='sm'` ×4 (bold·italic·underline·strikethrough) `aria-pressed` | 굵게(⌘B) · 기울임(⌘I) · 밑줄(⌘U) · 취소선 |
| 글자 크기 | `Select` (h-8, w-20): 12px · **14px(기본)** · 18px | 글자 크기 |
| 목록 | `Toggle` ×2 (list · listNumbers) | 글머리 목록 · 번호 목록 |
| 정렬 | `ToggleGroup type='single' size='sm'` (alignLeft·alignCenter·alignRight) | 왼쪽 정렬 · 가운데 정렬 · 오른쪽 정렬 |
| 삽입 | 표 `Button ghost icon`(3×3, 헤더 행 포함) · 링크 `Popover`(URL Input `type='url'` + 「적용」·「링크 제거」) | 표 삽입 · 링크 |
| 기록 | `Button ghost icon` ×2 (undo·redo, 불가하면 disabled) | 실행 취소 · 다시 실행 |

- 본문 영역: `min-h-60 px-4 py-3` + 공유 rich content 클래스, placeholder 「내용을 입력하세요」(flex). 모바일 툴바 버튼은 `size-9`.
- 붙여넣기는 Tiptap schema로 정리하고, 서버가 최종 정화한다.

### 4.9 작성 폼 상태별 UI

| 상태 | UI |
|------|----|
| 양식 불러오기 | main 자리 `compact`, footer 버튼 disabled |
| 보내기·저장 중 | 제출 버튼 `isLoading`(나머지 버튼 disabled) |
| 서버 400 | 메시지가 필드 문구와 같으면 해당 칸 FieldError에 매핑하고(필드 이름 일치), 아니면 toast `notifyError` |
| 첨부 업로드 실패 | 행에 「업로드 실패 · 다시 시도」 + `workflow-attachment-error` |

---

## 5. 결재선

### 5.1 편집 `WorkflowApprovalLineEditor` (testid `workflow-approval-line`)

`mode: 'compose' | 'change' | 'policy'` — 작성 폼·결재선 변경 Dialog·설정 화면이 **같은 컴포넌트**를 쓴다.

```
h3 「승인 · 참조」 (compose·change만. policy에서는 섹션 제목이 대신함)
section testid workflow-referrers
  header: 「참조」 ─────── Separator ─────── [+] (Button ghost icon size-8, aria-label '참조자 추가', testid workflow-referrer-add)
           └ + → WorkflowMemberCombobox (이미 참조자인 사람 제외)
  row (h-12): Avatar32 · 이름 / 소속·직급
       · 알림 DropdownMenu trigger testid workflow-referrer-notify-{user_id}
           pill Button(variant='outline' size='sm' rounded-full h-7): Icons.notification + 라벨 + chevronDown
           라벨: START_AND_END 「알림」 · END 「완료 알림」 · NONE 「알림 없음」
           메뉴: DropdownMenuLabel 「알림 설정」 / RadioGroup:
                「승인 요청, 완료 시 알림」(START_AND_END) · 「승인 완료 시 알림」(END) · 「알림 없음」(NONE)
                / Separator / 안내 행(비활성 텍스트, Icons.info) 「댓글 알림은 설정과 관계없이 수신돼요.」
       · 제거 X (Button ghost icon size-8, aria-label '{이름} 참조 해제')
  참조자 0명: 「참조자가 없습니다.」(muted xs)
section testid workflow-step-{n}   (n = 1..N)
  header: 「{n} 단계 승인」 ─── Separator ─── [+] testid workflow-step-{n}-add (aria-label '{n}단계 승인자 추가')
                                            [🗑] (aria-label '{n}단계 삭제') ← 단계 2개 이상이거나 policy일 때
  row testid workflow-actor-{n}-{user_id}: Avatar32 · 이름 / 소속 · Badge 「승인」(secondary·rounded-full, 유형 1개뿐이라 고정 표시) · 제거 X
  빈 단계: 점선 박스 「승인자를 추가해 주세요.」 (누르면 + 와 같은 동작)
Button variant='secondary' className='w-full h-11' 「＋ 승인 단계 추가하기」 testid workflow-step-add
오류 <p role='alert' data-invalid>: 「승인자를 1명 이상 지정해 주세요.」 / 「승인자가 없는 단계가 있습니다.」 / 「같은 승인자를 여러 번 지정할 수 없습니다.」
```
- 단계를 삭제하면 뒤 단계 번호를 당긴다(testid `step-{n}`도 다시 매김).
- 승인자 Combobox 제외·비활성 규칙: **작성자 본인**(compose·change)은 「작성자」 표시와 함께 disabled, **이미 다른 단계 승인자인 사람**은 「이미 지정됨」 표시와 함께 disabled(문서 전체 1회 규칙). 참조자와 겹치는 것은 허용한다(plan).
- compose 기본값: 양식 기본 결재선. 기본 결재선의 사람이 작성자 본인이면 그 사람만 빼고 채운다(서버 400 예방). 이때 해당 단계가 비게 되면 빈 단계로 남겨 사용자가 고치게 한다.
- 승인 유형 드롭다운(flex `10-approver-type-menu`)은 선택지가 1개뿐이라 **고정 Badge로 대체**한다(plan).

### 5.2 구성원 선택 `WorkflowMemberCombobox`

- `Popover` + `Command`(`shouldFilter`, 클라이언트 필터 — 구성원 수가 적고 `GET /api/workflow/members`를 한 번 캐시). `CommandInput` placeholder 「이름 검색…」.
- 항목: `Avatar` 24 + 이름 + 소속·직급(muted xs). 비활성 항목은 `disabled` + 사유 텍스트. 빈 결과: 「구성원을 찾을 수 없습니다.」. 로딩: `compact`.
- 모바일에서는 Popover 폭을 `w-[min(20rem,calc(100vw-2rem))]`로 하고, 항목 높이는 44px 이상.

### 5.3 결재선 변경 Dialog `WorkflowApprovalLineDialog` (상세 `···` → 승인·참조 변경)

- 기본 `Dialog`(`sm:max-w-lg`, 모바일 `max-h-[90dvh]`): header 「승인·참조 변경」 + 설명 「완료된 단계는 바꿀 수 없어요.」 → 스크롤 본문에 Editor `mode='change'` → footer 「취소」 · 「저장」(isLoading).
- change 모드 제한(서버 규칙을 화면에 반영):
  - **APPROVED 단계**: 헤더 「{n} 단계 완료」(muted) + `Icons.lock`, +·🗑·X 렌더링 0, 사람은 「✓ 승인」 Badge.
  - **ONGOING 단계에서 이미 승인한 사람**: X 없음 + 「✓ 승인」 Badge.
- 성공 toast 「승인·참조자를 변경했습니다.」 → 상세 invalidate(타임라인 diff, 뱃지 분모 갱신). 409·400은 toast로 서버 문구를 그대로 보여 준다.

---

## 6. 워크플로우 설정 `/dashboard/workflow/settings` (testid `workflow-settings-page`)

```text
╭─ /dashboard/workflow/settings (1280) ────────────────────────────────────────────╮
│ 워크플로우 설정                                                                    │
│ 워크플로우 관리자와 양식별 기본 결재선을 관리합니다.                                   │
│ ┌ 워크플로우 관리자 (시스템 관리자에게만) ─────────────────── [＋ 관리자 추가] ┐      │
│ │ 시스템 관리자는 따로 지정하지 않아도 워크플로우 관리자 권한을 가집니다.        │      │
│ │ (김) 김웨이크  웨이크 · 팀장                                    [해제]     │      │
│ └───────────────────────────────────────────────────────────────────────────┘      │
│ ┌ 양식 기본 결재선 ────────────────────────────────────────────────────────┐        │
│ │ 문서를 작성할 때 자동으로 채워지는 승인 단계와 참조자입니다.                │        │
│ │ ┌ 📄 지출결의서 ───────────────────────────────────────────────────┐      │        │
│ │ │ (WorkflowApprovalLineEditor mode='policy')                         │      │        │
│ │ │ [■] 작성자가 결재선을 변경할 수 있어요                              │      │        │
│ │ │                                                         [저장]     │      │        │
│ │ └────────────────────────────────────────────────────────────────────┘      │        │
│ └───────────────────────────────────────────────────────────────────────────┘        │
╰──────────────────────────────────────────────────────────────────────────────────────╯
```

```
page.tsx (server): requireWorkflowAdminPage() (미권한 → /dashboard/workflow redirect + 접근 거부 flash)
  PageContainer pageTitle='워크플로우 설정' pageDescription='워크플로우 관리자와 양식별 기본 결재선을 관리합니다.'
    div testid workflow-settings-page  className='flex max-w-3xl flex-col gap-6'
      {isSystemAdmin && <WorkflowAdminsCard/>}           ← testid workflow-admins
      <WorkflowTemplatePoliciesCard/>
         └── WorkflowTemplatePolicySection × 양식      ← testid workflow-template-policy-{template_key}
```

| 영역 | 구성 |
|------|------|
| **WorkflowAdminsCard** (`Card`) | `CardHeader`: 제목 「워크플로우 관리자」, 설명 「시스템 관리자는 따로 지정하지 않아도 워크플로우 관리자 권한을 가집니다.」, `CardAction`: `WorkflowMemberCombobox` trigger `Button size='sm'` 「관리자 추가」(Icons.add) testid `workflow-admin-add` (이미 관리자인 사람과 시스템 관리자는 disabled). 선택하면 바로 POST → toast 「워크플로우 관리자를 지정했습니다.」. `CardContent`: 행(아바타 + 이름 + 소속 + 지정일 `formatAbsoluteDateKo`) + `Button variant='outline' size='sm'` 「해제」 testid `workflow-admin-remove-{user_id}` → `AlertModal` 제목 「워크플로우 관리자 해제」, 설명 「{이름}님의 워크플로우 관리자 권한을 해제합니다.」, 확인 「해제」 → toast 「워크플로우 관리자를 해제했습니다.」. 빈 상태: 「지정된 워크플로우 관리자가 없습니다.」 |
| **WorkflowTemplatePoliciesCard** (`Card`) | 제목 「양식 기본 결재선」, 설명 「문서를 작성할 때 자동으로 채워지는 승인 단계와 참조자입니다.」 |
| **WorkflowTemplatePolicySection** | `rounded-lg border p-4` · 제목 「📄 지출결의서」(h3) · Editor `mode='policy'`(작성자 제외 규칙 없음, **단계 0개 허용**, 빈 단계는 저장 시 오류) · `Switch` + Label 「작성자가 결재선을 변경할 수 있어요」(`approval_step_edit_enabled`, 폼 안 Switch → 저장 버튼으로 반영) · 오른쪽 아래 `Button` 「저장」 testid `workflow-policy-save` isLoading. 성공 toast 「기본 결재선이 저장되었습니다.」(AC-05). 400은 섹션 위 `Alert variant='destructive'`에 서버 문구로 표시 |

- 워크플로우 관리자(시스템 관리자 아님)는 `workflow-admins`가 **DOM에 없다**(AC-04).
- 로딩: `settings/loading.tsx` = PageContainer + `fill`. 카드별 데이터는 Suspense `fill`.
- 모바일: 카드 1열, CardAction은 제목 아래로 내려간다(shadcn Card 기본), 버튼 h-11.
- 양식이 여러 개가 되면 `workflow-policy-save`는 섹션 안에서 찾는다(지금은 1개).

---

## 7. 인쇄 `/workflow-print/[id]` (testid `workflow-print-page`)

```
app/workflow-print/[id]/page.tsx (server)
  requireDashboardSession (비로그인 → /auth/sign-in) · RLS 조회 · Presence track 금지
  ├── 없음/권한 없음 → <main className='grid min-h-dvh place-items-center'> 「문서를 찾을 수 없거나 열람 권한이 없습니다.」 (print 호출 0)
  └── <main testid workflow-print-page className='mx-auto w-full max-w-[210mm] bg-background p-6 text-foreground print:p-0 print:bg-white print:text-black'>
        ├── 화면 전용 툴바 (print:hidden): 「인쇄」 Button · 「닫기」(window.close)
        ├── header: h1 「지출결의서」 · 「문서번호 2026-0003」 · 「작성자 김웨이크 · 작성 2026-10-21 (화) 13:53:00」 · 상태 텍스트 「진행중 1/2」(뱃지 대신 테두리 박스 텍스트 — 흑백에서도 읽힘)
        ├── 결재선 table: 단계 | 승인자 | 상태(대기중/승인/반려) | 처리 일시   + 아래 줄 「참조: 이름, 이름」
        ├── 필드 table: th(필드명, 30%, bg-muted print:bg-transparent) | td(값, 금액 「n,nnn 원」, SELECT는 텍스트)
        ├── 첨부파일: 파일명 목록(텍스트만)
        ├── 본문: 공유 rich content 클래스
        └── <WorkflowPrintTrigger/> (client) — 마운트 후 1회 window.print() (useRef 가드, StrictMode 중복 방지)
```
- `@page { size: A4; margin: 15mm; }` + table·tr `break-inside: avoid`(page 안의 `<style>`). 표 테두리는 `border-border print:border-black/40`. 색에만 의존하는 정보는 0건(상태는 텍스트로).
- 긴 값은 `break-words`, 표는 `table-fixed w-full`(잘림 방지, AC-49).

---

## 8. 로딩 상태 명세 (plan 26 · 40)

| 위치 | 방식 | variant |
|------|------|---------|
| `app/dashboard/workflow/loading.tsx` | PageContainer(title·description) + spinner | `fill` |
| 문서함 본문(탭·필터 변경) | `Suspense key={querySignature}` — 툴바·탭·작성 버튼은 밖 | `fill` |
| 그룹·목록 「더보기」 | Button `isLoading` | — |
| 탭 건수 | non-suspense `useQuery`, 로딩 중 숫자 생략 | — |
| 필터 Popover(작성자·양식) 목록 | Popover 안 Suspense | `compact` |
| 상세 패널 본문 | 패널 안 Suspense(header 밖) | `compact` |
| 양식 선택 Dialog | Dialog 안 Suspense | `compact` |
| 작성 Dialog 양식·draft·복제 로드 | main 자리 Suspense | `compact` |
| 참조문서 선택 Dialog · 구성원 Combobox | 내부 Suspense | `compact` |
| `settings/loading.tsx` · 설정 카드 | PageContainer + spinner / 카드 Suspense | `fill` |
| 모든 CUD 버튼 | Button `isLoading` / `isPending` | — |

skeleton·`DataTableSkeleton`·overlay spinner **0건**.

---

## 9. 컴포넌트 목록

### 9.1 shadcn (전부 설치됨 · 신규 add **0건**)

`dialog`(Portal·Overlay·Primitive 조합) · `tabs` · `toggle-group` · `toggle` · `popover` · `command` · `dropdown-menu` · `select` · `calendar` · `input` · `input-group` · `textarea` · `field`/`form-context`(`FieldLabel`·`FieldError`·`scrollToFirstError`) · `tanstack-form`(`useAppForm`) · `button` · `badge` · `avatar` · `separator` · `collapsible` · `checkbox` · `switch` · `card` · `alert` · `tooltip` · `spinner`/`page-loading-spinner` · `sonner`(notify) · `modal/alert-modal`.

### 9.2 Icons 레지스트리에 추가할 키 (`src/components/icons.tsx` — tabler 이름은 v3.40에 있는 것을 확인함)

| 키 | tabler | 용도 |
|----|--------|------|
| `star` / `starFilled` | IconStar / IconStarFilled | 중요 |
| `currencyWon` | IconCurrencyWon | 금액 필드 |
| `link` | IconLink | 참조문서, 편집기 링크 |
| `list` / `listNumbers` | IconList / IconListNumbers | 편집기, MULTISELECT |
| `strikethrough` | IconStrikethrough | 편집기 |
| `alignLeft` / `alignCenter` / `alignRight` | IconAlignLeft/Center/Right | 편집기 |
| `table` | IconTable | 편집기 |
| `undo` / `redo` | IconArrowBackUp / IconArrowForwardUp | 편집기 |
| `printer` | IconPrinter | PDF 인쇄 |
| `copy` | IconCopy | 복제하기 |
| `refresh` | IconRefresh | 결재선 변경, 타임라인 |
| `ban` | IconBan | 반려 |

(기존 키 재사용: `clipboardText`·`settings`·`edit`·`circleCheck`·`circleX`·`calendar`·`text`·`paperclip`·`notification`·`moreHorizontal`·`close`·`add`·`trash`·`lock`·`info`·`alertCircle`·`download`·`search`·`check`·`chevronDown`·`fileTypePdf`·`media`·`page`)

### 9.3 신규 feature 컴포넌트 (`src/features/workflow/components/`)

| 파일 | 역할 |
|------|------|
| `workflow-page.tsx` | 문서함 client 셸(툴바 + Suspense 본문 + 패널·Dialog 마운트) |
| `workflow-compose-context.tsx` | 작성 Dialog 열기 상태(mode·templateKey·draftId·documentId) |
| `workflow-compose-button.tsx` | 「문서 작성하기」 → 양식 선택 열기 |
| `workflow-inbox-toolbar.tsx` | 탭·검색·정렬·범위·필터·건수·초기화 + `useWorkflowListParams`(nuqs) |
| `workflow-scope-toggle.tsx` · `workflow-writer-filter.tsx` · `workflow-template-filter.tsx` · `workflow-updated-filter.tsx` · `workflow-sort-menu.tsx` | 툴바 하위 |
| `workflow-inbox-body.tsx` · `workflow-list-group.tsx` · `workflow-list-row.tsx` · `workflow-list-error-boundary.tsx` | 목록 |
| `workflow-status-badge.tsx` · `approver-avatar-stack.tsx` · `workflow-person-row.tsx` | 공통 표시 |
| `workflow-detail-panel.tsx` · `workflow-detail-heading.tsx` · `workflow-detail-more-menu.tsx` · `workflow-star-toggle.tsx` | 상세 |
| `workflow-timeline.tsx` · `workflow-comment-form.tsx` | 타임라인·댓글 |
| `workflow-field-table.tsx` · `workflow-reference-card.tsx` · `workflow-rich-content.tsx` | 상세 본문 |
| `workflow-attachment-list.tsx`(view) · `workflow-attachment-field.tsx`(edit) | 첨부 |
| `workflow-approval-line-view.tsx` · `workflow-approval-line-editor.tsx` · `workflow-approval-line-dialog.tsx` · `workflow-member-combobox.tsx` | 결재선 |
| `workflow-approve-dialog.tsx` · `workflow-decline-dialog.tsx` | 처리 |
| `workflow-template-picker-dialog.tsx` | 양식 선택 + 이어쓰기 |
| `workflow-compose-dialog.tsx` · `workflow-dynamic-field.tsx` · `workflow-field-widgets.tsx`(타입별 위젯) · `workflow-reference-picker-dialog.tsx` · `workflow-rich-text-editor.tsx` | 작성 |
| `workflow-settings-page.tsx` · `workflow-admins-card.tsx` · `workflow-template-policy-section.tsx` | 설정 |
| `workflow-print-view.tsx` · `workflow-print-trigger.tsx` | 인쇄 |

`lib/`: `required-rules.ts`(공유 판정·문구) · `summary.ts` · `rich-content-class.ts` · `format-amount.ts`(`n,nnn 원`, `₩n,nnn`).

### 9.4 기존 재사용

- `AlertModal` @ `src/components/modal/alert-modal.tsx` (취소·임시저장 삭제·첨부 삭제·관리자 해제·작성 중단)
- `PageLoadingSpinner` @ `src/components/ui/page-loading-spinner.tsx`
- `openAttachmentLightbox` @ `src/features/attachments/components/attachment-lightbox-provider.tsx` (§3.7 확장 필요)
- `scrollToFirstError` · `useAppForm` @ `src/components/ui/tanstack-form.tsx`
- `formatAbsoluteDateTimeKo` @ `src/lib/format-datetime.ts` · `formatAbsoluteDateKo` @ `src/lib/format-date.ts` · `formatBytes` @ `src/lib/utils`
- `AFFILIATION_OPTIONS` @ `src/features/users/constants/organization.ts` (소속 라벨)
- 패턴: `support-page.tsx`(nuqs 상세 deep link), `support-list-filters.tsx`(Popover+Command 다중), `support-status-badge.tsx`(뱃지 색), `quick-request-address-picker-dialog.tsx`(반응형 전체 화면 Dialog), `quick-request-query-boundary.tsx`(에러 + 다시 시도), `quick-request-mobile-summary-bar.tsx`(safe-area footer), `notification-infinite-list.tsx`(`view-*` 이동), `announcement-attachment-list.tsx`(다운로드·lightbox·삭제 AlertModal)

---

## 10. testid 매핑 (plan 표 100% 반영)

| testid | 붙는 요소 |
|--------|-----------|
| `workflow-page` | 문서함 client 셸 루트 div |
| `workflow-compose-button` | PageContainer 헤더 「문서 작성하기」 Button |
| `workflow-scope-related` · `-mine` · `-company` | ToggleGroupItem (company는 관리자만 렌더링) |
| `workflow-search-input` | 검색 Input |
| `workflow-filter-writer` · `-template` · `-updated` | 각 필터 Popover trigger Button |
| `workflow-sort` | 정렬 DropdownMenu trigger |
| `workflow-reset` | 초기화 Button |
| `workflow-group-approval-required` · `workflow-group-in-progress` | 그룹 컨테이너(section) |
| `workflow-row-{code}` | 행 Button |
| `workflow-load-more` | 그룹/목록별 「더보기」 Button (그룹 안에서 scope해서 찾음) |
| 탭 | `getByRole('tab',{name:'진행중'\|'완료'\|'중요'\|'전체'})` — 건수는 aria-hidden |
| `workflow-template-picker` | 양식 선택 Dialog Content |
| `workflow-template-search` | 양식 검색 Input |
| `workflow-template-option-{template_key}` | 양식 행 Button (`expense`) |
| `workflow-draft-list` | 이어서 작성하기 섹션 |
| `workflow-draft-{id}` | 임시저장 행(본문 Button) |
| `workflow-draft-delete-{id}` | 임시저장 X Button |
| `workflow-compose-form` | `<form>` |
| `workflow-guide` | 작성 가이드 블록 |
| `workflow-field-{field_key}` | 필드 행 래퍼(div, data-invalid) |
| `workflow-field-required-{field_key}` | 빨간 점(필수일 때만 렌더링) |
| `workflow-field-error-{field_key}` | FieldError |
| `workflow-attachments-dropzone` | dropzone |
| `workflow-attachment-required` | 첨부 빨간 점 |
| `workflow-attachment-error` | 첨부 오류 p |
| `workflow-attachment-{id}` | 첨부 행(작성) / 첨부 카드(상세) |
| `workflow-editor` | 편집기 래퍼 |
| `workflow-reference-picker` | 참조문서 선택 Dialog Content |
| `workflow-submit` | 보내기(수정 모드 「저장」) |
| `workflow-save-draft` | 임시저장 |
| `workflow-compose-close` | 작성 Dialog 닫기 |
| `workflow-approval-line` | 결재선 편집기 루트 |
| `workflow-referrers` | 참조 섹션 |
| `workflow-referrer-add` | 참조 + |
| `workflow-referrer-notify-{user_id}` | 알림 설정 trigger |
| `workflow-step-{n}` | 단계 섹션 |
| `workflow-step-{n}-add` | 단계 + |
| `workflow-step-add` | 「승인 단계 추가하기」 |
| `workflow-actor-{step}-{user_id}` | 승인자 행 |
| `workflow-detail` | 상세 Dialog Content |
| `workflow-detail-status` | 상세 상태 뱃지 래퍼 |
| `workflow-detail-code` | 문서번호 span |
| `workflow-timeline` / `workflow-timeline-item` | ol / li |
| `workflow-comment-input` / `workflow-comment-submit` | 댓글 Textarea / 등록 |
| `workflow-approve` / `workflow-decline` | footer 승인 / 반려 |
| `workflow-star` | 중요 Toggle |
| `workflow-more-menu` | `···` trigger |
| `workflow-detail-close` | 상세 닫기 |
| `workflow-reference-card-{code}` | 참조문서 카드 |
| `workflow-settings-page` | 설정 루트 |
| `workflow-admins` | 관리자 Card |
| `workflow-admin-add` | 관리자 추가 trigger |
| `workflow-admin-remove-{user_id}` | 해제 Button |
| `workflow-template-policy-{template_key}` | 양식 정책 섹션 |
| `workflow-policy-save` | 저장 Button |
| `workflow-print-page` | 인쇄 main |

참고: 상세 패널이 열려 있으면 결재선 **보기**(§3.9)에는 편집용 testid(`workflow-step-*`)를 붙이지 않는다(작성 폼·변경 Dialog와 중복 방지).

---

## 11. Activity log UI 변경 여부

- **신규 페이지·컴포넌트 변경 0건.** 기존 `/dashboard/logs` · `ActivityLogsTable` · plan 08 행 확장(B 패턴)을 그대로 쓴다. `labels.ts`에 15 action 한국어 라벨과 target_type 5종 라벨만 추가하면 된다(plan 표 문구).
- admin 필터는 기존 `actor_search` Input이다. workflow 전용 Combobox는 Out이다.
- metadata 확장 행에는 allowlist 키(`document_id`·`document_code`·`template_key`·`step`·`starred`·`changed_field_keys`·`attachment_count`·`error_code`)만 보인다.

---

## 12. 품질 검토 (Step 5 · web-design-guidelines + designer 체크리스트)

**접근성**
- [x] 시맨틱: 목록 행 = button, 타임라인 = ol/li, 필드 표 = dl, 설정 = Card section + h3, 인쇄 = table.
- [x] 아이콘 버튼은 모두 `aria-label`(닫기·더 보기·중요 표시·참조자 추가·n단계 승인자 추가·삭제·편집기 툴바). 장식 아이콘은 `aria-hidden`.
- [x] 필수: 빨간 점에 sr-only 「필수」 + 컨트롤에 `aria-required`. 오류: `aria-invalid` + `aria-describedby` → FieldError. 제출 실패 시 첫 오류로 포커스(`scrollToFirstError`).
- [x] Dialog: 포커스 트랩, Esc(작성 중이면 가드), 닫힐 때 포커스 복귀, DialogTitle·Description 연결.
- [x] 별: `aria-pressed`. 편집기 Toggle: `aria-pressed`. 툴바 `role='toolbar'`. 건수 `aria-live='polite'`.
- [x] 색 대비: 뱃지는 기존 SupportStatusBadge와 같은 700/400 글자색(AA). 상태를 색만으로 전달하지 않는다(텍스트 라벨).

**UX**
- [x] 빈 상태(목록·그룹·참조자·첨부·임시저장·검색 결과·관리자), 로딩(`PageLoadingSpinner` §8), 에러(목록 Alert + 다시 시도, 상세 404 문구, mutation toast).
- [x] 파괴적 동작 확인: 문서 취소·임시저장 삭제·첨부 삭제·관리자 해제·작성 중단 = `AlertModal`. `window.confirm` 0.
- [x] 미저장 이탈 경고(AC-34).
- [x] URL이 UI 상태를 반영: tab·scope·q·writer·template·updated·sort·doc(nuqs). 상세 deep link·새로고침 유지.
- [x] 375px: 상세·작성 전체 화면, footer CTA 고정 h-11(44px) + safe-area, 툴바·탭·편집기 툴바 가로 스크롤은 컨테이너 안에서만(페이지 `scrollWidth <= clientWidth`), 표·본문 `overflow-x-auto`/`break-words`, flex 자식 `min-w-0`.
- [x] Dialog·패널 스크롤 영역 `overscroll-contain`.
- [x] 긴 내용: 요약 truncate/line-clamp, 파일명 break-all, 값 break-words.
- [x] 숫자: 금액·건수·시각 `tabular-nums`, 금액은 `Intl.NumberFormat('ko-KR')`.
- [x] autoFocus: 양식 검색 Input은 PC에서만.
- [x] 애니메이션: 패널 slide는 transform만, `motion-reduce:animate-none`.

**shadcn / Tailwind 컨벤션**
- [x] `cn()`만 사용. `Icons.*`만(§9.2 키 추가). `components/ui` 수정 0(조합·className 확장). `PageContainer` props로 헤더(Heading 직접 import 0). Tailwind v4 문법, hex 0, raw `<button`·`<label` 0(AC-47 — 행도 shadcn Button). 간격 4/8/12/16/24.

**알려진 타협 (기록)**
- 상세 상단 뱃지는 AC-17에 맞춰 `진행중 n/N`(flex는 「승인필요」)이다. 목록 행은 `승인 필요` 우선(AC-16).
- 참조문서 선택은 작성 Dialog 위 중첩 Dialog다(plan 지정). 결재선 변경·승인/반려 Dialog도 상세 패널 위 중첩이다(Radix 중첩 지원).
- 뱃지 노랑·파랑·초록은 테마 시맨틱 토큰이 없어 Tailwind 팔레트를 쓴다(기존 support 뱃지와 동일, hex 아님).
- 임시저장 후 Dialog 유지는 `[INFERRED]`(flex 화면에서 확인 못 함).

---

## 13. 팀 전달 요약 (Step 6)

### — /backend-dev 에게 —

화면이 바로 쓰도록 **서버가 계산해서 내려줘야 하는 값**:

1. **목록 `GET /api/workflow/documents`** 행: `id, code, status, current_step, total_steps, template{key,name,emoji}, writer{id,full_name,avatar_url}, written_at, updated_at, summary`(lib/summary.ts — 빈 값 제외, 「요청 유형: …」으로 시작, 문서번호 미포함), `attachment_count, approvers_preview[{user_id,full_name,avatar_url}](최대 3), approvers_total, my_state{approval_required, starred}`. 페이지 응답에 `total`(툴바 「n건」·그룹 제목), `next_cursor`. `group=approval_required|in_progress`일 때 해당 그룹 total.
2. **건수 `GET …/counts`**: `{in_progress, done, star, all}` — 현재 `scope`와 필터(q·writer·template·updated)를 **같이 반영**하는 것을 권장한다(툴바 건수와 일관).
3. **상세 `GET /api/workflow/documents/[id]`**: 문서 필드 + `template_snapshot.fields`(name·type·options·display_order) + `inputs` + 정화된 `content_html` + `attachments[{id,file_name,mime_type,size_bytes}]` + `references[{id,code,template_name,emoji,writer_name,status}]`(열람 가능분만) + `steps[{step,status,actors[{user_id,full_name,avatar_url,affiliation,position_level,status,acted_at}]}]` + `referrers[{user…, notification_setting}]` + `events[{id,type,actor{id,full_name,avatar_url},content,payload(diff 줄·changed_field_keys),created_at}]` + **`permissions{can_approve,can_edit,can_change_line,can_cancel,can_duplicate}`** + `starred`. 열람 불가는 404.
   - CHANGE 이벤트 `payload.diff`는 **표시용 줄 배열**(예: `[{step:2, before:[{name,type:'승인'}], after:[…]}]`, 참조 변경 포함)로 주면 클라이언트가 「2단계: A(승인) → B(승인)」, 「3단계: 없음 → C(승인)」를 그대로 만든다.
4. **구성원 `GET /api/workflow/members`**: `user_id, full_name, avatar_url, affiliation, position_level, email`(검색용).
5. **양식 `GET /api/workflow/templates`**: `template_key,name,emoji,tags,display_order`. **`[templateKey]`**: 필드 정의(`required`, `required_when`, `options`, `prefill_*`), `description`(가이드), `attachment_visible/required/required_when`, `content_visible/default`, `approval_step_edit_enabled`, 기본 결재선 `steps[{step, actors[member]}]`·`referrers[{member, notification_setting}]`(구성원 표시 정보 포함).
6. **임시저장 목록**: `id, template{key,name,emoji}, updated_at`. 상세: payload + staged 첨부 메타.
7. **관리자 `GET /api/workflow/admins`**: `user_id, full_name, avatar_url, affiliation, position_level, created_at`.
8. 오류 문구는 plan 문자열 그대로(클라이언트가 필드 이름 매칭으로 FieldError에 붙인다). 400 body `{ error: string, field_key?: string }`처럼 **`field_key`를 같이 주면** 매핑이 확실해진다(권장).
9. 첨부 lightbox용 다운로드 Route 응답은 `{ url }`(signed). 클라이언트가 blob으로 받는다.
10. activity log: 신규 15 action·5 target_type 라벨(`labels.ts`). **로그 UI 변경 없음.**

### — /frontend-dev 에게 —

- **페이지**: `src/app/dashboard/workflow/page.tsx`·`loading.tsx`, `settings/page.tsx`·`loading.tsx`, `src/app/workflow-print/[id]/page.tsx`.
- **구현 컴포넌트**: §9.3 목록 전체. 구조는 §2~§7, testid는 §10.
- **꼭 지킬 것**
  1. 상세·작성·양식 선택은 `DialogPortal`+`DialogOverlay`+`DialogPrimitive.Content` 조합(내장 X 없음). 반응형 2열 ↔ 1열은 스크롤 래퍼 `lg:contents` 기법으로 **DOM 한 벌**(testid 중복 0).
  2. footer CTA는 스크롤 밖에 두고 h-11 + `pb-[max(0.75rem,env(safe-area-inset-bottom))]`.
  3. 필수 점은 조건부 **렌더링**(숨김 금지). `isFieldRequired` 공유 함수를 쓰고 request_type만 구독한다. 유형이 바뀌면 오류 있는 칸만 다시 검증한다(§4.5).
  4. 뱃지 = `WorkflowStatusBadge`(§2.7 클래스). 시각 = `formatAbsoluteDateTimeKo`, 날짜 = `formatAbsoluteDateKo`. 상대 시각 0.
  5. 탭 건수는 `aria-hidden` span. 「더보기」는 그룹 안 scope.
  6. AlertModal 5곳(문서 취소·임시저장 삭제·첨부 삭제·관리자 해제·작성 중단). `window.confirm`·`alert` 0.
  7. `Icons`에 §9.2 키를 추가한다. tabler 직접 import 0. raw `<button`·`<label` 0(행도 shadcn `Button`).
  8. attachments feature 확장(§3.7): `LightboxSource`에 `workflow` 추가, id 타입 `number | string`, fetch switch 추가.
  9. `nav-config` 「워크플로우」 그룹(§1) + `NavAccessProvider.hasWorkflowAdminNav`, 알림 `view-workflow` → `/dashboard/workflow?doc={id}`.
  10. 리치텍스트: Tiptap(이미지 extension 없음), 툴바는 shadcn Toggle·ToggleGroup·Select·Popover, 콘텐츠 스타일은 `lib/rich-content-class.ts` 공유(편집기·상세·인쇄).
- **참고 패턴**: `src/features/support/components/{support-page,support-list-filters,support-status-badge,support-list-row}.tsx`, `src/features/quick-request/components/{quick-request-address-picker-dialog,quick-request-query-boundary,quick-request-mobile-summary-bar}.tsx`, `src/features/announcements/components/announcement-attachment-list.tsx`, `src/features/notifications/components/notification-infinite-list.tsx`.
- **shadcn 추가 설치**: 없음.

---

## 수정 이력

| 날짜 | 내용 | 작성자 |
|------|------|--------|
| 2026-10-21 | 최초 작성 — flex 스크린샷 매핑, 문서함·상세·작성·결재선·설정·인쇄 구조, 위젯 매핑, 조건부 필수 UX, testid 매핑, 로딩·빈·에러 상태, BE/FE 전달 요약 | designer |
