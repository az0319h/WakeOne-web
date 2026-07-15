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

function formatContractHtmlLine(contract: ContractReminderRecipientGroup['contracts'][number]): string {
  const documentNumber = escapeHtml(contract.document_number);
  const documentLabel = contract.source_document_url?.trim()
    ? `<a href="${escapeHtml(contract.source_document_url.trim())}" target="_blank" rel="noopener noreferrer">${documentNumber}</a>`
    : documentNumber;
  const approvedPart = contract.approved_at
    ? ` / 문서승인일: ${escapeHtml(contract.approved_at)}`
    : '';

  return `
        <li>
          <strong>${documentLabel}</strong>
          <span style="color:#666;"> / ${escapeHtml(contract.contract_target)} / 문서생성일: ${escapeHtml(contract.document_created_at)}${approvedPart}</span>
        </li>`;
}

export async function sendContractReminderEmail({ group }: SendContractReminderEmailParams): Promise<void> {
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
    '계약서를 보유하고 계시다면 개인 총무팀 Slack으로만 전달해 주시면 됩니다.',
    '추가로 실물 계약서를 가지고 계신다면, 추후 실물 계약서도 전달해 주시면 감사하겠습니다.'
  ].join('\n');

  const listItems = group.contracts.map(formatContractHtmlLine).join('');

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
              <p style="margin:0 0 8px;font-size:22px;font-weight:600;color:#111;">계약서 누락 안내</p>
              <p style="margin:0 0 24px;font-size:14px;color:#666;line-height:1.6;">
                ${escapeHtml(group.author_name)}님, 아래 계약서 체결 요청 문서의 계약서를 전달해 주시지 않아서 전달 요청드립니다.
              </p>
              <ul style="margin:0 0 24px;padding-left:20px;font-size:14px;line-height:1.8;color:#111;">
                ${listItems}
              </ul>
              <p style="margin:0;font-size:12px;color:#999;line-height:1.6;">
                계약서를 보유하고 계시다면 <strong>개인 총무팀 Slack</strong>으로만 전달해 주시면 됩니다.<br />
                추가로 <strong>실물 계약서</strong>를 가지고 계신다면, 추후 실물 계약서도 전달해 주시면 감사하겠습니다.
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
