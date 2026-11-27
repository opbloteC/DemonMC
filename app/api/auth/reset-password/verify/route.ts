import { NextResponse } from "next/server";
import { jsonError, mutationGuard, readJson } from "@/lib/api";
import { ipAttemptKey, lockRemainingMs, recordLoginFailure } from "@/lib/login-guard";
import { inspectPasswordResetToken, isResetTokenFormat } from "@/lib/password-reset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VERIFY_LIMIT = 30;

export async function POST(req: Request) {
  const guard = mutationGuard(req);
  if (guard) return guard;

  const key = `password-reset-verify:${ipAttemptKey(req)}`;
  const remaining = await lockRemainingMs(key, VERIFY_LIMIT);
  if (remaining > 0) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(Math.ceil(remaining / 1000)),
        },
      },
    );
  }
  await recordLoginFailure(key, VERIFY_LIMIT);

  const body = await readJson(req);
  if (!body) return jsonError("Invalid request body.");

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!isResetTokenFormat(token)) {
    return NextResponse.json({ state: "invalid" }, { headers: { "Cache-Control": "no-store" } });
  }

  const info = await inspectPasswordResetToken(token);
  return NextResponse.json(
    { state: info.state },
    { headers: { "Cache-Control": "no-store" } },
  );
}
