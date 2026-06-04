# 기획 문서 (`docs/plans/`)

`supabase/sql/`와 같이 **접두 번호**로 순서·시기를 파악한다.

## 문서 메타 (필수 — 파일 상단)

기획서·SQL **최상단**에 아래 블록을 둔다. 에이전트는 **Status**로 다음 작업 여부를 판단한다.

```md
> Date: YYYY-MM-DD
> Status: Completed | In Progress | Approved | Cancelled
> Author: planner | backend-dev | …
```

| Status | 의미 |
|--------|------|
| **Completed** | 기획·구현·원격 Supabase migration까지 완료. 후속 plan으로 넘김 |
| **In Progress** | 구현·SQL 적용은 됐으나 AC/Playwright 등 **검증 미완** |
| **Approved** | 기획만 승인, **구현 전** |
| **Cancelled** | 폐기·롤백. 번호는 재사용하지 않음 |

대응 SQL: `supabase/sql/NN_*.sql` 상단에 동일 **Status** + `Plan: NN_*-plan.md` 링크.

## 파일명 규칙

```
{NN}_{feature-slug}-plan.md
```

| 부분 | 규칙 | 예 |
|------|------|-----|
| `NN` | 두 자리 순번 (`01`, `02`, …). **기존 최대값 + 1** | `01`, `02` |
| `feature-slug` | kebab-case, 영문 | `supabase-auth-login` |
| 접미사 | 항상 `-plan.md` | — |

**신규 문서:** `docs/plans/`에서 `NN_` 접두 최대값을 찾은 뒤 **+1** (중간 번호 재사용·삭제된 번호 채우기 금지).

**취소·폐기:** 파일 삭제. 번호는 재사용하지 않는다 (감사·히스토리용).

## 현재 등록

| 번호 | 파일 | Status |
|------|------|--------|
| 01 | [01_supabase-auth-login-plan.md](./01_supabase-auth-login-plan.md) | **Completed** · PR #7 merge |
| 02 | [02_user-invite-profiles-plan.md](./02_user-invite-profiles-plan.md) | **Completed** |

## 에이전트 참조

- 오케스트레이터·planner·verifier는 사용자가 지정한 **plan 파일 경로** 또는 `@docs/plans/01_...` 로 참조한다.
- `{feature}-plan.md` 슬러그만으로 자동 추측해 **신규 기획을 만들지 않는다** (`/run` 시 필수).
