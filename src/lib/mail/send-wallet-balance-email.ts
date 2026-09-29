import type { WalletBalanceEmailSlot } from '@/features/wallet/constants/wallet-balance-email-slot-copy';
import { isDryRun } from '@/features/wallet/api/balance-email-mail.server';
import { buildWalletBalanceEmailContent } from '@/lib/mail/wallet-balance-email-content';
import { getDefaultMailFrom, getMailTransporter } from './smtp';

type SendWalletBalanceEmailParams = {
  slot: WalletBalanceEmailSlot;
  to: string;
  monthlyLimit: number;
  monthlyRemaining: number;
  syncedAt: string;
  walletUrl: string;
  settingsUrl: string;
};

function shouldSimulateSmtpFailure(email: string): boolean {
  return email.trim().toLowerCase().startsWith('e2e-smtp-fail-');
}

export async function sendWalletBalanceEmail({
  slot,
  to,
  monthlyLimit,
  monthlyRemaining,
  syncedAt,
  walletUrl,
  settingsUrl
}: SendWalletBalanceEmailParams): Promise<void> {
  if (shouldSimulateSmtpFailure(to)) {
    throw new Error('E2E simulated SMTP failure');
  }

  if (isDryRun()) {
    return;
  }

  const transporter = getMailTransporter();
  const from = getDefaultMailFrom();
  const { subject, text, html } = buildWalletBalanceEmailContent({
    slot,
    monthlyLimit,
    monthlyRemaining,
    syncedAt,
    walletUrl,
    settingsUrl
  });

  await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html
  });
}
