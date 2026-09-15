export type WalletBalanceEmailPreferencesFilters = {
  /** 'self' | userId. 비-admin 은 항상 self 로 강제. */
  user?: string;
};

export type WalletBalanceEmailPreferencesResponse = {
  preferences: WalletBalanceEmailPreferences;
  eligible: true;
};

export type UpdateWalletBalanceEmailPreferencesInput = {
  user?: string;
  patch: WalletBalanceEmailPreferencesPatch;
};

export type WalletBalanceEmailPreferences = {
  user_id: string;
  enabled: boolean;
  hour: number;
  minute: number;
  exclude_weekends: boolean;
  updated_at: string | null;
  updated_by_user_id: string | null;
};

export type WalletBalanceEmailPreferencesPatch = {
  enabled?: boolean;
  hour?: number;
  minute?: number;
  exclude_weekends?: boolean;
};

export type WalletBalanceEmailRunStatus = 'completed' | 'partial_failed' | 'failed';

export type WalletBalanceEmailRecipientStatus = 'sent' | 'failed' | 'blocked' | 'skipped';

export type WalletBalanceEmailRun = {
  id: number;
  run_key: string;
  request_id: string;
  trigger_source: 'cron' | 'admin';
  status: WalletBalanceEmailRunStatus;
  due_count: number;
  sent_count: number;
  failed_count: number;
  blocked_count: number;
  skipped_count: number;
  created_at: string;
  finished_at: string | null;
};

export type WalletBalanceEmailRecipient = {
  id: number;
  run_id: number;
  user_id: string;
  recipient_email: string;
  status: WalletBalanceEmailRecipientStatus;
  error_message: string | null;
  notification_id: number | null;
  sent_at: string | null;
  created_at: string;
};

export type WalletBalanceEmailDueUser = {
  user_id: string;
  email: string;
  hour: number;
  minute: number;
  exclude_weekends: boolean;
  monthly_limit: number;
  monthly_remaining: number;
  synced_at: string;
};

export const WALLET_BALANCE_EMAIL_DEFAULTS = {
  enabled: false,
  hour: 12,
  minute: 15,
  exclude_weekends: false
} as const;
