import { NextResponse } from "next/server";
import { jsonError, mutationGuard, readJson, requireUser } from "@/lib/api";
import { isUniqueViolation, query } from "@/lib/db";
import { isEmailAddress } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const guard = mutationGuard(req);
  if (guard) return guard;

  const body = await readJson(req);
  if (!body) return jsonError("Invalid request body.");

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!isEmailAddress(email)) return jsonError("Enter a valid email address.", 422);

  const taken = await query<{ id: number }>(
    `SELECT id FROM users
     WHERE lower(email) = lower($1) AND id <> $2
     LIMIT 1`,
    [email, auth.user.id],
  );
  if (taken.rows[0]) return jsonError("An account with that email already exists.", 409);

  try {
    await query("UPDATE users SET email = $1 WHERE id = $2", [email, auth.user.id]);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return jsonError("An account with that email already exists.", 409);
    }
    console.error("Failed to update email:", error);
    return jsonError("Could not save your email address.", 500);
  }

  return NextResponse.json(
    { ok: true, email },
    { headers: { "Cache-Control": "no-store" } },
  );
}
