import 'server-only';

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

type InsertAnnouncementPublishedNotificationsInput = {
  announcementId: number;
  title: string;
};

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
