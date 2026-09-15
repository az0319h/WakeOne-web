import 'server-only';

import { getServiceRoleClient } from '@/lib/supabase/service-role';
import type { WalletLimitSnapshot } from './types';
import {
  WALLET_BALANCE_EMAIL_DEFAULTS,
  type WalletBalanceEmailDueUser,
  type WalletBalanceEmailPreferences,
  type WalletBalanceEmailPreferencesPatch,
  type WalletBalanceEmailRecipient,
  type WalletBalanceEmailRecipientStatus,
  type WalletBalanceEmailRun
} from './balance-email.types';

const PREFERENCES_SELECT =
  'user_id, enabled, hour, minute, exclude_weekends, updated_at, updated_by_user_id';

const RUN_SELECT =
  'id, run_key, request_id, trigger_source, status, due_count, sent_count, failed_count, blocked_count, skipped_count, created_at, finished_at';

const RECIPIENT_SELECT =
  'id, run_id, user_id, recipient_email, status, error_message, notification_id, sent_at, created_at';

type PreferencesRow = WalletBalanceEmailPreferences;

type RunRow = WalletBalanceEmailRun;

type RecipientRow = WalletBalanceEmailRecipient;

function mapPreferences(row: PreferencesRow): WalletBalanceEmailPreferences {
  return {
    user_id: row.user_id,
    enabled: row.enabled,
    hour: Number(row.hour),
    minute: Number(row.minute),
    exclude_weekends: row.exclude_weekends,
    updated_at: row.updated_at,
    updated_by_user_id: row.updated_by_user_id
  };
}

function mapRun(row: RunRow): WalletBalanceEmailRun {
  return {
    id: row.id,
    run_key: row.run_key,
    request_id: row.request_id,
    trigger_source: row.trigger_source,
    status: row.status,
    due_count: row.due_count,
    sent_count: row.sent_count,
    failed_count: row.failed_count,
    blocked_count: row.blocked_count,
    skipped_count: row.skipped_count,
    created_at: row.created_at,
    finished_at: row.finished_at
  };
}

function mapRecipient(row: RecipientRow): WalletBalanceEmailRecipient {
  return {
    id: row.id,
    run_id: row.run_id,
    user_id: row.user_id,
    recipient_email: row.recipient_email,
    status: row.status,
    error_message: row.error_message,
    notification_id: row.notification_id,
    sent_at: row.sent_at,
    created_at: row.created_at
  };
}

export function getKstDateParts(date = new Date()): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
} {
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstDate = new Date(date.getTime() + kstOffset);

  return {
    year: kstDate.getUTCFullYear(),
    month: kstDate.getUTCMonth() + 1,
    day: kstDate.getUTCDate(),
    hour: kstDate.getUTCHours(),
    minute: kstDate.getUTCMinutes(),
    weekday: kstDate.getUTCDay()
  };
}

export function buildWalletBalanceEmailRunKey(parts = getKstDateParts()): string {
  const month = String(parts.month).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  const hour = String(parts.hour).padStart(2, '0');
  const minute = String(parts.minute).padStart(2, '0');
  return `${parts.year}-${month}-${day}T${hour}:${minute}+09:00`;
}

export function isKstWeekend(weekday: number): boolean {
  return weekday === 0 || weekday === 6;
}

export async function isWalletBalanceEmailEligible(userId: string): Promise<boolean> {
  const supabase = getServiceRoleClient();
  const { count, error } = await supabase
    .from('wallet_syncs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'matched');

  if (error) {
    throw new Error(error.message);
  }

  return (count ?? 0) > 0;
}

export async function getWalletBalanceEmailPreferences(
  userId: string
): Promise<WalletBalanceEmailPreferences> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('wallet_balance_email_preferences')
    .select(PREFERENCES_SELECT)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return {
      user_id: userId,
      ...WALLET_BALANCE_EMAIL_DEFAULTS,
      updated_at: null,
      updated_by_user_id: null
    };
  }

  return mapPreferences(data as unknown as PreferencesRow);
}

export async function upsertWalletBalanceEmailPreferences(input: {
  userId: string;
  patch: WalletBalanceEmailPreferencesPatch;
  updatedByUserId: string;
}): Promise<WalletBalanceEmailPreferences> {
  const supabase = getServiceRoleClient();
  const existing = await getWalletBalanceEmailPreferences(input.userId);

  const next = {
    user_id: input.userId,
    enabled: input.patch.enabled ?? existing.enabled,
    hour: input.patch.hour ?? existing.hour,
    minute: input.patch.minute ?? existing.minute,
    exclude_weekends: input.patch.exclude_weekends ?? existing.exclude_weekends,
    updated_at: new Date().toISOString(),
    updated_by_user_id: input.updatedByUserId
  };

  const { data, error } = await supabase
    .from('wallet_balance_email_preferences')
    .upsert(next, { onConflict: 'user_id' })
    .select(PREFERENCES_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapPreferences(data as unknown as PreferencesRow);
}

export async function getLatestWalletSnapshotForUser(
  userId: string
): Promise<WalletLimitSnapshot | null> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('wallet_syncs')
    .select('matched_name, monthly_limit, monthly_remaining, source, synced_at')
    .eq('user_id', userId)
    .eq('status', 'matched')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return {
    monthly_limit: Number(data.monthly_limit),
    monthly_remaining: Number(data.monthly_remaining),
    matched_name: data.matched_name as string,
    source: data.source as string,
    synced_at: data.synced_at as string
  };
}

export async function listDueWalletBalanceEmailUsers(
  hour: number,
  minute: number
): Promise<WalletBalanceEmailDueUser[]> {
  const supabase = getServiceRoleClient();

  const { data: preferences, error: prefError } = await supabase
    .from('wallet_balance_email_preferences')
    .select('user_id, hour, minute, exclude_weekends')
    .eq('enabled', true)
    .eq('hour', hour)
    .eq('minute', minute);

  if (prefError) {
    throw new Error(prefError.message);
  }

  if (!preferences?.length) {
    return [];
  }

  const dueUsers: WalletBalanceEmailDueUser[] = [];

  for (const pref of preferences) {
    const userId = pref.user_id as string;
    const eligible = await isWalletBalanceEmailEligible(userId);
    if (!eligible) {
      continue;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    if (profileError) {
      throw new Error(profileError.message);
    }

    const email = profile?.email?.trim();
    if (!email) {
      continue;
    }

    const snapshot = await getLatestWalletSnapshotForUser(userId);
    if (!snapshot) {
      continue;
    }

    dueUsers.push({
      user_id: userId,
      email,
      hour: Number(pref.hour),
      minute: Number(pref.minute),
      exclude_weekends: Boolean(pref.exclude_weekends),
      monthly_limit: snapshot.monthly_limit,
      monthly_remaining: snapshot.monthly_remaining,
      synced_at: snapshot.synced_at
    });
  }

  return dueUsers;
}

export async function getWalletBalanceEmailRunByKey(runKey: string): Promise<WalletBalanceEmailRun | null> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('wallet_balance_email_runs')
    .select(RUN_SELECT)
    .eq('run_key', runKey)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapRun(data as unknown as RunRow) : null;
}

export async function createWalletBalanceEmailRun(input: {
  requestId: string;
  runKey: string;
  triggerSource: 'cron' | 'admin';
  dueCount: number;
}): Promise<WalletBalanceEmailRun> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('wallet_balance_email_runs')
    .insert({
      request_id: input.requestId,
      run_key: input.runKey,
      trigger_source: input.triggerSource,
      due_count: input.dueCount,
      status: 'failed'
    })
    .select(RUN_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapRun(data as unknown as RunRow);
}

export async function finishWalletBalanceEmailRun(input: {
  runId: number;
  status: WalletBalanceEmailRun['status'];
  sentCount: number;
  failedCount: number;
  blockedCount: number;
  skippedCount: number;
}): Promise<WalletBalanceEmailRun> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('wallet_balance_email_runs')
    .update({
      status: input.status,
      sent_count: input.sentCount,
      failed_count: input.failedCount,
      blocked_count: input.blockedCount,
      skipped_count: input.skippedCount,
      finished_at: new Date().toISOString()
    })
    .eq('id', input.runId)
    .select(RUN_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapRun(data as unknown as RunRow);
}

export async function recordWalletBalanceEmailRecipient(input: {
  runId: number;
  userId: string;
  recipientEmail: string;
  status: WalletBalanceEmailRecipientStatus;
  errorMessage?: string | null;
  notificationId?: number | null;
}): Promise<WalletBalanceEmailRecipient> {
  const supabase = getServiceRoleClient();
  const sentAt = input.status === 'sent' ? new Date().toISOString() : null;

  const { data, error } = await supabase
    .from('wallet_balance_email_recipients')
    .insert({
      run_id: input.runId,
      user_id: input.userId,
      recipient_email: input.recipientEmail,
      status: input.status,
      error_message: input.errorMessage ?? null,
      notification_id: input.notificationId ?? null,
      sent_at: sentAt
    })
    .select(RECIPIENT_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapRecipient(data as unknown as RecipientRow);
}

export async function listWalletBalanceEmailRecipientsByRunId(
  runId: number
): Promise<WalletBalanceEmailRecipient[]> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('wallet_balance_email_recipients')
    .select(RECIPIENT_SELECT)
    .eq('run_id', runId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as RecipientRow[]).map(mapRecipient);
}
