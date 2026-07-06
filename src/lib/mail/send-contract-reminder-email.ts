import type { ContractReminderRecipientGroup } from '@/features/contracts/api/types';
import { getDefaultMailFrom, getMailTransporter } from './smtp';

type SendContractReminderEmailParams = {
  group: ContractReminderRecipientGroup;
};

function getContractsUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'http://localhost:3000';
  return `${appUrl.replace(/\/$/, '')}/dashboard/contracts`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export async function sendContractReminderEmail({ group }: SendContractReminderEmailParams): Promise<void> {
  const transporter = getMailTransporter();
  const from = getDefaultMailFrom();
  const contractsUrl = getContractsUrl();
  const documentLines = group.contracts.map(
    (contract) =>
      `- ${contract.document_number} / ${contract.contract_target} / ${contract.document_created_at}`
  );

  const subject = `[WakeOne] 계약서 첨부 누락 안내 (${group.document_numbers.length}건)`;
  const text = [
    `${group.author_name}님,`,
    '',
    '아래 계약서 체결 요청 문서에 첨부파일이 등록되어 있지 않습니다.',
    '첨부파일을 업로드하거나 관리자에게 첨부파일 없음 처리를 요청해 주세요.',
    '',
    ...documentLines,
    '',
    `계약서 관리: ${contractsUrl}`
  ].join('\n');

  const listItems = group.contracts
    .map(
      (contract) => `
        <li>
          <strong>${escapeHtml(contract.document_number)}</strong>
          <span style="color:#666;"> / ${escapeHtml(contract.contract_target)} / ${escapeHtml(contract.document_created_at)}</span>
        </li>`
    )
    .join('');

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
        <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#fff;border:1px solid #e5e5e5;border-radius:12px;">
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:600;color:#111;">계약서 첨부 누락 안내</p>
              <p style="margin:0 0 24px;font-size:14px;color:#666;line-height:1.6;">
                ${escapeHtml(group.author_name)}님, 아래 계약서 체결 요청 문서에 첨부파일이 등록되어 있지 않습니다.
              </p>
              <ul style="margin:0 0 24px;padding-left:20px;font-size:14px;line-height:1.8;color:#111;">
                ${listItems}
              </ul>
              <a href="${contractsUrl}" style="display:block;background:#000;color:#fff;text-decoration:none;border-radius:8px;padding:13px;text-align:center;font-size:14px;font-weight:500;">
                계약서 관리에서 확인하기
              </a>
              <p style="margin:20px 0 0;font-size:12px;color:#999;line-height:1.6;">
                첨부파일이 필요 없는 문서는 관리자에게 첨부파일 없음 처리를 요청해 주세요.
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
