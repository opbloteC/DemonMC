import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jsonError, mutationGuard, readJson } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { clearLoginFailures, ipAttemptKey, lockRemainingMs, recordLoginFailure } from "@/lib/login-guard";
import {
  consumeVerifiedReset,
  RESET_VERIFY_COOKIE,
} from "@/lib/password-reset-code";
import { isStrongPassword } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUBMIT_LIMIT = 10;

const EXPIRED_MESSAGE = "Your verification has expired. Please verify your code again.";

function noStore(body: Record<string, unknown>, status = 200, headers?: HeadersInit): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

export async function POST(req: Request) {
  const guard = mutationGuard(req);
  if (guard) return guard;

  const key = `password-reset-submit:${ipAttemptKey(req)}`;
  const remaining = await lockRemainingMs(key, SUBMIT_LIMIT);
  if (remaining > 0) {
    return noStore({ error: "Too many attempts. Try again later." }, 429, {
      "Retry-After": String(Math.ceil(remaining / 1000)),
    });
  }
  await recordLoginFailure(key, SUBMIT_LIMIT);

  const store = await cookies();
  const nonce = store.get(RESET_VERIFY_COOKIE)?.value ?? "";
  if (!nonce) return noStore({ error: EXPIRED_MESSAGE }, 401);

  const body = await readJson(req);
  if (!body) return jsonError("Invalid request body.");

  const password = body.password;
  const confirmPassword = body.confirmPassword;

  if (!isStrongPassword(password)) {
    return jsonError("Password must be 10–200 characters and include a letter and a number.", 422);
  }
  if (password !== confirmPassword) return jsonError("Passwords do not match.", 422);

  const passwordHash = await hashPassword(password);
  const state = await consumeVerifiedReset(nonce, passwordHash);

  if (state === "expired") {
    store.set(RESET_VERIFY_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
    return noStore({ error: EXPIRED_MESSAGE }, 410);
  }
  if (state !== "valid") {
    return noStore({ error: EXPIRED_MESSAGE }, 401);
  }

  store.set(RESET_VERIFY_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  await clearLoginFailures(key);

  // The user is intentionally not signed in here; any existing sessions stay intact.
  return noStore({ ok: true });
}
