# plan 43 — 개발자 자체 검증 체크리스트

> **Plan:** [43_cs-support-comments-notifications-plan.md](./43_cs-support-comments-notifications-plan.md)  
> **용도:** `/root` 파이프라인에서 **verifier Subagent 대신** 개발 완료 후 담당 개발자가 직접 수행  
> **완료 조건:** 아래 **필수** 항목 전부 체크 + **회귀** 항목 확인

---

## 0. 사전 준비

- [ ] `.env`에 로컬 테스트용 **admin·user A·user B** 계정 설정됨
- [ ] `npm run dev` 또는 `bun dev`로 로컬 기동 가능
- [ ] Supabase migration **`45_support_requests.sql`** 적용됨
- [ ] Supabase migration **`46_support_comments_notifications.sql`** 적용됨 (로컬/원격)
- [ ] 테스트 문의: user A 문의 1건 이상, status `pending`/`received`/`completed` 각각 준비
- [ ] 두 브라우저 컨텍스트 또는 브라우저 2개로 user A와 admin 동시 접속 가능

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
- [ ] react-doctor 실행 및 치명 이슈 없음

---

## 2. DB · Migration

- [ ] `support_comments` 테이블 생성됨
- [ ] `parent_id`, `root_comment_id`, `path`, `depth` 컬럼 존재
- [ ] `is_deleted`, `deleted_at`, `deleted_by` soft delete 컬럼 존재
- [ ] `support_comments` Realtime publication 등록됨
- [ ] `notifications.type`에 support 관련 type 추가됨
- [ ] RLS: 문의 작성자 또는 admin만 댓글 SELECT 가능
- [ ] authenticated role의 직접 INSERT/UPDATE/DELETE는 차단됨

---

## 3. 댓글 CRUD

- [ ] user A가 본인 문의 detail Dialog에서 원댓글 작성 가능
- [ ] admin이 user A 문의 detail Dialog에서 원댓글 작성 가능
- [ ] user A가 본인 댓글 수정 가능
- [ ] user A가 admin 댓글 수정 불가
- [ ] admin은 타인 댓글 수정 불가
- [ ] user A가 본인 댓글 삭제 가능
- [ ] admin이 모든 댓글 삭제 가능
- [ ] user A가 admin 댓글 삭제 불가
- [ ] `completed` 상태 문의에서도 댓글 작성·수정·삭제 가능

---

## 4. 임의 depth · UI thread

- [ ] 원댓글 아래 답글 작성 가능
- [ ] 답글의 답글의 답글까지 여러 단계 작성 가능
- [ ] depth별 connector line과 들여쓰기가 보임
- [ ] 깊은 depth에서 데이터 depth는 유지되고 visual indent는 max 값으로 clamp됨
- [ ] 모바일 viewport에서 댓글 thread가 가로 overflow 없이 표시됨
- [ ] 삭제된 부모 댓글 아래 자식 답글이 유지됨

---

## 5. Realtime

- [ ] user A와 admin이 같은 support Dialog를 열고 있음
- [ ] user A 댓글 생성 → admin 화면에 새로고침 없이 표시
- [ ] admin 답글 생성 → user A 화면에 새로고침 없이 표시
- [ ] 댓글 수정 → 상대 화면에 새로고침 없이 수정 내용 또는 invalidate 결과 반영
- [ ] 댓글 삭제(soft delete) → 상대 화면에 placeholder로 반영
- [ ] 상태 변경은 Realtime으로 반영되지 않아도 됨 (plan Out)
- [ ] mutation 응답과 Realtime 수신이 중복 댓글을 만들지 않음

---

## 6. 알림

- [ ] user A 문의 등록 → active admin에게 `support.created` 알림 생성
- [ ] user A 문의 수정 → active admin에게 `support.updated` 알림 생성
- [ ] admin 상태 변경 → user A에게 `support.status_changed` 알림 생성
- [ ] user A 댓글/답글 작성 → active admin에게 댓글 알림 생성
- [ ] admin 댓글/답글 작성 → user A에게 댓글 알림 생성
- [ ] 본인이 수행한 액션은 본인에게 알림 생성되지 않음
- [ ] 댓글 수정/삭제는 알림 생성되지 않음
- [ ] 알림 preview는 UI에서 한 줄 `line-clamp-1`로 표시
- [ ] 알림 CTA 클릭 → `/dashboard/support?support={id}`로 이동하고 Dialog open
- [ ] 특정 댓글 스크롤은 동작하지 않아도 됨 (plan Out)

---

## 7. Activity log

- [ ] 댓글 생성 2xx → `support.comment_create` log + `x-request-id`
- [ ] 답글 생성 2xx → `support.comment_create` log + `parent_id` metadata
- [ ] 댓글 수정 2xx → `support.comment_update` log + `changed_fields`
- [ ] 댓글 삭제 2xx → `support.comment_delete` log + soft delete metadata
- [ ] 권한 없는 댓글 CUD 403 → 실패 log 기록
- [ ] GET comments는 activity log 생성 없음
- [ ] notification fan-out INSERT는 별도 activity log 없음
- [ ] metadata에 댓글 본문 전문·preview 전문·password·token 없음

---

## 8. 권한 · RBAC

### user A

- [ ] 본인 문의 댓글 조회 가능
- [ ] 본인 문의 댓글/답글 작성 가능
- [ ] 본인 댓글 수정/삭제 가능
- [ ] admin 또는 다른 user 댓글 수정 불가
- [ ] admin 댓글 삭제 불가

### admin

- [ ] 모든 문의 댓글 조회 가능
- [ ] 모든 문의 댓글/답글 작성 가능
- [ ] 모든 댓글 삭제 가능
- [ ] 타인 댓글 수정 불가

### user B

- [ ] user A 문의 댓글 목록 접근 시 403 또는 404
- [ ] user A 문의 댓글 생성/수정/삭제 직접 API 호출 시 403 또는 404

---

## 9. Soft delete · AlertModal

- [ ] 삭제 버튼 클릭 시 `AlertModal` 표시
- [ ] 취소 시 댓글 유지 · mutation 미실행
- [ ] 확인 시 hard delete가 아니라 `is_deleted=true`
- [ ] 삭제된 댓글 본문은 `삭제된 댓글입니다.` placeholder 표시
- [ ] 삭제된 댓글의 자식 답글은 유지
- [ ] `window.confirm` / `window.alert` 사용 없음

---

## 10. 회귀

- [ ] plan 42: `/dashboard/support` 목록·필터·infinite scroll 정상
- [ ] plan 42: 문의 등록 Sheet 정상 · form reset
- [ ] plan 42: user pending 문의 제목/본문 수정 정상
- [ ] plan 42: admin status workflow 정상
- [ ] plan 27: 알림 Popover·알림 페이지·읽음 처리 정상
- [ ] plan 37: 알림 읽음 optimistic update 정상
- [ ] `/dashboard/logs` activity log UI 정상

---

## 11. Cleanup

- [ ] 테스트용 support request 정리
- [ ] 테스트용 support_comments 정리 또는 soft delete 상태 확인
- [ ] 테스트용 notifications 정리 가능 범위 확인
- [ ] 테스트 계정 상태 원복

---

## 12. (선택) Playwright

verifier 자동 실행 **생략**(plan 43 Out). 여유 있으면 AC 기반 spec 추가 후:

```bash
bunx playwright test e2e/support/
```

- [ ] spec green / **skip**

---

## 13. 완료 보고 템플릿

```text
plan 43 개발자 검증 완료
- tsc/lint/build/react-doctor: ✅/❌
- DB/migration: ✅/❌
- 댓글 CRUD: ✅/❌
- 임의 depth UI: ✅/❌
- Realtime: ✅/❌
- 알림: ✅/❌
- activity log API: ✅/❌
- 권한/RBAC: ✅/❌
- soft delete/AlertModal: ✅/❌
- 회귀: ✅/❌
- E2E spec (선택): ✅/❌ / skip
- cleanup: ✅/❌
- 비고: …
```

---

## 수정 이력

| 날짜 | 변경 |
|------|------|
| 2026-08-20 | `/root` — verifier 대신 개발자 자체 검증용 최초 작성 |
