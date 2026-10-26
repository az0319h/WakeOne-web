# 퀵 권한 안내 ⓘ 패널 · 사용자 관리 안내 한국어화 기획서
> Date: 2026-10-22
> Status: Completed
> Author: planner

## 한 줄 요약

퀵 대시보드(`/dashboard/quick`)와 퀵 요청 상세(`/dashboard/quick/[requestNo]`) 제목 옆에 ⓘ 버튼을 둔다. 버튼을 누르면 오른쪽 info 패널에 **「누가 어떤 퀵을 볼 수 있고, 무엇을 할 수 있는지」**를 쉬운 한국어로 보여 준다. 모든 사람에게 같은 내용이다. 공용 info 패널 타입에는 **목록(•)과 강조 상자**를 하위 호환으로 추가한다. 같은 김에 「사용자 관리」 ⓘ 안에 남아 있던 영어 템플릿 글을 **admin용 한국어 실제 설명**으로 바꾼다.

---

## 선행 plan 참조 (Phase 0)

| plan | Status | 가져온 것 / 관계 |
|------|--------|------------------|
| **89** 퀵 업무 흐름·동방특송·오픈채팅 | In Progress | **설명 내용의 유일한 근거.** §권한 매트릭스, D-5(동방특송 allowlist), D-6(동방특송 등록 불가), D-8(상태 이름), D-10(admin 대리), D-11(구매물류팀 전체 조회만), D-14(최근 7일), U-9(동방특송 선택 시 조직 칸 숨김). **권한 규칙은 바꾸지 않고 글로 옮기기만 한다**(확장) |
| 86·87 퀵 요청 화면 | Approved | 퀵 요청하기 화면(`viewportFill`)에는 ⓘ를 두지 않는다(Out). 레이아웃 영향 없음 |
| 57·58 Google 가입 승인·생일 미설정 | Approved | 사용자 관리 안내 문구의 근거: 승인 대기, 승인 Sheet, 생일 비워 두기 가능, 거절 시 이메일 미발송 |
| 76 인사팀 복지비 권한 | Completed | `affiliation + rank` 권한 선례. 구매물류팀 설명에 사용 |
| 08 활동 감사 로그 | — | 이번 작업은 데이터 생성·수정·삭제(CUD)가 없다 → **activity log 해당 없음** |
| (info 패널 관련 plan) | 없음 | `docs/plans` 전체에 infoContent·InfoButton·infobar를 다룬 plan이 없다. 템플릿 원본 상태 |

---

## 정책 확정안 (deep-interview 2026-10-22 사용자 답변)

| # | 항목 | 확정 |
|---|------|------|
| D-1 | 보는 사람별 차이 | **없음.** 일반 직원·구매물류팀·동방특송·admin 모두 **같은 전체 설명**을 본다. 「내 권한」 요약 상자는 **Out** (Q1=A) |
| D-2 | 내용 범위 | 조회 범위 + **할 수 있는 일**(등록·접수·배차완료·수정·최종금액·승인·취소) + 규칙(요청자는 「신규요청」일 때만 취소, 「승인」·「취소」된 건은 아무도 못 바꿈) + **진행 단계 이름 한 줄.** 오픈채팅 발송 시점, 「다시 보내기」·「메시지 복사」 사용법 같은 사용 안내는 **Out** (Q2=B) |
| D-3 | 형태 | 기존 오른쪽 info 패널(데스크톱 사이드 패널 / 모바일 Sheet)을 그대로 쓴다. 공용 `DescriptiveSection`에 **`items`(목록)와 `callout`(강조 상자)만 선택 필드로 추가**한다(하위 호환). 표·대화상자·Popover는 쓰지 않는다 (Q3=B) |
| D-4 | 적용 화면 | **퀵 대시보드 + 퀵 요청 상세**(내용 동일). 퀵 요청하기 화면(`/dashboard/quick/request`)은 **Out** (Q4=B) |
| D-5 | 사용자 관리 ⓘ | `src/features/users/info-content.ts`의 영어 개발자 글을 **admin용 한국어 실제 설명**으로 교체한다 (Q5=B) |
| D-6 | 공용 패널의 영어 잔재 | 버튼 이름 「Show information」, 링크 묶음 제목 「Learn more」, 빈 상태 「No content available」, Cmd/Ctrl+I 기본 패널 「Documentation / Getting Started」는 **이번 범위 Out**. 후속 plan `[TBD]` (§리스크 R-4) |
| D-7 | 링크 | 퀵 안내와 사용자 관리 안내 모두 **링크 0개.** 동방특송이 금지된 페이지로 가는 길을 원천적으로 없앤다 |
| D-8 | 문구 관리 | 문구는 `InfobarContent` 상수 파일 한 곳에 둔다. 권한 규칙이 바뀌면 이 파일도 같이 고쳐야 한다는 주석을 단다(근거: plan 89 §권한 매트릭스, `quick-access.server.ts`) |

---

## 목표 & 완료 기준 (AC)

- 판정 도구: Playwright CLI(`npm run test:e2e`). spec 위치 `e2e/quick-info/`(신규), 사용자 관리 회귀는 `e2e/users/`.
- 계정: `admin.json`, `user.json`(일반), `logistics.json`(구매물류팀), `dongbang.json`(동방특송) — plan 89에서 이미 만든 setup을 재사용한다.
- ⓘ 버튼 셀렉터: `getByRole('button', { name: 'Show information' })` (이름표 한국어화는 D-6 Out이라 현재 값 그대로 사용).
- 패널 셀렉터: `[data-slot='infobar']`(기존 속성). 신규 목록·강조 상자는 `[data-slot='info-section-list']`, `[data-slot='info-section-callout']`.
- 「문구 초안 그대로」 = 아래 §문구 초안의 문자열과 **글자 단위로 일치**.

| AC | 방법 | 조건 | 동작 | 기대 결과 |
|----|------|------|------|-----------|
| AC-01 | Playwright | `admin.json`, 데스크톱 1280px | `/dashboard/quick` 진입 → 제목 「퀵 내역」 옆 ⓘ 클릭 | 오른쪽 패널이 열리고 제목 **「퀵 권한 안내」** · 섹션 제목 7개가 §문구 초안 Q-1~Q-7 순서 그대로 |
| AC-02 | Playwright | `user.json` | `/dashboard/quick` → 제목 **「나의 퀵 내역」** 옆 ⓘ 클릭 | 패널 본문 텍스트(`innerText`)가 AC-01의 admin과 **완전히 같음** · 「내 권한」 문자열 **0건** |
| AC-03 | Playwright | `logistics.json`, `dongbang.json` 각각 | `/dashboard/quick` → ⓘ 클릭 | 두 계정 모두 패널 본문이 AC-01과 **같음** (D-1) |
| AC-04 | Playwright | `dongbang.json` | AC-03 패널 상태에서 링크 확인 | 패널 안 `a[href]` **0개** · 「Learn more」 텍스트 **0건** · 「Documentation」 텍스트 **0건** (D-7) |
| AC-05 | Playwright | `admin.json` | 패널 Q-1 섹션 확인 | Q-1 안 `[data-slot='info-section-list'] li` **4개**, 문구 초안 그대로 · Q-2 안 `[data-slot='info-section-callout']` **1개**, 문구 「「승인」 또는 「취소」가 된 요청은 관리자를 포함해 누구도 바꿀 수 없습니다.」 |
| AC-06 | Playwright | `user.json` · 본인 요청 1건(plan 89 helper로 생성) | `/dashboard/quick/{요청번호}` 진입 → 제목 「퀵 요청 상세」 옆 ⓘ 클릭 | 패널 제목 「퀵 권한 안내」 · 본문이 AC-01과 **같음** (D-4) |
| AC-07 | Playwright | `dongbang.json` | `/dashboard/quick/{요청번호}` ⓘ 클릭 | AC-06과 같은 내용 · `a[href]` **0개** |
| AC-08 | Playwright | `admin.json` | `/dashboard/quick` 진입 직후(ⓘ 누르지 않음) Cmd/Ctrl+I 입력 | 패널이 열리고 제목이 **「퀵 권한 안내」**(「Documentation」 아님). 이유: ⓘ 버튼이 마운트될 때 내용을 미리 넣어 둔다(현재 `InfoButton` 동작) |
| AC-09 | Playwright | `user.json` | `/dashboard/quick/request` 진입 | 제목 「🚚 퀵 배송 요청」 옆 ⓘ 버튼 **0개** (D-4 Out 회귀) |
| AC-10 | Playwright | `admin.json`, 모바일 390×844 | `/dashboard/quick` → ⓘ 클릭 | Sheet가 열리고 Q-1~Q-7 모두 보임 · Sheet 안 가로 넘침 없음(`scrollWidth <= clientWidth`) · ⓘ 버튼 터치 영역 **44px 이상** · 닫기(X) 누르면 Sheet 닫힘 |
| AC-11 | Playwright | `admin.json`, 다크 모드(`data-theme` 또는 `colorScheme: 'dark'`) | AC-01 패널 | 강조 상자와 목록 글자가 배경과 구분되어 보임(스크린샷 첨부) · `info-sidebar.tsx` diff에 Tailwind 팔레트 원색 클래스(`bg-blue-500` 등) **0건**, 시맨틱 토큰만 사용 |
| AC-12 | Playwright | `admin.json` | `/dashboard/users` → 제목 「사용자 관리」 옆 ⓘ 클릭 | 패널 제목 **「사용자 관리 안내」** · 섹션 제목 5개가 §문구 초안 U-1~U-5 순서 그대로 · U-4 강조 상자 1개 · `a[href]` **0개** · 「React Query」「nuqs」「Overview」 텍스트 **0건** |
| AC-13 | Playwright | `admin.json` | 링크만 있는 기존 content의 하위 호환은 기본 패널로 확인: ⓘ가 없는 `/dashboard/overview`에서 Cmd/Ctrl+I로 기본 패널(제목 「Documentation」)을 연다. `/dashboard/react-query`는 plan 90 이전부터 `src/config/disabled-routes.ts`(`DISABLED_DASHBOARD_PATHS`)에 있어 `/dashboard/overview`로 리다이렉트되므로 확인 대상이 아니다(리다이렉트 자체는 테스트로 고정) | 「Getting Started」 설명 · 「Learn more」 · 링크(`href=#`, `target=_blank`)가 그대로 보임 · 섹션 자식 순서 `[h3, p, div]` · 목록·강조 상자 요소 **0개** |
| AC-14 | 정적 검사 | — | `rg "Users — React Query" src` | **0건** |
| AC-15 | 정적 검사 | — | `npx tsc --noEmit` · `npm run lint` · `npm run build` | 모두 통과. 기존 `InfobarContent` 사용처(users·react-query·InfoButton·Heading)에 타입 오류 **0건** |

> 타임스탬프·날짜 AC는 없다(설명 패널에 시각 표시 없음).
> 삭제 UI 없음 → AlertModal AC 해당 없음.

---

## 범위 (In / Out)

### In
1. 공용 타입 확장(하위 호환): `DescriptiveSection`에 `items?: string[]`, `callout?: string` 추가. `description`은 선택(`description?: string`)으로 바꾼다. 지금 렌더러가 이미 `section.description &&`로 검사하므로 기존 동작은 같다.
2. `InfoSidebar` 렌더러: 섹션 순서는 **제목 → 설명 → 목록 → 강조 상자 → 링크**. 목록은 `<ul data-slot='info-section-list'>` 안의 `<li>`로, 강조 상자는 `<div data-slot='info-section-callout'>`로 그린다.
3. 퀵 안내 상수 `quickInfoContent`를 신규로 만든다(§문구 초안 Q). 대시보드·상세 `PageContainer`에 `infoContent`로 넘긴다.
4. 사용자 관리 안내 `usersInfoContent`를 한국어로 교체한다(§문구 초안 U).
5. e2e spec 신규(`e2e/quick-info/`)와 사용자 관리 회귀 1건.

### Out
| 항목 | 이유 |
|------|------|
| 「내 권한」 요약 상자, 역할별로 다른 내용 | D-1 (사용자 답변 Q1=A) |
| 오픈채팅 발송 시점·「다시 보내기」·「메시지 복사」·최근 주소 10개 사용법 | D-2 (Q2=B) |
| 표·대화상자·Popover 형태 | D-3 (Q3=B) |
| 퀵 요청하기 화면 ⓘ | D-4 (Q4=B) |
| 공용 패널 영어 잔재(「Show information」·「Learn more」·「No content available」·Cmd+I 기본 「Documentation」 패널) | D-6. 후속 plan `[TBD]` |
| react-query 데모 info 내용 변경 | 데모 페이지(비활성 경로 · overview로 리다이렉트). 하위 호환 회귀는 기본 패널로 확인(AC-13) |
| 권한 규칙 변경, API·DB·SQL | 설명만 바꾸는 작업. BE 작업 없음 |
| activity log | Read 전용 UI. CUD 없음 → **activity log 해당 없음** |

---

## 문구 초안 (확정 문자열 · frontend-dev는 그대로 사용)

> 원칙: 고등학생도 이해할 수 있는 말로 쓰고, 한 문장에 한 가지만 담는다. 상태 이름은 화면 Badge와 같은 「」 표기(`QUICK_REQUEST_STATUS_LABELS`)를 쓴다. 링크는 넣지 않는다.

### Q. 퀵 권한 안내 (`quickInfoContent`)

`title`: **퀵 권한 안내**

**Q-1 · 누가 어떤 퀵을 볼 수 있나요**
- description: `대시보드 목록에는 최근 7일(오늘 포함) 요청만 나옵니다.`
- items:
  1. `일반 직원: 내가 등록한 요청만 볼 수 있습니다.`
  2. `구매물류팀: 모든 직원의 요청을 볼 수 있습니다. 보기만 가능합니다.`
  3. `동방특송: 모든 요청을 볼 수 있습니다.`
  4. `관리자: 모든 요청을 볼 수 있습니다.`

**Q-2 · 진행 단계**
- description: `「신규요청」 → 「접수 및 배차중」 → 「배차완료 및 결과」 → 「승인」 순서로 진행됩니다. 도중에 취소되면 「취소」가 됩니다.`
- callout: `「승인」 또는 「취소」가 된 요청은 관리자를 포함해 누구도 바꿀 수 없습니다.`

**Q-3 · 요청한 사람이 할 수 있는 일**
- description: `일반 직원과 구매물류팀이 내 요청에 대해 할 수 있는 일입니다.`
- items:
  1. `퀵을 등록할 수 있습니다.`
  2. `등록한 뒤에는 내용을 직접 고칠 수 없습니다. 바꿀 내용이 있으면 동방특송 담당자에게 연락해 주세요.`
  3. `「신규요청」 상태일 때만 직접 취소할 수 있습니다. 접수된 뒤에는 동방특송 담당자에게 연락해 주세요.`
  4. `최종금액이 입력되면 금액을 확인하고 승인할 수 있습니다.`

**Q-4 · 동방특송이 할 수 있는 일**
- items:
  1. `요청을 접수하고, 기사가 정해지면 배차완료로 처리합니다. 배차완료 때는 예상금액·차량 정보·기사 이름·기사 연락처를 꼭 입력합니다.`
  2. `승인 전까지 요청 내용과 배차 정보를 고칠 수 있습니다.`
  3. `「배차완료 및 결과」 상태에서 최종금액을 입력합니다.`
  4. `승인 전까지 요청을 취소할 수 있습니다.`
  5. `퀵 등록과 승인은 할 수 없습니다.`

**Q-5 · 관리자가 할 수 있는 일**
- items:
  1. `동방특송이 하는 일(접수·배차완료·수정·최종금액 입력·취소)을 모두 대신할 수 있습니다.`
  2. `퀵을 등록할 수 있고, 모든 요청을 승인할 수 있습니다.`

**Q-6 · 구매물류팀이 할 수 있는 일**
- items:
  1. `다른 사람의 요청은 보기만 할 수 있습니다. 접수·수정·승인·취소는 할 수 없습니다.`
  2. `내 요청은 일반 직원과 똑같이 등록·취소·승인할 수 있습니다.`

**Q-7 · 버튼이 안 보일 때**
- description: `내 역할이나 요청의 진행 단계에서 할 수 없는 일은 버튼이 나타나지 않습니다. 필요한 처리가 있으면 동방특송 담당자나 관리자에게 연락해 주세요.`

**규칙 대응표 (검토용 · 화면에는 넣지 않음)**

| 문구 | 근거 |
|------|------|
| Q-1 | `canViewAllQuickRequests` · RLS `can_view_all_quick_requests` · D-14 |
| Q-2 | `QUICK_REQUEST_STATUS_LABELS` · `isQuickRequestLocked` |
| Q-3-2 | plan 89 AC-22 (요청자 PATCH 403) |
| Q-3-3 | plan 89 매트릭스 취소 행 · `requesterCannotCancel` 메시지 |
| Q-3-4 | `canApproveRole` (요청자·admin) · 승인은 최종금액 필수 |
| Q-4 | `canOperateQuickRequests` · 배차 4필드 필수 · `finalAmountOnlyDispatched` · `canCreateQuickRequest` · `canApproveRole`(동방 false) |
| Q-5 | D-10 · `isQuickAdmin` |
| Q-6 | D-11 · `isLogisticsViewer` |

### U. 사용자 관리 안내 (`usersInfoContent` · admin만 봄)

`title`: **사용자 관리 안내**

**U-1 · 이 화면에서 하는 일**
- description: `Google 계정으로 가입을 신청한 사람을 승인하고, 직원 정보와 계정 상태를 관리합니다. 관리자만 이 화면을 볼 수 있습니다.`

**U-2 · 가입 승인·거절**
- items:
  1. `처음 Google로 로그인한 사람은 「승인 대기」 상태로 표에 나타납니다.`
  2. `「승인」을 누르면 소속·부서/사업장·직급·리더 역할·시스템 역할을 정한 뒤 승인합니다. 생일은 비워 둘 수 있습니다.`
  3. `「거절」하면 「거절됨」 상태가 됩니다. 이메일 알림은 보내지 않습니다.`

**U-3 · 사용자 정보 수정**
- items:
  1. `「활성」 상태인 다른 사용자만 수정할 수 있습니다. 내 계정은 여기서 고칠 수 없습니다.`
  2. `관리자 계정은 아바타 URL과 시스템 역할만 바꿀 수 있습니다.`

**U-4 · 소속을 「동방특송」으로 고를 때**
- description: `동방특송은 퀵 배송을 맡는 외부 업체 직원입니다.`
- callout: `「동방특송」을 고르면 부서·직급·리더 역할·생일 칸이 사라지고 값이 비워집니다. 동방특송 직원은 퀵 화면과 프로필·알림·활동 로그만 이용할 수 있습니다.`
- items:
  1. `시스템 역할은 일반 사용자만 고를 수 있습니다.`
  2. `조직도, 생일 안내, 접속자 목록, 공지 알림, 복지비 명단에는 나타나지 않습니다.`

**U-5 · 비활성화와 다시 활성화**
- items:
  1. `비활성화하면 그 사람은 바로 로그아웃되고 다시 로그인할 수 없습니다.`
  2. `「활성화」를 누르면 다시 Google 로그인으로 들어올 수 있습니다.`
  3. `내 계정은 비활성화할 수 없습니다.`

**규칙 대응표 (검토용)**: U-2 ← plan 57·58, `cell-action.tsx` 거절 AlertModal 문구 / U-3 ← `canEdit = isActive && !isSelf`, `user-form-sheet.tsx` `isAdminTarget` 설명 / U-4 ← plan 89 D-4·D-5·U-9, `DONGBANG_SYSTEM_ROLE_DESCRIPTION` / U-5 ← `canDeactivate`·`canReactivate`, 비활성화·활성화 AlertModal 문구

---

## 영향 파일 & 패턴

| 구분 | 파일 | 변경 |
|------|------|------|
| 공용 타입 | `src/components/ui/infobar.tsx` | `DescriptiveSection`에 `items?`·`callout?` 추가, `description?` 선택화. 그 밖의 로직은 그대로 |
| 공용 렌더러 | `src/components/layout/info-sidebar.tsx` | 목록·강조 상자 렌더 추가(시맨틱 토큰만). 기존 링크 블록·「Learn more」·기본 데이터는 **그대로**(D-6 Out) |
| 퀵 상수(신규) | `src/features/quick-request/info-content.ts` | `quickInfoContent` (users 패턴과 같은 위치 규칙). 맨 위 주석에 plan 89 §권한 매트릭스·`quick-access.server.ts`와 같이 고칠 것을 적는다 |
| 퀵 페이지 | `src/app/dashboard/quick/page.tsx`, `src/app/dashboard/quick/[requestNo]/page.tsx` | `infoContent={quickInfoContent}` 한 줄씩 추가 |
| 사용자 관리 | `src/features/users/info-content.ts` | 내용 전체 교체(§문구 초안 U) |
| e2e | `e2e/quick-info/info-panel.spec.ts`(신규), `e2e/users/info-panel.spec.ts`(신규) | AC-01~13 |

**따를 패턴**
- `PageContainer` → `Heading` → `InfoButton` → `useInfobar().setContent/setOpen` → `InfoSidebar`. 새 컴포넌트나 Popover를 만들지 않는다.
- 상수는 `InfobarContent` 타입의 `export const`로 둔다(`usersInfoContent`, `reactQueryInfoContent` 선례). 서버 컴포넌트 page에서 import해 prop으로 넘긴다. 직렬화 가능한 문자열만 쓰므로 RSC 경계 문제는 없다.
- 색은 `text-muted-foreground`, `bg-muted`, `border` 같은 시맨틱 토큰만 쓴다(core-conventions).

**의존·호출자**
- `InfobarContent` 사용처: `heading.tsx`, `page-container.tsx`, `info-button.tsx`, `info-sidebar.tsx`, users·react-query info-content. 모두 선택 필드 추가라서 깨지지 않는다(AC-13·15).

---

## UI 요구사항 (designer 지시)

| # | 위치 | 요구 |
|---|------|------|
| UI-1 | ⓘ 위치 | 기존 `Heading`의 제목 오른쪽 `InfoButton`을 그대로 쓴다. 대시보드는 「퀵 내역」/「나의 퀵 내역」, 상세는 「퀵 요청 상세」 옆이다. 우측 `pageHeaderAction` 버튼(「퀵 요청하기」, 「목록으로」)과 겹치지 않아야 하며, 모바일에서 제목이 길어도 ⓘ가 줄바꿈으로 밀려 사라지지 않아야 한다 |
| UI-2 | 목록 | `•` 글머리표가 있는 `ul`. 항목 사이 간격은 `gap-1.5` 수준. 글자 크기·색은 기존 description과 같다(`text-sm text-muted-foreground`). 긴 문장은 자연스럽게 줄바꿈한다(`break-keep` 권장) |
| UI-3 | 강조 상자 | 목록 아래, 링크 위에 둔다. 연한 배경(`bg-muted`) + 테두리 + 둥근 모서리 + 안쪽 여백. 글자는 `text-foreground text-sm`. 아이콘은 선택(`Icons.info` 등 기존 세트만). 다크 모드에서도 구분되어야 한다 |
| UI-4 | 패널 폭 | 기존 22rem(352px) 유지. 표는 쓰지 않는다 |
| UI-5 | 모바일 | 기존 Sheet 동작 유지. ⓘ 터치 영역 44px 이상이 안 되면 `Heading` 안 래퍼로 보정한다(퀵 페이지 한정 prop을 추가하지 않고 공용으로 보정 가능하면 공용으로) |

---

## API / DB 요구사항

없음. BE·SQL·Route 변경 없음. backend-dev 단계는 **해당 없음**으로 건너뛴다.

## 활동 감사 로그

**activity log 해당 없음.** 설명을 보여 주기만 하는 Read 전용 UI이고 CUD가 없다.

---

## 리스크 & 완화책

| # | 등급 | 리스크 | 완화 |
|---|------|--------|------|
| R-1 | HIGH | 나중에 퀵 권한 규칙이 바뀌었는데 안내 문구를 안 고쳐서 **설명이 틀려짐** | 문구를 `quick-request/info-content.ts` 한 곳에만 둔다. 파일 머리와 `quick-access.server.ts`에 「권한을 바꾸면 info-content도 고칠 것」 상호 주석을 단다. §규칙 대응표를 plan에 남긴다 |
| R-2 | MED | 공용 타입을 바꿨는데 기존 패널(react-query 데모·users)이 깨짐 | 필드는 **선택 추가만** 한다. AC-13(기본 패널 회귀)·AC-15(tsc·build) |
| R-3 | MED | 모바일 상세 화면에서 제목 + ⓘ + 「목록으로」가 한 줄에 다 안 들어감 | UI-1·AC-10. 필요하면 `Heading` flex 줄바꿈 보정 |
| R-4 | LOW | 공용 패널의 영어 잔재(「Show information」·「Learn more」·Cmd+I 기본 「Documentation」)가 남아, ⓘ가 없는 페이지에서 Cmd+I를 누르면 동방특송도 영어 템플릿 패널을 볼 수 있음(링크가 `#`라 금지 페이지 이동은 없음) | 이번 범위 Out(D-6). 퀵 두 화면에서는 ⓘ가 마운트될 때 내용을 미리 넣어서 Cmd+I도 「퀵 권한 안내」가 열린다(AC-08). **후속 plan `[TBD]`**에서 한국어화와 기본 패널 비활성화를 다룬다 |
| R-5 | LOW | 구매물류팀이 「보기만 가능」 문구를 보고 자기 요청 승인도 못 한다고 오해 | Q-6-2에 「내 요청은 일반 직원과 똑같이」를 따로 적었다 |

---

## 추정 & 단계

- 범위: 수정 5파일 + 신규 1파일 + spec 2파일, 약 250~350줄(문구·spec 포함)
- 복잡도: **Simple**
- 예상 시간: ~60~90분 (designer 10 · FE 30~40 · verifier 20~40)

| 단계 | 담당 | 내용 | 신뢰도 |
|------|------|------|--------|
| 1 | designer | UI-1~5 확정(목록·강조 상자 스타일, 모바일 제목 줄) | HIGH |
| 2 | frontend-dev | 타입 확장 → `info-sidebar` 렌더 → tsc 체크포인트 | HIGH |
| 3 | frontend-dev | `quickInfoContent` 신규·퀵 두 페이지 연결·users 문구 교체 | HIGH |
| 4 | verifier | spec(AC-01~13) → tsc → lint → build | HIGH |

체크포인트: 2단계 후 tsc 통과 확인(기존 사용처 무손상).
롤백: 변경 파일이 FE 6개뿐이고 DB 변경이 없으므로 git revert 한 번으로 원복할 수 있다.

---

## 열린 질문

| # | 질문 | 현재 처리 |
|---|------|-----------|
| OQ-1 | 공용 info 패널 영어 잔재 한국어화·Cmd+I 기본 패널 제거는 언제 하나요 | 후속 plan `[TBD]` (R-4) |
| OQ-2 | 퀵 요청하기 화면에도 안내가 필요해지면 어떤 내용을 넣나요(사용 안내 중심?) | 후속 plan `[TBD]` |

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-10-22 | 최초 작성. deep-interview 답변 Q1=A(모두 같은 설명), Q2=B(조회+할 수 있는 일+단계 이름), Q3=B(기존 패널 + 목록·강조 상자 하위 호환), Q4=B(대시보드+상세), Q5=B(사용자 관리 한국어화, 공용 영어 잔재 Out) 반영. 문구 초안 포함. Status Approved(/root 단일 게이트 규칙). 사용자 지시로 기획만 진행하고 구현은 사용자 지시 시 진행 | planner |
| 2026-10-22 | verifier 「기획 문제」 반영. AC-13 정정: `/dashboard/react-query`는 plan 90 이전부터 `DISABLED_DASHBOARD_PATHS`로 `/dashboard/overview`에 리다이렉트되어 확인 불가 → 링크만 있는 기존 content의 하위 호환을 `/dashboard/overview` 기본 패널(Cmd/Ctrl+I · 「Documentation」)로 확인하도록 변경(Out 표·R-2 표기 동기화). e2e 「사용자 관리」 heading 선택자에 `exact: true` 추가(접힌 info 패널의 h2가 접근성 트리에 남는 기존 동작 때문). 구현·자동 검증 완료(AC 15/15 · DB 변경 없음) → Status Completed. 후속 과제 [TBD]: 접힌 패널 inert 처리 · 공용 패널 영어 문구 · Cmd+I 이동 직후 이슈(R-4) | planner |
| 2026-10-22 | plan 92에서 오픈채팅 기능 삭제 → D-2 Out 표의 「오픈채팅 발송 시점·다시 보내기·메시지 복사」 항목은 대상 기능이 없어져 무효. `info-content.ts` 변경 없음. plan 93 구현 시 「할 수 있는 일」에 「요청 대화」 1줄 추가 예정(93 U-8) | planner |
