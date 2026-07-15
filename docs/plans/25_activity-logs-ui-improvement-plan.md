# Activity Logs UI 개선 기획서

> Date: 2026-07-15  
> Status: Approved  
> Author: planner  
> **선행:** [08](./08_activity-audit-log-plan.md) (확장) · [07](./07_auth-route-guard-plan.md) (Completed)

## 선행 plan 참조 (Phase 0)

| Plan | 관계 |
|------|------|
| **08** | **직접 확장** — `activity_logs` DB · `recordActivityLog` · `/dashboard/logs` · GET API 골격 유지. **조회 UI·admin 필터**만 개선 |
| **07** | `requireSession` · admin RBAC — 유지 |
| **13** | `office_snack.*` action 로깅 — UI 한국어 라벨 대상 |
| **16, 18, 20** | `contract.*` action 로깅 — UI 한국어 라벨 대상 |
| **02~06, 19, 21** | `user.*` · `profile.*` action — UI 한국어 라벨 대상 |

**중복 금지:** READ 로깅 · 로그 수정·삭제 · export · DB 스키마 변경 · 신규 `recordActivityLog` Route 연동 **Out**.

**가져올 제약:** append-only · RLS(actor∨target∨admin) · non-admin OR 필터 · plan 08 조건부 행 확장 패턴.

---

## 한 줄 요약

`/dashboard/logs`를 **비기술 사용자용**으로 재설계한다 — 기본 5컬럼(시간·행위자·활동·대상·결과) 한국어 표시, admin **사용자 Combobox**(본인 기본/전체/특정 user), 기술 정보는 행 확장으로만 노출. Designer **3 preview** 중 사용자 선택 후 FE/BE 착수.

---

## 목표 & 완료 기준

- 일반 user: **본인** actor∪target 로그만, 한국어 5컬럼
- admin: **기본 본인** 로그, Combobox로 전체·특정 사용자 조회
- pagination · sort · 활동 유형 필터 · 대상 검색 **회귀 없음**
- `ActivityAction` union **전체** 한국어 `ACTION_LABELS` 매핑 (코드베이스 기준 **26개**)
- Playwright AC #1~#17 green + tsc + lint + build

---

## 범위 (In / Out)

### In Scope

| 순서 | 영역 | 내용 |
|------|------|------|
| 0 | **Designer gate** | 3 preview 제시 → 사용자 `preview-1`/`preview-2`/`preview-3` 선택 전 **BE/FE 금지** |
| A | **BE** | `GET /api/activity-logs` — `log_user` scope (`self`/`all`/`{uuid}`), `actor_search` **제거** |
| B | **FE labels** | `ACTION_LABELS` · `RESULT_LABELS` · `METADATA_LABELS` · `TARGET_LABEL_OVERRIDES` |
| C | **FE UI** | 5컬럼 테이블(또는 선택 preview 레이아웃) · admin `LogUserCombobox` · nuqs 동기화 |
| D | **FE expand** | Method/Endpoint/Request ID/http_status 숫자 · metadata 한국어 키 |
| E | **E2E** | `e2e/activity-logs/*.spec.ts` |
| F | **검증** | AC #1~#17 |

### Out of Scope

| 항목 | 비고 |
|------|------|
| READ 로깅 | Out |
| 로그 수정·삭제 UI/API | Out (append-only) |
| CSV/JSON export | Out |
| DB 스키마·RLS 변경 | Out |
| 신규 `recordActivityLog` Route | Out (표시만) |
| preview-3 요약 **aggregate API** | v1 Out (클라이언트 단순 집계만 허용) |
| `actor_search` 텍스트 필터 | **제거** |

---

## 활동 감사 로그

**activity log 해당 없음** — 본 plan은 **조회·표시 UI만** 개선. 신규 mutation·`recordActivityLog` 연동 없음. 기존 로그 데이터는 AC에서 **표시 검증**으로만 사용.

---

## §Designer gate

Designer는 구현 착수 **전** 아래 3안을 **터미널 ASCII 목업** 형식(`.cursor/skills/designer/SKILL.md` §Preview 제시 형식)으로 각 1블록씩 제시한다. 사용자가 채팅에 **`preview-1`**, **`preview-2`**, 또는 **`preview-3`** 중 **정확히 하나**를 입력하기 전까지 **backend-dev · frontend-dev 착수 금지**.

선택안만 plan §UI 요구사항에 확정 반영한다.

### preview-1 — 타임라인 카드

- 세로 **타임라인** (날짜 그룹: 「오늘」「어제」「YYYY.MM.DD」)
- 카드 1건: 시간 · 「{행위자}님이 {활동} — {대상}」 · **결과 Badge**
- 상단 sticky 필터: **사용자 Combobox** + 활동 유형 + 대상 검색
- 카드 클릭 → 인라인 펼침 (고급 정보: Method/Endpoint/Request ID/http_status/metadata)
- 모바일 친화 · 스토리 읽기 쉬움 / 대량 로그 스캔은 테이블 대비 느림

### preview-2 — 심플 테이블 (battle-plan 추천 기본안)

- 현재 `DataTable` 유지, 컬럼 **5개만**: 시간 · 행위자 · 활동 · 대상 · 결과
- `DataTableToolbar`: Combobox + 활동 유형 select + 대상 검색 (Users 테이블 패턴)
- 행 chevron 조건부 expand (plan 08 유지)
- 구현·회귀 리스크 최소

### preview-3 — 감사 대시보드

- 상단 요약 카드 3~4개 (예: 최근 활동 수 · 실패 건수 — **현재 scope·로드된 페이지 기준**, 별도 aggregate API **Out**)
- 하단 preview-2와 동일 5컬럼 테이블 + expand
- admin 감사·모니터링 인상 / v1 범위는 카드+테이블 조합만

**선택 키워드:** `preview-1` | `preview-2` | `preview-3`

**확정 선택 (2026-07-15):** `preview-2` — 심플 테이블 (5컬럼 DataTable + Combobox 필터 + 조건부 expand)

---

## API / Service Layer

### `GET /api/activity-logs` 변경

| Query | 설명 | role |
|-------|------|------|
| `page`, `limit` | pagination (기본 page=1, limit=10) | all |
| `sort` | JSON sort payload (`created_at`/`http_status`/`action`) | all |
| `log_user` | `self` \| `all` \| `{uuid}` | **admin only** |
| `action` | action 코드 필터 | admin |
| `search` | `target_label` ilike | admin |

#### `log_user` 동작 (admin)

| 값 | 필터 |
|----|------|
| **생략 또는 `self`** (**기본**) | `actor_user_id = adminId OR target_user_id = adminId` |
| `all` | 사용자 scope 필터 없음 |
| `{uuid}` | `actor_user_id = uuid OR target_user_id = uuid` |

#### non-admin

- `log_user` · `action` · `search` **무시**
- `.or(actor_user_id.eq.{uid},target_user_id.eq.{uid})` 유지

#### 제거

- `actor_search` — route · `service.server.ts` · FE · nuqs **전부 제거**. 구 URL param은 **무시**.

### Feature 파일 변경

```
src/features/activity-logs/api/
  types.ts              — log_user 필터, actor_search 제거
  service.server.ts     — log_user scope 쿼리
  service.ts            — query string 동기화
  queries.ts            — key factory
  labels.ts             — 신규: ACTION_LABELS 등
```

**CUD UI 없음** → `mutations.ts` 불필요.

### nuqs / searchparams

- 추가: `log_user` (`parseAsString`, admin 기본 `self`)
- 제거: `actor_search`
- 진입 시 admin + `log_user` 없으면 **`self` URL 동기화**

---

## ACTION_LABELS (26개 · `ActivityAction` union 전체)

`src/features/activity-logs/labels.ts`에 `Record<ActivityAction, string>`로 정의. 누락 시 **tsc 실패**하도록 union과 연동.

| action | 한국어 라벨 |
|--------|------------|
| `user.create` | 사용자 생성 |
| `user.invite` | 사용자 초대 |
| `user.update` | 사용자 정보 수정 |
| `user.reactivate` | 사용자 재활성화 |
| `user.deactivate` | 사용자 비활성화 |
| `office_snack.session_create` | 간식 투표 세션 생성 |
| `office_snack.session_update` | 간식 투표 세션 수정 |
| `office_snack.session_delete` | 간식 투표 세션 삭제 |
| `office_snack.candidate_create` | 간식 후보 등록 |
| `office_snack.candidate_update` | 간식 후보 수정 |
| `office_snack.candidate_delete` | 간식 후보 삭제 |
| `office_snack.vote_submit` | 간식 투표 제출 |
| `contract.import_create` | 계약서 가져오기(신규) |
| `contract.import_duplicate` | 계약서 가져오기(중복) |
| `contract.import_backfill` | 계약서 가져오기(보강) |
| `contract.import_failed` | 계약서 가져오기(실패) |
| `contract.update` | 계약서 수정 |
| `contract.soft_delete` | 계약서 삭제 |
| `contract.attachment_upload` | 계약서 첨부파일 업로드 |
| `contract.attachment_soft_delete` | 계약서 첨부파일 삭제 |
| `contract.no_attachment_set` | 계약서 첨부 없음 처리 |
| `contract.no_attachment_unset` | 계약서 첨부 없음 해제 |
| `contract.reminder_send` | 계약서 독촉 메일 발송 |
| `contract.reminder_failed` | 계약서 독촉 메일 실패 |
| `profile.update` | 프로필 수정 |
| `profile.password_change` | 비밀번호 변경 |

### RESULT_LABELS (`http_status` → 기본 테이블 Badge)

| 조건 | Badge 문구 |
|------|-----------|
| 2xx | 성공 |
| 401 | 로그인 필요 |
| 403 | 권한 없음 |
| 400 | 입력 오류 |
| 404 | 대상 없음 |
| 기타 4xx | 실패 |
| 5xx | 서버 오류 |

**`http_status` 숫자**는 기본 테이블 **미노출** — 행 expand에만 표시.

### METADATA_LABELS (expand 키 한국어화)

| 키 | 한국어 |
|----|--------|
| `error_code` | 오류 유형 |
| `message` | 안내 메시지 |
| `validation_errors` | 입력 오류 상세 |
| `changed_fields` | 변경된 항목 |
| `attempted_target` | 시도 대상 |
| `document_number` | 문서번호 |
| `file_name` | 파일명 |
| `recipient_email` | 수신 이메일 |
| `asset_number` | 자산번호 |
| `asset_name` | 자산명 |
| `category` | 분류 |
| `usage_location` | 사용 위치 |
| `session_state` | 세션 상태 |
| (기타 metadata 키) | snake_case → 짧은 한국어 **[INFERRED]** |

expand 시 **`metadata.message` 최상단** 노출.

### TARGET_LABEL_OVERRIDES (프론트 보정)

| 패턴 | 표시 예 |
|------|---------|
| `session:{id}` | 간식 투표 세션 #{id} |
| `session:{id}:candidate:{cid}` | 간식 후보 #{cid} |
| `office_snack` | 간식 투표 |

---

## UI 요구사항 (designer / FE)

**데이터 모델 공통:** preview 선택과 무관하게 5필드(시간·행위자·활동·대상·결과) + 조건부 expand.

### 기본 테이블 컬럼 (preview-2 기준)

| 컬럼 | 내용 |
|------|------|
| 시간 | 상대시간 + tooltip 절대시간 (`ko-KR`) |
| 행위자 | `actor_display_name` / email |
| 활동 | `ACTION_LABELS[action]` |
| 대상 | `target_label` (+ `TARGET_LABEL_OVERRIDES`) |
| 결과 | `RESULT_LABELS` Badge (**http_status 숫자 없음**) |

**제거(기본 테이블):** Method · Endpoint · Status 숫자 · Request ID · Action 코드 Badge

### Admin Toolbar

```
[ 사용자 ▼ 본인 ]  [ 활동 유형 ▼ ]  [ 대상 검색… ]
```

- **LogUserCombobox:** 본인(기본) · 전체 · 사용자 목록(이름·이메일 검색, `usersQueryOptions` 재사용)
- 활동 유형: `ACTION_OPTIONS` — **label = ACTION_LABELS 한국어**
- 대상 검색: `search` → nuqs, debounce 500ms

### 조건부 행 확장 (plan 08 유지)

| 조건 | UI |
|------|-----|
| 2xx · metadata `{}` | flat — 확장 없음 |
| 2xx · metadata 있음 | expand — 한국어 키·값 |
| 4xx / 5xx | expand 강조 — `message` 우선 + Method/Endpoint/Request ID/http_status |

### 페이지

- `PageContainer` — `pageTitle="활동 로그"`
- admin 부제: 「본인 및 선택한 사용자의 활동 이력을 확인합니다。」 **[INFERRED]**
- user 부제: 「본인과 관련된 활동 이력을 확인합니다。」
- `loading.tsx` / Suspense skeleton 유지

### Nav

- `/dashboard/logs` — 전 role (변경 없음)

---

## 목표 & 완료 기준 (AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| 1 | Playwright | `system_role=user` 로그인 | `/dashboard/logs` 진입 | 본인 actor∪target 행만 · 헤더 **시간·행위자·활동·대상·결과** · Method/Endpoint **없음** |
| 2 | Playwright | user, 본인 관련 로그 1건 | 해당 행 확인 | 활동 열 **한국어** (예: 「사용자 초대」) · `user.invite` 코드 **미노출** |
| 3 | Playwright | admin 로그인 | `/dashboard/logs` 최초 진입 | Combobox **「본인」** · admin 본인 actor∪target 행만 |
| 4 | Playwright | admin | Combobox에서 사용자 B 선택 | B actor∪target 이력 · URL `log_user={B uuid}` |
| 5 | Playwright | admin | Combobox **「전체」** | 모든 사용자 로그 · `log_user=all` |
| 6 | Playwright | admin | 활동 유형 「사용자 비활성화」 | `user.deactivate` 행만 · total 반영 |
| 7 | Playwright | admin | 대상 검색 입력 | `target_label` 매칭만 · debounce 후 갱신 |
| 8 | Playwright | admin | 2페이지 이동 | page=2 로드 · 필터 유지 |
| 9 | Playwright | admin | 시간 컬럼 정렬 토글 | `created_at` asc/desc 반영 |
| 10 | Playwright | admin/user | 실패 로그 expand | 결과 Badge 「실패」 등 · `metadata.message` 한국어 · expand에 http_status **숫자** |
| 11 | Playwright | admin/user | 성공 행 expand | Method·Endpoint·Request ID **expand 안에만** |
| 12 | API | user A | `GET /api/activity-logs` | 모든 row `actor=A OR target=A` |
| 13 | API | admin | `GET ?log_user=self` (기본) | 모든 row admin actor∪target |
| 14 | API | admin | `GET ?log_user={uuid}` | 모든 row 해당 user actor∪target |
| 15 | API | admin | `GET ?log_user=all` | user scope 필터 없음 |
| 16 | Process | designer 3 preview 제시 | preview-N **미선택** | FE/BE 구현 PR 없음 |
| 17 | CLI | — | tsc · lint · build | 통과 |

**회귀:** plan 08 append-only · RLS · 기존 mutation 로깅 유지.

---

## E2E 범위

경로: `e2e/activity-logs/`

| 파일 | AC |
|------|-----|
| `logs-display.spec.ts` | #1, #2 |
| `logs-admin-filter.spec.ts` | #3~#7 |
| `logs-pagination-sort.spec.ts` | #8, #9 |
| `logs-expand.spec.ts` | #10, #11 |
| `logs.api.spec.ts` | #12~#15 |

- `storageState` admin/user fixture 재사용
- 셀렉터: `getByRole` · `getByPlaceholder` · `getByTestId` only

---

## 영향 파일 & 패턴

| 파일 | 변경 |
|------|------|
| `src/features/activity-logs/api/types.ts` | `log_user` · `actor_search` 제거 |
| `src/features/activity-logs/api/service.server.ts` | scope 필터 |
| `src/app/api/activity-logs/route.ts` | param 파싱 |
| `src/features/activity-logs/api/service.ts` | query string |
| `src/features/activity-logs/api/queries.ts` | key factory |
| `src/features/activity-logs/labels.ts` | **신규** |
| `src/features/activity-logs/components/log-user-combobox.tsx` | **신규** |
| `src/features/activity-logs/components/activity-logs-table/columns.tsx` | 5컬럼 |
| `src/features/activity-logs/components/activity-logs-table/options.tsx` | 한국어 label |
| `src/features/activity-logs/components/activity-logs-table/expand-panel.tsx` | 고급 정보 |
| `src/features/activity-logs/components/activity-logs-table/index.tsx` | nuqs |
| `src/features/activity-logs/components/activity-log-listing.tsx` | prefetch |
| `src/app/dashboard/logs/page.tsx` | 부제 |
| `src/lib/searchparams.ts` | `log_user` |
| `e2e/activity-logs/*.spec.ts` | **신규** |

**패턴:** Users DataTable + nuqs · `usersQueryOptions` Combobox · plan 08 expand

---

## 리스크 & 완화

| # | 리스크 | 완화 |
|---|--------|------|
| 1 | admin 기본 self인데 첫 paint 전체 노출 | RSC·클라이언트 동일 기본값 · `log_user=self` nuqs 동기화 |
| 2 | ACTION_LABELS 누락 | `Record<ActivityAction, string>` 타입 연동 |
| 3 | Combobox 사용자 목록 지연 | debounce 검색 · 기존 users API pagination |
| 4 | preview-1/3 범위 팽창 | 선택안별 In/Out · preview-3 aggregate API v1 Out |
| 5 | 필터+pagination total 오류 | AC #6~#8 · API spec |
| 6 | `actor_search` 북마크 | 구 param 무시 |

---

## 추정

| 항목 | 값 |
|------|-----|
| 복잡도 | Medium (preview-2) / Complex (preview-1 or preview-3) |
| BE | ~30–40분 |
| FE (preview-2) | ~60–90분 |
| E2E | ~45–60분 |
| Designer 3 preview | ~30–45분 |
| **합계 (preview-2)** | **~3–4시간** |

---

## 구현 순서

1. **Designer** — 3 preview → 사용자 `preview-N` (**게이트**)
2. **backend-dev** — `log_user` API · `actor_search` 제거
3. **frontend-dev** — labels · Combobox · 5컬럼 · expand · nuqs
4. **verifier** — E2E · tsc · lint · build

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-07-15 | 최초 작성 · Phase 1~2 확정 반영 · Status Approved | planner |
