import { formatWalletAmount } from '@/features/wallet/utils/format';
import { isDryRun } from '@/features/wallet/api/balance-email-mail.server';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import { getDefaultMailFrom, getMailTransporter } from './smtp';

type SendWalletBalanceEmailParams = {
  to: string;
  monthlyLimit: number;
  monthlyRemaining: number;
  syncedAt: string;
  walletUrl: string;
  settingsUrl: string;
};

function buildWalletBalanceSyncDisclaimer(syncedAt: string): {
  line1: string;
  line2: string;
} {
  const syncedAtLabel = formatAbsoluteDateTimeKo(syncedAt);

  return {
    line1: `${syncedAtLabel}에 잔액이 반영되었습니다.`,
    line2: '이후 사용한 금액은 아직 반영되지 않았을 수 있습니다.'
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function shouldSimulateSmtpFailure(email: string): boolean {
  return email.trim().toLowerCase().startsWith('e2e-smtp-fail-');
}

export async function sendWalletBalanceEmail({
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
  const subject = '[WakeOne] 식대 잔액 안내';
  const limitLabel = formatWalletAmount(monthlyLimit);
  const remainingLabel = formatWalletAmount(monthlyRemaining);
  const disclaimer = buildWalletBalanceSyncDisclaimer(syncedAt);

  const text = [
    '오늘의 식대 잔액 안내입니다.',
    '',
    `이번 달 지급액: ${limitLabel}`,
    `남은 식대: ${remainingLabel}`,
    '',
    disclaimer.line1,
    disclaimer.line2,
    '',
    `식대 카드 보기: ${walletUrl}`,
    `알림 설정 변경: ${settingsUrl}`,
    '',
    '알림 설정은 식대 카드 페이지에서 변경할 수 있습니다.'
  ].join('\n');

  const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f5f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;">

          <!-- 헤더 -->
          <tr>
            <td style="padding:24px 24px 0;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="width:28px;height:28px;background:#000;border-radius:7px;text-align:center;vertical-align:middle;">
                    <span style="color:#fff;font-size:13px;font-weight:500;line-height:28px;">W</span>
                  </td>
                  <td style="padding-left:8px;font-size:14px;font-weight:500;color:#111;vertical-align:middle;">
                    WakeOne
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 타이틀 -->
          <tr>
            <td style="padding:20px 24px 0;">
              <p style="margin:0 0 6px;font-size:20px;font-weight:500;color:#111;letter-spacing:-0.02em;">
                식대 잔액 안내
              </p>
              <p style="margin:0 0 20px;font-size:13px;color:#666;line-height:1.6;">
                오늘의 식대 잔액을 안내드립니다.
              </p>
            </td>
          </tr>

          <!-- 이번 달 지급액 카드 -->
          <tr>
            <td style="padding:0 24px 8px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f9f9;border-radius:8px;">
                <tr>
                  <td style="padding:14px 16px;">
                    <p style="margin:0 0 3px;font-size:11px;color:#aaa;">이번 달 지급액</p>
                    <p style="margin:0;font-size:14px;font-weight:500;color:#111;">${escapeHtml(limitLabel)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 남은 식대 카드 -->
          <tr>
            <td style="padding:0 24px 16px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f9f9;border-radius:8px;">
                <tr>
                  <td style="padding:14px 16px;">
                    <p style="margin:0 0 3px;font-size:11px;color:#aaa;">남은 식대</p>
                    <p style="margin:0;font-size:14px;font-weight:500;color:#111;">${escapeHtml(remainingLabel)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 잔액 반영 시각 안내 -->
          <tr>
            <td style="padding:0 24px 16px;">
              <p style="margin:0 0 4px;font-size:12px;color:#888;line-height:1.6;">
                ${escapeHtml(disclaimer.line1)}
              </p>
              <p style="margin:0;font-size:12px;color:#888;line-height:1.6;">
                ${escapeHtml(disclaimer.line2)}
              </p>
            </td>
          </tr>

          <!-- CTA: 식대 카드 보기 -->
          <tr>
            <td style="padding:0 24px 8px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="background:#000;border-radius:8px;">
                    <a href="${escapeHtml(walletUrl)}"
                       style="display:block;padding:13px;color:#fff;text-decoration:none;font-size:14px;font-weight:500;text-align:center;">
                      식대 카드 보기 →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA: 알림 설정 변경 -->
          <tr>
            <td style="padding:0 24px 14px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="background:#fff;border:1px solid #e5e5e5;border-radius:8px;">
                    <a href="${escapeHtml(settingsUrl)}"
                       style="display:block;padding:13px;color:#111;text-decoration:none;font-size:14px;font-weight:500;text-align:center;">
                      알림 설정 변경
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 푸터 -->
          <tr>
            <td style="padding:0 24px 24px;">
              <p style="margin:0;font-size:11px;color:#aaa;text-align:center;line-height:1.6;">
                알림 설정은 식대 카드 페이지에서 변경할 수 있습니다.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html
  });
}
