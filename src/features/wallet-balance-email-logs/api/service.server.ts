import 'server-only';

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

function mapRecipient(row: RecipientRow): WalletBalanceEmailLogRecipient {
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

  return {
    ...mapRun(runData as unknown as RunRow),
    recipients: ((recipientData ?? []) as unknown as RecipientRow[]).map(mapRecipient)
  };
}
