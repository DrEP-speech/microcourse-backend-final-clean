// email/mailer.js
import nodemailer from 'nodemailer';

let transporter;
export function getMailer() {
  if (transporter) return transporter;
  if (!process.env.SMTP_URL) {
    // dev: log to console
    return {
      sendMail: async (opts) => console.log('[DEV MAIL]', opts)
    };
  }
  transporter = nodemailer.createTransport(process.env.SMTP_URL);
  return transporter;
}

export async function sendResetEmail(to, url) {
  const from = process.env.MAIL_FROM || 'no-reply@example.com';
  await getMailer().sendMail({
    from, to,
    subject: 'Reset your password',
    text: `Reset link: ${url}`,
    html: `<p>Reset link: <a href="${url}">${url}</a></p>`
  });
}
