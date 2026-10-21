# 워크플로우(전자결재) 1단계 — 지출결의서 기획서
> Date: 2026-10-21
> Status: Approved
> Author: planner
> **SQL 예정:** `86`~`88` (`supabase/sql/86_workflow_core.sql` · `87_workflow_rpc.sql` · `88_workflow_expense_seed.sql`). 현재 실제 최대는 `85`이며, backend-dev가 `list_migrations`로 최종 번호를 확인한다. **Dev DB만** 적용한다.
> **선행:** [07](./07_auth-route-guard-plan.md), [08](./08_activity-audit-log-plan.md), [14](./14_delete-confirm-dialog-plan.md), [26](./26_loading-spinner-unification-plan.md), [27](./27_in-app-notifications-user-update-plan.md), [37](./37_notifications-read-optimistic-update-plan.md), [38](./38_contract-attachment-size-limit-plan.md), [39](./39_announcements-plan.md), [40](./40_filter-shell-loading-ux-plan.md), [43](./43_cs-support-comments-notifications-plan.md), [49](./49_live-users-presence-plan.md), [53](./53_contract-attachment-direct-upload-plan.md), [72](./72_contract-attachment-modal-viewer-plan.md), [76](./76_hr-benefits-manager-access-plan.md), [82](./82_quick-request-plan.md)
> **조사 자료:** [FINDINGS.md](../research/flex-workflow/FINDINGS.md) (flex 화면·데이터 모델·API) · [PERMISSIONS.md](../research/flex-workflow/PERMISSIONS.md) (권한, **사용자 확정**) · flex 스크린샷 `/Users/hoon/Desktop/Wake_Auto/flex-workflow-lab/steps/*.png` (실데이터가 들어 있어 git 밖에 둠, 디자인 참고 전용)

## 선행 plan 참조 (Phase 0)

| Plan | Status | 관계 |
|------|--------|------|
| **07** | Completed | page·API·middleware(`middleware.ts`와 `proxy.ts` **둘 다**) 서버 가드를 같은 방식으로 적용한다 |
| **08** | Approved | 모든 CUD Route의 전 분기에 `recordActivityLog`를 남긴다. 신규 action 15개를 추가한다 |
| **14** | Completed | 문서 취소, 임시저장 삭제, 첨부 제거, 워크플로우 관리자 해제는 `AlertModal`로 확인한다 |
| **26 · 40** | Approved | 로딩은 `PageLoadingSpinner`로 한다. 필터 셸은 Suspense 밖, 데이터 본문만 Suspense 안에 둔다 |
| **27 · 37 · 43** | Approved/Completed | `notifications` 테이블, Realtime, 읽음 낙관적 업데이트를 재사용한다. `type` CHECK에 `workflow.*` 6종을 **추가만** 한다. 클릭 이동은 `notification-infinite-list.tsx`의 `view-support` 패턴을 따른다 |
| **38 · 53** | Completed/Approved | 첨부는 비공개 버킷 + signed URL 2단계(prepare→PUT→complete)로 올린다. prepare와 complete 모두 `*.attachment_upload`로 기록한다(계약 첨부 선례) |
| **39** | Approved | 공지 첨부와 알림 fan-out 패턴을 참고한다 |
| **49** | Approved | `/dashboard/workflow/*`는 layout을 상속하므로 별도 Presence track이 0건이다. 인쇄 전용 라우트(dashboard layout 밖)에서는 track을 **금지**한다 |
| **72** | Approved | 첨부 미리보기는 `src/features/attachments`의 lightbox를 재사용한다 |
| **76 · 82** | Completed/Approved | 사이드바 그룹 추가 방식과 `NavAccessProvider` 플래그(`hasHrBenefitsNav`)를 따른다. 이번에는 `hasWorkflowAdminNav`를 신규로 둔다 |
| **16 · 47 · 78 · 80** | — | 계약서와 복지비는 **flex 문서를 import**하는 구조다. 1단계는 지출결의서만 옮기므로 **영향이 없다**. 나중에 해당 양식을 옮길 때 충돌하므로 열린 질문으로 남긴다 |

관계: **독립 신규 도메인**(`workflow`). 기존 테이블에는 `notifications.type` CHECK 확장만 있다.

---

## 한 줄 요약

flex의 워크플로우(전자결재)를 WakeOne 안에 **flex와 최대한 같게** 다시 만든다. 1단계 양식은 **지출결의서** 하나다. 다만 양식·입력칸 구조는 처음부터 **공통 틀**로 만들고, 지출결의서는 그 틀의 첫 양식(seed)으로 넣는다. 갈아타는 **핵심 이유**는 flex가 지원하지 않는 **조건부 필수**(요청 유형에 따라 필수 칸이 바뀜)이며, 이 규칙은 화면과 서버 양쪽에서 같은 데이터로 검증한다.

---

## 정책 확정안 (deep-interview 2026-10-21 · 사용자 답변)

| # | 항목 | 결정 |
|---|------|------|
| 1 | 구조 | **공통 틀**: `workflow_templates` + `workflow_template_fields`. 지출결의서를 seed로 넣는다. 조건부 필수 규칙도 **필드 데이터**(`required_when`)로 표현해 나중에 양식 빌더에서 재사용한다 |
| 2 | 1단계 기능 | flex 핵심 기능 전부에 더해 **임시저장·이어쓰기, 중요★, 복제, PDF 인쇄, 참조문서 연결, 검색, 기본 필터(작성자·양식·업데이트일), 정렬**까지 넣는다 |
| 3 | 조건부 필수 | 칸은 **모두 보이고**, 요청 유형에 따라 필수와 선택이 바뀐다. **클라이언트와 서버가 같은 규칙**으로 검증한다(아래 §조건부 필수 규칙) |
| 4 | 알림 | **앱 안 알림만**(`notifications` + Realtime). 내 승인 차례 → 승인자, 결과(완료·반려) → 작성자, 참조자는 각자의 알림 설정대로, 댓글 → 관련자 |
| 5 | 결재선 설정 | **워크플로우 설정 화면**을 포함한다. 시스템 관리자가 워크플로우 관리자를 지정하고, 워크플로우 관리자가 지출결의서의 기본 승인 단계·참조자(알림 설정 포함)를 정한다. 초기값은 **비워 둔다** |
| 6 | 기본값 | 메뉴는 사이드바 그룹 「워크플로우」 → 「문서함」 `/dashboard/workflow`, 관리자에게만 「워크플로우 설정」 `/dashboard/workflow/settings`. 문서번호는 **접두어 없이 `2026-0001`부터** 연도별 일련번호. 모바일 대응 포함 |
| — | 권한 | PERMISSIONS.md를 **그대로** 적용한다(다시 묻지 않음). 열람 = 작성자 OR 결재선 actor(지난·현재·대기 단계 전부) OR 참조자 OR 워크플로우 관리자. **RLS로 강제** |

### planner가 정한 세부 결정 (flex에서 확인 못 했거나 WakeOne 규칙과 충돌하는 부분)

| 항목 | 결정 | 근거 |
|------|------|------|
| 한 단계에 여러 명 | 그 단계의 **모든 사람이 승인**해야 다음 단계로 간다. 한 명이라도 반려하면 문서는 즉시 반려된다 | [INFERRED] flex의 승인자 유형이 「승인(기본)」 하나뿐이다 |
| 작성자를 승인자로 지정 | 금지한다(400 「작성자는 승인자로 지정할 수 없습니다.」) | PERMISSIONS: 작성자는 승인/반려 ❌ |
| 같은 사람 중복 | 승인자는 문서 전체에서 1번만 가능하다. 참조자와 승인자 겹침은 **허용**한다 | flex 기본 결재선에서 2단계 승인자가 참조자로도 들어가 있었다 |
| 결재선 변경 범위 | **완료(APPROVED)된 단계는 바꿀 수 없다**. 진행 중인 단계에서는 이미 승인한 사람을 뺄 수 없다. 변경 후 진행 중 단계가 모두 승인 상태면 다음 단계로 넘어가고, 남은 단계가 없으면 완료(DONE)된다 | flex 타임라인의 「변경 전→후」 diff 동작 |
| 승인/반려 의견 | 승인 Dialog의 「의견」은 **선택**이고, 반려 Dialog의 「반려 사유」도 **선택**이다. 입력하면 타임라인에 표시한다 | [INFERRED] flex와 동일하게 유지 |
| 참조자 알림 | `START_AND_END`: 요청 시 + 결과(완료·반려) 시. `END`: 결과 시만. `NONE`: 없음. **댓글 알림은 설정과 관계없이** 받는다 | flex 메뉴 문구 「댓글 알림은 설정과 관계없이 수신돼요.」 |
| 취소 알림 | 취소 시점에 **진행 중 단계에서 대기 중인 승인자**에게만 보낸다 | 「내 차례」 문서가 사라지는 이유를 알려 주기 위해 |
| 복제 | 입력값, 본문, 결재선, 참조자, 참조문서를 복사한다. **첨부는 복사하지 않는다**. 작성일은 오늘, 작성자 칸은 현재 사용자 이름으로 바꾼다 | 첨부 저장 경로를 공유하지 않기 위해 |
| 시각 표시 | flex는 상대시간(「47분 전」)을 쓰지만 WakeOne 규칙상 **절대 시각**(`formatAbsoluteDateTimeKo`)으로 표시한다. 날짜 칸은 `formatAbsoluteDateKo`(`yyyy-MM-dd`) | `core-conventions.mdc` §날짜·시각 |
| 작성 가이드 문구 | flex 가이드를 그대로 seed하되, 마지막 줄 「⚠️ 필수 값이 아닌 경우는 '-(하이픈)'으로 표기해주세요!」는 **「요청 유형을 고르면 필요한 칸에 빨간 점이 표시돼요. 필수가 아닌 칸은 비워 두셔도 됩니다.」**로 바꾼다 | 조건부 필수 도입 |
| 본문 이미지 | 본문 편집기의 「이미지 삽입」은 **Out**이다. 이미지는 첨부로 올린다 | 1단계 범위 축소(저장소 경로·정화 규칙 단순화) |
| 댓글 수정·삭제 | **Out**(작성만 가능) | 1단계 범위 |

---

## 조건부 필수 규칙 (이번 대체의 핵심)

### 데이터 표현 (양식 빌더 재사용용)

- `workflow_template_fields.required boolean`: 항상 필수인지
- `workflow_template_fields.required_when jsonb null`: 조건부 필수 규칙. 형식은 `{"field_key": "<다른 필드 key>", "in": ["값1", ...]}`
- `workflow_templates.attachment_required boolean` + `attachment_required_when jsonb null`: 첨부의 조건부 필수(형식 동일)
- **판정 함수 하나**를 클라이언트와 서버가 함께 쓴다(예: `src/features/workflow/lib/required-rules.ts`, 순수 TS, `server-only` 아님).
  - `isFieldRequired(field, values) = field.required || matches(field.required_when, values)`
  - 값은 trim 후 빈 문자열이면 미입력이다. `"-"`도 하나의 값이므로 입력으로 인정한다
  - 필수가 아닌 칸은 **빈 값으로 제출할 수 있다**
- 서버(Route Handler)는 **DB에서 읽은 양식 필드 정의**로 같은 함수를 실행한다. 클라이언트가 보낸 규칙은 신뢰하지 않는다. 문서 수정(PATCH)에도 같은 검증을 적용한다.

### 지출결의서 seed (15칸)

| # | field_key | 이름 | type | 항상 필수 | 조건부 필수 (`required_when`) | prefill |
|---|-----------|------|------|:-:|------|------|
| 1 | `request_type` | 요청 유형 | SELECT `["입, 출금 요청","구매 요청"]` | ✓ | — | NONE |
| 2 | `writer_name` | 작성자 | STRING | ✓ | — | NAME (작성자 이름) |
| 3 | `written_date` | 작성일 | DATE | ✓ | — | DEFAULT (오늘, KST) |
| 4 | `brand` | 사용 브랜드 | SELECT `["산스","킨키","비욘드푸드","웨이크","산스파운드리"]` | ✓ | — | NONE |
| 5 | `amount` | 금액 | AMOUNT_OF_MONEY (KRW) | ✓ | — | NONE |
| 6 | `due_date` | 입금 ,구매 요청기한 | DATE | | — (선택) | NONE |
| 7 | `vendor_account_holder` | 업체명 및 예금주 | STRING | | `request_type in ["입, 출금 요청"]` | NONE |
| 8 | `bank_account` | 계좌정보(은행명) | STRING | | `request_type in ["입, 출금 요청"]` | NONE |
| 9 | `item_quantity` | 품명 및 수량 | STRING | | `request_type in ["구매 요청"]` | NONE |
| 10 | `delivery_address` | 수령지 | STRING | | `request_type in ["구매 요청"]` | NONE |
| 11 | `recipient` | 수령인(연락처필수) | STRING | | `request_type in ["구매 요청"]` | NONE |
| 12 | `link_url` | 링크(URL) | STRING | | `request_type in ["구매 요청"]` | NONE |
| 13 | `purchase_reason` | 구매 사유(상세히) | STRING | ✓ | — | NONE |
| 14 | `note` | 비고 | STRING | | — | NONE |
| 15 | `reference_documents` | 참조문서 | TASK_REFERENCE | | — | NONE |

- 첨부: `attachment_visible=true`, `attachment_required=false`, `attachment_required_when={"field_key":"request_type","in":["입, 출금 요청","구매 요청"]}`. 즉 요청 유형을 고르면 첨부는 항상 필수가 된다(가이드상 두 유형 모두 첨부 필수).
- 본문: `content_visible=true`, 기본값 빈 문자열.
- 양식 옵션: `edit_policy='AUTHOR_AND_APPROVER'`, `approval_step_edit_enabled=true`, `only_visible_for_admin=false`, emoji 📄(`U+1F4C4`), `display_order=1`, `tags='{}'`.
- **오류 문구(공통)**
  - 입력칸: 「{필드 이름} 항목을 입력해 주세요.」 (예: 「계좌정보(은행명) 항목을 입력해 주세요.」)
  - 첨부: 「첨부파일을 1개 이상 올려 주세요.」
  - 금액: 「금액은 0보다 큰 숫자로 입력해 주세요.」
  - SELECT에 없는 값: 「{필드 이름} 값이 올바르지 않습니다.」
  - 승인자: 「승인자를 1명 이상 지정해 주세요.」

---

## 목표 & 완료 기준 (AC)

**공통 규칙**
- E2E 계정(`e2e/.auth/*.json`)과 역할: **user** = 작성자, **user2** = 승인자 A, **hr-benefits** = 승인자 B / 외부인 / 참조자(시나리오별로 지정), **admin** = 시스템 관리자(곧 워크플로우 관리자).
- 같은 테스트에서 여러 사용자가 필요하면 `browser.newContext({ storageState })` 또는 `request.newContext({ storageState })`를 쓴다. 매 테스트마다 재로그인하는 것은 금지한다.
- 셀렉터는 **`getByRole`·`getByPlaceholder`·`getByTestId`만** 쓴다.
- e2e로 만든 문서는 품명이나 비고에 **`E2E-WF-{timestamp}`** 표식을 넣는다. cleanup은 이 표식으로만 지운다.
- activity log 검증은 **API 테스트**로 한다(`x-request-id` + `GET /api/activity-logs` action 행).
- 결재선 기본값은 테스트가 settings API로 직접 세팅하고, 끝나면 원래 값으로 되돌린다.

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| AC-01 | Playwright | user · 1280 | 사이드바 확인 | 그룹 「워크플로우」에 link 「문서함」이 있고 `/dashboard/workflow`로 이동한다. 「워크플로우 설정」 link는 **0건**이다. kbar에서 「문서함」을 검색할 수 있다 |
| AC-02 | Playwright | admin · 1280 | 사이드바 확인 | 「문서함」과 「워크플로우 설정」이 둘 다 보인다 |
| AC-03 | Playwright · API | user | ① `/dashboard/workflow/settings` 직접 진입 ② `PUT /api/workflow/templates/expense/policy` ③ `POST /api/workflow/admins` | ① `/dashboard/workflow`로 redirect된다(접근 거부 flash 표시) ② **403** 「워크플로우 관리자 권한이 필요합니다.」 ③ **403** 「관리자 권한이 필요합니다.」 |
| AC-04 | Playwright | admin · settings | 「워크플로우 관리자」 섹션에서 hr-benefits 추가 → hr-benefits 컨텍스트로 새로고침 | hr-benefits 사이드바에 「워크플로우 설정」이 생긴다. settings 페이지에서 「워크플로우 관리자」 섹션(지정/해제)은 **보이지 않고** 「양식 기본 결재선」 섹션만 보인다. admin이 해제(`AlertModal` 확인)하면 hr-benefits에서 메뉴가 사라지고 settings 진입 시 redirect된다 |
| AC-05 | Playwright | admin · settings 「지출결의서 기본 결재선」 | 1단계 user2, 2단계 hr-benefits, 참조자 admin(「승인 완료 시 알림」)으로 저장 | toast 「기본 결재선이 저장되었습니다.」. user가 지출결의서 작성 화면을 열면 오른쪽 결재선에 1단계 user2, 2단계 hr-benefits, 참조 admin이 **자동으로 채워져 있다** |
| AC-06 | API | 워크플로우 관리자 | policy PUT ① 빈 단계 포함 ② 비활성 사용자 ③ 같은 승인자 2번 | ① **400** 「승인자가 없는 단계가 있습니다.」 ② **400** 「비활성 사용자는 지정할 수 없습니다.」 ③ **400** 「같은 승인자를 여러 번 지정할 수 없습니다.」. 승인 단계 0개 저장은 **허용**한다(초기 상태) |
| AC-07 | Playwright | user · `/dashboard/workflow` | 「문서 작성하기」 클릭 | 양식 선택 화면에 검색 input, 「지출결의서」 옵션(📄)이 보인다. 고르면 작성 폼이 열리고 **작성 가이드 문구**(「✅ 공통 필수 값」 포함)와 15칸이 순서대로 보인다. 「작성자」는 user 이름, 「작성일」은 오늘(KST, `yyyy-MM-dd`)로 미리 채워져 있다 |
| AC-08 | Playwright | 작성 폼 · 요청 유형 미선택 | 각 칸의 필수 표시 확인 | `workflow-field-required-{key}`가 request_type·writer_name·written_date·brand·amount·purchase_reason **6칸에만** 보인다. 첨부 필수 표시는 **없다** |
| AC-09 | Playwright | 작성 폼 | 요청 유형 「입, 출금 요청」 선택 | 필수 표시가 위 6칸에 vendor_account_holder·bank_account가 **추가된 8칸**이 되고, 첨부 필수 표시가 생긴다. item_quantity·delivery_address·recipient·link_url에는 필수 표시가 **없다**. 모든 칸은 그대로 **보인다**(숨김 0건) |
| AC-10 | Playwright | AC-09 상태 · 공통 6칸만 입력 · 승인자 지정 | 「보내기」 | 「업체명 및 예금주 항목을 입력해 주세요.」, 「계좌정보(은행명) 항목을 입력해 주세요.」, 「첨부파일을 1개 이상 올려 주세요.」가 보이고 **전송되지 않는다**(POST 0건). 첫 오류 칸으로 스크롤된다 |
| AC-11 | Playwright | 작성 폼 | 요청 유형을 「구매 요청」으로 변경 | 필수 표시가 공통 6칸 + item_quantity·delivery_address·recipient·link_url 4칸이 되고, vendor_account_holder·bank_account는 **선택**으로 바뀐다. 앞서 「입, 출금 요청」 때 생긴 두 칸의 오류 문구는 사라진다 |
| AC-12 | Playwright | 「구매 요청」 · 필수 10칸 + 첨부 1개(png) 입력, 업체명·계좌 **비움**, 결재선은 AC-05 기본값 | 「보내기」 | toast 「문서를 보냈습니다.」. 작성 폼이 닫히고 폼이 초기화된다. 진행중 탭 「진행중 문서」에 새 행이 **새로고침 없이** 보인다. 행에 `진행중 1/2` 뱃지, 문서번호 `YYYY-NNNN`(올해, 4자리 이상), 「요청 유형: 구매 요청」으로 시작하는 요약, 「첨부파일 1건」이 있다. 요약에는 **빈 칸이 나오지 않는다** |
| AC-13 | API | user 세션 | `POST /api/workflow/documents`: ① 입, 출금 요청인데 bank_account 빈 값 ② 구매 요청인데 첨부 0개 ③ 구매 요청 필수 전부 + 첨부 + vendor/bank 빈 값 ④ request_type 「기타」 ⑤ amount `0` ⑥ 클라이언트가 `required:false`로 바꾼 필드 정의를 같이 보냄(서버는 무시) + 공통 칸 누락 | ① **400** 「계좌정보(은행명) 항목을 입력해 주세요.」 ② **400** 「첨부파일을 1개 이상 올려 주세요.」 ③ **201**, 응답 `document.code`가 `^\d{4}-\d{4,}$` ④ **400** 「요청 유형 값이 올바르지 않습니다.」 ⑤ **400** 「금액은 0보다 큰 숫자로 입력해 주세요.」 ⑥ **400**. 모든 응답에 `x-request-id` |
| AC-14 | API | user | 결재선 ① 승인 단계 0개 ② 작성자 본인을 승인자로 ③ 비활성 사용자 | ① **400** 「승인자를 1명 이상 지정해 주세요.」 ② **400** 「작성자는 승인자로 지정할 수 없습니다.」 ③ **400** 「비활성 사용자는 지정할 수 없습니다.」 |
| AC-15 | API · SQL | 같은 해에 문서 2건을 연속으로 POST | 두 code 비교 | 일련번호가 **1 증가**한다. 형식은 `{KST 연도}-{4자리 zero-pad}`이고 접두어(`W` 등)는 **0건**이다. 임시저장은 번호를 소모하지 않는다(draft 저장 전후로 다음 문서 번호가 연속) |
| AC-16 | Playwright | AC-12 문서 · user2 컨텍스트 | 문서함 진행중 탭 | 「승인 필요 문서」 그룹에 해당 행이 `승인 필요` 뱃지와 함께 보인다. 행을 클릭하면 상세가 열린다. PC(1280)에서는 목록 오른쪽 패널이다. URL에 `doc={id}`가 붙고 새로고침해도 같은 문서가 열린다. 하단에 「반려」·「승인」 버튼이 있다 |
| AC-17 | Playwright | AC-16 상세 | 상세 구성 확인 | 상태 뱃지 `진행중 1/2`, 제목 「지출결의서」, 문서번호, 작성 일시(`yyyy-MM-dd (EEE) HH:mm:ss`)가 있다. 타임라인 첫 항목은 「{작성자}님이 글을 작성했어요.」이다. 입력 필드 표가 있고 SELECT 값은 칩으로, 금액은 `n,nnn 원`으로 나온다. 첨부파일(1)에서 lightbox로 미리보기할 수 있다. 오른쪽 「승인 · 참조」에 참조 admin, 「1 단계 진행 중」 user2 `대기중`, 「2 단계 대기중」 hr-benefits `대기중`이 보인다 |
| AC-18 | Playwright | hr-benefits 컨텍스트(2단계 대기 승인자) | 문서함 → 해당 문서 열기 | 「진행중 문서」 그룹에 보이고(「승인 필요」에는 **없음**) 상세를 **열람할 수 있다**. 「승인」·「반려」 버튼은 **0건**이다. API `POST …/approve`는 **403** 「지금 승인할 차례가 아닙니다.」 |
| AC-19 | Playwright | user2 상세 | 「승인」 → Dialog에 의견 「확인했습니다」 입력 → 확인 | toast 「승인했습니다.」. 뱃지가 `진행중 2/2`가 되고, 타임라인에 「{user2}님이 승인했어요.」와 의견이 보인다. user2의 「승인 필요」 그룹에서 사라진다. hr-benefits에게 알림 「지출결의서 승인 요청」이 생기고, 알림을 클릭하면 `/dashboard/workflow?doc={id}`로 이동한다 |
| AC-20 | Playwright · API | hr-benefits 상세 | 「승인」 | 상태 뱃지 「완료」. 완료 탭에 보이고 진행중 탭에서는 사라진다. user에게 알림 「지출결의서가 승인 완료되었어요」, 참조자 admin에게도 결과 알림이 생긴다. 같은 approve를 다시 POST하면 **409** 「이미 처리된 문서입니다.」 |
| AC-21 | API | 새 문서(1단계 user2, 2단계 hr-benefits, 참조 admin `START_AND_END`) | user2가 `POST …/decline` {reason:"금액 확인 필요"} | **200**. 문서 status `DECLINED`, 2단계는 진행하지 않는다(hr-benefits 알림 0건). user와 admin에게 반려 알림이 간다. 타임라인에 「{user2}님이 반려했어요.」와 사유가 남는다 |
| AC-22 | API | 진행중 문서 | 권한 매트릭스 ① 작성자 user가 approve ② admin(결재선 밖)이 approve ③ admin이 PATCH 수정 ④ 참조자가 PATCH 수정 ⑤ user2(승인자)가 cancel | ① **403** ② **403** ③ **403** ④ **403** ⑤ **403** 「작성자만 문서를 취소할 수 있습니다.」 |
| AC-23 | API · Playwright | 결재선이 user2뿐이고 참조자가 없는 문서 | hr-benefits(외부인)가 ① `GET /api/workflow/documents/{id}` ② 문서함 전체 탭 검색 ③ `/dashboard/workflow?doc={id}` 진입 | ① **404** ② 결과 0건 ③ 「문서를 찾을 수 없거나 열람 권한이 없습니다.」 표시, 상세 내용 0건 |
| AC-24 | SQL (Dev MCP `execute_sql`) | AC-23 문서 | `set local role authenticated` + `request.jwt.claims`에 hr-benefits uid를 넣고 `workflow_documents`·`workflow_document_events`·`workflow_attachments`·`workflow_approval_actors` select | 해당 문서 행이 **0건**이다(**RLS 강제**). 같은 조건에서 user2 uid로 조회하면 각 1행 이상 나온다 |
| AC-25 | Playwright | admin · 문서함 | 범위 토글 「회사 전체」 선택 | AC-23 문서(admin은 결재선 밖)가 보이고 열람된다. user 컨텍스트에서는 「회사 전체」 토글이 **0건**이다. API `GET /api/workflow/documents?scope=company`를 user가 호출하면 **403** |
| AC-26 | Playwright | 진행중 문서 · user2(승인자) 상세 | `···` → 「문서 수정」 → 비고에 「E2E-WF 수정」 입력 → 저장 | toast 「문서를 수정했습니다.」. 필드 표에 새 비고가 보이고, 타임라인에 「{user2}님이 문서를 수정했어요.」와 바뀐 칸 이름 「비고」가 보인다. 이미 끝난 승인은 그대로 남는다 |
| AC-27 | API | AC-26 문서 | PATCH로 request_type을 「입, 출금 요청」으로 바꾸고 bank_account는 비움 | **400** 「계좌정보(은행명) 항목을 입력해 주세요.」(수정에도 조건부 필수를 적용) |
| AC-28 | API | 완료·반려·취소 문서 각 1건 | ① PATCH ② PUT approval-line ③ approve ④ cancel ⑤ POST comment | ①~④ **409** 「진행중인 문서만 처리할 수 있습니다.」 ⑤ **201** |
| AC-29 | Playwright | 진행중 문서 · user(작성자) | `···` → 「승인·참조 변경」 → 2단계 hr-benefits를 admin으로 바꾸고 「3단계」에 hr-benefits 추가 → 저장 | 타임라인에 「{user}님이 승인·참조자를 변경했어요.」와 「2단계: {hr-benefits}(승인) → {admin}(승인)」, 「3단계: 없음 → {hr-benefits}(승인)」 diff가 보인다. 뱃지 분모가 3이 된다 |
| AC-30 | API | 1단계가 이미 승인된 문서 | 작성자가 approval-line PUT으로 ① 1단계 승인자 변경 ② 진행 중 단계에서 이미 승인한 사람 제거 ③ 승인자가 아닌 user2가 PUT | ① **409** 「완료된 단계는 변경할 수 없습니다.」 ② **409** 「이미 승인한 승인자는 뺄 수 없습니다.」 ③ **403** |
| AC-31 | Playwright | 진행중 문서 · user(작성자) | `···` → 「문서 취소」 | `AlertModal` 제목 「문서 취소」, 설명에 문서번호가 들어 있다. 확인하면 toast 「문서를 취소했습니다.」, 상태 「취소」, 완료 탭으로 이동한다. 진행 중 단계의 대기 승인자에게 취소 알림이 간다. grep: `src/features/workflow/**`에서 `window.confirm`·`confirm(`·`window.alert`가 **0건** |
| AC-32 | Playwright | 진행중 문서 · 참조자 admin | 댓글 「E2E-WF 댓글」 입력 → 등록 | 타임라인 맨 아래에 댓글과 작성 시각(절대 시각)이 보이고 입력창은 비워진다. 작성자 user와 승인자 전원에게 댓글 알림이 간다. 참조 알림 설정이 「알림 없음」인 참조자도 댓글 알림은 **받는다**. 빈 댓글 등록은 버튼 비활성, API는 **400** 「댓글을 입력해 주세요.」. 2001자는 **400** 「댓글은 2000자 이내로 입력해 주세요.」 |
| AC-33 | Playwright | user · 작성 폼에 입력 중 | 「임시저장」 | toast 「임시저장했습니다.」. 「문서 작성하기」를 다시 열면 「이어서 작성하기 1개」가 보이고, 그것을 고르면 입력값·본문·결재선·첨부가 복원된다. 보내면 임시저장 목록에서 사라진다. 임시저장 삭제는 `AlertModal` 「임시저장 삭제」로 확인한다. 다른 사용자(user2)의 `GET /api/workflow/drafts`에는 **0건** |
| AC-34 | Playwright | user · 작성 폼에 값 입력 후 | 닫기(X) | `AlertModal` 「작성을 그만둘까요?」(설명 「임시저장하지 않은 내용은 사라집니다.」)가 뜬다. 「계속 작성」을 누르면 입력값이 그대로 남는다 |
| AC-35 | Playwright | 아무 문서 상세 | ★ 클릭 → 「중요」 탭 | 별이 채워지고(`aria-pressed=true`) 「중요」 탭에 그 문서가 보인다. 다시 누르면 빠진다. 중요 표시는 **본인에게만** 적용된다(user2의 중요 탭에는 0건) |
| AC-36 | Playwright | user가 작성한 문서 상세 | `···` → 「복제하기」 | 작성 폼이 열리고 입력값·본문·결재선·참조자가 채워져 있다. 첨부는 비어 있고, 작성일은 오늘이다. 같은 문서를 user2가 열면 `···` 메뉴에 「복제하기」가 **0건**이다 |
| AC-37 | Playwright | 작성 폼 「참조문서」 칸 | 「문서 선택」 → AC-12 문서번호로 검색 → 선택 → 보내기 | 상세 「참조문서」에 `📄 지출결의서 {code}` 카드가 보이고, 클릭하면 그 문서가 열린다. 검색 결과에는 **내가 열람할 수 있는 문서만** 나온다(API로 외부인 문서 id를 보내면 **400** 「참조할 수 없는 문서가 있습니다.」) |
| AC-38 | Playwright | user · 문서함 | ① 검색에 `E2E-WF-{ts}` 입력 ② 작성자 필터 user2 ③ 양식 필터 지출결의서 ④ 업데이트일 「오늘」 ⑤ 정렬 「오래된 작성순」 ⑥ 범위 「내가 작성한」 | 각 조작마다 URL query가 바뀌고(nuqs) 새로고침해도 유지된다. ① 표식 문서만 보인다 ② user2가 작성한 문서만(없으면 「문서가 없습니다.」) ⑤ 작성 시각 오름차순. 「초기화」로 모든 조건이 풀린다. 필터 셸은 데이터 로딩 중에도 그대로 보인다(plan 40) |
| AC-39 | Playwright | 상세 | `···` → 「PDF 인쇄」 | 새 탭 `/workflow-print/{id}`가 열린다. 사이드바는 **0건**이고, 문서번호·필드 표·본문·결재선 상태(단계별 이름과 승인 여부)가 보이며 `window.print`가 1회 호출된다(`addInitScript` stub). 열람 권한이 없는 사용자가 이 주소에 들어가면 「문서를 찾을 수 없거나 열람 권한이 없습니다.」, 비로그인이면 `/auth/sign-in`으로 redirect된다 |
| AC-40 | Playwright | 작성 폼 · 첨부 | ① 20MB를 넘는 파일 ② 31번째 파일 | ① 「파일당 20MB 이하만 올릴 수 있습니다.」 ② 「첨부파일은 최대 30개까지 올릴 수 있습니다.」. 둘 다 업로드되지 않는다. API prepare도 같은 문구로 **400** |
| AC-41 | API | 본문 HTML에 `<script>alert(1)</script>`, `<img src=x onerror=…>`, `<a href="javascript:…">` | POST 후 GET | 저장된 `content_html`에 `<script`, `onerror`, `javascript:`가 **0건**이다. `<strong>`·`<ul>`·`<table>`·`<a href="https://…">`는 남는다 |
| AC-42 | API (activity log) | user·user2·admin 세션 | 문서 POST(201·400) → star PUT → comment POST → approve(200·403) → decline → PATCH → approval-line PUT → cancel → draft POST/DELETE → attachment prepare/complete/delete → admin grant/revoke → policy PUT | 각 응답에 `x-request-id`가 있다. `GET /api/activity-logs`에 같은 request_id로 §활동 감사 로그 표의 action 행이 **status 코드와 함께** 있다. metadata에 금액·계좌·업체명·댓글 본문·사유 같은 **입력값이 0건**이다(`document_id`·`document_code`·`template_key`·`error_code`·`changed_field_keys`만) |
| AC-43 | Playwright | viewport 375 · user2 | 문서함 → 「승인 필요」 행 탭 | 상세가 **전체 화면**으로 열리고 하단에 「반려」·「승인」이 고정되어 보인다(boundingBox가 viewport 안, 높이 44px 이상). 「승인 · 참조」 정보는 본문 아래 또는 탭에서 볼 수 있다. 목록·상세·작성 폼 모두 `scrollWidth <= clientWidth` |
| AC-44 | Playwright | viewport 375 · user | 작성 폼 열기 → 입력 → 보내기 | 작성 폼이 전체 화면이고, 결재선 편집에 접근할 수 있으며, 「보내기」가 항상 도달 가능하다(하단 고정) |
| AC-45 | Playwright | `GET /api/workflow/documents`를 `page.route`로 500 처리 | 문서함 진입 | 오류 안내(「문서함을 불러오지 못했습니다.」)와 다시 시도 버튼이 보이고, 앱이 죽지 않는다(사이드바 동작) |
| AC-46 | SQL (Dev MCP) | SQL 86~88 적용 | `pg_class.relrowsecurity`, `role_table_grants`, `has_function_privilege`, `storage.buckets` 조회 | `workflow_*` 테이블 전부 RLS on. `authenticated`·`anon`에 INSERT/UPDATE/DELETE 권한 0건. 쓰기 RPC의 execute 권한은 `service_role`에만 있다. bucket `workflow-attachments`는 `public=false`, `file_size_limit=20971520`. `notifications_type_check`에 `workflow.*` 6종이 있고 기존 22종도 유지된다 |
| AC-47 | grep | 구현 완료 | `src/features/workflow/**` 검색 | `formatDistanceToNow`·`toLocaleDateString`·「분 전」·「시간 전」이 **0건**. `required_when`을 판정하는 함수 정의는 **1곳**이고 클라이언트 폼과 서버 Route가 같이 import한다. raw `<button`·`<label`이 0건 |
| AC-48 | CLI | — | `npx playwright test e2e/workflow` · `npx tsc --noEmit` · `npm run lint` · `npm run build` · `npm run e2e:cleanup` | 전부 green / 통과 / exit 0. cleanup 후 dev DB에 `E2E-WF-` 표식 문서·임시저장·첨부(Storage 포함)가 0건이고, e2e로 지정한 워크플로우 관리자와 기본 결재선이 원래 값으로 돌아와 있다 |
| AC-49 | 수동 QA | PC Chrome + iPhone Safari | 실제 사용자 3명으로 작성→승인→승인, 반려, PDF 인쇄 저장 | flex와 비교해 화면 흐름이 비슷하다. 인쇄 PDF에 문서 내용이 잘리지 않는다(e2e 판정 대상 아님) |

**최종 AC 개수: 49**
- Playwright 중심(API·grep 복합 포함): AC-01~05·07~12·16~20·23·25·26·29·31~40·43~45
- API: AC-06·13·14·15·21·22·27·28·30·41·42
- SQL: AC-24·46
- grep: AC-47 (AC-31에도 grep 포함)
- CLI: AC-48
- 수동 QA: AC-49

### e2e testid 규칙 (designer가 레이아웃은 정하되, 아래 id는 지킨다)

| 영역 | testid |
|------|--------|
| 문서함 | `workflow-page` · `workflow-compose-button` · `workflow-scope-{related\|mine\|company}` · `workflow-search-input` · `workflow-filter-writer` · `workflow-filter-template` · `workflow-filter-updated` · `workflow-sort` · `workflow-reset` · `workflow-group-approval-required` · `workflow-group-in-progress` · `workflow-row-{code}` · `workflow-load-more` · 탭은 `getByRole('tab', { name: '진행중'\|'완료'\|'중요'\|'전체' })` |
| 양식 선택 | `workflow-template-picker` · `workflow-template-search` · `workflow-template-option-{template_key}` · `workflow-draft-list` · `workflow-draft-{id}` · `workflow-draft-delete-{id}` |
| 작성·수정 폼 | `workflow-compose-form` · `workflow-guide` · `workflow-field-{field_key}` · `workflow-field-required-{field_key}` · `workflow-field-error-{field_key}` · `workflow-attachments-dropzone` · `workflow-attachment-required` · `workflow-attachment-error` · `workflow-attachment-{id}` · `workflow-editor` · `workflow-reference-picker` · `workflow-submit` · `workflow-save-draft` · `workflow-compose-close` |
| 결재선 | `workflow-approval-line` · `workflow-referrers` · `workflow-referrer-add` · `workflow-referrer-notify-{user_id}` · `workflow-step-{n}` · `workflow-step-{n}-add` · `workflow-step-add` · `workflow-actor-{step}-{user_id}` |
| 상세 | `workflow-detail` · `workflow-detail-status` · `workflow-detail-code` · `workflow-timeline` · `workflow-timeline-item` · `workflow-comment-input` · `workflow-comment-submit` · `workflow-approve` · `workflow-decline` · `workflow-star` · `workflow-more-menu` · `workflow-detail-close` · `workflow-reference-card-{code}` |
| 설정 | `workflow-settings-page` · `workflow-admins` · `workflow-admin-add` · `workflow-admin-remove-{user_id}` · `workflow-template-policy-{template_key}` · `workflow-policy-save` |
| 인쇄 | `workflow-print-page` |

---

## 범위 (In / Out)

### In Scope

1. **DB**: 양식, 입력칸, 기본 결재선, 문서, 결재 단계와 승인자, 참조자, 타임라인 이벤트, 첨부, 임시저장, 사용자별 중요 표시, 연도별 번호 카운터, 워크플로우 관리자 테이블. RLS, 열람 판정 함수, 쓰기 RPC, Storage bucket, `notifications.type` 확장, 지출결의서 seed
2. **문서함** `/dashboard/workflow`
   - 탭: 진행중 / 완료 / 중요 / 전체(탭마다 건수 표시)
   - 범위 토글: 전체(내 관련) / 내가 작성한 / 회사 전체(워크플로우 관리자만)
   - 검색, 필터(작성자 다중 선택, 양식 다중 선택, 업데이트일 = 오늘·지난 1주일·1개월·3개월·월별·직접 입력), 정렬(최근/오래된 업데이트순, 최근/오래된 작성순), 초기화
   - 진행중 탭은 「승인 필요 문서」(5개 + 더보기)와 「진행중 문서」(20개씩 더보기)로 나눈다
   - 목록 행: 양식 이모지, 작성자, 업데이트 시각(절대), 상태 뱃지, 양식명, 입력값 한 줄 요약, 첨부 n건, 결재자 아바타(+n명)
3. **문서 상세**
   - PC는 오른쪽 패널, 모바일은 전체 화면. URL `?doc={id}`
   - ★, `···` 메뉴(문서 수정, 승인·참조 변경, 복제하기, PDF 인쇄, 문서 취소. 권한·상태에 따라 노출)
   - 타임라인 + 댓글, 필드 표, 첨부(개별 다운로드와 lightbox 미리보기), 본문, 참조문서 카드, 「승인 · 참조」 사이드, 하단 반려/승인
4. **작성 흐름**
   - 양식 선택(검색, 이어서 작성하기 n개 + 삭제, 태그 칩은 태그가 있을 때만)
   - 작성 폼: 가이드 → 입력칸(조건부 필수) → 참조문서 → 첨부(드래그, 20MB, 30개) → 본문 편집기 → 오른쪽 결재선(참조자 + 알림 설정 3종, 단계 추가·삭제, 단계별 여러 명) → 하단 「보내기」와 「임시저장」
5. **처리 동작**: 승인(의견 선택), 반려(사유 선택), 수정(진행 중이면 작성자와 승인자 전원), 결재선 변경(작성자, 양식이 허용할 때), 취소(작성자), 댓글, 중요, 복제, PDF 인쇄 라우트 `/workflow-print/[id]`
6. **워크플로우 설정** `/dashboard/workflow/settings`
   - 시스템 관리자: 워크플로우 관리자 지정·해제
   - 워크플로우 관리자: 양식별 기본 승인 단계, 참조자와 알림 설정, 「작성자가 결재선 변경 가능」 토글
7. **앱 안 알림 6종**과 클릭 이동, **활동 로그 15 action**
8. **사이드바·kbar**: 그룹 「워크플로우」. 서버 가드는 page·API·middleware/proxy 세 곳
9. **e2e cleanup 확장**: `E2E-WF-` 표식 문서, 임시저장, 첨부, Storage 객체, e2e로 바꾼 관리자·결재선 원복

### Out of Scope (2단계 이후)

- **양식 빌더**(양식·입력칸·가이드·태그 만들기·수정·삭제·숨기기), 지출결의서 외 다른 양식
- flex 문서 **이관(import)**, 계약서·복지비 양식 이전(plan 16·47·78·80 연동 재설계 필요)
- **위임**(부재 시 대리 결재), 승인자 유형 「승인」 외(합의 등)
- 목록 **그룹 보기 설정, 보기 저장, 「+ 필터 추가」**(날짜·대상자·문서 상태·승인자·작성일·진행 상태·참조자), 정확도순 정렬, **공유 링크, 이전/다음 문서 이동, 일괄 선택(체크박스) 처리**
- 히스토리(버전별 보기) 메뉴. 수정 기록은 타임라인으로 대신한다
- 첨부 **「모두 저장」(ZIP)**, 본문 **이미지 삽입**
- 댓글 수정·삭제, 멘션, 상세 화면 Realtime 자동 갱신(알림은 Realtime, 상세는 포커스·invalidate로 갱신)
- 이메일·Slack 알림, 읽지 않음(unread) 표시
- 오래 방치된 staged 첨부의 자동 정리 Cron(cleanup은 e2e 표식 한정)
- 승인자가 퇴사(비활성)했을 때 관리자가 결재선을 대신 바꾸는 기능(열린 질문)
- 운영(Main) DB 적용

---

## UI 요구사항 (designer 지시)

- **레퍼런스**: flex 스크린샷 `01-inbox-in-progress`, `02-tab-*`, `03/04-expense-detail`, `05-detail-more-menu`, `06-approver-view`, `07-compose-picker`, `08/09-compose-*`, `10/11-*menu`, `13-menu-*`. **구성과 흐름은 flex와 같게** 하고, 색·컴포넌트는 WakeOne 테마 토큰과 shadcn을 쓴다(hex 하드코딩 금지).
- **문서함 레이아웃(PC ≥ md)**: 왼쪽 목록, 상세는 오른쪽 패널(flex처럼 목록 위에 겹치는 큰 패널 + 오른쪽 「승인 · 참조」 열). 패널과 전체화면 전환은 선택 사항이다.
- **모바일(< md)**: 목록은 한 열. 상세와 작성 폼은 전체 화면(Sheet/Drawer/Dialog 중 designer 선택). 하단 CTA(승인·반려, 보내기)는 **본문 스크롤 밖에 고정**한다(core-conventions §Sheet 폼 모바일). 터치 타깃은 44px 이상.
- **작성 폼**
  - 필수 표시는 라벨 옆 빨간 점(`workflow-field-required-*`)이다. 요청 유형이 바뀌면 **즉시** 갱신된다.
  - 오류는 칸 아래 한국어 문구로 보여 준다. 제출에 실패하면 첫 오류 칸으로 스크롤한다(`scrollToFirstError`).
  - 입력 위젯: SELECT는 칩 선택(flex처럼 단일 선택 칩/드롭다운), DATE는 shadcn Calendar 팝오버, AMOUNT는 숫자만 받고 천 단위 콤마와 「원」 접미, TASK_REFERENCE는 문서 검색 Dialog.
- **결재선 편집**: 참조 / n 단계 승인 / 「+ 승인 단계 추가하기」. 사람 선택은 active 구성원 Combobox(이름·소속·아바타)로 한다. 참조자 칩 옆에 알림 설정 드롭다운(「승인 요청, 완료 시 알림」, 「승인 완료 시 알림」, 「알림 없음」, 안내 「댓글 알림은 설정과 관계없이 수신돼요.」)을 둔다. 승인자 칩에는 「승인」 표시를 둔다(유형은 1개뿐이라 선택지 없음).
- **본문 편집기**: 굵게, 기울임, 밑줄, 취소선, 글자 크기(3단계), 글머리/번호 목록, 정렬, 표, 링크, 실행 취소/되돌리기. 이미지 삽입은 없다.
- **상태 뱃지**: `승인 필요`(노랑 계열), `진행중 n/N`(파랑 계열), `완료`, `반려`, `취소`. 모두 테마 토큰으로 칠한다.
- **타임라인 문구**: 「{이름}님이 글을 작성했어요.」, 「{이름}님이 승인·참조자를 변경했어요.」(+ 단계별 diff), 「{이름}님이 승인했어요.」, 「{이름}님이 반려했어요.」, 「{이름}님이 문서를 취소했어요.」, 「{이름}님이 문서를 수정했어요.」(+ 바뀐 칸 이름), 일반 댓글.
- **설정 화면**: 카드 2개(「워크플로우 관리자」는 시스템 관리자에게만 보임, 「양식 기본 결재선」). 기본 결재선 편집 UI는 작성 폼의 결재선 컴포넌트를 **재사용**한다.
- **인쇄 라우트** `/workflow-print/[id]`: dashboard layout 밖에서 A4 기준 흑백으로도 읽히게 한다. 로드 후 `window.print()`를 1회 호출한다.
- **로딩**: 목록 데이터 본문은 `PageLoadingSpinner variant="fill"`, 상세 패널과 Dialog는 `compact`로 한다. 필터·탭·작성 버튼은 Suspense 밖에 둔다.

---

## API / DB 요구사항

### SQL (backend-dev · Dev MCP만)

**`86_workflow_core.sql`**: 테이블, 인덱스, RLS, 열람 함수, bucket, notifications CHECK

| 테이블 | 주요 컬럼 | 비고 |
|--------|-----------|------|
| `workflow_admins` | `user_id` pk → profiles, `granted_by`, `created_at` | 시스템 관리자는 행이 없어도 워크플로우 관리자로 본다 |
| `workflow_templates` | `id` uuid, `template_key` unique, `name`, `description`(가이드), `emoji`, `content_default`, `attachment_visible`, `attachment_required`, `attachment_required_when` jsonb, `content_visible`, `only_visible_for_admin`, `edit_policy`, `approval_step_edit_enabled`, `display_order`, `tags` text[], `is_active`, timestamps | |
| `workflow_template_fields` | `id`, `template_id`, `field_key`(양식 안에서 unique), `name`, `type` CHECK(STRING·DATE·SELECT·MULTISELECT·AMOUNT_OF_MONEY·TASK_REFERENCE), `options` jsonb, `required`, `required_when` jsonb, `prefill_type` CHECK(NONE·DEFAULT·NAME), `prefill_default`, `display_order` | MULTISELECT는 데이터 모델에만 있고 1단계 seed는 미사용 |
| `workflow_template_default_approvers` | `template_id`, `step`(1부터), `user_id`, `position` | |
| `workflow_template_default_referrers` | `template_id`, `user_id`, `notification_setting` CHECK(START_AND_END·END·NONE) | |
| `workflow_document_counters` | `year` pk, `last_no` | RPC 안에서 `for update`로 잠근다 |
| `workflow_documents` | `id` uuid, `code` unique, `template_id`, `template_snapshot` jsonb(name, emoji, fields 정의 전체, attachment 규칙), `title`, `status` CHECK(IN_PROGRESS·DONE·DECLINED·CANCELED), `writer_id`, `inputs` jsonb(`[{field_key, value}]`), `content_html`, `search_text`, `current_step`, `total_steps`, `approval_step_edit_enabled`, `written_at`, `completed_at`, `canceled_at`, `created_at`, `updated_at` | 입력칸 정의는 **제출 시점 스냅샷**이다. 양식이 바뀌어도 옛 문서는 그대로 유지된다 |
| `workflow_approval_steps` | `document_id`, `step`, `status` CHECK(PENDING·ONGOING·APPROVED·DECLINED) | |
| `workflow_approval_actors` | `document_id`, `step`, `user_id`, `status` CHECK(WAITING·APPROVED·DECLINED), `acted_at`, `opinion` | |
| `workflow_document_referrers` | `document_id`, `user_id`, `notification_setting` | |
| `workflow_document_references` | `document_id`, `referenced_document_id` | |
| `workflow_document_events` | `id`, `document_id`, `type` CHECK(WRITE·CHANGE_STAGE_STAKE_HOLDERS·APPROVE·DECLINE·CANCEL·UPDATE·COMMENT), `actor_id`, `content`, `payload` jsonb(diff·changed_field_keys), `created_at` | 타임라인과 댓글 |
| `workflow_attachments` | `id`, `owner_user_id`, `document_id` null, `draft_id` null, `storage_path`, `file_name`, `mime_type`, `size_bytes`, `status` CHECK(staged·bound), `deleted_at`, `created_at` | document와 draft는 **둘 중 하나 이하**(CHECK) |
| `workflow_drafts` | `id`, `writer_id`, `template_id`, `payload` jsonb(inputs, content_html, steps, referrers, reference ids), timestamps | 번호를 소모하지 않는다 |
| `workflow_document_user_states` | `document_id`, `user_id`, `starred` | 중요(★) |

- **함수**
  - `is_workflow_admin(uid)`: 시스템 관리자 OR `workflow_admins` 행 존재. SECURITY DEFINER, stable
  - `workflow_can_view_document(doc_id, uid)`: 작성자 OR 결재선 actor(모든 단계) OR 참조자 OR `is_workflow_admin`
- **RLS select**
  - documents·steps·actors·referrers·references·events·attachments(bound)·user_states(본인 행): `workflow_can_view_document(…, auth.uid())`
  - templates·fields: `is_active and (not only_visible_for_admin or is_workflow_admin(auth.uid()))`
  - default approvers/referrers: 인증 사용자 select 허용(작성 폼 자동 채움)
  - drafts와 staged attachments: 본인 행만
  - workflow_admins: 본인 행 또는 시스템 관리자
  - counters: select 없음
- **쓰기 권한**: `authenticated`·`anon`의 INSERT/UPDATE/DELETE를 전부 revoke한다. 쓰기는 Route → service role → RPC 경로로만 한다.
- **Storage**: bucket `workflow-attachments`, `public=false`, `file_size_limit=20971520`. 객체 경로는 `staged/{user_id}/{uuid}/{file}`이고, bind 후에도 경로는 유지하고 DB 행만 갱신한다. 다운로드는 Route가 열람 판정 후 짧은 signed URL을 발급한다.
- **notifications CHECK**: 기존 22종을 유지하고 다음 6종을 추가한다. `workflow.approval_requested`, `workflow.referrer_requested`, `workflow.completed`, `workflow.declined`, `workflow.canceled`, `workflow.comment_created`.

**`87_workflow_rpc.sql`**: 쓰기 RPC. 전부 SECURITY DEFINER이고 execute 권한은 `service_role`에만 준다. 인자로 `p_actor_user_id`를 받아 RPC 안에서 권한·상태를 **다시 검사**한다.

- `workflow_submit_document`: 번호 발급, 문서·단계·참조자·참조문서 insert, 첨부 bind, draft 삭제, WRITE 이벤트, 1단계 ONGOING. 반환값에는 알림 대상 uid 목록을 포함한다.
- `workflow_approve` / `workflow_decline`: `for update` 잠금, 현재 ONGOING 단계의 WAITING actor 본인인지 검사, 단계·문서 전이, 이벤트, 알림 대상 반환
- `workflow_update_document`: 상태와 편집 권한 검사, inputs·content·첨부 추가와 제거, UPDATE 이벤트(changed_field_keys)
- `workflow_change_approval_line`: 작성자 여부, `approval_step_edit_enabled`, 완료 단계 불변, 승인한 사람 제거 금지 검사. diff 이벤트를 남기고 전이를 재계산하며 새로 차례가 된 사람을 반환한다.
- `workflow_cancel_document`, `workflow_add_comment`, `workflow_set_star`, `workflow_save_draft` / `workflow_delete_draft`, `workflow_set_template_policy`, `workflow_grant_admin` / `workflow_revoke_admin`
- **조건부 필수 검증은 Route(TS 공유 모듈)**가 한다. RPC는 구조, 권한, 상태만 검증한다.

**`88_workflow_expense_seed.sql`**: §조건부 필수 규칙의 지출결의서 seed(idempotent, `on conflict (template_key) do update`). 기본 결재선은 비워 둔다.

### API Route (backend-dev)

| Route | Method | 권한 | 비고 |
|-------|--------|------|------|
| `/api/workflow/documents` | GET | 세션 | `tab`·`scope`·`q`·`writer[]`·`template[]`·`updated`(today·7d·1m·3m·month:YYYY-MM·range:from..to)·`sort`·`cursor`·`group`(approval_required·in_progress). `scope=company`는 워크플로우 관리자만(아니면 403). **사용자 세션 클라이언트(RLS)**로 읽는다 |
| `/api/workflow/documents` | POST | 세션 | 제출. 조건부 필수, 결재선, 참조문서 열람 가능 여부, staged 첨부 소유를 검증한다 |
| `/api/workflow/documents/counts` | GET | 세션 | 탭별 건수 |
| `/api/workflow/documents/[id]` | GET · PATCH | 열람자 · 편집권자 | 열람 불가는 **404** |
| `/api/workflow/documents/[id]/approve` · `/decline` · `/cancel` | POST | 현재 차례 actor · 작성자 | |
| `/api/workflow/documents/[id]/approval-line` | PUT | 작성자 | |
| `/api/workflow/documents/[id]/comments` | POST | 열람자 | |
| `/api/workflow/documents/[id]/star` | PUT | 열람자 | body `{ starred }` |
| `/api/workflow/documents/[id]/attachments/[attachmentId]/download` | GET | 열람자 | signed URL |
| `/api/workflow/attachments/prepare` · `/complete` | POST | 세션 | staged 업로드. 20MB, 문서(또는 작성 세션)당 30개 |
| `/api/workflow/attachments/[id]` | DELETE | 소유자(staged만) | |
| `/api/workflow/drafts` | GET · POST | 본인 | |
| `/api/workflow/drafts/[id]` | GET · PUT · DELETE | 본인 | |
| `/api/workflow/templates` | GET | 세션 | 작성 가능한 양식 |
| `/api/workflow/templates/[templateKey]` | GET | 세션 | 필드 + 기본 결재선 |
| `/api/workflow/templates/[templateKey]/policy` | PUT | 워크플로우 관리자 | |
| `/api/workflow/admins` | GET · POST | 시스템 관리자 | |
| `/api/workflow/admins/[userId]` | DELETE | 시스템 관리자 | |
| `/api/workflow/members` | GET | 세션 | active 구성원(이름·소속·아바타·user_id). 결재선 Combobox용 |

- **세션 헬퍼**: `requireWorkflowAdminSession()` / `requireWorkflowAdminPage()`를 `session.server.ts`에 추가한다(benefits 헬퍼 패턴). 문구는 「워크플로우 관리자 권한이 필요합니다.」.
- **middleware·proxy**: `/dashboard/workflow/settings`를 `WORKFLOW_ADMIN_DASHBOARD_PATHS`로 추가하고, 미권한이면 `/dashboard/workflow`로 redirect한다. `/workflow-print/*`는 로그인이 필요한 경로로 추가한다.
- **본문 정화**: POST·PATCH·draft 저장 때 서버에서 allowlist로 HTML을 정화한다(태그: p, br, strong, em, u, s, span[style=font-size·text-align 제한], h1~h3, ul, ol, li, table 계열, a[href=http(s)/mailto]). 라이브러리(`sanitize-html` 등)는 backend-dev가 고른다.
- **알림 fan-out**(Route에서 RPC가 돌려준 uid로 service role insert, 본인 제외, uid 중복 제거). metadata는 `workflow_document_id`, `document_code`, `template_key`만 넣는다.

| type | 수신자 | title / body 예 |
|------|--------|-----------------|
| `workflow.approval_requested` | 새로 ONGOING이 된 단계의 actor(제출·승인 진행·결재선 변경 시) | 「지출결의서 승인 요청」 / 「{작성자}님의 지출결의서({code})를 승인해 주세요.」 |
| `workflow.referrer_requested` | 제출 시 `START_AND_END` 참조자 | 「지출결의서 참조 요청」 |
| `workflow.completed` | 작성자 + `START_AND_END`·`END` 참조자 | 「지출결의서가 승인 완료되었어요」 |
| `workflow.declined` | 작성자 + `START_AND_END`·`END` 참조자 | 「지출결의서가 반려되었어요」 |
| `workflow.canceled` | 취소 시점에 진행 중 단계의 WAITING actor | 「지출결의서가 취소되었어요」 |
| `workflow.comment_created` | 작성자 + 모든 actor + 모든 참조자(설정 무관) − 댓글 작성자 | 「지출결의서에 새 댓글」 |

- `notification-helpers.ts`·`notification-infinite-list.tsx`에 `view-workflow` 액션을 추가해 `/dashboard/workflow?doc={id}`로 이동하게 한다.

### FE service layer (frontend-dev)

- `src/features/workflow/api/{types,service,queries,mutations,keys}.ts`. Read는 `useSuspenseQuery`, CUD는 `mutations.ts`의 `onSettled` invalidate로 한다(`workflowKeys.all`, 상세는 `detail(id)`, 건수는 `counts`).
- URL 상태는 nuqs로 둔다: `tab`, `scope`, `q`(debounce 500ms), `writer`, `template`, `updated`, `sort`, `doc`.
- 폼은 `useAppForm`이다. 양식 필드 정의로 **동적 필드**를 만들고, 검증은 공유 `required-rules.ts`를 form-level validator로 연결한다. 제출 성공 시 `form.reset`.
- **신규 의존성**(frontend-dev 결정, plan 범위 내 허용): 리치텍스트 편집기(예: Tiptap `@tiptap/react` + starter-kit + underline·text-align·table·link·text-style), 서버 HTML 정화 라이브러리 1개. 그 밖의 신규 의존성은 금지한다.

---

## 활동 감사 로그 (기록 연동)

> `core-conventions.mdc` §활동 감사 로그 · [plan 08](./08_activity-audit-log-plan.md). `ActivityAction`·`ActivityTargetType`(`workflow_document`·`workflow_draft`·`workflow_attachment`·`workflow_template`·`workflow_admin`)·`labels.ts`(한국어 라벨)에 추가한다.

| Route | Method | action | 라벨 | 기록 분기 |
|-------|--------|--------|------|-----------|
| `/api/workflow/documents` | POST | `workflow.document_create` | 워크플로우 문서 작성 | 401·403·400·500·201 |
| `/api/workflow/documents/[id]` | PATCH | `workflow.document_update` | 워크플로우 문서 수정 | 401·403·404·400·409·500·200 |
| `…/[id]/approve` | POST | `workflow.document_approve` | 워크플로우 승인 | 401·403·404·409·500·200 |
| `…/[id]/decline` | POST | `workflow.document_decline` | 워크플로우 반려 | 401·403·404·400·409·500·200 |
| `…/[id]/cancel` | POST | `workflow.document_cancel` | 워크플로우 문서 취소 | 401·403·404·409·500·200 |
| `…/[id]/approval-line` | PUT | `workflow.approval_line_update` | 워크플로우 결재선 변경 | 401·403·404·400·409·500·200 |
| `…/[id]/comments` | POST | `workflow.comment_create` | 워크플로우 댓글 | 401·404·400·500·201 |
| `…/[id]/star` | PUT | `workflow.document_star` | 워크플로우 중요 표시 | 401·404·400·500·200 |
| `/api/workflow/attachments/prepare` · `/complete` | POST | `workflow.attachment_upload` | 워크플로우 첨부 업로드 | 401·400·404·500·200/201 |
| `/api/workflow/attachments/[id]` | DELETE | `workflow.attachment_delete` | 워크플로우 첨부 삭제 | 401·404·500·200 |
| `/api/workflow/drafts` · `/drafts/[id]` | POST · PUT | `workflow.draft_save` | 워크플로우 임시저장 | 401·404·400·500·200/201 |
| `/api/workflow/drafts/[id]` | DELETE | `workflow.draft_delete` | 워크플로우 임시저장 삭제 | 401·404·500·200 |
| `/api/workflow/templates/[key]/policy` | PUT | `workflow.template_policy_update` | 워크플로우 기본 결재선 변경 | 401·403·404·400·500·200 |
| `/api/workflow/admins` | POST | `workflow.admin_grant` | 워크플로우 관리자 지정 | 401·403·400·409·500·201 |
| `/api/workflow/admins/[userId]` | DELETE | `workflow.admin_revoke` | 워크플로우 관리자 해제 | 401·403·404·500·200 |
| GET 전부, `/workflow-print/*` | — | — | — | **Out (Read)** |

- `target_label`: `workflow:{code 또는 id}:{양식명}`. 관리자 지정·해제는 `target_user_id`에 대상 uid를 넣는다.
- **metadata allowlist**: `document_id`, `document_code`, `template_key`, `step`, `starred`, `changed_field_keys`, `attachment_count`, `error_code`. **입력값·금액·계좌·댓글·사유·파일 내용 금지**(파일명도 넣지 않는다).
- 검증 AC: **AC-42**. 삭제 확인 `AlertModal`: **AC-04·31·33·34**.

---

## 영향 파일 & 패턴

| 경로 | 변경 |
|------|------|
| `supabase/sql/86~88_*.sql` | 신규 |
| `src/features/workflow/**` | 신규 feature(api, components, lib/required-rules.ts, lib/summary.ts) |
| `src/app/dashboard/workflow/page.tsx` · `loading.tsx` · `settings/page.tsx` | 신규 |
| `src/app/workflow-print/[id]/page.tsx` | 신규(dashboard layout 밖, `requireDashboardSession` + RLS 조회, Presence track 금지) |
| `src/app/api/workflow/**` | 신규 Route |
| `src/features/auth/api/session.server.ts` | 워크플로우 관리자 헬퍼 |
| `src/config/admin-routes.ts` · `middleware.ts` · `proxy.ts` | settings 경로 가드, print 경로 로그인 필요 |
| `src/config/nav-config.ts` · `src/types/index.ts` · `src/contexts/nav-access.tsx` · `src/hooks/use-nav.ts` · `src/app/dashboard/layout.tsx` | 그룹 「워크플로우」, `hasWorkflowAdminNav` |
| `src/features/activity-logs/api/types.ts` · `labels.ts` | action·target_type·라벨 |
| `src/features/notifications/components/notification-helpers.ts` · `notification-infinite-list.tsx` (+ 알림 type 유니온) | `workflow.*` 6종, `view-workflow` |
| `scripts/cleanup-e2e-mock-data.mjs` | `E2E-WF-` 표식 정리, Storage 객체 삭제 |
| `playwright.config.ts` · `e2e/workflow/**` | 프로젝트 추가(여러 storageState 사용) |

**따를 패턴**: 공지(`src/app/api/announcements/_utils.ts`의 `logXxxAuthFailure`, `jsonWithActivityLog`), 계약 첨부 prepare/complete(plan 53), 서비스 계층 읽기는 `createClient()`(RLS)·쓰기는 `getServiceRoleClient()`, 복지비 권한 헬퍼(plan 76), CS 문의 상세 `?support=` 쿼리 패턴.

---

## 리스크 & 완화

| # | 등급 | 리스크 | 완화 |
|---|------|--------|------|
| 1 | HIGH | 범위가 크다(약 60개 파일). 한 번에 만들다가 중간에 깨진다 | 아래 Battle Plan 체크포인트 3곳에서 build와 부분 spec을 돌린다. BE는 RPC 단위 SQL 테스트를 먼저 한다 |
| 2 | HIGH | 서비스 롤 쓰기 때문에 RLS가 우회되어 권한 구멍이 생긴다 | 읽기는 **사용자 세션 클라이언트**로만 한다. 모든 쓰기 RPC가 `p_actor_user_id`로 권한·상태를 재검사한다. AC-22~25 매트릭스와 AC-24 SQL로 검증한다 |
| 3 | HIGH | 조건부 필수가 클라이언트와 서버에서 어긋난다(이번 대체의 핵심 이유) | 판정 함수를 1곳에 두고 같이 import한다(AC-47 grep). 서버는 DB 필드 정의만 신뢰한다(AC-13 ⑥) |
| 4 | MED | 동시 승인이나 번호 발급이 경쟁한다 | RPC 안에서 `for update`로 잠근다. counter 행도 잠근다. 같은 동작을 다시 하면 409 |
| 5 | MED | 리치텍스트 HTML로 XSS가 들어온다 | 서버 allowlist로 정화하고, 렌더링은 정화된 HTML만 한다. AC-41로 검증 |
| 6 | MED | 결재선 변경 후 전이 계산 오류(단계가 비거나, 자동 완료) | RPC 한 곳에서 재계산하고 AC-29·30으로 검증. 완료 단계는 불변 |
| 7 | MED | 여러 계정이 필요한 e2e가 불안정하다 | API로 픽스처 문서를 만들고 UI는 확인만 한다. 테스트마다 고유 `E2E-WF-{ts}` 표식을 쓴다. 기본 결재선은 끝나면 원복 |
| 8 | LOW | 승인자가 퇴사하면 문서가 멈춘다 | 1단계 Out. 작성자가 결재선을 바꿀 수 있다. 열린 질문으로 남긴다 |
| 9 | LOW | staged 첨부가 고아로 남는다 | e2e cleanup으로 처리하고, 운영 정리 Cron은 후속으로 둔다 |

---

## Battle Plan (단계)

```
SCOPE
  Goal: flex 전자결재를 WakeOne에 지출결의서 1종으로 대체하고, 조건부 필수를 화면과 서버에서 강제한다
  Done when: AC-01~48 green, build 통과, AC-49 수동 QA 체크리스트 전달
  Not doing: 양식 빌더, 이관, 위임, 그룹/보기 저장/고급 필터, 이메일·Slack

STEPS
  0. [ ] root: Step 0 스냅샷 백업                                         Confidence: HIGH
  1. [ ] designer: 화면 구조, 컴포넌트 선택, testid 확정(flex 스크린샷 기준)    Confidence: HIGH
  2. [ ] backend-dev: SQL 86(스키마·RLS·bucket·CHECK) → 87(RPC) → 88(seed), Dev MCP 적용
         → SQL로 RLS와 RPC 검증(AC-24·46)                                  Confidence: MED
         ▶ 체크포인트 A: SQL 적용과 RPC 단위 확인
  3. [ ] backend-dev: 공유 required-rules.ts, 세션 헬퍼, Route 전체(로그·알림 포함), 본문 정화
         middleware/proxy, activity·notification 타입                       Confidence: MED
         ▶ 체크포인트 B: tsc + API spec(AC-06·13·14·15·21·22·27·28·30·41·42) green
  4. [ ] frontend-dev: nav와 문서함 목록(탭·범위·검색·필터·정렬)              Confidence: HIGH
  5. [ ] frontend-dev: 작성 폼(동적 필드·조건부 필수·첨부·편집기·결재선·임시저장·참조문서)  Confidence: MED
  6. [ ] frontend-dev: 상세(타임라인·댓글·승인/반려·수정·결재선 변경·취소·중요·복제), 인쇄 라우트, 설정 화면, 모바일
         ▶ 체크포인트 C: build + 핵심 UI spec(AC-07~12·16~20)
  7. [ ] verifier: e2e/workflow 전체 spec, grep, SQL AC, tsc·lint·react-doctor·build, cleanup  Confidence: MED

ROLLBACK
  Dev DB: 86~88 역순 drop(workflow_* 테이블·함수·bucket 삭제, notifications CHECK 이전 22종 복원). 코드는 Step 0 스냅샷으로 되돌린다.
  기존 기능은 notifications CHECK 외에 수정하지 않으므로 영향 범위가 작다.

ESTIMATE
  범위: 신규 약 55~70개 파일, 약 6,000~8,000줄(SQL 약 900줄 포함). 복잡도 Complex
  designer 20~30분 · backend 120~180분 · frontend 180~270분 · verifier 60~90분
  합계: 약 6~10시간(에이전트 연속 실행 기준)
```

---

## 팀별 구현 순서

1. **root**: Step 0 스냅샷
2. **designer**: §UI 요구사항 + testid 표 확정. flex 스크린샷과 컴포넌트를 매핑한다(공지·CS 문의·퀵 화면 패턴 재사용).
3. **backend-dev**: Step 2·3(Dev MCP만, **Main 금지**)
4. **frontend-dev**: Step 4·5·6
5. **verifier**: Step 7, AC-01~48. AC-49는 사용자 전달용 체크리스트로 남긴다.

## 검증 체크리스트 (verifier)

- [ ] `npx playwright test e2e/workflow` green(UI와 API spec 모두. 여러 storageState 사용)
- [ ] 조건부 필수: UI AC-08~12, API AC-13·27
- [ ] 권한: AC-03·18·22·23·25·30·36과 SQL AC-24(RLS)
- [ ] activity log AC-42(`x-request-id` + action 행 + metadata에 입력값 없음)
- [ ] 알림 AC-19·20·21·31·32(수신자, 클릭 이동)
- [ ] grep AC-31·47, SQL AC-46
- [ ] tsc · lint · react-doctor · `npm run build`
- [ ] `npm run e2e:cleanup` exit 0(AC-48)
- [ ] AC-49 수동 QA 체크리스트를 사용자에게 전달

---

## 열린 질문

- 승인자가 퇴사(비활성)하면 진행 중 문서를 누가 정리할지(워크플로우 관리자가 결재선을 대신 변경할지) → 2단계 `[TBD]`
- 계약서·복지비 양식을 WakeOne으로 옮길 때 plan 16·47·78·80의 flex import를 어떻게 바꿀지 → 양식 빌더 단계에서 별도 plan `[TBD]`
- 운영(Main) DB 적용 시점과 flex 지출결의서 사용 중단 공지 → 사용자 결정 `[TBD]`
- 한 단계 여러 승인자의 「모두 승인」 규칙이 flex와 같은지 실제 사용으로 확인 `[INFERRED]`
- SQL 번호 86~88 → backend-dev가 `list_migrations`로 최종 확인

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-10-21 | 최초 작성 · Approved(/root 단일 게이트, deep-interview 답변 반영) · 공통 양식 틀 + 지출결의서 seed · 조건부 필수(데이터 규칙, 클라이언트와 서버 공유 판정) · 문서함·상세·작성·결재 처리·임시저장·중요·복제·PDF 인쇄·참조문서·검색/필터/정렬 · 워크플로우 설정(관리자 지정, 기본 결재선) · 앱 내 알림 6종 · activity log 15 action · RLS 강제 · SQL 86~88 예정 · AC 49개 | planner |
