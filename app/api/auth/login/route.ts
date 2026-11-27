import { NextResponse } from "next/server";
import { authenticate, createSession } from "@/lib/auth";
import { jsonError, mutationGuard, readJson } from "@/lib/api";
import {
  clearLoginFailures,
  ipAttemptKey,
  IP_FAILURE_LIMIT,
  lockRemainingMs,
  recordLoginFailure,
  USERNAME_FAILURE_LIMIT,
  usernameAttemptKey,
} from "@/lib/login-guard";
import { validateLogin, type LoginFieldErrors } from "@/lib/login-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function lockedResponse(remainingMs: number): NextResponse {
  const minutes = Math.max(1, Math.ceil(remainingMs / 60000));
  return NextResponse.json(
    { error: `Too many failed sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(Math.ceil(remainingMs / 1000)),
      },
    },
  );
}

function fieldErrorResponse(fieldErrors: LoginFieldErrors): NextResponse {
  return NextResponse.json(
    { error: "Please fix the highlighted fields.", fieldErrors },
    { status: 422, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: Request) {
  const guard = mutationGuard(req);
  if (guard) return guard;

  const body = await readJson(req);
  if (!body) return jsonError("Invalid request body.");

  const username = typeof body.username === "string" ? body.username.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  const fieldErrors = validateLogin({ username, email, password });
  if (Object.keys(fieldErrors).length > 0) {
    return fieldErrorResponse(fieldErrors);
  }

  const userKey = usernameAttemptKey(username);
  const ipKey = ipAttemptKey(req);
  const [userRemaining, ipRemaining] = await Promise.all([
    lockRemainingMs(userKey, USERNAME_FAILURE_LIMIT),
    lockRemainingMs(ipKey, IP_FAILURE_LIMIT),
  ]);
  const remaining = Math.max(userRemaining, ipRemaining);
  if (remaining > 0) return lockedResponse(remaining);

  const user = await authenticate(username, email, password);
  if (!user) {
    await Promise.all([
      recordLoginFailure(userKey, USERNAME_FAILURE_LIMIT),
      recordLoginFailure(ipKey, IP_FAILURE_LIMIT),
    ]);
    return jsonError("Incorrect username, email, or password.", 401);
  }

  await clearLoginFailures(userKey);
  await createSession(user.id);

  return NextResponse.json(
    { user },
    { headers: { "Cache-Control": "no-store" } },
  );
}
