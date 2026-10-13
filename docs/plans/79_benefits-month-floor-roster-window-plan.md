> Date: 2026-10-13
> Status: Completed
> Author: planner (user `go` · battle-plan 확정)

# 복지비 — 조회 월 하한·폴백·명단 재직 윈도우

## 선행 plan 참조

| Plan | 관계 |
|------|------|
| **73** | URL `month` · invalid → KST 당월 — **본 plan이 하한·폴백·서버 정규화로 확장** |
| **75** | 비활성 `M ≤ D` · 빨강 행 — **유지**. 활성「조회 월 무관 명단」은 **본 plan으로 supersede** |
| **74** | admin 내 복지비 proxy — 동일 `month` 정규화 **적용** |
| **76** | HR 복지비 관리 — admin과 동일 API·명단 규칙 |
| **49** | `/dashboard/benefits`, `/dashboard/my-benefits` — `dashboard/layout` · `DashboardPresenceTrack` **상속** (별도 track 불필요) |
| **08** | Read-only API·쿼리 정규화 — **activity log 해당 없음** |

---

## 한 줄 요약

복지비 **관리·내 복지비**의 조회 월을 **`2026-10` ~ KST 당월**로 제한하고, 잘못된·범위 밖 `month`는 **KST 당월**로 보낸다. 관리 명단은 **재직 윈도우**(프로필 `created_at` 월 ~ 비활성 시 `deactivated_at` 월) 안의 조회 월에만 구성원을 노출한다.

---

## 정책 확정 (deep-interview · battle-plan)

### 상수

| 항목 | 값 |
|------|-----|
| `BENEFITS_EARLIEST_MONTH` | **`2026-10`** (코드 단일 상수 · FE/BE 공유) |

### 조회 월 정규화 `resolveBenefitsViewMonth(raw)` (KST `YYYY-MM`)

공통 함수 1곳 (`src/features/benefits/lib/` — `kst-month.ts` 또는 `benefits-view-month.ts`)에서 정의하고 **nuqs 파서·훅·Route Handler·`listBenefitsAdmin` / `getMyBenefits` 진입**에서 사용한다.

| 입력 `raw` | 결과 |
|------------|------|
| 없음·빈 문자열 | KST **당월** |
| 형식 오류 (`2026-13`, `invalid`) | KST **당월** |
| 유효하나 **`raw < 2026-10`** | KST **당월** (2026-10으로 clamp **하지 않음**) |
| 유효하나 **`raw > 당월`** | KST **당월** |
| **`2026-10 ≤ raw ≤ 당월`** | `raw` 그대로 |

**UI 네비게이션 (관리 `type=month` · 내 복지비 이전/다음):**

- 이전: `month === BENEFITS_EARLIEST_MONTH`이면 **비활성** (또는 no-op)
- 다음: `month === 당월`이면 **비활성**
- picker `min` = `2026-10`, `max` = 당월

**URL 교정:** 범위 밖·invalid deep link 진입 시 데이터는 당월로 조회하고, FE는 기존 plan 73 패턴처럼 `month` query를 **정규화된 값으로 교정**한다 (크래시·400 UI 없음).

### 관리 명단 — 재직 윈도우 (plan 75 확장)

KST 연·월 비교는 기존 `getKstYearMonthString` · `compareYearMonth` 사용.

| 필드 | 의미 |
|------|------|
| **시작 월 S** | `profiles.created_at` → KST `YYYY-MM` (**전용 `joined_at` 컬럼 없음 — 본 plan 범위 Out**) |
| **종료 월 E** | `status = active` → 상한 없음(당월까지 조회만 가능). `inactive` → `deactivated_at` KST 월 **D** (plan 75와 동일) |

**조회 월 M**에 프로필 U를 명단에 넣을 조건 (기존 org·`isBenefitsAdminRosterProfile` / `isEligibleOrgChartMember` **통과 후**):

```
compareYearMonth(M, S) >= 0
AND (
  status = active
  OR (status = inactive AND compareYearMonth(M, D) <= 0)
)
```

| 예 (12월 입사 · 3월 퇴사) | M | 명단 |
|-----------------------------|---|------|
| 입사 전 | 2026-11 | **없음** (빨강 행도 없음) |
| 재직 | 2026-12 ~ 2027-03 | 있음 (3월은 비활성·연한 빨강 — plan 75) |
| 퇴사 후 | 2027-04+ | **없음** |

**활성**도 **M < S**이면 명단 **제외** (기존 plan 75「활성은 조회 월 무관」 **폐지**).

**Gmail import** · 활성 이름 매칭 — **변경 없음** (본 plan Out).

### 내 복지비

- `month` 정규화·picker/이전·다음 상한·하한 — **관리와 동일 상수·함수**
- 명단 API 없음 — **재직 윈도우는 관리 `listBenefitsAdmin`만**
- 당월 이전·입사 전 월을 URL로 열면 **문서 0건** 응답 가능 (에러 아님)

---

## 범위

### In

| # | 영역 |
|---|------|
| 1 | `resolveBenefitsViewMonth` · `BENEFITS_EARLIEST_MONTH` |
| 2 | `parseAsBenefitsMonth` · `use-benefits-admin-filters` · `use-my-benefits-month` · invalid/**범위 밖** 교정 |
| 3 | `GET /api/benefits` · `GET /api/my-benefits` — query `month` 서버 정규화 후 service 호출 |
| 4 | `listBenefitsAdmin` — `created_at` select · 재직 윈도우 필터 · 응답 `month`는 정규화 값 |
| 5 | Admin·My FE — month input min/max · prev/next disable |
| 6 | Playwright — 하한·폴백·재직 윈도우 (API 또는 E2E fixture) |

### Out

- `profiles.joined_at` 신규 컬럼·마이그레이션
- benefit_documents 집계 기준(`document_created_at`) 변경
- import·cancel·restore·알림
- activity_logs 신규 action

---

## 기술 메모

- `PROFILE_ROSTER_SELECT`에 `created_at` 추가.
- `listBenefitsAdmin`의 `activeEligible` / `inactiveEligible` 분기를 **재직 윈도우 단일 predicate**로 정리 (중복 노출 방지).
- plan 75 E2E·AC 중 「활성 임의 month 명단」은 **입사 월 이후 month**로 조정.

---

## AC (Given-When-Then)

| ID | 검증 | Given | When | Then |
|----|------|-------|------|------|
| AC-01 | Playwright | admin | `/dashboard/benefits?month=2026-09` 진입 | 크래시 없음 · 조회 월·URL `month`가 **KST 당월**으로 교정 · API 성공 |
| AC-02 | Playwright | admin | `/dashboard/benefits?month=2099-01` 진입 | **당월**으로 교정 · 미래 월 데이터 요청 없음 |
| AC-03 | Playwright | admin · 당월이 `2026-10` 이후 | month picker에서 **2026-10** 선택 | 정상 조회 · URL `month=2026-10` |
| AC-04 | Playwright | admin · 조회 월 `2026-10` | **이전 달** UI 클릭 불가 또는 no-op · URL `2026-10` 유지 |
| AC-05 | Playwright | user | `/dashboard/my-benefits?month=invalid` 진입 | **당월** 표시 · 에러 UI 없음 |
| AC-06 | Playwright | user · 당월 | **다음 달** 버튼 비활성 또는 no-op |
| AC-07 | API | admin · E2E fixture U: `created_at`→**2026-12** KST · `inactive` · `deactivated_at`→**2027-03** | `GET /api/benefits?month=2026-11` | 응답 `members`에 U **없음** |
| AC-08 | API | 동일 U | `month=2026-12` | U **있음** · `is_inactive_profile` false (active였다면) 또는 3월까지 plan 75 비활성 규칙 |
| AC-09 | API | 동일 U · 3월 퇴사 반영 | `month=2027-03` | U 있음 · 비활성이면 `is_inactive_profile` true · 연한 빨강 (FE spec 또는 기존 admin spec 연계) |
| AC-10 | API | 동일 U | `month=2027-04` | U **없음** |
| AC-11 | API | admin | `GET /api/benefits?month=` (빈값) | `200` · `data.month` = **당월** |
| AC-12 | Playwright | admin | `e2e/benefits/admin.spec.ts` · `admin-url-filters.spec.ts` | 회귀 green (AC-07 등 month 값 fixture에 맞게 유지) |
| AC-13 | Playwright | HR 인사팀(76) | `/dashboard/benefits` month 하한 동작 | admin과 **동일** (AC-03·04 샘플 1건 이상) |

**Fixture 메모:** AC-07~10은 `profiles.created_at`·`deactivated_at` 제어가 필요하면 **기존 E2E provision·API helper**로 사용자 1명 세팅하거나 service-role API 테스트에서 insert/update (테스트 DB만).

---

## activity_logs

Read-only · 정규화·명단 필터만 — **신규 mutation·로그 AC 없음**.

---

## 완료 조건 (팀)

| 팀 | 조건 |
|----|------|
| designer | month picker min/max·disabled prev/next · 변경 최소 |
| backend-dev | 정규화 함수 · Route · `listBenefitsAdmin` 윈도우 · **SQL migration 없음**( `created_at` 기존 컬럼) |
| frontend-dev | nuqs·훅·대시보드 · mutations 없음 |
| verifier | AC Playwright/API green · build · `e2e:cleanup` |
