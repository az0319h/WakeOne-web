import type { ContractReminderRecipientGroup } from '@/features/contracts/api/types';
import { getDefaultMailFrom, getMailTransporter } from './smtp';

type SendContractReminderEmailParams = {
  group: ContractReminderRecipientGroup;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatContractDateLine(contract: ContractReminderRecipientGroup['contracts'][number]): string {
  const approvedPart = contract.approved_at ? ` / 문서승인일: ${contract.approved_at}` : '';
  return `${contract.document_number} / ${contract.contract_target} / 문서생성일: ${contract.document_created_at}${approvedPart}`;
}

function formatContractTextLine(contract: ContractReminderRecipientGroup['contracts'][number]): string {
  const base = formatContractDateLine(contract);
  if (contract.source_document_url?.trim()) {
    return `- ${base} (${contract.source_document_url.trim()})`;
  }

  return `- ${base}`;
}

function formatContractHtmlCard(contract: ContractReminderRecipientGroup['contracts'][number]): string {
  const documentNumber = escapeHtml(contract.document_number);
  const documentLabel = contract.source_document_url?.trim()
    ? `<a href="${escapeHtml(contract.source_document_url.trim())}" target="_blank" rel="noopener noreferrer" style="color:#111;text-decoration:underline;">${documentNumber}</a>`
    : documentNumber;

  const metaParts = [escapeHtml(contract.contract_target), `생성 ${escapeHtml(contract.document_created_at)}`];
  if (contract.approved_at) {
    metaParts.push(`승인 ${escapeHtml(contract.approved_at)}`);
  }
  const meta = metaParts.join(' · ');

  return `
                <tr>
                  <td style="padding:0 0 8px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f9f9;border-radius:8px;">
                      <tr>
                        <td style="padding:14px 16px;">
                          <p style="margin:0 0 2px;font-size:14px;font-weight:500;color:#111;">${documentLabel}</p>
                          <p style="margin:0;font-size:12px;color:#888;">${meta}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`;
}

function shouldSimulateSmtpFailure(authorName: string): boolean {
  return authorName.trim().startsWith('E2E-SMTP-FAIL-');
}

function isReminderDryRun(): boolean {
  return process.env.E2E_REMINDER_DRY_RUN === '1';
}

export async function sendContractReminderEmail({ group }: SendContractReminderEmailParams): Promise<void> {
  if (shouldSimulateSmtpFailure(group.author_name)) {
    throw new Error('E2E simulated SMTP failure');
  }

  if (isReminderDryRun()) {
    return;
  }

  const transporter = getMailTransporter();
  const from = getDefaultMailFrom();

  const subject = `[웨이크 총무팀] 계약서 누락 안내 (${group.document_numbers.length}건)`;
  const text = [
    `${group.author_name}님,`,
    '',
    '아래 계약서 체결 요청 문서의 계약서를 전달해 주시지 않아서 전달 요청드립니다.',
    '',
    ...group.contracts.map(formatContractTextLine),
    '',
    '계약서를 보유하고 계시다면 Slack DM으로만 전달해 주시면 됩니다.',
    '추가로 실물 계약서를 가지고 계신다면, 추후 실물 계약서도 전달해 주시면 감사하겠습니다.'
  ].join('\n');

  const contractCards = group.contracts.map(formatContractHtmlCard).join('');

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
              <p style="margin:0 0 6px;font-size:20px;font-weight:500;color:#111;letter-spacing:-0.02em;">계약서 누락 안내</p>
              <p style="margin:0 0 20px;font-size:13px;color:#666;line-height:1.6;">
                ${escapeHtml(group.author_name)}님, 아래 계약서 체결 요청 문서의 계약서를 전달해 주시지 않아서 전달 요청드립니다.
              </p>
            </td>
          </tr>

          <!-- 계약서 카드 목록 -->
          <tr>
            <td style="padding:0 24px 4px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">${contractCards}
              </table>
            </td>
          </tr>

          <!-- 푸터 -->
          <tr>
            <td style="padding:16px 24px 24px;">
              <p style="margin:0;font-size:11px;color:#aaa;line-height:1.6;">
                계약서를 보유하고 계시다면 <strong style="color:#666;">Slack DM</strong>으로만 전달해 주시면 됩니다.<br />
                추가로 <strong style="color:#666;">실물 계약서</strong>를 가지고 계신다면, 추후 실물 계약서도 전달해 주시면 감사하겠습니다.
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
    to: group.recipient_email,
    subject,
    text,
    html
  });
}
