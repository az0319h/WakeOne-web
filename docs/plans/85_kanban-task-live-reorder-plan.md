# 칸반 — 할 일(task) 드래그 리얼타임 재정렬

> Date: 2026-10-20
> Status: In Progress
> Author: planner (사용자 스코프 확정 · plan 81 follow-up)
> **신규 SQL:** 없음
> **선행:** [08](./08_activity-audit-log-plan.md), [14](./14_delete-confirm-dialog-plan.md), [26](./26_loading-spinner-unification-plan.md), [49](./49_live-users-presence-plan.md), [81](./81_kanban-google-tasks-plan.md), [84](./84_kanban-tasklist-rename-plan.md)
> **81 관계:** plan 81 AC-19·AC-20은 **드롭 후** 동기화·API 호출을 검증한다. 본 plan은 **드래그 중(포인터 이동)** UI만 정밀 정의한다. **81 본문 재작성 금지.**

---

## 한 줄 요약

`/dashboard/kanban`에서 **미완료 할 일 카드**를 드래그할 때만, **같은 목록 내 순서 변경** 또는 **다른 목록으로 이동**이 포인터에 맞춰 **즉시** 목록 UI에 반영된다. Google `tasks.move` API·activity log는 **드롭(손 뗌) 시 1회**만 호출한다. 목록(열) 가로 재정렬·완료 체크·목록 CRUD 등은 **리얼타임 task 이동 범위 밖**이다.

---

## 선행 plan 참조

| Plan | 관계 |
|------|------|
| **81** | 칸반 본체 · `POST /api/google-tasks/tasks/move` · `google_tasks.task.move` · mock E2E · **81 AC-19/20 유지** (드롭 결과) |
| **84** | tasklist rename — **범위 제외** |
| **08** | move Route 전 HTTP 분기 `recordActivityLog` — **기존 Route 유지** |
| **49** | `/dashboard/kanban` → `dashboard/layout` · **`DashboardPresenceTrack` 상속** (페이지별 track 0건) |
| **82 / 83** | 퀵 요청 — **범위 제외** |

---

## 정책 확정 (사용자 요구 · 2026-10-20)

| # | 결정 |
|---|------|
| R1 | **리얼타임 UI**은 오직 **미완료 task 카드 DnD** 두 경우: **(a) 같은 tasklist 내 reorder** · **(b) 다른 tasklist로 move** |
| R2 | 드래그 중에는 **서버/Google API 호출 0회** · **React Query invalidate 0회** · `position` 문자열 **낙관적 rewrite 금지** |
| R3 | **드롭 시** plan 81과 동일: `moveGoogleTaskMutation` → `POST move` **1회** · 성공 후 기존 `onSettled` invalidate |
| R4 | **목록(열) 가로 DnD**: 기존처럼 **localStorage 순서만** · task move API·리얼타임 task 규칙 **미적용** |
| R5 | **완료됨 섹션** 카드·체크 완료·할 일 추가/수정/삭제·목록 rename/delete/clear: **본 plan 리얼타임 DnD Out** (81 기존 UX 유지) |
| R6 | UX 목표: **Google Tasks** — 잡은 카드는 overlay, 원래 자리는 hole(투명 placeholder), 이웃 카드는 포인터가 **카드 중앙선**을 넘을 때 **한 칸** 자리 바뀜 · **딜레이·스냅백·전체 카드 동시 점프** 금지 |
| R7 | 스택: **dnd-kit 유지** (`@dnd-kit/core` · hello-pangea 등 교체 **Out**) |
| R8 | `src/components/ui/kanban.tsx` 직접 수정은 **최후** — 우선 `src/features/kanban/**`에서 **task DnD를 열 DnD와 분리** (권장: task는 `useDraggable`+overlay, 열은 기존 `KanbanColumn`) |

---

## 리얼타임 vs 비리얼타임 (명시 매트릭스)

| 동작 | 드래그 중 UI | 서버/Google |
|------|----------------|-------------|
| 같은 목록 task 순서 변경 | **리얼타임** (목록 내 카드 순서·hole 이동) | 드롭 시 `move` 1회 |
| 다른 목록으로 task 이동 | **리얼타임** (원본 열 제거·대상 열 삽입 미리보기) | 드롭 시 `move` 1회 |
| 목록(열) 가로 순서 변경 | localStorage 반영 (기존) | **API 없음** |
| task 완료/완료 취소 | 즉시 mutation (81) | complete/uncomplete |
| 완료됨 섹션 카드 | DnD **없음** (81) | — |
| 드래그 취소 (Esc) | **스냅샷 이전 순서**로 복귀 | API **0회** |

---

## UX 상세 (task DnD만)

1. **핸들:** 미완료 카드 grip — 기존 `KanbanItemHandle` 또는 동등 패턴.
2. **드래그 중:** `KanbanOverlay`(또는 동등)에 카드 미리보기 · 본문 리스트의 active 카드 `opacity-0` hole.
3. **삽입 인덱스:** 포인터 Y(·X는 열 판별)로 대상 목록 내 **삽입 index** 계산 · index 변경 시에만 목록 배열 미리보기 갱신.
4. **드롭:** 미리보기와 동일한 최종 index·tasklist로 `MoveTaskPayload` 생성 · mutation 1회.
5. **실패(4xx/5xx):** 토스트 · 목록은 서버 캐시( invalidate 후)로 복구 · hole/overlay 제거.

---

## BE / API / 감사 로그

| 항목 | 내용 |
|------|------|
| 신규 Route | **없음** |
| 신규 SQL | **없음** |
| 신규 `ActivityAction` | **없음** |
| 검증 | 기존 `POST /api/google-tasks/tasks/move` · plan 81 API AC · `google_tasks.task.move` + `x-request-id` |

---

## FE 구현 방향 (designer·frontend-dev 입력)

### 문제 (현재)

- `Kanban` + `KanbanItem`(`useSortable`)의 **내장 `onDragOver` arrayMove**와 feature의 **`dragColumns` / DOM translate**가 **이중 제어** → 커밋 지연·collision 어긋남·체감 딜레이.

### 목표 구조

```
DndContext (보드 1개 또는 열/카드 통합 1개)
├── 열: KanbanColumn + sortable (가로) — onValueChange → localStorage만
└── task: SortableContext **미사용** 또는 열 내부 전용 — draggable + pointer 삽입 index → 단일 preview state
```

- **단일 소스:** 드래그 중 task 순서는 `dragPreviewColumns` (이름 예시) 하나만 · `dragSnapshotRef`는 드롭 diff용.
- **`preventDefault` on `activatorEvent`에만 의존하지 않음** — task path에서 Kanban 내장 item reorder **타지 않도록** 구조 분리.
- **선택:** 삽입 index 변경 시 `flushSync`는 **구조 분리 후에도** 필요할 때만 (AC-L04로 판정).

### 영향 파일 (예상)

| 팀 | 경로 |
|----|------|
| FE | `src/features/kanban/components/google-tasks-kanban-board.tsx` |
| FE | `src/features/kanban/components/google-tasks-column.tsx` |
| FE | `src/features/kanban/components/google-task-card.tsx` |
| FE | `src/features/kanban/utils/card-drop.ts`, `card-live-shift.ts` (정리·삭제 가능) |
| designer | 열 DnD vs task DnD 컴포넌트 트리 · overlay/hole |
| verifier | `e2e/kanban/*` task-drag spec 확장 |

**금지:** 드래그 중 `moveGoogleTask` service 직접 호출 · Supabase 직접 mutation · `window.confirm`.

---

## AC (Given-When-Then)

공통: `E2E_GOOGLE_TASKS_MOCK=1` · active user `storageState` · `/dashboard/kanban` · mock에 **미완료 task ≥3** (같은 열) · **열 A·B** 각 ≥1 task · `dashboard/layout` 하위 (plan 49).

### 범위 (리얼타임 적용 / 미적용)

| ID | 검증 | Given | When | Then |
|----|------|-------|------|------|
| AC-L00 | Playwright | 칸반 로드 | 완료됨 섹션·체크박스·「+ 할 일」·열 메뉴 확인 | 위 요소에 task **리얼타임 DnD hole/overlay 규칙이 적용되지 않음** (완료 카드 DnD 핸들 **없음**) |
| AC-L00b | Playwright | 열 2개 이상 | **열 헤더** 가로 드래그로 순서 변경 | task 카드 순서·Google mock **move 호출 0건** · localStorage 순서만 변경 (기존 동작) |

### 같은 목록 리얼타임

| ID | 검증 | Given | When | Then |
|----|------|-------|------|------|
| AC-L01 | Playwright | 열 A에 task **T1,T2,T3** (위→아래) | T3 grip 드래그 · 포인터를 T1**위쪽** 슬롯까지 이동 (**mouseup 전**) | 리스트에서 T3 자리가 **비어 있고(hole)** T1·T2가 **한 칸씩 아래로 밀린 것처럼** 보임 · **T3가 맨 위 슬롯에 들어갈 준비된 순서** |
| AC-L02 | Playwright | AC-L01 상태 | **mouseup** (드롭) | 화면 순서 **T3,T1,T2** · mock **`tasks.move` 1회** |
| AC-L03 | Playwright | 열 A에 task 2개 | 한 task 드래그 시작 후 **Esc** | 드롭 전 순서 **원복** · move API **0회** |

### 다른 목록 리얼타임

| ID | 검증 | Given | When | Then |
|----|------|-------|------|------|
| AC-L04 | Playwright | 열 A·B 각 task 1개 이상 | A의 task를 B 위 **두 번째 슬롯**으로 드래그 (**mouseup 전**) | B 본문에 **삽입 hole**이 해당 슬롯에 보임 · A에서는 카드 **사라진 것처럼** 보임 (hole/제거 미리보기) |
| AC-L05 | Playwright | AC-L04 | drop | B에 task 표시 · A에서 제거 · move **1회** (plan 81 AC-19 호환) |

### API·네트워크 (드래그 중 0회)

| ID | 검증 | Given | When | Then |
|----|------|-------|------|------|
| AC-L06 | Playwright + route | mock move route에 listener | task 드래그 **시작~이동(≥2 index 변경)** · **drop 전** | `POST .../tasks/move` **0회** |
| AC-L07 | Playwright + route | 동일 | drop | `POST .../tasks/move` **정확히 1회** |

### 실패·권한 (드롭만)

| ID | 검증 | Given | When | Then |
|----|------|-------|------|------|
| AC-L08 | Playwright | mock move가 500 반환 설정 | 유효한 cross-list drop | 한국어 에러 표시 · 앱 **크래시 없음** · 목록이 **이전 서버 순서**로 복구 (invalidate 또는 rollback) |

### plan 81 회귀

| ID | 검증 | Given | When | Then |
|----|------|-------|------|------|
| AC-L09 | Playwright | 81 mock 시나리오 | AC-19·AC-20 재실행 | **green** (드롭 결과 동기화 유지) |

---

## 완료 기준 (verifier)

- AC-L00 ~ AC-L09 **전부** green
- `bunx playwright test` (kanban task-drag 관련 spec)
- 기존 `e2e/api/google-tasks-activity-log` move 케이스 **유지**
- tsc · lint · build exit 0
- `npm run e2e:cleanup` exit 0 (`remaining.users=0` · `remaining.profiles_e2e=0`)

---

## Out

| 항목 | 비고 |
|------|------|
| Google `position` 문자열 드래그 중 rewrite | R2 |
| 목록 가로 DnD Google 동기화 | API 없음 · localStorage only |
| 완료 task DnD | 81 |
| `kanban.tsx` 대규모 포크 | R8 — feature 분리 우선 |
| hello-pangea / 라이브러리 교체 | R7 |
| 82/83 퀵 요청 | — |

---

## 팀별 다음 단계 (`/root` 시)

| 순서 | 팀 | 산출 |
|------|-----|------|
| 1 | designer | 열 vs task DnD 컴포넌트 트리 · overlay/hole |
| 2 | backend-dev | **생략** (기존 move Route) |
| 3 | frontend-dev | task DnD 분리 · preview state · drop mutation |
| 4 | verifier | AC-L* spec · 81 회귀 |

**구현 파이프라인 진입:** root 사용자 **`승인`** (정확히 두 글자) 후 designer~verifier.
