import nodemailer from "nodemailer";
import { RESET_CODE_TTL_MINUTES } from "./password-reset-code";
import { RESET_TOKEN_TTL_MINUTES } from "./password-reset";

export class EmailNotConfiguredError extends Error {
  constructor() {
    super("Email delivery is not configured.");
    this.name = "EmailNotConfiguredError";
  }
}

interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const DEFAULT_APP_URL = "http://localhost:3000";

export function appBaseUrl(req?: Request): string {
  const configured = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  if (req) {
    const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
    const host = req.headers.get("host");
    if (host) return `${proto}://${host}`;
  }
  return DEFAULT_APP_URL;
}

function emailFrom(): string {
  return process.env.EMAIL_FROM?.trim() || "";
}

function hasResend(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && emailFrom());
}

function hasSmtp(): boolean {
  return Boolean(process.env.SMTP_HOST?.trim() && emailFrom());
}

const PROVIDER_TIMEOUT_MS = 8_000;

function providerErrorText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return "";
}

function sanitizeProviderError(value: unknown): string {
  return providerErrorText(value)
    .replace(/\b[^\s@<>]+@[^\s@<>]+\.[A-Za-z]{2,}\b/g, "[email]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

export type EmailProvider = "resend" | "smtp" | "none";

export function emailProvider(): EmailProvider {
  if (hasResend()) return "resend";
  if (hasSmtp()) return "smtp";
  return "none";
}

export function isEmailConfigured(): boolean {
  return emailProvider() !== "none";
}

async function sendWithResend(message: MailMessage): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom(),
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { name?: unknown; error?: unknown; message?: unknown }
        | null;
      const detail = [payload?.name, payload?.error, payload?.message]
        .map(sanitizeProviderError)
        .filter(Boolean)
        .join(": ");
      const requestId = response.headers.get("x-request-id");
      throw new Error(
        `Resend rejected the message (status ${response.status}${detail ? `: ${detail}` : ""}${requestId ? `, request ${requestId}` : ""}).`,
      );
    }

    const receipt = (await response.json().catch(() => null)) as { id?: unknown } | null;
    if (typeof receipt?.id !== "string" || !receipt.id) {
      throw new Error("Resend accepted the request but did not return a message ID.");
    }
  } catch (error) {
    const name =
      error && typeof error === "object" ? (error as { name?: unknown }).name : "";
    if (name === "AbortError") {
      throw new Error(
        `Resend did not respond within ${PROVIDER_TIMEOUT_MS / 1000} seconds.`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function sendWithSmtp(message: MailMessage): Promise<void> {
  const port = Number(process.env.SMTP_PORT?.trim() || "587");
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS ?? "";
  const secure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE.trim() === "true"
    : port === 465;

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST!.trim(),
    port,
    secure,
    auth: user ? { user, pass } : undefined,
    connectionTimeout: PROVIDER_TIMEOUT_MS,
    greetingTimeout: PROVIDER_TIMEOUT_MS,
    socketTimeout: PROVIDER_TIMEOUT_MS + 4_000,
  });

  try {
    const info = await transport.sendMail({
      from: emailFrom(),
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    const accepted = Array.isArray(info?.accepted) ? info.accepted.length : 0;
    const rejected = Array.isArray(info?.rejected) ? info.rejected.length : 0;
    if (accepted === 0 || rejected > 0) {
      throw new Error("SMTP server did not accept the recipient.");
    }
  } catch (error) {
    const detail = sanitizeProviderError(
      error instanceof Error ? error.message : "unknown SMTP error",
    );
    throw new Error(`SMTP delivery failed${detail ? `: ${detail}` : "."}`);
  }
}

export async function sendMail(message: MailMessage): Promise<void> {
  if (hasResend()) return sendWithResend(message);
  if (hasSmtp()) return sendWithSmtp(message);
  throw new EmailNotConfiguredError();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderPasswordResetCodeEmail({
  username,
  code,
  appUrl,
  brandName = "DemonMC",
}: {
  username: string;
  code: string;
  appUrl: string;
  brandName?: string;
}): { subject: string; html: string; text: string } {
  const safeName = escapeHtml(username);
  const safeCode = escapeHtml(code);
  const brand = escapeHtml(brandName);
  const subject = `${brandName} — Password Reset Verification Code`;
  const logoUrl = escapeHtml(`${appUrl}/images/dmc-logo.png`);
  const minutes = RESET_CODE_TTL_MINUTES;

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#eef8fe;font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:#0a2239;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef8fe;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border:1px solid #c6eafa;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background-color:#1a8ac0;background-image:linear-gradient(135deg,#1a8ac0,#0a2239);padding:28px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-right:12px;vertical-align:middle;">
                      <img src="${logoUrl}" width="44" height="44" alt="${brand}" style="display:block;border-radius:10px;background-color:#ffffff;" />
                    </td>
                    <td style="vertical-align:middle;">
                      <div style="font-size:18px;font-weight:800;letter-spacing:0.06em;color:#ffffff;">${escapeHtml(brandName.toUpperCase())}</div>
                      <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#9ddaf7;">Network account security</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;color:#0a2239;">Your password reset code</h1>
                <p style="margin:0 0 12px;font-size:14px;line-height:1.65;color:#35566f;">Hi ${safeName},</p>
                <p style="margin:0 0 20px;font-size:14px;line-height:1.65;color:#35566f;">
                  Use the verification code below to reset the password for your ${brand} account.
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
                  <tr>
                    <td align="center" style="padding:18px 16px;background-color:#f2fbff;border:1px solid #d8eefb;border-radius:12px;">
                      <div style="font-family:Consolas,'Courier New',monospace;font-size:32px;font-weight:800;letter-spacing:0.32em;color:#0a2239;padding-left:0.32em;">${safeCode}</div>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#4d6f88;">
                  This code expires in ${minutes} minutes and can only be used once.
                </p>
                <p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#4d6f88;">
                  Enter it on the ${brand} verification screen to choose a new password.
                </p>
                <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#4d6f88;">
                  If you did not request a password reset, you can safely ignore this email. Your current password will stay the same.
                </p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#4d6f88;">
                  For security, ${brand} will never ask for your password by email.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px;background-color:#f7fcff;border-top:1px solid #e2f5fe;font-size:11px;line-height:1.6;color:#7191a8;">
                This verification code was requested for a ${brand} account. No changes have been made yet.
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 22px;text-align:center;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#9fb9cc;">
                ${brand} · Enter the world
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    `${brandName.toUpperCase()} — PASSWORD RESET VERIFICATION CODE`,
    "",
    `Hi ${username},`,
    "",
    `Use this verification code to reset the password for your ${brandName} account:`,
    "",
    `    ${code}`,
    "",
    `This code expires in ${minutes} minutes and can only be used once.`,
    "Enter it on the verification screen to choose a new password.",
    "If you did not request a password reset, you can safely ignore this email;",
    "your current password will stay the same.",
    "",
    `${brandName} will never ask for your password by email.`,
    "",
    `${brandName} · Enter the world`,
  ].join("\n");

  return { subject, html, text };
}

export function renderPasswordResetEmail({
  username,
  resetUrl,
  appUrl,
  brandName = "DemonMC",
}: {
  username: string;
  resetUrl: string;
  appUrl: string;
  brandName?: string;
}): { subject: string; html: string; text: string } {
  const safeName = escapeHtml(username);
  const safeUrl = escapeHtml(resetUrl);
  const brand = escapeHtml(brandName);
  const subject = `${brandName} — Password Reset Request`;
  const logoUrl = escapeHtml(`${appUrl}/images/dmc-logo.png`);
  const minutes = RESET_TOKEN_TTL_MINUTES;

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#eef8fe;font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:#0a2239;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef8fe;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border:1px solid #c6eafa;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background-color:#1a8ac0;background-image:linear-gradient(135deg,#1a8ac0,#0a2239);padding:28px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-right:12px;vertical-align:middle;">
                      <img src="${logoUrl}" width="44" height="44" alt="${brand}" style="display:block;border-radius:10px;background-color:#ffffff;" />
                    </td>
                    <td style="vertical-align:middle;">
                      <div style="font-size:18px;font-weight:800;letter-spacing:0.06em;color:#ffffff;">${escapeHtml(brandName.toUpperCase())}</div>
                      <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#9ddaf7;">Network account security</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;color:#0a2239;">Password reset requested</h1>
                <p style="margin:0 0 12px;font-size:14px;line-height:1.65;color:#35566f;">Hi ${safeName},</p>
                <p style="margin:0 0 20px;font-size:14px;line-height:1.65;color:#35566f;">
                  We received a request to reset the password for your ${brand} account. Click the button below to choose a new password.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
                  <tr>
                    <td align="center" style="border-radius:8px;background-color:#1a8ac0;">
                      <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.02em;">Reset Password</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#4d6f88;">
                  This link expires in ${minutes} minutes and can only be used once.
                </p>
                <p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#4d6f88;">
                  If the button does not work, copy and paste this address into your browser:
                </p>
                <p style="margin:0 0 24px;padding:12px 14px;background-color:#f2fbff;border:1px solid #e2f5fe;border-radius:8px;font-family:Consolas,'Courier New',monospace;font-size:12px;line-height:1.5;word-break:break-all;">
                  <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color:#176f9c;text-decoration:none;">${safeUrl}</a>
                </p>
                <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#4d6f88;">
                  If you did not request a password reset, you can safely ignore this email. Your current password will stay the same.
                </p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#4d6f88;">
                  For security, ${brand} will never ask for your password by email.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px;background-color:#f7fcff;border-top:1px solid #e2f5fe;font-size:11px;line-height:1.6;color:#7191a8;">
                This message was sent because a password reset was requested for your ${brand} account.
                No changes have been made yet — only the reset link above can update your password.
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 22px;text-align:center;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#9fb9cc;">
                ${brand} · Enter the world
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    `${brandName.toUpperCase()} — PASSWORD RESET REQUEST`,
    "",
    `Hi ${username},`,
    "",
    `We received a request to reset the password for your ${brandName} account.`,
    "Open the link below to choose a new password:",
    "",
    resetUrl,
    "",
    `This link expires in ${minutes} minutes and can only be used once.`,
    "If you did not request a password reset, you can safely ignore this email;",
    "your current password will stay the same.",
    "",
    `${brandName} will never ask for your password by email.`,
    "",
    `${brandName} · Enter the world`,
  ].join("\n");

  return { subject, html, text };
}
