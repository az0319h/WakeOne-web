import nodemailer, { type Transporter } from 'nodemailer';

function getSmtpConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD?.trim();
  const from = process.env.SMTP_FROM?.trim();
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (!host || !user || !pass || !from) {
    throw new Error(
      'SMTP 설정이 없습니다. .env에 SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_FROM을 설정해 주세요.'
    );
  }

  return { host, port, user, pass, from, secure };
}

let cachedTransporter: Transporter | null = null;

export function getMailTransporter(): Transporter {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const { host, port, user, pass, secure } = getSmtpConfig();
  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });

  return cachedTransporter;
}

export function getDefaultMailFrom(): string {
  return getSmtpConfig().from;
}
