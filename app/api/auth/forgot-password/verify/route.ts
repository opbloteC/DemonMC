import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jsonError, mutationGuard, readJson } from "@/lib/api";
import { sha256 } from "@/lib/auth";
import {
  clearLoginFailures,
  ipAttemptKey,
  lockRemainingMs,
  recordLoginFailure,
} from "@/lib/login-guard";
import {
  isResetCodeFormat,
  RESET_VERIFY_COOKIE,
  VERIFY_STATE_TTL_MS,
  verifyResetCode,
} from "@/lib/password-reset-code";
import { isEmailAddress } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VERIFY_IP_LIMIT = 30;
const EMAIL_FAILURE_LIMIT = 5;

const FAILURE_MESSAGE =
  "That verification code is incorrect or has expired. Request a new code if you need one.";
const LOCKED_MESSAGE = "Too many incorrect attempts. Request a new code and try again.";

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

export async function POST(req: Request) {
  const guard = mutationGuard(req);
  if (guard) return guard;

  const ipKey = `password-reset-verify:${ipAttemptKey(req)}`;
  const ipRemaining = await lockRemainingMs(ipKey, VERIFY_IP_LIMIT);
  if (ipRemaining > 0) {
    return rateLimited(ipRemaining, "Too many attempts. Please try again later.");
  }
  await recordLoginFailure(ipKey, VERIFY_IP_LIMIT);

  const body = await readJson(req);
  if (!body) return jsonError("Invalid request body.");

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!isEmailAddress(email)) return jsonError("Enter a valid email address.", 422);

  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!isResetCodeFormat(code)) {
    return jsonError("Enter the 6-digit code from your email.", 422);
  }

  const emailKey = `password-reset-code:${sha256(email)}`;
  const emailRemaining = await lockRemainingMs(emailKey, EMAIL_FAILURE_LIMIT);
  if (emailRemaining > 0) return rateLimited(emailRemaining, LOCKED_MESSAGE);

  const result = await verifyResetCode(email, code);

  if (result.ok) {
    await clearLoginFailures(emailKey);
    const store = await cookies();
    store.set(RESET_VERIFY_COOKIE, result.nonce, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: Math.floor(VERIFY_STATE_TTL_MS / 1000),
    });
    return noStore({ ok: true });
  }

  await recordLoginFailure(emailKey, EMAIL_FAILURE_LIMIT);

  // The fifth failure locks known and unknown addresses alike, so the lock
  // itself can never reveal whether an account exists.
  const lockedFor = await lockRemainingMs(emailKey, EMAIL_FAILURE_LIMIT);
  if (result.reason === "locked" || lockedFor > 0) {
    return rateLimited(lockedFor || 60_000, LOCKED_MESSAGE);
  }

  return noStore({ error: FAILURE_MESSAGE }, 400);
}
