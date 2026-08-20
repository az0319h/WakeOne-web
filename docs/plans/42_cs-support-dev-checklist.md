# plan 42 — 개발자 자체 검증 체크리스트

> **Plan:** [42_cs-support-plan.md](./42_cs-support-plan.md)  
> **용도:** `/root` 파이프라인에서 **verifier Subagent 대신** 개발 완료 후 담당 개발자가 직접 수행  
> **완료 조건:** 아래 **필수** 항목 전부 체크 + **회귀** 항목 확인

---

## 0. 사전 준비

- [ ] `.env`에 로컬 테스트용 **admin·user** 계정 설정됨
- [ ] `npm run dev` (또는 `bun dev`)로 로컬 기동 가능
- [ ] Supabase migration **`45_support_requests.sql`** 적용됨 (로컬/원격)
- [ ] (선택) E2E seed: user A 문의 2건 · user B 문의 1건 · status 각각 pending/received/completed

---

## 1. CLI (필수)

```bash
npx tsc --noEmit
npm run lint:strict
npm run build
```

- [ ] **tsc** 통과
- [ ] **lint** 통과
- [ ] **build** 통과

---

## 2. Nav · 진입점 (AC-01, AC-02, AC-03)

- [ ] sidebar Account에 **「CS 문의」** 표시 · 클릭 → `/dashboard/support` (AC-01)
- [ ] **admin·user 동일** nav 항목·동일 URL
- [ ] `/dashboard/support` — `pageTitle` **「CS 문의」** · **`pageHeaderAction`「문의하기」** only (AC-02)
- [ ] **nav-user** 드롭다운에 CS/문의하기 **없음** (AC-03)
- [ ] Overview·다른 dashboard 페이지에 **「문의하기」** 버튼 **없음**

---

## 3. Create Sheet (AC-04, AC-05, AC-06, AC-21, AC-22)

- [ ] **「문의하기」** → 우측 Sheet open
- [ ] 이름·이메일 = 세션 프로필 · **read-only/disabled** (AC-06)
- [ ] 제목&lt;2 또는 본문&lt;10 → Zod 에러 · 제출 차단 (AC-05)
- [ ] 유효 입력 저장 → 목록 1행 · status **접수대기** · toast · Sheet 닫힘 · **form reset** (AC-04)
- [ ] 모바일 viewport — 본문 scroll 후 **SheetFooter CTA 도달** (AC-21)
- [ ] create 경로 **Nodemailer/SMTP 호출 없음** (AC-22) — Network·서버 로그 확인

---

## 4. 목록 · infinite scroll · filter shell (AC-10, AC-14, AC-15)

### user

- [ ] **본인 문의만** 표시 · 타 user 문의 **없음** (AC-07)
- [ ] 컬럼: status Badge · title · created_at (submitter 컬럼 없음)

### admin

- [ ] **전체 user** 문의 표시 (AC-10)
- [ ] submitter name·email = **create 시 스냅샷** (프로필 변경 후에도 스냅샷 유지)
- [ ] **UserCombobox** · search · status multi-filter · 초기화 동작
- [ ] filter 변경 시 **filter shell 유지** · 목록만 Spinner (plan 40)

### 공통

- [ ] 11건+ seed 시 하단 scroll → lazy load · `PageLoadingSpinner variant="compact"` (AC-15)
- [ ] 행 클릭 → detail Dialog (AC-14)
- [ ] `?support={id}` URL → detail Dialog auto-open

---

## 5. User detail · edit gate (AC-08, AC-09, AC-13)

### status = 접수대기 (pending)

- [ ] detail Dialog — 제목·본문 **편집·저장** 가능 (AC-08)
- [ ] 저장 후 **「수정됨 {formatAbsoluteDateTimeKo(updated_at)}」** 표시
- [ ] status 변경 UI **없음** (AC-13)

### status = 접수됨 / 처리완료

- [ ] detail **read-only** · 수정 UI 없음 (AC-09)
- [ ] `PATCH` title/body API → **403**

---

## 6. Admin status workflow (AC-11, AC-12)

- [ ] admin detail — status **접수됨** 저장 → user listing Badge 갱신 (AC-11)
- [ ] admin detail — status **처리완료** 저장 (AC-12)
- [ ] `completed` 이후 **재오픈 UI 없음**
- [ ] API: `pending`→`completed` 직접 변경 → **403**
- [ ] API: `completed`→`received`/`pending` → **403**
- [ ] user 세션 status PATCH → **403** (AC-20)

---

## 7. API · RBAC (AC-07, AC-16~AC-20)

### user 세션

- [ ] `GET /api/support` — 본인 rows only 200
- [ ] `GET /api/support/[타인id]` — **403/404**
- [ ] `POST /api/support` — 201 · `support.create` log (AC-16)
- [ ] `PATCH /api/support/[own pending id]` title/body — 200 · `support.update` (AC-17)
- [ ] `PATCH /api/support/[own received/completed id]` — **403** (AC-18)

### admin 세션

- [ ] `GET /api/support` — 전체 rows · `submitted_by` filter 동작
- [ ] `PATCH /api/support/[id]` status — 200 · `support.status_update` (AC-19)
- [ ] `PATCH /api/support/[id]` title/body — **403**

### 미인증

- [ ] `POST/PATCH /api/support*` — **401** + activity log

---

## 8. Activity log (plan 08)

- [ ] `POST` create — 전 분기(401/400/201/500) log · `x-request-id` 헤더
- [ ] user `PATCH` update — 전 분기 log
- [ ] admin `PATCH` status — 전 분기 log
- [ ] metadata에 **본문 전문·password·token 없음**
- [ ] create 2xx metadata: `support_request_id` · truncated `title` · `body_length`
- [ ] status 2xx metadata: `previous_status` · `new_status`
- [ ] GET list/detail — **INSERT 없음**

---

## 9. 회귀

- [ ] plan 39 `/dashboard/announcements` — 목록·Dialog·admin CUD **스모크 1회**
- [ ] nav-user — 프로필·알림·비밀번호·로그아웃 **변경 없음**
- [ ] `/dashboard/logs` — 기존 activity log UI **정상**

---

## 10. (선택) Playwright

verifier 자동 실행 **생략**(plan 42 Out). 여유 있으면 AC 기반 spec 추가 후:

```bash
bunx playwright test e2e/support/
```

- [ ] spec green / **skip**

---

## 11. 완료 보고 템플릿

```text
plan 42 개발자 검증 완료
- tsc/lint/build: ✅/❌
- AC-01~22 수동: ✅/❌ (실패: …)
- activity log API: ✅/❌
- email 미발송 확인: ✅/❌
- announcements 회귀: ✅/❌
- E2E spec (선택): ✅/❌ / skip
- 비고: …
```

---

## 수정 이력

| 날짜 | 변경 |
|------|------|
| 2026-08-18 | `/root` — verifier 대신 개발자 자체 검증용 최초 작성 |
