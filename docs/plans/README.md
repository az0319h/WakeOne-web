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
| 13 | [13_office-snack-vote-plan.md](./13_office-snack-vote-plan.md) | **Cancelled** · 사무실 간식 — [35](./35_office-snack-removal-plan.md)로 폐기 |
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
| 29 | [29_profile-name-live-display-plan.md](./29_profile-name-live-display-plan.md) | **Approved** · 프로필 `full_name` live 표시 · activity log join · NavUser Realtime · PUT `target_label` bugfix |
| 30 | [30_admin-user-phone-edit-plan.md](./30_admin-user-phone-edit-plan.md) | **Approved** · admin Users 연락처 필수 추가·수정 · plan 21/09 supersede · plan 27 알림 |
| 31 | [31_global-kbar-search-plan.md](./31_global-kbar-search-plan.md) | **Revised** · kbar nav synonym + RBAC page search + theme (entity search Out) |
| 32 | [32_wallet-kbcard-sync-plan.md](./32_wallet-kbcard-sync-plan.md) | **Approved** · KB카드 wallet sync active admin 요약·matched user 인앱 알림 · SQL `38` 예정 |
| 33 | [33_contract-bulk-download-plan.md](./33_contract-bulk-download-plan.md) | **Approved** · 계약서 첨부 ZIP 일괄 다운로드 · admin · 100건/200MB 상한 |
| 34 | [34_login-email-split-ux-plan.md](./34_login-email-split-ux-plan.md) | **Approved** · sign-in 이메일 로컬+도메인 Combobox · plan 01 UX 확장 · BE Out |
| 35 | [35_office-snack-removal-plan.md](./35_office-snack-removal-plan.md) | **Completed** · 사무실 간식 완전 제거 · SQL `39` · plan 13 Cancelled |
| 36 | [36_password-reset-otp-plan.md](./36_password-reset-otp-plan.md) | **In Progress** · 비밀번호 찾기 OTP · 수동 QA 완료 · verifier Out |
| 37 | [37_notifications-read-optimistic-update-plan.md](./37_notifications-read-optimistic-update-plan.md) | **Completed** · 알림 read/read-all optimistic update · plan 27 FE cache 확장 · BE Out |
| 38 | [38_contract-attachment-size-limit-plan.md](./38_contract-attachment-size-limit-plan.md) | **Completed** · 계약 첨부 파일 10MB·문서 총량 50MB · SQL `40` · plan 16 AC supersede |
| 39 | [39_announcements-plan.md](./39_announcements-plan.md) | **Approved** · 공지사항 Overview nav·Dialog UX·첨부·create 1회 fan-out · SQL `41`·`42` |
| 40 | [40_filter-shell-loading-ux-plan.md](./40_filter-shell-loading-ux-plan.md) | **Approved** · listing filter shell 유지·data body만 Spinner · plan 26 TBD 후속 · BE Out |
| 41 | [41_user-my-contracts-plan.md](./41_user-my-contracts-plan.md) | **Approved** · user 내 계약서 READ-only · `/dashboard/my-contracts` · 이름 매칭 |
| 42 | [42_cs-support-plan.md](./42_cs-support-plan.md) | **Approved** · CS 문의 listing+Sheet · status 워크플로 · user pending 수정 · SQL `45` · dev-checklist |
| 43 | [43_cs-support-comments-notifications-plan.md](./43_cs-support-comments-notifications-plan.md) | **Approved** · CS 문의 임의 깊이 댓글/대댓글 · Realtime · soft delete · 알림 fan-out · dev-checklist · verifier Out |
| 44 | [44_force-initial-password-change-plan.md](./44_force-initial-password-change-plan.md) | **Approved** · 초기 PW 12341234a 강제 변경 · HttpOnly 쿠키 · middleware+layout 이중 · plan 17 supersede |
| 45 | [45_auth-session-audit-log-plan.md](./45_auth-session-audit-log-plan.md) | **Approved** · sign-in `auth.sign_in` activity log · plan 08 정책 확장 · 로그아웃 Out |
| 46 | [46_sign-in-seo-plan.md](./46_sign-in-seo-plan.md) | **Approved** · `/auth/sign-in` SEO · metadata·JSON-LD·모바일 intro · BE Out |
| 47 | [47_contract-import-notifications-plan.md](./47_contract-import-notifications-plan.md) | **Approved** · OpenClaw import 성공 시 admin·작성자 in-app 알림 · SQL `47` |
| 48 | [48_contract-attachment-viewer-tab-title-plan.md](./48_contract-attachment-viewer-tab-title-plan.md) | **Cancelled** · iframe viewer 새 탭 — [72](./72_contract-attachment-modal-viewer-plan.md)로 supersede |
| 49 | [49_live-users-presence-plan.md](./49_live-users-presence-plan.md) | **Approved** · overview Live 접속자 · Realtime Presence · SQL `49` · dashboard layout track |
| 50 | [50_live-users-admin-hide-live-dot-plan.md](./50_live-users-admin-hide-live-dot-plan.md) | **Approved** · Live 접속자 admin 목록 제외 · Live dot · plan 49 FE 확장 · BE Out |
| 51 | [51_wallet-balance-email-plan.md](./51_wallet-balance-email-plan.md) | **Approved** · 식대 잔액 확인 이메일·알림 설정·admin 로그 · allowlist BLOCKER · SQL `50`/`53` · **Rev 2026-09-16** due=0 no-run |
| 52 | [52_google-tasks-plan.md](./52_google-tasks-plan.md) | **Approved** · Google Tasks Read-only · Tasks 전용 OAuth · admin `tasks_user` proxy · SQL `54` |
| 53 | [53_contract-attachment-direct-upload-plan.md](./53_contract-attachment-direct-upload-plan.md) | **Approved** · 계약 첨부 signed URL 2단계 direct Storage · Vercel body 한도 우회 · plan 38 transport supersede |
| 54 | [54_google-tasks-cud-plan.md](./54_google-tasks-cud-plan.md) | **Approved** · Google Tasks CUD · 완료/정렬/move · write scope · task activity log |
| 55 | [55_wallet-balance-email-admin-dual-slot-plan.md](./55_wallet-balance-email-admin-dual-slot-plan.md) | **Approved** · 식대 잔액 이메일 admin run 요약 알림 · 2회 KST 슬롯 · plan 51 확장 · SQL `55` |
| 56 | [56_wallet-balance-email-slot-copy-plan.md](./56_wallet-balance-email-slot-copy-plan.md) | **Approved** · 슬롯별 이메일·인앱 고정 카피 · metadata.slot · plan 51/55 확장 · SQL 없음 |
| 57 | [57_google-auth-approval-migration-plan.md](./57_google-auth-approval-migration-plan.md) | **Approved** · Google 로그인 전용 전환 · 신규 사용자 승인 대기 · password 기능 제거 · active-only 이름 매칭 · 이메일 발송 금지 |
| 58 | [58_approval-birthday-optional-user-add-removal-plan.md](./58_approval-birthday-optional-user-add-removal-plan.md) | **Approved** · 승인 시 생일 미설정 · overview 생일 배너 null 제외 · 사용자 추가 UI/API 제거 |
| 59 | [59_google-auth-admin-notif-activity-log-result-plan.md](./59_google-auth-admin-notif-activity-log-result-plan.md) | **Approved** · 활동 로그 302/303 「리다이렉트」 · Google pending 최초 admin 인앱 알림 · SQL `57` |
| 60 | [60_legal-docs-alignment-plan.md](./60_legal-docs-alignment-plan.md) | **Approved** · 이용약관·개인정보처리방침 Google 승인제·기능·위탁 현행화 · FE 2파일 · BE Out |
| 63 | [63_org-chart-admin-profile-plan.md](./63_org-chart-admin-profile-plan.md) | **Approved** · Read-only 조직도 d3 · profile position/leader · admin org 슬림 · SQL `63` |
| 67 | [67_org-chart-pdf-download-plan.md](./67_org-chart-pdf-download-plan.md) | **Approved** · 조직도 PDF 다운로드 · pdfkit 박스+연결선 · org_chart.download log · desktop only |
| 68 | [68_org-chart-person-hover-contact-plan.md](./68_org-chart-person-hover-contact-plan.md) | **Approved** · 조직도 desktop person hover 연락처 카드 · GET org-chart email/phone · Read-only |
| 69 | [69_org-chart-mobile-tree-plan.md](./69_org-chart-mobile-tree-plan.md) | **Approved** · 조직도 mobile ReUI Tree · drill-down 제거 · `<md` only · FE only · Read-only |
| 70 | [70_dev-user-provision-plan.md](./70_dev-user-provision-plan.md) | **Approved** · dev-only 사용자 사전 등록 · WAKEONE_ENV gate · Google OAuth active link |
| 71 | [71_org-chart-viewport-fill-plan.md](./71_org-chart-viewport-fill-plan.md) | **Approved** · 조직도 desktop D3 viewport fill · flex-1 min-h-0 · ResizeObserver fit · FE only · Read-only |
| 72 | [72_contract-attachment-modal-viewer-plan.md](./72_contract-attachment-modal-viewer-plan.md) | **Approved** · 계약·공지 첨부 Slack lightbox Dialog · react-pdf · embla carousel · plan 48 supersede |
| 73 | [73_benefits-url-filters-plan.md](./73_benefits-url-filters-plan.md) | **Approved** · 복지비 관리·내 복지비 nuqs URL 필터 · 이름 500ms debounce · FE only · plan 40 shell Out |
| 74 | [74_admin-my-benefits-proxy-plan.md](./74_admin-my-benefits-proxy-plan.md) | **Approved** · admin 내 복지비 타인 조회 · `benefits_user` + GET `/api/my-benefits` `user` · wallet 패리티 · Read-only |
| 75 | [75_benefits-admin-inactive-roster-plan.md](./75_benefits-admin-inactive-roster-plan.md) | **Approved** · 복지비 관리만 · 비활성 `deactivated_at` 월 기준 M≤D 노출 · M>D 제외 · 비활성 행 연한 빨강 |
| 76 | [76_hr-benefits-manager-access-plan.md](./76_hr-benefits-manager-access-plan.md) | **Completed** · wake `rank=인사팀` 복지비 관리 admin 동일 · HR nav 그룹 · 내 복지비 proxy Out |
| 77 | [77_benefit-document-manual-cancel-plan.md](./77_benefit-document-manual-cancel-plan.md) | **Completed** · benefit_documents soft cancel·복구 · 합계 제외 · 내 복지비 취소됨 표시 · import duplicate 유지 |
| 78 | [78_benefit-notifications-plan.md](./78_benefit-notifications-plan.md) | **Approved** · 복지비 3유형 등록·취소·복구 operations+applicant Realtime 알림 · SQL `77` 예정 |
| 79 | [79_benefits-month-floor-roster-window-plan.md](./79_benefits-month-floor-roster-window-plan.md) | **Completed** · 조회 월 `2026-10`~당월 · 범위 밖→당월 · 관리 명단 `created_at`~퇴사 월 윈도우 · plan 75 활성 무관 노출 supersede |
| 80 | [80_benefit-fitness-target-month-plan.md](./80_benefit-fitness-target-month-plan.md) | **Approved** · 체력증진비 Flex「해당 월」import 파싱 · `benefit_month` + generated `attributed_month` 귀속 월 집계 · 두 화면 해당 월 표시 · SQL `79` (dev만) |
| 81 | [81_kanban-google-tasks-plan.md](./81_kanban-google-tasks-plan.md) | **Approved** · `/dashboard/kanban` Google Tasks 멀티리스트 칸반 · 로그인 Tasks scope · plan 52/54/57 supersede · SQL `83` |
| 82 | [82_quick-request-plan.md](./82_quick-request-plan.md) | **Approved** · 퀵 MVP · UI superseded by [83](./83_quick-request-wizard-plan.md) · notify 501·DB 없음·대시보드 Out은 [89](./89_quick-workflow-dongbang-openchat-plan.md)이 supersede |
| 83 | [83_quick-request-wizard-plan.md](./83_quick-request-wizard-plan.md) | **Approved** · 4단계 퀵 배송 wizard · 무제한 경유 · 82 notify/RBAC 상속 · SQL 없음 · UI superseded by [86](./86_quick-request-kakao-redesign-plan.md) |
| 84 | [84_kanban-tasklist-rename-plan.md](./84_kanban-tasklist-rename-plan.md) | **Approved** · 칸반 tasklist 이름 수정 Dialog · plan 81 follow-up · SQL 없음 |
| 85 | [85_kanban-task-live-reorder-plan.md](./85_kanban-task-live-reorder-plan.md) | **Approved** · 미완료 task DnD만 리얼타임(같은/다른 목록) · drop 시 move 1회 · plan 81 follow-up · SQL 없음 |
| 86 | [86_quick-request-kakao-redesign-plan.md](./86_quick-request-kakao-redesign-plan.md) | **Approved** · 퀵 요청 카카오 스타일 단일 화면(PC 좌폼+우요약 · 모바일 하단바+Drawer) · THEMES 10종×light/dark · 83 UI/AC supersede · BE·SQL 없음 · 일부 AC·Out superseded by [87](./87_quick-request-goods-notes-address-picker-plan.md) |
| 87 | [87_quick-request-goods-notes-address-picker-plan.md](./87_quick-request-goods-notes-address-picker-plan.md) | **Approved** · 퀵 물품 크기 카드 · 사용자별 특이사항 칩 CRUD(10개·「동승 필요」 seed) · Daum embed 주소 검색 Dialog · 최근 주소 10개 · shadcn 5곳 · activity log 4 action · SQL `85` 예정 · 86 일부 supersede · r1: 물품 내용은 「기타」 선택 시에만 입력·필수 |
| 89 | [89_quick-workflow-dongbang-openchat-plan.md](./89_quick-workflow-dongbang-openchat-plan.md) | **Approved** · 퀵 업무 흐름 리뉴얼 · DB 저장·요청번호 `YYYY-NN` · 신규요청→접수→배차완료→승인·취소 · 소속 `dongbang`(동방특송) allowlist 서버 차단 · 오픈채팅 webhook 자동 발송(Bearer·재시도·다시 보내기) · `/dashboard/quick` 대시보드(최근 7일)·상세 · 구매물류팀 전체 조회 · SQL `89`(예정) · 82 notify 501·86 AC-13/16/22·87 AC-22 supersede |

## 에이전트 참조

- **`/root`:** 전역 문서 확인 후 planner 호출. planner는 **이 README + 등록된 모든 plan**을 Phase 0에서 참조한다.
- 오케스트레이터·planner·verifier는 사용자가 지정한 **plan 파일 경로** 또는 `@docs/plans/01_...` 로 참조한다.
- `{feature}-plan.md` 슬러그만으로 자동 추측해 **신규 기획을 만들지 않는다** (`/run`·`/root` 시 필수).
