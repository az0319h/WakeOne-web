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
| 10 | [10_dashboard-birthday-profile-sheet-plan.md](./10_dashboard-birthday-profile-sheet-plan.md) | **Approved** · overview 생일 배너·컨페티·프로필 Sheet · **overview 배너 부분 superseded by [102](./102_overview-birthday-wheel-list-plan.md)** |
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
| 88 | [88_workflow-expense-plan.md](./88_workflow-expense-plan.md) | **Approved** · flex 워크플로우(전자결재) 대체 1단계 · 공통 양식 틀 + 지출결의서 seed · **조건부 필수**(클라이언트·서버 공유 규칙) · 문서함·결재·임시저장·중요·복제·PDF 인쇄 · 워크플로우 설정 · 앱 내 알림 6종 · RLS 강제 · SQL `86`~`88` 예정 |
| 89 | [89_quick-workflow-dongbang-openchat-plan.md](./89_quick-workflow-dongbang-openchat-plan.md) | **In Progress** · 퀵 업무 흐름 리뉴얼 · DB 저장·요청번호 `YYYY-NN` · 신규요청→접수→배차완료→승인·취소 · 소속 `dongbang`(동방특송) allowlist 서버 차단 · 오픈채팅 webhook 자동 발송(Bearer·재시도·다시 보내기) · `/dashboard/quick` 대시보드(최근 7일)·상세 · 구매물류팀 전체 조회 · SQL `89`(예정) · 82 notify 501·86 AC-13/16/22·87 AC-22 supersede |
| 90 | [90_quick-dashboard-permission-info-plan.md](./90_quick-dashboard-permission-info-plan.md) | **Completed** · 퀵 대시보드·상세 ⓘ 「퀵 권한 안내」(전원 동일 내용 · 조회 범위+할 수 있는 일) · 공용 `DescriptiveSection`에 `items`·`callout` 하위 호환 추가 · 「사용자 관리」 ⓘ 한국어화 · 공용 패널 영어 잔재 Out · FE only · BE·SQL·activity log 없음 |
| 91 | [91_pwa-web-push-notifications-plan.md](./91_pwa-web-push-notifications-plan.md) | **Completed** · PWA(manifest·아이콘·SW) + Web Push(VAPID) · 30종 전부 기본 ON · 9그룹 설정 · `push_subscriptions`·`push_notification_preferences` SQL `90` 예정 · 공용 `insertNotifications`+`after()` 발송 훅 · 프로필 「휴대폰 알림」 섹션 + 알림 페이지 배너/설정 Dialog · iOS 설치 배너 · 배지 · 로그아웃/비활성화 구독 삭제 · activity log 4 action · E2E mock 전송기 · 27 푸시 Out 번복 |
| 92 | [92_quick-web-only-notifications-plan.md](./92_quick-web-only-notifications-plan.md) | **Completed** (2026-10-27 · verifier: plan 92 AC spec green · tsc·lint·build·cleanup green · SQL `91` dev 적용) · **1단계: 루트 `middleware.ts`/`proxy.ts` 가드 파일 공존 정리 → `src/proxy.ts` 단일 통합(합집합 · dev/`next start` 가드 동일 · AC-26~30)** · 퀵 카카오톡(오픈채팅) 완전 제거(webhook·재발송 Route·발송 패널·상태 배지·경고 토스트·메시지 복사·env·e2e mock·`quick_request_openchat_dispatches` drop) · 웹 인앱 알림 일원화(동방 전원 모든 단계 · admin·구매물류팀 등록·취소 · 짧은 문구·연락처 제외 · type 2종 유지) · `quick_requests` Realtime 대시보드·상세 자동 갱신 · SQL 1건(번호 적용 직전 확인) · 89 일부 supersede · 순서 92 → 93 → 91 · AC 30 · **r2 사후 정정(2026-10-27)**: AC-29를 `guard-parity.api` + `access.spec` green으로 재정의(plan 57 폐기 spec 4건은 삭제 후속 과제 [TBD]) · 가드 401/403 `x-request-id` 정책 **OQ-4 열린 질문**(추천 (a) 헤더 추가 · 별도 소규모 후속 plan [TBD]) |
| 93 | [93_quick-request-chat-plan.md](./93_quick-request-chat-plan.md) | **Completed** (r3 · 2026-10-27 verifier · AC 37 green · 날짜 구분선 `yyyy-MM-dd`로 정정) · 퀵 요청 건별 실시간 채팅(카톡·인스타 DM 수준) · **참여자 모델: 건마다 요청자 본인 + active 동방특송 전원(+ 글 쓴 admin)** · 알림 = 보낸 사람 뺀 참여자 전원(접수 전/후·`accepted_by` 구분 폐기, 알림 양 증가 사용자 수용) · 화면 (c): 신규 `/dashboard/quick/chat` 「퀵 대화」 2단 Messenger + 상세 「요청 대화」(공용 컴포넌트) · 쓰기 요청자·동방·admin / 구매물류 읽기 · 승인·취소 건 읽기 전용 · 「새 대화 N」(대시보드·Messenger) + **사이드바 전체 안 읽은 배지**(동방은 전 건 합산, 90일 상한) + ✓✓ 읽음(상대편 1명 이상) + **채팅 알림 자동 읽음** · optimistic·재시도·날짜 구분선·묶음·「입력 중…」(다중 「A님, B님이 입력 중…」) · 빠른 답장 칩(채우기만) · `quick_request_messages`·`quick_request_message_reads` + RPC 3 + RLS + Realtime · type `quick_request.chat_message`(31종, 91 파일 append) · 전송 로그(본문 미기록)·읽음 갱신 로그 Out · AC 37 · 92 선행 필수 · 일부 superseded by [94](./94_quick-realtime-and-small-fixes-plan.md)(잠금 해제·알림 제목·Broadcast)·[98](./98_quick-chat-attachments-plan.md)(첨부)·[100](./100_quick-chat-ai-reply-suggestions-plan.md)(AI 칩)·[101](./101_quick-chat-participants-plan.md)(초대 참여자) |
| 94 | [94_quick-realtime-and-small-fixes-plan.md](./94_quick-realtime-and-small-fixes-plan.md) | **Completed** (2026-10-27 verifier · AC 23 green + 수동 QA 3 · 신규 `e2e/quick-round2/` 22 spec) · 퀵 2차 1/8 · 실시간 지연 해소(Vercel `icn1` `vercel.json` · 알림 `after()` · **Broadcast from Database** private topic 3종 · 폴링 fallback) · 푸시 클릭 `postMessage`+`router.push` · 표 행/카드 클릭 상세 · 「부가세 포함」 · 「자동차등록번호」 형식 검사 · 처리 이력 역순 · 수정 시 요청자 알림(`updated` · type 재사용) · 승인·취소 건 채팅 잠금 해제 · 채팅 푸시 제목 `{이름} · {번호}` · SQL `93` · AC 26 · 93 C-4/C-6/C-16·92 D-7 supersede |
| 95 | [95_dongbang-visibility-audit-plan.md](./95_dongbang-visibility-audit-plan.md) | **Completed** (2026-10-27 verifier · AC 12 green · 신규 `e2e/quick-round2/95-dongbang-visibility.spec.ts` 13 test · RSC push prefetch 동방 2그룹 누락 수정 · 감사표 S-16 보강) · 퀵 2차 2/8 · 동방특송 노출 범위 전수 감사 · 서버 기본 제외(`applyDongbangScope`) · 예외 3곳(사용자 관리·활동 로그 콤보·알림 타인 보기) · `insertNotifications` 동방 가드(퀵·프로필 2그룹) · 푸시 그룹 `dongbang_visible` · 감사표 13행 · SQL `94`(워크플로우 양식 RLS 4정책 · Dev 적용) · AC 12 · activity log 해당 없음 |
| 96 | [96_quick-preview-card-chat-bottom-align-plan.md](./96_quick-preview-card-chat-bottom-align-plan.md) | **Completed** (r1 · 2026-10-28 verifier · 신규 `e2e/quick-round2/96-preview-chat-align.spec.ts` 35/35 green · AC-07은 planner r1에서 「컨테이너 bottom ≤ 16px」 판정으로 교체 · 87/86 `<pre>` spec 교체 · 08-mobile·vendor-flow spec 레이스 보정) · 퀵 2차 3/8 · 미리보기 Dialog 구조화 카드(출발/도착 2칸·경유·칩 4종·footer 간격) · 텍스트 포맷터 삭제 · 채팅 말풍선 하단 정렬 · FE only · AC 11 · 87 AC-03/04·86 AC-13 `<pre>` 판정 supersede · **r1 2026-10-28**: AC-07을 컨테이너 bottom 기준(≤ 16px + 말풍선 < 입력창 top + 상단 빈 공간)으로 교체(입력창 기준 72px 폐기 · Out 영역) · verifier 재검증 대기 |
| 97 | [97_quick-period-filter-recent-address-split-phone-plan.md](./97_quick-period-filter-recent-address-split-phone-plan.md) | **Completed** · 퀵 2차 4/8 · 기간 7/30/90/전체 + 달력(기본 7일) · DB 페이지네이션 20건(10/20/50) · 카드 숫자 기간 연동 · 대화 목록 기간+커서 무한스크롤·시각 잘림 수정 · 최근 주소 출발/도착 분리(기존 삭제·상한 없음·10개 커서) · 전화 9~11자리(공통 `phone.ts`·DB CHECK 3곳·사용처 18파일) · SQL `95` · AC 25 · 89 D-14/AC-33·87 D2/AC-17·18·93 U-2 supersede |
| 98 | [98_quick-chat-attachments-plan.md](./98_quick-chat-attachments-plan.md) | **Completed** (2026-10-28 verifier · AC 22 green · AC-04 fixture `big-11mb.zip`) · 퀵 2차 5/8 · 채팅 파일 첨부(드래그앤드롭·클립 · 비공개 버킷 `quick-chat-attachments` Dev MCP 생성 · 2단계 서명 URL · 10MB·30개·이미지/pdf/문서/zip) · 이미지 격자+72 lightbox · 파일 카드(클립·파일명·확장자·다운로드) · 첨부만 전송 허용 · 알림 「사진 N장·파일 N개」 · 로그 3 action(파일명 금지) · SQL `96` · AC 22 · 93 C-9/C-15 supersede |
| 99 | [99_quick-place-keyword-search-plan.md](./99_quick-place-keyword-search-plan.md) | **Completed** (2026-10-28 verifier · 99+100 통합 · AC 15 중 14 green + 수동 QA 1(AC-14 사용자 이관) · spec `e2e/quick-round2/99-*` · 미설정 서버 AC-10 2/2) · 퀵 2차 7/8 · 주소 검색 Dialog 「장소 검색」 탭(카카오 로컬 키워드 · 서버 프록시 · 503 미설정 시 탭 숨김 · 분당 30회) · 선택 시 도로명+장소명 채움 · mock e2e · SQL 없음 · 로그 Out · AC 15 |
| 100 | [100_quick-chat-ai-reply-suggestions-plan.md](./100_quick-chat-ai-reply-suggestions-plan.md) | **Completed** (2026-10-28 verifier · 99+100 통합 · AC 16 중 15 green + 수동 QA 1(AC-15 사용자 이관 · 실키 2.3~2.7초 「2초 안」 사용자 결정 대기) · spec `e2e/quick-round2/100-*` 6개(mock·echo·fail·OFF 서버 분리) · SQL `98` Dev 적용) · 퀵 2차 8/8 · 채팅 AI 답장 추천(상대 메시지 도착 시 자동 · `claude-haiku-5-5` · 추천 4개 · 연락처·주소·이름 마스킹 · 사용자당 100회/일 원자 카운터 · 규칙 칩 fallback · 「AI 추천」 배지 · ⓘ·처리방침 고지) · SQL `98`(plan 본문 「97」은 밀림) · 로그 전 분기(본문 금지) · AC 16 · 93 C-14 확장 |
| 101 | [101_quick-chat-participants-plan.md](./101_quick-chat-participants-plan.md) | **Completed** (2026-10-28 verifier · AC 19 green · spec `e2e/quick-round2/101-*` 17/17) · 퀵 2차 6/8(실행 순서 98 다음) · 채팅 참여자 초대(요청자·admin · 후보 = active 직원 중 **동방·admin 제외** · r1 2026-10-28) · 참여자 목록에서 보기·추가·제외 · 초대된 사람은 상세 읽기·이전 기록·채팅·첨부 + 그 시점부터 알림 · 목록·제외·나가기(`AlertModal`) · 시스템 줄 · `can_view_quick_request`·RLS·RPC 확장 · `author_role` participant · 대시보드 「참여」 · 로그 2 action · SQL `97`(backend-dev 2026-10-28 Dev 적용 · plan 본문의 「98」은 당겨짐) · AC 19 · 93 C-2·89 권한 매트릭스 확장 |
| 102 | [102_overview-birthday-wheel-list-plan.md](./102_overview-birthday-wheel-list-plan.md) | **Completed** (r2 · 2026-10-29 verifier · AC 21 green · spec `e2e/birthdays/102-overview-birthday-list.spec.ts` 25 passed(셋업 4 + 21) 2회 연속 · 95 spec AC-04 추가 20 passed · `node --test` 28/28 · tsc·lint:strict·build 0 · cleanup remaining 0 · 무관한 기존 e2e 실패 9건은 후속 [TBD]) · overview 생일 카드 캐러셀 → **가운데 줄 강조 휠 목록**(A안) · 탭 전체/웨이크/산스/산스파운드리(r3 순서 변경 · 기본 전체 · 소속 없음은 전체만) · active·비동방·생일 등록 전원 · 오늘 기준 앞뒤 반년 순환(위 지난 생일 · 가운데 가장 가까운 생일 · 아래 나중 생일) · 줄 클릭 시 가운데 이동 · 컨페티는 오늘 생일자 있을 때만 브라우저당 하루 1번(`localStorage`) · `GET /api/birthdays` 신규(`month_day`·`days_offset`·`affiliation` · 연도 제거) · `this-month` 삭제 · `applyDongbangScope` · `embla-carousel-auto-height` 제거 · SQL 없음 · activity log 해당 없음 · AC 21 · plan 10 overview 배너 부분 supersede |
| 104 | [104_logout-this-device-only-plan.md](./104_logout-this-device-only-plan.md) | **Completed** (2026-10-29 verifier · AC 11 green · spec `e2e/auth/104-logout-this-device.spec.ts` 10/10 · tsc·lint:strict·build 0 · cleanup remaining 0 · M-1 실기기 확인 사용자 이관) · 로그아웃·Google callback 실패 정리 「이 기기만」(`scope: 'local'`) · 공용 `signOut` 기본 local · 비활성 처리(middleware·실시간 감지)는 `scope: 'global'` 명시 유지 · 「모든 기기 로그아웃」 버튼 없음 · DB·UI·activity log 없음 · AC 11 + 수동 QA 1 · designer 생략 권고 · 01/57/81 구현 정정 · 91 D-6 의도 회복 |
| 105 | [105_push-resume-after-relogin-plan.md](./105_push-resume-after-relogin-plan.md) | **Completed** (2026-10-29 verifier · spec `e2e/push-notifications/105-push-resume*.spec.ts` 19/19 · `node --test` 103/103 · 104 spec 10/10(AC-08·09 105 기준 갱신) · tsc·lint:strict·build 0 · cleanup remaining 0 · AC-06 B ON은 실제 201(plan 문구 200) · M-1~M-6 실기기 사용자 이관) · 로그아웃 후 **같은 계정 재로그인 시 휴대폰 알림 자동 복구** · 로그아웃 때 브라우저 구독(통로) 유지 + 서버 행만 삭제(실패 시 통로까지 해제) · 기기 `localStorage` 표시 = 「마지막으로 켠 계정」 hash · 재로그인 시 `getSubscription()`으로 제스처 없이 재등록(iOS WebKit 소스 확인) · 다른 계정은 켜지 않음 · 버튼 없이 로그아웃된 폰에 다른 계정 로그인 시 이전 사람 연결 detach(이전 사람 재로그인 시 복구) · 실패 시 대시보드 안내 줄 「다시 켜기」 · 토스트 「휴대폰 알림을 다시 켰어요」 · 비활성화 이력·타 계정 소유 409 · SQL 없음 · API: POST/DELETE subscriptions `source` + 신규 `POST …/subscriptions/detach` · activity log `push_subscription.detach` 1 action + `source` metadata · AC 20 + 수동 QA 6(안드로이드·아이폰 PWA) · 91 D-6/In 10/AC-17 일부 supersede · 104와 `signOut({scope, reason})` 병합 · 104 → 105 순서 권장 |

## 에이전트 참조

- **`/root`:** 전역 문서 확인 후 planner 호출. planner는 **이 README + 등록된 모든 plan**을 Phase 0에서 참조한다.
- 오케스트레이터·planner·verifier는 사용자가 지정한 **plan 파일 경로** 또는 `@docs/plans/01_...` 로 참조한다.
- `{feature}-plan.md` 슬러그만으로 자동 추측해 **신규 기획을 만들지 않는다** (`/run`·`/root` 시 필수).
