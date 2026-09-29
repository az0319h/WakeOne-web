import 'server-only';

import {
  parseWalletBalanceEmailRunKeyTick,
  resolveWalletBalanceEmailMatchedSlot
} from '@/features/wallet/api/balance-email.service.server';
import { getServiceRoleClient } from '@/lib/supabase/service-role';
import type {
  WalletBalanceEmailLogRecipient,
  WalletBalanceEmailLogRun,
  WalletBalanceEmailLogRunDetail,
  WalletBalanceEmailLogsFilters,
  WalletBalanceEmailLogsListResponse
} from './types';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

const RUN_SELECT =
  'id, run_key, request_id, trigger_source, status, due_count, sent_count, failed_count, blocked_count, skipped_count, created_at, finished_at';

const RECIPIENT_SELECT =
  'id, run_id, user_id, recipient_email, status, error_message, notification_id, sent_at, created_at';

type RunRow = WalletBalanceEmailLogRun;

type RecipientRow = WalletBalanceEmailLogRecipient;

function mapRun(row: RunRow): WalletBalanceEmailLogRun {
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

type WalletBalanceEmailPreferencesForSlot = {
  hour: number;
  minute: number;
  slot2_enabled: boolean;
  hour2: number;
  minute2: number;
};

function parseNotificationSlot(metadata: unknown): 1 | 2 | null {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const slot = (metadata as { slot?: unknown }).slot;
  return slot === 1 || slot === 2 ? slot : null;
}

function resolveRecipientSlot(input: {
  notificationId: number | null;
  slotsByNotificationId: Map<number, 1 | 2>;
  preferences: WalletBalanceEmailPreferencesForSlot | null;
  tick: { hour: number; minute: number } | null;
}): 1 | 2 | null {
  if (input.notificationId != null) {
    const slotFromNotification = input.slotsByNotificationId.get(input.notificationId);
    if (slotFromNotification != null) {
      return slotFromNotification;
    }
  }

  if (!input.preferences || !input.tick) {
    return null;
  }

  return resolveWalletBalanceEmailMatchedSlot({
    tickHour: input.tick.hour,
    tickMinute: input.tick.minute,
    hour: input.preferences.hour,
    minute: input.preferences.minute,
    slot2_enabled: input.preferences.slot2_enabled,
    hour2: input.preferences.hour2,
    minute2: input.preferences.minute2
  });
}

function mapRecipient(
  row: RecipientRow,
  recipientFullName: string | null,
  slot: 1 | 2 | null
): WalletBalanceEmailLogRecipient {
  return {
    id: row.id,
    run_id: row.run_id,
    user_id: row.user_id,
    recipient_email: row.recipient_email,
    recipient_full_name: recipientFullName,
    status: row.status,
    error_message: row.error_message,
    notification_id: row.notification_id,
    sent_at: row.sent_at,
    created_at: row.created_at,
    slot
  };
}

async function fetchProfileNamesByUserIds(
  supabase: ReturnType<typeof getServiceRoleClient>,
  userIds: string[]
): Promise<Map<string, string | null>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, full_name')
    .in('user_id', userIds);

  if (error) {
    throw new Error(error.message);
  }

  const names = new Map<string, string | null>();
  for (const row of data ?? []) {
    const userId = row.user_id as string;
    const fullName = (row.full_name as string | null)?.trim() ?? null;
    names.set(userId, fullName || null);
  }

  return names;
}

async function fetchNotificationSlotsByIds(
  supabase: ReturnType<typeof getServiceRoleClient>,
  notificationIds: number[]
): Promise<Map<number, 1 | 2>> {
  if (notificationIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('notifications')
    .select('id, metadata')
    .in('id', notificationIds);

  if (error) {
    throw new Error(error.message);
  }

  const slots = new Map<number, 1 | 2>();
  for (const row of data ?? []) {
    const id = row.id as number;
    const slot = parseNotificationSlot(row.metadata);
    if (slot != null) {
      slots.set(id, slot);
    }
  }

  return slots;
}

async function fetchPreferencesByUserIds(
  supabase: ReturnType<typeof getServiceRoleClient>,
  userIds: string[]
): Promise<Map<string, WalletBalanceEmailPreferencesForSlot>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('wallet_balance_email_preferences')
    .select('user_id, hour, minute, slot2_enabled, hour2, minute2')
    .in('user_id', userIds);

  if (error) {
    throw new Error(error.message);
  }

  const preferences = new Map<string, WalletBalanceEmailPreferencesForSlot>();
  for (const row of data ?? []) {
    preferences.set(row.user_id as string, {
      hour: Number(row.hour),
      minute: Number(row.minute),
      slot2_enabled: Boolean(row.slot2_enabled),
      hour2: Number(row.hour2),
      minute2: Number(row.minute2)
    });
  }

  return preferences;
}

function escapeIlikePattern(value: string): string {
  return value.replaceAll(',', ' ').trim();
}

async function findRunIdsMatchingRecipientSearch(
  supabase: ReturnType<typeof getServiceRoleClient>,
  search: string
): Promise<number[]> {
  const escaped = escapeIlikePattern(search);
  if (!escaped) {
    return [];
  }

  const { data, error } = await supabase
    .from('wallet_balance_email_recipients')
    .select('run_id')
    .or(`recipient_email.ilike.%${escaped}%`);

  if (error) {
    throw new Error(error.message);
  }

  const runIds = new Set<number>();
  for (const row of data ?? []) {
    const runId = (row as { run_id: number }).run_id;
    if (typeof runId === 'number') {
      runIds.add(runId);
    }
  }

  return [...runIds];
}

function parseSort(sortRaw: string | undefined): { column: string; desc: boolean } {
  let column = 'created_at';
  let desc = true;

  if (!sortRaw) {
    return { column, desc };
  }

  try {
    const sortItems = JSON.parse(sortRaw) as Array<{ id: string; desc: boolean }>;
    if (sortItems.length > 0) {
      const candidate = sortItems[0];
      const allowedColumns = [
        'created_at',
        'status',
        'due_count',
        'sent_count',
        'failed_count',
        'blocked_count',
        'skipped_count'
      ];
      if (allowedColumns.includes(candidate.id)) {
        column = candidate.id;
        desc = candidate.desc;
      }
    }
  } catch {
    // ignore invalid sort payload
  }

  return { column, desc };
}

export async function listWalletBalanceEmailLogRuns(
  filters: WalletBalanceEmailLogsFilters = {}
): Promise<WalletBalanceEmailLogsListResponse> {
  const page = Math.max(filters.page ?? DEFAULT_PAGE, 1);
  const limit = Math.min(Math.max(filters.limit ?? DEFAULT_LIMIT, 1), 100);
  const { column, desc } = parseSort(filters.sort);
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const search = filters.search?.trim();

  const supabase = getServiceRoleClient();
  let query = supabase.from('wallet_balance_email_runs').select(RUN_SELECT, { count: 'exact' });

  if (search) {
    const escaped = escapeIlikePattern(search);
    if (escaped) {
      const recipientRunIds = await findRunIdsMatchingRecipientSearch(supabase, escaped);
      if (recipientRunIds.length > 0) {
        query = query.or(`run_key.ilike.%${escaped}%,id.in.(${recipientRunIds.join(',')})`);
      } else {
        query = query.ilike('run_key', `%${escaped}%`);
      }
    }
  }

  const { data, error, count } = await query.order(column, { ascending: !desc }).range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  return {
    items: ((data ?? []) as unknown as RunRow[]).map(mapRun),
    total: count ?? 0,
    page,
    limit
  };
}

export async function getWalletBalanceEmailLogRunDetail(
  runId: number
): Promise<WalletBalanceEmailLogRunDetail | null> {
  const supabase = getServiceRoleClient();
  const { data: runData, error: runError } = await supabase
    .from('wallet_balance_email_runs')
    .select(RUN_SELECT)
    .eq('id', runId)
    .maybeSingle();

  if (runError) {
    throw new Error(runError.message);
  }

  if (!runData) {
    return null;
  }

  const { data: recipientData, error: recipientError } = await supabase
    .from('wallet_balance_email_recipients')
    .select(RECIPIENT_SELECT)
    .eq('run_id', runId)
    .order('created_at', { ascending: true });

  if (recipientError) {
    throw new Error(recipientError.message);
  }

  const run = mapRun(runData as unknown as RunRow);
  const recipientRows = (recipientData ?? []) as unknown as RecipientRow[];
  const userIds = [...new Set(recipientRows.map((row) => row.user_id))];
  const notificationIds = recipientRows
    .map((row) => row.notification_id)
    .filter((id): id is number => id != null);
  const [profileNames, slotsByNotificationId, preferencesByUserId] = await Promise.all([
    fetchProfileNamesByUserIds(supabase, userIds),
    fetchNotificationSlotsByIds(supabase, notificationIds),
    fetchPreferencesByUserIds(supabase, userIds)
  ]);
  const tick = parseWalletBalanceEmailRunKeyTick(run.run_key);

  return {
    ...run,
    recipients: recipientRows.map((row) =>
      mapRecipient(
        row,
        profileNames.get(row.user_id) ?? null,
        resolveRecipientSlot({
          notificationId: row.notification_id,
          slotsByNotificationId,
          preferences: preferencesByUserId.get(row.user_id) ?? null,
          tick
        })
      )
    )
  };
}
