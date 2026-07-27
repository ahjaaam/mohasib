import "server-only";
import { Resend } from "resend";

type LeadNotificationKind = "signup" | "demo" | "ticket";

type LeadNotificationInput = {
  kind: LeadNotificationKind;
  fullName?: string;
  email?: string;
  phone?: string;
  company?: string;
  userType?: string;
  source?: string;
  subject?: string;
  message?: string;
  link?: string;
};

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function row(label: string, value?: string) {
  if (!value?.trim()) return "";
  return `
    <tr>
      <td style="padding:8px 0;color:#6B7280;font-size:13px;">${escapeHtml(label)}</td>
      <td style="padding:8px 0;color:#111827;font-size:13px;font-weight:600;">${escapeHtml(value.trim())}</td>
    </tr>
  `;
}

export async function sendLeadNotification(input: LeadNotificationInput) {
  const to = process.env.FOUNDER_NOTIFICATION_EMAIL || process.env.ADMIN_EMAILS?.split(",")[0]?.trim();
  if (!resend || !to) return { skipped: true };

  const isSignup = input.kind === "signup";
  const isTicket = input.kind === "ticket";
  const title = isTicket ? `Nouveau ticket support : ${input.subject || "Sans sujet"}` : isSignup ? "Nouvelle inscription" : "Nouvelle demande de démo";
  const source = input.source || (isSignup ? "Inscription" : isTicket ? "Support rapide" : "Homepage");

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || "Mohasib <noreply@mohasibai.com>",
    to,
    subject: `${title} — Mohasib AI`,
    html: `
      <div style="font-family:Inter,Arial,sans-serif;background:#F8F8F5;padding:24px;">
        <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid rgba(0,0,0,0.08);border-radius:14px;padding:24px;">
          <p style="margin:0 0 8px;color:#C8924A;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">Mohasib AI</p>
          <h1 style="margin:0 0 16px;color:#0D1526;font-size:22px;">${escapeHtml(title)}</h1>
          <table style="width:100%;border-collapse:collapse;">
            ${row("Nom", input.fullName)}
            ${row("Email", input.email)}
            ${row("Téléphone", input.phone)}
            ${row("Entreprise / cabinet", input.company)}
            ${row("Type de compte", input.userType)}
            ${row("Message", input.message)}
            ${row("Page", input.link)}
            ${row("Source", source)}
            ${row("Date", new Date().toLocaleString("fr-MA", { timeZone: "Africa/Casablanca" }))}
          </table>
        </div>
      </div>
    `,
  });

  return { skipped: false };
}
