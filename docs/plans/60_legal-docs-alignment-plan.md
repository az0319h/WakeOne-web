> Date: 2026-10-02
> Status: Approved
> Author: planner
> Related: plan 57 (Google auth), plan 21 (profile read-only), plan 42/43 (CS), plan 49 (presence), plan 51–56 (wallet email), plan 52 (Google Tasks)

# 60 — 이용약관·개인정보처리방침 현행화

## 1. 배경·목표

WakeOne의 **이용약관**(`/terms-of-service`)과 **개인정보처리방침**(`/privacy-policy`)은 시행일 **2026-08-04** 기준으로 작성되어 있다.  
**plan 57 (Google OAuth 전용·승인제·비밀번호 제거)** 및 이후 다수 기능(공지, CS, Google Tasks, Live Presence, 식대 잔액 이메일, Sentry 등)이 반영되지 않아 **실제 서비스와 불일치**한다.

**목표:** 두 법률 문서를 **현재 프로덕션 기능·데이터 처리·위탁 현황**과 일치시키고, 로그인 화면 링크(`/auth/sign-in`)에서 참조하는 문구와 정합성을 확보한다.

**범위 In:** `src/app/terms-of-service/page.tsx`, `src/app/privacy-policy/page.tsx`, 시행일 상수, (필요 시) sign-in intro copy와 용어 정렬  
**범위 Out:** 변호사 법률 검토 대행, 영문 약관, SEO(plan 46 Out 범위 유지), 신규 기능 개발

---

## 2. 현황 진단 요약

### 2-1. 전체 판정

| 문서 | 판정 | 요약 |
|------|------|------|
| **이용약관** | **개정 필요** | 계정 발급·비밀번호·서비스 목록이 Google 승인제 이전 모델 |
| **개인정보처리방침** | **개정 필요** | 수집 항목·위탁·정보주체 권리(자가 수정)가 현행과 불일치 |

### 2-2. 이용약관 — 주요 불일치

| 조항 | 현재 문서 | 실제 구현 (2026-10) |
|------|-----------|---------------------|
| **제2조 계정** | 이메일 기반 로그인 수단 | **Google OAuth**; 업무 email은 승인 시 admin 확정 |
| **제4조 계정 발급** | admin이 Users에서 **직접 생성**, 최초 로그인 후 **비밀번호 변경** | Google 로그인 → `pending_approval` → admin **수락/거절**; `POST /api/users` **410** |
| **제5조 계정 관리** | 이용자 **비밀번호 직접 관리** | Google 계정 인증; password API **410** |
| **제6조 서비스 내용** | 5개 bullet | 공지·CS·내 계약서·Google Tasks·잔액 이메일·Live Presence·승인 워크플로 등 **다수 누락** |

### 2-3. 개인정보처리방침 — 주요 불일치

| 조항 | 현재 문서 | 실제 구현 |
|------|-----------|-----------|
| **§1 인증 정보** | 비밀번호(암호화), 로그인 이력 | Google OAuth; 비밀번호 흐름 **폐기** |
| **§1 수집 방법** | 관리자 **계정 등록** | Google OAuth + admin 승인 |
| **§1·§2** | — | Google identity, CS 문의·댓글, 앱 알림, Live Presence, 잔액 이메일 설정·로그 **미기재** |
| **§6 위탁** | Supabase, Vercel, SMTP | **Google**(로그인·Tasks API), **Sentry**(`sendDefaultPii: true`) **미기재** |
| **§8 정보주체 권리** | 프로필 **직접 수정** 가능 | plan 21·58: 프로필 **read-only**; admin만 수정 |
| **§9 안전성** | 비밀번호 암호화 | Google Tasks refresh token **암호화 저장** 미언급 |

### 2-4. 문서 대비 **정확히 반영된** 항목 (유지·소폭 보강)

- WakeOne = 주식회사 웨이크 사내 시스템 (제1조·총칙)
- 계약 문서·첨부·독촉 메일, 법인카드(식대) 한도, 생일 안내, 활동 로그·시스템 메일 로그
- Supabase/Vercel/SMTP 위탁 골격
- RLS·HTTPS·첨부 접근 통제·퇴직 시 비활성화 (§9)
- 제3자 제공 없음·내부 전용 서비스 성격

---

## 3. 개정 원칙

1. **사실 기반:** 코드·plan AC에 존재하는 기능만 기재 (데모/비활성 nav 제외)
2. **Google 승인제 중심:** self-signup 없음, pending → admin approve/reject → active
3. **프로필 read-only:** 정보주체는 **열람·정정 요청(문의)**; 서비스 UI에서 직접 수정 불가 명시
4. **위탁·국외 이전 투명성:** Google, Sentry 추가; Realtime·Storage는 Supabase 위탁 범위에 포함
5. **시행일:** 개정 완료일로 `TERMS_EFFECTIVE_DATE` / `PRIVACY_EFFECTIVE_DATE` 갱신
6. **법무 검토:** 본 plan은 **기술·기능 정합성** 기준; 배포 전 총무/법무 확인 권장

---

## 4. 이용약관 개정안 (조항별)

### 제2조 (용어의 정의) — 수정

- **계정:** Google OAuth로 연동된 WakeOne 접근 권한 및 `profiles`에 연결된 업무 식별 정보
- **이용자:** admin 승인을 받아 `status=active`인 임직원 (승인 대기·거절·비활성 제외)
- **업무 데이터:** 기존 정의 + 공지·CS 문의·알림·Google Tasks 연동 데이터

### 제4조 (계정의 발급) — **전면 개정**

**삭제:** admin 직접 생성, 최초 비밀번호 변경  
**추가:**

- 서비스는 **일반 공개 가입 불가**
- 임직원은 **Google 계정으로 로그인** 시도
- **신규 Google 사용자:** `pending_approval` → admin이 Users에서 **수락/거절**
- **수락 시:** 업무 email·이름·소속·직급·연락처 등 admin이 확정
- **기존 active 사용자:** 동일 Google email/auth identity로 로그인
- **거절·비활성:** 로그인 불가 및 안내

### 제5조 (계정 관리) — **전면 개정**

- Google 계정 보안은 **이용자·Google 정책** 책임
- WakeOne 계정 **양도·공유 금지**
- 비활성·승인 거절 시 접근 차단

### 제6조 (서비스의 내용) — **확장**

기존 5 bullet 유지 + 아래 추가:

| 기능 | 설명 |
|------|------|
| Google 로그인·승인 관리 | OAuth 로그인, admin 가입 승인/거절 |
| 공지사항 | admin 작성·첨부·앱 알림 |
| CS 문의 | 이용자 문의·댓글; admin 처리 |
| 내 계약서 | user 이름 매칭 계약 READ |
| Google Tasks | **선택적** Tasks OAuth 연결·조회 (연결 해제 가능) |
| 식대 잔액 확인 이메일 | user 설정·스케줄 발송; admin 발송 로그 |
| Live 접속자 | overview 동시 접속 표시 (Realtime) |
| 계약 import·일괄 다운로드·첨부 뷰어 | admin/연동 API |

### 제10조 — 유지 (비활성화·퇴직)

Google ban + `profiles.inactive`와 정합 — 문구 유지 가능

---

## 5. 개인정보처리방침 개정안 (조항별)

### §1 수집 항목 — 수정·추가

**계정·프로필**

- Google OAuth: `google_email`, `google_display_name`
- 승인 메타: `approval_requested_at`, `approved_at/by`, `rejected_at/by`, `rejection_reason`
- `rank` UI 라벨 **「부서/사업장」** 와 용어 통일 (「직급」과 구분 기재)

**인증 정보 (수정)**

- ~~비밀번호(암호화 저장)~~ → **Google OAuth 식별 정보**, Supabase **세션 쿠키**, 로그인·활동 감사(`auth.sign_in` 등)

**업무·행동 (추가)**

- CS 문의·댓글 (제목·본문·상태·작성자 스냅샷)
- 앱 내 알림 (type, title, body, metadata)
- Live Presence (접속 중 user_id, 이름, email, avatar — Realtime)
- Google Tasks 연동 (연결 Google email, **암호화된 refresh token**)
- 식대 잔액 이메일 (발송 설정·run·dispatch 로그)
- Supabase Storage 첨부 (계약·공지)

**자동 수집 (추가)**

- **Sentry:** 오류·성능 데이터, IP·요청 헤더 등 (`sendDefaultPii` 운영 시)

**수집 방법 (수정)**

- ~~관리자 계정 등록~~ → **Google OAuth 로그인**, **admin 승인**, 서비스 이용 자동 생성, 외부 연동 API

### §2 처리 목적 — bullet 추가

- Google 가입 승인·거절 처리
- CS 문의 응대
- 공지·앱 알림 제공
- Google Tasks 연동 서비스
- 식대 잔액 확인 이메일 발송
- Live Presence·장애 모니터링(Sentry)

### §6 위탁 — 추가

| 수탁자 | 업무 | 국외 |
|--------|------|------|
| **Google LLC** | OAuth 로그인, Google Tasks API | 미국 등 |
| **Functional Software, Inc. (Sentry)** | 오류·성능 모니터링 | 미국 등 |

Supabase 항목에 **Storage·Realtime** 명시

### §8 정보주체 권리 — **수정**

- 프로필은 서비스 내 **조회만 가능**; 변경은 **admin 또는 문의처** 통해 요청
- 열람·정정·삭제·처리정지 요청 절차 유지

### §9 안전성 — 보강

- Google Tasks token 암호화 저장
- inactive 시 auth ban·세션 회수

### §10 쿠키 — 보강

- 인증 세션 쿠키 (기존)
- Sentry 등 **서비스 운영에 필요한** 기술 쿠키/로컬 저장 가능 — **광고·행태 추적 없음** 유지

---

## 6. 구현 작업 (FE only)

| # | 작업 | 파일 |
|---|------|------|
| 1 | 이용약관 제2·4·5·6조 개정 | `src/app/terms-of-service/page.tsx` |
| 2 | 개인정보 §1·2·6·8·9·10 개정 | `src/app/privacy-policy/page.tsx` |
| 3 | 시행일 상수 갱신 | 동일 파일 상단 `*_EFFECTIVE_DATE` |
| 4 | (선택) sign-in intro copy와 용어 충돌 없는지 grep | `sign-in-view.tsx`, `site-metadata.ts` |

**BE/SQL:** 없음  
**E2E:** 선택 — `/terms-of-service`, `/privacy-policy` 200 + 핵심 키워드 smoke (Google, 승인, read-only)

---

## 7. Acceptance Criteria (Given-When-Then)

### AC-01 이용약관 Google 승인제

- **Given** 이용약관 페이지
- **When** 본문을 읽으면
- **Then** 「Google 로그인」「관리자 승인」「비밀번호 직접 생성/변경」 구식 표현이 **없고**, pending → approve/reject 흐름이 기재되어 있다

### AC-02 이용약관 서비스 목록

- **Given** 이용약관 제6조
- **When** nav-config 프로덕션 기능과 대조하면
- **Then** 공지·CS·내 계약서·Google Tasks·잔액 이메일·Live Presence·승인 관리가 **포함**되어 있다

### AC-03 개인정보 수집·위탁

- **Given** 개인정보처리방침
- **When** §1·§6을 읽으면
- **Then** Google OAuth, Google Tasks token, Sentry, CS·알림·Presence가 기재되고, **비밀번호 수집** 주장이 **없다**

### AC-04 프로필 read-only

- **Given** 개인정보 §8
- **When** `/dashboard/profile` 동작과 대조하면
- **Then** 「서비스 내 직접 수정」이 아닌 **조회 + admin/문의처 정정**으로 기술되어 있다

### AC-05 시행일

- **Given** 개정 배포 후
- **When** 두 페이지 상단/하단 시행일 확인
- **Then** 개정 완료일(≥ 2026-10-02)로 표시된다

### AC-06 로그인 링크

- **Given** `/auth/sign-in`
- **When** 이용약관·개인정보 링크 클릭
- **Then** 개정된 페이지가 정상 표시된다 (기존 href 유지)

---

## 8. 리스크·확인 필요 (사용자/법무)

| # | 항목 | 권장 |
|---|------|------|
| R1 | **Sentry `sendDefaultPii: true`** — IP 등 전송 | 방침에 명시 **또는** `sendDefaultPii: false`로 코드 변경 (별도 plan) |
| R2 | **Google Tasks CUD** (plan 54) | 현재 API **read-only** → 약관은 「조회·연결 해제」까지만 기재; CUD 배포 시 2차 개정 |
| R3 | **보호책임자·문의처** (홍성훈, info@wakecorp.com) | 변경 여부 총무 확인 |
| R4 | **SMTP 제공자 실명** | env 기준 실제 업체 명시 (예: AWS SES, Gmail SMTP 등) |
| R5 | **법무 검토** | 배포 전 최종 문구 승인 |

---

## 9. 권장 진행 순서 (`/root` 파이프라인)

| 단계 | 담당 | 산출 |
|------|------|------|
| 1 | **planner** | 본 plan (완료) |
| 2 | 사용자 **`승인`** | — |
| 3 | **designer** | 조항 구조·가독성 (섹션 순서, bullet 길이) — UI 변경 없음 |
| 4 | **frontend-dev** | 두 page.tsx 문구 개정 |
| 5 | **verifier** | AC-01~06 smoke, build |

**예상 규모:** FE 2파일, 0.5~1일 (법무 검토 별도)

---

## 10. 참조

- `src/app/terms-of-service/page.tsx`, `src/app/privacy-policy/page.tsx`
- `docs/plans/57_google-auth-approval-migration-plan.md`
- `docs/plans/21_user-profile-slim-migration-plan.md`
- `src/config/nav-config.ts`
- `src/instrumentation.ts` (Sentry)
