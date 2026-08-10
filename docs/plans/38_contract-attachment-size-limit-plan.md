# 계약 첨부 용량 정책 변경

> Date: 2026-08-07
> Status: Completed
> Author: planner
> **SQL:** `40` · [supabase/sql/40_contract_attachment_10mb_50mb_policy.sql](../../supabase/sql/40_contract_attachment_10mb_50mb_policy.sql)
> **선행:** [08](./08_activity-audit-log-plan.md), [16](./16_contract-management-plan.md), [33](./33_contract-bulk-download-plan.md)

## 한 줄 요약

admin 계약 첨부 업로드 정책을 **파일당 10MB · 계약 문서당 활성 첨부 총량 50MB**로 상향한다. FE·BE·DB·Storage bucket을 동일 정책으로 통일하고, 초과 시 한국어 오류·업로드 차단·기존 activity log를 유지한다.

---

## 선행 plan 참조

| Plan / SQL | Status | 관계 |
|------------|--------|------|
| **[16](./16_contract-management-plan.md)** | Approved | 계약 첨부 **원본 스펙**. AC-10·AC-12는 **1MB** 기준 → **본 plan이 supersede**. 38 **Completed** 시 plan 16 AC-10/12·첨부 정책 문단 갱신 |
| **SQL [28](../../supabase/sql/28_contract_attachment_5mb.sql)** | Completed | 직전 migration — per-row 5MB + bucket 5MB. **SQL 40**으로 10MB 상향 |
| **[33](./33_contract-bulk-download-plan.md)** | Approved | ZIP 일괄 **100건/200MB** — **본 plan Out** (변경 없음) |
| **[08](./08_activity-audit-log-plan.md)** | Approved | `contract.attachment_upload` 전 HTTP 분기 기록 — 신규 action 없음 |

**supersede 명시 (plan 16):**

- plan 16 AC-10: 「1MB 이하 파일 업로드」→ 본 plan AC-01 (10MB 이하 단일 파일)로 대체
- plan 16 AC-12: 「1MB 초과 업로드 거부」→ 본 plan AC-02·AC-03 (per-file 10MB / document total 50MB)로 대체
- plan 38 **Completed** 후 plan 16에 수정 이력 1행 추가 및 위 AC·「첨부파일 정책」In Scope 문단 동기화

---

## 목표 & 완료 기준

### 목표

- 계약 첨부 용량 한도를 운영 정책(파일 10MB · 문서 50MB)에 맞게 상향한다.
- FE 선택 단계·BE 업로드·DB row check·Storage bucket limit이 **동일 수치**를 적용한다.
- 파일 개수 상한은 도입하지 않는다 (용량·파일명 중복 규칙만 유지).

### 완료 기준 (AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| AC-01 | API | admin 세션, 활성 계약 문서, 활성 첨부 총량 0 | **10MB 이하** 단일 파일 업로드 | HTTP **201**, Storage·DB에 활성 첨부 생성, `contract.attachment_upload` **성공** 로그 |
| AC-02 | API | admin, 활성 첨부 총량 0 | **10MB 초과** 단일 파일 업로드 | HTTP **400**, 한국어 **파일당 용량** 오류, Storage/DB 활성 행 **미생성**, `contract.attachment_upload` **실패** 로그 |
| AC-03 | API | admin, 활성 첨부 총량 **45MB** (예: 5MB×9) | **6MB** 파일 업로드 시도 | HTTP **400**, 한국어 **문서당 총량 50MB** 오류, `contract.attachment_upload` **실패** 로그 |
| AC-04 | API | admin, 활성 첨부 총량 0 | **10MB** 파일 5개를 **순차** 업로드 (총 50MB) | 5회 모두 **201**; 6번째 **1B** 파일 시도 시 HTTP **400** (총량 초과) |
| AC-05 | Playwright | admin, 계약 수정 Sheet 열림 | 첨부 안내 문구 확인 | **「파일당 10MB」** 와 **「계약 문서당 활성 첨부 총량 50MB」** 가 모두 표시된다 |
| AC-06 | Playwright | admin, 계약 수정 Sheet | **11MB** 파일 선택 | 업로드 전 toast/에러로 차단되고 선택 목록에 **추가되지 않는다** |
| AC-07 | Playwright | admin, 활성 첨부 **45MB** (예: 5MB×9) | **6MB** 파일 선택 (per-file OK, total 초과) | toast로 **총량 초과** 차단, 업로드 **미실행** |
| AC-08 | API | admin | 동일 파일명 재업로드 | HTTP **400**, 파일명 중복 오류 (plan 16 AC-11 **회귀 없음**) |
| AC-09 | grep/API | AC-02 또는 AC-03 수행 후 | `GET /api/activity-logs?action=contract.attachment_upload` | 해당 request의 **400** 행·`x-request-id` 확인 |
| AC-10 | 수동/회귀 | plan 33 preview API | 문서승인일 범위 preview | **100건/200MB** 상한 문구·동작 **변경 없음** |

---

## 범위 (In / Out)

### In Scope

- 상수 정의: `types.ts` — 파일당 10MB, 문서당 활성 총량 50MB, 한국어 에러·hint 문자열
- FE: `contract-edit-sheet.tsx` — 파일 선택 시 per-file + 누적 총량 검증, hint 문구
- BE: `service.server.ts` — per-file + document total 검증 (서버 최종 방어)
- Route: `POST /api/contracts/[id]/attachments` — 400 분기 키워드(per-file 메시지) 유지
- SQL: `40_contract_attachment_10mb_50mb_policy.sql` — per-row `file_size <= 10485760`, bucket `file_size_limit = 10485760`
- E2E: `e2e/contracts/attachments-size.spec.ts` (신규)
- plan 16 AC-10/12 supersede — 38 Completed 시 plan 16 갱신

### Out of Scope

- [plan 33](./33_contract-bulk-download-plan.md) ZIP 일괄 다운로드 상한 (**100건 / 200MB**) 변경
- 파일 개수 상한 도입
- 신규 `ActivityAction` 코드
- 기존 Storage object 재인코딩·이동·데이터 마이그레이션 (기존 첨부 ≤5MB → 호환)
- 첨부 soft delete·다운로드·독촉 로직 변경
- designer 레이아웃 변경 (hint 문구만)

---

## 용량 정책 (확정)

| 규칙 | 값 | 적용 계층 |
|------|-----|----------|
| **파일 1개당 최대** | **10MB** (10 485 760 bytes) | FE 선택 · BE `service.server.ts` · DB row check · Storage bucket |
| **계약 문서 1건당 활성 첨부 총량** | **50MB** (52 428 800 bytes) | FE 선택 · BE `service.server.ts` (**앱 전용**, DB constraint 없음) |
| **파일 개수** | **무제한** | — |
| **파일명 중복** | 같은 `contract_id` 내 동일 `file_name` 재업로드 금지 (plan 16 유지) | FE · BE |

**문서당 총량 50MB — DB constraint 없음**

- 활성 첨부 **합계**는 애플리케이션 계층(FE + `service.server.ts`)에서만 검증한다.
- DB는 **행 단위** `file_size <= 10MB`만 강제한다 (plan 16·SQL 28 패턴과 동일).

---

## UI 요구사항

### 계약 수정 Sheet — 첨부파일 관리

- 기존 `contract-edit-sheet.tsx` 구조·SheetFooter 패턴 유지.
- hint 문구 (예시, 구현 시 `types.ts` 상수에서 생성):
  - **파일당 10MB 이하**
  - **계약 문서당 활성 첨부 총량 50MB 이하**
- 파일 선택(`input[type=file]`) 시:
  1. 단일 파일 > 10MB → toast 에러, 선택 목록 미추가
  2. `active_attachment_total_size + 선택 파일 합` > 50MB → toast 에러, 선택 목록 미추가
  3. 파일명 중복(기존·선택·동일 배치 내) → 기존 동작 유지
- 저장 시 순차 업로드(`uploadMutation`) — 기존 흐름 유지.

### designer 참고

- 레이아웃·컴포넌트 신규 없음. hint 2줄 정책 문구만 반영.

---

## API / DB 요구사항

### SQL migration

**파일:** `supabase/sql/40_contract_attachment_10mb_50mb_policy.sql`

```sql
-- per-row file_size check: 10MB
-- storage.buckets file_size_limit: 10485760 (contract-attachments)
```

- `contract_attachments_file_size_check`: `file_size > 0 and file_size <= 10485760`
- `storage.buckets` where `id = 'contract-attachments'`: `file_size_limit = 10485760`
- 상단 메타: `Status: Approved` → 구현 후 `Completed (remote applied)`, `Plan: 38_contract-attachment-size-limit-plan.md`

### 상수 (`src/features/contracts/api/types.ts`)

| 상수 (가칭) | 값 |
|-------------|-----|
| `CONTRACT_ATTACHMENT_PER_FILE_MAX_MB` | 10 |
| `CONTRACT_ATTACHMENT_PER_FILE_MAX_BYTES` | 10 × 1024 × 1024 |
| `CONTRACT_ATTACHMENT_DOCUMENT_MAX_MB` | 50 |
| `CONTRACT_ATTACHMENT_DOCUMENT_MAX_BYTES` | 50 × 1024 × 1024 |

- 기존 `CONTRACT_ATTACHMENT_MAX_MB` / `CONTRACT_ATTACHMENT_MAX_BYTES`는 문서 총량 의미로 **50MB**로 변경하거나 `DOCUMENT_*`로 rename 후 import 경로 일괄 수정.
- 에러·hint 문자열은 위 상수에서 **동적 생성** (하드코드 `5`/`1MB` 잔존 금지).

### BE 검증 (`service.server.ts` — `uploadContractAttachment`)

1. `input.file.size > PER_FILE_MAX_BYTES` → throw per-file 한국어 오류
2. `contract.active_attachment_total_size + input.file.size > DOCUMENT_MAX_BYTES` → throw 총량 한국어 오류
3. 파일명 중복 — 기존 로직 유지
4. Storage upload → DB insert — 기존 orphan cleanup 유지

### Route Handler

- `POST /api/contracts/[id]/attachments` — 기존 `jsonWithActivityLog` + `contract.attachment_upload`
- catch 분기: per-file 메시지도 **400** (`validation`)으로 매핑

---

## 활동 감사 로그

> `core-conventions.mdc` §활동 감사 로그 · 참조 [plan 08](./08_activity-audit-log-plan.md)

**신규 action 없음.** 기존 `contract.attachment_upload` 재사용.

### 기록 연동

| Route | action | return 분기 |
|-------|--------|------------|
| `POST /api/contracts/[id]/attachments` | `contract.attachment_upload` | 401 · 403 · 400 (per-file · total · duplicate · validation) · 404 · **201** · 500 |

- 용량 초과 **400**도 실패 로그 1건 기록 (AC-09).
- READ(다운로드 GET), 목록/상세 조회 — Out.

---

## 영향 파일 & 패턴

| 파일 | 변경 |
|------|------|
| `supabase/sql/40_contract_attachment_10mb_50mb_policy.sql` | 신규 migration |
| `src/features/contracts/api/types.ts` | 상수·메시지 10MB/50MB |
| `src/features/contracts/api/service.server.ts` | per-file + total 검증 |
| `src/app/api/contracts/[id]/attachments/route.ts` | 400 키워드 (per-file) |
| `src/features/contracts/components/contract-edit-sheet.tsx` | FE 검증·hint |
| `e2e/contracts/attachments-size.spec.ts` | 신규 spec |
| `e2e/helpers/contracts.ts` | 테스트용 File/Buffer 헬퍼 (필요 시) |
| `docs/plans/16_contract-management-plan.md` | 38 Completed 시 AC-10/12·정책 문단 갱신 |
| `docs/plans/README.md` | plan 38 등록 |

**따라야 할 패턴:**

- 상수·메시지 단일 출처: `types.ts`
- CUD: `mutations.ts` → API Route → `service.server.ts`
- 캐시: `onSettled` invalidate (`contractKeys.all`)
- grep 잔존 확인: `5242880`, `CONTRACT_ATTACHMENT_MAX_MB = 5`

---

## 리스크 & 완화책

| # | 리스크 | 완화 |
|---|--------|------|
| 1 | SQL/bucket 미적용 → Storage·DB 불일치 | SQL 40 원격 적용 BE 1순위; AC-01/02 |
| 2 | FE 50MB / BE 5MB 상수 잔존 | `types.ts` 단일 상수; grep |
| 3 | 순차 업로드 5건 성공 후 6번째 서버 거부 | FE 선택 단계 총량 검증; AC-04 |
| 4 | plan 16 AC 1MB 잔존 → verifier 혼선 | 38 Completed 시 plan 16 동기화 |
| 5 | per-file 검증 누락 → Storage만 거부 | `service.server.ts` 명시 검증; AC-02 |

**ROLLBACK:** SQL constraint/bucket 5MB revert; 상수 5MB 복원. 기존 첨부(≤5MB) 영향 없음.

---

## 구현 순서 제안

1. SQL 40 작성·원격 적용
2. `types.ts` 상수·메시지
3. `service.server.ts` per-file + total 검증
4. `contract-edit-sheet.tsx` FE 검증·hint
5. Route 400 분기 확인
6. E2E spec + verifier (tsc · lint · build)
7. plan 16 AC-10/12 갱신 (Completed 시)

---

## 팀 전달 요약

### — /designer 에게 —

- UI 범위: 계약 수정 Sheet 첨부 hint **2줄** (파일 10MB · 문서 총량 50MB). 레이아웃 변경 없음.
- 참고: `contract-edit-sheet.tsx` 기존 hint 위치

### — /backend-dev 에게 —

- SQL `40_contract_attachment_10mb_50mb_policy.sql` — row check 10MB + bucket limit
- `service.server.ts` per-file(10MB) + document total(50MB) 검증
- activity log: 신규 action 없음, `contract.attachment_upload` 400 분기 유지

### — /frontend-dev 에게 —

- `types.ts` 상수 import, `contract-edit-sheet.tsx` 선택 시 per-file/total 검증 + hint
- bulk-download UI(plan 33) **미변경**

### — /verifier 에게 —

- `e2e/contracts/attachments-size.spec.ts` — AC-01~07, AC-09
- plan 33 회귀 AC-10
- spec green + build 통과 전 완료 보고 금지

---

## 열린 질문

| # | 질문 | 기본값 |
|---|------|--------|
| 1 | 상수 rename (`DOCUMENT_*` vs 기존 `MAX_MB` 유지) | 구현 시 grep 최소화 방향으로 backend-dev/frontend-dev 결정 |
| 2 | E2E 10MB/11MB fixture 생성 방식 | in-memory Buffer / temp file (helpers 확장) |

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-08-07 | 최초 작성 · `/root` planner Phase 3+4 · Status Approved | planner |
| 2026-08-10 | verifier 통과 · Status Completed · AC-07 Given/When을 45MB+6MB로 정정 (10MB per-file 정책과 일치) | verifier |
