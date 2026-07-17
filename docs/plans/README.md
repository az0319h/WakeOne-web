# 기획 문서 (`docs/plans/`)

`supabase/sql/`와 같이 **접두 번호**로 순서·시기를 파악한다.

## 문서 메타 (필수 — 파일 상단)

기획서·SQL **최상단**에 아래 블록을 둔다. 에이전트는 **Status**로 다음 작업 여부를 판단한다.

```md
> Date: YYYY-MM-DD
> Status: Completed | In Progress | Approved | Cancelled
> Author: planner | backend-dev | …
```

| Status | 의미 |
|--------|------|
| **Completed** | 기획·구현·원격 Supabase migration까지 완료. 후속 plan으로 넘김 |
| **In Progress** | 구현·SQL 적용은 됐으나 AC/Playwright 등 **검증 미완** |
| **Approved** | 기획만 승인, **구현 전** |
| **Cancelled** | 폐기·롤백. 번호는 재사용하지 않음 |

대응 SQL: `supabase/sql/NN_*.sql` 상단에 동일 **Status** + `Plan: NN_*-plan.md` 링크.

## 파일명 규칙

```
{NN}_{feature-slug}-plan.md
```

| 부분 | 규칙 | 예 |
|------|------|-----|
| `NN` | 두 자리 순번 (`01`, `02`, …). **기존 최대값 + 1** | `01`, `02` |
| `feature-slug` | kebab-case, 영문 | `supabase-auth-login` |
| 접미사 | 항상 `-plan.md` | — |

**신규 문서:** `docs/plans/`에서 `NN_` 접두 최대값을 찾은 뒤 **+1** (중간 번호 재사용·삭제된 번호 채우기 금지).

**취소·폐기:** 파일 삭제. 번호는 재사용하지 않는다 (감사·히스토리용).

## 현재 등록

| 번호 | 파일 | Status |
|------|------|--------|
| 01 | [01_supabase-auth-login-plan.md](./01_supabase-auth-login-plan.md) | **Completed** · PR #7 merge |
| 02 | [02_user-invite-profiles-plan.md](./02_user-invite-profiles-plan.md) | **Completed** |
| 03 | [03_user-lifecycle-profile-plan.md](./03_user-lifecycle-profile-plan.md) | **Completed** · tasks §0~§4 |
| 04 | [04_user-reactivate-plan.md](./04_user-reactivate-plan.md) | **Completed** · 재활성화 + Users mutation `onSettled` |
| 05 | [05_profile-completion-plan.md](./05_profile-completion-plan.md) | **Completed** · 프로필 조직 cascade·권한 분리 |
| 06 | [06_users-profile-modal-plan.md](./06_users-profile-modal-plan.md) | **Completed** · Users 아바타 컬럼·프로필 조회 Dialog |
| 07 | [07_auth-route-guard-plan.md](./07_auth-route-guard-plan.md) | **Completed** · dashboard/API 인증·인가 defense in depth |
| 08 | [08_activity-audit-log-plan.md](./08_activity-audit-log-plan.md) | **Approved** · CUD activity log · `/dashboard/logs` |
| 09 | [09_profile-phone-birthday-plan.md](./09_profile-phone-birthday-plan.md) | **Approved** · 연락처 11자리·생일 Calendar · SQL `11` |
| 10 | [10_dashboard-birthday-profile-sheet-plan.md](./10_dashboard-birthday-profile-sheet-plan.md) | **Approved** · overview 생일 배너·컨페티·프로필 Sheet |
| 11 | [11_password-policy-set-password-removal-plan.md](./11_password-policy-set-password-removal-plan.md) | **Approved** · 비밀번호 정책·set-password 제거 |
| 13 | [13_office-snack-vote-plan.md](./13_office-snack-vote-plan.md) | **Approved** · 사무실 간식 투표 · wake/admin RBAC |
| 14 | [14_delete-confirm-dialog-plan.md](./14_delete-confirm-dialog-plan.md) | **Completed** · 삭제 확인 `AlertModal` 전역 규칙 |
| 15 | [15_asset-ledger-plan.md](./15_asset-ledger-plan.md) | **Cancelled** · 비품 대장 — [23](./23_asset-ledger-removal-plan.md)로 폐기 |
| 16 | [16_contract-management-plan.md](./16_contract-management-plan.md) | **Approved** · 계약서 관리 · admin-only 첨부/독촉 |
| 17 | [17_user-management-add-flow-plan.md](./17_user-management-add-flow-plan.md) | **Approved** · 사용자 관리 개편 · 사용자 추가 흐름 변경 |
| 18 | [18_contract-approved-at-plan.md](./18_contract-approved-at-plan.md) | **Approved** · 계약서 문서승인일 정식 필드화 |
| 19 | [19_user-single-name-plan.md](./19_user-single-name-plan.md) | **Approved** · 이름 단일 필드(`full_name`) 전환 · 관리자 전용 이름 수정 |
| 20 | [20_contract-reminder-email-plan.md](./20_contract-reminder-email-plan.md) | **In Progress** · 계약서 첨부 메일 독촉 · Cron · system-email-logs |
| 21 | [21_user-profile-slim-migration-plan.md](./21_user-profile-slim-migration-plan.md) | **Approved** · 프로필 슬림화 · 본인 수정 폐지 · SQL `27` |
| 22 | [22_users-table-birthday-edit-init-plan.md](./22_users-table-birthday-edit-init-plan.md) | **Approved** · Users 테이블 생일 컬럼 · 수정 Sheet 초기값 · plan 09 AC #8 대체 |
| 23 | [23_asset-ledger-removal-plan.md](./23_asset-ledger-removal-plan.md) | **Completed** · 비품 대장 완전 제거 · SQL `30` |
| 25 | [25_activity-logs-ui-improvement-plan.md](./25_activity-logs-ui-improvement-plan.md) | **Approved** · 활동 로그 UI 한국어·admin Combobox · plan 08 확장 |
| 26 | [26_loading-spinner-unification-plan.md](./26_loading-spinner-unification-plan.md) | **Approved** · overview 제외 dashboard Read 로딩 Spinner 통일 · plan 12 supersede |
| 27 | [27_in-app-notifications-user-update-plan.md](./27_in-app-notifications-user-update-plan.md) | **Approved** · 인앱 알림 MVP · user.update Realtime · admin notif_user 뷰어 · SQL `34` |

## 에이전트 참조

- **`/root`:** 전역 문서 확인 후 planner 호출. planner는 **이 README + 등록된 모든 plan**을 Phase 0에서 참조한다.
- 오케스트레이터·planner·verifier는 사용자가 지정한 **plan 파일 경로** 또는 `@docs/plans/01_...` 로 참조한다.
- `{feature}-plan.md` 슬러그만으로 자동 추측해 **신규 기획을 만들지 않는다** (`/run`·`/root` 시 필수).
