import 'server-only';

import { getProfileDisplayName } from '@/features/auth/lib/display-name';
import type { BenefitType } from '@/features/benefits/api/types';
import { WALLET_BALANCE_EMAIL_SLOT_COPY } from '@/features/wallet/constants/wallet-balance-email-slot-copy';
import { normalizePersonName } from '@/lib/normalize-person-name';
import { getServiceRoleClient } from '@/lib/supabase/service-role';
import {
  filterMonitoredFields,
  formatUserUpdateBody,
  USER_UPDATE_NOTIFICATION_TITLE
} from './labels';

type InsertUserUpdateNotificationInput = {
  recipientUserId: string;
  changedFields: string[];
  actorUserId: string;
};

type InsertContractReminderAdminNotificationsInput = {
  runId: number;
  runKey: string;
  triggerSource: 'admin' | 'cron';
  sentCount: number;
  failedCount: number;
  unmatchedCount: number;
  groupsLength: number;
  runStatus: 'completed' | 'partial_failed' | 'failed';
};

type InsertContractReminderRecipientNotificationInput = {
  recipientUserId: string;
  runId: number;
  authorName: string;
  documentNumbers: string[];
};

type InsertWalletSyncNotificationsInput = {
  requestId: string;
  matchedUserIds: string[];
  matchedCount: number;
  unmatchedCount: number;
};

type InsertWalletBalanceEmailNotificationInput = {
  recipientUserId: string;
  runId: number;
  slot: 1 | 2;
};

type InsertWalletBalanceEmailAdminNotificationsInput = {
  runId: number;
  runKey: string;
  triggerSource: 'admin' | 'cron';
  dueCount: number;
  sentCount: number;
  failedCount: number;
  blockedCount: number;
  skippedCount: number;
  runStatus: 'completed' | 'partial_failed' | 'failed';
};

type InsertSupportAdminNotificationsInput = {
  actorUserId: string;
  supportRequestId: number;
  title: string;
  preview: string;
  type: 'support.created' | 'support.updated';
};

type InsertSupportStatusChangedNotificationInput = {
  actorUserId: string;
  recipientUserId: string;
  supportRequestId: number;
  title: string;
  previousStatus: string;
  newStatus: string;
};

type InsertSupportCommentNotificationInput = {
  actorUserId: string;
  supportRequestId: number;
  supportOwnerUserId: string;
  commentId: number;
  parentId: number | null;
  actorRole: 'admin' | 'user';
  preview: string;
};

type InsertContractImportNotificationsInput = {
  contractId: number;
  documentNumber: string;
  authorName: string;
  importStatus: 'created' | 'backfill';
};

type InsertUserApprovalRequestAdminNotificationsInput = {
  targetUserId: string;
  googleEmail: string;
  googleDisplayName: string | null;
};

const USER_APPROVAL_REQUEST_ADMIN_TITLE = 'Google 가입 승인 요청';

function buildUserApprovalRequestAdminBody(
  googleEmail: string,
  googleDisplayName: string | null
): string {
  const trimmedName = googleDisplayName?.trim();
  if (trimmedName) {
    return `${googleEmail} · ${trimmedName}`;
  }

  return googleEmail;
}

function buildContractReminderAdminTitle(input: {
  sentCount: number;
  failedCount: number;
  unmatchedCount: number;
  groupsLength: number;
}): string {
  if (input.groupsLength === 0 && input.unmatchedCount > 0) {
    return '독촉 run 완료 (발송 대상 없음)';
  }

  if (input.failedCount === 0 && input.groupsLength > 0) {
    return '독촉 이메일 전송 완료';
  }

  if (input.sentCount > 0 && input.failedCount > 0) {
    return '독촉 이메일 일부 전송 실패';
  }

  if (input.sentCount === 0 && input.groupsLength > 0) {
    return '독촉 이메일 전송 실패';
  }

  return '독촉 run 완료 (발송 대상 없음)';
}

function buildContractReminderAdminBody(input: {
  sentCount: number;
  failedCount: number;
  unmatchedCount: number;
}): string {
  return `발송 성공 ${input.sentCount}건 · 실패 ${input.failedCount}건 · 미매칭 ${input.unmatchedCount}건`;
}

const FAN_OUT_BATCH_SIZE = 500;
const SUPPORT_PREVIEW_MAX_LENGTH = 120;

type InsertAnnouncementPublishedNotificationsInput = {
  announcementId: number;
  title: string;
};

function formatSupportPreview(value: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length <= SUPPORT_PREVIEW_MAX_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, SUPPORT_PREVIEW_MAX_LENGTH)}…`;
}

export async function listActiveUserIds(): Promise<string[]> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('status', 'active');

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => row.user_id as string);
}

export async function insertAnnouncementPublishedNotifications(
  input: InsertAnnouncementPublishedNotificationsInput
): Promise<void> {
  const userIds = await listActiveUserIds();
  if (userIds.length === 0) {
    return;
  }

  const supabase = getServiceRoleClient();
  const title = '새 공지가 등록되었습니다';
  const body = input.title;

  for (let offset = 0; offset < userIds.length; offset += FAN_OUT_BATCH_SIZE) {
    const batch = userIds.slice(offset, offset + FAN_OUT_BATCH_SIZE);
    const rows = batch.map((recipientUserId) => ({
      recipient_user_id: recipientUserId,
      type: 'announcement.published' as const,
      title,
      body,
      metadata: {
        kind: 'announcement.published',
        announcement_id: input.announcementId
      }
    }));

    const { error } = await supabase.from('notifications').insert(rows);
    if (error) {
      throw new Error(error.message);
    }
  }
}

export async function listActiveAdminUserIds(): Promise<string[]> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('system_role', 'admin')
    .eq('status', 'active');

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => row.user_id as string);
}

export async function listMatchedAuthorUserIds(authorName: string): Promise<string[]> {
  const normalizedAuthorName = normalizePersonName(authorName);
  if (!normalizedAuthorName) {
    return [];
  }

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, full_name')
    .eq('system_role', 'user')
    .eq('status', 'active')
    .not('full_name', 'is', null);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .filter((row) => {
      const fullName = row.full_name?.trim();
      return fullName && normalizePersonName(fullName) === normalizedAuthorName;
    })
    .map((row) => row.user_id as string);
}

export async function insertUserApprovalRequestAdminNotifications(
  input: InsertUserApprovalRequestAdminNotificationsInput
): Promise<void> {
  const adminUserIds = await listActiveAdminUserIds();
  if (adminUserIds.length === 0) {
    return;
  }

  const body = buildUserApprovalRequestAdminBody(
    input.googleEmail,
    input.googleDisplayName
  );
  const supabase = getServiceRoleClient();

  for (let offset = 0; offset < adminUserIds.length; offset += FAN_OUT_BATCH_SIZE) {
    const batch = adminUserIds.slice(offset, offset + FAN_OUT_BATCH_SIZE);
    const rows = batch.map((recipientUserId) => ({
      recipient_user_id: recipientUserId,
      type: 'user.approval_request_admin' as const,
      title: USER_APPROVAL_REQUEST_ADMIN_TITLE,
      body,
      metadata: {
        kind: 'user.approval_request_admin',
        target_user_id: input.targetUserId,
        google_email: input.googleEmail,
        google_display_name: input.googleDisplayName
      }
    }));

    const { error } = await supabase.from('notifications').insert(rows);
    if (error) {
      throw new Error(error.message);
    }
  }
}

export async function insertContractImportAdminNotifications(
  input: InsertContractImportNotificationsInput
): Promise<void> {
  const adminUserIds = await listActiveAdminUserIds();
  if (adminUserIds.length === 0) {
    return;
  }

  const title = '계약서가 import되었습니다';
  const body = `문서번호 ${input.documentNumber} · 작성자 ${input.authorName}`;
  const supabase = getServiceRoleClient();

  for (let offset = 0; offset < adminUserIds.length; offset += FAN_OUT_BATCH_SIZE) {
    const batch = adminUserIds.slice(offset, offset + FAN_OUT_BATCH_SIZE);
    const rows = batch.map((recipientUserId) => ({
      recipient_user_id: recipientUserId,
      type: 'contract.import_admin' as const,
      title,
      body,
      metadata: {
        kind: 'contract.import_admin',
        contract_id: input.contractId,
        document_number: input.documentNumber,
        author_name: input.authorName,
        import_status: input.importStatus
      }
    }));

    const { error } = await supabase.from('notifications').insert(rows);
    if (error) {
      throw new Error(error.message);
    }
  }
}

export async function insertContractImportAuthorNotifications(
  input: InsertContractImportNotificationsInput
): Promise<void> {
  const authorUserIds = await listMatchedAuthorUserIds(input.authorName);
  if (authorUserIds.length === 0) {
    return;
  }

  const title = '계약서가 등록되었습니다';
  const body = `문서번호 ${input.documentNumber}가 등록되었습니다. 내 계약서에서 확인하세요.`;
  const supabase = getServiceRoleClient();
  const rows = authorUserIds.map((recipientUserId) => ({
    recipient_user_id: recipientUserId,
    type: 'contract.import_author' as const,
    title,
    body,
    metadata: {
      kind: 'contract.import_author',
      contract_id: input.contractId,
      document_number: input.documentNumber,
      author_name: input.authorName,
      import_status: input.importStatus
    }
  }));

  const { error } = await supabase.from('notifications').insert(rows);
  if (error) {
    throw new Error(error.message);
  }
}

export async function insertUserUpdateNotification(
  input: InsertUserUpdateNotificationInput
): Promise<void> {
  const monitored = filterMonitoredFields(input.changedFields);

  if (monitored.length === 0) {
    return;
  }

  if (input.actorUserId === input.recipientUserId) {
    return;
  }

  const supabase = getServiceRoleClient();
  const { error } = await supabase.from('notifications').insert({
    recipient_user_id: input.recipientUserId,
    type: 'user.update',
    title: USER_UPDATE_NOTIFICATION_TITLE,
    body: formatUserUpdateBody(monitored),
    metadata: {
      changed_fields: monitored,
      kind: 'user.update'
    }
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function insertContractReminderAdminNotifications(
  input: InsertContractReminderAdminNotificationsInput
): Promise<void> {
  const adminUserIds = await listActiveAdminUserIds();
  if (adminUserIds.length === 0) {
    return;
  }

  const title = buildContractReminderAdminTitle(input);
  const body = buildContractReminderAdminBody(input);
  const supabase = getServiceRoleClient();
  const rows = adminUserIds.map((recipientUserId) => ({
    recipient_user_id: recipientUserId,
    type: 'contract.reminder_admin' as const,
    title,
    body,
    metadata: {
      run_id: input.runId,
      run_key: input.runKey,
      trigger_source: input.triggerSource,
      sent_count: input.sentCount,
      failed_count: input.failedCount,
      unmatched_count: input.unmatchedCount,
      run_status: input.runStatus,
      kind: 'contract.reminder_admin'
    }
  }));

  const { error } = await supabase.from('notifications').insert(rows);

  if (error) {
    throw new Error(error.message);
  }
}

export async function insertContractReminderRecipientNotification(
  input: InsertContractReminderRecipientNotificationInput
): Promise<void> {
  const documentCount = input.documentNumbers.length;
  const supabase = getServiceRoleClient();
  const { error } = await supabase.from('notifications').insert({
    recipient_user_id: input.recipientUserId,
    type: 'contract.reminder_recipient',
    title: '계약서 독촉 이메일 안내',
    body: `관리자가 계약서 독촉 이메일을 보냈습니다. 누락 계약서 ${documentCount}건 — 이메일을 확인해 주세요.`,
    metadata: {
      run_id: input.runId,
      author_name: input.authorName,
      document_count: documentCount,
      document_numbers: input.documentNumbers,
      kind: 'contract.reminder_recipient'
    }
  });

  if (error) {
    throw new Error(error.message);
  }
}

function buildWalletBalanceEmailAdminTitle(input: {
  dueCount: number;
  sentCount: number;
  failedCount: number;
}): string {
  if (input.sentCount > 0 && input.failedCount === 0) {
    return '식대 잔액 이메일 전송 완료';
  }

  if (input.sentCount > 0 && input.failedCount > 0) {
    return '식대 잔액 이메일 일부 전송 실패';
  }

  if (input.sentCount === 0 && input.dueCount > 0) {
    return '식대 잔액 이메일 run 완료 (발송 0건)';
  }

  return '식대 잔액 이메일 run 완료 (발송 0건)';
}

function buildWalletBalanceEmailAdminBody(input: {
  dueCount: number;
  sentCount: number;
  failedCount: number;
  blockedCount: number;
  skippedCount: number;
}): string {
  return `대상 ${input.dueCount}명 · 발송 ${input.sentCount} · 실패 ${input.failedCount} · 차단 ${input.blockedCount} · 건너뜀 ${input.skippedCount}`;
}

export async function insertWalletBalanceEmailAdminNotifications(
  input: InsertWalletBalanceEmailAdminNotificationsInput
): Promise<void> {
  const adminUserIds = await listActiveAdminUserIds();
  if (adminUserIds.length === 0) {
    return;
  }

  const title = buildWalletBalanceEmailAdminTitle(input);
  const body = buildWalletBalanceEmailAdminBody(input);
  const supabase = getServiceRoleClient();
  const rows = adminUserIds.map((recipientUserId) => ({
    recipient_user_id: recipientUserId,
    type: 'wallet.balance_email_admin' as const,
    title,
    body,
    metadata: {
      kind: 'wallet.balance_email_admin',
      run_id: input.runId,
      run_key: input.runKey,
      trigger_source: input.triggerSource,
      due_count: input.dueCount,
      sent_count: input.sentCount,
      failed_count: input.failedCount,
      blocked_count: input.blockedCount,
      skipped_count: input.skippedCount,
      run_status: input.runStatus
    }
  }));

  const { error } = await supabase.from('notifications').insert(rows);

  if (error) {
    throw new Error(error.message);
  }
}

export async function insertWalletBalanceEmailNotification(
  input: InsertWalletBalanceEmailNotificationInput
): Promise<number | null> {
  const supabase = getServiceRoleClient();
  const copy = WALLET_BALANCE_EMAIL_SLOT_COPY[input.slot];
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      recipient_user_id: input.recipientUserId,
      type: 'wallet.balance_email',
      title: copy.inAppTitle,
      body: copy.inAppBody,
      metadata: {
        kind: 'wallet.balance_email',
        run_id: input.runId,
        slot: input.slot
      }
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return typeof data?.id === 'number' ? data.id : null;
}

export async function insertWalletSyncNotifications(
  input: InsertWalletSyncNotificationsInput
): Promise<void> {
  if (input.matchedCount <= 0) {
    return;
  }

  const adminUserIds = await listActiveAdminUserIds();
  const adminUserIdSet = new Set(adminUserIds);
  const recipientUserIds = [...new Set(input.matchedUserIds)].filter(
    (userId) => !adminUserIdSet.has(userId)
  );

  if (adminUserIds.length === 0 && recipientUserIds.length === 0) {
    return;
  }

  const adminRows = adminUserIds.map((recipientUserId) => ({
    recipient_user_id: recipientUserId,
    type: 'wallet.sync_admin' as const,
    title: 'KB카드 지갑 동기화 완료',
    body: `사용자 ${input.matchedCount}명 반영 · 미매칭 ${input.unmatchedCount}명`,
    metadata: {
      request_id: input.requestId,
      matched_count: input.matchedCount,
      unmatched_count: input.unmatchedCount,
      kind: 'wallet.sync_admin'
    }
  }));

  const recipientRows = recipientUserIds.map((recipientUserId) => ({
    recipient_user_id: recipientUserId,
    type: 'wallet.sync_recipient' as const,
    title: 'KB카드 지갑이 업데이트되었습니다',
    body: 'KB카드 이용 한도 정보가 갱신되었습니다.',
    metadata: {
      request_id: input.requestId,
      kind: 'wallet.sync_recipient'
    }
  }));

  const supabase = getServiceRoleClient();
  const { error } = await supabase.from('notifications').insert([...adminRows, ...recipientRows]);

  if (error) {
    throw new Error(error.message);
  }
}

export async function insertSupportAdminNotifications(
  input: InsertSupportAdminNotificationsInput
): Promise<void> {
  const adminUserIds = (await listActiveAdminUserIds()).filter(
    (recipientUserId) => recipientUserId !== input.actorUserId
  );

  if (adminUserIds.length === 0) {
    return;
  }

  const notificationTitle =
    input.type === 'support.created' ? '새 CS 문의가 등록되었습니다' : 'CS 문의가 수정되었습니다';
  const body = `${input.title} · ${formatSupportPreview(input.preview)}`;
  const supabase = getServiceRoleClient();

  for (let offset = 0; offset < adminUserIds.length; offset += FAN_OUT_BATCH_SIZE) {
    const batch = adminUserIds.slice(offset, offset + FAN_OUT_BATCH_SIZE);
    const rows = batch.map((recipientUserId) => ({
      recipient_user_id: recipientUserId,
      type: input.type,
      title: notificationTitle,
      body,
      metadata: {
        kind: input.type,
        support_request_id: input.supportRequestId
      }
    }));

    const { error } = await supabase.from('notifications').insert(rows);
    if (error) {
      throw new Error(error.message);
    }
  }
}

export async function insertSupportStatusChangedNotification(
  input: InsertSupportStatusChangedNotificationInput
): Promise<void> {
  if (input.actorUserId === input.recipientUserId) {
    return;
  }

  const supabase = getServiceRoleClient();
  const { error } = await supabase.from('notifications').insert({
    recipient_user_id: input.recipientUserId,
    type: 'support.status_changed',
    title: 'CS 문의 상태가 변경되었습니다',
    body: `${input.title} · ${input.previousStatus} → ${input.newStatus}`,
    metadata: {
      kind: 'support.status_changed',
      support_request_id: input.supportRequestId,
      previous_status: input.previousStatus,
      new_status: input.newStatus
    }
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function insertSupportCommentNotification(
  input: InsertSupportCommentNotificationInput
): Promise<void> {
  const type = input.parentId === null ? 'support.comment_created' : 'support.reply_created';
  const title = input.parentId === null ? 'CS 문의에 새 댓글이 달렸습니다' : 'CS 문의에 새 답글이 달렸습니다';
  const body = formatSupportPreview(input.preview);
  const supabase = getServiceRoleClient();

  if (input.actorRole === 'admin') {
    if (input.actorUserId === input.supportOwnerUserId) {
      return;
    }

    const { error } = await supabase.from('notifications').insert({
      recipient_user_id: input.supportOwnerUserId,
      type,
      title,
      body,
      metadata: {
        kind: type,
        support_request_id: input.supportRequestId,
        comment_id: input.commentId,
        parent_id: input.parentId
      }
    });

    if (error) {
      throw new Error(error.message);
    }
    return;
  }

  const adminUserIds = (await listActiveAdminUserIds()).filter(
    (recipientUserId) => recipientUserId !== input.actorUserId
  );

  if (adminUserIds.length === 0) {
    return;
  }

  const rows = adminUserIds.map((recipientUserId) => ({
    recipient_user_id: recipientUserId,
    type,
    title,
    body,
    metadata: {
      kind: type,
      support_request_id: input.supportRequestId,
      comment_id: input.commentId,
      parent_id: input.parentId
    }
  }));

  const { error } = await supabase.from('notifications').insert(rows);
  if (error) {
    throw new Error(error.message);
  }
}

const BENEFIT_TYPE_LABEL: Record<BenefitType, string> = {
  book: '도서',
  fitness: '체력증진',
  education: '외부교육'
};

type BenefitNotificationAudience = 'operations' | 'applicant';

type InsertBenefitImportNotificationsInput = {
  benefitDocumentId: number;
  documentNumber: string;
  benefitType: BenefitType;
  applicantUserId: string;
  applicantName: string;
};

type InsertBenefitDocumentMutationNotificationsInput = {
  event: 'cancel' | 'restore';
  benefitDocumentId: number;
  documentNumber: string;
  benefitType: BenefitType;
  applicantUserId: string;
  applicantName: string;
  actorUserId: string;
};

export async function listActiveBenefitOperationsUserIds(): Promise<string[]> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, system_role, affiliation, rank')
    .eq('status', 'active');

  if (error) {
    throw new Error(error.message);
  }

  const userIds = new Set<string>();
  for (const row of data ?? []) {
    const userId = row.user_id as string;
    if (row.system_role === 'admin') {
      userIds.add(userId);
      continue;
    }
    if (
      row.system_role === 'user' &&
      row.affiliation === 'wake' &&
      row.rank === '인사팀'
    ) {
      userIds.add(userId);
    }
  }

  return [...userIds];
}

function buildBenefitRecipientMap(
  operationsUserIds: string[],
  applicantUserId: string | null | undefined
): Map<string, BenefitNotificationAudience> {
  const recipients = new Map<string, BenefitNotificationAudience>();
  for (const userId of operationsUserIds) {
    recipients.set(userId, 'operations');
  }
  if (applicantUserId && !recipients.has(applicantUserId)) {
    recipients.set(applicantUserId, 'applicant');
  }
  return recipients;
}

async function getActiveProfileDisplayName(userId: string): Promise<string> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return '알 수 없음';
  }

  return getProfileDisplayName({
    email: String(data.email ?? ''),
    full_name: data.full_name ?? null
  });
}

async function insertBenefitNotificationRows(
  rows: Array<{
    recipient_user_id: string;
    type:
      | 'benefit.import_operations'
      | 'benefit.import_applicant'
      | 'benefit.document_cancel_operations'
      | 'benefit.document_cancel_applicant'
      | 'benefit.document_restore_operations'
      | 'benefit.document_restore_applicant';
    title: string;
    body: string;
    metadata: Record<string, unknown>;
  }>
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const supabase = getServiceRoleClient();
  for (let offset = 0; offset < rows.length; offset += FAN_OUT_BATCH_SIZE) {
    const batch = rows.slice(offset, offset + FAN_OUT_BATCH_SIZE);
    const { error } = await supabase.from('notifications').insert(batch);
    if (error) {
      throw new Error(error.message);
    }
  }
}

function buildBenefitImportCopy(
  audience: BenefitNotificationAudience,
  input: { typeLabel: string; documentNumber: string; applicantName: string }
): { title: string; body: string } {
  const title = `${input.typeLabel} 신청이 등록되었습니다`;
  if (audience === 'operations') {
    return {
      title,
      body: `${input.applicantName}님의 ${input.typeLabel} 신청(문서번호 ${input.documentNumber})이 Gmail/Flex에서 등록되었습니다.`
    };
  }

  return {
    title,
    body: `회원님의 ${input.typeLabel} 신청(문서번호 ${input.documentNumber})이 등록되었습니다.`
  };
}

function buildBenefitCancelCopy(
  audience: BenefitNotificationAudience,
  input: {
    typeLabel: string;
    documentNumber: string;
    applicantName: string;
    actorName: string;
    actorUserId: string;
    applicantUserId: string;
  }
): { title: string; body: string } {
  const title = `${input.typeLabel} 신청이 취소되었습니다`;
  if (audience === 'operations') {
    const body =
      input.actorUserId === input.applicantUserId
        ? `${input.actorName}님이 본인의 ${input.typeLabel} 신청(문서번호 ${input.documentNumber})을 취소했습니다.`
        : `${input.actorName}님이 ${input.applicantName}님의 ${input.typeLabel} 신청(문서번호 ${input.documentNumber})을 취소했습니다.`;
    return { title, body };
  }

  return {
    title,
    body: `회원님의 ${input.typeLabel} 신청(문서번호 ${input.documentNumber})이 취소되었습니다.`
  };
}

function buildBenefitRestoreCopy(
  audience: BenefitNotificationAudience,
  input: {
    typeLabel: string;
    documentNumber: string;
    applicantName: string;
    actorName: string;
    actorUserId: string;
    applicantUserId: string;
  }
): { title: string; body: string } {
  const title = `${input.typeLabel} 신청이 복구되었습니다`;
  if (audience === 'operations') {
    const body =
      input.actorUserId === input.applicantUserId
        ? `${input.actorName}님이 본인의 ${input.typeLabel} 신청(문서번호 ${input.documentNumber})을 복구했습니다.`
        : `${input.actorName}님이 ${input.applicantName}님의 ${input.typeLabel} 신청(문서번호 ${input.documentNumber})을 복구했습니다.`;
    return { title, body };
  }

  return {
    title,
    body: `회원님의 ${input.typeLabel} 신청(문서번호 ${input.documentNumber})이 복구되었습니다.`
  };
}

export async function insertBenefitImportNotifications(
  input: InsertBenefitImportNotificationsInput
): Promise<void> {
  const operationsUserIds = await listActiveBenefitOperationsUserIds();
  const recipients = buildBenefitRecipientMap(operationsUserIds, input.applicantUserId);
  const typeLabel = BENEFIT_TYPE_LABEL[input.benefitType];

  const rows = [...recipients.entries()].map(([recipientUserId, audience]) => {
    const type: 'benefit.import_operations' | 'benefit.import_applicant' =
      audience === 'operations' ? 'benefit.import_operations' : 'benefit.import_applicant';
    const { title, body } = buildBenefitImportCopy(audience, {
      typeLabel,
      documentNumber: input.documentNumber,
      applicantName: input.applicantName
    });

    return {
      recipient_user_id: recipientUserId,
      type,
      title,
      body,
      metadata: {
        kind: type,
        benefit_document_id: input.benefitDocumentId,
        document_number: input.documentNumber,
        benefit_type: input.benefitType,
        applicant_user_id: input.applicantUserId
      }
    };
  });

  await insertBenefitNotificationRows(rows);
}

export async function insertBenefitDocumentCancelNotifications(
  input: Omit<InsertBenefitDocumentMutationNotificationsInput, 'event'>
): Promise<void> {
  const actorName = await getActiveProfileDisplayName(input.actorUserId);
  const operationsUserIds = await listActiveBenefitOperationsUserIds();
  const recipients = buildBenefitRecipientMap(operationsUserIds, input.applicantUserId);
  const typeLabel = BENEFIT_TYPE_LABEL[input.benefitType];

  const rows = [...recipients.entries()].map(([recipientUserId, audience]) => {
    const type: 'benefit.document_cancel_operations' | 'benefit.document_cancel_applicant' =
      audience === 'operations'
        ? 'benefit.document_cancel_operations'
        : 'benefit.document_cancel_applicant';
    const { title, body } = buildBenefitCancelCopy(audience, {
      typeLabel,
      documentNumber: input.documentNumber,
      applicantName: input.applicantName,
      actorName,
      actorUserId: input.actorUserId,
      applicantUserId: input.applicantUserId
    });

    return {
      recipient_user_id: recipientUserId,
      type,
      title,
      body,
      metadata: {
        kind: type,
        benefit_document_id: input.benefitDocumentId,
        document_number: input.documentNumber,
        benefit_type: input.benefitType,
        applicant_user_id: input.applicantUserId,
        actor_user_id: input.actorUserId
      }
    };
  });

  await insertBenefitNotificationRows(rows);
}

export async function insertBenefitDocumentRestoreNotifications(
  input: Omit<InsertBenefitDocumentMutationNotificationsInput, 'event'>
): Promise<void> {
  const actorName = await getActiveProfileDisplayName(input.actorUserId);
  const operationsUserIds = await listActiveBenefitOperationsUserIds();
  const recipients = buildBenefitRecipientMap(operationsUserIds, input.applicantUserId);
  const typeLabel = BENEFIT_TYPE_LABEL[input.benefitType];

  const rows = [...recipients.entries()].map(([recipientUserId, audience]) => {
    const type: 'benefit.document_restore_operations' | 'benefit.document_restore_applicant' =
      audience === 'operations'
        ? 'benefit.document_restore_operations'
        : 'benefit.document_restore_applicant';
    const { title, body } = buildBenefitRestoreCopy(audience, {
      typeLabel,
      documentNumber: input.documentNumber,
      applicantName: input.applicantName,
      actorName,
      actorUserId: input.actorUserId,
      applicantUserId: input.applicantUserId
    });

    return {
      recipient_user_id: recipientUserId,
      type,
      title,
      body,
      metadata: {
        kind: type,
        benefit_document_id: input.benefitDocumentId,
        document_number: input.documentNumber,
        benefit_type: input.benefitType,
        applicant_user_id: input.applicantUserId,
        actor_user_id: input.actorUserId
      }
    };
  });

  await insertBenefitNotificationRows(rows);
}
