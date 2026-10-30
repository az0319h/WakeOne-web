# 퀵 채팅 AI 답장 추천(Claude Haiku · 빠른 답장 칩 4개 · 규칙 fallback) 기획서

> Date: 2026-10-27
> Status: Completed
> Author: planner
> **퀵 2차(94~101) 중 8번째(실행 순서 기준 · 마지막).** 선행: [99](./99_quick-place-keyword-search-plan.md) 완료 후 · **사용자가 `ANTHROPIC_API_KEY`를 제공한 뒤 착수**(키 없으면 Approved 대기). [93](./93_quick-request-chat-plan.md) 빠른 답장 칩·[98](./98_quick-chat-attachments-plan.md) 첨부·[101](./101_quick-chat-participants-plan.md) 참여자 역할을 전제
> **SQL 예정:** `supabase/sql/97_quick_chat_ai_usage.sql`(앞 plan 번호에 따라 당겨질 수 있음 · 적용 직전 최대+1). Dev DB만
> **brief 항목:** 13(답장 추천 AI)
> **Supersedes:** [93](./93_quick-request-chat-plan.md) C-14의 「고정 문구만」 → AI 추천 4개가 있으면 그것으로 **대체**, 없으면 고정 문구 유지(채우기만 규칙은 유지)
> **선행:** [08](./08_activity-audit-log-plan.md), [60](./60_legal-docs-alignment-plan.md), [81](./81_kanban-google-tasks-plan.md), [90](./90_quick-dashboard-permission-info-plan.md), [93](./93_quick-request-chat-plan.md), [94](./94_quick-realtime-and-small-fixes-plan.md), [98](./98_quick-chat-attachments-plan.md), [101](./101_quick-chat-participants-plan.md)

## 선행 plan 참조 (Phase 0)

| Plan | Status | 관계 |
|------|--------|------|
| **93** | Completed | 칩 컴포넌트(`quick-chat-quick-replies.tsx`)·`QUICK_CHAT_QUICK_REPLIES[role]`·`GET …/messages` 응답 `quickReplies`를 확장. 「칩은 입력창에 채우기만」(C-14)은 **유지** |
| **94** | Approved | 상대 메시지 도착 신호(Broadcast)를 추천 호출 트리거로 쓴다 |
| **98 · 101** | Approved | 첨부만 있는 메시지는 본문 대신 「(파일 첨부)」로 모델에 전달 · 참여자 역할 `participant`도 추천 대상 |
| **90** | Completed | 「퀵 권한 안내」 ⓘ에 AI 전송 안내 1줄 추가 |
| **60** | Approved | 개인정보처리방침에 「외부 AI 전송」 1항 추가(Anthropic · 답장 추천 목적 · 대화 일부 · 연락처 마스킹) |
| **81** | Approved | `E2E_*_MOCK` 플래그 패턴 → `E2E_ANTHROPIC_MOCK=1` |
| **08** | Approved | 추천 Route는 외부 전송 + 사용량 카운터 증가(CUD) → **전 분기 로그**(본문 금지) |

### 정찰로 확인한 사실

| 항목 | 사실 | 근거 |
|------|------|------|
| 칩 | `quickReplies: string[]`를 서버가 역할별 고정 상수로 내려주고 FE가 칩으로 렌더 · 클릭 시 `handlePickReply`(입력창 채움) | `messages.server.ts:242` · `quick-request-conversation.tsx:122` |
| SDK | 프로젝트에 `@anthropic-ai/sdk`·다른 LLM 의존성 없음 | `package.json` grep |
| 모델 | 사용자 지정 「가장 저렴한 Haiku」 = **`claude-haiku-5-5`**($0.10 / $0.50 per MTok · 100K 이하 프롬프트) · adaptive thinking 기본 ON · `output_config.effort` 기본 `medium` · 구조화 출력 `output_config.format` · prefill 불가 | claude-api 스킬(2026-10-06 캐시) |
| 모바일 민감 정보 | 메시지에 전화번호·주소가 섞일 수 있음 → 전송 전 마스킹 필요 | 93 · 98 |

---

## 한 줄 요약

상대가 메시지를 보내면 **대화 맥락(최근 10개 · 연락처·주소 마스킹)**을 서버가 Claude Haiku에 보내 **답장 후보 4개**를 받아 빠른 답장 칩에 넣는다. 칩을 누르면 **입력창에만 채워지고** 바로 보내지지 않는다. 키가 없거나 꺼 두었거나(`QUICK_CHAT_AI_SUGGEST`) 실패·한도 초과면 **기존 규칙 칩**이 그대로 나온다. 사용자당 **하루 100회**까지이며, 「퀵 권한 안내」와 개인정보처리방침에 외부 AI 전송 사실을 적는다.

---

## 정책 확정안 (deep-interview Q5 · brief 13)

| # | 항목 | 확정 |
|---|------|------|
| D-1 | 켜기·끄기 | env `ANTHROPIC_API_KEY` **+** `QUICK_CHAT_AI_SUGGEST=1` 둘 다 있을 때만 ON(`isChatAiSuggestEnabled()`). 하나라도 없으면 Route 503 · `GET …/messages` 응답 `aiSuggest:{enabled:false}` · FE는 호출하지 않음. 언제든 env만 바꿔 제거 가능 |
| D-2 | 호출 시점 | **자동**: ① 대화가 열려 있고(탭 활성) ② `canWrite` ③ 마지막 메시지가 **남이 보낸 것**이고 ④ 그 메시지 id로 아직 추천을 받지 않았을 때 — 새 메시지 수신(Realtime invalidate 후 데이터 갱신) 또는 대화 처음 열 때 1회. 내가 보낸 뒤에는 호출하지 않음. 버튼 방식 Out(사용자 Q5) |
| D-3 | 개수·형식 | 추천 **4개**(사용자 Q5). 각 **40자 이내 한국어 존댓말 완결 문장**, 서로 다른 의도(수락·거절/불가·질문·안내 등). 이모지 금지. 전화번호·주소·금액 **생성 금지**(모델 지시 + 서버 후처리 필터: 숫자 7자리 이상 포함 시 제거). 4개 미만이면 규칙 칩으로 채워 항상 4개 |
| D-4 | 입력 | 최근 메시지 **10개**(오래된 순 · 각 `역할(요청자/동방특송/관리자/참여자)`·본문 300자 클립 · 첨부만이면 「(파일 첨부)」) + 요청 상태(신규요청/접수/배차완료/승인/취소) + 보는 사람 역할. **마스킹**: 전화(`0\d{1,2}-?\d{3,4}-?\d{4}`→`[연락처]`), 도로명/지번 패턴(`\S+(시|도)\s\S+(구|군|시)\s\S+`)→`[주소]`, 이메일→`[이메일]`, 이름은 역할로 대체(이름 미전송). 요청번호·금액은 보냄(업무 맥락) |
| D-5 | 모델 호출 | `@anthropic-ai/sdk` · `client.messages.create({ model: 'claude-haiku-5-5', max_tokens: 512, output_config: { effort: 'low', format: {JSON schema: {suggestions: string[4]}} }, system: SYSTEM_PROMPT(고정 · `cache_control` ephemeral), messages: [user: 대화 JSON] })` · timeout **6초** · 재시도 0(SDK 기본 retry 2 → `maxRetries: 0`) · `stop_reason === 'refusal'`·파싱 실패 → 규칙 칩. 모델 ID는 **정확히 `claude-haiku-5-5`**(날짜 접미사 금지) |
| D-6 | 한도 | 사용자당 **KST 하루 100회**(~~성공 호출만 카운트~~ → **Anthropic 호출 직전에 +1 = AI까지 간 호출을 센다 · 성공·실패 무관** · 2026-10-28 root 결정 · 수정 이력 참조). 테이블 `quick_chat_ai_usage(user_id, day date, count)` + RPC `increment_quick_chat_ai_usage(p_user) returns int`(원자 upsert). 100 초과 → Route **429** `{reason:'limit'}` 조용히 규칙 칩(에러 토스트 없음). admin 포함 동일 한도 |
| D-7 | 캐시·중복 | FE React Query 키 `aiSuggestions(requestNo, lastMessageId, role)` `staleTime Infinity`(같은 메시지에 재호출 없음). 서버는 중복 방지 없음(FE 책임 · 탭 2개면 2회 가능 · 수용) |
| D-8 | UI | 칩 줄 구조 유지(93 U-6). AI 추천이 오면 칩 4개 **교체**(규칙 칩은 숨김) + 줄 앞에 작은 `Badge variant='outline'` **「AI 추천」** + tooltip 「대화 내용을 바탕으로 AI가 제안한 문장입니다. 보내기 전에 확인하세요.」 · 로딩 중에는 규칙 칩 그대로(레이아웃 점프 없음 · 스켈레톤 없음) · 실패·한도·OFF는 규칙 칩(표시 차이 없음) · 칩 클릭 = 입력창 채움(C-14) |
| D-9 | 안내 | ① 90 ⓘ 「할 수 있는 일」에 1줄: 「답장 추천: 대화 내용 일부(연락처·주소 가림)가 답장 문장 추천을 위해 외부 AI(Anthropic)에 전송됩니다. 추천은 참고용이며 보내기 전에 확인하세요.」 ② 개인정보처리방침(plan 60 파일)에 「처리 위탁/국외 이전」 항목으로 Anthropic(미국) · 목적 · 항목(대화 본문 일부, 마스킹) · 보유(저장 안 함 · Anthropic API 기본 보존 정책 링크) 추가. 별도 동의 체크박스 **없음**(사용자 Q5) |
| D-10 | 로그 | `POST …/messages/suggest` **전 분기** `quick_request.chat_ai_suggest`(라벨 「퀵 대화 답장 추천」) · metadata `{quick_request_no, source:'ai'\|'rules', message_count, latency_ms, input_tokens, output_tokens, error_code}` · **본문·추천 문장 금지** |
| D-11 | 비용 | 호출당 입력 ≈ 700 토큰·출력 ≈ 120 토큰 → ≈ **$0.00013** · 100회/일 × 10명 ≈ $0.13/일 · 월 ≈ $4 **[INFERRED · 측정 후 수정 이력에 기록]**. 상한은 D-6 |
| D-12 | E2E | `E2E_ANTHROPIC_MOCK=1`이면 SDK를 호출하지 않고 fixture 4문장(`e2e/fixtures/ai-suggestions.json`) 반환 · `E2E_ANTHROPIC_MOCK=fail`이면 502 · 미설정 AC는 env 제거 project(91·99 패턴) |

---

## 목표 & 완료 기준 (AC)

공통: 계정 `user.json`·`dongbang.json`·`dongbang2`·`logistics.json`. mock run.

| AC | 유형 | 전제 | 동작 | 기대 |
|----|------|------|------|------|
| AC-01 | Playwright (2 context) | ON(mock) · `user.json` 본인 건 대화 열어 둠 · 칩 3개(규칙) | `dongbang.json` 「40분 뒤 가능할까요?」 전송 | 5초 안에 요청자 칩이 **4개**(fixture 문장) · 배지 **「AI 추천」** · `POST …/messages/suggest` **1회** · 칩 클릭 → 입력창에 문장 · 전송 요청 0(채우기만) |
| AC-02 | Playwright | 〃 · 요청자가 답장 전송 | 전송 후 | 칩이 규칙 3개로 복귀 · suggest 호출 **0**(내 메시지엔 호출 안 함) · 다시 상대 메시지 → 1회 |
| AC-03 | Playwright | 대화 처음 열기 · 마지막 메시지가 상대 | 열기 | 1회 호출 · 새로고침 후 같은 lastMessageId면 **재호출 0**(캐시) |
| AC-04 | API | `user.json` | `POST …/messages/suggest` 유효 | **200** `{suggestions:[4], source:'ai', lastMessageId}` · 각 ≤ 40자 · `x-request-id` |
| AC-05 | API | `user.json` · 메시지에 `010-1234-5678`·`서울 강남구 테헤란로 1` 포함 · mock이 **받은 prompt를 echo**(`E2E_ANTHROPIC_MOCK=echo`) | 호출 | 응답 `debugPrompt`(mock 전용)에 `[연락처]`·`[주소]` 포함 · 원문 숫자·주소 **0** · 보낸 사람 이름 0(역할만) · 메시지 ≤ 10개 |
| AC-06 | API | `logistics.json` 타인 건 / `user2.json` | suggest | **403** / **404** |
| AC-07 | API·DB | `user.json` · usage 99로 fixture | 2회 호출 | 1번째 200(count 100) · 2번째 **429** `{reason:'limit'}` · FE는 규칙 칩 유지·토스트 0 · KST 자정 넘긴 day에는 다시 200(fixture day 변경) |
| AC-08 | API | `E2E_ANTHROPIC_MOCK=fail` | 호출 | **502** 「답장 추천을 불러오지 못했습니다.」 · FE 규칙 칩 유지 · 토스트 0 · 로그 502 행 |
| AC-09 | API·Playwright | OFF(`QUICK_CHAT_AI_SUGGEST` 없음 · 별도 project) | `GET …/messages` · 대화 열기 · suggest | `aiSuggest.enabled=false` · 칩 규칙 3/4개 · suggest 호출 0 · 직접 호출 시 **503** 「답장 추천이 꺼져 있습니다.」 **[verifier: project 불가 시 수동 QA 이관]** |
| AC-10 | API·로그 | AC-04·07·08 이후 | `GET /api/activity-logs?action=quick_request.chat_ai_suggest` | 200·429·502 행 · metadata `source`·`message_count`·`latency_ms`·토큰 · **본문·추천 문장 0** |
| AC-11 | Playwright | `user.json` · 90 ⓘ · `/legal/privacy`(또는 해당 경로) | 열기 | ⓘ에 **「답장 추천: …외부 AI(Anthropic)…」** 1줄 · 처리방침에 「Anthropic」·「답장 추천」 포함 |
| AC-12 | grep | 구현 완료 | `grep -rn "claude-haiku-5-5" src` · `grep -rn "ANTHROPIC_API_KEY" src` · `grep -rn "claude-haiku-5-5-20" src` | 모델 ID는 `ai-suggest.server.ts` 1곳 · 키는 서버 파일만 · 날짜 접미사 0 · `NEXT_PUBLIC_ANTHROPIC` 0 |
| AC-13 | 단위 | — | `maskChatForAi()` · `sanitizeSuggestions()` | 전화·주소·이메일 마스킹 4케이스 · 숫자 7자리↑ 문장 제거 · 40자 클립 · 4개 보정 |
| AC-14 | Playwright | 375 · 칩 4개 | 대화 | 칩 줄 가로 스크롤 · 배지 포함 높이 변화 없음 · 터치 ≥ 44px |
| AC-15 | 수동 QA | 실제 키 · dev 배포 | 동방 메시지 수신 → 칩 확인 → 하나 선택 → 수정 → 전송 | 2초 안 추천 · 문장 자연스러움 · 비용 대시보드(Anthropic Console) 호출 1건 · 측정값 수정 이력 기록 |
| AC-16 | CLI | — | `npx tsc --noEmit` · `npm run lint` · `npm run build` · `node --test src/features/quick-request/lib/__tests__/ai-*.test.mjs` · `npx playwright test e2e/quick-chat e2e/quick-round2/100-*` | 통과 |

**AC 총 16개**(수동 QA 1).

---

## 범위 (In / Out)

### In
1. `npm i @anthropic-ai/sdk` · env 2종(`env.example.txt`)
2. **SQL 97**: `quick_chat_ai_usage` + RPC(service_role 전용) + RLS(본인 SELECT)
3. `src/features/quick-request/api/ai-suggest.server.ts`(마스킹·프롬프트·호출·후처리·mock·한도) · `lib/ai-mask.ts`·`lib/ai-sanitize.ts`(순수 함수 + 단위 테스트) · Route `POST …/messages/suggest` · `GET …/messages` 응답 `aiSuggest`
4. FE: `use-ai-suggestions.ts`(트리거 조건 D-2 · React Query) · 칩 교체 + 「AI 추천」 배지 · 규칙 fallback
5. 안내 문구 2곳(90 ⓘ · 처리방침)
6. 로그 action 1 + 라벨 · metadata allowlist
7. E2E mock(3모드) · spec · 미설정 project
8. README 100 · 93/90/60 수정 이력

### Out
| 항목 | 이유 |
|------|------|
| 버튼으로 수동 호출 | 사용자 Q5(자동) |
| 추천 문장 자동 전송 | 오발송 방지(93 C-14) |
| 스트리밍·thinking 표시 | 짧은 출력 · 불필요 |
| 사용자별 ON/OFF 설정 UI | env 전역 토글만(이상하면 제거 가능) · 후속 |
| 대화 요약·자동 상태 변경·번역 | 범위 밖 |
| 첨부 파일 내용 전송 | 「(파일 첨부)」만 |
| 별도 동의 체크박스 | 사용자 Q5 |
| Vercel env·Main DB | 사용자 수동 |

---

## UI 요구사항 (designer 지시)

| # | 화면 | 요구 |
|---|------|------|
| U-1 | 칩 줄 | 기존 가로 스크롤 줄 유지. 맨 앞 `Badge variant='outline'` 「AI 추천」(`Icons.sparkles` 있으면 아이콘 · 없으면 텍스트만 · `icons.tsx` 추가 허용) + `Tooltip`(D-8). 칩 4개 `Button variant='outline' size='sm'` · 긴 문장은 `max-w-[16rem] truncate` + tooltip 전체 문장 |
| U-2 | 상태 | 로딩·실패·OFF 모두 규칙 칩 그대로(시각 차이 없음) · 레이아웃 점프 0 |
| U-3 | ⓘ·처리방침 | 90 `DescriptiveSection` 항목 1줄 · 처리방침 섹션 1항(기존 스타일) |

---

## API / DB 요구사항

### SQL — `supabase/sql/97_quick_chat_ai_usage.sql`

```sql
create table public.quick_chat_ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  count int not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.quick_chat_ai_usage enable row level security;
create policy quick_chat_ai_usage_select_own on public.quick_chat_ai_usage for select to authenticated using (user_id = auth.uid());
revoke all on public.quick_chat_ai_usage from anon, authenticated; grant select on … to authenticated; grant all on … to service_role;
create or replace function public.increment_quick_chat_ai_usage(p_user uuid, p_day date, p_limit int) returns int
language plpgsql security invoker set search_path = '' as $$
declare v int;
begin
  insert into public.quick_chat_ai_usage (user_id, day, count) values (p_user, p_day, 1)
  on conflict (user_id, day) do update set count = public.quick_chat_ai_usage.count + 1, updated_at = now()
  where public.quick_chat_ai_usage.count < p_limit
  returning count into v;
  return v;   -- null이면 한도 초과(증가 안 함)
end $$;
revoke all on function public.increment_quick_chat_ai_usage(uuid, date, int) from public, anon, authenticated;
grant execute on function public.increment_quick_chat_ai_usage(uuid, date, int) to service_role;
-- 롤백: drop function · drop table
```

### Route

| Method · Path | 권한 | 동작 | 응답 |
|---|---|---|---|
| `POST /api/quick-request/[no]/messages/suggest` `{lastMessageId}` | 쓰기 권한(요청자·동방·admin·참여자) | OFF → 503 · 권한 → 403/404 · `lastMessageId`가 그 건 마지막 메시지이고 **남의 메시지**인지 확인(아니면 409 「추천할 새 메시지가 없습니다.」) · 한도 RPC(null → 429) · 마스킹 → Haiku 호출(6초) → 후처리 → 4개 보정 | 200 `{suggestions:[4], source, lastMessageId, usage:{count, limit}}` · 400·401·403·404·409·429·502·503 |
| `GET …/messages` | 기존 | `aiSuggest:{enabled:boolean}` 추가 | — |

### 호출 (`ai-suggest.server.ts`)

```ts
import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0, timeout: 6_000 });
const res = await client.messages.create({
  model: 'claude-haiku-5-5',
  max_tokens: 512,
  system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
  output_config: { effort: 'low', format: { type: 'json_schema', schema: SUGGESTIONS_SCHEMA } },  // {suggestions: string[4]}
  messages: [{ role: 'user', content: JSON.stringify({ status, viewerRole, messages: masked }) }]
});
// stop_reason === 'refusal' → rules · content[0].type === 'text' → JSON.parse → sanitize
```

- `output_config.format` 정확한 형태는 구현 시 claude-api 스킬 `typescript/claude-api/tool-use.md` §Structured outputs를 **다시 읽고** 맞춘다(스킬 지시 · 추측 금지).
- SYSTEM_PROMPT(고정 · 한국어): 역할(퀵 배송 업무 채팅 답장 보조) · 4개 · 40자 · 존댓말 · 서로 다른 의도 · 연락처·주소·금액 생성 금지 · 이모지 금지 · 상대 역할 고려(요청자↔동방특송).

---

## 활동 감사 로그 (기록 연동)

> `core-conventions.mdc` §활동 감사 로그 · [plan 08](./08_activity-audit-log-plan.md)

| Route | action | 라벨 | target | return 분기 | metadata allowlist |
|---|---|---|---|---|---|
| `POST …/messages/suggest` | `quick_request.chat_ai_suggest` | 퀵 대화 답장 추천 | `quick_request` / `{no}` | 200·400·401·403·404·409·429·502·503·500 | `quick_request_no`·`source`·`message_count`·`latency_ms`·`input_tokens`·`output_tokens`·`error_code` |

- 외부 전송이 있는 호출이라 **성공·실패 모두 기록**(추적성). 본문·추천 문장·마스킹 전 데이터 금지. 검증 **AC-10**. 삭제 UI 없음.

---

## 영향 파일 & 패턴

| 팀 | 파일 |
|---|---|
| BE | `package.json`(`@anthropic-ai/sdk`) · `supabase/sql/97_quick_chat_ai_usage.sql` · `src/features/quick-request/api/ai-suggest.server.ts`(신규) · `lib/{ai-mask,ai-sanitize}.ts`(신규) · `lib/__tests__/ai-*.test.mjs` · `src/app/api/quick-request/[requestNo]/messages/suggest/route.ts`(신규) · `api/messages.server.ts`(`aiSuggest`) · `schemas/quick-request-chat.ts`(suggest body) · `src/features/activity-logs/api/{types,log.server}.ts` · `labels.ts` · `env.example.txt` |
| FE | `components/chat/{use-ai-suggestions.ts(신규), quick-chat-quick-replies.tsx, quick-request-conversation.tsx, quick-chat-constants.ts}` · `api/{service,queries,keys,types}.ts` · `src/features/quick-request/info-content.ts` · 처리방침 파일(plan 60 경로) · `src/components/icons.tsx`(선택) |
| verifier | `e2e/fixtures/ai-suggestions.json` · `e2e/quick-round2/100-ai-suggest*.spec.ts` · `playwright.config.ts`(mock env · 미설정 project) |

**패턴:** 81 mock 플래그 · 91 AC-20 미설정 project · 93 칩/채우기 · `jsonWithActivityLog` · claude-api 스킬(TypeScript README · tool-use.md 구조화 출력).

---

## 리스크 & 완화

| 등급 | 리스크 | 완화 |
|---|---|---|
| HIGH | 개인정보(연락처·주소·이름)가 외부로 나감 | 서버 마스킹(순수 함수 + 단위 테스트) · 이름 미전송 · 첨부 미전송 · 처리방침·ⓘ 고지 · echo mock으로 AC-05 판정 |
| HIGH | 추천이 틀린 사실(금액·시간)을 만들어 오발송 | 채우기만(C-14) · 숫자 7자리↑ 제거 · 「AI 추천」 배지·tooltip · 금액·주소 생성 금지 지시 |
| MED | 비용 폭주 | 사용자당 100회/일 원자 카운터 · FE 캐시(lastMessageId) · effort low · 모니터링(로그 토큰) |
| MED | 지연(6초 timeout)으로 칩이 늦게 바뀜 | 규칙 칩 선표시 · 교체 시 레이아웃 불변 · 실패 조용히 |
| MED | SDK `output_config.format` 형태 오기 | 구현 시 스킬 문서 재확인(추측 금지) · tsc |
| LOW | `refusal`·파싱 실패 | 규칙 칩 fallback · 로그 `error_code` |

**롤백:** env 제거(즉시 OFF) → Route·훅 제거 · SQL drop.

---

## Battle Plan (단계)

| # | 단계 | 산출물 | 확신도 | 의존 |
|---|---|---|---|---|
| 0 | 키 수령 확인 · root Step 0 백업 | — | HIGH | 키 |
| 1 | designer: 「AI 추천」 배지·칩 4개·tooltip · ⓘ·처리방침 문구 위치 | 설계 메모 | HIGH | — |
| 2 | BE: SDK 설치 → 마스킹·후처리 순수 함수 + 단위 테스트 → SQL 97 → `ai-suggest.server.ts`(mock 3모드) → Route → 로그 → `aiSuggest` 플래그 → **Checkpoint 1**(curl AC-04~08) | API | MED | 0 |
| 3 | FE: 트리거 훅 · 칩 교체 · 배지 · 안내 문구 2곳 | UI | HIGH | 2 |
| 4 | verifier: fixture 3모드 · spec · 미설정 project · 단위 · 회귀 `e2e/quick-chat` → 수동 QA AC-15 사용자 전달 | green | MED | 3 |

**추정:** 신규 9파일 · 수정 12파일 · +750줄 · **Medium~Complex** · 약 4~6시간.

---

## requirements-pipeline Express (Phase 3)

### 가정

| ID | 가정 | 출처 |
|----|------|------|
| A1 | 자동 호출 · 4개 · 100회/일 · 안내 문구 1줄 · 체크박스 없음 | 사용자 답변 Q5 |
| A2 | 모델은 Haiku 최신(`claude-haiku-5-5`) | 사용자 「가장 저렴한 Haiku」 · 스킬 모델표 |
| A3 | 마스킹 후 전송은 업무용 범위에서 허용된다(처리방침 고지로 충분) | 사용자 Q5 **[INFERRED: 법무 검토는 사용자 몫]** |
| A4 | 비용 ≈ $4/월 | D-11 추정 |

### 검증 시나리오

| 시나리오 | 기대 |
|----------|------|
| 상대 메시지 수신 | 칩 4개 교체·채우기만(AC-01) |
| 내 메시지 후 | 호출 없음(AC-02) |
| 마스킹 | echo mock에 원문 0(AC-05) |
| 한도·실패·OFF | 규칙 칩 조용히(AC-07~09) |

---

## 구현 팀 전달 메모

### designer — 배지·tooltip·칩 4개·안내 문구 위치.
### backend-dev — **claude-api 스킬 `typescript/claude-api/{README,tool-use}.md`를 읽고** 구조화 출력 형태를 맞춘다 · 모델 `claude-haiku-5-5` 정확히 · `maxRetries:0`·timeout 6초 · 마스킹·후처리 순수 함수 + 테스트 · 원자 카운터 RPC · mock 3모드 · 전 분기 로그(본문 금지).
### frontend-dev — 트리거 조건 4개(D-2) · 캐시 키 lastMessageId · 칩 교체 + 배지 · 실패 조용히 · ⓘ·처리방침 1줄씩.
### verifier — mock `1`/`fail`/`echo` · 한도 fixture(usage 99) · 미설정 project(불가 시 수동 QA) · 로그 본문 0 · 수동 QA AC-15.

---

## 열린 질문

| # | 질문 | 기본값 |
|---|---|---|
| OQ-1 | 실측 비용·지연이 추정과 크게 다르면 | 수정 이력 기록 · 한도 조정은 사용자 결정 |

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-10-27 | 최초 작성 · Approved(/root 단일 게이트 · Q5 답변 + brief 13). 자동 호출(상대 메시지 도착) · `claude-haiku-5-5` · 추천 4개 · 마스킹(연락처·주소·이메일·이름) · 사용자당 100회/일 원자 카운터(SQL 97) · env 2종 토글 · 규칙 칩 fallback · 「AI 추천」 배지 · ⓘ·처리방침 고지 · 로그 전 분기(본문 금지) · mock 3모드 · AC 16. **키 도착 후 착수** | planner |
| 2026-10-28 | **D-6 수정(root 결정)**: 카운터는 「성공 호출만」이 아니라 **Anthropic 호출 직전에 증가**(AI까지 간 호출 = 1회 · 성공·실패·mock 무관 · 원자적 한도 보장). 409·400·403·404·503은 호출 전이라 세지 않음. AC-07(99 → 200 count 100 → 429)은 그대로 통과. SQL 번호는 **98**(`98_quick_chat_ai_usage.sql` · 97은 plan 101이 사용). 구현 메모: Haiku 5.5는 adaptive thinking이 기본이고 thinking이 `max_tokens`에 포함되므로 `max_tokens` 512 → **1024**(claude-api 스킬). 실측(dev · 실키 2회 · 메시지 2개): latency **2,733 / 2,345 ms**(모델 호출만) · 입력 **1,142** 토큰(캐시 포함 합계) · 출력 **139~140** 토큰 → 호출당 ≈ **$0.00018**(D-11 추정 $0.00013보다 약간 큼 · 100회/일 × 10명 ≈ $0.18/일 · 월 ≈ $5.5). AC-15 「2초 안」은 실측 2.3~2.7초로 **약간 초과**(OQ-1 · 사용자 판단) | backend-dev |
| 2026-10-28 | **verifier — Completed** (99+100 통합 검증). spec `e2e/quick-round2/100-*` 6개 — mock 서버 AC-01·02·03·04·06·07(API·FE)·10(200·429)·14 + Route 409·400 보조 · echo 서버 AC-05 · fail 서버 AC-08(API·FE)·10(502) · OFF(기본) 서버 AC-09·10(503) · 모드 무관 AC-11·12 + 색 grep **전부 green** · AC-13 `node --test` ai-* 30/30 · AC-16 CLI(tsc·lint:strict·build·`e2e/quick-chat`) 통과. AC-15 수동 QA는 사용자 이관 — mock 기준 「2초 안」 충족, 실키 실측 2.3~2.7초(backend-dev)는 OQ-1 **사용자 결정 대기**. spec 보정: AC-07(FE)은 FE가 non-OK 본문 스트림을 `cancel()`하므로 브라우저에서 `reason` 본문을 읽지 않고 그날 한도 플래그(sessionStorage)로 판정 · 94 AC-25 action 허용 목록에 `quick_request.chat_ai_suggest` 추가. 구현 수정 없음 | verifier |
| 2026-10-29 | [106](./106_quick-mobile-restructure-plan.md): D-8 칩 줄 — 휴대폰(lg 미만)에서 입력칸에 글자가 있으면 숨김(비면 다시 보임). PC 불변 | planner |
