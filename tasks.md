# Next Session Tasks

작성일: 2026-06-04 · 갱신: 2026-06-05

**plan 03** ([03_user-lifecycle-profile-plan.md](./docs/plans/03_user-lifecycle-profile-plan.md)) **Completed** — tsc · lint:strict · build · Playwright AC #1~#9(Realtime AC #4 포함) 통과. E2E 전 `node scripts/e2e-plan03-prep.cjs` 실행.

---

## 다음 후보 (미기획)

| 항목 | 비고 |
|------|------|
| 비활성 계정 **재활성화** | [04_user-reactivate-plan.md](./docs/plans/04_user-reactivate-plan.md) **Completed** |
| 첫 로그인 비밀번호 **강제** 변경 | 별도 plan |
| Playwright AC 자동화 | plan 03 — `scripts/e2e-plan03-template.js` · `e2e-plan03-prep.cjs` |

---

## 메모

- Vercel Production `SUPABASE_SERVICE_ROLE_KEY` 필수 (초대·비활성화 admin API).
- PR #8: `feat/user-invite-profiles` — plan 02 Completed.
- plan 03: `profiles.status`, 소프트 딜리트, 프로필 Security Sheet, `lower(email)` UNIQUE.


