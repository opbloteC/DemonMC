import { NextResponse } from "next/server";
import { jsonError, mutationGuard, readJson } from "@/lib/api";
import { sha256 } from "@/lib/auth";
import { getBranding } from "@/lib/branding";
import { query } from "@/lib/db";
import {
  appBaseUrl,
  EmailNotConfiguredError,
  emailProvider,
  renderPasswordResetCodeEmail,
  sendMail,
} from "@/lib/email";
import {
  clearLoginFailures,
  ipAttemptKey,
  lockRemainingMs,
  recordLoginFailure,
} from "@/lib/login-guard";
import {
  cooldownRemainingMs,
  createResetCode,
  deleteUnusedResetCodes,
  startCooldown,
} from "@/lib/password-reset-code";
import { isEmailAddress } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IP_REQUEST_LIMIT = 5;

const SUCCESS_MESSAGE = "We've sent a verification code to your email address.";
const DELIVERY_ERROR =
  "We couldn't send the verification email right now. Please try again in a moment.";

function noStore(body: Record<string, unknown>, status = 200, headers?: HeadersInit): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

function rateLimited(remainingMs: number, message: string): NextResponse {
  return noStore({ error: message }, 429, {
    "Retry-After": String(Math.ceil(remainingMs / 1000)),
  });
}

interface ResetUserRow {
  id: number;
  username: string;
  email: string;
}

export async function POST(req: Request) {
  const guard = mutationGuard(req);
  if (guard) return guard;

  const ipKey = `password-reset:${ipAttemptKey(req)}`;
  const ipRemaining = await lockRemainingMs(ipKey, IP_REQUEST_LIMIT);
  if (ipRemaining > 0) {
    return rateLimited(ipRemaining, "Too many code requests. Please try again later.");
  }

  const body = await readJson(req);
  if (!body) return jsonError("Invalid request body.");

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!isEmailAddress(email)) return jsonError("Enter a valid email address.", 422);

  const cooldownKey = `password-reset-cooldown:${sha256(email)}`;
  const cooldown = await cooldownRemainingMs(cooldownKey);
  if (cooldown > 0) {
    return rateLimited(cooldown, "Please wait a moment before requesting another code.");
  }

  await recordLoginFailure(ipKey, IP_REQUEST_LIMIT);

  const { rows } = await query<ResetUserRow>(
    `SELECT id, username, email FROM users
     WHERE lower(email) = lower($1) AND email IS NOT NULL AND disabled = FALSE
     LIMIT 1`,
    [email],
  );
  const user = rows[0];

  // Unknown emails get the same reply so account existence is never revealed.
  if (user) {
    try {
      const code = await createResetCode(user.id, ipAttemptKey(req).slice(3));
      const appUrl = appBaseUrl(req);
      const branding = await getBranding();
      const message = renderPasswordResetCodeEmail({
        username: user.username,
        code,
        appUrl,
        brandName: branding.name,
      });
      await sendMail({ to: user.email, ...message });
    } catch (error) {
      await deleteUnusedResetCodes(user.id).catch(() => undefined);
      if (error instanceof EmailNotConfiguredError) {
        console.error(
          "Password reset code not sent: email delivery is not configured. Set EMAIL_FROM and RESEND_API_KEY, or EMAIL_FROM plus SMTP_HOST/SMTP_USER/SMTP_PASS in the deployment environment.",
        );
      } else {
        console.error(
          `Password reset code delivery failed via ${emailProvider()}:`,
          error instanceof Error ? error.message : "unknown error",
        );
      }
      return noStore({ error: DELIVERY_ERROR }, 502);
    }
  }

  // A fresh code gets a fresh attempt budget; the reset is done for unknown
  // addresses too, so the behaviour never signals whether an account exists.
  await clearLoginFailures(`password-reset-code:${sha256(email)}`);

  // Resend cooldown applies to every address, so it cannot signal account existence.
  await startCooldown(cooldownKey);

  return noStore({ message: SUCCESS_MESSAGE });
}
