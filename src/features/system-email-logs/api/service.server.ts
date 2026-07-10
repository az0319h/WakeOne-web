import 'server-only';

import { getServiceRoleClient } from '@/lib/supabase/service-role';
import type { ContractReminderUnmatchedTarget } from '@/features/contracts/api/types';
import type {
  SystemEmailLogRecipient,
  SystemEmailLogRun,
  SystemEmailLogRunDetail,
  SystemEmailLogsFilters,
  SystemEmailLogsListResponse
} from './types';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

const REMINDER_RUN_SELECT =
  'id, run_key, request_id, trigger_source, status, target_count, sent_count, failed_count, unmatched_targets, created_at, finished_at';

const RECIPIENT_SELECT =
  'id, recipient_email, author_name, contract_ids, document_numbers, status, error_message, sent_at, created_at';

type ReminderRunRow = {
  id: number;
  run_key: string;
  request_id: string;
  trigger_source: 'admin' | 'cron';
  status: 'completed' | 'partial_failed' | 'failed';
  target_count: number;
  sent_count: number;
  failed_count: number;
  unmatched_targets: ContractReminderUnmatchedTarget[] | null;
  created_at: string;
  finished_at: string | null;
};

type ReminderRecipientRow = {
  id: number;
  recipient_email: string;
  author_name: string;
  contract_ids: number[];
  document_numbers: string[];
  status: 'sent' | 'failed';
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
};

function parseUnmatchedTargets(value: unknown): ContractReminderUnmatchedTarget[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }

    const record = item as Record<string, unknown>;
    const authorName = typeof record.author_name === 'string' ? record.author_name : '';
    const reason = record.reason === 'no_profile_match' ? 'no_profile_match' : null;
    const contractIds = Array.isArray(record.contract_ids)
      ? record.contract_ids.filter((id): id is number => typeof id === 'number')
      : [];
    const documentNumbers = Array.isArray(record.document_numbers)
      ? record.document_numbers.filter((value): value is string => typeof value === 'string')
      : [];

    if (!authorName || !reason) {
      return [];
    }

    return [
      {
        author_name: authorName,
        contract_ids: contractIds,
        document_numbers: documentNumbers,
        reason
      }
    ];
  });
}

function countUnmatchedContracts(targets: ContractReminderUnmatchedTarget[]): number {
  return targets.reduce((total, target) => total + target.contract_ids.length, 0);
}

function mapRun(row: ReminderRunRow): SystemEmailLogRun {
  const unmatchedTargets = parseUnmatchedTargets(row.unmatched_targets);
  return {
    id: row.id,
    run_key: row.run_key,
    request_id: row.request_id,
    trigger_source: row.trigger_source,
    status: row.status,
    target_count: row.target_count,
    sent_count: row.sent_count,
    failed_count: row.failed_count,
    unmatched_count: countUnmatchedContracts(unmatchedTargets),
    created_at: row.created_at,
    finished_at: row.finished_at
  };
}

function mapRecipient(row: ReminderRecipientRow): SystemEmailLogRecipient {
  return {
    id: row.id,
    recipient_email: row.recipient_email,
    author_name: row.author_name,
    contract_ids: row.contract_ids,
    document_numbers: row.document_numbers,
    status: row.status,
    error_message: row.error_message,
    sent_at: row.sent_at,
    created_at: row.created_at
  };
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
      const allowedColumns = ['created_at', 'status', 'target_count', 'sent_count', 'failed_count'];
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

export async function listSystemEmailLogRuns(
  filters: SystemEmailLogsFilters = {}
): Promise<SystemEmailLogsListResponse> {
  const page = Math.max(filters.page ?? DEFAULT_PAGE, 1);
  const limit = Math.min(Math.max(filters.limit ?? DEFAULT_LIMIT, 1), 100);
  const { column, desc } = parseSort(filters.sort);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const supabase = getServiceRoleClient();
  const { data, error, count } = await supabase
    .from('contract_reminder_runs')
    .select(REMINDER_RUN_SELECT, { count: 'exact' })
    .order(column, { ascending: !desc })
    .range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  return {
    items: ((data ?? []) as unknown as ReminderRunRow[]).map(mapRun),
    total: count ?? 0,
    page,
    limit
  };
}

export async function getSystemEmailLogRunDetail(runId: number): Promise<SystemEmailLogRunDetail | null> {
  const supabase = getServiceRoleClient();
  const { data: runData, error: runError } = await supabase
    .from('contract_reminder_runs')
    .select(REMINDER_RUN_SELECT)
    .eq('id', runId)
    .maybeSingle();

  if (runError) {
    throw new Error(runError.message);
  }

  if (!runData) {
    return null;
  }

  const runRow = runData as unknown as ReminderRunRow;
  const unmatchedTargets = parseUnmatchedTargets(runRow.unmatched_targets);

  const { data: recipientData, error: recipientError } = await supabase
    .from('contract_reminder_recipients')
    .select(RECIPIENT_SELECT)
    .eq('run_id', runId)
    .order('created_at', { ascending: true });

  if (recipientError) {
    throw new Error(recipientError.message);
  }

  return {
    ...mapRun(runRow),
    unmatched_targets: unmatchedTargets,
    recipients: ((recipientData ?? []) as unknown as ReminderRecipientRow[]).map(mapRecipient)
  };
}
