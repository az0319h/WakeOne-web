# Global KBar Search 기획서 (nav-only · v2)

> Date: 2026-08-03  
> Status: **Revised — nav-only**  
> Author: planner  
> **선행:** [07](./07_auth-route-guard-plan.md), [nav-rbac.md](../nav-rbac.md)

## 변경 요약 (2026-08-03 v2)

사용자 요청에 따라 **Phase B(엔티티 키워드 검색) 전면 Out**. Cmd+K는 **페이지 네비게이션 + theme toggle**만 제공한다. RBAC은 `useFilteredNavGroups`로 sidebar와 동일하게 **권한 있는 페이지만** kbar에 노출한다.

**검증:** verifier/E2E 자동 실행 **생략** — 사용자 직접 검증.

---

## PRD

### Problem

Cmd+K(kbar)로 대시보드 내 페이지로 빠르게 이동하고 theme을 전환할 수 있어야 한다. **권한 없는 admin 전용 페이지는 검색 결과에 나타나면 안 된다.**

### Users & goals

| Actor | Goal |
|-------|------|
| **모든 로그인 사용자** | ⌘K로 RBAC 허용 페이지로 즉시 이동 |
| **admin** | user와 동일 UX + admin 전용 nav(사용자·계약·이메일 로그 등) **nav action으로만** 접근 |

### Functional requirements

1. nav synonym keywords + **page quick-nav** (RBAC 필터)
2. theme toggle **유지**
3. **엔티티/키워드 검색 Out** (계약서·이메일 로그·사용자 등 데이터 검색 없음)
4. kbar **CUD Out** (theme toggle 제외)

---

## 정책 확정안

| 항목 | 확정 |
|------|------|
| **Nav search** | `useFilteredNavGroups(navGroups)` — sidebar와 **동일 RBAC** |
| **Theme** | 기존 `useThemeSwitching` 유지 |
| **Entity search** | **Out** — contracts/email-logs/users/notifications 등 |
| **CUD in kbar** | **Out** (theme만) |
| **Activity logs** | kbar **nav only** (`/dashboard/logs`) |

---

## 목표 & 완료 기준 (AC)

### Phase A — Nav + theme (유일 In Scope)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| A-1 | Manual | `system_role=user` | ⌘K → `지갑` → 선택 | URL **`/dashboard/wallet`** |
| A-2 | Manual | user | ⌘K → `계약` 입력 | **계약서 nav action 없음** |
| A-3 | Manual | admin | ⌘K → **「계약서 관리」** 선택 | URL **`/dashboard/contracts`** · `search` param **없음** |
| A-4 | Manual | admin | ⌘K → **「독촉 이메일 로그」** 선택 | URL **`/dashboard/system-email-logs`** |
| A-5 | Manual | admin/user | ⌘K → **「활동 로그」** 선택 | URL **`/dashboard/logs`** |
| A-6 | Manual | admin/user | ⌘K → **「알림」** 선택 | URL **`/dashboard/notifications`** |
| A-7 | Manual | admin/user | ⌘K → **「프로필」** 선택 | URL **`/dashboard/profile`** |
| A-8 | Manual | admin | ⌘K → **「사용자 관리」** 선택 | URL **`/dashboard/users`** |
| A-9 | Manual | admin/user | ⌘K → Theme action 선택 | theme 변경 · navigate 없음 |
| A-10 | Manual | user | ⌘K → `롯데렌탈` 입력 | **nav 결과 없음** |

### Phase B — **Out (취소)**

계약서·독촉 이메일 로그 kbar entity search 및 관련 API/E2E **구현하지 않음**.

---

## 범위 (In / Out)

### In Scope

| 영역 | 내용 |
|------|------|
| kbar nav | synonym keyword · quick-nav · RBAC filter |
| theme | dark/light toggle 유지 |

### Out of Scope

| 항목 | 비고 |
|------|------|
| contracts/email-logs **kbar entity search** | v2 Out |
| users · notifications · activity-logs entity search | Out |
| kbar CUD | Out |
| verifier 자동 실행 | 사용자 직접 검증 |

---

## RBAC Matrix

| kbar action | user | admin |
|-------------|------|-------|
| Nav (허용 페이지) | ✅ | ✅ |
| Theme | ✅ | ✅ |
| Admin-only nav | ❌ hidden | ✅ |
| Entity keyword search | ❌ | ❌ |

---

## 영향 파일

| 파일 | 변경 |
|------|------|
| `src/components/kbar/index.tsx` | nav-only · entity provider 제거 |
| `src/components/kbar/render-result.tsx` | KBarResults only |
| `src/components/kbar/use-kbar-entity-search.tsx` 등 | **삭제** |
| `src/app/dashboard/layout.tsx` | `KBar`에서 `isAdmin` prop 제거 |
| `e2e/kbar/nav*.spec.ts` | Phase A만 유지 (선택 실행) |

---

## 활동 감사 로그

**해당 없음** — READ·navigate only.

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-08-03 | 최초 작성 (Approved) — Phase A + B | planner |
| 2026-08-03 | **v2 Revised** — Phase B Out · nav+theme+RBAC only · verifier 생략 | root |
