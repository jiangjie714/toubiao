import nodemailer from "nodemailer";

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export function getAppUrl(): string {
  return process.env.APP_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:3000";
}

export async function sendMail(message: MailMessage): Promise<void> {
  const host = process.env.SMTP_HOST;
  if (!host) {
    console.info(`[mailer:dev] 收件人=${message.to}，主题=${message.subject}`);
    console.info(message.text);
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASSWORD
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          }
        : undefined,
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? "no-reply@toubiao.local",
    ...message,
  });
}
