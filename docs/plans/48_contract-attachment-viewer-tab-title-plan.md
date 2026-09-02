# 계약·공지 첨부 Viewer 탭 제목 기획서

> Date: 2026-09-02
> Status: Approved
> Author: planner
> **선행:** [07](./07_auth-route-guard-plan.md), [16](./16_contract-management-plan.md), [38](./38_contract-attachment-size-limit-plan.md), [39](./39_announcements-plan.md), [41](./41_user-my-contracts-plan.md)

## 한 줄 요약

계약(admin·user 내 계약)·공지 첨부 「열기」 시 Chrome PDF 뷰어 탭 title=`download` 문제를 해결하기 위해, **Viewer HTML 페이지(RSC `metadata.title` = 원본 `file_name`)** + **same-origin iframe → 기존 download API `?disposition=inline`** 패턴을 3곳에 도입하고, `openContractAttachment` / `openMyContractAttachment` / `openAnnouncementAttachment`는 viewer URL로 새 탭을 연다.

---

## 선행 plan 참조

| Plan | Status | 관계 |
|------|--------|------|
| **07** | Completed | dashboard page·`/api/*` defense in depth — viewer page에도 **서버 RBAC/ownership 재검증** 필수 |
| **16** | Approved | admin 계약 첨부 download·inline·`canOpenContractAttachment` 기준 — download Route **재사용**, mutation **변경 없음** |
| **38** | Completed | inline 가능 판정(`isInlineOpenableAttachment`)·10MB/50MB — viewer page도 **동일 판정** |
| **39** | Approved | 공지 첨부 download = **전 authenticated** — viewer V3도 동일 auth |
| **41** | Approved | user 내 계약 첨부 열기 — **AC-07 supersede** (아래 명시) |

**plan 41 AC-07 supersede**

| 항목 | plan 41 (기존) | plan 48 (본 plan) |
|------|----------------|-------------------|
| AC-07 Then | 새 탭에서 inline 미리보기 | **동일** + **브라우저 탭 title에 원본 `file_name` 포함** (예: `계약서.pdf`) |
| 구현 | download API URL 직접 새 탭 | viewer page URL → iframe이 download API inline |

**중복 금지:** download Route Handler·Storage·첨부 CUD·bulk ZIP·알림 fan-out **변경 없음**. non-inline 첨부에 viewer page **제공하지 않음**.

---

## 목표 & 완료 기준

### 목표

- inline 가능 첨부(PDF·이미지 등, `canOpen*` / `isInlineOpenableAttachment` 기준) 「열기」 시 **브라우저 탭 제목이 원본 파일명**으로 표시된다.
- viewer page는 **서버에서 ownership/RBAC를 download Route와 동등하게 재검증**한 뒤에만 iframe을 렌더한다.
- non-inline 첨부는 기존과 같이 **다운로드만** 허용한다.
- 기존 download API regression 없이 **READ-only**로 완료한다.

### 완료 기준 (AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| AC-01 | Playwright | admin 로그인, 계약 상세에 **inline 가능** PDF 활성 첨부(예: `계약서.pdf`) | 「열기」 클릭 | **새 탭** URL이 `/dashboard/contracts/{contractId}/attachments/{attachmentId}/view`이고, **탭 title에 `계약서.pdf`**(원본 `file_name`)가 포함된다 |
| AC-02 | Playwright | `system_role=user`, 본인 `author_name` 매칭 계약, inline 가능 PDF 첨부 | 내 계약 상세 Sheet에서 「열기」 클릭 | **새 탭** URL이 `/dashboard/my-contracts/{contractId}/attachments/{attachmentId}/view`이고, **탭 title에 원본 `file_name`**이 포함된다 (**plan 41 AC-07 supersede**) |
| AC-03 | Playwright | authenticated user, 공지 상세 Dialog에 inline 가능 PDF 첨부 | 「열기」 클릭 | **새 탭** URL이 `/dashboard/announcements/{announcementId}/attachments/{attachmentId}/view`이고, **탭 title에 원본 `file_name`**이 포함된다 |
| AC-04 | Playwright | inline **불가** 활성 첨부(예: `.bin`, `canOpen*` false) | 상세 UI 확인 | 「열기」 버튼이 **비활성**이거나 **표시되지 않고**, 「다운로드」만 동작한다 |
| AC-05 | Playwright | user A 세션, user B의 매칭 계약 `contractId`·`attachmentId` | V2 viewer URL 직접 접근 | HTTP **403** 또는 **404** UI; iframe·PDF 미리보기 **미노출** |
| AC-06 | Playwright | `system_role=user` | V1 viewer URL(`/dashboard/contracts/.../view`) 직접 접근 | `/dashboard/overview` redirect 또는 접근 거부 UI; admin 계약 viewer **미노출** |
| AC-07 | API | 기존 download spec fixture | `GET /api/contracts/.../download?disposition=inline`, `GET /api/my-contracts/.../download?disposition=inline`, `GET /api/announcements/.../download?disposition=inline` | HTTP **200**, `content-disposition` inline·파일명 **회귀 없음** (download Route **미변경**) |

---

## 범위 (In / Out)

### In Scope

**3 viewer pages (RSC + iframe)**

| ID | 대상 | Viewer Route | iframe `src` (기존 API) | 서버 Auth |
|----|------|--------------|-------------------------|-----------|
| V1 | admin 계약 | `/dashboard/contracts/[contractId]/attachments/[attachmentId]/view` | `/api/contracts/{id}/attachments/{aid}/download?disposition=inline` | `requireAdminSession` + 활성 attachment 존재 |
| V2 | user 내 계약 | `/dashboard/my-contracts/[contractId]/attachments/[attachmentId]/view` | `/api/my-contracts/{id}/attachments/{aid}/download?disposition=inline` | `requireUserSession` + `assertMyContractAccess` + attachment 존재 |
| V3 | 공지 | `/dashboard/announcements/[announcementId]/attachments/[attachmentId]/view` | `/api/announcements/{id}/attachments/{aid}/download?disposition=inline` | `requireSession` + attachment 존재 |

**공통 viewer 동작**

- RSC `generateMetadata`: `title` = DB `file_name` (절대 시각·상대 시각 **해당 없음**).
- Client `AttachmentViewerFrame`: full-viewport same-origin `iframe` (`title={fileName}`, `className="h-dvh w-full border-0"`).
- viewer page 진입 시 `isInlineOpenableAttachment(content_type, file_name)` **서버 재확인** — 불가 시 400/404 또는 안내 UI (iframe 미렌더).

**FE 변경**

| 함수 | 변경 |
|------|------|
| `openContractAttachment` | inline 가능 시 **V1 viewer URL**로 `window.open`; download API URL 직접 열기 **제거** |
| `openMyContractAttachment` | inline 가능 시 **V2 viewer URL** |
| `openAnnouncementAttachment` | inline 가능 시 **V3 viewer URL** |
| `canOpenContractAttachment` / `canOpenAnnouncementAttachment` | **유지** — false면 「열기」 비활성·다운로드만 |
| 다운로드 버튼 | 기존 blob download flow **유지** (`disposition` 없음 = attachment) |

**신규 helper (FE)**

- `getContractAttachmentViewerUrl(contractId, attachmentId)`
- `getMyContractAttachmentViewerUrl(contractId, attachmentId)`
- `getAnnouncementAttachmentViewerUrl(announcementId, attachmentId)`

**BE (viewer RSC only)**

- download Route Handler **수정 없음** (재사용).
- viewer `page.tsx`: attachment metadata fetch (`file_name`, inline 가능 여부) + auth guard.
- contracts viewer: `requireAdminPage` 또는 동등 admin page guard (plan 16).
- my-contracts viewer: plan 41 `assertMyContractAccess` (IDOR 방지).
- announcements viewer: plan 39 authenticated session.

### Out Scope

- download Route·Storage·`Content-Disposition` 로직 변경
- 첨부 업로드/삭제·계약 CUD·bulk ZIP·공지 CUD
- non-inline 파일 viewer page 제공
- blob URL / `<object>` 등 **대안 뷰어 UX**
- `/dashboard/view/...` 단일 통합 viewer Route (auth 분기 복잡 — **Out**)
- activity log 신규 action
- SQL migration
- CSV/Excel export
- viewer 내 파일명 편집·주석·인쇄 UI (브라우저 기본 PDF 뷰어만)

---

## 권한 / RBAC

| Viewer | admin | user (매칭) | user (비매칭) | unauthenticated |
|--------|-------|-------------|---------------|-----------------|
| V1 contracts | ✅ | ❌ redirect/403 | ❌ | ❌ |
| V2 my-contracts | ❌ | ✅ (scope 내) | ❌ 403/404 | ❌ |
| V3 announcements | ✅ | ✅ | ✅ | ❌ |

- nav 숨김은 UX — **viewer page·download API 각각 서버 가드** (plan 07).
- V2는 list·detail·download와 **동일** `assertMyContractAccess` 재검증.

---

## UI 요구사항

### Viewer page (공통)

- **레이아웃:** dashboard shell **최소화** 또는 viewer 전용 lean layout — iframe이 viewport를 채운다.
- **metadata:** `generateMetadata({ title: fileName })` — 탭 title = 원본 파일명.
- **iframe:** `src` = 해당 download API `?disposition=inline` (same-origin).
- **접근성:** iframe `title={fileName}`; designer는 optional 상단 파일명 바(모바일 safe-area) **1안** 제시.
- **로딩:** viewer page `loading.tsx` — `PageLoadingSpinner variant="default"`.
- **에러:** 403/404/inline 불가 — 한국어 안내(예: 「첨부파일을 열 수 없습니다.」) + dashboard 복귀 링크.

### 기존 listing/detail (변경 최소)

- 「열기」 클릭 시 viewer URL 새 탭 — UI 문구·버튼 label **「열기」 유지**.
- `canOpen*` false — 기존과 동일하게 「열기」 숨김/비활성.

---

## API / Service Layer

### download Route (재사용 · 수정 없음)

| Method | Path | Guard |
|--------|------|-------|
| GET | `/api/contracts/[id]/attachments/[attachmentId]/download` | `requireAdminSession` |
| GET | `/api/my-contracts/[id]/attachments/[attachmentId]/download` | `requireUserSession` + `assertMyContractAccess` |
| GET | `/api/announcements/[id]/attachments/[attachmentId]/download` | `requireSession` |

### viewer RSC (신규)

| Path | Server fetch | Guard |
|------|--------------|-------|
| `src/app/dashboard/contracts/[contractId]/attachments/[attachmentId]/view/page.tsx` | `getContractAttachmentForDownload` | admin session + inline 가능 |
| `src/app/dashboard/my-contracts/[contractId]/attachments/[attachmentId]/view/page.tsx` | 동일 + `assertMyContractAccess` | user session |
| `src/app/dashboard/announcements/[announcementId]/attachments/[attachmentId]/view/page.tsx` | `getAnnouncementAttachmentForDownload` | authenticated |

### Feature 구조 (추가)

```txt
src/features/attachments/components/
  attachment-viewer-frame.tsx     — Client iframe wrapper

src/features/contracts/api/service.ts
  getContractAttachmentViewerUrl()
  getMyContractAttachmentViewerUrl()
  openContractAttachment()        — viewer URL
  openMyContractAttachment()      — viewer URL

src/features/announcements/api/service.ts
  getAnnouncementAttachmentViewerUrl()
  openAnnouncementAttachment()    — viewer URL

src/app/dashboard/contracts/[contractId]/attachments/[attachmentId]/view/
  page.tsx, loading.tsx

src/app/dashboard/my-contracts/[contractId]/attachments/[attachmentId]/view/
  page.tsx, loading.tsx

src/app/dashboard/announcements/[announcementId]/attachments/[attachmentId]/view/
  page.tsx, loading.tsx
```

---

## 활동 감사 로그

**activity log 해당 없음** — viewer page·download GET 모두 READ. plan 08·16·41·39 정책과 동일하게 **기록하지 않음**. CUD Route **없음**.

---

## 영향 파일 & 패턴

| 파일 | 변경 |
|------|------|
| `src/features/attachments/components/attachment-viewer-frame.tsx` | 신규 — iframe viewer |
| `src/features/contracts/api/service.ts` | viewer URL helper + `open*` 변경 |
| `src/features/announcements/api/service.ts` | viewer URL helper + `open*` 변경 |
| `src/app/dashboard/contracts/.../view/page.tsx` | 신규 V1 RSC |
| `src/app/dashboard/my-contracts/.../view/page.tsx` | 신규 V2 RSC |
| `src/app/dashboard/announcements/.../view/page.tsx` | 신규 V3 RSC |
| `contract-detail-sheet.tsx`, `contract-edit-sheet.tsx` | `openContractAttachment` 경유 (직접 변경 최소) |
| `my-contract-detail-sheet.tsx` | `openMyContractAttachment` |
| `announcement-attachment-list.tsx` | `openAnnouncementAttachment` |
| `e2e/contracts/attachment-viewer.spec.ts` | 신규 AC-01, AC-04, AC-06 |
| `e2e/contracts/my-contracts-viewer.spec.ts` | 신규 AC-02, AC-05 |
| `e2e/announcements/attachment-viewer.spec.ts` | 신규 AC-03 |

**SQL:** migration **불필요**.

---

## 리스크 & 완화책

| # | 리스크 | 완화 |
|---|--------|------|
| 1 | **HIGH** viewer RBAC 누락 → IDOR | download Route와 **동일** auth·ownership in RSC `page.tsx`; AC-05·AC-06 |
| 2 | **HIGH** inline 불가 파일 viewer 노출 | `canOpen*` FE 유지 + `isInlineOpenableAttachment` **서버 재확인**; AC-04 |
| 3 | **MED** iframe PDF same-origin 실패 | download Route에 `X-Frame-Options: DENY` **추가 금지**; same-origin만 |
| 4 | **MED** Playwright title assertion flaky | `waitForLoadState` + title regex에 **전체 file_name** |
| 5 | **LOW** 긴·특수문자 file_name metadata | DB 값 그대로; E2E는 ASCII+한글 샘플 |

---

## 구현 순서 제안

1. `AttachmentViewerFrame` + viewer URL helpers (`service.ts`)
2. V1 admin viewer page + `openContractAttachment` 변경
3. E2E AC-01 (checkpoint)
4. V2 my-contracts viewer + `openMyContractAttachment` + E2E AC-02·AC-05
5. V3 announcements viewer + `openAnnouncementAttachment` + E2E AC-03
6. AC-04·AC-06·AC-07 regression
7. tsc · lint · build

---

## E2E spec 구조

```
e2e/contracts/
  attachment-viewer.spec.ts      — AC-01, AC-04, AC-06 (admin)
  my-contracts-viewer.spec.ts    — AC-02, AC-05 (user · plan 41 AC-07 supersede)

e2e/announcements/
  attachment-viewer.spec.ts      — AC-03

e2e/contracts/attachments-size.api.spec.ts  — AC-07 regression (기존 spec 유지·보강)
e2e/announcements/attachments-size.api.spec.ts — AC-07 regression
```

- 셀렉터: `getByRole('button', { name: '열기' })` · `getByRole('button', { name: '다운로드' })` only.
- 새 탭: `const newPage = await context.waitForEvent('page')` → `await expect(newPage).toHaveTitle(/\.pdf$|{fileName}/)`.
- 인증: `storageState` 재사용.

---

## 팀별 전달 요약

### — designer —

- **UI 범위:** 3 viewer page 공통 레이아웃(iframe full-viewport) + optional 상단 파일명 바 1안. 에러 상태(403/404/inline 불가) 한국어 안내.
- **참고:** 기존 Sheet/Dialog 「열기」 버튼 UX **변경 없음** (label·위치 유지). dashboard lean shell vs full shell 결정.
- **Out:** PDF 툴바 커스텀·인쇄/주석 UI.

### — backend-dev —

- **범위:** viewer RSC `page.tsx` 3개 — metadata fetch + auth guard + inline 가능 검증. download Route **수정 없음**.
- **패턴:** plan 16 admin session, plan 41 `assertMyContractAccess`, plan 39 `requireSession`.
- **SQL:** 없음.
- **activity log:** 해당 없음 (READ-only).

### — frontend-dev —

- **범위:** `AttachmentViewerFrame`, viewer URL helpers, `open*` 3함수 → viewer URL. 기존 `canOpen*`·다운로드 flow 유지.
- **패턴:** feature-based · Server Component default · `'use client'`는 iframe wrapper만.
- **mutations.ts:** **변경 없음** (CUD 없음).

### — verifier —

- **AC:** plan 48 AC-01~07 전항목 Playwright/API.
- **회귀:** plan 41 AC-07 supersede — title assertion 추가. plan 16 admin contracts·plan 39 announcements download API spec green.
- **build:** tsc · lint · `bunx playwright test e2e/contracts/attachment-viewer.spec.ts e2e/contracts/my-contracts-viewer.spec.ts e2e/announcements/attachment-viewer.spec.ts` + 기존 download API spec.

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-09-02 | 최초 작성 · `/root` planner Phase 3+4 · Status Approved | planner |
