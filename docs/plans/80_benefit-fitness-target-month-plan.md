> Date: 2026-10-14
> Status: Approved
> Author: planner (/root · deep-interview → battle-plan `go`)

# 복지비 — 체력증진비 「해당 월」 기준 월 구분

## 한 줄 요약

Flex 체력증진비 양식의 **「해당 월 (ex. 9월)」** 원문을 import에서 받아 관대하게 파싱(연도 = 문서 작성일 연도)해 `benefit_documents.benefit_month`에 저장하고, 조회·월 한도 집계는 generated 컬럼 **`attributed_month`(귀속 월)** 하나로 수행한다. 도서·외부교육과 해당 월이 없는 기존 체력증진비 행은 **작성일 월** 기준을 유지한다.

---

## 선행 plan 참조

| Plan | 관계 |
|------|------|
| **79** (Completed) | 조회 월 `BENEFITS_EARLIEST_MONTH='2026-10'` ~ KST 당월 · 범위 밖 → 당월 — **유지**. 79 Out이던 「집계 기준(`document_created_at`) 변경」을 **본 plan이 확장** |
| **73 / 74 / 76** | URL `month` · admin proxy · 인사팀 관리 — 동일 `listMonthDocuments` 경유로 **자동 적용**, 별도 변경 없음 |
| **75 / 79** | 명단 재직 윈도우 — **변경 없음** (문서 귀속 월과 무관) |
| **77** (Completed) | 취소 문서 합계 제외 — **유지**. 귀속 월만 바뀜 |
| **78** | import 알림 fan-out — **변경 없음**. 단 E2E helper(`benefit-notifications.ts`)의 fitness payload 수정 필요 (§E2E) |
| **08** | import Route 전 분기 activity log — **유지** · 신규 action 없음 · metadata allowlist 키 2개 추가 |
| **49** | `/dashboard/benefits`, `/dashboard/my-benefits`는 `dashboard/layout` 하위 → `DashboardPresenceTrack` **상속** (별도 track 없음) |

SQL 기준선: `73_benefit_budget.sql`(테이블) · `76_benefit_document_cancel.sql`(취소 컬럼). 송신 측 `Wake-Automation-main/.../gmail-benefit-automation/main.py` 로컬 사본은 **참고만** (수정 금지 · 사용자 최신본과 다를 수 있음).

### 번호 확인 근거 (2026-10-14)

| 항목 | 확인 | 결과 |
|------|------|------|
| plan | `docs/plans/` 목록 · README 표 · `git log --all --name-only -- docs/plans` · stash 3개 | 최대 **79** → **80** |
| SQL | `supabase/sql/` 목록 · `git log --all -- supabase/sql` · `git branch -a`(13개) · stash 3개 · `git status` clean · dev `list_migrations` 최신 `77_notifications_benefit_types` · 워크스페이스 `**/78_*` | 최대 **77**. 78은 사용자가 삭제한 main seed 번호라 **건너뛰고 79 사용** (사용자 지시 2026-10-14) → **79** |

---

## 정책 확정 (deep-interview · battle-plan `go`)

| # | 결정 |
|---|------|
| Q1 | 필드 형식은 **웹이 정한다** — 자동화는 Flex 원문 문자열을 그대로 보내고 웹이 관대하게 파싱 |
| Q2 | 연도는 **무조건 `document_created_at`의 연도** |
| Q3 | 적용은 **fitness만**. book·education은 작성일 월 유지 |
| Q4 | fitness는 해당 월 **필수** — 없음·파싱 불가 → **400 + activity log** (신규 문서에 한함, duplicate 우선) |
| Q5 | 조회 하한 **2026-10 유지** — 9월 귀속분은 화면·집계 미노출 |
| Q6 | 기존 문서 **그대로** (dev/main backfill·수정·삭제 없음). generated 컬럼의 자동 계산은 데이터 수정이 아님으로 **수용** |
| Q7 | 관리자·내 복지비 문서 행에 **「해당 월」 표시만 추가**. 날짜 열 통일 Out |
| 기본값 | Flex 원문 **미저장** · `9월분` 허용 · `2026-10` 등 연도 포함 형식은 **작성 연도와 같을 때만** 허용 · **duplicate 우선** · 화면 `yyyy-MM` |

---

## 목표 & 완료 기준

- **목표:** 체력증진비의 귀속 월을 Flex 「해당 월」로 결정하고, 조회·한도 집계·화면 표시에 반영한다.
- **완료 기준:** 아래 AC 전부 green · tsc · lint · build · `npm run e2e:cleanup` exit 0 · dev DB SQL 79 적용 · 기존 행 비-generated 값 변경 0건.

## 범위

### In

| # | 영역 |
|---|------|
| 1 | SQL `79_benefit_fitness_month.sql` — 컬럼 2개 · check · 인덱스 (**dev만** 적용) |
| 2 | 파싱 순수 함수 `parseBenefitMonth(raw, documentCreatedAt)` |
| 3 | `benefitImportSchema` · `POST /api/benefits/import` — `benefit_month` 수신 · fitness 검증 · duplicate 우선 · 400 로그 |
| 4 | `listMonthDocuments` 필터·정렬 `attributed_month` 전환 · 응답 타입에 `benefit_month`·`attributed_month` |
| 5 | 관리자·내 복지비 fitness 문서 행 「해당 월 yyyy-MM」 표시 · `@/lib/format-date` 월 포맷 함수 |
| 6 | activity log metadata allowlist `benefit_month`, `benefit_month_reason` 추가 |
| 7 | E2E helper 수정 + 신규 spec (`e2e/benefits/`) |

### Out

- 기존 dev/main 데이터 backfill·수정·삭제 (`2026-2699` "9월 체력증진비" 포함 — 작성 월 10월 귀속 유지)
- **main DB 적용** (배포 순서 §참조 — 별도 승인 후)
- Wake-Automation 레포 수정
- 날짜 열 통일(관리자 승인일 / 내 복지비 작성일 현행 유지)
- 조회 하한 변경 · book/education 기준 변경 · 알림 문구 변경 · Flex 원문 저장 · 기존 문서 해당 월 수정 UI

---

## 월 구분 최종 규칙

```
귀속 월(attributed_month) =
  benefit_type = 'fitness' AND benefit_month IS NOT NULL → benefit_month
  그 외 (book · education · 기존 fitness 행)          → document_created_at 이 속한 달 1일
```

- 조회(관리자·내 복지비·proxy·인사팀) 필터: `attributed_month >= {month}-01 AND attributed_month < 다음 달 1일` (기존 `monthRange` 재사용).
- 정렬: `attributed_month desc, document_created_at desc, id desc`.
- 한도 10만원·사용액·초과액·취소 제외 계산식 **변경 없음** — 어느 달 집합에 들어가느냐만 바뀐다.
- `resolveBenefitsViewMonth`·하한 `2026-10`·명단 윈도우 **변경 없음**.
- 예: 2026-10-14 작성 · 해당 월 `9` → 귀속 2026-09 → 하한 밖 → 화면·집계 미노출. 2026-11-02 작성 · `10` → 귀속 2026-10.

---

## DB 요구사항 — `supabase/sql/79_benefit_fitness_month.sql`

| 컬럼 | 타입 | 규칙 |
|------|------|------|
| `benefit_month` | `date` **null** | 체력증진비 해당 월(그달 1일). fitness 신규 import만 채움 · 기존 행·book·education은 null |
| `attributed_month` | `date` **generated always as (…) stored** · not null(식 결과상) | 조회·집계 기준 귀속 월 · 앱에서 insert/update 금지 |

**제약**
- `benefit_documents_benefit_month_first_day_check`: `benefit_month is null or extract(day from benefit_month) = 1`
- `benefit_documents_benefit_month_fitness_check`: `benefit_month is null or benefit_type = 'fitness'`

**generated 식 (immutable 필수)** — `date_trunc('month', <timestamptz>)`는 STABLE이라 사용 불가. `date → timestamp(without tz)` 캐스트 + `date_trunc(text, timestamp)`는 IMMUTABLE이므로 아래 1안을 우선하고, dev 적용 실패 시 2안. **backend-dev가 dev `apply_migration`으로 생성 성공·값 확인**한다.

```sql
-- 1안
attributed_month date generated always as (
  case
    when benefit_type = 'fitness' and benefit_month is not null then benefit_month
    else (date_trunc('month', document_created_at::timestamp))::date
  end
) stored

-- 2안 (date 산술)
    else document_created_at - (extract(day from document_created_at)::int - 1)
```

**인덱스** (기존 `document_created_at` 인덱스 2개는 유지)
- `idx_benefit_documents_attributed_month_type` on `(attributed_month desc, benefit_type)`
- `idx_benefit_documents_user_attributed_month` on `(applicant_user_id, attributed_month desc)`

**RLS·권한:** 기존 정책·revoke 그대로 (컬럼 추가만). 파일 상단 메타에 `Plan: 80_benefit-fitness-target-month-plan.md` · Status · **「웹 배포보다 먼저 적용」** 명시.

**기존 데이터:** stored generated 컬럼 추가 시 테이블 재작성으로 기존 행의 `attributed_month`가 자동 계산된다 — 기존 컬럼 값은 불변이며 사용자 수용(Q6). dev 6건 기대값: `2026-2600`·`2026-2607` → 2026-09, 나머지 → 2026-10.

---

## 해당 월 파싱 규칙 — `parseBenefitMonth(raw, documentCreatedAt)`

위치: `src/features/benefits/lib/parse-benefit-month.ts` (순수 함수 · server/client 공용 가능).

**정규화 알고리즘**
1. `raw`가 number면 정수일 때만 `String(raw)` (소수 → 거부). `null`/`undefined` → **missing**.
2. `String.prototype.normalize('NFKC')` — 전각 숫자 `１０`→`10`, 전각 공백 → 공백.
3. 모든 공백(`\s`) 제거. 결과가 빈 문자열 → **missing**. 길이 50 초과 → **invalid**.
4. 패턴 매칭:
   - A (월만): `^(\d{1,2})(월분|월)?$`
   - B (연도 포함): `^(\d{4})(?:년|[-./])(\d{1,2})(월분|월)?$`
   - 그 외 → **invalid**
5. 월 숫자 `1 ≤ m ≤ 12` 아니면 **invalid**.
6. 연도 `y` = `documentCreatedAt`(YYYY-MM-DD)의 연도. B 패턴이면 입력 연도 ≠ `y` → **invalid**.
7. 결과 `YYYY-MM-01`.

| 입력 | 결과 (작성일 2026-10-14) | 비고 |
|------|--------------------------|------|
| `"10"` · `10`(number) · `"10월"` | 2026-10-01 | |
| `"01월"` · `"1"` | 2026-01-01 | |
| `" 9 월"` · `"9월분"` | 2026-09-01 | 공백 제거 · `월분` 허용 |
| `"１０"` · `"１０월"` | 2026-10-01 | NFKC |
| `"2026-10"` · `"2026.10"` · `"2026/10"` · `"2026년 10월"` | 2026-10-01 | 작성 연도와 같음 |
| `"11"` | 2026-11-01 | 미래 월 허용 (Q2) |
| `"12"` (작성 2027-01-05) | 2027-12-01 | Q2 결정 — 연초 경계 주의 |
| `"2025년 12월"` | invalid | 연도 불일치 |
| `"13"` · `"0"` · `"00"` · `"001"` · `10.5` | invalid | 범위·자릿수·소수 |
| `"9,10월"` · `"9~10월"` · `"9월10월"` | invalid | 복수 월 |
| `"구월"` · `"ex. 9월"` · `"9월?"` · `"sep"` | invalid | 한글 숫자·예시 복사·기타 문자 |
| `""` · `"   "` · `null` · 필드 없음 | missing | |

반환 형태 예: `{ ok: true, month: '2026-10-01' } | { ok: false, reason: 'benefit_month_missing' | 'benefit_month_invalid' }`.

---

## API 요구사항 — `POST /api/benefits/import`

### 요청 필드 (추가분)

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `benefit_month` | `string` \| `number` (문자열 최대 50자) | **fitness 필수** · book/education **무시** (저장·검증 안 함) | Flex 「해당 월 (ex. 9월)」 칸 **원문 그대로** |

기존 필드(`document_number`, `task_key`, `benefit_type`, `document_created_at`, `approved_at`, `applicant_name`, `amount`, `description`, `source_document_url`, `source_message_id`)는 **변경 없음**. 은행명·계좌번호는 보내지 않으며, 보내더라도 저장·로그되지 않는다(zod strip).

zod: `benefit_month: z.union([z.string(), z.number()]).nullable().optional()` — fitness 필수 판정은 zod가 아닌 **duplicate 확인 이후** Route/service 단계에서 수행.

### 처리 순서 (duplicate 우선)

| 순서 | 조건 | 응답 | action |
|------|------|------|--------|
| 1 | Bearer 토큰 오류 | 401 | `benefit.import_failed` |
| 2 | JSON 파싱 실패 · 기존 필드 zod 실패 | 400 | `benefit.import_failed` |
| 3 | `document_number` 또는 `task_key` 기존 문서 존재 | **200 duplicate** (해당 월 없음·불일치여도 · 기존 행 갱신 없음) | `benefit.import_duplicate` |
| 4 | 신규 · fitness · `parseBenefitMonth` 실패 | **400** · 문서 미생성 | `benefit.import_failed` |
| 5 | 활성 구성원 이름 불일치·동명이인 | 422 | `benefit.import_failed` |
| 6 | 기타 서버 오류 | 500 | `benefit.import_failed` |
| 7 | 생성 성공 | 201 | `benefit.import_create` |

### 요청 예시

```json
{
  "document_number": "2026-2808",
  "task_key": "flex-2026-2808",
  "benefit_type": "fitness",
  "document_created_at": "2026-10-14",
  "approved_at": "2026-10-14T13:59:00+09:00",
  "applicant_name": "홍성훈",
  "amount": 76000,
  "description": "헬스 · 2",
  "benefit_month": "10",
  "source_document_url": "https://flex.team/…",
  "source_message_id": "…"
}
```

### 응답 예시

```json
// 201
{
  "success": true,
  "message": "복지비 문서가 import되었습니다.",
  "status": "created",
  "document": {
    "document_number": "2026-2808",
    "benefit_type": "fitness",
    "document_created_at": "2026-10-14",
    "benefit_month": "2026-10-01",
    "attributed_month": "2026-10-01",
    "amount": 76000
  }
}

// 400 — 누락
{ "success": false, "message": "체력증진비는 해당 월(1~12월)이 필요합니다." }

// 400 — 파싱 불가 (원문 최대 20자 인용)
{ "success": false, "message": "해당 월 형식이 올바르지 않습니다: 9,10월" }
```

### `benefit_import_events`

- 4번 분기 `status='failed'`, `error_code` = `benefit_month_missing` | `benefit_month_invalid` (컬럼 check 없음 — SQL 변경 불필요).

---

## 활동 감사 로그 — 기록 연동

> `core-conventions.mdc` §활동 감사 로그 · [plan 08](./08_activity-audit-log-plan.md). 신규 action **없음**.

| Route | 분기 | HTTP | action | metadata (allowlist) |
|-------|------|------|--------|----------------------|
| `POST /api/benefits/import` | 토큰 오류 | 401 | `benefit.import_failed` | `error_code:'unauthenticated'`, `message` |
| 〃 | JSON·zod 실패 | 400 | `benefit.import_failed` | `error_code:'validation'`, `message`, `task_key` |
| 〃 | duplicate | 200 | `benefit.import_duplicate` | `document_number`, `task_key`, `benefit_type`, `status` |
| 〃 | **fitness 해당 월 누락/불가 (신규)** | **400** | `benefit.import_failed` | `error_code:'validation'`, `message`, `document_number`, `task_key`, `benefit_type`, **`benefit_month_reason`** |
| 〃 | 이름 매칭 실패 | 422 | `benefit.import_failed` | 기존 |
| 〃 | 서버 오류 | 500 | `benefit.import_failed` | 기존 |
| 〃 | 생성 | 201 | `benefit.import_create` | 기존 + **`benefit_month`** (`YYYY-MM`, fitness만) |

- `METADATA_ALLOWLIST`(`src/features/activity-logs/api/log.server.ts`)와 `ActivityLogMetadata` 타입에 `benefit_month`, `benefit_month_reason` 추가.
- 모든 분기 `x-request-id` 헤더 유지 (`jsonWithActivityLog`).
- 민감정보(은행명·계좌번호·토큰) metadata·message·이벤트 **절대 금지**. 400 message의 원문 인용은 해당 월 입력값만 20자 이내.
- log insert 실패해도 응답 불변 (기존 패턴).

---

## UI 요구사항

| 화면 | 위치 | 표시 |
|------|------|------|
| 관리자 `/dashboard/benefits` | `benefit-document-admin-row.tsx` 유형·설명 셀 | fitness **이고** `benefit_month != null`일 때 `해당 월 2026-10` |
| 내 복지비 `/dashboard/my-benefits` | `my-benefits-dashboard.tsx` 문서 행 유형·설명 영역 | 동일 |

- 형식 `yyyy-MM` — `@/lib/format-date`에 `formatAbsoluteMonthKo(date)` 추가 (`2026-10-01` → `2026-10`). feature 내 직접 포맷 **금지**.
- book·education 행, 기존 fitness 행(`benefit_month` null) → **미표시**.
- 취소 문서는 기존 취소선 스타일을 함께 적용.
- 날짜 열·레이아웃·로딩 UI 변경 없음 (designer 최소 변경 — 위치·텍스트 스타일만 확정).
- 두 화면은 `dashboard/layout` 하위 → `DashboardPresenceTrack` 상속 (신규 track 코드 없음).

---

## 영향 파일 & 패턴

| 팀 | 파일 | 변경 |
|----|------|------|
| BE | `supabase/sql/79_benefit_fitness_month.sql` (신규) | 컬럼·check·인덱스 |
| BE | `src/features/benefits/lib/parse-benefit-month.ts` (신규) | 파싱 |
| BE | `src/features/benefits/api/validators.ts` | `benefit_month` optional union |
| BE | `src/features/benefits/api/types.ts` | `BenefitImportPayload.benefit_month?` · `BenefitDocument.benefit_month`, `attributed_month` |
| BE | `src/features/benefits/api/service.server.ts` | `DOCUMENT_SELECT` · `mapDocument` · insert `benefit_month` · `listMonthDocuments` 필터·정렬 · duplicate 우선 흐름 |
| BE | `src/app/api/benefits/import/route.ts` | 4번 분기 400 · metadata |
| BE | `src/features/activity-logs/api/log.server.ts`, `types.ts` | allowlist 키 2개 |
| FE | `src/lib/format-date.ts` | `formatAbsoluteMonthKo` |
| FE | `src/features/benefits/components/benefit-document-admin-row.tsx`, `my-benefits-dashboard.tsx` | 해당 월 표시 |
| verifier | `e2e/helpers/benefit-notifications.ts` | fitness 기본 payload에 `benefit_month` 추가 (미반영 시 plan 78 spec fitness 201 회귀) |
| verifier | `e2e/helpers/benefits-fixture.ts` | `benefitMonth?` 옵션 (직접 insert) |
| verifier | `e2e/benefits/benefit-fitness-month-*.spec.ts` (신규 3개) | §E2E |

Read는 기존 `queries.ts`·`useSuspenseQuery` 경로 그대로 · 신규 mutation·FE CUD 없음.

---

## 배포 순서 (필수 · main DB 미적용)

현재 웹 zod는 모르는 키를 **strip**하므로 자동화가 `benefit_month`를 **먼저** 보내도 안전하다.

1. **자동화(Wake-Automation)** — `benefit_month` 원문 전송 추가 (사용자 별도 레포)
2. **dev** — SQL 79 적용 → 웹 dev 배포 → E2E
3. **main SQL 79** — 사용자 별도 승인 후 (본 plan 범위 Out)
4. **main 웹 배포** — 반드시 3 이후

| 잘못된 순서 | 결과 |
|-------------|------|
| 웹 → SQL | `attributed_month` 없음 → 조회 select 500 |
| 웹(main) → 자동화 미전송 | 신규 fitness import 전부 400 |

---

## 리스크 & 완화책

| 등급 | 리스크 | 완화 |
|------|--------|------|
| HIGH | 배포 순서 오류 → fitness 전부 400 / 조회 500 | §배포 순서 · SQL 상단 메타 · 최종 보고 명시 |
| HIGH | SQL 미적용 상태 웹 배포 | dev 먼저 `apply_migration` · verifier 시작 전 컬럼 존재 확인 |
| MED | plan 78 E2E helper fitness payload 회귀 | helper 수정 + `e2e/benefits/*` 전체 재실행 |
| MED | 9월 귀속분 미노출 — 신청자는 import 알림을 받지만 화면에 문서 없음 · 관리자 취소 불가 | Q5 결정으로 수용 · 후속 plan 후보 |
| LOW | 연초 경계(1월 작성 `12` → 같은 해 12월) | 자동화 명세 「주의」 · 필요 시 후속 |
| LOW | generated 식 immutable 오류 | 1안 → 2안 폴백 · dev 검증 |

롤백: 웹 revert → `alter table benefit_documents drop column attributed_month, drop column benefit_month;` (기존 데이터 손실 없음).

---

## AC (Given-When-Then)

공통 Given: dev DB에 SQL 79 적용 · 유효 `BENEFIT_IMPORT_TOKEN` · E2E 활성 구성원 1명(이름 매칭) · KST 당월 `2026-10` 기준(당월이 바뀌면 fixture 월은 「당월」로 치환).

### import 정상·파싱

| ID | Given | When | Then |
|----|-------|------|------|
| AC-01 | 신규 `document_number` · fitness · `document_created_at=2026-10-14` | `benefit_month:"10월"`로 import | `201` · `document.benefit_month="2026-10-01"` · `attributed_month="2026-10-01"` |
| AC-02 | AC-01 문서 존재 | admin `GET /api/benefits?month=2026-10` · 신청자 `GET /api/my-benefits?month=2026-10` | 두 응답의 해당 구성원 `documents`에 문서 포함 · `category_totals.fitness`·`total_used`에 금액 반영 |
| AC-03 | 신규 fitness · 작성일 2026-10-14 | `benefit_month`를 `"10"`, `10`(number), `"01월"`, `" 9 월"`, `"9월분"`, `"１０"`, `"１０월"`, `"2026-10"`, `"2026.10"`, `"2026년 10월"`로 각각 import | 각각 `201` · `benefit_month`가 정규화 표(2026-10/01/09-01)와 일치 |
| AC-04 | 신규 fitness · 작성일 2027-01-05 (fixture 날짜) | `benefit_month:"12"` import | `201` · `benefit_month="2027-12-01"` (작성 연도 고정) |

### 거부·로그

| ID | Given | When | Then |
|----|-------|------|------|
| AC-05 | 신규 fitness · 작성일 2026-10-14 | `benefit_month`를 `"13"`, `"0"`, `"001"`, `"9,10월"`, `"9~10월"`, `"구월"`, `"ex. 9월"`, `"2025년 12월"`, `10.5`로 각각 import | 각각 `400` · `message`에 「해당 월 형식이 올바르지 않습니다」 포함 · 해당 `document_number` 행 **미생성** |
| AC-06 | 신규 fitness | `benefit_month` 필드 없음 / `null` / `""` / `"   "`로 각각 import | 각각 `400` · `message`「체력증진비는 해당 월(1~12월)이 필요합니다.」 · 행 미생성 |
| AC-07 | AC-05 또는 AC-06 요청 1건 | 응답 헤더·`GET /api/activity-logs?action=benefit.import_failed&log_user=all` 조회 | `x-request-id` 헤더 존재 · 동일 request id 행 · metadata `error_code="validation"`, `benefit_month_reason` ∈ {`benefit_month_missing`,`benefit_month_invalid`} · `benefit_import_events`에 동일 `error_code` failed 행 |

### 유형별·duplicate·기존 행

| ID | Given | When | Then |
|----|-------|------|------|
| AC-08 | 신규 book / education 각 1건 · 작성일 2026-10-14 | `benefit_month:"abc"` 포함 import | 각각 `201` · `benefit_month=null` · `attributed_month="2026-10-01"` |
| AC-09 | 이미 import된 fitness 문서(`benefit_month=2026-10-01`) | 같은 `document_number`로 `benefit_month` **없이** 재전송 / `"13"`으로 재전송 | 둘 다 `200` · `status="duplicate"` · 저장된 `benefit_month` 그대로 `2026-10-01` · action `benefit.import_duplicate` |
| AC-10 | fixture 직접 insert fitness 행 · `benefit_month` null · 작성일 2026-10-05 (기존 행 재현) | admin `GET /api/benefits?month=2026-10` | 문서 포함 · `attributed_month="2026-10-01"` · 합계 반영 |

### 귀속 월 집계·하한

| ID | Given | When | Then |
|----|-------|------|------|
| AC-11 | fitness import · 작성일 **2026-11-02** · `benefit_month:"10"` | `GET /api/benefits?month=2026-10` · `GET /api/my-benefits?month=2026-10` | 문서 포함 · `total_used`에 금액 포함 (작성 월 11월과 무관하게 귀속 월로 집계) |
| AC-12 | fitness import · 작성일 2026-10-30 · `benefit_month:"11"` | `GET /api/benefits?month=2026-10` | 문서 **미포함** · 10월 `total_used`에 금액 **불포함** |
| AC-13 | fitness import · 작성일 2026-10-14 · `benefit_month:"9"` | `201` 후 `GET /api/benefits?month=2026-10` · `?month=2026-09` · `GET /api/my-benefits?month=2026-09` | 모든 응답 `data.month`=당월 · 문서 **미포함** (하한 2026-10 유지, plan 79) |

### 화면

| ID | Given | When | Then |
|----|-------|------|------|
| AC-14 | admin · 조회 월 2026-10 · E2E 구성원에 fitness(`benefit_month` 2026-10) + book 문서 | `/dashboard/benefits?month=2026-10`에서 구성원 행 펼치기 | fitness 문서 행에 「해당 월 2026-10」 텍스트 보임 · book 문서 행에는 「해당 월」 텍스트 없음 |
| AC-15 | 동일 구성원으로 로그인(또는 admin proxy `benefits_user`) | `/dashboard/my-benefits?month=2026-10` | fitness 행 「해당 월 2026-10」 보임 · book 행 미표시 |
| AC-16 | AC-10 기존형 fitness 행(null) | 두 화면에서 해당 행 확인 | 「해당 월」 텍스트 **없음** · 크래시 없음 |

### activity log·에러·회귀

| ID | Given | When | Then |
|----|-------|------|------|
| AC-17 | 신규 fitness 정상 payload + 추가 키 `bank_account:"110-000-000000"` | import → 같은 payload 재전송 | 1차 `201`·2차 `200` · 둘 다 `x-request-id` · `benefit.import_create`(metadata `benefit_month="2026-10"`) · `benefit.import_duplicate` 행 생성 · 두 행 metadata·message 직렬화 문자열에 `110-000-000000`·`bank` **없음** · DB 행에도 미저장 |
| AC-18 | 잘못된 Bearer 토큰 | import | `401` · `benefit.import_failed`(`error_code=unauthenticated`) · 행 미생성 |
| AC-19 | 활성 구성원과 불일치하는 `applicant_name` · fitness `benefit_month:"10"` | import | `422` · `benefit.import_failed` · 행 미생성 |
| AC-20 | 비-production · `document_number`에 `E2E-IMPORT-FAIL` 포함 (기존 `FANOUT-FAIL` 시뮬레이션 패턴 준용, backend-dev 추가) | fitness import | `500` · `benefit.import_failed`(`error_code=internal_error`) · `x-request-id` · 앱 크래시 없음 |
| AC-21 | 기존 spec | `bunx playwright test e2e/benefits` | 전부 green (helper fitness payload 수정 반영) |
| AC-22 | `/dashboard/benefits`, `/dashboard/my-benefits` | 라우트 구조 확인 | `src/app/dashboard/layout.tsx` 하위 · `DashboardPresenceTrack` 상속 · 신규 track 코드 없음 (plan 49) |
| AC-23 | SQL 79 적용 전 dev `benefit_documents` 스냅샷(id·작성일·승인일·금액·설명·취소 컬럼) | 적용 후 동일 컬럼 비교 | 변경 0건 · 신규 `benefit_month` 전부 null · `attributed_month` = `2026-2600`/`2026-2607` → 2026-09-01, 나머지 → 2026-10-01 (backend-dev MCP Read 검증) |

### E2E spec 분할 (`e2e/benefits/`)

| 파일 | AC |
|------|----|
| `benefit-fitness-month-import.api.spec.ts` | AC-01, 03~09, 17~20 |
| `benefit-fitness-month-aggregation.api.spec.ts` | AC-02, 10~13 |
| `benefit-fitness-month-display.spec.ts` | AC-14~16 (`getByRole`/`getByText`/`getByTestId`만) |

- E2E `document_number`·`task_key`는 기존 cleanup 대상 접두(`e2e-` 등)를 사용 → `npm run e2e:cleanup` 후 `remaining.users=0`·`remaining.profiles_e2e=0`.
- 판정은 `bunx playwright test`만. MCP는 셀렉터 탐색 보조.

---

## 자동화 레포용 명세 (Wake-Automation 전달용)

| 항목 | 값 |
|------|-----|
| 엔드포인트 | `POST /api/benefits/import` (기존 · Bearer `BENEFIT_IMPORT_TOKEN`) |
| 신규 필드 | **`benefit_month`** |
| 타입 | string (Flex 원문 그대로) — 숫자도 허용 |
| 필수 | **체력증진비(`benefit_type="fitness"`)만 필수** · 도서·외부교육은 보내도 무시 |
| 값 | Flex 「해당 월 (ex. 9월)」 칸 텍스트를 **가공 없이** (`"10"`, `"10월"`, `"01월"`, `"9월분"` 등) |
| 허용 예 | `"10"` `"10월"` `"01월"` `" 9 월"` `"9월분"` `"１０"` `"2026-10"`(작성 연도와 같을 때) |
| 거부 예 (400) | 빈값·누락 · `"13"` `"0"` · `"9,10월"` · `"구월"` · `"ex. 9월"` · 작성 연도와 다른 `"2025년 12월"` |
| 연도 | 웹이 `document_created_at` 연도로 고정 — **주의:** 1월 작성에 `12` → 같은 해 12월 |
| 재전송 | 이미 import된 문서는 `benefit_month` 유무와 무관하게 `200 duplicate` (값 갱신 없음) |
| 400 처리 | 응답 `message`를 실패 로그에 남기고 사람 확인 대상으로 분류 · 재시도해도 동일 400 |
| 금지 | 은행명·계좌번호 등 민감정보 필드 전송 금지 |
| 배포 | 자동화 먼저 배포해도 안전 (현 웹은 미지 필드 무시) |

웹이 월을 구분하는 최종 필드: **`benefit_documents.attributed_month`** (fitness = `benefit_month`, 그 외·기존 행 = 작성일 월).

---

## 완료 조건 (팀)

| 팀 | 조건 |
|----|------|
| designer | 「해당 월」 표시 위치·텍스트 스타일(설명 줄과 동일 `text-xs text-muted-foreground`) 확정 · 레이아웃 변경 없음 |
| backend-dev | SQL 79 dev 적용 · AC-23 검증 · 파싱 함수 · Route 7분기 로그 · allowlist · 500 시뮬레이션 |
| frontend-dev | `formatAbsoluteMonthKo` · 두 행 표시 · 타입 반영 · CUD/mutation 없음 |
| verifier | 신규 spec 3개 + 회귀 green · tsc · lint · react-doctor · build · `e2e:cleanup` exit 0 |

## 열린 질문

- 없음 (9월 귀속분 노출·연초 경계는 후속 plan 후보로만 기록).

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-10-14 | 최초 작성 · deep-interview Q1~Q7 · battle-plan `go` · plan 80 / SQL 78 번호 확인 | planner |
| 2026-10-14 | 신규 SQL 번호 78 → **79** (78은 사용자가 삭제한 main seed 번호 · 사용자 지시) | planner |
