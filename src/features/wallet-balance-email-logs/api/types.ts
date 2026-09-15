import type {
  WalletBalanceEmailRecipient,
  WalletBalanceEmailRun
} from '@/features/wallet/api/balance-email.types';

export type WalletBalanceEmailLogsFilters = {
  page?: number;
  limit?: number;
  sort?: string;
  search?: string;
};

export type WalletBalanceEmailLogRun = WalletBalanceEmailRun;

export type WalletBalanceEmailLogRecipient = WalletBalanceEmailRecipient & {
  recipient_full_name: string | null;
};

export type WalletBalanceEmailLogRunDetail = WalletBalanceEmailLogRun & {
  recipients: WalletBalanceEmailLogRecipient[];
};

export type WalletBalanceEmailLogsListResponse = {
  items: WalletBalanceEmailLogRun[];
  total: number;
  page: number;
  limit: number;
};

export type WalletBalanceEmailLogDetailResponse = {
  run: WalletBalanceEmailLogRunDetail;
};
