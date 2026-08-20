import type { ActivityAction, ActivityLog, ActivityLogMetadata } from './api/types';

const SUPPORT_COMMENT_ACTIONS: ActivityAction[] = [
  'support.comment_create',
  'support.comment_update',
  'support.comment_delete'
];

export const ACTION_LABELS: Record<ActivityAction, string> = {
  'user.create': '사용자 생성',
  'user.invite': '사용자 초대',
  'user.update': '사용자 정보 수정',
  'user.reactivate': '사용자 재활성화',
  'user.deactivate': '사용자 비활성화',
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
  'wallet.sync_create': '지갑 동기화',
  'wallet.sync_failed': '지갑 동기화 실패',
  'profile.update': '프로필 수정',
  'profile.password_change': '비밀번호 변경',
  'auth.password_reset_request': '비밀번호 찾기 요청',
  'auth.password_reset_complete': '비밀번호 찾기 완료',
  'auth.force_password_change': '초기 비밀번호 강제 변경',
  'notification.read': '알림 읽음',
  'notification.read_all': '알림 모두 읽음',
  'announcement.create': '공지 등록',
  'announcement.update': '공지 수정',
  'announcement.delete': '공지 삭제',
  'announcement.attachment_upload': '공지 첨부 업로드',
  'announcement.attachment_delete': '공지 첨부 삭제',
  'support.create': 'CS 문의 등록',
  'support.update': 'CS 문의 수정',
  'support.status_update': 'CS 문의 상태 변경',
  'support.comment_create': 'CS 댓글 등록',
  'support.comment_update': 'CS 댓글 수정',
  'support.comment_delete': 'CS 댓글 삭제'
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
  matched_count: '매칭 건수',
  request_id: '요청 ID',
  verification_mode: '검증 모드',
  safety_filter_result: '안전 필터 결과',
  announcement_id: '공지 ID',
  support_request_id: 'CS 문의 ID',
  comment_id: '댓글 ID',
  parent_id: '부모 댓글 ID',
  root_comment_id: '최상위 댓글 ID',
  depth: '댓글 깊이',
  deleted_by_admin: '관리자 삭제',
  body_length: '본문 길이',
  previous_status: '이전 상태',
  new_status: '변경 상태',
  title: '제목'
};

export function isSupportCommentAction(action: ActivityAction): boolean {
  return SUPPORT_COMMENT_ACTIONS.includes(action);
}

export function isSupportCommentReply(
  metadata: ActivityLogMetadata,
  httpPath?: string
): boolean {
  if (httpPath?.includes('/replies')) {
    return true;
  }

  if (metadata.parent_id != null) {
    return true;
  }

  if (typeof metadata.depth === 'number' && metadata.depth > 0) {
    return true;
  }

  return false;
}

export function getSupportCommentTypeLabel(
  metadata: ActivityLogMetadata,
  httpPath?: string
): '원댓글' | '답글' | null {
  const hasParentId = metadata.parent_id !== undefined;
  const hasDepth = metadata.depth !== undefined;
  const hasRepliesPath = httpPath?.includes('/replies') ?? false;

  if (!hasParentId && !hasDepth && !hasRepliesPath) {
    return null;
  }

  return isSupportCommentReply(metadata, httpPath) ? '답글' : '원댓글';
}

export function getActivityActionLabel(
  log: Pick<ActivityLog, 'action' | 'metadata' | 'http_path'>
): string {
  const base = ACTION_LABELS[log.action];

  if (isSupportCommentAction(log.action) && isSupportCommentReply(log.metadata, log.http_path)) {
    return base.replace('CS 댓글', 'CS 답글');
  }

  return base;
}

export function formatTargetLabel(targetLabel: string): string {
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
