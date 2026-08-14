# plan 41 — 개발자 자체 검증 체크리스트

> **Plan:** [41_user-my-contracts-plan.md](./41_user-my-contracts-plan.md)  
> **용도:** 이번 `/root` 파이프라인에서 **verifier Subagent 대신** 개발 완료 후 담당 개발자가 직접 수행  
> **완료 조건:** 아래 **필수** 항목 전부 체크 + **회귀** 항목 확인

---

## 0. 사전 준비

- [ ] `.env`에 E2E/로컬 테스트용 admin·user 계정 설정됨
- [ ] `npm run dev` (또는 `bun dev`)로 로컬 기동 가능
- [ ] 테스트용 계약 데이터: **매칭 A** (user `full_name` = `author_name`) · **비매칭 B** (다른 작성자) 각 1건 이상
- [ ] (선택) 동명이인 검증: `full_name` 동일한 active user 2명 + 해당 이름 `author_name` 계약

---

## 1. CLI (필수)

```bash
npx tsc --noEmit
npm run lint:strict   # 또는 프로젝트 lint 스크립트
npm run build
```

- [ ] **tsc** 통과
- [ ] **lint** 통과
- [ ] **build** 통과

---

## 2. Nav · 페이지 접근 (AC-01, AC-02, AC-10, AC-11, AC-14)

### 매칭 계약 ≥1 user

- [ ] 사이드바 Account에 **「내 계약서」** 표시 (AC-01)
- [ ] **「계약서 관리」**(admin 메뉴) **미표시**
- [ ] `/dashboard/my-contracts` — 제목 **「내 계약서」**, 설명 문구, 문서승인일 필터·검색·pagination 테이블 (AC-02)
- [ ] `/dashboard/contracts` 직접 접근 → `/dashboard/overview` redirect (AC-14)

### 매칭 계약 0건 user

- [ ] 사이드바에 **「내 계약서」** **없음** (AC-10)
- [ ] `/dashboard/my-contracts` 직접 접근 → overview redirect (AC-11)

### admin

- [ ] **「계약서 관리」** 유지 · **「내 계약서」** **없음**
- [ ] `/dashboard/my-contracts` → overview redirect

---

## 3. 목록 · 필터 · scope (AC-03, AC-04)

- [ ] 목록에 **매칭 계약만** 표시, 비매칭 B **없음** (AC-03)
- [ ] 문서승인일 범위 필터 → 범위 내 행만 (AC-04, plan 18과 동일)
- [ ] 검색(문서번호·작성자·계약대상) 동작
- [ ] pagination · perPage · sort 변경 시 **필터 shell 유지**, 목록만 Spinner (plan 40)

---

## 4. Read-only UI (AC-05)

user `/dashboard/my-contracts`에서 **없어야 함**:

- [ ] 행 수정·삭제
- [ ] 첨부 업로드·첨부 삭제
- [ ] 「첨부파일 없음」 지정/해제
- [ ] bulk ZIP 다운로드
- [ ] admin 전용 Import/독촉 CTA

**있어야 함:**

- [ ] 상세 보기(Sheet) 진입
- [ ] 첨부 **다운로드** · **열기**(PDF/이미지 → 새 탭)

---

## 5. 첨부 (AC-06, AC-07)

- [ ] **다운로드** — 원 파일명으로 저장 (AC-06)
- [ ] **열기** — PDF/이미지 새 탭 inline (AC-07, admin과 동일)

---

## 6. API · 권한 (AC-08, AC-09, AC-12)

### user 세션

- [ ] `GET /api/my-contracts` — 본인 매칭 목록만 200
- [ ] `GET /api/my-contracts/[타인계약id]` — **403** (AC-08)
- [ ] `GET /api/contracts` — **403** (plan 16 유지)
- [ ] `PATCH/DELETE /api/contracts/[id]` — **403** (AC-09)
- [ ] `POST /api/contracts/.../attachments` — **403**
- [ ] `GET /api/contracts/attachments/bulk-download` — **403** (plan 33)

### 동명이인 (AC-12, 정책 a)

- [ ] user X·Y 동일 `full_name` → `GET /api/my-contracts` **동일 집합**

### admin 세션

- [ ] `GET /api/my-contracts*` — **403**
- [ ] `GET /api/contracts` — 200 (기존 유지)

---

## 7. Admin 회귀 (AC-13)

- [ ] `/dashboard/contracts` — 「계약서 관리」·전체 목록·CUD/bulk UI **변경 없음**
- [ ] plan 16 핵심 플로우(목록·상세·첨부 admin) 스모크 1회

---

## 8. 이름 매칭 규칙 (1차 확정)

- [ ] `normalizePersonName` — trim · 연속 공백 1칸 · lowercase (독촉과 **동일**)
- [ ] `author_user_id` **미사용** (null legacy 행도 이름으로 매칭)
- [ ] import/backfill **미구현** (Out)

---

## 9. Activity log · BE Out

- [ ] 목록/상세/다운로드 GET — **activity_logs INSERT 없음**
- [ ] user용 **CUD Route 없음** (신규 mutation API 추가 안 함)
- [ ] SQL migration **없음** (1차)

---

## 10. (선택) Playwright

verifier 자동 실행은 생략. 여유 있으면:

```bash
npx playwright test e2e/contracts/my-contracts.spec.ts e2e/contracts/rbac.spec.ts
```

- [ ] spec green (작성된 경우)

---

## 11. 완료 보고 템플릿

개발 완료 시 아래를 PR/팀 채널에 붙여 전달:

```text
plan 41 개발자 검증 완료
- tsc/lint/build: ✅/❌
- AC-01~14 수동: ✅/❌ (실패 항목: …)
- admin 회귀: ✅/❌
- 동명이인 (AC-12): ✅/❌ / N/A
- E2E spec (선택): ✅/❌ / skip
- 비고: …
```

---

## 수정 이력

| 날짜 | 변경 |
|------|------|
| 2026-08-14 | `/root` — verifier 대신 개발자 자체 검증용 최초 작성 |
