# flex 워크플로우(전자결재) 리버스 엔지니어링 결과 — 2026-10-21

수집 방법: 화면이 보이는 Chromium(Playwright)에 사용자가 로그인 → 스크립트가 화면을 조작하며 flex API 통신을 기록. 원본 자료(스크린샷·통신 기록, 실데이터 포함 · git 밖): `/Users/hoon/Desktop/Wake_Auto/flex-workflow-lab/`
쓰기 작업(제출·승인·반려·저장)은 0건. 화면: `steps/*.png`, 양식 정의: `template-expense.json`, 상세 예시: `detail-expense.json`, 통신: `capture.jsonl`(인증 토큰 제거).

## 1. 화면 구성

### 내 문서함 `/workflow/archive/my?tab=in-progress|done|star|all`
- 탭: 진행중 / 완료 / 중요 / 전체 (탭마다 총 건수)
- 범위 토글: 전체 | 내가 작성한
- 필터 칩: 작성자(구성원 검색·다중선택), 양식(양식 다중선택, 태그 분류), 업데이트일(오늘/지난 1주일/1개월/3개월/월별/직접 입력), `+ 필터 추가`(날짜, 대상자, 문서 상태, 승인자, 작성일, 진행 상태, 참조자)
- 우측 도구: 검색, 정렬(최근/오래된 업데이트순, 최근/오래된 작성순, 정확도순), 그룹(진행상태 / 사용 안 함), 보기, 초기화, 보기 저장
- 진행중 탭 그룹: **승인 필요 문서**(내가 지금 승인할 차례, 5개 + 더보기) / **진행중 문서**(20개씩)
- 목록 행: 양식 아이콘(이모지) · 작성자 · 상대시간 · 상태 뱃지(`승인 필요` 노랑 / `진행중 n/N` 파랑) · 양식명 · **입력값 한 줄 요약**(`필드명: 값 · …`) · 첨부파일 n건 · 결재자 아바타(+n명) · 행마다 체크박스

### 문서 상세 (목록 위 오른쪽 패널, URL `&workflow-action=view&workflow-task-key={documentKey}`)
- 상단: 이전/다음 문서 ↑↓, 중요(★), 공유, `···`(문서 수정 · 복제하기 · 히스토리 · PDF 인쇄 · 문서 취소), 패널/전체화면 전환, 닫기
- 상태 뱃지 + 제목 + 문서번호(`YYYY-NNNN`) + 작성 일시
- **활동 타임라인**: 작성, 승인·참조자 변경(변경 전→후 diff), 승인, 댓글, 문서 수정 → 아래 댓글 입력창
- 입력 필드 표(아이콘 + 라벨 + 값, SELECT는 칩)
- 첨부파일(n) · 모두 저장, 썸네일 카드
- 본문(리치텍스트 HTML)
- 오른쪽 사이드: **승인·참조** — 참조자 목록(알림 뱃지), 단계별 승인자(`n 단계 진행 중/대기중/완료`, 사람별 `대기중`/`✓ 승인`)
- 내가 승인할 차례면 하단 고정 버튼: **반려** / **승인**

### 문서 작성하기 (모달)
- 1단계 양식 선택: 검색, **이어서 작성하기(임시저장 n개, 지우기)**, 태그 칩(전체/계약…), 양식 목록(이모지 + 이름)
- 2단계 작성 폼(모달, 좌 폼 / 우 결재선):
  - 양식 설명(작성 가이드) → 입력 필드(필수 빨간 점) → 참조문서 → 첨부파일(드래그, 20MB 이하·최대 30개) → 리치텍스트 에디터(B/I/U/S, 글자크기, 목록, 정렬, 이미지, 표, 링크, 실행취소)
  - 오른쪽: 참조(+), 1단계 승인(+), 2단계 승인(+), `+ 승인 단계 추가하기`. 양식별 **기본 결재선이 자동으로 채워짐**
  - 승인자 유형 드롭다운: `승인(기본)` (우리 회사는 승인만 사용)
  - 참조자 알림 설정: 승인 요청·완료 시 알림 / 승인 완료 시 알림 / 알림 없음
  - 하단 고정 **보내기**

## 2. 데이터 모델 (API 응답에서 추출)

### 양식 template
`templateKey, name, description(작성 가이드), emoji, content(본문 기본값), attachmentVisible, attachmentRequired, contentVisible, onlyVisibleForAdmin, editPolicy(AUTHOR_AND_APPROVER), displayOrder, tags[], inputFields[]`
+ 결재 정책(approval policy): 기본 단계별 승인자 `stepActors[{step, actors[{type:USER, value}]}]`, 기본 참조자 `referrers[{target, notificationSetting}]`, `approvalStepEditEnabled`(작성자가 결재선 수정 가능)

### 입력 필드 inputField
`idHash, name, displayOrder, type, data, required, prefill{type, defaultValue}`
- type: `STRING`, `DATE`, `SELECT`(data=옵션 JSON 배열), `MULTISELECT`, `AMOUNT_OF_MONEY`(data={currencyCode:KRW}), `TASK_REFERENCE`(참조문서)
- prefill.type: `NONE`, `DEFAULT`, `NAME`(작성자 이름 자동)

### 문서 document
`documentKey, code(2026-2937 연도별 일련번호), templateKey, status, emoji, title, writer, writtenAt, inputs[{value(문자열, 다중선택은 JSON 배열), inputField 스냅샷}], attachments[], content(HTML), comments[], audiences, editPolicy, createdAt, updatedAt`
- 문서 status: `IN_PROGRESS`, `DONE`, `DECLINED`, `CANCELED` (+ 임시저장 draft는 별도 목록)
- 입력 필드는 **제출 시점 스냅샷**으로 문서에 같이 저장됨 → 양식이 나중에 바뀌어도 옛 문서는 그대로

### 결재 진행 approvalProcess
`status(ONGOING/APPROVED/…), requesterIdHash, lines[{step, status, actors[{target, status}]}], referrers[{target, notificationSetting: START_AND_END…}], option{approvalStepEditEnabled}, requestedAt`
- line status: `PENDING` → `ONGOING`(현재 단계) → `APPROVED` (반려 시 DECLINED 추정)
- 단계 안 actors가 배열 → 한 단계에 여러 명 가능
- 목록의 `진행중 n/N` = 현재 단계 / 전체 단계 수

### 내 문서함 상태 myBoxInfo (사용자별)
`starred(중요), unread, referred(내가 참조자), approvalRequired(지금 내 차례), editable, cancelable`

### 활동/댓글 comment
`type: WRITE | CHANGE_STAGE_STAKE_HOLDERS | APPROVE | NORMAL(일반 댓글) | UPDATE(문서 수정)`, `writtenBySystem`, `content`, `createdAt`

## 3. 주요 API
| 용도 | 호출 |
|---|---|
| 문서함 목록 | `POST /action/v3/approval-document/user-boxes/search?size&sortType=LAST_UPDATED_AT&direction=DESC` body `{filter:{statuses[], approvalRequired?, templateKeys[], writerHashedIds[], approverTargets[], referrerTargets[], starred}, search:{keyword, type:ALL}}` |
| 탭 매핑 | 진행중=`[IN_PROGRESS]`(approvalRequired true/false 두 번 호출), 완료=`[DONE,DECLINED,CANCELED]`, 중요=전 상태+starred, 전체=전 상태 |
| 문서 상세 | `GET /api/v3/approval-document/approval-documents/{key}` |
| 첨부 | `GET …/{key}/attachments/files/{fileKey}`, `POST …/user-boxes/approval-documents/attachments/metadata-by-search` |
| 작성 가능한 양식 | `GET /api/v3/approval-document-template/available-templates` |
| 양식 태그 | `GET /api/v3/approval-document-template/tags` |
| 양식 + 기본 결재선 | `POST /action/v3/approval-document-template/templates/{templateKey}/resolve-policy` |
| 임시저장 목록/열기 | `GET /api/v3/approval-document/approval-documents/draft?offset&limit`, `GET …/{key}/draft` |
| 결재자 확인 | `POST /action/v2/approval/…/validate-resolve-targets`, 위임 `GET …/delegations/effective` |
| 권한 | `GET …/approval-documents.options`, `…/templates.options` (GRANTED/FORBIDDEN) |

## 4. 지출결의서 양식 (우리 회사 실제 설정)
| # | 필드 | 타입 | 필수 | 비고 |
|---|---|---|---|---|
| 1 | 요청 유형 | SELECT | ✓ | 입, 출금 요청 / 구매 요청 |
| 2 | 작성자 | STRING | ✓ | 작성자 이름 자동 |
| 3 | 작성일 | DATE | ✓ | |
| 4 | 사용 브랜드 | SELECT | ✓ | 산스 / 킨키 / 비욘드푸드 / 웨이크 / 산스파운드리 |
| 5 | 금액 | AMOUNT_OF_MONEY | ✓ | KRW |
| 6 | 입금 ,구매 요청기한 | DATE | ✓ | |
| 7 | 업체명 및 예금주 | STRING | ✓ | |
| 8 | 계좌정보(은행명) | STRING | ✓ | |
| 9 | 품명 및 수량 | STRING | ✓ | |
| 10 | 수령지 | STRING | ✓ | |
| 11 | 수령인(연락처필수) | STRING | ✓ | |
| 12 | 링크(URL) | STRING | ✓ | |
| 13 | 구매 사유(상세히) | STRING | ✓ | |
| 14 | 비고 | STRING | | |
| 15 | 참조문서 | TASK_REFERENCE | | 다른 결재 문서 연결 |
- 첨부 허용(필수 아님), 본문 사용. 기본 결재선: 1단계 1명 → 2단계 1명, 참조 3명(승인 요청·완료 시 알림). 작성자가 단계를 추가·변경할 수 있음(실제 문서는 4단계로 바꿔서 올림).
- 가이드 문구상 "요청 유형"에 따라 필수 항목이 달라지지만, flex는 조건부 필수를 지원하지 않아 전부 필수로 두고 "-" 입력을 안내함 → **WakeOne에서 개선할 수 있는 지점**.

## 5. 다른 양식(나중 단계 참고)
법인 서류 사용 승인 요청, 계약서 체결 요청, 택시 사용 신청서, 도서 신청서, 체력증진비 신청, 연장/휴일근로 신청서, 야근 식비 사용 내역, 품의서, 출장 신청서/보고서, 출장 예산 증액, 경조금, 외부교육, 원격근무 신청/리포트, 조기출근, 세금계산서 발행 요청, 휴직 신청 — 모두 같은 template + inputFields 구조라서 **양식 빌더 하나로 전부 표현 가능**.
