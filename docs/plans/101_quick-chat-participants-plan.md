# 퀵 채팅 참여자 추가(직원 초대 · 목록 · 제외 · 알림) 기획서

> Date: 2026-10-27
> Status: Completed
> Author: planner
> **퀵 2차(94~101) 중 6번째(실행 순서 기준 · 98 다음 · 99·100 앞).** 선행: [98](./98_quick-chat-attachments-plan.md) 완료 후. [93](./93_quick-request-chat-plan.md) 참여자 모델·[94](./94_quick-realtime-and-small-fixes-plan.md) Broadcast·[95](./95_dongbang-visibility-audit-plan.md) 동방 제외 원칙을 전제
> **SQL 예정:** `supabase/sql/98_quick_request_participants.sql`(앞 plan 번호에 따라 당겨질 수 있음 · 적용 직전 최대+1). Dev DB만
> **brief 항목:** 18(참여자 추가 · 신규)
> **확장:** [93](./93_quick-request-chat-plan.md) C-2(참여자 = 요청자 + 동방 전원 + 글 쓴 admin)에 **「초대된 직원」**을 더한다 · `author_role` 4종 · `resolveChatRecipients` 입력 확장 · `private.can_view_quick_request` 확장(초대된 사람은 그 건을 볼 수 있다) · 93 C-12 ✓✓ 상대편 정의에 참여자 포함
> **선행:** [08](./08_activity-audit-log-plan.md), [14](./14_delete-confirm-dialog-plan.md), [27](./27_in-app-notifications-user-update-plan.md), [89](./89_quick-workflow-dongbang-openchat-plan.md), [91](./91_pwa-web-push-notifications-plan.md), [93](./93_quick-request-chat-plan.md), [94](./94_quick-realtime-and-small-fixes-plan.md), [95](./95_dongbang-visibility-audit-plan.md), [98](./98_quick-chat-attachments-plan.md)

## 선행 plan 참조 (Phase 0)

| Plan | Status | 관계 |
|------|--------|------|
| **93** | Completed | 참여자는 「규칙으로 계산」(테이블 없음)이었다 → **초대 참여자만 테이블**로 두고 나머지(요청자·동방·admin)는 계속 규칙. `resolveChatRecipients({…, participantIds})` 확장 · `author_role` CHECK에 `participant` 추가 · 빠른 답장 칩 역할 추가 · ✓✓ 상대편(C-12): 내가 요청자/참여자면 동방+admin+**다른 참여자**, 내가 동방·admin이면 요청자+**참여자** |
| **89** | In Progress | 조회 범위(요청자 본인 / viewer-all)에 **「초대된 건」**을 더한다: `quick_requests` RLS SELECT·`listQuickRequestsForViewer`·`canViewQuickRequest`·상세 404 규칙. 초대된 사람은 **상세 읽기 + 채팅**만(접수·수정·승인·취소 버튼 없음 · 89 권한 매트릭스에 행 추가) |
| **94** | Approved | Broadcast topic `quick-request:{id}` 권한이 `can_view_quick_request`라 참여자도 자동 허용. `quick-user:{uid}` topic은 **요청자 기준**이라 참여자 대시보드 갱신은 안 됨 → 트리거가 **참여자 user마다** `quick-user:{participant}`에도 보낸다(SQL에서 participants 조회 · 활성 참여자 수만큼) |
| **95** | Approved | 초대 후보는 **active · 동방 제외 · pending 제외** (`applyDongbangScope`) |
| **98** | Approved | 첨부 RLS·Route 권한이 `can_view_quick_request`·쓰기 권한 helper를 쓰므로 참여자도 자동 포함(첨부 업로드 가능) |
| **91 · 27** | Completed | 초대·제외 알림은 type `quick_request.requester_event` 재사용(event `participant_invited`·`participant_removed`) · 채팅 알림은 참여자에게도 `chat_message` |
| **14** | Completed | 참여자 **제외**는 서버 데이터 삭제(soft) → **`AlertModal` 필수** · `window.confirm` 금지 |
| **08** | Approved | 신규 CUD Route 2(초대·제외) 전 분기 로그 |

### 정찰로 확인한 사실

| 항목 | 사실 | 근거 |
|------|------|------|
| 권한 함수 | `private.can_view_quick_request(uid, request_id)` = 요청자 OR `can_view_all_quick_requests` · 메시지·읽음·(98 첨부) RLS가 모두 이 함수 | SQL 92 L60~93 |
| 목록 RLS | `quick_requests` SELECT = 요청자 OR viewer-all(SQL 89 L307) · 서버 목록은 `canViewAllQuickRequests` 분기로 `requester_user_id = me` | `workflow.server.ts:109,259~` |
| 수신 규칙 | `resolveChatRecipients({requesterId, activeDongbangIds, adminParticipantIds, senderId, inactiveIds})` 순수 함수 + 단위 테스트 | `lib/resolve-chat-recipients.ts` |
| `author_role` | CHECK `('requester','dongbang','admin')` · `resolveChatAuthorRole(profile,row)` | SQL 92 · `messages.server.ts:76` |
| 헤더 | `quick-chat-header.tsx`(번호·상태·경로·「상세 보기」) · 상세 「요청 대화」는 제목만 | 93 U-3 |
| unread RPC | `quick_request_unread_total`·`unread_requests`가 `requester_user_id = p_user or can_view_all`로 범위 | SQL 92 L206·226 |
| 사용자 검색 API | `GET /api/users`는 **admin 전용**(403) → 요청자가 쓸 후보 검색 API가 없다 → 신규 `candidates` Route 필요 | `users/route.ts` |

---

## 한 줄 요약

요청자(와 admin)가 대화창에서 **「참여자 추가」**로 다른 직원을 그 건의 채팅에 초대한다. 초대된 직원은 **그 요청의 상세를 읽고, 이전 대화 전체를 보고, 메시지·첨부를 보낼 수 있으며**, 초대된 순간부터 **채팅 알림(인앱+푸시)**을 받는다. 참여자 목록을 보고, 초대한 요청자나 admin이 **제외**할 수 있다. 대화에는 「{이름}님이 참여했습니다 / 제외되었습니다」 줄이 남는다.

---

## 정책 확정안 (brief 18 · planner 결정)

| # | 항목 | 확정 |
|---|------|------|
| D-1 | 초대 권한 | **요청자 본인 · admin**. 동방특송·구매물류·참여자는 초대 불가(403 「참여자를 추가할 권한이 없습니다.」). 승인·취소 건에서도 초대 가능(94 잠금 해제와 일관) |
| D-2 (r1) | 초대 후보 | `profiles.status='active'` · 동방 제외(95) · **`system_role='admin'` 제외**(사용자 지시 2026-10-28 · admin은 모든 대화를 이미 열람할 수 있고 글을 쓰면 자동으로 참여자가 되므로 초대가 불필요) · 요청자·본인·이미 참여 중인 사람 제외. **후보 Route(`candidates`)와 초대 Route(`POST participants`) 양쪽에서 서버 측 제외**(클라이언트 필터 아님). 검색은 이름·이메일 부분 일치 · 최대 20건. ~~admin도 후보 가능~~ **(r1 폐기)** · 「초대 **하는** 권한(D-1 · 요청자·admin)」과 「후보가 **되는** 것(D-2)」은 별개다 — admin은 초대할 수 있지만 초대받을 수는 없다 |
| D-3 | 제외 권한 | **초대한 사람(요청자) · admin** · 참여자 본인 **나가기**도 허용(「대화 나가기」). 제외는 soft(`removed_at`·`removed_by`) · 재초대 시 같은 행 복구(`removed_at null` · `invited_at` 갱신) |
| D-4 | 참여자 권한 | 상세 페이지 **읽기**(모든 섹션) · 채팅 읽기·쓰기·첨부 · 대시보드 「나의 퀵 내역」에 **초대된 건 포함**(배지 「참여」) · 「퀵 대화」 목록 포함 · 접수·수정·승인·취소·초대 **불가** · 상세 액션바 없음 · `permissions` 전부 false + `isParticipant:true` |
| D-5 | 역할·표시 | `author_role='participant'` · 말풍선 배지 **「참여자」** · 빠른 답장 칩(참여자): 「확인했습니다」「연락 부탁드립니다」「감사합니다」「잠시만 기다려 주세요」 |
| D-6 | 알림 | ① 초대 시 초대받은 사람에게 1건: 제목 **`퀵 {no} 대화 초대`** · 본문 **`{초대한 사람}님이 대화에 초대했습니다. {경로}`** · 클릭 → `/dashboard/quick/chat?request={no}` · type `requester_event` · event `participant_invited` ② 제외 시 당사자 1건: **`퀵 {no} 대화에서 제외됨`** · `{행위자}님이 대화에서 제외했습니다.`(본인 나가기는 알림 없음) ③ 채팅 알림: `resolveChatRecipients`에 `participantIds`(활성·미제외) 추가 → **참여자도 보낸 사람 빼고 전원 수신** · 제외된 사람은 그 뒤 메시지 알림 없음 ④ 요청 상태 알림(접수·배차 등 92)은 참여자에게 **보내지 않음**(요청 당사자 아님) |
| D-7 | 이력 표시 | 메시지 목록에 **시스템 줄**(`quick-chat-divider` 스타일): 「{이름}님이 참여했습니다 · {절대 시각}」 / 「{이름}님이 제외되었습니다」 / 「{이름}님이 나갔습니다」 — `quick_request_participants` 행(`invited_at`·`removed_at`)을 메시지 시각 순에 끼워 **렌더 시 파생**(메시지 테이블에 쓰지 않음) |
| D-8 | 이전 기록 | 초대된 사람은 초대 **이전 메시지·첨부 전부** 열람(사용자 요구). 읽음 위치는 초대 시 0(전부 안 읽음) → 「여기부터 새 메시지」가 맨 위 · 안 읽은 수에 반영 |
| D-9 | UI | **(r1 확인 · 변경 없음)** 사용자 지시 「각 채팅 참여자 목록을 볼 수 있고, 그 목록에서 참여자를 추가할 수 있게」는 아래 내용과 이미 일치한다. 대화 헤더(Messenger·상세 「요청 대화」 모두)에 **「참여자 N」** 버튼 → `Popover`(lg↑) / `Drawer`(미만): 참여자 목록(요청자·동방 전원·참여 admin·초대 참여자 — 역할 배지 · 초대 참여자는 「초대: {이름}」 · 제외 버튼(권한자만)) + 「참여자 추가」 버튼(요청자·admin) → `Command` 검색 Combobox(후보 API · 300ms debounce) → 선택 즉시 초대(toast 「{이름}님을 초대했습니다.」) · 제외 → **`AlertModal`**(제목 「참여자 제외」 · 설명에 이름 · confirm 「제외」) · 본인 「대화 나가기」 → `AlertModal` |
| D-10 | 데이터 | `quick_request_participants (id, quick_request_id, user_id, invited_by, invited_at, removed_at null, removed_by null, unique(quick_request_id, user_id))` · RLS SELECT `can_view_quick_request` · 쓰기 service_role |
| D-11 | 권한 함수 | `private.can_view_quick_request` := 요청자 OR viewer-all OR **활성 참여자** · `quick_requests` SELECT 정책도 동일 조건 추가 · `unread_total`·`unread_requests`·`quick_request_last_messages` RPC의 범위 조건에 참여자 추가 · 서버 `canViewQuickRequest`·목록 쿼리(`or(requester_user_id.eq, id.in(참여 건))`) |
| D-12 | 동방 allowlist | 초대·제외·후보 Route는 `/api/quick-request/**`라 proxy는 통과 → Route에서 동방 **403**(D-1) |
| D-13 | 로그 | `POST participants`(초대) `quick_request.participant_add` · `DELETE participants/[userId]`(제외·나가기) `quick_request.participant_remove` · 전 분기 · metadata `{quick_request_no, participant_user_id, self:boolean, error_code}` · 후보 GET·목록 GET Read Out |

### 권한 매트릭스 추가 행 (89 §권한 매트릭스 확장)

| 동작 | 초대 참여자 |
|------|:-:|
| 상세·목록 조회 | **초대된 건만** |
| 채팅 읽기·쓰기·첨부 | O |
| 항목 수정·접수·배차·최종금액·승인·취소 | X |
| 참여자 초대 | X · 나가기 O |

---

## 목표 & 완료 기준 (AC)

공통: 계정 `user.json`(요청자) · `user2.json`(초대 대상 · wake 일반 직원) · `admin.json` · `dongbang.json` · `dongbang2` · `logistics.json`. 실시간 5초/8초.

| AC | 유형 | 전제 | 동작 | 기대 |
|----|------|------|------|------|
| AC-01 | Playwright | `user.json` 본인 건 · 메시지 3개 있음 | 상세 「요청 대화」 헤더 **「참여자 N」** 클릭 | 목록에 요청자(「요청자」)·동방 전원(「동방특송」) · 「참여자 추가」 버튼 · `dongbang.json` 세션에서는 「참여자 추가」 **없음** |
| AC-02 | Playwright·API | 〃 | 「참여자 추가」 → `user2` 이름 2자 입력 → 선택 | 후보에 user2 **있음** · 동방·요청자 본인·pending 사용자·**admin(`system_role='admin'`) 없음**(r1) · `GET …/participants/candidates?q={admin 이름}` 응답에도 admin **0건**(서버 측 제외) · 선택 → toast **「{user2 이름}님을 초대했습니다.」** · 목록에 user2(「참여자」·「초대: {요청자}」) · 대화에 시스템 줄 **「{user2 이름}님이 참여했습니다 · {절대 시각}」** · DB 행 1 · `POST …/participants` 201 |
| AC-03 | Playwright | AC-02 · `user2.json` | `/dashboard/notifications` → 「채팅 보기」 · `/dashboard/quick` · `/dashboard/quick/{번호}` · `/dashboard/quick/chat?request={번호}` | 알림 제목 **`퀵 {번호} 대화 초대`** · 클릭 → 「퀵 대화」 그 건 · 대시보드 「나의 퀵 내역」에 그 건(배지 **「참여」**) · 상세 200(읽기) · 액션바 버튼 **0** · 「수정」 0 · 대화에 이전 메시지 **3개 전부** · 「여기부터 새 메시지」가 첫 메시지 위 · 입력창·칩 4개(참여자 세트) |
| AC-04 | Playwright (2 context) | AC-03 · 요청자·동방 A 대화 열어 둠 | user2 「확인했습니다」 전송 | 201 · 배지 **「참여자」** · 요청자·동방 A 화면 5초 안 · 알림: 요청자 + 동방 전원 각 1건 · user2 0 |
| AC-05 | API·DB | AC-04 상태 | 요청자 메시지 → 동방 A 메시지 → admin 메시지 | 각각 user2 **1건씩** 수신(참여자 전원 규칙) · 순수 함수 단위 테스트 `participantIds` 케이스 4개 |
| AC-06 (r1) | API | `user2.json`(참여자) · `user.json`(요청자) | ① user2: `PATCH …/{번호}` · `accept` · `approve` · `cancel` · `POST …/participants {userId: 다른 직원}` ② user: `POST …/participants {userId: admin}` | ① 모두 **403** · 상세 `permissions` 전부 false · `isParticipant:true` ② **400 「초대할 수 없는 사용자입니다.」**(권한 403이 아니라 **후보 아님** · admin은 D-2 제외 대상) · DB 행 0 |
| AC-07 | API | `user.json` | `POST …/participants {userId: dongbang}` / `{userId: 본인}` / `{userId: user2}`(이미 참여) / `{userId: pending}` / `{userId: zzz}` | 400 「초대할 수 없는 사용자입니다.」 / 400 / **409** 「이미 참여 중입니다.」 / 400 / 404 |
| AC-08 | API | `dongbang.json`·`logistics.json`·`user2.json`(참여자) | `POST …/participants` · `GET …/participants/candidates?q=` | **403** 「참여자를 추가할 권한이 없습니다.」 · 후보 403 |
| AC-09 | Playwright·API | `user.json` | 참여자 목록 user2 「제외」 → **AlertModal**(「참여자 제외」 · 이름 포함) → 확인 | `DELETE …/participants/{user2}` 200 · 시스템 줄 「{user2}님이 제외되었습니다」 · user2 알림 **`퀵 {번호} 대화에서 제외됨`** · grep `window.confirm` 0 |
| AC-10 | API·Playwright | AC-09 · `user2.json` | 상세·대화·`GET …/messages` · 대시보드 | **404**(조회 불가) · 대시보드에 그 건 0 · 「퀵 대화」 0 · 이후 메시지 알림 0 |
| AC-11 | API | `user.json` | 같은 user2 재초대 | 201 · 같은 행 `removed_at null` · 시스템 줄 「참여했습니다」 다시 · user2 재열람 가능(이전 기록 전부) |
| AC-12 | Playwright | `user2.json`(참여 중) | 「참여자 N」 → 「대화 나가기」 → AlertModal 확인 | 200 · 시스템 줄 「{user2}님이 나갔습니다」 · 알림 **0** · 로그 metadata `self:true` |
| AC-13 | Playwright (2 context) | `user2.json` 대시보드·사이드바 열어 둠 | 요청자 메시지 | 5초 안에 「새 대화 1」·사이드바 배지 **1**(`quick-user:{user2}` topic) · 읽으면 0 |
| AC-14 (r1 유지) | Playwright | `admin.json` | 다른 사람 건에서 「참여자 추가」 → user2 초대 · 제외 · 후보 검색에 다른 admin 이름 입력 | 가능(201·200) · 시스템 줄 「초대: {admin}」 · 후보에 다른 admin **0건**. admin은 초대 **하는** 권한(D-1)은 있지만 후보가 **되지는** 않는다(D-2 r1) |
| AC-15 | Playwright (2 context) | 요청자·user2·동방 A | 요청자 메시지 → user2가 읽음 · 동방 A 미읽음 | 요청자 화면 ✓✓ **읽음**(상대편 = 동방+admin+참여자 중 1명) · tooltip user2 이름 |
| AC-16 | SQL (Dev MCP) | SQL 적용 | 함수·정책·CHECK | `can_view_quick_request` 본문에 participants 조건 · `quick_requests` SELECT 정책에 참여자 · `author_role` CHECK 4종 · `quick_request_participants` RLS SELECT · unread RPC 2종 범위 |
| AC-17 | Playwright·API | AC-02·09 | `/dashboard/logs` · `GET /api/activity-logs` | `quick_request.participant_add` 201·409·403 행 · `participant_remove` 200 행 · metadata `participant_user_id` · `self` |
| AC-18 | Playwright | 375 · `user.json` | 「참여자 N」 | `Drawer` 목록 · 추가 Combobox 키보드 가림 없음 · 터치 ≥ 44px · 가로 스크롤 없음 |
| AC-19 | CLI | — | `npx tsc --noEmit` · `npm run lint` · `npm run build` · `node --test …/resolve-chat-recipients.test.mjs` · `npx playwright test e2e/quick-chat e2e/quick-workflow e2e/quick-round2/101-*` | 통과(93 AC-21·22~25 수신 규칙 spec은 참여자 0인 상태에서 그대로 green) |

**AC 총 19개.**

---

## 범위 (In / Out)

### In
1. **SQL 98**: 테이블·RLS · `can_view_quick_request`·`quick_requests` SELECT 정책·unread RPC 2종·`quick_request_last_messages` 범위 확장 · `author_role` CHECK · 94 broadcast 트리거가 참여자 `quick-user` topic에도 송신
2. **Route**: `GET …/participants` · `POST …/participants {userId}` · `DELETE …/participants/[userId]`(제외·나가기) · `GET …/participants/candidates?q=` · 기존 `GET …/messages`에 `participants[]`·시스템 이벤트 · 상세 `permissions.isParticipant` · 목록 참여 건 포함(`viewer.scope`에 `participant` 건 표시용 플래그)
3. **서버 모듈** `participants.server.ts` · `resolveChatAuthorRole`(participant) · `resolveChatRecipients` 입력 확장 + 단위 테스트 · 알림 2 event · 칩 세트
4. **FE**: 헤더 「참여자 N」 Popover/Drawer · 목록·역할 배지 · 추가 Combobox(후보 API) · 제외/나가기 `AlertModal` · 시스템 줄 렌더(파생) · 대시보드 「참여」 배지 · 상세 읽기 전용(액션바 없음)
5. **activity log** 2 action + 라벨
6. **E2E** `e2e/quick-round2/101-*.spec.ts` · cleanup(participants)
7. README 101 · 89/93/94/98 수정 이력

### Out
| 항목 | 이유 |
|------|------|
| 참여자가 요청 항목 수정·상태 변경 | 책임 주체 유지(89) |
| 참여자에게 요청 상태 알림(접수·배차) | 요청 당사자 아님(D-6 ④) |
| 동방·구매물류의 초대 | 요청자·admin만 |
| 외부(비직원) 초대·링크 공유 | WakeOne 계정만 |
| 참여자 일괄 초대·그룹 | 1명씩 |
| 초대 수락/거절 | 즉시 참여(업무 도구) |
| Main DB | 사용자 수동 |

---

## UI 요구사항 (designer 지시)

| # | 화면 | 요구 |
|---|------|------|
| U-1 | 헤더 | 「상세 보기」 옆 `Button variant='outline' size='sm'` + `Icons.users` **「참여자 N」**(N = 요청자 1 + 동방 전원 + 참여 admin + 초대 참여자) · 상세 「요청 대화」 제목 오른쪽에도 동일 |
| U-2 | 목록 | lg↑ `Popover`(w-80) / 미만 vaul `Drawer`. 섹션: 「요청자」 · 「동방특송」 · 「관리자」(참여한 admin) · 「참여자」(초대 · 「초대: {이름} · {절대 시각}」) · 각 행 `Avatar` 이니셜 + 이름 + 역할 `Badge` · 제외 `Button variant='ghost' size='icon'` `Icons.x`(권한자 · 초대 참여자 행에만) · 본인이 참여자면 행 끝 「나가기」 |
| U-3 | 추가 | 목록 상단 「참여자 추가」 → `Command` + `CommandInput`(placeholder 「이름 또는 이메일 검색」) · 결과 행 이름·이메일·소속 · 빈 「검색 결과가 없습니다.」 · 로딩 compact |
| U-4 | AlertModal | 제외: title 「참여자 제외」 · description 「{이름}님을 이 대화에서 제외할까요? 이후 메시지를 볼 수 없습니다.」 · confirm 「제외」 · 나가기: 「대화 나가기」 · 「이 대화에서 나가면 더 이상 메시지를 볼 수 없습니다.」 · confirm 「나가기」 |
| U-5 | 시스템 줄 | `quick-chat-divider` 스타일(가운데 muted 텍스트 + 시각) · 메시지 시각 순 삽입 |
| U-6 | 말풍선 배지 | 「참여자」 `Badge variant='secondary'` |
| U-7 | 대시보드 | 「요청 정보」 셀·모바일 카드에 `Badge variant='outline'` **「참여」**(초대된 건) · 「나의 퀵 내역」 제목 유지 |
| U-8 | 상세 | 참여자에게는 액션바·「수정」·「대화」 외 버튼 없음 · 「퀵 권한 안내」 ⓘ에 1줄: 「초대된 참여자는 요청을 읽고 대화할 수 있지만 요청을 바꿀 수는 없습니다.」 |

---

## API / DB 요구사항

### SQL — `supabase/sql/98_quick_request_participants.sql`

```sql
create table public.quick_request_participants (
  id bigint generated always as identity primary key,
  quick_request_id uuid not null references public.quick_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete restrict,
  invited_at timestamptz not null default now(),
  removed_at timestamptz null,
  removed_by uuid null references auth.users(id) on delete set null,
  unique (quick_request_id, user_id)
);
create index idx_qrp_user_active on public.quick_request_participants (user_id) where removed_at is null;
create index idx_qrp_request on public.quick_request_participants (quick_request_id);
alter table … enable row level security;
create policy qrp_select on … for select to authenticated using (private.can_view_quick_request((select auth.uid()), quick_request_id));
revoke all on … from anon, authenticated; grant select on … to authenticated; grant all on … to service_role;

create or replace function private.is_quick_request_participant(p_uid uuid, p_request_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.quick_request_participants p
                 where p.quick_request_id = p_request_id and p.user_id = p_uid and p.removed_at is null);
$$;
create or replace function private.can_view_quick_request(p_uid uuid, p_request_id uuid) … -- 기존 조건 OR private.is_quick_request_participant(p_uid, p_request_id)
drop policy quick_requests_select on public.quick_requests; create policy … using (requester_user_id = (select auth.uid()) or private.can_view_all_quick_requests((select auth.uid())) or private.is_quick_request_participant((select auth.uid()), id));
alter table public.quick_request_messages drop constraint quick_request_messages_author_role_check, add constraint … check (author_role in ('requester','dongbang','admin','participant'));
create or replace function public.quick_request_unread_total(p_user uuid) … -- 범위에 or private.is_quick_request_participant(p_user, q.id)
create or replace function public.quick_request_unread_requests(p_user uuid) … -- 동일
create or replace function public.quick_request_last_messages(...) … -- 동일(범위 쓰는 경우)
create or replace function private.quick_realtime_broadcast() … -- 94 본문 + 활성 참여자마다 realtime.send(..., 'quick-user:' || p.user_id, true)
-- 롤백: 함수 94/92 본문 · 정책 89 · CHECK 92 · drop table
```

### Route

| Method · Path | 권한 | 동작 | 응답 · 로그 |
|---|---|---|---|
| `GET …/participants` | 조회 권한 | 요청자·active 동방·참여 admin·초대 참여자(활성) + 이력(초대·제외 이벤트) | 200 `{participants:[{userId, name, role, invitedBy?, invitedAt?}], events:[{type:'joined'\|'removed'\|'left', userId, name, at}]}` · Read Out |
| `GET …/participants/candidates?q=` | 요청자·admin | active · 동방 제외 · **admin 제외(r1)** · 요청자·참여 중·본인 제외 · 이름/이메일 `ilike` · ≤20 | 200 `{candidates:[{userId, name, email, affiliationLabel}]}` · 403 · Read Out |
| `POST …/participants` `{userId}` | 요청자·admin(동방·구매물류·참여자 403) | 후보 검증(D-2 · admin·동방·pending·요청자·본인이면 **400** 「초대할 수 없는 사용자입니다.」) → upsert(복구) → 알림(`after()`) | 201 `{participant}` · 400·401·403·404·409·500 · **`quick_request.participant_add`** |
| `DELETE …/participants/[userId]` | 초대자(요청자)·admin · 본인(나가기) | soft remove → 알림(본인 제외) | 200 · 401·403·404(미참여)·500 · **`quick_request.participant_remove`** |
| `GET …/messages` | 기존 | + `participants`·`events`(위와 같음 · 1회 조회) · `quickReplies` participant 세트 · `viewer.role='participant'` | — |
| `GET …/[no]` | 기존 | `permissions` false + `isParticipant` | — |
| `GET /api/quick-request`·`conversations` | 기존 | 비-viewer-all 사용자: `requester_user_id = me OR id in (활성 참여 건)` · 행 `isParticipant` | — |

### 수신 규칙 확장 (`resolveChatRecipients`)

```
input += participantIds: readonly string[]   // 활성(removed_at null) 초대 참여자
참여자 P = {요청자} ∪ 동방 ∪ admin 참여자 ∪ participantIds
수신자 = P − sender − inactive (중복 제거)   // 규칙 변화 없음 · 집합만 커짐
```

---

## 활동 감사 로그 (기록 연동)

> `core-conventions.mdc` §활동 감사 로그 · [plan 08](./08_activity-audit-log-plan.md)

| Route | action | 라벨 | target | return 분기 | metadata |
|---|---|---|---|---|---|
| `POST …/participants` | `quick_request.participant_add` | 퀵 대화 참여자 추가 | `quick_request` / `{no}` | 201·400·401·403·404·409·500 | `quick_request_no`·`participant_user_id`·`error_code` |
| `DELETE …/participants/[userId]` | `quick_request.participant_remove` | 퀵 대화 참여자 제외 | 〃 | 200·401·403·404·500 | `quick_request_no`·`participant_user_id`·`self`·`error_code` |
| GET 2종 · messages | — | Read | — | Out | — |

- 삭제 확인: 제외·나가기 **`AlertModal`**(AC-09·12) · `window.confirm` 0. 알림 INSERT Out. 검증 **AC-17**.

---

## 영향 파일 & 패턴

| 팀 | 파일 |
|---|---|
| BE | `supabase/sql/98_quick_request_participants.sql` · `src/features/quick-request/api/participants.server.ts`(신규) · `api/{messages.server,workflow.server,notifications.server}.ts` · `lib/resolve-chat-recipients.ts` + 테스트 · `schemas/quick-request-chat.ts`(role·칩) · `schemas/quick-request-participant.ts`(신규) · `src/app/api/quick-request/[requestNo]/participants/{route.ts, candidates/route.ts, [userId]/route.ts}`(신규) · `[requestNo]/route.ts`·`route.ts`·`conversations/route.ts`(범위) · `src/features/auth/api/quick-access.server.ts`(`canInviteParticipants`) · `src/features/activity-logs/api/{types,log.server}.ts` · `labels.ts` |
| FE | `components/chat/{quick-chat-header,quick-request-conversation,quick-chat-message-list,quick-chat-bubble,quick-chat-constants}.tsx` · `components/chat/{quick-chat-participants-button,quick-chat-participants-panel,quick-chat-add-participant,quick-chat-system-line}.tsx`(신규) · `components/detail/{quick-request-detail-page,quick-request-action-bar,quick-request-detail-chat-view}.tsx` · `components/dashboard/{quick-dashboard-columns,quick-request-mobile-card}.tsx` · `api/{service,queries,mutations,keys,types}.ts` · `info-content.ts` |
| verifier | `e2e/quick-round2/101-participants*.spec.ts` · `scripts/cleanup-e2e-mock-data.mjs` |

**패턴:** 93 참여자 규칙·순수 함수 · 14 `AlertModal` · 95 `applyDongbangScope` · 94 Broadcast 트리거 · `Command` Combobox(활동 로그 사용자 콤보) · `jsonWithActivityLog`.

---

## 리스크 & 완화

| 등급 | 리스크 | 완화 |
|---|---|---|
| HIGH | 권한 함수 확장 누락 → 참여자가 404를 받거나(기능 불능) 제외 후에도 봄(유출) | 함수 1곳(`can_view_quick_request`) + RLS 정책 + RPC 3종 + 서버 helper를 **AC-16 목록으로 전수** · AC-10 제외 후 404 |
| HIGH | 참여자 포함으로 Realtime `quick-user` 송신 대상이 늘어 트리거 비용 증가 | 활성 참여자만 · 건당 수 명 · 예외 시 return null |
| MED | 대시보드 목록 쿼리에 `id in (참여 건)` 서브쿼리 추가로 느려짐 | 부분 인덱스 `idx_qrp_user_active` · 97 DB 페이지네이션과 결합 |
| MED | 초대 후보 API가 사용자 검색을 일반 사용자에게 열어 줌 | 요청자·admin만 · active·동방 제외 · 이름·이메일·소속만 반환 · 20건 |
| MED | 시스템 줄 파생 렌더가 메시지 묶음·구분선 로직과 충돌 | `groupMessages`에 이벤트를 가상 항목으로 합쳐 정렬 · 단위 테스트 |
| LOW | admin 초대 시 역할 혼동(admin vs participant) | `resolveChatAuthorRole`: 요청자 > admin > participant > dongbang 순(admin은 계속 admin) |

**롤백:** SQL 롤백 블록 · 코드 revert.

---

## Battle Plan (단계)

| # | 단계 | 산출물 | 확신도 | 의존 |
|---|---|---|---|---|
| 0 | root Step 0 백업 | — | HIGH | — |
| 1 | designer: 「참여자 N」·Popover/Drawer·추가 Combobox·AlertModal 2종·시스템 줄·「참여」 배지 | 설계 메모 | HIGH | — |
| 2 | BE: SQL 98(테이블·함수·정책·RPC·CHECK·트리거) → `participants.server.ts` → Route 4 → 범위 확장(목록·상세·대화·unread) → 수신 규칙 + 테스트 → 알림 2 event → 로그 → **Checkpoint 1**(curl AC-05~08·10·11·16) | API | MED | 0 |
| 3 | FE: 헤더 버튼·패널·추가·AlertModal·시스템 줄·배지·상세 읽기 전용·ⓘ | UI | MED | 2 |
| 4 | verifier: spec · cleanup · 회귀 93/94/98 | green | MED | 3 |

**추정:** 신규 10파일 · 수정 약 22파일 · +1,300/−80줄 · **Complex** · 약 7~9시간.

---

## requirements-pipeline Express (Phase 3)

### 가정

| ID | 가정 | 출처 |
|----|------|------|
| A1 | 초대는 요청자(와 admin), 초대된 사람은 읽기·쓰기·이전 기록·그 시점부터 알림 | brief 18 |
| A2 | 참여자는 요청을 바꾸지 못한다 | planner 결정(89 책임 주체) |
| A3 | 초대 후보는 동방·admin 제외 active 직원 | 95 원칙 · 사용자 지시 2026-10-28(r1) |
| A4 | 참여자 수는 건당 소수(≤10) | **[INFERRED]** |

### 검증 시나리오

| 시나리오 | 기대 |
|----------|------|
| 초대 → 열람 → 발신 → 수신 | AC-02~05 |
| 제외 → 404 · 알림 중단 | AC-09·10 |
| 재초대 · 나가기 | AC-11·12 |
| 권한 경계 | AC-06~08 |
| 실시간·✓✓ | AC-13·15 |

---

## 구현 팀 전달 메모

### designer — 「참여자 N」 Popover/Drawer · 추가 Combobox · AlertModal 2종 · 시스템 줄 · 「참여」 배지 · 말풍선 「참여자」 배지.
### backend-dev — `can_view_quick_request` 확장이 핵심(AC-16 전수) · 후보 API 범위 최소 · 수신 규칙 집합 확장 + 테스트 · broadcast 참여자 topic · 로그 2 action.
### frontend-dev — 헤더·패널·추가·AlertModal · 시스템 줄은 `groupMessages`에 가상 항목 · 참여자 읽기 전용 상세 · 대시보드 배지.
### verifier — user2 초대 흐름 · 제외 후 404 · 알림 dev DB 판정 · 2 context 실시간·✓✓ · AlertModal grep.

---

## 열린 질문

없음(사용자 요구 18 + planner 결정 D-1~D-13).

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-10-27 | 최초 작성 · Approved(/root 단일 게이트 · brief 18). 초대 참여자 테이블 · `can_view_quick_request`·RLS·RPC 확장 · `author_role` participant · 수신 규칙 집합 확장 · 초대/제외 알림(type 재사용) · 헤더 「참여자 N」 Popover/Drawer · 추가 Combobox(후보 API) · 제외/나가기 `AlertModal` · 시스템 줄 파생 · 대시보드 「참여」 · 로그 2 action · SQL 98 · AC 19 · 실행 순서 98 → 101 → 99 → 100 | planner |
| 2026-10-28 | **r1 (사용자 추가 지시)**: 「참여자 목록 보기 + 목록에서 추가」는 D-9와 이미 일치(변경 없음 확인). **초대 후보에서 `system_role='admin'` 제외**(D-2 · 후보 Route·초대 Route 양쪽 서버 제외 · admin은 모든 대화 열람 + 글 쓰면 자동 참여자라 초대 불필요). 초대 **하는** 권한(요청자·admin · D-1)과 후보가 **되는** 것은 별개임을 명시. AC-02(후보에 admin 0건) · AC-06(요청자가 admin 초대 → **400** 「초대할 수 없는 사용자입니다.」 · 403 아님) · AC-14(admin이 초대 가능 유지 + 다른 admin 후보 0건) · Route 표 · 가정 A3 갱신. AC 개수 19 유지 · Status Approved 유지 · 코드 변경 없음 | planner |
| 2026-10-28 | **verifier — Completed.** spec `e2e/quick-round2/101-participants.spec.ts`(AC-01~15·17) · `101-participants-mobile.spec.ts`(AC-18) **17/17 green** · AC-16 Dev MCP · AC-19 CLI(tsc·lint:strict·build·node --test 80/80) · 회귀 quick 5디렉터리 331 pass(기존 1 · 부하 플레이크 2는 재실행 green). verifier 직접 수정 4: ① `notifications/lib/notification-route.ts` metadata 미전달로 초대 알림 「채팅 보기」가 상세로 가던 버그(AC-03 · 푸시 URL도 같은 함수) ② `activity-logs/api/log.server.ts` `sanitizeMetadata`가 boolean `self`를 버리던 버그(AC-12·17) ③ 참여자 Popover 가용 높이 제한(`--radix-popover-content-available-height`) — 동방이 많으면 위로 뒤집혀 「참여자 추가」가 화면 밖으로 잘리던 버그(AC-01에 회귀 assert 추가) ④ cleanup 3c 참여자(일회용 `user_id`·`invited_by`) + remaining 2키. spec 갱신: 90 info-panel 문구(U-8 1줄) · 94 AC-25 action allowlist(+2) · 95 감사표 S-17(participants.server) | verifier |
