# 계약 첨부 Supabase Storage 직접 업로드

> Date: 2026-09-22
> Status: Approved
> Author: planner
> **선행:** [08](./08_activity-audit-log-plan.md), [16](./16_contract-management-plan.md), [33](./33_contract-bulk-download-plan.md), [38](./38_contract-attachment-size-limit-plan.md), [41](./41_user-my-contracts-plan.md), [49](./49_live-users-presence-plan.md)

## 한 줄 요약

admin 계약 첨부 업로드를 **Signed upload URL 2단계**(prepare → browser Storage PUT → complete)로 전환해 Vercel Serverless body ~4.5MB 한도를 우회한다. 용량(10MB/50MB)·저장 UX(선택 후 「저장」 시 PATCH+순차 업로드)·activity log·토스트·invalidate는 plan 38·16 패턴을 **유지**한다.

---

## 선행 plan 참조

| Plan | Status | 관계 |
|------|--------|------|
| **[16](./16_contract-management-plan.md)** | Approved | 계약 첨부 **기반**. `POST …/attachments` FormData 업로드 → **본 plan이 transport만 supersede** (용량·중복·admin-only·orphan cleanup 유지) |
| **[38](./38_contract-attachment-size-limit-plan.md)** | Completed | **10MB/50MB** 정책·FE 선택 검증·한국어 오류 — **변경 없음**, complete/prepare에서 **동일 검증 재사용** |
| **[08](./08_activity-audit-log-plan.md)** | Approved | `contract.attachment_upload` — prepare **실패** + complete **성공/실패** 전 HTTP 분기 기록 |
| **[33](./33_contract-bulk-download-plan.md)** | Approved | ZIP은 `storage_path` 기준 service role download — path 규칙 **유지**, **회귀 검증** |
| **[41](./41_user-my-contracts-plan.md)** | Approved | user READ-only · `POST …/attachments` **403 유지** — 업로드 **Out** |
| **[49](./49_live-users-presence-plan.md)** | Approved | `/dashboard/contracts`는 `dashboard/layout` `DashboardPresenceTrack` **상속** — 신규 layout **불필요** |

**중복 금지:** TUS·RLS browser INSERT·다운로드/bulk ZIP transport 변경·announcements 업로드 변경·신규 `ActivityAction`.

---

## 목표 & 완료 기준

### 목표

- prod(Vercel)에서 **6~10MB PDF** 등이 Serverless Function body 한도(~4.5MB) 없이 업로드된다.
- 파일 바이트는 **Supabase Storage로 직접** 전송하고, 검증·DB insert·activity log는 **API Route**가 수행한다.
- 업로드 **타이밍**은 현행과 동일: 파일 선택은 로컬 대기, **「저장」 클릭** → 계약 PATCH 성공 후 **순차** prepare → PUT → complete.
- plan 38 용량·토스트·hint·파일명 중복·순차 업로드 실패 시 partial state UX를 **회귀 없이** 유지한다.

### 완료 기준 (AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| AC-01 | API | admin 세션, 활성 계약, 총량 여유 | **7MB** 파일에 대해 prepare → signed URL PUT → complete | HTTP **201**, DB 활성 첨부·Storage object 존재, `contract.attachment_upload` **성공** 로그 1건(complete) |
| AC-02 | API | admin, 총량 0 | **10MB** 파일 prepare → PUT → complete | HTTP **201** (plan 38 AC-01 transport 회귀) |
| AC-03 | API | admin, 총량 0 | **11MB** 파일 **prepare** 요청 | HTTP **400**, 한국어 **파일당 용량** 오류, signed URL **미발급**, Storage object **미생성**, `contract.attachment_upload` **실패** 로그(prepare) |
| AC-04 | API | admin, 활성 첨부 총량 **45MB** | **6MB** 파일 **prepare** 요청 | HTTP **400**, 한국어 **문서당 총량 50MB** 오류, `contract.attachment_upload` **실패** 로그(prepare) |
| AC-05 | API | admin, 동일 파일명 활성/삭제 이력 존재 | **prepare** 요청 | HTTP **400**, 파일명 중복 오류, `contract.attachment_upload` **실패** 로그(prepare) |
| AC-06 | API | admin, prepare 성공 후 Storage PUT 완료 | complete에서 DB insert **실패**(mock/강제) | HTTP **500** 또는 **400**, 해당 `storage_path` Storage object **remove**, `contract.attachment_upload` **실패** 로그(complete) |
| AC-07 | Playwright | admin, 계약 수정 Sheet, **7MB** PDF 선택 | 「저장」 클릭 | PATCH 성공 후 업로드 진행, **「계약서와 첨부파일이 저장되었습니다.」** toast, Sheet 닫힘, 목록에 파일명 표시 |
| AC-08 | Playwright | admin, Sheet | 파일 **선택만** 하고 「저장」 **미클릭** | 네트워크에 prepare/complete **요청 없음** (선택 즉시 업로드 **금지**) |
| AC-09 | Playwright | admin, Sheet | **11MB** 파일 선택 | toast 차단, 선택 목록 **미추가** (plan 38 AC-06 회귀) |
| AC-10 | Playwright | admin, Sheet | hint 문구 확인 | **「파일당 10MB」** · **「계약 문서당 활성 첨부 총량 50MB」** 표시 (plan 38 AC-05 회귀) |
| AC-11 | API | `system_role=user` | prepare 또는 complete 호출 | HTTP **403** (plan 41 AC-09 회귀) |
| AC-12 | API | admin | plan 33 bulk-download preview (문서승인일 범위) | **100건/200MB** 상한·동작 **변경 없음** |
| AC-13 | API/grep | AC-03 또는 AC-06 수행 후 | `GET /api/activity-logs?action=contract.attachment_upload` | prepare/complete 각 실패·성공 행·`x-request-id` 확인 |
| AC-14 | grep | 구현 후 | `POST /api/contracts/*/attachments` FormData multipart | Route **제거 또는 410** — Vercel body 경유 업로드 **잔존 0건** |
| AC-15 | layout | `/dashboard/contracts` | 페이지 로드 | `dashboard/layout` 하위 · **`DashboardPresenceTrack` 상속** (plan 49) |

---

## 범위 (In / Out)

### In Scope

- **업로드 transport 전환:** Signed upload URL 2단계
  1. `POST /api/contracts/[id]/attachments/prepare` — admin 검증, 용량·중복·총량, `storage_path` 발급, signed upload URL 반환
  2. Browser `PUT` (또는 Supabase client upload) → Storage **직접**
  3. `POST /api/contracts/[id]/attachments/complete` — object 존재·크기·path prefix 검증, DB insert, 실패 시 Storage remove
- **FE:** `service.ts` — prepare/PUT/complete 오케스트레이션; `mutations.ts` `uploadContractAttachmentMutation` **유지**(내부만 변경)
- **UX:** `contract-edit-sheet.tsx` — **저장 클릭 시** PATCH → `selectedFiles` 순차 업로드; 성공 toast·form reset·Sheet 닫기; 실패 시 partial `selectedFiles`·`notifyError` **기존과 동일**
- **BE:** `service.server.ts` — prepare/complete 함수 분리; `buildContractAttachmentStoragePath` **서버 단독** 생성
- **Activity log:** `contract.attachment_upload` — prepare **실패** + complete **성공/실패** (prepare 성공은 로그 Out)
- **E2E/API spec:** `e2e/helpers/contracts.ts` · `attachments-size*.spec.ts` — prepare+PUT+complete 경로로 갱신
- **구 Route 제거:** `POST /api/contracts/[id]/attachments` FormData handler

### Out Scope

- 용량 정책 변경 (plan 38 **10MB/50MB** 유지)
- TUS resumable upload
- Storage RLS INSERT policy·browser service role
- 다운로드·inline 열기·bulk ZIP transport (plan 33·48 — **회귀만**)
- my-contracts 업로드 UI/API (plan 41)
- announcements·기타 feature Storage 업로드
- 신규 `ActivityAction` 코드
- prepare 후 complete 미호출 orphan **주기 sweep** (Q2-A: complete 실패 시에만 즉시 remove)
- SQL migration (signed URL은 service role 발급 — bucket/RLS **변경 없음**)

---

## 업로드 흐름 (확정)

```txt
[저장 클릭]
  → PATCH /api/contracts/[id] (기존)
  → for each selectedFile (순차):
       POST …/attachments/prepare { fileName, fileSize, contentType }
       → 실패: notifyError, selectedFiles partial 유지, 중단
       PUT signedUrl (body = file)  ← Vercel 미경유
       POST …/attachments/complete { storagePath, fileName, fileSize, contentType }
       → 실패: Storage remove(storagePath), notifyError, partial 유지, 중단
  → 전부 성공: notifySuccess, form.reset, selectedFiles=[], Sheet 닫기
```

- **prepare 성공**은 activity log **기록하지 않음**.
- signed URL **TTL**: 구현 시 **60~300초** (짧게, plan 구현에서 상수화).

---

## API / Service Layer

### 신규 Route

| Method | Path | Body | Response | Log |
|--------|------|------|----------|-----|
| POST | `/api/contracts/[id]/attachments/prepare` | JSON `{ fileName, fileSize, contentType? }` | `{ signedUrl, token?, storagePath, path }` | **실패 분기만** `contract.attachment_upload` |
| POST | `/api/contracts/[id]/attachments/complete` | JSON `{ storagePath, fileName, fileSize, contentType? }` | `{ success, contract, attachment }` **201** | **성공·실패** `contract.attachment_upload` |

### 제거 Route

| Method | Path | 비고 |
|--------|------|------|
| POST | `/api/contracts/[id]/attachments` | `request.formData()` **삭제** — AC-14 |

### prepare 검증 (서버)

1. `requireAdminSession`
2. contract 존재·`active`
3. `fileName` trim·non-empty
4. 파일명 중복 (plan 16·38)
5. `fileSize > PER_FILE_MAX` → 400
6. `active_total + fileSize > DOCUMENT_MAX` → 400
7. `storage_path = buildContractAttachmentStoragePath(contractId, fileName)`
8. `createSignedUploadUrl(storage_path, { upsert: false })` (service role)

### complete 검증 (서버)

1. admin·contract·path prefix `contracts/{contractId}/`
2. Storage object **head/stat** — 존재·size 일치
3. DB insert `contract_attachments` (기존 컬럼)
4. insert 실패 → Storage `remove([storagePath])`
5. 갱신된 contract 반환

### FE (`service.ts`)

```txt
uploadContractAttachment(id, file):
  prepare → fetch(signedUrl, { method: 'PUT', body: file, headers: { Content-Type } })
  → complete
```

- `mutations.ts` `uploadContractAttachmentMutation` + `onSettled` invalidate **유지**.

---

## 활동 감사 로그

> `core-conventions.mdc` §활동 감사 로그 · 참조 [plan 08](./08_activity-audit-log-plan.md)

**신규 action 없음.** `contract.attachment_upload` 재사용.

### 기록 연동

| Route | action | 기록 분기 |
|-------|--------|----------|
| `POST …/attachments/prepare` | `contract.attachment_upload` | 401 · 403 · 400 (validation·per-file·total·duplicate) · 404 · **200 성공 Out** · 500 |
| `POST …/attachments/complete` | `contract.attachment_upload` | 401 · 403 · 400 (validation·path·size mismatch) · 404 · **201** · 500 |

- prepare **200**은 로그 **Out** (Q4-B).
- complete **201**·**4xx/5xx**는 로그 **In**.
- metadata allowlist: `document_number`, `file_name`, `status`, `error_code`, `message` (plan 16).

### AC

- AC-13: mutation 후 `/dashboard/logs` 또는 `GET /api/activity-logs?action=contract.attachment_upload` 검증.

---

## UI 요구사항

### designer

- 레이아웃·컴ponent **신규 없음**.
- hint·toast·저장 흐름 **현행 유지** — transport만 변경.

### contract-edit-sheet

- 파일 선택: plan 38 FE 검증(per-file·total·duplicate) **유지**.
- 업로드 트리거: **`onSubmit` 성공 PATCH 후**만 — AC-08.
- 업로드 중: Button `isPending` / mutation loading **유지**.
- 성공: `notifySuccess` + `form.reset` + `selectedFiles=[]` + Sheet 닫기.
- 실패: `notifyError` + partial `selectedFiles` + Sheet **열린 상태** (기존).

---

## 영향 파일 & 패턴

| 파일 | 변경 |
|------|------|
| `src/app/api/contracts/[id]/attachments/prepare/route.ts` | **신규** |
| `src/app/api/contracts/[id]/attachments/complete/route.ts` | **신규** |
| `src/app/api/contracts/[id]/attachments/route.ts` | FormData POST **제거** |
| `src/features/contracts/api/service.server.ts` | prepare/complete 분리, signed URL |
| `src/features/contracts/api/service.ts` | prepare → PUT → complete |
| `src/features/contracts/api/mutations.ts` | mutationFn 경로만 (onSettled 유지) |
| `src/features/contracts/components/contract-edit-sheet.tsx` | 변경 최소 (service 경유) |
| `src/features/contracts/api/types.ts` | prepare/complete payload·response 타입 |
| `e2e/helpers/contracts.ts` | upload 헬퍼 2단계 |
| `e2e/contracts/attachments-size.api.spec.ts` | prepare+complete |
| `e2e/contracts/attachments-size.spec.ts` | 회귀 |
| `e2e/contracts/attachment-viewer.spec.ts` | 헬퍼 경유 시 회귀 |

**따라야 할 패턴:**

- 상수: `types.ts` plan 38 용량
- CUD: `mutations.ts` → `service.ts` → `/api/*` (바이너리 PUT만 Storage 직행)
- 캐시: `onSettled` → `contractKeys.all`
- Storage path: `contracts/{contractId}/{uuid}{ext}` **서버 발급**

---

## 리스크 & 완화책

| # | 리스크 | 완화 |
|---|--------|------|
| 1 | **HIGH:** signed URL PUT CORS/Content-Type 불일치 | Supabase Storage CORS·complete에서 size/object 검증; dev/prod smoke AC-01 |
| 2 | **HIGH:** complete 전 PUT만 하고 abandon → orphan | Q2 scope Out (sweep 없음); complete 실패 시 remove; residual orphan은 기존 SQL 41 cleanup과 동일 잔존 리스크 |
| 3 | **MED:** prepare→complete 사이 총량 race (동시 탭) | complete 시 **재검증** active total; plan 38과 동일 |
| 4 | **MED:** E2E 10MB multipart가 여전히 구 Route 호출 | 헬퍼·spec 전면 갱신; AC-14 grep |
| 5 | **LOW:** plan 33 bulk path 불일치 | `storage_path` 규칙 **변경 없음**; AC-12 |

**ROLLBACK:** prepare/complete Route 제거, FormData POST 복원 — prod 대용량 업로드는 재실패.

---

## 구현 순서 제안

1. BE `service.server.ts` prepare/complete + signed URL
2. Route prepare/complete + activity log 분기
3. 구 `attachments/route.ts` POST 제거
4. FE `service.ts` 오케스트레이션
5. E2E helper·spec 갱신
6. verifier: AC-01~15 · plan 38/33/41 회귀 · tsc · lint · build

---

## 팀 전달 요약

### — /designer 에게 —

- UI 변경 **없음**. hint·Sheet·저장 CTA **현행**. transport 변경만 BE/FE.

### — /backend-dev 에게 —

- `prepare`/`complete` Route + `createSignedUploadUrl` (service role)
- prepare: plan 38 검증 + signed URL; complete: object verify + DB insert + orphan remove
- activity log: prepare **실패만**, complete **전 분기**
- SQL **없음**

### — /frontend-dev 에게 —

- `service.ts`: prepare → fetch PUT → complete; `mutations.ts` invalidate 유지
- **저장 클릭 시** PATCH 후 순차 업로드 — 선택 즉시 업로드 **금지**
- Supabase client 직접 DB mutation **금지**

### — /verifier 에게 —

- AC-01~15 · plan 38 attachments-size spec green
- plan 33 bulk · plan 41 user 403 회귀
- AC-14 grep · build 통과 전 완료 보고 금지

---

## 열린 질문

| # | 질문 | 기본값 |
|---|------|--------|
| 1 | signed URL TTL 초 | **120초** |
| 2 | PUT 시 `Content-Type` | prepare 응답·complete 검증에 `contentType` 전달 |
| 3 | orphan sweep | **Out** (본 plan) — 필요 시 후속 |

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-09-22 | 최초 작성 · deep-interview 확정(Q1-A·Q2-A·Q3·Q4-B) · Status Approved | planner |
