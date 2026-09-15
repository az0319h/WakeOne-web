import 'server-only';

export type WalletBalanceEmailMode = 'allowlist' | 'production';

export type WalletBalanceEmailSendDecision = 'send' | 'blocked' | 'dry_run';

const DEFAULT_ALLOWLIST = 'shhong@wakecorp.com';

export function getWalletBalanceEmailMode(): WalletBalanceEmailMode {
  const mode = process.env.WALLET_BALANCE_EMAIL_MODE?.trim().toLowerCase();
  return mode === 'production' ? 'production' : 'allowlist';
}

export function resolveAllowlist(): Set<string> {
  const raw = process.env.WALLET_BALANCE_EMAIL_ALLOWLIST?.trim() || DEFAULT_ALLOWLIST;
  return new Set(
    raw
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isDryRun(): boolean {
  return process.env.E2E_WALLET_BALANCE_EMAIL_DRY_RUN === '1';
}

export function shouldSendToEmail(email: string): WalletBalanceEmailSendDecision {
  if (isDryRun()) {
    return 'dry_run';
  }

  if (getWalletBalanceEmailMode() === 'production') {
    return 'send';
  }

  const normalized = email.trim().toLowerCase();
  return resolveAllowlist().has(normalized) ? 'send' : 'blocked';
}
