import { getDefaultMailFrom, getMailTransporter } from './smtp';

type SendInviteEmailParams = {
  to: string;
  temporaryPassword: string;
  signInUrl: string;
};

export async function sendInviteEmail({
  to,
  temporaryPassword,
  signInUrl
}: SendInviteEmailParams): Promise<void> {
  const transporter = getMailTransporter();
  const from = getDefaultMailFrom();

  const subject = '[WakeOne] 계정 초대 안내';

  const text = [
    '초대장이 도착했어요.',
    'WakeOne 팀이 회원님을 초대했습니다.',
    '',
    `로그인 이메일: ${to}`,
    `임시 비밀번호: ${temporaryPassword}`,
    '',
    `로그인: ${signInUrl}`,
    '',
    '로그인 후 비밀번호 변경을 권장합니다.',
    '본인이 요청하지 않은 경우 관리자에게 문의해 주세요.'
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
            <td style="padding:32px 32px 0;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="width:32px;height:32px;background:#000;border-radius:8px;text-align:center;vertical-align:middle;">
                    <span style="color:#fff;font-size:14px;font-weight:500;line-height:32px;">W</span>
                  </td>
                  <td style="padding-left:10px;font-size:15px;font-weight:500;color:#111;vertical-align:middle;">
                    WakeOne
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 타이틀 -->
          <tr>
            <td style="padding:24px 32px 0;">
              <p style="margin:0 0 8px;font-size:24px;font-weight:500;color:#111;line-height:1.2;letter-spacing:-0.02em;">
                초대장이 도착했어요.
              </p>
              <p style="margin:0 0 28px;font-size:14px;color:#666;">
                WakeOne 팀이 회원님을 초대했습니다.
              </p>
            </td>
          </tr>

          <!-- 이메일 카드 -->
          <tr>
            <td style="padding:0 32px 10px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f9f9;border-radius:8px;">
                <tr>
                  <td style="padding:14px 16px;width:28px;vertical-align:middle;">
                    <span style="font-size:18px;">✉</span>
                  </td>
                  <td style="padding:14px 16px 14px 0;vertical-align:middle;">
                    <p style="margin:0 0 2px;font-size:11px;color:#aaa;">로그인 이메일</p>
                    <p style="margin:0;font-size:14px;font-weight:500;color:#111;">${to}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 비밀번호 카드 -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f9f9;border-radius:8px;">
                <tr>
                  <td style="padding:14px 16px;width:28px;vertical-align:middle;">
                    <span style="font-size:18px;">🔒</span>
                  </td>
                  <td style="padding:14px 16px 14px 0;vertical-align:middle;">
                    <p style="margin:0 0 2px;font-size:11px;color:#aaa;">임시 비밀번호</p>
                    <p style="margin:0;font-size:14px;font-weight:500;color:#111;font-family:'Courier New',Courier,monospace;">${temporaryPassword}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA 버튼 -->
          <tr>
            <td style="padding:0 32px 14px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="background:#000;border-radius:8px;">
                    <a href="${signInUrl}"
                       style="display:block;padding:13px;color:#fff;text-decoration:none;font-size:14px;font-weight:500;text-align:center;">
                      지금 로그인하기 →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 푸터 -->
          <tr>
            <td style="padding:0 32px 32px;">
              <p style="margin:0;font-size:11px;color:#bbb;text-align:center;line-height:1.6;">
                로그인 후 비밀번호 변경을 권장합니다 · 본인이 요청하지 않은 경우 관리자에게 문의해 주세요.
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