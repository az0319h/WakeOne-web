# 퀵 요청 건별 실시간 채팅 · 「퀵 대화」 Messenger · 안 읽은 대화 수 기획서

> Date: 2026-10-22
> Status: Completed
> Author: planner
> **SQL 예정:** `supabase/sql/{NN}_quick_request_messages.sql` — `NN`은 적용 직전 `ls supabase/sql` 최대+1(plan 92 SQL 다음). **Dev DB만** 적용한다.
> **선행(필수):** [92](./92_quick-web-only-notifications-plan.md) — 92의 `notifyQuickRequestEvent` 구조·`QuickRequestRealtime`·상세 aside 정리·`permissions.canOperate` 이름을 전제로 한다. **92 구현 완료 후 착수**
> **선행:** [08](./08_activity-audit-log-plan.md), [14](./14_delete-confirm-dialog-plan.md), [27](./27_in-app-notifications-user-update-plan.md), [43](./43_cs-support-comments-notifications-plan.md), [49](./49_live-users-presence-plan.md), [86](./86_quick-request-kakao-redesign-plan.md), [89](./89_quick-workflow-dongbang-openchat-plan.md), [90](./90_quick-dashboard-permission-info-plan.md), [91](./91_pwa-web-push-notifications-plan.md)
> **영향:** [91](./91_pwa-web-push-notifications-plan.md)은 **구현이 진행 중**(2026-10-22 정찰: SQL `90` dev 적용 Completed, `insert.server.ts`·`push-groups.ts`·`notification-route.ts` 존재, 미커밋). 따라서 이 plan이 91의 파일을 **직접 수정**한다: `PUSH_NOTIFICATION_GROUPS`에 `quick_request.chat_message`(30 → 31종, exhaustive check 통과), `resolveNotificationRoute`에 채팅 이동 규칙(`/dashboard/quick/chat?request={no}`). 알림 insert는 91의 `insertNotifications()`를 쓴다
> **r3 (2026-10-26 · 사용자 지시):** 참여자 모델로 변경. **건마다 대화방 참여자 = 요청자 본인 + active 동방특송 전원**(+ 글을 쓴 admin). 알림은 **보낸 사람을 뺀 참여자 전원**에게 간다. 「접수한 담당자(`accepted_by`)」 기준 규칙·접수 전/후 구분은 **폐기**. 알림 양 증가는 사용자가 수용했다

---

## 먼저 읽기 — 이 채팅은 어떻게 동작하나요?

> 퀵 요청 **한 건마다 대화방이 하나** 있습니다. 그 방의 **참여자는 요청한 사람 본인과 동방특송 직원 전원**입니다(동방특송 직원은 **모든 건의 대화방에 자동으로 들어가** 있습니다). 관리자(admin)는 어느 방이든 들어가 글을 쓸 수 있고, **글을 쓴 순간부터 그 방의 참여자**가 됩니다. 구매물류팀은 볼 수만 있습니다.
>
> - 「동방특송 3명이 모든 채팅방에 들어가 있나요?」 → **예. 3명 모두 모든 건의 참여자이고, 알림도 3명 모두 받습니다.**
> - **알림 규칙은 하나뿐입니다: 메시지를 보낸 사람을 뺀 참여자 전원이 받습니다.**
>   - 요청자가 보내면 → **동방특송 전원**(+ 그 방에 글을 쓴 적 있는 admin)
>   - 동방특송 A가 보내면 → **요청자 + 다른 동방특송 전원**(+ 참여한 admin)
>   - admin이 보내면 → **요청자 + 동방특송 전원**
>   - 접수 전·후 구분은 **없습니다.** 누가 접수했는지와 상관없이 같은 규칙입니다
> - 알림이 많아지는 점은 **사용자가 수용**했습니다. 휴대폰 푸시가 부담스러우면 plan 91 알림 설정의 「퀵 요청」 그룹에서 끌 수 있고, 대화를 열면 그 건의 채팅 알림은 자동으로 읽음 처리됩니다.
> - 「안 읽은 대화 수」는 사람마다 따로 셉니다. 동방특송은 모든 건이 참여 대상이라 **모든 건의 안 읽은 메시지가 합산**되어 퀵 대시보드·「퀵 대화」·사이드바 배지에 보입니다.

---

## 선행 plan 참조 (Phase 0)

| Plan | Status | 관계 |
|------|--------|------|
| **92** | Approved | 카톡 제거 후 「건별로 대화할 곳」이 없어지는 공백을 메운다. 92의 알림 모듈·Realtime 패턴·대시보드 실시간 갱신·상세 aside 자리를 이어받는다 |
| **89** | In Progress | 권한 원칙 그대로: 조회 = 요청자 본인 + viewer-all(admin·동방·구매물류팀), 업무 = 동방·admin, **구매물류팀 = 조회 전용**(D-11), `approved`·`cancelled` 잠금, 동방 allowlist(D-5). 요청자는 접수 후 취소할 수 없으므로(89 AC-24) **대화로 취소·변경을 부탁**하는 것이 핵심 용도 |
| **43** | Approved | `support_comments` + Realtime INSERT 구독 + 본인 제외 알림 + 댓글 CUD activity log 선례. 이 plan은 평면(1단) 메시지만 둔다 |
| **27 · 37** | Approved · Completed | 알림 테이블·Realtime·읽음 처리 재사용. 알림 INSERT 로그 Out. `notification.read` 로그는 **사용자가 직접 누른 읽음**이라 기록한다(→ 이 plan의 「대화 읽음 위치 갱신」은 자동 동작이라 구분, §활동 감사 로그) |
| **49** | Approved | Live 접속자 presence. 89 D-4로 **동방특송은 presence를 track하지 않는다** → 온라인 점(●) 기능 Out의 근거 |
| **86 · 90** | Approved · Completed | 퀵 화면 디자인 규칙: shadcn · 시맨틱 토큰 · **THEMES 10종 × light/dark** · `Icons.*` · `cn()` · `PageContainer` · 하드코딩 색·고정 radius/shadow 금지. 90의 「퀵 권한 안내」 ⓘ에 대화 규칙 1줄 추가 |
| **91** | Approved · **구현 진행 중** | 푸시는 알림을 그대로 OS로 보낸다 → 채팅 원문이 휴대폰 알림이 된다. 91이 만든 `insertNotifications`·`push-groups.ts`·`notification-route.ts`를 이 plan이 직접 확장한다(헤더 「영향」). 92·93·91 어느 순서로 끝나도 되도록 91 쪽 변경은 **append만** 한다 |
| **14** | Completed | 이 plan에는 삭제 UI가 없다(메시지 삭제 Out). `window.confirm` 금지 유지 |
| **08** | Approved | 메시지 전송 Route는 CUD → **전 분기 activity log**. 본문은 로그에 남기지 않는다 |

### 정찰로 확인한 사실

| 항목 | 사실 | 근거 |
|------|------|------|
| 템플릿 chat | WakeOne에 업스트림 `next-shadcn-dashboard-starter`의 **데모 Messenger가 이미 있다.** 파일은 `src/features/chat/components/{messenger,conversation-list,conversation-select,chat-area,chat-header,message-bubble,message-composer,chat-view-page}.tsx`, `utils/{store,data,types}.ts`(zustand mock·영문·첨부·자동응답·Presence 점·✓✓ `Icons.checks`). `/dashboard/chat`은 `DISABLED_DASHBOARD_PATHS`로 막혀 있음. 업스트림 저장소에도 같은 `src/features/chat`이 있음 | `src/config/disabled-routes.ts:3`, `gh api …/git/trees/main` |
| 템플릿 사용 컴포넌트 | shadcn `Avatar`·`Badge`·`Button`·`Input`·`Textarea`, `Icons.*`, `motion/react`. 2단 grid(`lg:[grid-template-columns:30%_1fr]`), 모바일은 `ConversationSelect`(Select)로 전환. **고정 radius(`rounded-2xl/3xl`)·`backdrop-blur`·`bg-green-500` 하드코딩** → 86 테마 규칙 위반 요소 | 같은 파일 |
| 데모 URL | `https://shadcn-dashboard.kiranism.dev/dashboard/chat`은 Clerk 로그인 화면으로 리다이렉트되어 WebFetch로 내용 확인 불가 → 저장소 코드와 사용자 스크린샷으로 대체 | WebFetch 결과 |
| 담당자 컬럼 | `quick_requests.accepted_by uuid null references auth.users on delete set null` — **r3부터 알림 규칙에 쓰지 않는다**(대화 헤더 표시에만 참고) | SQL 89 112행 |
| 조회 권한 함수 | `private.can_view_all_quick_requests(uid)`(active + admin·동방·구매물류) security definer | SQL 89 46행 |
| 동방 allowlist | 페이지: `QUICK_DETAIL_PATH_PATTERN = /^\/dashboard\/quick\/[^/]+\/?$/`라 `/dashboard/quick/chat`도 **우연히 통과** → 명시 등록으로 바꾼다. API: `/api/quick-request/**`(notes·recent-addresses·등록 POST 제외) 허용 → 신규 API 수정 없이 통과 | `src/config/dongbang-routes.ts` |
| Realtime 선례 | `support-comment-realtime.tsx`: `realtime.setAuth` → `postgres_changes` INSERT `filter` → `setQueryData` merge(id dedupe) + invalidate | 같은 파일 |
| nav | 「퀵」 그룹: `/dashboard/quick`(퀵 대시보드) · `/dashboard/quick/request`(퀵 요청하기) | `src/config/nav-config.ts:59,67` |
| 알림 type CHECK | 현재 30종(퀵 2종 포함) | dev `notifications_type_check` |
| plan 91 상태 | `supabase/sql/90_push_subscriptions.sql` Status Completed(dev 적용), `src/features/notifications/{api/insert.server.ts, lib/push-groups.ts, lib/notification-route.ts, components/app-badge-sync.tsx}` 존재(미커밋). `quick-request/api/notifications.server.ts`는 이미 `insertNotifications()`를 호출 | `ls`, `git status` |
| 알림 벨 카운트 | `useNotificationsUnreadCount()`가 **별도 count API 없이** 무한 목록(`notificationKeys.list`)의 로드된 페이지에서 `status='unread'`를 센다. 읽음은 `PATCH /api/notifications/[id]/read`·`read-all` + `applyMarkNotificationReadOptimistic`(plan 37) | `notification-infinite-list.tsx:159`, `api/optimistic.ts:72` |
| 사이드바 배지 | shadcn `SidebarMenuBadge`가 `src/components/ui/sidebar.tsx:558`에 **이미 있다**(`absolute right-1`, 아이콘 모드에서 숨김). `NavItem`(`src/types/index.ts:22`)에는 배지 필드가 없고, `SidebarNavLeafItem`(`app-sidebar.tsx:146`)은 아이콘+제목만 그린다 → `src/components/ui` 수정 없이 배지 슬롯을 추가할 수 있다 | 같은 파일 |
| Realtime broadcast | `supabase.channel(...).send({type:'broadcast'})`는 DB 테이블 없이 쓸 수 있다(「입력 중…」 후보). 89 D-4의 presence 제외는 **Live 접속자 기능**(plan 49)에 한정된 결정 | `@supabase/supabase-js` |

---

## 한 줄 요약

퀵 요청 **한 건마다 실시간 대화**가 있다. 요청자·동방특송·admin은 「이건 취소해 주세요」, 「40분 뒤로 바꿔 주세요」, 「알겠습니다」처럼 메시지를 주고받는다. 보낸 메시지는 새로고침 없이 상대 화면에 바로 뜨고, **보낸 사람을 뺀 참여자 전원(요청자 + 동방특송 전원 + 참여한 admin)에게 원문 그대로 알림**이 간다. 대화는 두 곳에서 볼 수 있다. 하나는 새 화면 **「퀵 대화」**(데모 같은 2단 Messenger)이고, 다른 하나는 **퀵 상세 화면 안의 「요청 대화」**다. 두 곳은 같은 컴포넌트를 쓴다. 퀵 대시보드 목록과 「퀵 대화」 목록에는 건마다 **내가 안 읽은 메시지 수(새 대화 N)** 가 실시간으로 표시된다. 내가 보낸 메시지에는 상대가 읽었는지 **✓✓ 읽음**이 표시된다. 전체 경험은 **카카오톡·인스타그램 DM 수준**을 목표로 한다: 보내자마자 즉시 표시, 날짜 구분선, 연속 메시지 묶음, 실패 시 다시 보내기, 「입력 중…」, 대화를 열면 그 건의 채팅 알림도 자동 읽음(벨 숫자 즉시 감소), 사이드바 「퀵 대화」 메뉴 옆 **전체 안 읽은 수 배지**.

---

## 정책 확정안 (사용자 요청 · 답변 2026-10-22 · battle-plan 결정)

| # | 항목 | 확정 |
|---|------|------|
| C-1 | 화면 구조 | **(c) 둘 다.** ① 새 페이지 **`/dashboard/quick/chat` 「퀵 대화」**: 왼쪽 대화 목록 + 오른쪽 대화. ② 상세 `/dashboard/quick/[requestNo]` 안의 **「요청 대화」** 영역. 둘 다 **같은 대화 컴포넌트**(`QuickRequestConversation`)를 재사용한다. 근거는 §화면 구조 결정 |
| C-2 | 읽기 · 참여자 | 읽기는 그 건을 볼 수 있는 사람 전원(요청자 본인·동방특송·admin·구매물류팀). 89 조회 범위와 같다. **참여자(알림 대상)는 읽기 범위보다 좁다**: 요청자 본인 + active 동방특송 전원 + 그 건에 글을 쓴 admin(r3). 참여자 테이블은 두지 않고 **규칙으로 계산**한다(동방 allowlist·`author_role='admin'` 메시지 존재 여부) |
| C-3 | 쓰기 | **요청자 본인·동방특송·admin.** 구매물류팀은 남의 건에서 **읽기 전용**이다(본인이 요청자인 건에서는 요청자로서 쓸 수 있다) |
| C-4 | 채팅 가능 기간 | `requested`·`dispatching`·`dispatched`에서만 쓸 수 있다. **`approved`·`cancelled`는 읽기 전용**이다(89 잠금 원칙, 정산이 확정된 기록은 바꾸지 않음) |
| C-5 | 알림 수신자 (r3) | §알림 수신 규칙. **참여자 전원 − 보낸 사람 − 비활성, 중복 제거.** 접수 전/후·`accepted_by` 구분 **없음**. 알림 양 증가는 사용자 수용 |
| C-6 | 알림 문구 | 제목 **`{요청번호} · {보낸 사람 이름} 메시지`**, 본문은 **채팅 원문 그대로**(앞뒤 공백만 제거)다. 200자를 넘으면 199자 + `…`로 자르고, 줄바꿈은 그대로 둔다 |
| C-7 | 알림 클릭 | 버튼 「채팅 보기」를 누르면 **`/dashboard/quick/chat?request={요청번호}`**(「퀵 대화」에서 그 건이 선택된 상태)로 간다. 이유: 다른 안 읽은 대화도 한 화면에서 이어서 처리할 수 있다 |
| C-8 | 알림 type | 신규 **`quick_request.chat_message`** 1종을 추가한다(`notifications_type_check` 30 → 31종). plan 91 그룹 `quick_request`에 포함 |
| C-9 | 메시지 규칙 | 텍스트만 · 1~1,000자(공백만 있으면 거부) · **수정·삭제 불가** · 작성자 이름·역할(요청자/동방특송/관리자)은 보낸 시점 값을 저장 |
| C-10 | 안 읽은 수 (In · 1차 필수) | 사용자별 **읽음 위치**(`last_read_message_id`)를 건마다 저장한다. **안 읽은 수 = 그 건에서 내가 쓰지 않았고 id가 내 읽음 위치보다 큰 메시지 수.** 읽음 위치가 없으면 남이 쓴 메시지 전부가 안 읽음이다. 내가 메시지를 보내면 읽음 위치를 그 메시지로 올린다 |
| C-11 | 읽음 갱신 시점 | 대화 영역이 **화면에 보이고**(탭이 활성, 모바일은 대화가 열림), **마지막 메시지가 화면 안에 들어오면** 그 id로 갱신한다(IntersectionObserver, 500ms debounce). 읽음 위치는 **뒤로 가지 않는다**(`greatest`) |
| C-12 | 상대 읽음 표시 ✓✓ (In · r3 정의 확정) | **내가 보낸 메시지에만** 표시한다: `✓ 전송됨` / `✓✓ 읽음`. 「읽음」은 **상대편 중 1명 이상**의 읽음 위치가 그 메시지 이상일 때다(**전원 아님**). 상대편은 **내가 요청자면 동방특송 전원 + 참여한 admin**, **내가 동방특송·admin이면 요청자만**이다(같은 동방 동료나 구매물류팀이 읽은 것은 세지 않음). tooltip에는 읽은 사람 **전원**의 이름과 시각을 보여 준다(「김동방 · 2026-10-26 (월) 10:12:03 읽음 외 1명」). 근거: ① 요청자의 목적은 「**동방특송 쪽 누군가가** 내 취소 부탁을 봤는지」이지 3명 전원이 봤는지가 아니다. 전원 기준이면 한 명이 휴무일 때 영원히 ✓로 남아 오히려 오해를 만든다. ② 동방이 보낸 「알겠습니다」의 목적은 **요청자가 봤는지**이므로 동료 동방이 읽은 것은 의미가 없다. ③ 누가 읽었는지는 tooltip으로 보완된다 |
| C-13 | 안 읽은 구분선 (In) | 대화를 열 때 처음 안 읽은 메시지 위에 **「여기부터 새 메시지」** 구분선을 보여 주고 그 위치로 스크롤한다(안 읽은 메시지가 없으면 맨 아래) |
| C-14 | 빠른 답장 칩 (In) | **퀵 전용 고정 문구**를 쓴다. 요청자: 「취소 부탁드립니다」·「시간 변경 부탁드립니다」·「연락 부탁드립니다」. 동방특송·admin: 「확인했습니다」·「처리했습니다」·「불가능합니다」·「잠시만 기다려 주세요」. 칩을 누르면 **입력창에 채워지고 바로 보내지는 않는다**(잘못 눌러 「취소 부탁」이 나가는 사고 방지). 읽기 전용이면 칩을 숨긴다 |
| C-15 | 데모 요소 Out | **첨부**: Storage·용량·개인정보 범위가 커진다. **전화·영상**: WakeOne에 통화 기능이 없고, 연락처는 상세 화면의 전화 링크로 대신한다. **온라인 점(Presence)**: 89 D-4로 동방특송이 presence를 track하지 않아 정확하지 않다. **「입력 중…」**: Presence 채널이 필요하고 효용이 낮다 |
| C-16 | 실시간 | `quick_request_messages`·`quick_request_message_reads`를 Realtime publication에 추가한다. 대화 화면은 그 건만(`quick_request_id=eq.{id}`), 목록·대시보드는 필터 없이(RLS가 범위 제한) 구독한다. 새 메시지가 오면 대화·안 읽은 수·목록 정렬이 새로고침 없이 바뀐다 |
| C-17 | 로그 | 메시지 전송은 `quick_request.message_create`로 전 분기를 기록하고, **본문은 남기지 않는다.** **읽음 위치 갱신은 로그 Out**(§활동 감사 로그 근거) |
| C-18 | 디자인 | 데모는 **참고만** 하고, 구현은 **shadcn 컴포넌트**(`Avatar`·`Badge`·`Button`·`Input`·`Textarea`·`ScrollArea`·`Separator`·`Tooltip`·`Tabs`·`Card`)로 한다. 시맨틱 토큰과 테마 토큰만 쓰고 **THEMES 10종 × light/dark**를 지킨다(86 D3). 템플릿의 고정 radius·`backdrop-blur`·하드코딩 색은 가져오지 않는다. 모든 문구는 한국어다 |
| C-19 | 템플릿 데모 코드 | `src/features/chat/**`·`/dashboard/chat`(비활성)는 **건드리지 않는다**. 구조만 참고해 `src/features/quick-request/components/chat/**`로 새로 만든다. 데모 삭제는 Out(별도 정리) |
| C-20 | DM 수준 동작 (사용자 「카톡·인스타 DM 기능 탑재」) | §DM 항목 결정표. In: 자동 스크롤(맨 아래 근처일 때만), **optimistic 즉시 표시**, **날짜 구분선**, **연속 메시지 묶음**, **전송 실패 재시도**, **「입력 중…」**(broadcast). Out 유지: 온라인 점, 첨부, 전화·영상, 수정·삭제, 반응(이모지)·답장 인용·메시지 검색 |
| C-21 | 채팅 알림 자동 읽음 (In) | 대화를 열어 읽음 위치가 갱신될 때(C-11), 그 건의 `quick_request.chat_message` 알림 중 **수신자 = 본인·`unread`** 인 행을 **같은 `PUT …/messages/read` 처리 안에서** `read`로 바꾼다. FE는 plan 37 `applyMarkNotificationReadOptimistic`과 같은 방식으로 알림 목록 캐시를 즉시 갱신해 **벨 숫자가 바로 줄어든다**. 다른 퀵 알림(접수·배차 등)은 건드리지 않는다. 사용자가 알림 페이지에서 직접 누르는 읽음(27)과 공존한다 |
| C-22 | 사이드바 전체 안 읽은 수 (In) | 「퀵 대화」 메뉴 옆 배지 = **내가 볼 수 있는 모든 퀵 건의 안 읽은 메시지 합계**(99+, 최근 90일). 새 메시지·읽음 처리에 실시간 반영. **동방특송은 모든 건이 참여 대상이므로 전 건의 안 읽은 수가 합산된다**(r3 · §리스크 「안 읽은 수 집계 비용」). `NavItem`에 `badge` 키를 추가하고 `SidebarNavLeafItem`이 `SidebarMenuBadge`(기존 ui)로 그린다 — `src/components/ui` 수정 없음 |
| C-23 | 「입력 중…」 다중 표시 (r3) | 참여자가 여러 명이라 동시에 입력할 수 있다. 입력 중인 사람을 **userId별 타이머(4초)** 로 관리하고 한 줄로 합친다: 1명 「{A}님이 입력 중…」 · 2명 「{A}님, {B}님이 입력 중…」 · 3명 이상 「{A}님 외 {N−1}명이 입력 중…」. 순서는 입력을 시작한 순. 본인은 제외. 순수 함수 `formatTypingNames(names: string[])`로 만들고 단위 테스트로 판정한다 |

### 화면 구조 결정 (C-1 근거)

| 안 | 장점 | 단점 |
|----|------|------|
| (a) 상세 안에만 | 작고 단순하다 | 동방특송은 여러 건을 동시에 처리하는데, 어느 건에 새 메시지가 왔는지 보려면 대시보드 → 상세를 오가야 한다. 사용자가 보여 준 데모 형태와 다르다 |
| (b) Messenger만 | 여러 건을 한 화면에서 처리한다 | 상세 정보(경로·금액·기사)를 보면서 대화하려면 화면을 옮겨야 한다. 요청자는 대개 자기 건 1개만 본다 |
| **(c) 둘 다 ← 채택** | 동방·admin은 「퀵 대화」에서 여러 건을 몰아서 처리하고, 요청자와 상세를 보던 사람은 그 자리에서 대화한다. **같은 컴포넌트 재사용**이라 추가 비용은 페이지 1개와 대화 목록 API 1개다 | 진입점이 2개라 읽음·실시간 동기화가 필요하다 → 둘 다 같은 query key·Realtime을 써서 해결 |

---

## DM 항목 결정표 (C-20 · 사용자 「카톡·인스타 DM 수준」)

| 항목 | 결정 | 근거 |
|------|------|------|
| 새 메시지 자동 스크롤 | **In** | 내가 맨 아래 근처(≤ 120px)에 있을 때만 내려가고, 위를 보고 있으면 「새 메시지 N ↓」 버튼. 읽던 위치가 튀지 않는다 |
| 보내자마자 즉시 표시(optimistic) | **In** | 임시 id(`temp-{uuid}`)로 말풍선을 먼저 그리고 `pending` 표시(흐린 ✓). 201 응답으로 교체, Realtime 수신분과는 서버 id로 dedupe. 체감 지연 0 |
| 전송 실패 재시도 | **In** | 실패한 말풍선에 「전송 실패 · 다시 보내기」 버튼과 「삭제」(미전송 임시 항목만, 서버 데이터 아님 → `AlertModal` 대상 아님). 입력 내용 보존. 네트워크 불안정한 모바일에서 필수 |
| 날짜 구분선 | **In** | 날짜가 바뀌는 지점에 `2026-10-22 (목)` 구분선(`formatAbsoluteDateKo` 기준, 상대 날짜 금지). 말풍선 시각은 절대 시각 유지 |
| 연속 메시지 묶음 | **In** | 같은 사람이 **5분 안**에 연속으로 보내면 이름·역할 배지·아바타는 첫 말풍선에만, 시각은 묶음의 마지막에만. 읽기 밀도가 DM과 같아진다 |
| 「입력 중…」 | **In (재판단)** | Realtime **broadcast**(`quick-chat-{id}` 채널, DB 없음)로 입력 시작 시 1회·이후 3초마다 송신, 수신 측은 4초 뒤 자동 해제. 구현 ~60줄이고 서버·테이블 변경이 없다. 89 D-4의 presence 제외는 Live 접속자 기능에 한정된 결정이라 충돌하지 않는다. 표시 문구 「{이름}님이 입력 중…」, 여러 명이면 C-23 규칙(「A님, B님이 입력 중…」 / 「A님 외 2명이 입력 중…」) |
| 대화 열면 채팅 알림 자동 읽음 | **In** | C-21. 벨 숫자 즉시 감소 |
| 사이드바 전체 안 읽은 수 | **In** | C-22 |
| 상대 읽음 ✓✓ | **In** | C-12 |
| 온라인 점(●) | **Out 유지** | 전역 presence가 필요하고, 89 D-4로 동방특송은 Live 접속자에서 제외돼 **정확하지 않은 표시**가 된다. 「입력 중…」과 ✓✓가 「상대가 보고 있다」를 충분히 대신한다 |
| 첨부(사진·파일) | **Out 유지** | Storage 버킷·RLS·용량·개인정보(운송장 사진 등) 범위가 크다. 별도 plan |
| 전화·영상 | **Out 유지** | 통화 기능 없음. 상세의 전화 링크로 대체 |
| 메시지 수정·삭제 | **Out 유지** | 업무 증거 보존(C-9) |
| 반응(이모지)·답장 인용·메시지 검색·전달 | **Out** | 업무 대화에 효용이 낮고 범위가 커진다. 2차 |

## 알림 수신 규칙 (C-5 · r3)

### 참여자 정의

건마다 **대화방 참여자 P**를 다음과 같이 계산한다(테이블 없음, 매번 규칙으로 계산).

| 구성 | 누구 | 들어가는 시점 |
|------|------|---------------|
| 요청자 R | `quick_requests.requester_user_id` | 요청 생성 시점부터 항상 |
| 동방특송 D | **active 동방특송 전원**(89 D-5 allowlist, `status='active'`) | 모든 건에 자동 · 접수 여부 무관 |
| admin 참여자 A* | 그 건 `quick_request_messages`에 `author_role='admin'` 메시지를 쓴 적 있는 admin | **첫 메시지를 쓴 뒤부터** |

구매물류팀은 글을 쓸 수 없으므로 참여자가 되지 않고 알림도 받지 않는다(읽기만, 유지). 본인이 요청자인 건에서는 어떤 역할이든 R로 들어간다.

**admin만 「이전 참여자」 개념을 남기는 근거:**
1. 사용자가 정한 방 구성은 「요청자 + 동방특송 전원」이다. admin은 방 구성원이 아니라 **필요할 때 끼어드는 감독자**이므로 모든 건의 모든 메시지를 기본으로 받게 하면 사용자가 지정하지 않은 수신자를 늘리는 셈이다.
2. 반대로 admin이 한 번 끼어든 방에서 답장을 못 받으면 「서로에게 무조건 알림」이 깨진다. 그래서 **끼어든 뒤부터는 참여자로 고정**한다(대화가 잠길 때까지).
3. admin은 퀵 등록·취소 알림(92)을 이미 받고 있어 상황 파악 경로가 따로 있다.

### 수신 규칙 — 한 줄

> **수신자 = P − S(보낸 사람) − 비활성 사용자, 중복 제거.** 접수 전/후·`accepted_by`·상태(`requested`/`dispatching`/`dispatched`)에 따른 분기는 **없다.**

| 보낸 사람 S | 수신자 |
|-------------|--------|
| **요청자 R** | active 동방특송 전원 + 참여한 admin(A*) |
| **동방특송 중 1명** | 요청자 R + **다른** active 동방특송 전원 + 참여한 admin(A*) |
| **admin** | 요청자 R + active 동방특송 전원 + (보낸 admin 외) 참여한 다른 admin |

### 예시 (동방 A·B·C active, admin X)

| 상황 | 알림 수신 | 읽기 가능 |
|------|-----------|-----------|
| 접수 전, 요청자 「동방특송 담당자님 이건 취소해 주세요」 | A·B·C | 요청자·동방 전원·admin·구매물류팀 |
| 동방 A가 접수한 뒤, 요청자 「40분 뒤로 변경해 주세요」 | **A·B·C**(접수 여부 무관) | 〃 |
| A 「알겠습니다」 | 요청자 + B·C | 〃 |
| admin X가 끼어들어 「제가 확인했습니다」 | 요청자 + A·B·C | 〃 |
| 그 뒤 요청자 「감사합니다」 | A·B·C + **X**(참여자가 됨) | 〃 |
| 동방 B가 비활성인 상태에서 요청자 메시지 | A·C(+ X) · B 0 | 〃 |

### 알림 양 추정 (사용자 수용)

동방 3명 기준, 하루 20건 × 건당 메시지 6개 × 평균 수신자 3명 ≈ **하루 360건**의 `chat_message` 알림이 생기고, 동방 1인당 약 **100건/일**이다. 이전 규칙(접수 후 담당자 1명)보다 약 2~3배다. 사용자가 「알림 양이 늘어나도 상관 없다」고 확정했으므로 **줄이지 않는다.** 남겨 두는 완화는 두 가지뿐이다: ① plan 91 알림 설정에서 푸시 그룹 「퀵 요청」을 끌 수 있다(인앱 알림은 유지) ② 대화를 열면 그 건의 채팅 알림이 자동 읽음 처리된다(C-21).

---

## 목표 & 완료 기준 (AC)

공통:
- 시각은 `formatAbsoluteDateTimeKo`(`yyyy-MM-dd (EEE) HH:mm:ss`)로 표시하고, 상대 시각은 쓰지 않는다.
- 계정: `user.json`(요청자) · `user2.json` · `admin.json` · `dongbang.json`(동방 A) · `dongbang2`(일회용, 92 helper) · `logistics.json`.
- 알림 판정: dev DB `notifications`에서 `type='quick_request.chat_message'` + `metadata->>'quick_request_no'`로 조회.
- 셀렉터: `getByRole`/`getByPlaceholder`/`getByTestId`.
- 「실시간」 판정: 2 context로 **5초 안**에 반영, 「미반영」 판정은 **8초** 대기.

### A. 화면 구조·권한

| AC | 유형 | 전제 | 동작 | 기대 |
|----|------|------|------|------|
| AC-01 | Playwright | `dongbang.json` | 사이드바 「퀵」 그룹 | 메뉴 **「퀵 대화」**(`/dashboard/quick/chat`)가 「퀵 대시보드」 아래에 있음 · 클릭 시 200 · 동방에게 「퀵 요청하기」는 여전히 0건(89) · `user.json`·`admin.json`·`logistics.json`에도 「퀵 대화」 노출 |
| AC-02 | Playwright | `dongbang.json` · 볼 수 있는 건 3개 이상 | `/dashboard/quick/chat` (1280px) | 왼쪽 패널 제목 **「퀵 대화」** · 배지 **「실시간」** · **「대화 N건」** · 검색 placeholder **「요청번호·요청자·주소 검색」** · 탭 **「전체」「안 읽음」** · 항목마다 요청자 이니셜 아바타·`{요청번호} · {요청자}`·상태 배지·경로·마지막 메시지 미리보기(`{이름}: {본문}`)·절대 시각·안 읽은 수 원형 배지 · 선택 항목 강조 · 오른쪽 대화창 상단 `{요청번호}`·상태 배지·경로·버튼 **「상세 보기」** |
| AC-03 | Playwright | 375px · `dongbang.json` | `/dashboard/quick/chat` → 항목 탭 → 뒤로 | 처음에는 목록만 보이고, 항목을 탭하면 대화만(URL `?request={번호}`), 상단 「목록」 버튼으로 돌아감 · 가로 스크롤 없음 · 입력창·전송·칩 터치 영역 ≥ 44px |
| AC-04 | Playwright | `user.json` · 본인 `requested` 건 | 상세 `/dashboard/quick/{번호}` | 영역 **「요청 대화」** · 빈 상태 **「아직 대화가 없습니다. 취소나 시간 변경 같은 요청을 남겨 보세요.」** · placeholder **「메시지를 입력하세요 (Enter 전송, Shift+Enter 줄바꿈)」** · 버튼 **「전송」** · 375px에서는 상세 하단 **「대화」** 버튼 1번 탭으로 대화가 열림 |
| AC-05 | Playwright·API | `logistics.json` · 타인 건 | 「퀵 대화」에서 그 건 · `POST …/messages` | 메시지는 보임 · 입력창·칩 대신 **「구매물류팀은 대화를 볼 수만 있습니다.」** · API **403** 같은 문구 |
| AC-06 | API·Playwright | `user2.json` · user 건 | `GET`·`POST …/messages` · `/dashboard/quick/chat?request={user 건}` | API 모두 **404** 「퀵 요청을 찾을 수 없습니다.」 · 화면은 목록에 그 건 0건 + 오른쪽 **「대화를 찾을 수 없습니다.」** |
| AC-07 | Playwright·API | `approved`·`cancelled` 건 · `dongbang.json` | 대화 · POST | 기존 메시지 보임 · 입력창·칩 대신 **「승인되었거나 취소된 요청은 대화를 보낼 수 없습니다.」** · API **409** 같은 문구 · admin 동일 |
| AC-08 | API | `user.json` · 본인 건 | POST `{body:"   "}` / 1,001자 / JSON 아님 | **400** 「메시지를 입력해 주세요.」 / 「메시지는 1,000자까지 입력할 수 있습니다.」 / 「요청 형식이 올바르지 않습니다.」 |
| AC-09 | API | `dongbang.json` | `GET /api/quick-request/conversations` · `GET …/{번호}/messages` · `PUT …/{번호}/messages/read` · 페이지 `/dashboard/quick/chat` | 모두 proxy 403 아님(200) · `src/config/dongbang-routes.ts`에 `/dashboard/quick/chat` **명시 등록** |

### B. 전송·실시간·빠른 답장

| AC | 유형 | 전제 | 동작 | 기대 |
|----|------|------|------|------|
| AC-10 | Playwright | `user.json` · 본인 `requested` 건 상세 | 「동방특송 담당자님 이건 취소해주세요」 입력 → **Enter** | **201** · 오른쪽 말풍선 1개(내 메시지) · 이름·「요청자」 배지·절대 시각·`✓ 전송됨` · 입력창 비워짐 · 같은 id 중복 0 |
| AC-11 | Playwright | 입력 중 | Shift+Enter · 한글 조합 중 Enter · 전송 중 재클릭 | 줄바꿈만 · 조합 확정 Enter는 전송 안 함(`isComposing`) · 전송 중 버튼 비활성(중복 전송 0) |
| AC-12 | Playwright (2 context) | `dongbang.json`이 「퀵 대화」에서 같은 건을 열어 둠 | AC-10 전송 | 5초 안에 동방 화면 왼쪽 말풍선 등장 · 「요청자」 배지 · 목록에서 그 건이 맨 위로, 미리보기 갱신 |
| AC-13 | Playwright (2 context) | 요청자는 상세, 동방은 「퀵 대화」 | 동방 「알겠습니다」 | 5초 안에 요청자 상세 대화에 등장 · 「동방특송」 배지 · 시간 오름차순 · 맨 아래 근처면 자동 스크롤 |
| AC-14 | Playwright (2 context) | `user2.json`이 「퀵 대화」를 열어 둠 | user 건에 메시지 | 8초 동안 user2 목록·대화에 **0건**(RLS) |
| AC-15 | Playwright | `user.json` 대화 | 칩 확인 → 「취소 부탁드립니다」 클릭 | 칩 3개(「취소 부탁드립니다」「시간 변경 부탁드립니다」「연락 부탁드립니다」) · 클릭 시 입력창에 문구가 들어가고 **전송 요청 0건** · `dongbang.json` 대화의 칩은 4개(「확인했습니다」「처리했습니다」「불가능합니다」「잠시만 기다려 주세요」) |

### C. 안 읽은 수(새 대화 N)·읽음 표시

| AC | 유형 | 전제 | 동작 | 기대 |
|----|------|------|------|------|
| AC-16 | Playwright (2 context) | `dongbang2`가 `/dashboard/quick`(대시보드)을 열어 둠 · 그 건 메시지 없음 | 요청자가 메시지 2개 전송 | 5초 안에 대시보드 그 행(표)·모바일 카드(375px)에 배지 **「새 대화 2」**(`data-testid="quick-unread-{번호}"`) · 배지 클릭 → `/dashboard/quick/chat?request={번호}` |
| AC-17 | Playwright | AC-16 계속 · `dongbang2` | 「퀵 대화」 목록 | 그 항목 원형 배지 **2** · 「안 읽음」 탭에 그 건 있음 · 왼쪽 패널 상단 **「안 읽은 대화 1건」** |
| AC-18 | Playwright | AC-17 계속 · 그 건 채팅 알림 2건 unread(벨 N) | 그 대화 열기 | 첫 안 읽은 메시지 위에 **「여기부터 새 메시지」** 구분선 · 맨 아래까지 보이면 1초 안에 목록 배지 **사라짐** · 대시보드 배지도 0(다른 탭 포함 5초 안) · 새로고침 후에도 0 · **벨 숫자가 N−2로 즉시(1초 안) 감소** · `/dashboard/notifications`에서 그 2건이 「읽음」, 다른 퀵 알림(접수 등)은 unread 유지 · DB `notifications.status='read'` |
| AC-19 | API·DB | AC-18 | `quick_request_message_reads`(dongbang2, 그 건) | `last_read_message_id` = 마지막 메시지 id · 더 작은 id로 `PUT …/read` 호출 시 **값 유지**(뒤로 가지 않음) · 200 |
| AC-20 | Playwright | 요청자가 메시지를 보낸 상태 | 요청자가 자기 건 확인 | 내가 보낸 메시지는 **안 읽은 수에 0** · 요청자 대시보드 그 행 배지 없음 |
| AC-21 | Playwright (2 context) | 동방 A(`dongbang.json`)·B(`dongbang2`) active · 요청자 대화를 열어 둠 | ① 요청자 메시지 전송(`✓ 전송됨`) → **B**(접수자 아님)가 그 대화를 열어 맨 아래까지 봄 ② A 「알겠습니다」 전송 → B가 읽음 → 요청자가 읽음 | ① 5초 안에 요청자 화면 그 메시지가 **`✓✓ 읽음`**(동방 중 1명이면 충분) · tooltip **「{B 이름} · {절대 시각} 읽음」** · 이어서 A도 읽으면 tooltip에 2명 · `logistics.json`만 읽었을 때는 `✓ 전송됨` 유지 ② A 화면에서 B가 읽은 시점에는 **`✓ 전송됨` 유지**(동료 동방은 상대편 아님), 요청자가 읽은 뒤 5초 안에 `✓✓ 읽음` |

### D. 알림

| AC | 유형 | 전제 | 동작 | 기대 |
|----|------|------|------|------|
| AC-22 | API·DB | 새 `requested` 건 · 동방 A·B active · 메시지 없음 | 요청자 「동방특송 담당자님 이건 취소해주세요」 | `chat_message` = 동방 A·B 각 1건 · admin·구매물류·요청자 0 · 제목 **`{번호} · {요청자 이름} 메시지`** · 본문 완전 일치 |
| AC-23 | API·DB | A가 접수(`dispatching`) | 요청자 「담당자님 이건 40분 뒤로 시간 변경해주세요」 | 수신 = **A·B 모두 1건**(접수 전/후 구분 없음) · admin 0 |
| AC-24 | API·DB | AC-23 계속 | A 「불가능합니다」 → admin 「제가 확인했습니다」 → 요청자 「알겠습니다」 → B 「확인했습니다」 | ① 요청자 + **B**(admin 0) ② 요청자 + A + B ③ A + B + **admin**(참여자가 됨) ④ 요청자 + A + admin · 매번 보낸 사람 0 · 구매물류 0 |
| AC-25 | API·DB | 동방 A를 `status='inactive'`로 바꾼 건(접수자 여부 무관) | 요청자 메시지 → B 메시지 | 요청자 메시지 수신 = **B만**(A 0) · B 메시지 수신 = 요청자만(A 0) · fixture는 끝나고 원복 |
| AC-26 | API·DB | 300자 메시지 | 알림 본문 | 길이 200 · `…`로 끝남 · DB `body`는 300자 그대로 |
| AC-27 | Playwright | AC-24 이후 `user.json` | `/dashboard/notifications` → **「채팅 보기」** | URL `/dashboard/quick/chat?request={번호}` · 그 대화 선택됨 · 최신 메시지가 화면 안 · 다른 퀵 알림(접수 등)의 버튼은 「퀵 요청 보기」 그대로 |
| AC-28 | DB | SQL 적용 후 | CHECK·publication·테이블 | CHECK = 기존 30종 **전부** + `quick_request.chat_message` · publication에 `quick_request_messages`·`quick_request_message_reads` |

### E. 활동 로그·품질·테마

| AC | 유형 | 전제 | 동작 | 기대 |
|----|------|------|------|------|
| AC-29 | Playwright·API | AC-22·AC-05 이후 | `user.json` `/dashboard/logs` · admin `GET /api/activity-logs` | 「퀵 대화 메시지 전송」 행 · Status 201 · metadata `quick_request_no`·`body_length`·`recipient_count` · **본문 미포함** · 구매물류 403 실패 로그 1건 · `x-request-id` · **읽음 갱신(`PUT …/read`) 로그 0건** |
| AC-30 | grep | — | `…/messages/route.ts`·`…/messages/read/route.ts`·`src/features/quick-request/components/chat/**` | 전송 Route의 모든 `return`이 `jsonWithActivityLog`/`finishWithActivityLog` 경유 · metadata에 `body` 키 0 · `window.confirm` 0 · `rounded-[`·`shadow-[`·`bg-green-`·`bg-red-`·`backdrop-blur` 0 · 영어 UI 문구(`Messenger`·`Live`·`Search conversations`) 0 · `src/features/chat/**` 변경 0 |
| AC-31 | Playwright | cookie `active_theme` = `THEMES` 각 값 × light/dark(20조합, 1280) | `/dashboard/quick/chat` | 각 조합에서 `quick-chat-messenger`·전송 버튼 표시 · `scrollWidth <= clientWidth`(테마 목록은 `THEMES` import) |
| AC-32 | CLI | — | `npx tsc --noEmit` · `npm run lint` · `npm run build` · `npx playwright test e2e/quick-workflow e2e/quick-chat` | 모두 통과 |

### F. DM 동작·사이드바 배지

| AC | 유형 | 전제 | 동작 | 기대 |
|----|------|------|------|------|
| AC-33 | Playwright | `user.json` 대화 · `page.route`로 POST를 1.5초 지연 | 「테스트」 전송 | 클릭 직후(200ms 안) 말풍선이 **즉시** 표시되고 흐린 ✓(pending) · 응답 후 `✓ 전송됨` · 최종 말풍선 1개(임시·Realtime 중복 0) |
| AC-34 | Playwright | POST를 500으로 실패시킴 | 전송 → 「다시 보내기」(route 복구 후) | 말풍선에 **「전송 실패 · 다시 보내기」** · 입력창 내용 유지 · 다시 보내기 → 201 · `✓ 전송됨` · 미전송 항목 「삭제」는 `AlertModal` 없이 즉시(서버 데이터 아님) |
| AC-35 | Playwright | DB fixture: 어제 메시지 2개(같은 사람 2분 간격) + 오늘 메시지 1개 | 대화 열기 | 날짜 구분선 **2개**(`yyyy-MM-dd (EEE)` 형식) · 어제 2개는 이름·배지 **1회**, 시각은 두 번째에만 · 오늘 메시지는 이름 표시 |
| AC-36 | Playwright (3 context) + 단위 | 요청자·동방 A·동방 B가 같은 대화 | 요청자가 입력창에 타이핑 → 이어서 동방 B도 타이핑 | 2초 안에 A 화면 **「{요청자 이름}님이 입력 중…」** → B도 치면 **「{요청자 이름}님, {B 이름}님이 입력 중…」** · 본인(B) 화면에는 요청자만 · 타이핑 멈춘 뒤 5초 안에 사라짐 · 전송하면 즉시 사라짐 · 구매물류(읽기 전용)는 송신하지 않음 · 단위 테스트 `formatTypingNames`: 0명 `''` · 1명 `A님이 입력 중…` · 2명 `A님, B님이 입력 중…` · 3명 `A님 외 2명이 입력 중…` |
| AC-37 | Playwright (2 context) | `dongbang2`가 `/dashboard/overview` 대신 `/dashboard/quick`(아무 페이지) 열어 둠 · 안 읽은 메시지 0 | 요청자가 건 A에 2개, 건 B에 1개 전송 | 5초 안에 사이드바 「퀵 대화」 옆 배지 **3** · 접힌(icon) 모드에서는 배지 숨김·tooltip 유지 · `dongbang2`가 건 A를 열어 읽으면 5초 안에 **1** · `user2.json`(권한 없음)은 배지 없음 · 100건 이상이면 「99+」(단위 테스트 또는 fixture) |

**AC 총 37개**: A 9 · B 6 · C 6 · D 7 · E 4 · F 5.

---

## 범위 (In / Out)

### In
1. **SQL**: `quick_request_messages` · `quick_request_message_reads` · `private.can_view_quick_request` · RLS SELECT · 쓰기 revoke · RPC 2종(읽음 갱신·안 읽은 수) · Realtime publication 2테이블 · `notifications_type_check` +1
2. **API**:
   - `GET/POST /api/quick-request/[requestNo]/messages`
   - `PUT /api/quick-request/[requestNo]/messages/read`
   - `GET /api/quick-request/conversations`
   - `GET /api/quick-request` 목록 행에 `unreadMessageCount` 추가
3. **서버 모듈**: `messages.server.ts`(목록·작성·권한·읽음·안 읽은 수·대화 목록), 알림 `notifyQuickRequestChatMessage()`(92 `notifications.server.ts`), 수신 규칙 순수 함수
4. **알림 FE**: type 추가, 「채팅 보기」 액션, 이동 `/dashboard/quick/chat?request=`
5. **FE 공용 대화 컴포넌트**: `QuickRequestConversation`(헤더 slot·메시지 목록·말풍선·구분선·✓/✓✓·칩·입력창·읽기 전용 안내·Realtime·읽음 갱신)
6. **FE 「퀵 대화」 페이지**: `/dashboard/quick/chat` + `loading.tsx`, 대화 목록 패널(검색·전체/안 읽음 탭·안 읽은 수), nuqs `request`·`q`·`tab`, 모바일 목록↔대화 전환
7. **FE 상세**: 「요청 대화」 영역(PC 상세와 함께, 모바일 「대화」 버튼 → Drawer 또는 탭 · designer 결정), `?chat=1`
8. **FE 대시보드**: 표·모바일 카드에 「새 대화 N」 배지(클릭 → 「퀵 대화」), 92 Realtime 컴포넌트에 메시지·읽음 이벤트 추가
9. **nav·allowlist**: nav 「퀵 대화」(shortcut `q c`), `dongbang-routes.ts`에 `/dashboard/quick/chat` 명시, kbar 동일
10. **activity log**: `quick_request.message_create` + 라벨 「퀵 대화 메시지 전송」, metadata allowlist(`message_id`·`body_length`·`recipient_count`)
11. **90 info-content**: 「할 수 있는 일」에 대화 규칙 1줄
12. **DM 동작**: optimistic 전송·실패 재시도·날짜 구분선·연속 묶음·자동 스크롤·「입력 중…」 broadcast(§DM 항목 결정표)
13. **채팅 알림 자동 읽음**: `PUT …/messages/read`가 알림도 읽음 처리 + FE optimistic(벨 즉시 감소) + `notificationKeys.all` invalidate
14. **사이드바 배지**: `NavItem.badge`, `src/components/layout/nav-badges.tsx`(배지 훅 레지스트리), `SidebarNavLeafItem`이 `SidebarMenuBadge` 렌더, `GET /api/quick-request/unread-total` + RPC, dashboard layout에 `QuickChatUnreadRealtime`
15. **plan 91 파일 확장**: `push-groups.ts` type 추가, `notification-route.ts` 채팅 규칙
16. **E2E**: `e2e/quick-chat/*.spec.ts`(신규), 테마 스모크, cleanup cascade 확인
17. **문서**: 91 수정 이력 메모, README 93 갱신

### Out
| 항목 | 이유 |
|------|------|
| 파일·사진 첨부 | C-15 |
| 전화·영상 버튼 | C-15(상세의 전화 링크로 대체) |
| 온라인 점(Presence) | C-15 · §DM 항목 결정표(「입력 중…」은 In으로 번복) |
| 메시지 수정·삭제 | 업무 증거 보존 |
| 칩을 누르면 바로 전송 | 오발송 방지(C-14) |
| 반응(이모지)·답장 인용·메시지 검색·전달 | §DM 항목 결정표 |
| 화면을 보고 있을 때 알림 생략 | 사용자 「무조건 알림」 |
| 채팅 내용으로 상태 자동 변경 | 상태 변경은 기존 버튼만 |
| 메시지 페이지네이션 | 1건당 최근 500개까지만 불러온다 **[INFERRED]** |
| 템플릿 데모(`src/features/chat/**`, `/dashboard/chat`) 삭제·수정 | C-19 |
| 휴대폰 푸시 | plan 91 |
| Main DB 적용 | 사용자 수동 |

---

## UI 요구사항 (designer 지시)

> 데모(`shadcn-dashboard.kiranism.dev/dashboard/chat`, 저장소 `src/features/chat/**`)의 **배치와 정보 구성만 참고**한다. 구현은 shadcn 컴포넌트·시맨틱 토큰·테마 토큰만 쓰고, THEMES 10종 × light/dark를 지킨다. 문구는 모두 한국어로 쓴다.

| # | 화면 | 요구 |
|---|------|------|
| U-1 | 「퀵 대화」 레이아웃 | `PageContainer` · 높이는 뷰포트에 맞춘다(페이지 스크롤 없음, 패널 내부 `ScrollArea`). PC(≥1024): 왼쪽 목록 약 30%와 오른쪽 대화 2단. 태블릿·모바일: 목록과 대화를 전환하고(URL `request`), 대화 상단에 「목록」 버튼을 둔다. `data-testid="quick-chat-messenger"` |
| U-2 | 대화 목록 패널 | 제목 「퀵 대화」, 보조 문구 「대화 N건 · 안 읽은 대화 M건」, 배지 「실시간」(Realtime 연결 중일 때만, 끊기면 「연결 중…」 muted). 검색 `Input`(요청번호·요청자·주소, debounce 300ms, nuqs `q`), `Tabs` 「전체」/「안 읽음」(nuqs `tab`). 항목: `Avatar` 이니셜(요청자 이름 첫 글자) · 1줄 `{요청번호} · {요청자}` + 상태 `Badge`(89 색 규칙) · 2줄 경로(`시·구 → 시·구`) · 3줄 마지막 메시지 `{이름}: {본문}`(line-clamp 1) 또는 「아직 대화가 없습니다」 · 오른쪽 위 마지막 메시지 시각 · 안 읽은 수 원형 `Badge`(99+) · 선택 항목 강조(`bg-accent` 계열 토큰). 정렬: 마지막 메시지 시각 내림차순, 메시지 없는 건은 요청 시각 내림차순. 범위: 대시보드와 같은 **최근 7일 + 그 밖에 내가 안 읽은 메시지가 있는 건** |
| U-3 | 대화 헤더 | Messenger: `{요청번호}` + 상태 `Badge` + 경로·요청자, 오른쪽 「상세 보기」(`/dashboard/quick/{번호}`). 상세 안: 제목 「요청 대화」만 |
| U-4 | 메시지 | 내 메시지는 오른쪽(primary 계열), 다른 사람은 왼쪽(muted 계열). 말풍선 위에 이름 + 역할 `Badge`(「요청자」/「동방특송」/「관리자」), 아래에 절대 시각. 내 메시지는 `✓ 전송됨`/`✓✓ 읽음`(`Icons.check`/`Icons.checks`, `Tooltip`에 읽은 사람·시각). 본문은 `whitespace-pre-wrap break-words`. 사용자가 맨 아래 근처에 있을 때만 자동 스크롤하고, 아니면 「새 메시지 N ↓」 버튼을 보여 준다 |
| U-5 | 안 읽은 구분선 | `Separator` + 가운데 텍스트 「여기부터 새 메시지」(C-13) |
| U-6 | 입력 영역 | 빠른 답장 칩 줄(가로 스크롤, `Button variant="outline" size="sm"`) → `Textarea`(자동 높이 1~5줄, placeholder AC-04) + 「전송」 `Button`(Spinner·비활성). Enter 전송·Shift+Enter 줄바꿈·IME 조합 중 Enter 무시. 900자부터 「남은 글자 N」. 첨부 버튼 없음 |
| U-7 | 읽기 전용 | 입력 영역 자리에 안내 한 줄(AC-05·AC-07 문구). 칩 숨김 |
| U-8 | 상세 「요청 대화」 | PC: 상세 정보를 보면서 대화할 수 있는 배치(오른쪽 aside 상단 카드 또는 3열 등, designer 결정). 모바일: 하단 액션바 옆 **「대화」** 버튼(안 읽은 수 배지 포함)을 누르면 Drawer 또는 탭(designer 결정, 키보드에 가리지 않게). `?chat=1`이면 열린 상태로 시작 |
| U-9 | 대시보드 배지 | 표에서는 「요청 정보」 셀의 요청번호 옆에, 모바일 카드에서는 상단 오른쪽에 「새 대화 N」 `Badge`. 클릭하면 「퀵 대화」로 간다. 0이면 숨김 |
| U-10 | 빈·로딩·오류 | 목록 로딩은 `PageLoadingSpinner variant="compact"`(filter shell 유지, plan 40). 선택 없음: 「왼쪽에서 대화를 선택하세요」. 찾을 수 없음: 「대화를 찾을 수 없습니다.」. 전송에 실패하면 `notifyError(서버 메시지)`를 띄우고 입력 내용은 유지한다 |
| U-11 | 접근성 | 목록은 `role="list"`, 선택 항목은 `aria-current`. 메시지 목록은 `aria-live="polite"`. 아이콘 버튼에는 `aria-label`. `prefers-reduced-motion`이면 애니메이션 없음 |
| U-13 | 말풍선 상태 | optimistic 중: 흐린 ✓ + 투명도 · 실패: 테두리 destructive 계열 토큰 + 「전송 실패 · 다시 보내기」·「삭제」 작은 버튼 · 연속 묶음: 첫 말풍선에만 이름·배지·아바타, 마지막에만 시각 · 날짜 구분선: `Separator` 가운데 `yyyy-MM-dd (EEE)` |
| U-14 | 「입력 중…」 | 메시지 목록 맨 아래(입력창 위) 한 줄 `{이름}님이 입력 중…` muted, 점 3개 애니메이션(`prefers-reduced-motion`이면 정적). 여러 명이면 C-23 문구(`A님, B님이 입력 중…` / `A님 외 2명이 입력 중…`), 줄은 항상 1줄(`truncate`) |
| U-15 | 사이드바 배지 | 「퀵 대화」 메뉴 오른쪽 `SidebarMenuBadge`(기존 ui) 안에 `Badge`-톤 숫자(`bg-primary text-primary-foreground`, 99+). 0이면 렌더 안 함. 접힌 모드는 기존 규칙대로 숨김. kbar에는 표시 안 함 |
| U-12 | 90 ⓘ | 「할 수 있는 일」에 다음 1줄을 추가한다: 「퀵 대화: 요청자·동방특송·관리자는 메시지를 보낼 수 있고, 구매물류팀은 볼 수만 있습니다. 승인·취소된 요청은 볼 수만 있습니다. 메시지 알림은 보낸 사람을 뺀 참여자 전원(요청자·동방특송 전원·대화에 참여한 관리자)에게 갑니다.」 |

---

## API / DB 요구사항

### DB (`supabase/sql/{NN}_quick_request_messages.sql` · dev 전용)

```sql
-- Plan: 93_quick-request-chat-plan.md
-- Date: 2026-10-22
-- Status: Approved
-- Summary: 퀵 요청 건별 대화 · 사용자별 읽음 위치 · RLS(그 건을 볼 수 있는 사람만 SELECT) · 쓰기 service_role 전용
--          RPC: mark_quick_request_messages_read · quick_request_unread_counts · quick_request_unread_total (service_role 전용)
--          Realtime publication 2테이블 · notifications_type_check += quick_request.chat_message

create table public.quick_request_messages (
  id bigint generated always as identity primary key,
  quick_request_id uuid not null references public.quick_requests (id) on delete cascade,
  author_user_id uuid not null references auth.users (id) on delete restrict,
  author_name text not null check (char_length(author_name) between 1 and 100),
  author_role text not null check (author_role in ('requester', 'dongbang', 'admin')),
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
comment on table public.quick_request_messages is
  '퀵 요청 건별 대화. 수정·삭제 없음. 본문은 개인정보 — activity_logs에 저장 금지. plan 93';
create index idx_qrm_request_id on public.quick_request_messages (quick_request_id, id);
create index idx_qrm_request_author on public.quick_request_messages (quick_request_id, author_user_id);

create table public.quick_request_message_reads (
  user_id uuid not null references auth.users (id) on delete cascade,
  quick_request_id uuid not null references public.quick_requests (id) on delete cascade,
  last_read_message_id bigint not null default 0,
  last_read_at timestamptz not null default now(),
  primary key (user_id, quick_request_id)
);
comment on table public.quick_request_message_reads is
  '사용자별 대화 읽음 위치(안 읽은 수·✓✓ 표시). 뒤로 가지 않음(greatest). plan 93';
create index idx_qrmr_request on public.quick_request_message_reads (quick_request_id);

create or replace function private.can_view_quick_request(p_uid uuid, p_request_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_uid is not null and exists (
    select 1 from public.quick_requests q
    where q.id = p_request_id
      and (q.requester_user_id = p_uid or private.can_view_all_quick_requests(p_uid))
  );
$$;
revoke all on function private.can_view_quick_request(uuid, uuid) from public, anon;
grant execute on function private.can_view_quick_request(uuid, uuid) to authenticated, service_role;

alter table public.quick_request_messages enable row level security;
alter table public.quick_request_message_reads enable row level security;

create policy quick_request_messages_select on public.quick_request_messages
  for select to authenticated
  using (private.can_view_quick_request((select auth.uid()), quick_request_id));
-- 읽음 위치는 그 건을 볼 수 있는 사람끼리 공유(✓✓ 표시·Realtime). 본문 없음
create policy quick_request_message_reads_select on public.quick_request_message_reads
  for select to authenticated
  using (private.can_view_quick_request((select auth.uid()), quick_request_id));

revoke all on public.quick_request_messages, public.quick_request_message_reads from anon, authenticated;
grant select on public.quick_request_messages, public.quick_request_message_reads to authenticated;
grant all on public.quick_request_messages, public.quick_request_message_reads to service_role;

-- 읽음 갱신(뒤로 가지 않음)
create or replace function public.mark_quick_request_messages_read(p_user uuid, p_request uuid, p_message_id bigint)
returns bigint language sql security definer set search_path = '' as $$
  insert into public.quick_request_message_reads (user_id, quick_request_id, last_read_message_id, last_read_at)
  values (p_user, p_request, p_message_id, now())
  on conflict (user_id, quick_request_id) do update
    set last_read_message_id = greatest(public.quick_request_message_reads.last_read_message_id, excluded.last_read_message_id),
        last_read_at = case when excluded.last_read_message_id > public.quick_request_message_reads.last_read_message_id
                            then now() else public.quick_request_message_reads.last_read_at end
  returning last_read_message_id;
$$;

-- 안 읽은 수 (여러 건 한 번에)
create or replace function public.quick_request_unread_counts(p_user uuid, p_request_ids uuid[])
returns table (quick_request_id uuid, unread_count int) language sql stable security definer set search_path = '' as $$
  select m.quick_request_id, count(*)::int
  from public.quick_request_messages m
  left join public.quick_request_message_reads r
    on r.user_id = p_user and r.quick_request_id = m.quick_request_id
  where m.quick_request_id = any (p_request_ids)
    and m.author_user_id <> p_user
    and m.id > coalesce(r.last_read_message_id, 0)
  group by m.quick_request_id;
$$;
-- 사이드바 배지: 내가 볼 수 있는 모든 건의 안 읽은 합계 (service_role · Route에서 세션 uid 전달)
create or replace function public.quick_request_unread_total(p_user uuid)
returns int language sql stable security definer set search_path = '' as $$
  select coalesce(count(*), 0)::int
  from public.quick_request_messages m
  join public.quick_requests q on q.id = m.quick_request_id
  left join public.quick_request_message_reads r
    on r.user_id = p_user and r.quick_request_id = m.quick_request_id
  where (q.requester_user_id = p_user or private.can_view_all_quick_requests(p_user))
    and q.requested_at >= now() - interval '90 days'          -- [INFERRED] 상한. 90일 지난 건의 안 읽음은 세지 않음
    and m.author_user_id <> p_user
    and m.id > coalesce(r.last_read_message_id, 0);
$$;
revoke all on function public.quick_request_unread_total(uuid) from public, anon, authenticated;
grant execute on function public.quick_request_unread_total(uuid) to service_role;

revoke all on function public.mark_quick_request_messages_read(uuid, uuid, bigint) from public, anon, authenticated;
revoke all on function public.quick_request_unread_counts(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.mark_quick_request_messages_read(uuid, uuid, bigint) to service_role;
grant execute on function public.quick_request_unread_counts(uuid, uuid[]) to service_role;

alter publication supabase_realtime add table public.quick_request_messages;
alter publication supabase_realtime add table public.quick_request_message_reads;

-- notifications_type_check: 적용 시점 dev의 현재 목록(30종)을 읽어 「기존 전부 + quick_request.chat_message」로 재정의 (덮어쓰기 금지)
```

- `author_role`은 작성 시점에 판정한다: S = 요청자이면 `requester`, 동방이면 `dongbang`, 그 밖의 admin이면 `admin`(요청자 판정 우선).
- 메시지를 보내면 같은 트랜잭션 흐름에서 보낸 사람의 읽음 위치를 그 메시지 id로 올린다(AC-20).
- 잠금 상태 확인과 insert 사이의 짧은 경합은 허용한다 **[INFERRED]**. 필요하면 `insert … select … where status not in ('approved','cancelled')` 한 문장으로 바꾼다.
- 읽음 위치 SELECT를 같은 건을 볼 수 있는 사람에게 공개하는 것은 ✓✓ 표시와 Realtime 때문이다. 본문이 없으므로 개인정보 노출 범위가 작다고 판단했다(구매물류팀도 「누가 언제 읽었는지」는 볼 수 있음).

### Route

| Method · Path | 권한 | 동작 | 응답 |
|---|---|---|---|
| `GET /api/quick-request/conversations?q=&tab=all\|unread` | active + 조회 범위 | U-2 범위·정렬로 대화 목록을 만든다(건마다 마지막 메시지·안 읽은 수). 최대 100건 | 200 `{data:{conversations:[{requestNo, id, status, requesterName, route, lastMessage:{authorName, body(120자), createdAt}\|null, unreadCount, requestedAt}], totals:{conversations, unreadConversations}}}` · 401 |
| `GET /api/quick-request/[requestNo]/messages` | 조회 권한 | 메시지 오름차순(최근 500) + 내 읽음 위치 + 상대편 읽음 위치 + 쓰기 가능 여부 | 200 `{data:{messages:[{id, authorUserId, authorName, authorRole, body, createdAt}], myLastReadMessageId, reads:[{userId, name, role, lastReadMessageId, lastReadAt}], canWrite, readOnlyReason: null\|'logistics'\|'locked', quickReplies:string[]}}` · 401 · 404 |
| `POST /api/quick-request/[requestNo]/messages` `{body}` | 요청자 본인·동방·admin | 검증 → insert → 보낸 사람 읽음 위치 갱신 → `safeNotify(notifyQuickRequestChatMessage)` | 201 `{data:{message}}` · 400 · 401 · 403(구매물류) · 404 · 409(잠금) · 500 |
| `PUT /api/quick-request/[requestNo]/messages/read` `{lastMessageId}` | 조회 권한 | `mark_quick_request_messages_read` 호출(그 건의 메시지 id인지 검증) → **그 건의 `quick_request.chat_message` 알림 중 `recipient_user_id=본인 AND status='unread'`를 `read`로 update**(C-21, service_role · `metadata->>'quick_request_id'`) | 200 `{data:{lastReadMessageId, notificationsMarkedRead:number}}` · 400 · 401 · 404 · 500 |
| `GET /api/quick-request/unread-total` | active | `quick_request_unread_total(uid)` RPC 1회 | 200 `{data:{total}}` · 401 · 500 |
| `GET /api/quick-request` (기존) | 기존 | 행마다 `unreadMessageCount`(RPC 1회) | 기존 + 필드 |

- `[requestNo]`는 `^\d{4}-\d{2,}$`로 검증하고, 맞지 않으면 404다. 정적 세그먼트 `conversations`가 동적 세그먼트보다 우선한다(89 `notes`와 같은 방식).
- 조회 권한이 없으면 존재 여부를 숨기기 위해 404를 돌려준다(89 규칙).
- Zod: `body: z.string().transform(trim).pipe(z.string().min(1, '메시지를 입력해 주세요.').max(1000, '메시지는 1,000자까지 입력할 수 있습니다.'))`, `lastMessageId: z.number().int().nonnegative()`.

### 알림 (`notifyQuickRequestChatMessage`)

```
input: { row, message, sender }
1. participants = [row.requester_user_id] ∪ activeDongbangIds            ← 접수 여부·status·accepted_by 무관 (r3)
2. adminParticipants = distinct author_user_id from quick_request_messages
                       where quick_request_id = row.id and author_role = 'admin'   ← 방금 insert한 메시지 포함
3. recipients = unique(participants ∪ adminParticipants) − sender − inactive       ← 순수 함수 resolveChatRecipients()
   // activeDongbangIds·adminParticipants·requester는 Route가 조회해 넘기고, 함수는 집합 연산만 한다(단위 테스트 가능)
4. row = { type:'quick_request.chat_message', title:`${no} · ${sender.name}(20자) 메시지`,
           body: truncate(message.body.trim(), 200),
           metadata:{ kind:'quick_request.chat_message', quick_request_no, quick_request_id,
                      quick_request_event:'chat_message', quick_request_message_id, actor_user_id } }
5. insert 1회 (plan 91 구현 후 insertNotifications)
```

### FE 데이터·실시간

- keys: `quickRequestKeys.conversations(filters)`, `messages(no)`. 안 읽은 수는 목록(`lists`)·대화 목록 응답에 포함한다.
- `QuickRequestRealtime`(92)을 확장한다. `quick_request_messages` INSERT와 `quick_request_message_reads` INSERT/UPDATE를 필터 없이 구독하고, 300ms debounce로 `lists`·`summary`·`conversations`를 invalidate한다.
- 대화 컴포넌트는 그 건만 구독한다(`filter: quick_request_id=eq.{id}`). 메시지는 `setQueryData`로 merge하고 id로 중복을 없앤다. 읽음 이벤트가 오면 `messages(no)`의 `reads`를 갱신한다.
- 읽음 갱신(`PUT …/read`)은 `mutationOptions`로 만든다. `onMutate`에서 ① `quickRequestKeys` 캐시의 해당 건 `unreadCount`를 0으로, ② `unreadTotal`을 그만큼 빼고, ③ 알림 캐시에 `applyMarkNotificationReadOptimistic`을 그 건의 `chat_message`·unread 알림 id마다 적용한다(벨 즉시 감소). `onError`는 `restoreNotificationQueries`로 되돌린다. `onSettled`에서 `lists`·`conversations`·`unreadTotal`·`notificationKeys.all`을 invalidate한다. 같은 id면 다시 호출하지 않는다.
- **optimistic 전송**: `useMutation(sendMessage)` `onMutate`에서 `messages(no)` 캐시에 `{id:'temp-…', pending:true}`를 추가 → 성공 시 서버 행으로 교체 → 실패 시 `failed:true`로 바꾸고 「다시 보내기」가 같은 본문으로 재시도. Realtime merge는 서버 id로만 dedupe하므로 임시 항목과 충돌하지 않는다.
- **날짜 구분선·묶음**은 렌더 시 파생(`groupMessages(messages)` 순수 함수: 날짜 경계, 같은 작성자 5분 이내).
- **「입력 중…」**: 대화 채널(`quick-chat-{id}`)에 `broadcast` `{type:'typing', userId, name}` 송신(입력 시작 1회·3초 throttle·전송/blur 시 `stop`). 수신 측은 본인 제외, **userId별 4초 타이머**(`Map<userId, {name, timer}>`)로 해제하고 `formatTypingNames(names)`(C-23)로 1줄을 만든다. `canWrite=false`면 송신하지 않는다.
- **✓✓ 판정**(C-12): `reads` 중 상대편(`authorRole==='requester'`인 내 메시지면 `role in ('dongbang','admin')`, 아니면 `role==='requester'`)의 `lastReadMessageId >= message.id`가 **1명 이상**이면 읽음. tooltip은 그 조건을 만족하는 전원.
- **사이드바 배지**: `quickRequestKeys.unreadTotal()` + `useQuery`(staleTime 30s, `refetchOnWindowFocus`). `src/components/layout/nav-badges.tsx`에 `NAV_BADGES: Record<NavBadgeKey, () => number>` 레지스트리(`'quick-chat-unread': useQuickChatUnreadTotal`)를 두고, `SidebarNavLeafItem`이 `item.badge`가 있으면 해당 훅으로 값을 읽어 `SidebarMenuBadge`를 그린다. 훅은 `useQuery`(non-suspense)라 Suspense 경계 없이 안전하다. `nav-config.ts`의 「퀵 대화」 항목에 `badge: 'quick-chat-unread'`. `src/types/index.ts` `NavItem`에 `badge?: NavBadgeKey` 추가.
- **`QuickChatUnreadRealtime`**(dashboard layout, `NotificationsRealtime` 옆): `quick_request_messages` INSERT(필터 없음, RLS)와 `quick_request_message_reads` UPDATE/INSERT(`filter: user_id=eq.{me}`)를 구독해 1초 debounce로 `unreadTotal`·`conversations`·`lists`를 invalidate. 92의 `QuickRequestRealtime`(페이지 단위)과 채널 이름을 다르게 둔다.

### FE 알림 이동

- `notification-helpers.ts`: `type === 'quick_request.chat_message'`이면 액션 `view-quick-request-chat` 「채팅 보기」를 쓴다.
- `notification-infinite-list.tsx`: `view-quick-request-chat` + `metadata.quick_request_no` → `/dashboard/quick/chat?request={no}`.

---

## 활동 감사 로그 (기록 연동)

> `core-conventions.mdc` §활동 감사 로그 · [plan 08](./08_activity-audit-log-plan.md)

| Route | action | 라벨 | target | return 분기 | metadata allowlist |
|---|---|---|---|---|---|
| `POST /api/quick-request/[requestNo]/messages` | `quick_request.message_create` | 퀵 대화 메시지 전송 | `quick_request` / `{requestNo}` | 201 · 400(JSON·zod) · 401/403(세션) · 403(구매물류) · 404 · 409(잠금) · 500 | `{quick_request_no, message_id?, body_length, recipient_count?}` — **`body` 금지** |
| `PUT /api/quick-request/[requestNo]/messages/read` | — | — | — | **로그 Out (예외)** | — |

**읽음 위치 갱신을 로그에서 빼는 근거(core-conventions 「모든 CUD 기록」의 명시적 예외):**
1. 사용자가 결정해서 누르는 동작이 아니다. 화면에 메시지가 보이면 **자동으로** 호출된다. 이와 달리 plan 27의 `notification.read`는 사용자가 「읽음」을 직접 누르는 동작이라 기록한다.
2. 대화를 볼 때마다, 새 메시지가 올 때마다 호출되어 감사 로그가 **노이즈로 가득 찬다**. 동방 3명 × 하루 수십 건이면 메시지 전송 로그보다 몇 배 많아진다.
3. 업무 데이터(요청·금액·상태)를 바꾸지 않는 **표시용 상태**다. 「누가 언제 읽었는지」는 `quick_request_message_reads.last_read_at`에 이미 남는다.
4. 사용자(root 전달)가 「읽음 갱신은 로그 Out」 방향을 제시했다.
5. 같은 Route가 수행하는 **채팅 알림 자동 읽음(C-21)도 같은 이유로 Out**이다. plan 27의 `notification.read`는 사용자가 알림을 직접 누른 행위이므로 계속 기록되고, 이 Route는 그 action을 쓰지 않는다. `GET /api/quick-request/unread-total`은 READ → Out.

그 밖의 규칙:
- `GET` 3종은 READ라서 Out이다.
- 알림 INSERT는 기존 원칙대로 Out이다.
- 삭제 UI가 없으므로 `AlertModal` 대상도 없다. `window.confirm`은 0건이어야 한다(AC-30).
- 검증: AC-29.

---

## 영향 파일 & 패턴

| 팀 | 파일 |
|---|---|
| BE | `supabase/sql/{NN}_quick_request_messages.sql`(신규) · `src/app/api/quick-request/conversations/route.ts`(신규) · `[requestNo]/messages/route.ts`(신규) · `[requestNo]/messages/read/route.ts`(신규) · `src/app/api/quick-request/route.ts`(GET `unreadMessageCount`) · `src/app/api/quick-request/unread-total/route.ts`(신규) · `src/features/quick-request/api/messages.server.ts`(신규) · `api/notifications.server.ts`(채팅 알림 + `resolveChatRecipients`) · `api/workflow.server.ts`(목록 안 읽은 수) · `schemas/quick-request-message.ts`(신규) · `src/features/notifications/api/types.ts` · `src/features/activity-logs/api/{types,log.server}.ts` · `labels.ts` |
| FE | `src/app/dashboard/quick/chat/{page,loading}.tsx`(신규) · `src/features/quick-request/components/chat/{quick-chat-messenger,quick-chat-conversation-list,quick-chat-conversation-item,quick-request-conversation,quick-chat-header,quick-chat-message-list,quick-chat-bubble,quick-chat-unread-divider,quick-chat-quick-replies,quick-chat-composer,quick-chat-read-only-notice,quick-chat-realtime,use-mark-read}.tsx`(신규) · `detail/quick-request-detail-page.tsx`·`quick-request-action-bar.tsx`(대화 버튼·`?chat=1`) · `dashboard/quick-dashboard-columns.tsx`·`quick-request-mobile-card.tsx`(새 대화 배지) · `components/quick-request-realtime.tsx`(92, 이벤트 추가) · `api/{keys,queries,service,mutations,types}.ts` · `src/lib/searchparams.ts`(`request`·`q`·`tab`) · `src/config/nav-config.ts`(「퀵 대화」) · `src/config/dongbang-routes.ts` · `src/features/notifications/components/{notification-helpers.ts,notification-infinite-list.tsx}` · `src/features/quick-request/info-content.ts` · **`src/types/index.ts`**(`NavItem.badge`) · **`src/components/layout/nav-badges.tsx`**(신규) · **`src/components/layout/app-sidebar.tsx`**(`SidebarNavLeafItem` 배지 렌더, `src/components/ui` 무수정) · `src/app/dashboard/layout.tsx`(`QuickChatUnreadRealtime`) · `components/chat/{quick-chat-unread-realtime,quick-chat-typing-indicator,use-typing-broadcast,group-messages,format-typing-names}.ts(x)`(신규) · `src/features/quick-request/lib/__tests__/{resolve-chat-recipients,format-typing-names}.test.ts`(신규, r3) · **`src/features/notifications/lib/push-groups.ts`**·**`notification-route.ts`**(91 파일 append) · `src/features/notifications/api/optimistic.ts`(재사용, 변경 없음) |
| verifier | `e2e/quick-chat/{nav-access,messenger,send-realtime,unread,read-receipt,notifications,dm-behaviors,sidebar-badge,logs,theme}.spec.ts`(신규) · `e2e/quick-workflow/helpers.ts`(메시지 helper) · `scripts/cleanup-e2e-mock-data.mjs`(cascade 확인) |

**따를 패턴:**
- 배치·정보 구성: 템플릿 `src/features/chat/components/{messenger,conversation-list,chat-area,message-bubble,message-composer}.tsx`(참고만, 복사한 경우에도 토큰·한국어·테마 규칙으로 고친다)
- Realtime: `support-comment-realtime.tsx`
- 로그 분기: 43 댓글 Route
- 퀵 Route 공통 helper: 89 `quickRequestPath`·`quickErrorBody`·`quickLogMetadata`
- URL 상태: nuqs(plan 73)
- filter shell: plan 40
- React Query: `mutationOptions` + `onSettled`

---

## 리스크 & 완화

| 등급 | 리스크 | 완화 |
|---|---|---|
| HIGH | 권한 구멍(남의 건 메시지·읽음 위치 열람·작성) | RLS(`can_view_quick_request`)와 Route 권한을 이중으로 둔다. Realtime에도 RLS가 적용된다. AC-06·14 |
| HIGH | 알림 수신자 계산 오류(동방 1명 누락·본인 수신·참여하지 않은 admin 수신·비활성 수신) | `resolveChatRecipients` 순수 함수(집합 연산만)로 분리하고 단위 테스트를 둔다. AC-22~25 |
| MED (사용자 수용) | **알림 양 증가** — 동방 전원이 모든 건의 모든 메시지 알림을 받는다(동방 1인당 약 100건/일, 이전 규칙의 2~3배 · §알림 양 추정) | **줄이지 않는다**(사용자 「알림 양이 늘어나도 상관 없음」 2026-10-26). 남는 완화: plan 91 푸시 그룹 「퀵 요청」 OFF 가능(인앱은 유지) · 대화를 열면 자동 읽음(C-21) |
| HIGH | 안 읽은 수 불일치(탭·화면 간, 새로고침 전후) | 서버 RPC 한 곳에서 계산한다. 읽음 위치는 뒤로 가지 않는다. 모든 화면이 같은 query key를 쓰고 Realtime으로 invalidate한다. AC-16~20 |
| MED | 읽음 갱신 호출 과다 | 보일 때만 호출, 500ms debounce, 같은 id 재호출 금지, 로그 Out |
| MED | Realtime 이벤트 폭주(필터 없는 구독) | 300ms debounce, invalidate만 하고 payload는 쓰지 않는다. 사용자 수가 수십 명이라 감당 가능 **[INFERRED]** |
| MED | 메시지가 응답과 Realtime으로 2번 표시됨 | id 기준 merge. AC-10 |
| MED | 한글 IME Enter로 반쯤 쓴 글 전송 | `isComposing` 검사. AC-11 |
| MED | 템플릿 코드를 복사하다 테마 규칙 위반(고정 radius·blur·하드코딩 색·영문) | AC-30 grep, AC-31 테마 20조합 |
| MED | `notifications_type_check` 재정의 시 기존 type 누락 | 적용 시점 목록 기반으로 재정의한다. AC-28 |
| MED | plan 91과 type 수 불일치 | 91 수정 이력 메모 |
| MED | 모바일 키보드가 입력창을 가림(Drawer) | designer가 `visualViewport`를 고려한다. AC-03·04 |
| MED | **안 읽은 수 집계 비용** — 동방특송은 모든 건이 참여 대상이라 사이드바 합계·대화 목록·대시보드 안 읽은 수가 **전 건 × 메시지**로 집계된다(r3). 규모 추정: 동방 1인당 90일 × 20건/일 = 1,800건 × 평균 6메시지 ≈ **11,000행 스캔/호출** · 동방 3명 + admin이 각자 호출 | ① RPC 1회·인덱스 `(quick_request_id, id)` + `quick_requests.requested_at` 인덱스(89)로 90일 범위를 먼저 좁힘 → 수 ms~수십 ms **[INFERRED]** ② **90일 상한 유지**(`unread_total`), 대화 목록은 **7일 + 안 읽음 있는 건**(U-2), 대시보드 목록은 화면에 있는 건 id만 `unread_counts`에 넘김 ③ 클라이언트: staleTime 30s·Realtime invalidate 1초 debounce·같은 id 재호출 금지 ④ 새 메시지 INSERT마다 동방 전원 + 참여 admin 화면이 invalidate되므로 사용자 수(수십 명)·메시지 수(수백/일)에서는 감당 가능 **[INFERRED]** ⑤ 느려지면 2차 안: `quick_requests`에 `message_count`·`last_message_id` 비정규화 컬럼(트리거) → 안 읽은 수 = `message_count − (내 읽음 위치까지의 수)`를 읽음 행에 캐시 |
| MED | 알림 자동 읽음이 plan 27 읽음과 꼬임(이미 읽은 알림 재처리·로그 중복) | `status='unread'`만 update · 로그 Out · 알림 목록 캐시는 37 optimistic helper 재사용 · AC-18 |
| MED | 「입력 중…」 broadcast 소음·누수 — 참여자가 많아 동시 입력·타이머가 여러 개 | 3초 throttle·userId별 4초 자동 해제·채널은 대화 unmount 시 제거 · 읽기 전용은 송신 금지 · 표시는 `formatTypingNames`로 1줄 고정(C-23) · AC-36 |
| MED | optimistic 임시 항목이 실패 후 남거나 중복 | 서버 id만 dedupe, 실패 항목은 명시 「삭제」 또는 재시도 성공 시 제거 · AC-33·34 |
| LOW | 대화 목록 범위(7일 + 안 읽음) 계산 비용 | 최대 100건, 인덱스 `(quick_request_id, id)` |
| LOW | `/dashboard/quick/chat`이 동적 `[requestNo]`와 충돌 | 정적 세그먼트 우선(`request`와 같음). allowlist 명시 등록 |

**롤백:**
- DB: publication에서 2테이블을 빼고 → 테이블 2개 drop → 함수 3개 drop → CHECK에서 1종 제거(알림이 0건일 때).
- 코드: git revert. 템플릿 데모는 건드리지 않았으므로 영향이 없다.

---

## Battle Plan (단계)

| # | 단계 | 산출물 | 확신도 | 의존 |
|---|---|---|---|---|
| 0 | plan 92 완료 확인 · root Step 0 백업 | — | HIGH | 92 |
| 1 | designer: 「퀵 대화」 2단·모바일 전환, 공용 대화 컴포넌트(말풍선·배지·✓/✓✓·구분선·칩·입력·읽기 전용), 상세 배치, 대시보드 배지. 템플릿을 참고하되 토큰 변환 | 설계 메모 | MED | — |
| 2 | BE: SQL dev 적용 + 타입 | 테이블·RLS·RPC·publication·CHECK | HIGH | — |
| 3 | BE: messages GET/POST · read PUT · conversations GET · 목록 `unreadMessageCount` · 알림 수신 규칙 · 로그 | API | HIGH | 2 |
| 4 | FE: 공용 대화 컴포넌트 + 읽음 갱신 + Realtime | UI | MED | 3 |
| 5 | FE: 「퀵 대화」 페이지·nav·allowlist·검색/탭 | UI | MED | 4 |
| 6 | FE: 상세 「요청 대화」·대시보드 배지·알림 액션·알림 자동 읽음 optimistic·90 ⓘ | UI | HIGH | 4 |
| 6b | FE: DM 동작(optimistic·재시도·구분선·묶음·입력 중) · 사이드바 배지(`NavItem.badge`·`nav-badges`·`QuickChatUnreadRealtime`) | UI | MED | 4 |
| 7 | verifier: `e2e/quick-chat`(10 spec) + 회귀(`quick-workflow`·`notifications`) + 테마 → tsc·lint·build | green | MED | 5·6·6b |

**추정:** 신규 약 34파일 · 수정 약 24파일 · +3,300~4,200줄. 복잡도 **Complex**. 약 **12~16시간**. 체크포인트는 두 곳이다. ① 3단계: API AC-05~09·19·22~26을 curl로 통과 ② 4단계: 상세 안 대화로 AC-10~13·18·21 통과(Messenger 페이지 이전).

---

## requirements-pipeline Express (Phase 3)

### 가정 (사용자 검토 완료 · 2026-10-22)

| ID | 가정 | 상태 |
|----|------|------|
| A1 | 화면은 「퀵 대화」 Messenger + 상세 「요청 대화」 둘 다(C-1) | planner 결정 (사용자 요청 「(b)/(c) 우선 검토」) |
| A2 | 쓰기는 요청자·동방·admin, 구매물류팀은 남의 건에서 읽기만 | 확정 |
| A3 | **(r3 대체)** 건마다 대화방 참여자 = 요청자 본인 + active 동방특송 전원 + 그 건에 글을 쓴 admin. 접수 전/후·`accepted_by` 구분 없음 | **사용자 지시 2026-10-26** |
| A4 | **(r3 대체)** 알림 = 보낸 사람을 뺀 참여자 전원. admin은 끼어든 뒤부터 받는다(근거 §알림 수신 규칙). 알림 양 증가 수용 | **사용자 지시 2026-10-26** |
| A5 | 알림 본문은 원문(200자에서 자름), 제목은 `{번호} · {이름} 메시지` | 확정 |
| A6 | 승인·취소된 건은 읽기 전용 | 확정 |
| A7 | 첨부·전화/영상·Presence·「입력 중…」·수정/삭제는 Out. **읽음 표시는 In으로 번복**(내 안 읽은 수 + ✓✓) | 사용자 답변으로 갱신 |
| A8 | 92가 먼저 구현된다 | 확정 |
| A9 | 읽음 위치 갱신·채팅 알림 자동 읽음은 activity log Out | 근거 §활동 감사 로그 |
| A10 | DM 수준 동작(optimistic·재시도·구분선·묶음·입력 중·알림 자동 읽음·사이드바 배지) In, 온라인 점·첨부·전화 Out | 사용자 답변 2026-10-22 · §DM 항목 결정표 |
| A11 | plan 91이 구현 중이므로 91 파일은 append로 확장한다 | 정찰 |

### 검증 시나리오

| 시나리오 | 기대 |
|----------|------|
| 접수 전 취소 부탁 | 요청자 메시지 → 동방 전원 알림 → 동방 대시보드 「새 대화 1」 → 「퀵 대화」에서 아무 동방이나 확인·답장 → 요청자에게 ✓✓ 읽음(1명이면 충분)(AC-16·21·22) |
| 접수 후 시간 변경 | 접수 여부와 무관하게 동방 전원 알림 → A 「불가능합니다」 → 요청자 + 다른 동방에게 원문 알림 → admin이 끼어들면 그 뒤부터 admin도 수신(AC-23·24) |
| 여러 건 동시 처리 | 동방은 모든 건이 참여 대상 → 「퀵 대화」 「안 읽음」 탭에서 차례로 처리, 사이드바·목록 배지 감소(AC-17·18·37) |
| 동방 직원 비활성 | 비활성 직원은 수신에서 빠지고 나머지 동방 전원이 받는다(AC-25) |
| 여러 명 동시 입력 | 「A님, B님이 입력 중…」 1줄(AC-36) |
| 권한·잠금 | 구매물류 읽기 전용, 타인 404, 완료 건 409(AC-05~07) |

---

## 구현 팀 전달 메모

### designer
- 데모 스크린샷과 템플릿 `src/features/chat/**`의 **배치·정보 구성만** 가져온다. 색·radius·blur는 시맨틱 토큰과 테마 토큰으로 바꾸고 영어 문구는 한국어로 바꾼다.
- 결정할 것:
  - 「퀵 대화」 PC 2단과 모바일 목록↔대화 전환
  - 상세 「요청 대화」 배치(PC·모바일 Drawer/탭)
  - 대시보드 「새 대화 N」 위치
  - ✓/✓✓ 표시 위치와 칩 줄 스크롤 방식
- THEMES 10종 × light/dark를 확인한다.

### backend-dev
- SQL: 테이블 2개, 함수 3개, RLS, publication, CHECK(현재값 기반 재정의)
- Route 4개(전송만 로그, 읽음은 로그 Out)
- 목록에 `unreadMessageCount`
- `resolveChatRecipients` 순수 함수(r3): 입력 `{requesterId, activeDongbangIds, adminParticipantIds, senderId, inactiveIds}` → 집합 합집합 − sender − inactive. `accepted_by`·status 분기 **없음**. 단위 테스트 4케이스(요청자/동방/admin 발신·비활성 제외)
- 보낸 사람의 읽음 위치를 자동으로 올림
- 알림 type 추가 · `PUT …/read`에서 알림 자동 읽음 update · `GET unread-total` + RPC `quick_request_unread_total`
- 91 파일 append: `push-groups.ts`(`chat_message` → `quick_request`), `notification-route.ts`(`view-quick-request-chat`)

### frontend-dev
- 공용 `QuickRequestConversation`을 만들고 Messenger·상세 둘 다에서 쓴다.
- 읽음 갱신은 IntersectionObserver + debounce로 한다.
- Realtime: 그 건 필터 구독 + 전역 invalidate. 메시지는 id로 중복을 없앤다.
- Enter/Shift+Enter/IME 처리, 칩은 입력창에 채우기만 한다.
- nuqs `request`/`q`/`tab`, nav 「퀵 대화」, allowlist 명시 등록.
- 대시보드 배지, 알림 「채팅 보기」, 90 ⓘ 1줄.
- DM: optimistic 전송(temp id → 서버 id 교체), 실패 재시도, `groupMessages`(날짜·5분 묶음), 「입력 중…」 broadcast(userId별 타이머 + `formatTypingNames`, C-23), 읽음 갱신 시 알림 optimistic(37 helper 재사용).
- ✓✓: 상대편 1명 이상 기준(C-12). 내가 요청자면 동방·참여 admin, 내가 동방·admin이면 요청자만 센다. tooltip은 읽은 사람 전원.
- 사이드바: `NavItem.badge` + `nav-badges.tsx` 레지스트리 + `SidebarNavLeafItem`에서 `SidebarMenuBadge`(기존 ui, 수정 금지) + dashboard layout `QuickChatUnreadRealtime`.

### verifier
- Realtime은 2 context로 판정(5초 반영 / 8초 미반영).
- 안 읽은 수는 대시보드·Messenger·새로고침 세 곳에서 확인한다.
- ✓✓ 판정에서 구매물류팀·동료 동방이 읽은 것은 세지 않는지, 동방 1명만 읽어도 ✓✓가 되는지 확인한다(AC-21).
- 알림은 dev DB 조회로 판정한다. 접수 전/후 수신자가 같은지(AC-23), admin은 첫 메시지 뒤부터 받는지(AC-24) 확인한다.
- 동방 비활성 fixture는 끝나고 원복한다(AC-25). 「입력 중…」 다중 표시는 3 context(AC-36).
- 로그: 본문 미포함, 읽음 갱신 0건.
- 테마 20조합 스모크.
- DM: `page.route` 지연/500으로 optimistic·재시도 판정, 2 context 「입력 중…」, 사이드바 배지는 `getByRole('link',{name:'퀵 대화'})` 안의 숫자로 판정, 알림 자동 읽음은 벨 숫자 + DB `status`.

---

## 열린 질문 (남은 것)

**남은 열린 질문 없음.** 2026-10-22 답변으로 모두 종료:

| # | 질문 | 결론 |
|---|---|---|
| OQ-1 | 빠른 답장 칩 동작 | **입력창에 채우기만**(C-14 확정) |
| OQ-2 | 칩 문구 7개 | **그대로**(C-14 확정) |
| OQ-3 | 대화를 열면 채팅 알림 자동 읽음 | **예, In**(C-21) + 「카톡·인스타 DM 수준」 요구 → §DM 항목 결정표(C-20) |
| OQ-4 | 사이드바 전체 안 읽은 수 배지 | **예, In**(C-22) |

**r3(2026-10-26)에서 planner가 근거를 적고 결정한 것(질문 없이 종료):**
- admin의 「이전 참여자」 개념: **admin에게만 남긴다**(끼어든 뒤부터 수신) — §알림 수신 규칙
- ✓✓ 정의: **상대편 1명 이상** — C-12
- 「입력 중…」 다중 표시: `A님, B님이 입력 중…` / `A님 외 N명이 입력 중…` — C-23

**앞서 종료된 질문:**
- 이전 OQ-1(승인·취소 후 대화): 읽기 전용으로 확정
- 이전 OQ-2(참여자 알림): 확정 → **r3에서 참여자 모델로 대체**
- 이전 OQ-3(admin이 접수 전에 보낸 메시지): 기본값 유지였으나 **r3에서 「요청자 + 동방 전원」으로 대체**(접수 전/후 구분 폐기)
- 이전 OQ-4(PC 배치): 화면 구조 (c)로 결정, 세부 배치는 designer
- 이전 OQ-5(새 대화 N): **In으로 번복**
- 이전 OQ-6(순서): 92 → 93 → 91 확정

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-10-22 | 최초 작성. 사용자 추가 요청(퀵 요청 건별 실시간 채팅, 메시지마다 상대에게 원문 알림)과 root 기본 가정 반영. 이전 참여자 알림 포함, 첨부·수정·삭제·읽음·입력 중 Out, 로그 본문 금지. plan 92에서 분리. 91 type 추가 영향 기록. Status Approved. 기획만 진행 | planner |
| 2026-10-22 | 사용자 답변 반영. ① 맨 앞에 「멤버 방식이 아님, 건별 대화 1개, 볼 수 있는 사람은 읽기, 알림은 담당자 중심」을 명시하고 A3이 사용자 의도와 같음을 확인. 이전 OQ-3(admin이 접수 전에 보낸 메시지)은 기본값 유지로 종료. ② **「새 대화 N」을 1차 In으로 번복**: `quick_request_message_reads`(사용자별 읽음 위치, 뒤로 가지 않음) + RPC 2종 + 대시보드 표·모바일 카드 배지 + 「여기부터 새 메시지」 구분선 + 상대편 ✓✓ 읽음 표시(구매물류팀 제외). 읽음 갱신은 activity log Out(자동 동작·노이즈·표시용, 근거 기록). ③ 데모 Messenger 참고(WebFetch는 로그인 화면이라 실패, 업스트림·로컬 `src/features/chat/**` 코드로 확인) → **화면 구조 (c)**: 새 페이지 `/dashboard/quick/chat` 「퀵 대화」(2단, 검색·전체/안 읽음 탭) + 상세 「요청 대화」, 공용 컴포넌트 재사용. 알림 클릭은 「퀵 대화」로 이동. nav·동방 allowlist 명시. 빠른 답장 칩 In(퀵 전용 문구, 채우기만), 첨부·전화/영상·Presence·입력 중 Out. shadcn·시맨틱 토큰·THEMES 필수, 템플릿 데모 코드는 건드리지 않음. ④ AC 25 → **32**, SQL·Route·영향 파일·리스크 갱신, 추정 5~7h → **9~13h(Complex)** | planner |
| 2026-10-22 | r2 — 남은 열린 질문 4개 답변 반영(열린 질문 0). ① 칩 「채우기만」·문구 7개 확정. ② 사용자 「카톡·인스타 DM 수준」 → §DM 항목 결정표: optimistic 즉시 표시·실패 재시도·날짜 구분선·연속 묶음(5분)·자동 스크롤·**「입력 중…」(broadcast, In으로 재판단)** In, 온라인 점·첨부·전화·수정·삭제·반응·인용·검색 Out. ③ **채팅 알림 자동 읽음 In**(C-21): `PUT …/messages/read`가 그 건의 `chat_message` 알림을 read로, FE는 37 optimistic 재사용으로 벨 즉시 감소, 로그 Out 근거 추가. ④ **사이드바 「퀵 대화」 전체 안 읽은 수 배지 In**(C-22): `NavItem.badge`·`nav-badges.tsx` 레지스트리·기존 `SidebarMenuBadge`(ui 무수정)·`GET /api/quick-request/unread-total` + RPC `quick_request_unread_total`(90일 상한)·dashboard layout `QuickChatUnreadRealtime`, 성능 리스크·완화 기록. ⑤ 정찰 갱신: plan 91 구현 진행 중(SQL 90 dev 적용) → 91 파일(`push-groups`·`notification-route`)을 이 plan이 append로 직접 확장. AC 32 → **37**(F 5 추가, AC-18 벨 감소 보강), 추정 9~13h → **12~16h** | planner |
| 2026-10-26 | r3 — 사용자 지시 「요청자 본인 + 동방특송 전원이 건마다 채팅방에 들어간다. 알림 양이 늘어도 상관 없음」 반영(질문·게이트 없음). ① **참여자 모델**: 건마다 참여자 = 요청자 + active 동방 전원 + 글을 쓴 admin(C-2). `accepted_by`·접수 전/후 기준 규칙(이전 A3·A4·C-5·AC-21·23~25) **폐기**. ② **알림 규칙 단일화**(C-5): 수신자 = 참여자 − 보낸 사람 − 비활성. admin만 「끼어든 뒤부터」 참여자(근거 3개). 알림 양 추정(동방 1인당 약 100건/일) 기록, 리스크 표에 「사용자 수용」 명시, 완화는 91 푸시 그룹 OFF·자동 읽음만. ③ **✓✓ 정의 확정**(C-12): 상대편 1명 이상(요청자 → 동방·참여 admin 중 1명 / 동방·admin → 요청자만), tooltip 전원. ④ **「입력 중…」 다중**(C-23 신설): userId별 타이머 + `formatTypingNames`. ⑤ 안 읽은 수 집계 비용 재추정(동방 1인당 ≈11,000행/호출)·완화 5개·2차 비정규화 안. ⑥ 알림 의사코드·`resolveChatRecipients` 입력 명세·U-12 ⓘ 문구·U-14·검증 시나리오·팀 메모·README 갱신. AC 개수 **37 유지**(AC-21·23~25·36 내용 교체, AC-36은 3 context + 단위). 추정 **12~16h 유지**(수신 규칙은 단순해지고 다중 입력 표시·단위 테스트가 추가됨). 열린 질문 0 | planner |
| 2026-10-27 | **구현·검증 완료 → Status Completed** (verifier). SQL `92_quick_request_messages.sql` dev 적용(publication 2테이블·RLS SELECT·CHECK 31종·RPC 6종 service_role). Playwright `e2e/quick-chat/*.spec.ts` 9파일 **AC-01~37 전부 green**(60/60 · 2 context 실시간 포함) · 회귀 quick-request/quick-workflow/quick-info/notifications/push 통과(기존 알려진 실패 4건만 분리). tsc·lint:strict·node --test 19/19·react-doctor(회귀 없음)·build exit 0 · `npm run e2e:cleanup` remaining 전부 0(messages·reads 0 포함). **AC-35·U-13 정정:** 날짜 구분선은 `core-conventions` §날짜만(상한 규칙)에 따라 `formatAbsoluteDateKo` = **`yyyy-MM-dd`**(요일 없음) — 본문의 `(EEE)` 표기는 시각 형식과 혼동한 오기. **FE 편차 6건**(frontend-dev 보고): ① 높이는 `useVisualViewportHeight`를 모든 뷰포트로 확장(+ `h-[calc(100dvh-10.5rem)]` fallback) ② `quick-chat-realtime`은 훅 `useQuickChatRealtime`(typing broadcast 동일 채널) ③ 상세 aside 카드는 `useMatchMedia(xl)`로 xl에서만 마운트(채널 공유 충돌 방지) ④ 캐시 merge 헬퍼는 `lib/quick-chat-cache.ts` ⑤ `QuickRequestConversation.header`는 `(request) => ReactNode` ⑥ `quick-detail-chat` testid를 aside 카드와 `?chat=1` 전체 뷰(`data-mode=full`)가 공유. verifier 소수정: 액션바는 xl에서 액션이 없으면 미렌더(89 AC-23·26 「액션바 사라짐」 유지), `e2e/quick-info` 기대값에 U-12 1줄 추가, cleanup 스크립트 remaining에 `quick_request_messages`·`reads` 추가. 수동 QA 남김: 실기기 푸시로 채팅 알림 수신·iOS 키보드 | verifier |
