# Sign-in 페이지 SEO 기획서

> Date: 2026-08-31  
> Status: Approved  
> Author: planner  
> **선행:** [01](./01_supabase-auth-login-plan.md) · [34](./34_login-email-split-ux-plan.md) · [45](./45_auth-session-audit-log-plan.md)  
> **Conventional commit scope:** `seo` 또는 `auth`

## 선행 plan 참조 (Phase 0)

| Plan | Status | 관계 |
|------|--------|------|
| **01** | Completed | **유지** — sign-in UI·middleware·Supabase Auth 흐름 **변경 없음**. SEO는 metadata·본문 copy·JSON-LD만 |
| **34** | Approved | **회귀 금지** — 이메일 분리 입력·Combobox·`e2e/auth/sign-in-email-split.spec.ts` green 유지 |
| **45** | Approved | **무관(Out)** — `auth.sign_in` activity log는 sign-in API Route; 본 plan은 **Read-only SEO** |
| **07** | Completed | auth guard — **변경 없음** |
| **08** | Approved | activity log — **본 plan Out** (신규 CUD 없음) |

**중복 금지:** 루트 랜딩·dashboard index·Search Console verification env·약관/개인정보 SEO **Out**.

---

## 한 줄 요약

`/auth/sign-in`만 검색 엔진에 **index**되도록 metadata·JSON-LD·시맨틱 HTML·모바일 visible intro copy를 강화하고, 전역 `noindex`와 sign-in `index` 계층을 명확히 정리하여 **「브랜드+로그인」** 검색(wakeone 로그인, 웨이크원 로그인, wakecorp 로그인 등) 1페이지 노출을 현실적으로 달성한다.

---

## deep-interview 확정 (Phase 1)

| # | 항목 | 확정 |
|---|------|------|
| 1 | **범위** | `/auth/sign-in` 로그인 페이지 **만** In. 약관·개인정보·루트 랜딩 **Out** |
| 2 | **verification meta** | **Out** — Google Search Console·Naver는 **수동 등록만** |
| 3 | **소개 copy** | 브랜드·한국어 검색어(wakeone, 웨이크원, 웨이크 임직원, 주식회사 웨이크, wakecorp 로그인 등)를 **자연스럽게** 녹인 풍부한 본문 — thin content 해소 |
| 4 | **목표** | 일반 키워드 1페이지 X → **브랜드+로그인** 조합 검색 1페이지 (현실적) |
| 5 | **BE/CUD** | **해당 없음** — Read-only SEO |

---

## battle-plan 요약 (Phase 2)

### 목표 · 완료 · 제외

```
목표: sign-in 페이지 SEO 신호(메타·구조화 데이터·본문) 강화 → 브랜드+로그인 검색 노출 개선
완료: plan AC 전부 Playwright/tsc/lint/build green · plan 34 sign-in E2E 회귀 green
제외: GSC/Naver verification env · dashboard/루트 index · 약관/개인정보 SEO · 랜딩 신규
```

### 코드베이스 정찰

| 파일 | 현재 | 변경 방향 |
|------|------|-----------|
| `src/lib/site-metadata.ts` | 전역 `robots: noindex`, generic description/keywords | sign-in 전용 상수 분리 또는 `signInMetadata` export; 전역 noindex **유지**(dashboard 보호) |
| `src/app/layout.tsx` | `metadata = siteMetadata` (noindex) | **유지** — 하위 segment metadata로 sign-in만 override |
| `src/app/auth/sign-in/layout.tsx` | `index: true`, canonical, 약한 title/description | sign-in 전용 title·description·keywords·OG/Twitter·JSON-LD `<script>` |
| `src/app/dashboard/layout.tsx` | `robots: noindex` | **유지** — 이중 방어 |
| `src/app/sitemap.ts` | sign-in only, priority 1 | **유지** (필요 시 `lastModified` 정책만 FE 주석) |
| `src/app/robots.ts` | dashboard disallow, sitemap URL | **유지** — sign-in은 disallow 목록 **없음** (= crawl 허용) |
| `src/features/auth/components/sign-in-view.tsx` | H1「로그인」, 모바일 브랜드 설명 거의 없음(lg 패널만) | `<main>`·`<section>`·모바일 visible intro·키워드 copy |
| JSON-LD | **없음** | WebSite + Organization 패턴 신규 (참고: code4mk/nextjs-app-router-seo-example) |

### 리스크 & 완화

| # | 등급 | 리스크 | 완화 |
|---|------|--------|------|
| 1 | HIGH | keyword stuffing → 검색 품질 패널티 | copy는 **1~2단락 자연어** + 시맨틱 heading; meta keywords는 **8~15개** 상한 |
| 2 | MED | 전역 noindex와 sign-in index 병합 오류 | sign-in `layout.tsx`에서 `robots`·`alternates.canonical` **명시 재선언**; E2E meta assert |
| 3 | MED | plan 34 sign-in UX 회귀 | `sign-in-email-split.spec.ts` **필수 green**; intro는 폼 **위** 배치 |
| 4 | LOW | JSON-LD 스키마 오류 | schema.org WebSite/Organization 최소 필드; E2E JSON parse assert |
| 5 | LOW | 모바일 intro가 로그인 CTA 가림 | designer: intro **compact** · SheetFooter 규칙 **해당 없음**(페이지 폼) |

### 추정

```
범위: ~6–8 파일, ~200–350 LOC
복잡도: Medium
예상: designer ~30분 · FE ~90분 · verifier ~45분
체크포인트: metadata 상수 → layout JSON-LD → sign-in-view copy → E2E
```

---

## 목표 & 완료 기준

- Google 등에서 **「wakeone 로그인」「웨이크원 로그인」「wakecorp 로그인」** 등 브랜드+로그인 조합 검색 시 sign-in URL이 **색인·스니펫**에 적합한 신호를 갖는다 (순위는 배포 후 GSC로 추적 — 본 plan은 **온페이지 SEO 구현**까지)
- `/auth/sign-in` HTML에 **모바일·데스크톱 모두** 브랜드 intro copy가 **visible**
- 전역 `noindex`(root layout) vs sign-in `index` vs dashboard `noindex` **계층이 코드·E2E로 검증**
- plan **34** sign-in 폼 E2E **회귀 없음**
- tsc · lint · build · Playwright spec green

---

## 범위 (In / Out)

### In Scope

| # | 영역 | 내용 |
|---|------|------|
| 1 | **sign-in metadata** | `title`(브랜드+로그인), `description`(120~160자 권장), `keywords`, `openGraph`, `twitter`, `alternates.canonical`, `robots.index/follow` |
| 2 | **JSON-LD** | `WebSite` + `Organization` (`@graph` 또는 배열). `url`, `name`, `description`, `publisher`, `inLanguage: ko`, `potentialAction` SearchAction **선택**(site search 없으면 생략 가능) |
| 3 | **site-metadata 구조** | 전역 vs sign-in 상수 분리 — `SIGN_IN_PAGE_TITLE`, `SIGN_IN_DESCRIPTION`, `SIGN_IN_KEYWORDS` 등 export; root `siteMetadata.robots` noindex **유지** |
| 4 | **sign-in-view 시맨틱 HTML** | `<main>`, intro `<section>`, 브랜드 `<h2>`(또는 visually hidden 보조 heading), 본문 `<p>` — H1「로그인」**유지** |
| 5 | **모바일 visible intro** | `lg:hidden` 또는 공통 intro 블록으로 **모바일·sm에서도** WakeOne/웨이크원/wakecorp copy 표시 |
| 6 | **sitemap/robots** | 기존 sign-in-only sitemap·robots **검토** — 변경 필요 시 최소 diff만 |
| 7 | **E2E** | `e2e/seo/sign-in-seo.spec.ts` 신규 — meta·JSON-LD·visible copy·mobile viewport |
| 8 | **designer** | 모바일 intro + desktop lg 패널 copy **톤·위계** 정렬 목업(1안) |

### Out of Scope

| 항목 | 비고 |
|------|------|
| Google Search Console / Naver **verification** meta·env | 수동 등록만 |
| `/`, `/terms-of-service`, `/privacy-policy` SEO | Out |
| `/dashboard/**` index 허용 | 보안·내부 시스템 — **noindex 유지** |
| 루트 **랜딩 페이지** 신규 | Out |
| BE Route · SQL · RLS · activity log | Out |
| sign-in **기능** 변경(인증·redirect·force-password) | Out |
| OG 이미지 **신규 디자인** | 기존 `/assets/opengraph-image.png` **재사용** |
| hreflang·다국어 | Out (ko 단일) |
| 성능·Core Web Vitals 전용 작업 | Out (회귀만 verifier build로) |

---

## 활동 감사 로그

**activity log 해당 없음** — 본 plan은 metadata·정적 HTML·JSON-LD만 변경. 신규 mutation·`recordActivityLog` 연동 없음. (plan 45 `auth.sign_in`은 기존 sign-in API — **변경 없음**)

---

## metadata & SEO 요구사항 (WHAT)

### Title (sign-in layout)

- 패턴 예: `WakeOne 로그인 | 웨이크원 · 주식회사 웨이크 임직원 포털` 또는 동등
- **절대 title** (`title.absolute`) — sign-in 전용
- 브랜드 영문·한글·「로그인」 포함

### Description

- 120~160자(한국어). 포함 키워드(자연스럽게): WakeOne, 웨이크원, (주)웨이크 / 주식회사 웨이크, 웨이크 임직원, wakecorp 로그인, 내부 업무 시스템
- 전역 `SITE_DESCRIPTION`(식대·생일)은 sign-in에 **재사용하지 않음** — 로그인·브랜드 중심 copy

### Keywords (meta)

- 배열 8~15개: `WakeOne`, `웨이크원`, `wakeone 로그인`, `웨이크원 로그인`, `wakecorp 로그인`, `웨이크 임직원`, `주식회사 웨이크`, `(주)웨이크`, `Wake Corp`, `wakecorp.com` 등
- stuffing 금지 — layout `keywords` 필드만

### Open Graph / Twitter

- `url`: `{SITE_URL}/auth/sign-in`
- `title` / `description`: sign-in 전용(위와 동일 계열)
- `images`: 기존 OG image 경로 유지

### Robots 계층 (명확화)

| Segment | index | follow | 근거 |
|---------|-------|--------|------|
| `/` (root layout) | false | false | `site-metadata.ts` — 내부 앱 기본 |
| `/auth/sign-in` | **true** | **true** | `auth/sign-in/layout.tsx` override |
| `/dashboard/**` | false | false | `dashboard/layout.tsx` |
| `robots.txt` | — | disallow `/dashboard`, `/auth/forgot-password`, `/v1/` | sign-in **미 disallow** |

### JSON-LD (Organization + WebSite)

참고 패턴: [code4mk/nextjs-app-router-seo-example](https://github.com/code4mk/nextjs-app-router-seo-example)

최소 필드:

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "{SITE_URL}/#organization",
      "name": "주식회사 웨이크",
      "alternateName": ["Wake Corp", "WakeOne", "웨이크원"],
      "url": "{SITE_URL}",
      "logo": "{SITE_URL}/assets/opengraph-image.png"
    },
    {
      "@type": "WebSite",
      "@id": "{SITE_URL}/#website",
      "url": "{SITE_URL}",
      "name": "WakeOne",
      "description": "{SIGN_IN_DESCRIPTION}",
      "publisher": { "@id": "{SITE_URL}/#organization" },
      "inLanguage": "ko-KR"
    }
  ]
}
```

- 렌더: sign-in `layout.tsx` 또는 전용 Server Component — `<script type="application/ld+json">` (RSC)
- **`dangerouslySetInnerHTML`** + `JSON.stringify` — XSS 방지를 위해 **상수만** 직렬화(사용자 입력 없음)

---

## UI 요구사항 (designer → FE)

### 레이아웃 원칙

- 기존 **2-column** (`lg:grid lg:grid-cols-2`) **유지** — plan 34 desktop/mobile stack **회귀 금지**
- **H1「로그인」** + 기존 부제「아이디와 비밀번호로 로그인하세요.」**유지**
- intro copy는 **로그인 폼 위** — 모바일에서 첫 스크롤 전에 브랜드 문구 일부 노출

### 모바일 visible intro (필수)

- viewport `< lg`에서도 표시되는 intro 블록 (예: 로고/「WakeOne」+ 1~2문단)
- copy 예시 방향(최종 문구는 designer/FE 합의):
  - WakeOne(웨이크원)은 **주식회사 웨이크(Wake Corp)** 임직원을 위한 내부 업무 포털입니다.
  - **wakecorp.com** 계정으로 로그인하여 대시보드를 이용하세요.
- 키워드는 **문장 속**에만 — 목록 나열 UI **금지**

### Desktop lg 패널

- 기존 좌측 패널 blockquote copy를 sign-in SEO 톤과 **정렬**(식대/생일 중심 → **로그인·브랜드·임직원 포털**)
- `InteractiveGridPattern`·브랜드 헤더 **유지**

### 시맨틱 HTML

| 요소 | 권장 |
|------|------|
| 래퍼 | `<main>` (페이지 단일 main) |
| intro | `<section aria-label="WakeOne 소개">` |
| 브랜드 제목 | `<h2>` 또는 `<p className="font-semibold">` — H1은「로그인」only |
| 본문 | `<p>` 1~2개 |
| 폼 영역 | `<section aria-label="로그인 폼">` |

### designer 산출 (AC)

| # | Given | When | Then |
|---|-------|------|------|
| D1 | designer 목업 | mobile `< lg` viewport | intro 블록·H1·CTA(로그인 버튼) **위계**가 한 화면에 들어오도록 compact |
| D2 | designer 목업 | desktop `≥ lg` | 좌측 패널 copy와 우측 폼 **톤 일치** |

---

## API / DB 요구사항

**해당 없음 (Out)** — Supabase·Route Handler·RLS·스키마 변경 없음.

---

## 영향 파일 (예상)

### Lib / SEO

| 파일 | 작업 |
|------|------|
| `src/lib/site-metadata.ts` | sign-in 전용 title/description/keywords 상수 export; 전역 noindex **유지** |
| `src/lib/sign-in-json-ld.ts` (신규, 권장) | JSON-LD 객체 생성 pure function — layout에서 import |

### App Router

| 파일 | 작업 |
|------|------|
| `src/app/auth/sign-in/layout.tsx` | metadata 강화 + JSON-LD script |
| `src/app/layout.tsx` | 변경 **없음** (주석 optional) |
| `src/app/dashboard/layout.tsx` | 변경 **없음** |
| `src/app/sitemap.ts` | 변경 **최소/없음** |
| `src/app/robots.ts` | 변경 **최소/없음** |

### Feature UI

| 파일 | 작업 |
|------|------|
| `src/features/auth/components/sign-in-view.tsx` | main/section/intro copy/mobile visible 블록 |
| `src/features/auth/components/user-auth-form.tsx` | 변경 **없음** (회귀만) |

### E2E

| 파일 | 작업 |
|------|------|
| `e2e/seo/sign-in-seo.spec.ts` | **신규** — 본 plan AC |
| `e2e/auth/sign-in-email-split.spec.ts` | **회귀** — green 유지 |

### Docs

| 파일 | 작업 |
|------|------|
| `docs/plans/README.md` | 46번 등록 |

---

## 실행 순서

1. **designer** — mobile intro + desktop 패널 copy 목업 1안
2. **FE** — `site-metadata` sign-in 상수 → `sign-in/layout.tsx` metadata + JSON-LD
3. **FE** — `sign-in-view.tsx` 시맨틱 HTML + mobile intro
4. **FE** — `e2e/seo/sign-in-seo.spec.ts` 작성
5. **verifier** — spec green · `sign-in-email-split` 회귀 · tsc · lint · build

**backend-dev:** **생략** (BE 변경 없음)

---

## Acceptance Criteria (Given-When-Then)

> 검증: `bunx playwright test e2e/seo/sign-in-seo.spec.ts`  
> 회귀: `bunx playwright test e2e/auth/sign-in-email-split.spec.ts`  
> storageState: **없음** (비로그인 public page)

### Metadata & robots

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| 1 | Playwright | 비로그인 | `GET /auth/sign-in` | `document.title`에 **「로그인」** 및 **「WakeOne」 또는 「웨이크원」** 포함 |
| 2 | Playwright | 비로그인 | 동일 | `meta[name="description"]` content에 **「웨이크」** 및 **「로그인」** 포함 · 길이 **≥ 80자** |
| 3 | Playwright | 비로그인 | 동일 | `meta[name="keywords"]` content에 **`wakeone`**(대소문자 무관) 및 **`wakecorp`** 포함 |
| 4 | Playwright | 비로그인 | 동일 | `link[rel="canonical"]` href가 `{baseURL}/auth/sign-in` (**trailing slash 정책은 앱 convention 따름**) |
| 5 | Playwright | 비로그인 | 동일 | `meta[name="robots"]` content에 **`index`** 포함(또는 robots meta **부재** 시 layout index 정책 — 구현 시 **하나**로 통일하고 spec 고정) |

### JSON-LD

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| 6 | Playwright | 비로그인 | `/auth/sign-in` | `script[type="application/ld+json"]` **1개 이상** · parse 결과 `@graph` 또는 `@type` **`WebSite`** 포함 |
| 7 | Playwright | AC-6 JSON | parse | **`Organization`** 노드 존재 · `name` 또는 `alternateName`에 **웨이크** 또는 **Wake** 계열 문자열 포함 |

### Visible HTML copy

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| 8 | Playwright | 비로그인 · desktop | `/auth/sign-in` | `getByRole('heading', { name: '로그인' })` **visible** |
| 9 | Playwright | 비로그인 · **mobile** viewport `375×667` | `/auth/sign-in` | `getByText(/웨이크원|WakeOne/i)` **visible** · `getByText(/주식회사 웨이크|Wake Corp/i)` **visible** |
| 10 | Playwright | 비로그인 · mobile | 동일 | `getByText(/wakecorp/i)` **visible** (도메인 또는 「wakecorp 로그인」계열) |
| 11 | Playwright | 비로그인 | `/auth/sign-in` | `main` 랜드마크 **exist** · intro `section` 또는 `getByRole('region')` **exist** |

### 회귀 (plan 34)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| 12 | Playwright | 비로그인 | `/auth/sign-in` | `getByRole('textbox', { name: '아이디' })` · `getByTestId('login-domain-combobox')` **visible** — plan 34 AC-1 **유지** |

### sitemap / robots (선택 · API 수준)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| 13 | Playwright request | — | `GET /sitemap.xml` | 응답 body에 **`/auth/sign-in`** URL 포함 |
| 14 | Playwright request | — | `GET /robots.txt` | **`Disallow: /dashboard`** 포함 · **`Disallow: /auth/sign-in`** **미포함** |

### Build

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| 15 | CLI | 구현 완료 | `bun run build` | exit 0 |

---

## E2E spec 구조 (verifier용)

```
e2e/seo/sign-in-seo.spec.ts
├── test.use({ storageState: { cookies: [], origins: [] } })
├── test.describe('sign-in SEO metadata')
│   ├── test('AC-1~5: title, description, keywords, canonical, robots')
├── test.describe('sign-in JSON-LD')
│   ├── test('AC-6~7: WebSite + Organization graph')
├── test.describe('sign-in visible copy')
│   ├── test('AC-8: desktop heading')
│   ├── test('AC-9~11: mobile intro + main landmark')
├── test.describe('sign-in SEO regression')
│   ├── test('AC-12: email split form visible')
└── test.describe('sign-in sitemap robots')
    ├── test('AC-13~14: sitemap.xml + robots.txt')  // optional group
```

**셀렉터 규칙:** `getByRole` · `getByTestId` · meta/link locator — CSS class·DOM depth **금지** (core-conventions E2E).

---

## 환경 변수

| 변수 | 용도 |
|------|------|
| `NEXT_PUBLIC_SITE_URL` | canonical·JSON-LD·sitemap base (**기존**) |
| GSC/Naver verification | **미사용 (Out)** |

---

## 열린 질문

| # | 항목 | 기본값 |
|---|------|--------|
| 1 | `WebSite.potentialAction` SearchAction | **Out** — 사이트 내 검색 URL 없음 |
| 2 | sign-in intro copy 최종 문장 | designer 1안 → FE 구현 (키워드 표 §참고) |
| 3 | meta robots를 explicit meta tag vs Next Metadata API | FE — AC-5 assert 방식에 맞춰 **하나** 선택 |

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-08-31 | 최초 작성 · deep-interview 확정 반영 · Status Approved | planner |
