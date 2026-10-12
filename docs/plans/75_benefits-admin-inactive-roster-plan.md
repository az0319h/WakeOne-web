> Date: 2026-10-12
> Status: Approved
> Author: planner (user policy confirmed)

# 복지비 관리 — 비활성 구성원 월별 노출 기획서

## 범위

- **In:** `/dashboard/benefits` · `GET /api/benefits` · `listBenefitsAdmin` · admin 테이블 UI
- **Out:** 계약서 관리 · 내 복지비 · Gmail import(활성 이름 매칭 유지) · 조직도

## 정책 (KST `YYYY-MM`)

| 조건 | 노출 |
|------|------|
| `profiles.status = active` | 조회 월과 무관하게 기존 조직도 명단 규칙 |
| `inactive` + `deactivated_at` | **조회 월 M ≤ 비활성 월 D** 일 때만 명단 포함 |
| `inactive` + **M > D** | 명단 **제외** (예: 10월 비활성 → 11월 조회 시 없음) |
| UI | 명단에 있는 **비활성** 구성원 행은 **모든 조회 월**에서 **연한 빨간 배경** |

## AC (Given-When-Then)

| ID | Given | When | Then |
|----|-------|------|------|
| AC-01 | admin · U가 2026-10에 `deactivated_at` · 2026-08~10 복지 데이터 | `month=2026-08` 조회 | U 행 표시 · `is_inactive_profile` · 연한 빨강 |
| AC-02 | 동일 U | `month=2026-10` 조회 | U 행·문서 표시 · 연한 빨강 |
| AC-03 | 동일 U | `month=2026-11` 조회 | U 행 **없음** |
| AC-04 | 활성 구성원 V | 임의 `month` | V 행 연한 빨강 **아님** (한도 초과만 기존 강조) |
| AC-05 | admin | `/dashboard/contracts` | 본 정책 **미적용** (회귀 없음) |

## activity_logs

- Read-only API 변경 · **신규 mutation 없음** · 로그 AC 없음
