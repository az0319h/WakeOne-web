# 퀵 실시간 지연 해소 · 푸시 클릭 즉시 이동 · 작은 수정 묶음 기획서

> Date: 2026-10-27
> Status: Completed
> Author: planner
> **퀵 2차(94~101) 중 1번째.** 실행 순서: **94 → 95 → 96 → 97 → 98 → 101 → 99 → 100** (99·100은 외부 키 도착 후)
> **SQL 예정:** `supabase/sql/93_quick_realtime_broadcast_chat_unlock.sql` (현재 최대 `92`. backend-dev가 `ls supabase/sql`·`list_migrations`로 적용 직전 재확인). **Dev DB만** 적용
> **brief 항목:** 4(실시간·region) · 17(푸시 클릭) · 7(행 클릭) · 8(부가세 문구) · 9(자동차등록번호) · 12(이력 역순·tel) · 14(수정 알림) · 15(채팅 잠금 해제) · 19(채팅 푸시 제목)
> **Supersedes:** [93](./93_quick-request-chat-plan.md) C-4·AC-07(승인·취소 건 읽기 전용) · C-6(채팅 알림 제목) · C-16(postgres_changes 구독 방식) · [92](./92_quick-web-only-notifications-plan.md) D-7(Realtime 구독 방식)·AC-12 본문(`오토바이 8514`) · [89](./89_quick-workflow-dongbang-openchat-plan.md) AC-18(차량정보 값)·「approved·cancelled 이후 모든 변경 불가」 중 **채팅만** 해제 · 91 U「SW 알림 표시 click: navigate」
> **선행:** [08](./08_activity-audit-log-plan.md), [14](./14_delete-confirm-dialog-plan.md), [89](./89_quick-workflow-dongbang-openchat-plan.md), [91](./91_pwa-web-push-notifications-plan.md), [92](./92_quick-web-only-notifications-plan.md), [93](./93_quick-request-chat-plan.md)

## 선행 plan 참조 (Phase 0)

| Plan | Status | 관계 |
|------|--------|------|
| **93** | Completed | 채팅 잠금(C-4)·알림 제목(C-6)·Realtime 방식(C-16)을 이 plan이 바꾼다. 참여자 모델·수신 규칙(r3)은 그대로 |
| **92** | Completed | `QuickRequestRealtime`(postgres_changes)을 Broadcast 방식으로 교체. publication은 건드리지 않는다(AC-22 회귀 보존) |
| **91** | Completed | `public/sw.js` `notificationclick`의 `client.navigate()`를 `postMessage` 방식으로 교체. 알림 payload·발송 파이프라인은 변경 없음 |
| **89** | In Progress | 상태 흐름·권한 매트릭스 유지. 차량정보 → 자동차등록번호(필드명·검증만, 컬럼 `dispatch_vehicle_info` 유지). 처리 이력 표시 순서만 변경 |
| **08** | Approved | 신규 CUD Route 없음. 기존 Route 로그 분기 유지 |
| **14** | Completed | 삭제 UI 없음. `window.confirm` 0건 유지 |

### 정찰로 확인한 사실

| 항목 | 사실 | 근거 |
|------|------|------|
| 전송 지연 1 | `POST …/messages` Route가 **알림 insert(+푸시 fan-out 조회)를 `await`한 뒤** 201을 돌려준다 → 「전송됨」이 알림 처리 시간만큼 늦다 | `src/app/api/quick-request/[requestNo]/messages/route.ts:169` |
| 전송 지연 2 | Vercel 함수가 **iad1(미국 동부)** 에서 실행(`x-vercel-id: icn1::iad1::…`), Supabase는 **ap-northeast-2(서울)** → 왕복마다 태평양 2회 | root CLI 확인 · 사용자 스크린샷 |
| 수신 지연 | 채팅·대시보드·사이드바가 모두 `postgres_changes` 구독(필터 없는 구독 3종 + 건별 1종). postgres_changes는 **변경 1건마다 구독자별 RLS를 평가**해 구독자·변경이 늘수록 늦어진다 | `quick-request-realtime.tsx`, `quick-chat-unread-realtime.tsx`, `quick-chat-list-realtime.tsx`, `quick-chat-realtime.tsx` |
| Broadcast | `realtime.broadcast_changes()` 트리거 + private 채널(`realtime.messages` RLS)은 DB에서 1회 fan-out하고 구독자별 RLS 평가가 없다. `@supabase/supabase-js` `channel(name, {config:{private:true}})` | Supabase 문서 「Broadcast from Database」 |
| SW 클릭 | `sw.js` L83~91 `client.focus()` 후 `client.navigate(targetUrl)` → 전체 재로드(앱 번들·세션 복원 ~3초) | `public/sw.js` |
| 행 클릭 | `DataTable`에 `onRowClick`·`isRowClickable` prop이 이미 있다(시스템 메일 로그가 사용). 퀵 표는 미사용. 모바일 카드는 「상세 보기」 Link만 | `src/components/ui/table/data-table.tsx:19,67` |
| 부가세 문구 | 「부가세 별도」 3곳: `quick-dispatch-fields.tsx:99`, `quick-request-detail-page.tsx:136`, `quick-final-amount-dialog.tsx:85` | grep |
| 차량정보 | `vehicleInfo` 1~100자 자유 입력. e2e·92 AC-12가 `오토바이 8514`를 쓴다 | `schemas/quick-request-dispatch.ts` |
| 처리 이력 | `buildHistory`가 요청→접수→배차→최종금액→승인/취소 **오래된 순** | `detail/quick-request-history.tsx` |
| tel 링크 | 요청자·기사·출발/경유/도착 담당 연락처는 이미 `QuickRequestPhoneLink`(`tel:`) | `quick-request-detail-page.tsx:84,144`, `quick-request-route-view.tsx:88` |
| 수정 알림 | PATCH는 `changedFields`가 `finalAmount` 하나일 때만 `final_amount_set` 알림. 그 밖의 수정은 알림 없음 | `[requestNo]/route.ts:275~311` |
| 채팅 잠금 | RPC `create_quick_request_message`가 `approved/cancelled`면 `quick_request_locked`(P0001) · `buildChatWriteState`가 `readOnlyReason:'locked'` · UI `quick-chat-read-only-notice` | SQL 92 L132 · `messages.server.ts:101~110` |
| 채팅 알림 제목 | `buildChatNotificationTitle` = `{요청번호} · {이름} 메시지` | `notifications.server.ts:185` |
| Vercel 설정 | 루트에 `vercel.json` 없음 → region 기본값 | `ls` |

---

## 한 줄 요약

퀵 채팅·대시보드의 **실시간 지연**을 세 단계로 없앤다 — ① Vercel 함수를 서울(`icn1`)로 옮기고 ② 메시지 알림을 응답 뒤(`after()`)로 미뤄 「전송됨」을 즉시 띄우며 ③ 수신은 `postgres_changes` 대신 **DB 트리거 Broadcast**(private 채널)로 받고 구독이 안 되면 **5초 폴링**으로 버틴다. 같이 묶은 작은 수정 8개: 푸시 알림 「사이트 열기」가 **재로드 없이 즉시 이동**, 표 행·모바일 카드 **클릭으로 상세 이동**, 금액 문구 **「부가세 포함」**, 차량정보 → **「자동차등록번호」**(형식 검사), 처리 이력 **최신 위**, 동방·admin이 요청을 고치면 **요청자에게 「요청 내용이 수정되었습니다」 알림**, 승인·취소된 건도 **채팅 계속**, 채팅 푸시 제목을 **보낸 사람 이름 먼저**로.

---

## 정책 확정안 (deep-interview 2026-10-27 · 사용자 답변 Q1·Q7 · brief 4·7·8·9·12·14·15·17·19)

| # | 항목 | 확정 |
|---|------|------|
| D-1 | Vercel region | 저장소 루트에 **`vercel.json` `{"regions":["icn1"]}`** 추가(코드 1파일). 재배포는 사용자. Hobby 플랜도 1개 region 지정 가능 **[INFERRED: 플랜 제한 시 사용자에게 보고]**. 확인 방법: 응답 헤더 `x-vercel-id`가 `icn1::icn1::…`(수동 QA M-1) |
| D-2 | 전송 응답 | `POST …/messages`는 **insert(RPC) 성공 직후 201**을 돌려주고, 알림(`notifyQuickRequestChatMessage`)은 **`after()`**(next/server)에서 실행한다. 실패는 `console.error`만(기존 safeNotify 격리와 같음). `recipient_count`는 로그 metadata에서 **제외**(응답 전에 알 수 없음 → `recipient_count` 키 삭제, 93 AC-29 supersede). 다른 퀵 Route(접수·배차 등)의 `safeNotify`도 같은 방식으로 `after()`로 옮긴다 |
| D-3 | 수신 방식 | **Broadcast from Database.** 트리거가 `realtime.broadcast_changes()`로 3개 topic에 보낸다: `quick-request:{request_id}`(건별 · 대화·상세), `quick-user:{requester_user_id}`(요청자 대시보드·배지), `quick-requests:all`(viewer-all · 동방·admin·구매물류 대시보드·대화 목록·배지). 대상 테이블·이벤트: `quick_requests` INSERT/UPDATE, `quick_request_messages` INSERT, `quick_request_message_reads` INSERT/UPDATE. **payload는 쓰지 않고 invalidate 신호로만** 쓴다(기존 debounce 유지: 대시보드 300ms · 배지 1초). private 채널 + `realtime.messages` SELECT 정책으로 topic별 권한을 건다. 기존 `postgres_changes` 구독 코드는 **전부 제거**. publication(92·93)은 **변경하지 않는다**(회귀 보존 · 제거는 후속 [TBD]) |
| D-4 | 폴링 fallback | 채널 `subscribe` 콜백이 **5초 안에 `SUBSCRIBED`가 아니거나** `CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED`가 되면, 그 화면의 query를 **`refetchInterval` 5초**로 돌린다(공용 훅 `useQuickRealtimeChannel({topic, onEvent}) → {status:'live'|'polling'|'connecting'}`). 다시 `SUBSCRIBED`가 되면 폴링을 끈다. 「퀵 대화」 패널 배지 「실시간」/「연결 중…」(93 U-2)에 **「폴링」** 상태를 추가한다 |
| D-5 | 「입력 중…」 | 기존 broadcast 채널(`quick-chat-{id}` · 93)을 **D-3의 `quick-request:{id}` private 채널로 통합**한다(채널 1개). 동작·문구는 93 C-23 그대로 |
| D-6 | 푸시 클릭 (17) | `notificationclick`: 같은 origin 창이 있으면 `focus()` 후 **`client.postMessage({type:'wakeone:navigate', url})`**. 앱(`ServiceWorkerRegistrar`)이 `navigator.serviceWorker` `message`를 받아 **`router.push(url)`**(전체 재로드 없음). 창이 없을 때만 `openWindow(url)`. 안전장치: `MessageChannel`로 앱이 **1.5초 안에 `ack`** 하지 않으면 SW가 기존대로 `client.navigate(url)` |
| D-7 | 행 클릭 (7) | 퀵 표 행(`DataTable onRowClick`)과 모바일 카드(`quick-card-{no}`) **전체가 상세 이동**. 셀 안의 버튼·링크·배지 링크는 `stopPropagation`. 행은 `tabIndex=0` + Enter/Space로도 이동(접근성). 「상세 보기」 열·버튼은 **유지**(testid 보존) |
| D-8 | 부가세 (8) | 배차 Dialog 예상금액 설명·최종금액 Dialog·상세 금액 섹션 문구를 **「부가세 포함 금액으로 입력」/「예상금액·최종금액은 부가세 포함 금액입니다.」**로 교체. 알림 본문(92 §문구표)은 금액만 있고 부가세 문구가 없으므로 변경 없음. `grep "부가세 별도"` 0건 |
| D-9 | 자동차등록번호 (9) | 배차 Dialog·수정 Sheet의 「차량정보」 필드를 **「자동차등록번호」**(placeholder `예: 21마 6543`)로 바꾸고 형식 검사(클라이언트·서버 동일): 공백 정규화(trim · 연속 공백 1칸) 후 다음 중 하나 — ① `^\d{2,3}[가-힣] ?\d{4}$`(현행 번호판) ② `^[가-힣]{2} ?\d{1,2}[가-힣] ?\d{4}$`(지역 번호판 `서울 12가 3456`) ③ `^[가-힣]{2} ?[가-힣]{2,3} ?[가-힣] ?\d{4}$`(이륜차 `서울 강남 가 1234`). 에러 문구 **「자동차등록번호 형식을 확인해 주세요. 예: 21마 6543」**. 최대 20자. **DB 컬럼 `dispatch_vehicle_info`·API 필드명 `vehicleInfo`는 유지**(이름 변경 Out · 라벨만). 표·상세·알림 본문 라벨도 「자동차등록번호」 |
| D-10 | 처리 이력 (12) | **최신이 위**(역순). 「요청」 항목이 맨 아래. `tel:` 링크는 이미 적용돼 있으므로 **회귀 AC로만** 확인(상세의 모든 연락처가 `a[href^="tel:"]`) |
| D-11 | 수정 알림 (14) | PATCH에서 `changedFields`에 **`finalAmount` 외 항목이 1개라도** 있으면 **요청자**에게 알림 1건(type `quick_request.requester_event` 재사용 · `metadata.quick_request_event='updated'` · **신규 type·SQL 없음**, brief의 「type 1종 추가」는 기존 type의 event 구분으로 대체 — 91 푸시 그룹·CHECK 변경 회피). 제목 **`퀵 {no} 수정됨`**, 본문 **`{행위자}님이 요청 내용을 수정했습니다. ({변경 항목 한국어 라벨, 최대 3개}{, 외 N개})`**(120자 클립). 행위자 본인 제외(요청자=admin이 직접 고친 경우 0건). `finalAmount`만 바뀐 경우는 기존 `final_amount_set` 그대로. `finalAmount`+다른 항목이 함께 바뀌면 **두 알림 모두** 보낸다 |
| D-12 | 채팅 잠금 해제 (15) | RPC `create_quick_request_message`에서 **잠금 검사 제거**. `buildChatWriteState`에서 `locked` 분기 제거(`readOnlyReason`은 `'logistics'`만 남음). 읽기 전용 안내 문구 「승인되었거나 취소된 요청은…」 삭제. 승인·취소 건의 **항목 수정·상태 변경 불가는 그대로**(89). 빠른 답장 칩도 그대로 노출 |
| D-13 | 채팅 푸시 제목 (19) | 제목 **`{보낸 사람 이름}`**(20자) + **` · {요청번호}`**, 본문 = 메시지 원문(200자). 예: 제목 `김동방 · 2026-07`, 본문 `알겠습니다`. OS가 붙이는 「WakeOne」 앱 이름 줄은 **브라우저 소유라 제거 불가**(plan에 명시 · 사용자 고지). 인앱 알림 목록도 같은 제목을 쓴다 |
| D-14 | 진단 기록 | 4번은 94 **첫 단계**. backend-dev가 dev 배포에서 교체 전/후 측정값(전송→「전송됨」 ms · 상대 화면 표시 ms, 각 5회 중앙값)을 **수정 이력에 기록**한다. 목표: 같은 region 기준 전송 ≤ 500ms · 수신 ≤ 1,500ms **[INFERRED]**. 미달이면 root 보고(예외 정지 아님 · 후속 과제) |

### Broadcast 권한 모델 (D-3)

| topic | 보내는 트리거 | 구독 허용(`realtime.messages` SELECT) | 구독자 |
|-------|---------------|----------------------------------------|--------|
| `quick-request:{request_id}` | 그 건의 `quick_requests` UPDATE · `quick_request_messages` INSERT · `quick_request_message_reads` INSERT/UPDATE | `private.can_view_quick_request(auth.uid(), {id})` | 상세·대화 컴포넌트 · 「입력 중…」 |
| `quick-user:{user_id}` | 위와 같은 변경의 **요청자** `requester_user_id` 기준(INSERT 포함) | `realtime.topic() = 'quick-user:' \|\| auth.uid()` | 요청자 대시보드·사이드바 배지(viewer-all이 아닌 사용자) |
| `quick-requests:all` | 모든 변경 | `private.can_view_all_quick_requests(auth.uid())` | 동방·admin·구매물류의 대시보드·「퀵 대화」 목록·사이드바 배지 |

- 트리거 함수는 `security definer` · `set search_path=''` · 3 topic에 각각 `realtime.broadcast_changes(topic, TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD)`. `quick_request_messages`·`reads`는 `quick_requests`에서 `requester_user_id`를 조회해 `quick-user` topic을 정한다.
- 클라이언트는 `supabase.realtime.setAuth(access_token)` 후 `channel(topic, {config:{private:true}})` · `.on('broadcast', {event:'*'}, …)`.
- payload의 `record`/`old_record`는 **읽지 않는다**(RLS와 무관하게 본문이 실리므로 topic 권한이 유일한 벽 → 권한 함수 재사용으로 충분하나, 추가 안전장치로 트리거는 `new`·`old` 대신 **`jsonb_build_object('id', NEW.id)` 최소 payload**를 보낸다 — `broadcast_changes` 대신 `realtime.send(payload, event, topic, private)`를 쓴다). backend-dev는 두 함수 중 `realtime.send`를 쓴다(본문 미전송).

---

## 목표 & 완료 기준 (AC)

공통: 시각은 `formatAbsoluteDateTimeKo`. 셀렉터는 `getByRole`/`getByTestId`/`getByPlaceholder`. 계정은 `user.json`·`user2.json`·`admin.json`·`dongbang.json`·`dongbang2`·`logistics.json`(93과 동일). 실시간 판정은 2 context **5초 반영 / 8초 미반영**.

### A. 실시간 (4)

| AC | 유형 | 전제 | 동작 | 기대 |
|----|------|------|------|------|
| AC-01 | CLI | — | `cat vercel.json` | JSON 파싱 성공 · `regions` = `["icn1"]` · 그 밖의 키 없음 |
| AC-02 | API | `user.json` · 본인 건 · `page.route`로 `notifications` insert를 흉내낼 수 없으므로 **서버 타이밍**으로 판정: Route가 `after()` 안에서 알림을 호출 | `POST …/messages` 201 후 **1초 안**에 dev DB `notifications`에 `chat_message` 행(동방 2명) · 201 응답 body에 `recipientCount` 키 **없음** · grep `messages/route.ts`: `notifyQuickRequestChatMessage` 호출이 `after(` 콜백 안 · `await notifyQuickRequestChatMessage` 0건 |
| AC-03 | grep | 구현 완료 | `grep -rn "postgres_changes" src/features/quick-request src/app/dashboard/quick` | **0건** · `grep -rn "private: true" src/features/quick-request` ≥ 1 · 공용 훅 `src/features/quick-request/lib/use-quick-realtime-channel.ts` 존재 |
| AC-04 | SQL (Dev MCP) | SQL 93 적용 | `select tgname from pg_trigger where tgrelid in ('public.quick_requests'::regclass,'public.quick_request_messages'::regclass,'public.quick_request_message_reads'::regclass)` · `select policyname from pg_policies where schemaname='realtime' and tablename='messages'` | 트리거 3개(`*_broadcast`) · 정책 `quick_realtime_messages_select` 1개 · publication(92·93)은 **변경 없음**(92 AC-22 유지) |
| AC-05 | Playwright (2 context) | `admin.json` 대시보드 열어 둠 | `user.json` 등록 | 92 AC-19와 동일(5초 안에 행·카드 숫자) — Broadcast로 통과 |
| AC-06 | Playwright (2 context) | `user.json` 상세 열어 둠 | `dongbang.json` 접수 | 92 AC-20 동일 |
| AC-07 | Playwright (2 context) | `user2.json` 「퀵 대화」·대시보드 열어 둠 | `user.json` 건 메시지·등록 | 8초 동안 user2 화면 **0건**(topic 권한) · user2 세션으로 `channel('quick-request:{user 건 id}',{private:true}).subscribe()` 콜백 status가 `CHANNEL_ERROR`(page.evaluate) |
| AC-08 | Playwright (2 context) | 93 AC-12·13·16·18·21·37 전제 | 같은 동작 | **전부 green**(Broadcast 교체 회귀) · 「입력 중…」 93 AC-36 green(채널 통합) |
| AC-09 | Playwright | `dongbang.json` · `page.route`로 `wss://…/realtime/v1/websocket` 차단(`route.abort`) | 「퀵 대화」 열기 → 다른 context에서 메시지 전송 | 패널 배지 **「폴링」** 표시(`quick-chat-realtime-status`) · **10초 안**에 메시지가 목록·대화에 나타남(5초 polling) · 차단 해제 후 20초 안에 배지 「실시간」 |
| AC-10 | 수동 QA (dev 배포) | 재배포 후 | `curl -sI https://wake-one-dev-web.vercel.app/api/health \| grep x-vercel-id` · 폰 2대로 채팅 | `x-vercel-id`가 `icn1::icn1::…` · 전송→「전송됨」 체감 즉시 · 상대 화면 1~2초 안 표시 · backend-dev 측정표(D-14) 수정 이력 기록 |

### B. 푸시 클릭 (17)

| AC | 유형 | 전제 | 동작 | 기대 |
|----|------|------|------|------|
| AC-11 | Playwright | `user.json` · `/dashboard/overview` · `page.evaluate`로 `window.__e2eMarker = 'alive'` 설정 | `navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { type: 'wakeone:navigate', url: '/dashboard/quick' } }))` | 2초 안에 URL `/dashboard/quick` · `window.__e2eMarker === 'alive'`(**전체 재로드 없음**) · `ports[0]`이 있으면 `postMessage('ack')` 호출됨(stub으로 판정) |
| AC-12 | API · grep | — | `GET /sw.js` 본문 | `postMessage(` 포함 · `'wakeone:navigate'` 포함 · `client.navigate(` 는 **ack 타임아웃 fallback 분기 1곳**에만 · `openWindow(` 유지 |
| AC-13 | 수동 QA | 안드로이드 Chrome · 사이트 열린 상태 | 푸시 알림 탭 | **1초 안**에 해당 화면 전환(흰 화면·재로드 없음) · 창이 없을 때는 새 창 열림 |

### C. 작은 수정 (7·8·9·12)

| AC | 유형 | 전제 | 동작 | 기대 |
|----|------|------|------|------|
| AC-14 | Playwright | `dongbang.json` · 1280 | 표 행의 「요청자」 셀 클릭 / 행 포커스 후 Enter | URL `/dashboard/quick/{번호}` · 행 `cursor-pointer` · 「업무 처리」 버튼(예: 접수) 클릭 시 **상세로 이동하지 않고** 버튼 동작만 · 「새 대화 N」 배지 클릭은 「퀵 대화」로 |
| AC-15 | Playwright | 375px · `dongbang.json` | 카드 본문 탭 | 상세로 이동 · 카드 안 「접수」 버튼 탭은 접수만 · 「상세 보기」 링크(`quick-card-detail-{no}`) **유지** |
| AC-16 | Playwright · grep | `dongbang.json` · `dispatching` 건 | 「배차완료」 Dialog · 최종금액 Dialog · 상세 금액 섹션 | 문구 **「부가세 포함 금액으로 입력」**(두 Dialog) · 상세 **「예상금액·최종금액은 부가세 포함 금액입니다.」** · grep `부가세 별도` **0건** |
| AC-17 | Playwright · API | `dongbang.json` · `dispatching` 건 | 배차 Dialog 필드 확인 → `21마 6543` / `서울 12가 3456` / `서울 강남 가 1234` / `오토바이 8514` / `abc` 저장 | label **「자동차등록번호」** · placeholder **`예: 21마 6543`** · 앞 3개 저장 성공 · 뒤 2개 **「자동차등록번호 형식을 확인해 주세요. 예: 21마 6543」** + API 400 같은 문구 · 상세 라벨 「자동차등록번호」 값 `21마 6543` · 알림 본문 **`21마 6543 · 기사 홍길동 · 예상 20,000원`**(92 AC-12 값 교체) · 수정 Sheet도 같은 검사 |
| AC-18 | Playwright | `requested`→접수→배차→최종금액 거친 건 | 상세 「처리 이력」 | 순서 **최종금액 입력 → 배차완료 → 접수 → 요청**(최신 위) · 각 절대 시각 · 취소 건은 「취소」가 맨 위 |
| AC-19 | Playwright | 배차 완료 건 | 상세의 연락처 전부 | 요청자·기사·출발/경유/도착 담당 연락처가 모두 `a[href^="tel:"]` · 표시 `010-1234-5678` |

### D. 수정 알림 (14) · 잠금 해제 (15) · 푸시 제목 (19)

| AC | 유형 | 전제 | 동작 | 기대 |
|----|------|------|------|------|
| AC-20 | API·DB | `user.json` 건 · `dispatching` | `dongbang.json`이 수정 Sheet로 도착 상세주소·차량 종류 변경 저장 | 요청자 알림 1건 type `requester_event` · metadata `quick_request_event='updated'` · 제목 **`퀵 {no} 수정됨`** · 본문 **`{동방 이름}님이 요청 내용을 수정했습니다. (도착지 상세주소, 차량 종류)`** · 동방2·admin·구매물류 0건 · `/dashboard/notifications`에서 「퀵 요청 보기」 → 상세 |
| AC-21 | API·DB | 같은 건 | ① admin이 최종금액만 변경 ② admin이 최종금액 + 메모 변경 ③ 4개 항목 변경 | ① `final_amount_set` 1건만(`updated` 0) ② `final_amount_set` 1건 + `updated` 1건 ③ 본문 `(…, …, … 외 1개)` · 본문 ≤ 120자 |
| AC-22 | Playwright·API | `approved` 건·`cancelled` 건 · `dongbang.json`·`user.json`·`admin.json` | 대화에서 메시지 전송 · `POST …/messages` | 입력창·칩 **보임** · **201** · 상대에게 Realtime 반영·알림 수신 · 「승인되었거나 취소된 요청은 대화를 보낼 수 없습니다.」 **0건**(grep 포함) · 같은 건 `PATCH`·`accept`는 여전히 **409**(89 AC-27) · `logistics.json`은 여전히 403 |
| AC-23 | API·DB | 요청자 메시지 「알겠습니다」 | 알림 행 | 제목 **`{요청자 이름} · {번호}`** · 본문 `알겠습니다` · `grep "메시지\`" notifications.server.ts`의 옛 제목 형식 0건 · 인앱 목록 제목 동일 |
| AC-24 | 수동 QA | 안드로이드·아이폰 | 채팅 푸시 수신 | 알림 1줄: 「WakeOne」(OS) · 2줄: `{이름} · {번호}` · 3줄: 메시지 |

### E. 로그·품질

| AC | 유형 | 전제 | 동작 | 기대 |
|----|------|------|------|------|
| AC-25 | Playwright·API | AC-20·22 이후 | `/dashboard/logs` · `GET /api/activity-logs` | `quick_request.update` 행 metadata `changedFields` 유지 · `quick_request.message_create` 201 행(approved 건) metadata에 `recipient_count` **없음**·`body` 없음 · 신규 action 0 |
| AC-26 | CLI | — | `npx tsc --noEmit` · `npm run lint` · `npm run build` · `npx playwright test e2e/quick-request e2e/quick-workflow e2e/quick-chat e2e/quick-info e2e/push-notifications` | 모두 통과 (93 AC-07 spec은 AC-22로 교체 · 92 AC-12/89 AC-18 값 `21마 6543`으로 교체) |

**AC 총 26개**: A 10 · B 3 · C 6 · D 5 · E 2. 수동 QA 3(AC-10·13·24).

---

## 범위 (In / Out)

### In
1. **`vercel.json`** 신규(D-1)
2. **SQL 93**: broadcast 트리거 함수 1 + 트리거 3, `realtime.messages` SELECT 정책, `create_quick_request_message` 잠금 제거(create or replace)
3. **BE**: `messages/route.ts` `after()` 알림 · 다른 퀵 Route 5곳(`route.ts` POST·accept·dispatch·approve·cancel·PATCH)의 `safeNotify`도 `after()`로 · PATCH `updated` 알림(D-11) · `notifications.server.ts` 제목(D-13)·`updated` 문구·`changedFields` 라벨 맵 · `buildChatWriteState` locked 제거 · 자동차등록번호 서버 검증(`quick-request-workflow.ts` dispatch body + patch) · 로그 metadata `recipient_count` 제거
4. **FE 실시간**: 공용 훅 `use-quick-realtime-channel.ts`(private broadcast + 상태 + polling) · `quick-request-realtime.tsx`·`quick-chat-unread-realtime.tsx`·`quick-chat-list-realtime.tsx`·`quick-chat-realtime.tsx`를 훅 기반으로 재작성 · typing broadcast 채널 통합 · 「폴링」 배지
5. **FE 푸시**: `public/sw.js` notificationclick · `service-worker-registrar.tsx` message 리스너 + `router.push` + ack
6. **FE 작은 수정**: 표 `onRowClick`·카드 onClick·stopPropagation · 부가세 문구 3곳 · 자동차등록번호 라벨/placeholder/검증(Dialog·수정 Sheet·상세·표·알림 라벨) · 처리 이력 역순 · 읽기 전용 안내 삭제
7. **E2E**: 신규 `e2e/quick-round2/94-*.spec.ts`(AC-02·03·07·09·11·12·14~23·25) · 기존 spec 값 교체(`오토바이 8514`→`21마 6543` · 93 AC-07 → 잠금 해제)
8. **문서**: README 94 등록 · 89/91/92/93 수정 이력 1행씩

### Out
| 항목 | 이유 |
|------|------|
| publication에서 퀵 3테이블 제거 | 92 AC-22·93 AC-28 회귀 보존. 부하가 남으면 후속 [TBD] |
| Vercel 재배포·플랜 변경 | 사용자 수동 |
| 컬럼 `dispatch_vehicle_info`·API `vehicleInfo` 이름 변경 | 라벨만 변경(마이그레이션 회피) |
| 승인·취소 건의 항목 수정·상태 변경 허용 | 89 유지(채팅만 해제) |
| 알림 type 추가 | 기존 `requester_event` + event 구분으로 충분(D-11) |
| 푸시 알림의 「WakeOne」 앱 이름 줄 제거 | 브라우저 소유(불가) |
| 메시지 payload 기반 캐시 merge(옵티미스틱 수신) | invalidate만. 지연 목표 미달 시 후속 |
| Main DB 적용 | 사용자 수동 |

---

## UI 요구사항 (designer 지시)

| # | 화면 | 요구 |
|---|------|------|
| U-1 | 「퀵 대화」 패널 배지 | 「실시간」(live) / 「연결 중…」(connecting) / **「폴링」**(polling · muted · tooltip 「실시간 연결이 안 돼 5초마다 새로고침합니다」). `data-testid="quick-chat-realtime-status"` + `data-state` |
| U-2 | 표 행 | 행 전체 `cursor-pointer` · hover `bg-muted/50` · focus ring(키보드) · 셀 안 버튼·링크는 전파 차단. 모바일 카드는 카드 전체 탭 영역, 내부 버튼은 별도 |
| U-3 | 배차·최종금액 Dialog | 금액 필드 설명 「부가세 포함 금액으로 입력」. 「자동차등록번호」 Input(placeholder `예: 21마 6543`, `inputMode='text'`, 최대 20자). 수정 Sheet 배차 섹션 동일 |
| U-4 | 상세 금액 섹션 | 보조 문구 「예상금액·최종금액은 부가세 포함 금액입니다.」 · 배차 정보 라벨 「자동차등록번호」 |
| U-5 | 처리 이력 | 최신 위. 구분선·아이콘 기존 유지 |
| U-6 | 채팅 읽기 전용 | `locked` 안내 제거. `logistics` 안내만 유지 |
| U-7 | 알림 목록 | 채팅 알림 제목 `{이름} · {번호}` — 길이 ≤ 30자 유지(이름 20자 클립) |

---

## API / DB 요구사항

### SQL — `supabase/sql/93_quick_realtime_broadcast_chat_unlock.sql`

```sql
-- Plan: 94_quick-realtime-and-small-fixes-plan.md · Date: 2026-10-27 · Status: Approved
-- Summary: 퀵 3테이블 변경을 private Broadcast topic 3종으로 송신(트리거 · realtime.send · 최소 payload)
--          realtime.messages SELECT 정책(topic별 권한) · create_quick_request_message 잠금 제거 (plan 94 D-3·D-12)

create or replace function private.quick_realtime_broadcast() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_request_id uuid; v_requester uuid; v_payload jsonb;
begin
  -- 테이블별 request_id · requester 결정 (quick_requests는 NEW.id, 나머지는 NEW.quick_request_id → quick_requests 조회)
  ...
  v_payload := jsonb_build_object('table', TG_TABLE_NAME, 'op', TG_OP, 'request_id', v_request_id);  -- 본문 미전송
  perform realtime.send(v_payload, TG_OP, 'quick-request:' || v_request_id, true);
  perform realtime.send(v_payload, TG_OP, 'quick-user:' || v_requester, true);
  perform realtime.send(v_payload, TG_OP, 'quick-requests:all', true);
  return null;
end $$;

create trigger quick_requests_broadcast after insert or update on public.quick_requests
  for each row execute function private.quick_realtime_broadcast();
create trigger quick_request_messages_broadcast after insert on public.quick_request_messages
  for each row execute function private.quick_realtime_broadcast();
create trigger quick_request_message_reads_broadcast after insert or update on public.quick_request_message_reads
  for each row execute function private.quick_realtime_broadcast();

create policy quick_realtime_messages_select on realtime.messages for select to authenticated using (
  (realtime.topic() like 'quick-request:%' and private.can_view_quick_request((select auth.uid()), substring(realtime.topic() from 15)::uuid))
  or realtime.topic() = 'quick-user:' || (select auth.uid())::text
  or (realtime.topic() = 'quick-requests:all' and private.can_view_all_quick_requests((select auth.uid())))
);

create or replace function public.create_quick_request_message(...)  -- SQL 92 본문에서 `if v_status in ('approved','cancelled') … raise` 블록만 제거
-- 롤백: drop trigger 3 · drop function private.quick_realtime_broadcast · drop policy quick_realtime_messages_select · SQL 92의 RPC 본문으로 복원
```

- `realtime.send`가 없는 버전이면 `realtime.broadcast_changes`로 대체하되 `new`/`old` 대신 최소 payload 레코드를 넘긴다 **[INFERRED: backend-dev가 dev에서 함수 존재를 확인]**.
- 트리거 실패가 업무 쓰기를 막지 않도록 `exception when others then return null`로 감싼다.

### Route 변경

| Route | 변경 |
|-------|------|
| `POST /api/quick-request/[no]/messages` | insert 성공 → **즉시 201** `{data:{message}}` · `after(() => safeNotify('chat_message', …))` · 로그 metadata `{quick_request_no, message_id, body_length}`(`recipient_count` 제거) · 승인·취소 건 201 |
| `PATCH /api/quick-request/[no]` | `changedFields − {finalAmount}` 비어 있지 않으면 `after(() => notifyQuickRequestEvent({event:'updated', changedFields}))` · 기존 `final_amount_set` 유지 |
| `POST …`·`accept`·`dispatch`·`approve`·`cancel` | `safeNotify` 호출을 `after()`로(응답 불변) |
| `POST …/dispatch` · `PATCH` | `vehicleInfo` 자동차등록번호 검증(D-9) 400 메시지 |

### 알림 (`notifications.server.ts`)

- `QuickRequestNotifyEvent`에 `'updated'` 추가 · `buildCopy`: 제목 `퀵 {no} 수정됨` · requesterBody `{행위자}님이 요청 내용을 수정했습니다. ({라벨…})` · vendorBody 없음(수신자 요청자만).
- `changedFields` → 한국어 라벨 맵(`QUICK_REQUEST_PATCH_FIELD_LABELS`: 출발지 주소·출발지 상세주소·출발 담당자·출발 담당 연락처·경유지·도착지 …·일정·물품 크기·물품 내용·차량 종류·차량 대수·운임·메모·특이사항·예상금액·자동차등록번호·기사 이름·기사 연락처).
- `buildChatNotificationTitle(requestNo, senderName)` → `${name(20)} · ${requestNo}`.

### FE 실시간 훅

```
useQuickRealtimeChannel({ topic, enabled, onEvent, pollingQueryKeys })
  → { status: 'connecting' | 'live' | 'polling' }
  setAuth → channel(topic, {config:{private:true}}) → .on('broadcast', {event:'*'}, onEvent)
  subscribe((status) => …) · 5초 타이머: SUBSCRIBED 아니면 'polling' · 상태가 CHANNEL_ERROR/TIMED_OUT/CLOSED → 'polling'
  'polling'일 때 pollingQueryKeys를 refetchInterval 5000으로(queryClient.setQueryDefaults 또는 useQuery refetchInterval 옵션 전달)
  unmount → removeChannel
```

---

## 활동 감사 로그 (기록 연동)

> `core-conventions.mdc` §활동 감사 로그 · [plan 08](./08_activity-audit-log-plan.md)

| Route | action | 변경 |
|-------|--------|------|
| `POST …/messages` | `quick_request.message_create` | 전 분기 유지 · metadata `recipient_count` **제거**(after()로 이동) · 승인·취소 건도 201 기록 · 409 `locked` 분기 **삭제** |
| `PATCH …/[no]` | `quick_request.update` | 전 분기 유지 · metadata `changedFields` 유지(알림 여부는 기록하지 않음) |
| `POST …/dispatch` | `quick_request.dispatch` | 400 분기에 자동차등록번호 `validation_errors` |
| 신규 CUD Route | **없음** | — |
| 알림 INSERT · Broadcast 트리거 · SW 클릭 | Out | 기존 원칙(파생 작업·클라이언트) |

- 검증 AC: **AC-25**. 삭제 UI 없음(`AlertModal` 대상 없음).

---

## 영향 파일 & 패턴

| 팀 | 파일 |
|---|---|
| root | `vercel.json`(신규 · Step 0 직후) |
| BE | `supabase/sql/93_quick_realtime_broadcast_chat_unlock.sql`(신규) · `src/app/api/quick-request/[requestNo]/messages/route.ts` · `[requestNo]/route.ts` · `route.ts` · `[requestNo]/{accept,dispatch,approve,cancel}/route.ts` · `src/features/quick-request/api/{notifications.server,messages.server,workflow.server}.ts` · `schemas/{quick-request-workflow,quick-request-dispatch,quick-request-edit,quick-request-chat}.ts` · `lib/quick-request-vehicle-plate.ts`(신규 · 정규식 3종 + normalize) · `src/features/activity-logs/api/log.server.ts`(allowlist `recipient_count` 제거) |
| FE | `src/features/quick-request/lib/use-quick-realtime-channel.ts`(신규) · `components/quick-request-realtime.tsx` · `components/chat/{quick-chat-unread-realtime,quick-chat-list-realtime,quick-chat-realtime,use-typing-broadcast,quick-chat-read-only-notice,quick-request-conversation,quick-chat-constants}.tsx` · `components/dashboard/{quick-dashboard-body,quick-dashboard-columns,quick-request-mobile-card}.tsx` · `components/dialogs/{quick-dispatch-fields,quick-final-amount-dialog}.tsx` · `components/edit/quick-request-edit-dispatch-section.tsx` · `components/detail/{quick-request-detail-page,quick-request-history}.tsx` · `public/sw.js` · `src/components/pwa/service-worker-registrar.tsx` |
| verifier | `e2e/quick-round2/94-*.spec.ts`(신규) · `e2e/quick-chat/*`(AC-07 교체·채널 상태) · `e2e/quick-workflow/{vendor-flow,notifications}.spec.ts`(`21마 6543`) · `e2e/push-notifications/02-sw.spec.ts`(AC-12) |

**패턴:** `support-comment-realtime.tsx`(setAuth → channel → removeChannel) · `insert.server.ts`의 `after()` import·fallback · `DataTable onRowClick`(system-email-logs) · `jsonWithActivityLog` 전 분기 · React Query `refetchInterval`.

---

## 리스크 & 완화

| 등급 | 리스크 | 완화 |
|---|---|---|
| HIGH | Broadcast 권한 정책 오류로 남의 건 이벤트가 새거나(payload에 본문 없음 → 피해는 「변경이 있었다」 신호뿐) 반대로 정당한 구독이 막혀 아무것도 안 옴 | 최소 payload(D-3) · 권한 함수 재사용 · AC-07(차단)·AC-05~08(허용) 양방향 판정 · 막히면 **폴링 fallback**이 받쳐 준다(AC-09) |
| HIGH | `realtime.send`/`broadcast_changes` 시그니처가 dev Supabase 버전과 다름 | backend-dev가 `\df realtime.*`로 확인 후 선택 · 실패 시 `broadcast_changes` + 최소 레코드 |
| MED | `after()`가 로컬 `next dev`에서 안 돌아 알림이 안 생김 | 91이 이미 `after()` + fire-and-forget fallback을 검증(`insert.server.ts`). 같은 helper 사용 · AC-02를 dev·`next start` 양쪽 |
| MED | 자동차등록번호 형식이 실제 번호판 변형(건설기계·임시번호)을 거부 | 3패턴 관대 + 최대 20자 · 거부 사례는 사용자 보고로 패턴 추가(후속) |
| MED | 행 클릭과 셀 안 버튼·링크 충돌(이중 이동) | `stopPropagation` + `isRowClickable` · AC-14·15 |
| MED | 잠금 해제로 승인 후 대화가 늘어 알림 증가 | 사용자 수용(brief 15) · 91 그룹 OFF |
| LOW | `vercel.json` 추가로 Hobby 플랜 제약 | 플랜 거부 시 Vercel 대시보드 Functions region 설정으로 대체(사용자) |
| LOW | SW 업데이트가 기존 설치 기기에 늦게 반영 | `skipWaiting`·`clients.claim` 기존 · 수동 QA 전 새로고침 2회 |

**롤백:** SQL 93 롤백 블록(트리거·정책 drop · RPC 92 본문) · 코드는 Step 0 스냅샷/`git revert` · `vercel.json` 삭제.

---

## Battle Plan (단계)

| # | 단계 | 산출물 | 확신도 | 의존 |
|---|---|---|---|---|
| 0 | root Step 0 백업 · `vercel.json` 생성(AC-01) · 사용자에게 재배포 요청(비차단) | 스냅샷·파일 | HIGH | — |
| 1 | BE: 진단 측정(교체 전 수치 기록) → `after()` 알림 이동 6 Route → tsc | 응답 즉시 201 | HIGH | 0 |
| 2 | BE: SQL 93 dev 적용 → AC-04 SQL 확인 | 트리거·정책·RPC | MED | — |
| 3 | FE: `use-quick-realtime-channel` 훅 → 4개 Realtime 컴포넌트 재작성 → typing 채널 통합 → 폴링 배지 → **Checkpoint 1**(AC-05~09) | 실시간 | MED | 2 |
| 4 | BE: `updated` 알림 · 제목 변경 · 자동차등록번호 검증 · locked 제거 · 로그 metadata | API | HIGH | 1 |
| 5 | FE: SW postMessage + registrar · 행/카드 클릭 · 문구 · 라벨/검증 · 이력 역순 · 읽기 전용 제거 | UI | HIGH | 4 |
| 6 | verifier: 신규 spec + 기존 값 교체 → 회귀 5 디렉터리 → tsc·lint·build → 수동 QA 3건 사용자 전달 | green | MED | 3·5 |

**추정:** 신규 4파일 · 수정 약 30파일 · +900/−350줄 · **Complex** · 약 6~8시간. Checkpoint 1 = 3단계 직후(AC-05~09), Checkpoint 2 = 5단계 직후(AC-11·14~22).

---

## requirements-pipeline Express (Phase 3)

### 가정

| ID | 가정 | 출처 |
|----|------|------|
| A1 | Supabase dev 프로젝트(ap-northeast-2)에 `realtime.send`가 있다 | Supabase Realtime 문서 **[INFERRED · 2단계 확인]** |
| A2 | Vercel Hobby/Pro 모두 `vercel.json` `regions` 1개 지정이 허용된다 | Vercel 문서 **[INFERRED]** |
| A3 | 사용자는 Vercel 재배포를 직접 한다 | 사용자 답변 Q7 |
| A4 | 알림을 `after()`로 미뤄도 수신자·문구는 그대로(92·93 규칙) | D-2 |
| A5 | 잠금 해제는 채팅만이며 상태·항목 변경 잠금은 유지 | brief 15 |

### 검증 시나리오

| 시나리오 | 기대 |
|----------|------|
| 전송 즉시성 | 201이 알림 처리와 무관하게 즉시(AC-02) · 상대 화면 5초 안(AC-05~08) |
| 연결 실패 | WebSocket 차단 → 폴링 배지 → 10초 안 반영(AC-09) |
| 권한 | 남의 건 topic 구독 실패 · 화면 0건(AC-07) |
| 푸시 클릭 | 열린 창은 `router.push`·재로드 없음(AC-11) |
| 수정 알림 | 최종금액 외 변경 → 요청자 1건, 행위자 0건(AC-20·21) |
| 잠금 해제 | approved·cancelled 201, 항목 수정은 409 유지(AC-22) |

---

## 구현 팀 전달 메모

### designer
- 「폴링」 배지 상태 1개 추가(U-1), 표 행 hover/focus(U-2), 자동차등록번호 Input·부가세 문구(U-3·4), 이력 역순(U-5). 새 화면 없음.

### backend-dev
- **1단계 먼저**: 교체 전 측정 → `after()` 이동(6 Route) → SQL 93(함수 존재 확인 → 트리거 3 · 정책 · RPC 잠금 제거) → `updated` 알림·라벨 맵 · 제목 변경 · 자동차등록번호 서버 검증(공용 `lib/quick-request-vehicle-plate.ts`) · `buildChatWriteState` locked 제거 · 로그 allowlist `recipient_count` 제거. 교체 후 측정값을 수정 이력에 기록.

### frontend-dev
- 공용 훅 1개로 Realtime 4곳 통합(private broadcast · 폴링) · typing 채널 통합 · SW `postMessage`+`router.push`(ack 1.5초) · `onRowClick`/카드 클릭 + stopPropagation · 문구·라벨·검증(클라이언트도 같은 lib) · 이력 역순 · 읽기 전용 locked 제거.

### verifier
- Realtime 2 context 5초/8초 · WebSocket 차단 폴링(AC-09) · SW message 디스패치(AC-11) · 값 교체(`21마 6543`) · 93 AC-07 → AC-22 · 수동 QA 3건(AC-10·13·24) 사용자 전달 · 회귀 5 디렉터리.

---

## 열린 질문

| # | 질문 | 기본값 |
|---|---|---|
| OQ-1 | `vercel.json` region이 플랜에서 거부되면? | Vercel 대시보드 설정으로 대체(사용자) · plan 수정 이력 기록 |
| OQ-2 | publication에서 퀵 3테이블 제거 시점 | 후속 [TBD] (부하 측정 후) |

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-10-27 | 최초 작성 · Approved(/root 단일 게이트 · deep-interview Q1·Q7 답변 + brief 4·7·8·9·12·14·15·17·19 반영). Vercel `icn1` · 알림 `after()` · Broadcast from Database(private topic 3종 · 최소 payload) · 폴링 fallback · SW postMessage · 행 클릭 · 부가세 포함 · 자동차등록번호 · 이력 역순 · `updated` 알림(type 재사용) · 채팅 잠금 해제 · 푸시 제목 `{이름} · {번호}` · SQL 93 · AC 26 | planner |
| 2026-10-27 | backend-dev — **D-14 측정 기록(교체 전 · 코드 기준)**: `POST …/messages`는 RPC insert → `await notifyQuickRequestChatMessage`(profiles 2회 조회 + notifications insert + `after()` 푸시 예약) 완료 후 201 — 알림 처리 전체가 응답 지연에 포함. 등록·접수·배차·승인·취소·PATCH 5곳도 `await safeNotify` 후 응답. **교체 후**: 7 Route 모두 `after(() => safeNotify(...))`로 이동 → 응답은 DB 쓰기 직후(알림 0ms 포함). ms 측정값(전송→「전송됨」·상대 화면 표시 각 5회 중앙값)은 `icn1` 재배포 후 AC-10 수동 QA에서 기록 [미측정 · 로컬은 region 차이를 재현하지 못함]. SQL 93 dev 적용(트리거 3 · 정책 SELECT+INSERT · RPC 잠금 제거 · publication 불변). `realtime.messages` INSERT 정책 `quick_realtime_messages_insert` 1개 추가(D-5 typing 채널 통합에 필요 · plan 본문 미기재). | backend-dev |
| 2026-10-27 | verifier — **Completed**. Playwright CLI: 신규 `e2e/quick-round2/94-{realtime,push-click,small-fixes,notify-unlock}.spec.ts` **22/22 green**(AC-01·02·03·07·09·11·14~23·25) + `e2e/push-notifications/01-pwa-shell.spec.ts` AC-12 추가 green · AC-05·06은 92 AC-19·20(`quick-workflow/realtime.spec.ts`) green · AC-08은 `e2e/quick-chat` 전 spec green(93 AC-07→94 AC-22 교체) · AC-04 Dev MCP SQL 확인(트리거 3 · `quick_realtime_messages_select`(+`_insert`) · publication 불변 · RPC 잠금 없음) · AC-10·13·24 수동 QA(사용자) · AC-26 tsc 0·lint:strict 0·build exit 0. 회귀 6 디렉터리 215 pass / 기존 실패 5(notifications-page AC-04 · user-update AC-03 · guard 401 `x-request-id` notes.api AC-12·push 03 AC-05 · quick-workflow access AC-02 플레이크→재실행 green) · react-doctor 변경분 82점(오류 0). **판정 메모:** AC-07 topic 권한은 `page.evaluate` 대신 Node supabase-js(user2 비밀번호 로그인) `subscribe` 콜백 `CHANNEL_ERROR`로 판정 · AC-09는 `context.routeWebSocket` · AC-01은 `$schema` 키 허용 · AC-21 ②는 「메모」 대신 「차량 대수」(`itemDescription`은 `goodsSize!=='other'`면 빈 값 강제). **e2e 정리:** 잠금 해제로 일회용 계정이 실데이터 승인·취소 건에 읽음 위치를 남겨 cleanup이 실패 → `scripts/cleanup-e2e-mock-data.mjs` 3b(일회용 계정의 메시지·읽음·행위자 알림 삭제) 추가 · `npm run e2e:cleanup` remaining 전부 0. | verifier |
