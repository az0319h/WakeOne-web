# 퀵 채팅 파일 첨부(드래그앤드롭·클립 · 이미지 미리보기 · 파일 카드) 기획서

> Date: 2026-10-27
> Status: Completed
> Author: planner
> **퀵 2차(94~101) 중 5번째.** 선행: [97](./97_quick-period-filter-recent-address-split-phone-plan.md) 완료 후. [94](./94_quick-realtime-and-small-fixes-plan.md)(`after()` 알림 · Broadcast)·[93](./93_quick-request-chat-plan.md)(메시지 RPC·RLS)을 전제. 다음 plan [101](./101_quick-chat-participants-plan.md)이 `private.can_view_quick_request`를 넓히면 이 plan의 RLS·Route 권한은 **자동으로** 참여자까지 허용된다
> **SQL 예정:** `supabase/sql/96_quick_chat_attachments.sql`(앞 plan SQL 번호에 따라 당겨질 수 있음 · backend-dev 적용 직전 최대+1). **Storage 버킷은 `WakeOne-Dev-Supabase-Mcp`로 생성**(사용자 지시). Dev DB만
> **brief 항목:** 11(채팅 파일 첨부) · 20(파일 말풍선 UI)
> **Supersedes:** [93](./93_quick-request-chat-plan.md) C-9(텍스트만)·C-15 「첨부 Out」·U-6 「첨부 버튼 없음」·DM 결정표 「첨부 Out」 · AC-08(공백만 → 400)의 「첨부 없이」 조건 추가
> **선행:** [08](./08_activity-audit-log-plan.md), [14](./14_delete-confirm-dialog-plan.md), [16](./16_contract-management-plan.md), [38](./38_contract-attachment-size-limit-plan.md), [53](./53_contract-attachment-direct-upload-plan.md), [72](./72_contract-attachment-modal-viewer-plan.md), [89](./89_quick-workflow-dongbang-openchat-plan.md), [91](./91_pwa-web-push-notifications-plan.md), [93](./93_quick-request-chat-plan.md), [94](./94_quick-realtime-and-small-fixes-plan.md)

## 선행 plan 참조 (Phase 0)

| Plan | Status | 관계 |
|------|--------|------|
| **53 · 38 · 16** | Approved/Completed | **계약서 첨부 방식 재사용**: `prepare`(signed upload URL) → 클라이언트 직접 업로드 → `complete`(서버 검증·행 insert) 2단계, 비공개 버킷, 파일당 10MB, 다운로드는 서명 URL 60초, 확장자 sanitize(`SAFE_EXTENSION_PATTERN`) |
| **72** | Approved | 이미지·PDF **lightbox**(`src/features/attachments/components/attachment-lightbox-*`)를 채팅 이미지·PDF 보기에 **그대로 재사용**(`AttachmentLightboxProvider`가 dashboard layout에 이미 있음) |
| **93** | Completed | 메시지 RPC `create_quick_request_message`·RLS `can_view_quick_request`·알림 `notifyQuickRequestChatMessage`·optimistic 전송·Realtime(94 Broadcast)·읽음 처리를 확장한다. 메시지 **본문은 첨부가 있으면 비울 수 있다** |
| **94** | Approved | 알림은 `after()` · 승인·취소 건도 첨부 가능(잠금 해제) · Broadcast 트리거는 `quick_request_messages` INSERT로 발화하므로 첨부 테이블 트리거는 불필요 |
| **91** | Completed | 첨부가 있는 메시지의 푸시 본문은 「사진 N장」/「파일 N개」 요약(파일명 미노출 · 잠금화면 노출 최소화) |
| **08** | Approved | 신규 CUD Route(`prepare`) 전 분기 로그 · 메시지 POST 로그에 `attachment_count` |
| **14** | Completed | 미전송 임시 첨부 제거는 서버 데이터가 아니라 `AlertModal` 대상 아님 · 서버 첨부 삭제 기능 자체가 **Out** |

### 정찰로 확인한 사실

| 항목 | 사실 | 근거 |
|------|------|------|
| 계약 첨부 상수 | `CONTRACT_ATTACHMENT_PER_FILE_MAX_MB = 10` · 문서 총량 50MB(앱 계층) · 확장자 `^[a-z0-9]{1,16}$` | `contracts/api/types.ts:5~23` · `service.server.ts:106~315` |
| 직접 업로드 | `storage.from(bucket).createSignedUploadUrl(path, {upsert:false})` · 워크플로우(88)도 동일 · 다운로드 `createSignedUrl(path, 60, {download})` | `contracts/service.server.ts:750` · `workflow/service.server.ts:749,807` |
| 버킷 정책 | SQL 40: `update storage.buckets set file_size_limit = 10485760` 패턴 | `supabase/sql/40_*.sql:16` |
| lightbox | `src/features/attachments/components/{attachment-lightbox-dialog,carousel,image-viewer,pdf-viewer}.tsx` · `api/fetch-attachment-blob.ts`(서명 URL → blob) | ls |
| 메시지 schema | `body` 1~1,000자 필수(`quickChatBodySchema`) · DB CHECK `char_length(btrim(body)) between 1 and 1000` | `schemas/quick-request-chat.ts:64` · SQL 92 |
| 전송 훅 | `use-send-message.ts` optimistic(`temp-` id) · 실패 재시도 · `quick-chat-cache.ts` merge | 93 r3 |
| Composer | controlled `Textarea` + 「전송」 버튼 · 첨부 버튼 없음 | `quick-chat-composer.tsx` |

---

## 한 줄 요약

퀵 채팅에서 **파일을 끌어다 놓거나 클립 버튼으로** 올릴 수 있다. 계약서 첨부와 같은 방식(비공개 버킷 + 서명 URL 직접 업로드, 파일당 10MB)을 쓰고, **메시지당 최대 30개**, 이미지·PDF·문서·압축 파일을 허용한다. 이미지는 말풍선 안에 **미리보기**로 보이고(클릭하면 크게), 그 밖의 파일은 **클립 아이콘 + 파일명 + 확장자 + 다운로드 버튼** 카드로 보인다. 첨부만 있고 글이 없는 메시지도 보낼 수 있다. 알림에는 「사진 2장」·「파일 1개」처럼 요약만 들어간다.

---

## 정책 확정안 (deep-interview Q4 · brief 11·20)

| # | 항목 | 확정 |
|---|------|------|
| D-1 | 허용 형식 | 확장자 allowlist(소문자): 이미지 `jpg jpeg png gif webp heic heif` · 문서 `pdf hwp hwpx doc docx xls xlsx ppt pptx txt csv` · 압축 `zip`. MIME도 함께 검사(브라우저 MIME + 서버 `complete` 시 Storage metadata). 그 외(exe·js·sh·bat·apk 등)는 클라이언트·서버 모두 **400** 「허용되지 않는 파일 형식입니다.」 |
| D-2 | 용량·개수 | 파일당 **10MB**(계약서와 동일 · 버킷 `file_size_limit`) · 메시지당 **최대 30개**(사용자 Q4) · 메시지당 총량 상한 **없음**(30 × 10MB) · 본문 없이 첨부만 **허용**. 본문 1,000자 규칙 유지 |
| D-3 | 보존 | 삭제 기능 없음. 메시지와 같은 수명(요청 건 삭제 시 cascade → Storage 객체는 cleanup 스크립트 `[TBD]`). `prepare`만 하고 `complete`하지 않은 **고아 객체**는 24시간 뒤 정리 대상(후속 cron `[TBD]` · 이 plan은 `pending` 행에 `expires_at`만 기록) |
| D-4 | 업로드 흐름 | ① `POST …/messages/attachments/prepare` `{files:[{name,size,mime}] ≤30}` → 각 파일 `{attachmentId, uploadUrl, token, storagePath}` + `pending` 행 insert(`message_id null`, `expires_at = now()+24h`) ② 클라이언트가 `uploadToSignedUrl` 병렬(최대 3개 동시) ③ `POST …/messages` `{body, attachmentIds:[…]}` → 서버가 **pending 행 소유·건 일치·Storage 객체 존재·크기 ≤ 10MB**를 확인한 뒤 RPC에서 메시지 insert + 첨부 행에 `message_id` 세팅(한 트랜잭션) ④ 실패 시 pending 그대로(24h 뒤 정리). 전송 전 취소하면 클라이언트가 `DELETE …/attachments/{id}`(pending만 · 로그 Out 아님 → CUD이므로 전 분기 로그) |
| D-5 | 보기·다운로드 | 이미지: `GET …/attachments/{id}/url` → 서명 URL(60초) → `<img>`(말풍선 썸네일 · 최대 4장 격자 + 「+N」) · 클릭 → 72 lightbox(carousel · 같은 메시지의 이미지·PDF). 파일: 카드 + 다운로드 버튼 → `GET …/attachments/{id}/download` → 서명 URL(`download: file_name`) 302. 권한은 `can_view_quick_request`(RLS SELECT) + Route 재검사 |
| D-6 | 파일 카드 UI (20) | 사용자 참조 이미지 기준: 왼쪽 네모 타일에 `Icons.paperclip`(이미지 아닌 파일) · 가운데 파일명 굵게(`truncate` · 2줄까지) + 아래 작은 muted **확장자 대문자 · 용량**(`DOCX · 1.2MB`) · 오른쪽 `Icons.download` 아이콘 버튼(≥44px). 카드형 말풍선(내 메시지 primary 톤·상대 muted 톤 유지). 여러 파일이면 카드 세로 나열 |
| D-7 | 입력 UI | Composer 왼쪽 **클립 버튼**(`quick-chat-attach` · `<input type=file multiple accept=…>`) · 대화 영역 전체 **드래그앤드롭**(dragenter 시 오버레이 「파일을 여기에 놓으세요」) · 선택한 파일은 입력창 위 **첨부 대기 줄**(썸네일/아이콘 + 이름 + 용량 + ✕ 제거 · 업로드 진행률) · 30개 초과·10MB 초과·형식 불가는 즉시 toast(`notifyError`) + 해당 파일만 제외 · 「전송」은 본문 또는 첨부 1개 이상일 때 활성 · 업로드 중 전송 비활성 |
| D-8 | optimistic | 첨부 메시지도 즉시 말풍선(로컬 `ObjectURL` 썸네일 · pending ✓) → 201로 교체. 실패 시 「전송 실패 · 다시 보내기」(이미 올라간 파일은 재업로드 없이 `attachmentIds` 재사용) |
| D-9 | 알림·미리보기 | 알림 본문: 본문 있음 → `{본문(…)} (사진 2장·파일 1개)` / 본문 없음 → `사진 2장` · `파일 1개` · `사진 1장·파일 2개`. 대화 목록 미리보기 `{이름}: 사진 2장`. 파일명은 알림·미리보기·활동 로그에 **넣지 않는다** |
| D-10 | 접근 제한 | 구매물류팀(읽기 전용)은 첨부를 **볼 수·내려받을 수 있지만** 올릴 수 없다(기존 쓰기 규칙). 동방 allowlist는 `/api/quick-request/**`라 추가 수정 없음 |
| D-11 | 로그 | `prepare`·`DELETE pending`·메시지 POST 전 분기 로그. metadata에 `attachment_count`·`total_bytes`·`error_code`만(파일명·경로 금지). 다운로드·URL GET은 Read → Out |

---

## 목표 & 완료 기준 (AC)

공통: 계정 `user.json`·`dongbang.json`·`dongbang2`·`logistics.json`·`user2.json`. 업로드 fixture는 `e2e/fixtures/`의 `sample.png`(50KB)·`sample.pdf`·`sample.docx`·`sample.zip`·`big-11mb.bin`(생성)·`evil.exe`(0바이트).

### A. 업로드·전송

| AC | 유형 | 전제 | 동작 | 기대 |
|----|------|------|------|------|
| AC-01 | Playwright | `user.json` · 본인 건 대화 | 클립 버튼 → `sample.png`·`sample.docx` 선택 → 본문 「첨부합니다」 → 전송 | 첨부 대기 줄에 2개(썸네일·아이콘·이름·용량·✕) · 전송 후 **201** · 말풍선에 본문 + 이미지 썸네일 1 + 파일 카드 1(`quick-chat-attachment-image-*`·`quick-chat-attachment-file-*`) · 입력창·대기 줄 비워짐 · DB `quick_request_message_attachments` 2행 `message_id` 세팅 |
| AC-02 | Playwright | 〃 | 본문 없이 `sample.png`만 → 전송 | 201 · 말풍선에 이미지만 · 대화 목록 미리보기 **`{이름}: 사진 1장`** · 알림 본문 **`사진 1장`** |
| AC-03 | Playwright | 〃 | `page.dispatchEvent`로 대화 영역에 `drop`(DataTransfer `sample.pdf`) | 드래그 중 오버레이 **「파일을 여기에 놓으세요」** · drop 후 대기 줄 1개 · 전송 → 카드 **`PDF · {용량}`** · 카드 클릭 시 lightbox(PDF 뷰어) |
| AC-04 | Playwright | 〃 | `big-11mb.bin` / `evil.exe` / 31개 파일 선택 | 각각 toast **「파일당 용량은 10MB 이하여야 합니다.」** / **「허용되지 않는 파일 형식입니다.」** / **「파일은 메시지당 30개까지 첨부할 수 있습니다.」** · 대기 줄에 미추가(31개는 앞 30개만) · 전송 요청 0 |
| AC-05 | API | `user.json` | `POST …/attachments/prepare` `{files:[{name:'a.exe',size:10,mime:'application/octet-stream'}]}` / `{files:[…31개]}` / `{files:[{name:'a.png',size:11*1024*1024,…}]}` / 유효 1개 | 400 형식 / 400 「파일은 메시지당 30개까지…」 / 400 용량 / **201** `{attachments:[{attachmentId, uploadUrl, token, storagePath}]}` + DB pending 행(`message_id null`, `expires_at` ≈ +24h) · 모든 응답 `x-request-id` |
| AC-06 | API | AC-05 유효 prepare 후 **업로드 안 함** | `POST …/messages` `{body:'', attachmentIds:[id]}` | **400** 「업로드되지 않은 파일이 있습니다. 다시 첨부해 주세요.」 · 메시지 미생성 |
| AC-07 | API | `user.json`이 prepare한 id | `user2.json`·`dongbang.json`이 `POST …/messages` `{attachmentIds:[그 id]}` | user2 404 · dongbang **400** 「첨부 정보가 올바르지 않습니다.」(소유자 불일치) |
| AC-08 | API | `logistics.json` · 타인 건 | `prepare` · `POST messages` | **403** 「구매물류팀은 대화를 볼 수만 있습니다.」(93 AC-05 유지) |
| AC-09 | API | `user.json` | `POST …/messages` `{body:'   ', attachmentIds:[]}` | **400** 「메시지를 입력하거나 파일을 첨부해 주세요.」(93 AC-08 문구 교체) |
| AC-10 | Playwright | `page.route`로 메시지 POST 500 | `sample.png` + 전송 | 말풍선 「전송 실패 · 다시 보내기」 · route 복구 후 재시도 → 201 · **업로드 요청(`uploadToSignedUrl`) 1회만**(재사용) |
| AC-11 | API·로그 | AC-05 prepare 후 | `DELETE …/attachments/{id}`(pending) → 같은 id 재호출 → 전송 완료된 첨부 id로 호출 | 200 → 404 → **409** 「전송된 첨부는 삭제할 수 없습니다.」 · 로그 `quick_request.message_attachment_delete` 200·404·409 |

### B. 보기·다운로드·권한

| AC | 유형 | 전제 | 동작 | 기대 |
|----|------|------|------|------|
| AC-12 | Playwright (2 context) | AC-01 메시지 · `dongbang.json` 「퀵 대화」 | 수신 | 5초 안에 왼쪽 말풍선에 썸네일·카드 · 썸네일 클릭 → lightbox(`attachment-lightbox-dialog`) · 다운로드 버튼 → 응답 302 `Location`이 `…/storage/v1/object/sign/…` + `download=` |
| AC-13 | API | `user2.json` | `GET …/attachments/{id}/url`·`/download` | **404** |
| AC-14 | API | `logistics.json` | 같은 GET 2개 | **200/302**(읽기 허용) |
| AC-15 | SQL (Dev MCP) | SQL 적용 | 버킷·테이블·RLS | `storage.buckets` `quick-chat-attachments` `public=false` · `file_size_limit=10485760` · `allowed_mime_types` 배열에 D-1 MIME · `storage.objects`에 authenticated 정책 **0건**(서명 URL만) · `quick_request_message_attachments` RLS SELECT `can_view_quick_request` · authenticated 쓰기 revoke |
| AC-16 | Playwright | 이미지 5장 메시지 | 말풍선 | 격자 4장 + **「+1」** · 클릭 → lightbox 5장 carousel |
| AC-17 | Playwright | 375 · 파일 카드 3개 | 대화 | 카드 폭 = 말풍선 폭 · 다운로드 버튼 ≥ 44px · 가로 스크롤 없음 · 이름 2줄 truncate |

### C. 알림·로그·품질

| AC | 유형 | 전제 | 동작 | 기대 |
|----|------|------|------|------|
| AC-18 | API·DB | 요청자 「확인 부탁」 + 사진 2 + 파일 1 | 알림 | 본문 **`확인 부탁 (사진 2장·파일 1개)`** · 파일명 0 · 수신자 93 규칙 |
| AC-19 | Playwright·API | AC-01·05·11 이후 | `/dashboard/logs` · `GET /api/activity-logs` | `quick_request.message_create` metadata `attachment_count=2`·`total_bytes` · `quick_request.message_attachment_prepare` 201·400 행 · metadata에 파일명·`storage_path` **0** · `x-request-id` |
| AC-20 | grep | 구현 완료 | `src/features/quick-request/components/chat/**` · 신규 Route | `window.confirm` 0 · `rounded-[`·`bg-green-`·`backdrop-blur` 0 · `recordActivityLog`/`jsonWithActivityLog`가 `prepare`·`DELETE` Route 모든 `return`에 |
| AC-21 | Playwright | `THEMES` × light/dark 20조합 | 첨부 메시지 1개 있는 대화 | 카드·썸네일 표시 · `scrollWidth <= clientWidth` |
| AC-22 | CLI | — | `npx tsc --noEmit` · `npm run lint` · `npm run build` · `npx playwright test e2e/quick-chat e2e/quick-round2/98-*` · `npm run e2e:cleanup` | 통과 · cleanup이 테스트 첨부 객체·행 삭제(remaining 0) |

**AC 총 22개**: A 11 · B 6 · C 5.

---

## 범위 (In / Out)

### In
1. **Storage 버킷** `quick-chat-attachments`(Dev MCP · private · 10MB · MIME allowlist)
2. **SQL 96**: `quick_request_message_attachments` 테이블(pending → 연결), RLS, `create_quick_request_message` 확장(`p_attachment_ids bigint[]` · 본문 빈 값 허용 조건 · 첨부 연결 한 트랜잭션), 본문 CHECK 완화(`char_length(body) <= 1000`, 빈 본문은 RPC가 첨부 존재로 검증)
3. **Route**: `prepare` POST · `attachments/[id]` DELETE(pending) · `attachments/[id]/url` GET · `attachments/[id]/download` GET · `messages` POST 확장 · `messages` GET 응답에 `attachments[]`(id·kind·fileName·size·ext · URL은 지연 조회)
4. **서버 모듈** `attachments.server.ts`(prepare·verify·link·signed URL·cleanup helper) · 알림 요약 문구 · 대화 목록 미리보기
5. **FE**: 클립 버튼·드롭존·첨부 대기 줄·진행률 · `use-send-message` 확장(업로드 → 전송 · 재시도 재사용) · 이미지 격자·lightbox 연동 · 파일 카드 · 대화 목록 미리보기 · 상세·Messenger 공용
6. **activity log** 3 action + 라벨 · metadata allowlist(`attachment_count`·`total_bytes`)
7. **E2E** `e2e/quick-round2/98-*.spec.ts` + fixtures + cleanup 확장
8. 문서: README 98 · 93 수정 이력

### Out
| 항목 | 이유 |
|------|------|
| 첨부 삭제(전송 후)·메시지 삭제 | 업무 증거 보존(93 C-9) |
| 고아 객체 자동 정리 cron · 요청 삭제 시 Storage 정리 | 후속 [TBD](`expires_at`만 기록) |
| 이미지 리사이즈·썸네일 생성(Supabase transform) | 원본 서명 URL + `loading=lazy` · 후속 |
| 바이러스 검사 | 없음(확장자·MIME allowlist만) |
| 붙여넣기(클립보드 이미지) | 후속(드래그·클립만) |
| 음성·동영상 | 형식 allowlist 밖 |
| Main DB·운영 버킷 생성 | 사용자 수동 |

---

## UI 요구사항 (designer 지시)

| # | 화면 | 요구 |
|---|------|------|
| U-1 | Composer | 왼쪽 `Button variant='ghost' size='icon'` + `Icons.paperclip`(`aria-label='파일 첨부'` · ≥44px) · 숨은 `<input type=file multiple accept>` · 입력창 위 **첨부 대기 줄**(가로 스크롤 칩: 이미지는 48px 썸네일, 그 외 아이콘 타일 + 이름 truncate + 용량 + ✕ · 업로드 중 원형 진행률 또는 `Progress`) · 「전송」 활성 규칙(D-7) |
| U-2 | 드롭존 | 대화 영역(`QuickRequestConversation` 루트) `onDragEnter/Over/Leave/Drop` · 오버레이 `absolute inset-0 bg-background/80 border-2 border-dashed border-primary` + 문구 「파일을 여기에 놓으세요」 + `Icons.upload` · 읽기 전용이면 드롭 무시 |
| U-3 | 이미지 말풍선 | 1장: 최대 폭 `max-w-xs` 비율 유지 · 2~4장: 2열 격자 · 5장↑: 4장 + 마지막 타일에 「+N」 오버레이 · `rounded-md`(테마 토큰) · 클릭 → lightbox · `alt`는 파일명 |
| U-4 | 파일 카드 | D-6 레이아웃 · `Card` 톤(내 메시지 `bg-primary/10`, 상대 `bg-muted`) · 왼쪽 타일 `size-10 rounded-md bg-background` + `Icons.paperclip` · 이름 `font-medium line-clamp-2 break-all` · 보조 `text-xs text-muted-foreground uppercase`(`DOCX · 1.2MB`) · 오른쪽 `Button variant='ghost' size='icon'` + `Icons.download`(`aria-label='{파일명} 다운로드'`) |
| U-5 | 본문 + 첨부 | 본문 말풍선 아래 첨부 블록(같은 묶음 · 시각은 마지막에) |
| U-6 | 목록 미리보기 | `{이름}: 사진 2장` 등 · 아이콘 없음(텍스트) |
| U-7 | 테마·접근성 | THEMES 20조합 · 키보드로 클립·다운로드 접근 · `prefers-reduced-motion` 진행률 애니메이션 없음 |

---

## API / DB 요구사항

### Storage (Dev MCP `create_bucket` 또는 SQL)

```
bucket: quick-chat-attachments · public=false · file_size_limit=10485760
allowed_mime_types: image/jpeg image/png image/gif image/webp image/heic image/heif application/pdf
  application/x-hwp application/haansofthwp application/vnd.hancom.hwp application/vnd.hancom.hwpx
  application/msword application/vnd.openxmlformats-officedocument.wordprocessingml.document
  application/vnd.ms-excel application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
  application/vnd.ms-powerpoint application/vnd.openxmlformats-officedocument.presentationml.presentation
  text/plain text/csv application/zip application/x-zip-compressed application/octet-stream(hwp 등 브라우저가 못 맞추는 경우 · 서버가 확장자로 재검사)
path: quick-chat/{request_id}/{message_attachment_id}{.ext}
```

### SQL — `supabase/sql/96_quick_chat_attachments.sql`

```sql
create table public.quick_request_message_attachments (
  id bigint generated always as identity primary key,
  quick_request_id uuid not null references public.quick_requests(id) on delete cascade,
  message_id bigint null references public.quick_request_messages(id) on delete cascade,   -- null = pending
  uploader_user_id uuid not null references auth.users(id) on delete restrict,
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 255),
  file_size bigint not null check (file_size between 1 and 10485760),
  mime_type text not null,
  extension text not null check (extension ~ '^[a-z0-9]{1,8}$'),
  kind text not null check (kind in ('image','file')),
  expires_at timestamptz null,          -- pending 만료(24h) · 연결되면 null
  created_at timestamptz not null default now()
);
create index idx_qrma_message on public.quick_request_message_attachments (message_id);
create index idx_qrma_pending on public.quick_request_message_attachments (uploader_user_id, expires_at) where message_id is null;
alter table … enable row level security;
create policy qrma_select on … for select to authenticated
  using (message_id is not null and private.can_view_quick_request((select auth.uid()), quick_request_id));
revoke all on … from anon, authenticated; grant select on … to authenticated; grant all on … to service_role;
alter table public.quick_request_messages drop constraint quick_request_messages_body_check;
alter table public.quick_request_messages add constraint quick_request_messages_body_check check (char_length(body) <= 1000);
create or replace function public.create_quick_request_message(p_request, p_author, p_author_name, p_author_role, p_body, p_attachment_ids bigint[] default '{}')
  -- (94 잠금 제거 본문 기준) · btrim(p_body)='' and cardinality(p_attachment_ids)=0 → raise 'quick_request_message_empty'
  -- insert message → update attachments set message_id = new.id, expires_at = null
  --   where id = any(p_attachment_ids) and message_id is null and uploader_user_id = p_author and quick_request_id = p_request
  -- 갱신 행 수 ≠ cardinality → raise 'quick_request_attachment_mismatch'(롤백)
-- 롤백: RPC 94 본문 · body CHECK 92 원복 · drop table · 버킷은 수동 삭제
```

### Route

| Method · Path | 권한 | 동작 | 응답 · 로그 |
|---|---|---|---|
| `POST /api/quick-request/[no]/messages/attachments/prepare` | 쓰기 권한(요청자·동방·admin · 101 이후 참여자) | zod(`files` 1~30 · 이름·size·mime) → 확장자·MIME·크기 검사 → pending 행 insert → `createSignedUploadUrl` | 201 `{attachments:[{attachmentId, uploadUrl, token, storagePath}]}` · 400·401·403·404·500 · **`quick_request.message_attachment_prepare`** 전 분기(metadata `attachment_count`·`total_bytes`·`error_code`) |
| `DELETE …/messages/attachments/[id]` | 업로더 본인 | pending만 삭제(Storage 객체 있으면 함께) | 200·401·404·409(연결됨)·500 · **`quick_request.message_attachment_delete`** |
| `POST …/messages` | 기존 | `{body?, attachmentIds?}` → 서버 검증(소유·건·pending·Storage `list`/`info`로 객체 존재·크기) → RPC | 201 `{message:{…, attachments:[…]}}` · 400(빈 본문+첨부 0 / 미업로드 / 불일치) · 기존 분기 · 로그 metadata `attachment_count`·`total_bytes` |
| `GET …/messages` | 기존 | `messages[].attachments[]` `{id, kind, fileName, fileSize, extension}` | Read Out |
| `GET …/messages/attachments/[id]/url` | 조회 권한 | 서명 URL 60초(이미지·PDF 보기) | 200 `{url, expiresAt}` · 401·404 · Read Out |
| `GET …/messages/attachments/[id]/download` | 조회 권한 | 서명 URL(`download: fileName`) | **302** · 401·404 · Read Out |

- 메시지 GET 500개 제한(93)은 유지. 첨부는 메시지 id로 한 번에 조회(`in`).
- 알림(94 `after()`)·대화 목록 미리보기 요약: `summarizeAttachments(kinds) → '사진 2장·파일 1개'`.

---

## 활동 감사 로그 (기록 연동)

> `core-conventions.mdc` §활동 감사 로그 · [plan 08](./08_activity-audit-log-plan.md)

| Route | action | 라벨 | target | return 분기 | metadata allowlist |
|---|---|---|---|---|---|
| `POST …/attachments/prepare` | `quick_request.message_attachment_prepare` | 퀵 대화 첨부 준비 | `quick_request` / `{no}` | 201·400·401·403·404·500 | `attachment_count`·`total_bytes`·`error_code` |
| `DELETE …/attachments/[id]` | `quick_request.message_attachment_delete` | 퀵 대화 첨부 취소 | 〃 | 200·401·404·409·500 | `error_code` |
| `POST …/messages` | `quick_request.message_create`(기존) | — | 〃 | 기존 + 400(첨부) | + `attachment_count`·`total_bytes` |
| GET url·download·messages | — | Read | — | Out | — |

- 파일명·`storage_path`·서명 URL은 **절대 기록하지 않는다**. 검증 **AC-19**. 삭제 확인 Dialog: 서버 첨부 삭제 UI 없음 · pending ✕는 임시 항목(`AlertModal` 대상 아님) · `window.confirm` 0(AC-20).

---

## 영향 파일 & 패턴

| 팀 | 파일 |
|---|---|
| BE | `supabase/sql/96_quick_chat_attachments.sql`(신규) · `src/features/quick-request/api/attachments.server.ts`(신규) · `api/messages.server.ts` · `api/notifications.server.ts`(요약) · `schemas/quick-request-chat.ts`(body optional + `attachmentIds`) · `schemas/quick-request-attachment.ts`(신규 · allowlist·상수) · `src/app/api/quick-request/[requestNo]/messages/{route.ts, attachments/prepare/route.ts, attachments/[id]/route.ts, attachments/[id]/url/route.ts, attachments/[id]/download/route.ts}` · `src/features/activity-logs/api/{types,log.server}.ts` · `labels.ts` |
| FE | `components/chat/{quick-chat-composer,quick-chat-bubble,quick-request-conversation,quick-chat-conversation-item,use-send-message}.tsx` · `components/chat/{quick-chat-attachment-tray,quick-chat-dropzone,quick-chat-image-grid,quick-chat-file-card,use-attachment-upload}.tsx`(신규) · `lib/quick-chat-cache.ts` · `lib/quick-chat-attachments.ts`(신규 · 요약·검사 공용) · `api/{service,types,mutations}.ts` · `src/features/attachments/*`(재사용 · 수정 없음 또는 export만) |
| verifier | `e2e/quick-round2/98-attachments*.spec.ts`(신규) · `e2e/fixtures/*` · `scripts/cleanup-e2e-mock-data.mjs`(첨부 행·Storage 객체) |

**패턴:** 53 `prepare/complete` + `createSignedUploadUrl` · 38 상수·문구 · 72 lightbox · 93 optimistic·cache · `jsonWithActivityLog` · 91 `insertNotifications`(94 `after()`).

---

## 리스크 & 완화

| 등급 | 리스크 | 완화 |
|---|---|---|
| HIGH | 첨부 소유·건 불일치로 남의 건에 파일을 붙이거나 남의 파일을 봄 | RPC가 `uploader=author AND request 일치 AND pending`을 한 문장으로 검증·롤백 · RLS SELECT `message_id not null` + `can_view_quick_request` · AC-07·13 |
| HIGH | 서명 업로드 URL로 10MB 초과·다른 MIME 업로드 | 버킷 `file_size_limit`·`allowed_mime_types` + `complete` 시 서버가 Storage 메타로 재검사(AC-05·06) |
| MED | 고아 pending 객체 누적 | `expires_at` 기록 · 정리 cron 후속 [TBD] · cleanup 스크립트가 e2e 분 정리 |
| MED | 30개 × 10MB 동시 업로드로 모바일 실패 | 동시 3개 제한 · 개별 진행률 · 실패 파일만 재시도 |
| MED | HWP 등 MIME을 브라우저가 `octet-stream`으로 보냄 | 서버는 **확장자 allowlist를 1차**, MIME은 보조 · `octet-stream` 허용 + 확장자 검사 |
| MED | 이미지 많은 대화에서 서명 URL 60초 만료로 깨진 썸네일 | `useQuery` staleTime 50초 + 에러 시 재조회 · lightbox 열 때 재발급 |
| LOW | 템플릿 테마 규칙 위반 | AC-20·21 |

**롤백:** SQL 롤백 블록 · 버킷 수동 삭제 · 코드 revert.

---

## Battle Plan (단계)

| # | 단계 | 산출물 | 확신도 | 의존 |
|---|---|---|---|---|
| 0 | root Step 0 백업 | — | HIGH | — |
| 1 | designer: Composer 클립·대기 줄·드롭 오버레이·이미지 격자·파일 카드(참조 이미지) · 목록 미리보기 | 설계 메모 | MED | — |
| 2 | BE: 버킷 생성(Dev MCP) → SQL 96 → `attachments.server.ts` → Route 5 + messages 확장 → 알림 요약 → 로그 3 action → **Checkpoint 1**(AC-05~09·11·13·14 curl) | API | MED | 0 |
| 3 | FE: 업로드 훅(prepare → 병렬 업로드 → ids) · 클립·드롭존·대기 줄 · `use-send-message` 확장(재시도 재사용) | 전송 | MED | 2 |
| 4 | FE: 이미지 격자 + lightbox · 파일 카드 · 목록 미리보기 · 테마 | 표시 | HIGH | 3 |
| 5 | verifier: fixtures · spec · cleanup · 테마 20조합 · 회귀 `e2e/quick-chat` | green | MED | 4 |

**추정:** 신규 약 14파일 · 수정 약 12파일 · +1,400/−120줄 · **Complex** · 약 8~11시간. Checkpoint 1 = 2단계 직후, Checkpoint 2 = 3단계 직후(AC-01·02·10).

---

## requirements-pipeline Express (Phase 3)

### 가정

| ID | 가정 | 출처 |
|----|------|------|
| A1 | 형식 이미지+pdf+문서+zip · 10MB · 30개 · 보존 없음 | 사용자 답변 Q4 |
| A2 | 파일 카드는 참조 이미지(클립·파일명·확장자·다운로드) | 사용자 20 |
| A3 | 계약서 첨부 방식(2단계 서명 URL)을 그대로 재사용 가능 | 53 |
| A4 | 72 lightbox가 임의 서명 URL 이미지·PDF를 받을 수 있다 | 정찰 **[INFERRED · 4단계 확인]** |
| A5 | 잠금 해제(94)로 승인·취소 건에도 첨부 가능 | 94 D-12 |

### 검증 시나리오

| 시나리오 | 기대 |
|----------|------|
| 사진+문서 전송 | 썸네일·카드·DB 2행(AC-01) |
| 드래그 | 오버레이·전송(AC-03) |
| 제한 | 용량·형식·개수 toast + 400(AC-04·05) |
| 권한 | 타인 404 · 구매물류 읽기만(AC-07·08·13·14) |
| 실패 재시도 | 재업로드 없이 ids 재사용(AC-10) |

---

## 구현 팀 전달 메모

### designer
- 클립 버튼·대기 줄·드롭 오버레이·이미지 격자(+N)·파일 카드(참조 이미지 레이아웃)·목록 미리보기. 테마 토큰만.

### backend-dev
- 버킷(Dev MCP) → SQL 96(테이블·RLS·RPC 확장·body CHECK) → `attachments.server.ts`(allowlist·prepare·verify·link·signed URL) → Route 5 + messages 확장 → 알림·미리보기 요약 → 로그 3 action(파일명 금지).

### frontend-dev
- `use-attachment-upload`(prepare → 동시 3 업로드 → 진행률 → ids) · Composer 클립 + 드롭존 + 대기 줄 · `use-send-message`(optimistic 썸네일 · 실패 시 ids 재사용) · 이미지 격자 + 72 lightbox · 파일 카드 · 목록 미리보기.

### verifier
- fixtures 6종 · `setInputFiles`·`dispatchEvent('drop')` · 302 Location 판정 · DB 행·로그 metadata(파일명 0) · cleanup에 Storage 객체 삭제 · 테마 20조합.

---

## 열린 질문

| # | 질문 | 기본값 |
|---|---|---|
| OQ-1 | 고아 객체 정리 cron 시점 | 후속 plan [TBD] |

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-10-27 | 최초 작성 · Approved(/root 단일 게이트 · Q4 답변 + brief 11·20). 비공개 버킷 + 2단계 서명 URL(53 재사용) · 10MB·30개·형식 allowlist · pending→연결 RPC · 드래그앤드롭·클립·대기 줄 · 이미지 격자+72 lightbox · 파일 카드(참조 이미지) · 알림 요약 · 로그 3 action(파일명 금지) · SQL 96 · AC 22 | planner |
| 2026-10-28 | **Completed** — verifier: `e2e/quick-round2/98-attachments-{api,upload,view,theme,grep}.spec.ts` 45 green(AC 22 전부) · 회귀 quick-chat/workflow/request/round2 green(기존 notes.api AC-12만 제외) · tsc·lint:strict·build 0 · cleanup remaining 0(첨부 행·Storage 객체 0). **AC-04 fixture 메모:** 확장자 검사가 용량보다 먼저(`classifyQuickChatAttachment` · FE·서버 동일)라 `big-11mb.bin`은 「형식」 toast가 뜬다 → 기획 의도(용량 거부)대로 허용 확장자 **`big-11mb.zip`**(`PK` 시그니처 + 11MiB)으로 판정(기획 변경 없음). 부수 수정: `log.server.ts` 숫자 metadata 분기에 `total_bytes`·`attachment_id` 추가(allowlist에만 있고 누락되던 것 · AC-19) · 93 spec `bodyRequired` 문구 → AC-09 문구 · 94 AC-25 KNOWN action에 첨부 2종 추가 · fixtures는 `e2e/fixtures/`(.gitignore)에 테스트 시작 시 생성 | verifier |
