import type { ActivityAction, ActivityLogMetadata } from './api/types';

export const ACTION_LABELS: Record<ActivityAction, string> = {
  'user.create': '사용자 생성',
  'user.invite': '사용자 초대',
  'user.update': '사용자 정보 수정',
  'user.reactivate': '사용자 재활성화',
  'user.deactivate': '사용자 비활성화',
  'office_snack.session_create': '간식 투표 세션 생성',
  'office_snack.session_update': '간식 투표 세션 수정',
  'office_snack.session_delete': '간식 투표 세션 삭제',
  'office_snack.candidate_create': '간식 후보 등록',
  'office_snack.candidate_update': '간식 후보 수정',
  'office_snack.candidate_delete': '간식 후보 삭제',
  'office_snack.vote_submit': '간식 투표 제출',
  'contract.import_create': '계약서 가져오기(신규)',
  'contract.import_duplicate': '계약서 가져오기(중복)',
  'contract.import_backfill': '계약서 가져오기(보강)',
  'contract.import_failed': '계약서 가져오기(실패)',
  'contract.update': '계약서 수정',
  'contract.soft_delete': '계약서 삭제',
  'contract.attachment_upload': '계약서 첨부파일 업로드',
  'contract.attachment_soft_delete': '계약서 첨부파일 삭제',
  'contract.no_attachment_set': '계약서 첨부 없음 처리',
  'contract.no_attachment_unset': '계약서 첨부 없음 해제',
  'contract.reminder_send': '계약서 독촉 메일 발송',
  'contract.reminder_failed': '계약서 독촉 메일 실패',
  'profile.update': '프로필 수정',
  'profile.password_change': '비밀번호 변경',
  'notification.read': '알림 읽음',
  'notification.read_all': '알림 모두 읽음'
};

export const METADATA_LABELS: Record<string, string> = {
  error_code: '오류 유형',
  message: '안내 메시지',
  validation_errors: '입력 오류 상세',
  changed_fields: '변경된 항목',
  attempted_target: '시도 대상',
  document_number: '문서번호',
  file_name: '파일명',
  recipient_email: '수신 이메일',
  asset_number: '자산번호',
  asset_name: '자산명',
  category: '분류',
  usage_location: '사용 위치',
  session_state: '세션 상태',
  source_message_id: '원본 메시지 ID',
  source_type: '원본 유형',
  missing_document_numbers: '누락 문서번호',
  status: '상태',
  unmatched_count: '미매칭 건수',
  unmatched_author_names: '미매칭 작성자',
  verification_mode: '검증 모드',
  safety_filter_result: '안전 필터 결과'
};

const SESSION_TARGET_PATTERN = /^session:(\d+)$/;
const SESSION_CANDIDATE_TARGET_PATTERN = /^session:(\d+):candidate:(\d+)$/;

export function formatTargetLabel(targetLabel: string): string {
  if (targetLabel === 'office_snack') {
    return '간식 투표';
  }

  const sessionMatch = targetLabel.match(SESSION_TARGET_PATTERN);
  if (sessionMatch) {
    return `간식 투표 세션 #${sessionMatch[1]}`;
  }

  const candidateMatch = targetLabel.match(SESSION_CANDIDATE_TARGET_PATTERN);
  if (candidateMatch) {
    return `간식 후보 #${candidateMatch[2]}`;
  }

  return targetLabel;
}

export function getMetadataLabel(key: string): string {
  if (METADATA_LABELS[key]) {
    return METADATA_LABELS[key];
  }

  return key
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getResultLabel(httpStatus: number): string {
  if (httpStatus >= 200 && httpStatus < 300) {
    return '성공';
  }

  if (httpStatus === 401) {
    return '로그인 필요';
  }

  if (httpStatus === 403) {
    return '권한 없음';
  }

  if (httpStatus === 400) {
    return '입력 오류';
  }

  if (httpStatus === 404) {
    return '대상 없음';
  }

  if (httpStatus >= 500) {
    return '서버 오류';
  }

  if (httpStatus >= 400) {
    return '실패';
  }

  return '알 수 없음';
}

export function getResultBadgeClass(httpStatus: number): string {
  if (httpStatus >= 500) {
    return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300';
  }

  if (httpStatus >= 400) {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300';
  }

  if (httpStatus >= 200 && httpStatus < 300) {
    return 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300';
  }

  return '';
}

export function getMetadataEntries(metadata: ActivityLogMetadata): Array<[string, unknown]> {
  const entries = Object.entries(metadata).filter(([, value]) => value !== undefined);

  return entries.toSorted(([keyA], [keyB]) => {
    if (keyA === 'message') return -1;
    if (keyB === 'message') return 1;
    return keyA.localeCompare(keyB, 'ko');
  });
}
