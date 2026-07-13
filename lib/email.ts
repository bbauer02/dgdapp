import nodemailer from "nodemailer";

// Best-effort email sending. When SMTP_* env vars are absent (dev), the mail
// is logged to the console instead of failing the calling action.

function getTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ sent: boolean }> {
  const transport = getTransport();
  if (!transport) {
    console.log(
      `[email:dev] SMTP non configuré — mail non envoyé.\nTo: ${opts.to}\nSubject: ${opts.subject}\n${opts.text}`
    );
    return { sent: false };
  }
  try {
    await transport.sendMail({
      from: process.env.EMAIL_FROM ?? "DGD <noreply@dgd.local>",
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    return { sent: true };
  } catch (e) {
    console.error("[email] envoi échoué:", e);
    return { sent: false };
  }
}
