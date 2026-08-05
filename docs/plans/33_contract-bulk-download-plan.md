# 계약서 첨부 ZIP 일괄 다운로드

> Date: 2026-08-05
> Status: Approved
> Author: planner
> **선행:** [16](./16_contract-management-plan.md), [18](./18_contract-approved-at-plan.md)

## 한 줄 요약

admin이 `/dashboard/contracts`에서 **문서승인일 범위**를 선택하면, 해당 기간 **첨부완료** 계약의 활성 첨부파일을 **ZIP**으로 일괄 다운로드한다. 확인 Dialog·preview·100건/200MB 상한 포함.

## 완료 기준 (AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| AC-01 | 수동 | admin, 문서승인일 from/to 선택 | 「첨부 ZIP 다운로드」 클릭 | 확인 Dialog에 기간·건수·용량 요약이 표시된다 |
| AC-02 | 수동 | preview에서 대상 1건 이상·상한 이내 | 「다운로드」 확인 | `contracts-{from}_{to}.zip` 저장, 내부 `{문서번호}/원본파일명` 구조 |
| AC-03 | 수동 | 날짜 미선택 | 버튼 클릭 | disabled, tooltip 안내 |
| AC-04 | 수동 | 첨부완료 0건 | Dialog 열기 | 다운로드 버튼 disabled, 안내 문구 |
| AC-05 | 수동 | 100건 초과 또는 200MB 초과 | Dialog preview | 다운로드 disabled, 상한 안내 |
| AC-06 | 수동 | `system_role=user` | bulk-download API | HTTP 403 |

## 범위

### In
- `GET /api/contracts/attachments/bulk-download/preview`
- `GET /api/contracts/attachments/bulk-download` (ZIP stream, `archiver`)
- UI: 문서승인일 옆 버튼 + `Modal` 확인 Dialog

### Out
- activity log (READ)
- verifier E2E (사용자 로컬 테스트)
- 비-admin 접근

## 상한

- 최대 **100건** (첨부완료 계약)
- 최대 **200MB** (활성 첨부 총량)
