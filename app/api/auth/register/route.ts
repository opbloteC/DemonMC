import { NextResponse } from "next/server";
import { jsonError, mutationGuard, readJson } from "@/lib/api";
import { hashPassword, createSession } from "@/lib/auth";
import { invalidateSiteData } from "@/lib/cache";
import { isUniqueViolation, query } from "@/lib/db";
import {
  ipAttemptKey,
  lockRemainingMs,
  recordLoginFailure,
} from "@/lib/login-guard";
import { resolveMinecraftUuid } from "@/lib/minecraft";
import {
  validateRegistration,
  type RegistrationFieldErrors,
} from "@/lib/register-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REGISTRATION_LIMIT = 10;

function registrationKey(req: Request): string {
  return `register:${ipAttemptKey(req)}`;
}

function fieldErrorResponse(
  status: number,
  fieldErrors: RegistrationFieldErrors,
  error = "Please fix the highlighted fields.",
): NextResponse {
  return NextResponse.json(
    { error, fieldErrors },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: Request) {
  const guard = mutationGuard(req);
  if (guard) return guard;

  const key = registrationKey(req);
  const remaining = await lockRemainingMs(key, REGISTRATION_LIMIT);
  if (remaining > 0) {
    const minutes = Math.max(1, Math.ceil(remaining / 60000));
    return NextResponse.json(
      {
        error: `Too many account creation attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(Math.ceil(remaining / 1000)),
        },
      },
    );
  }

  const body = await readJson(req);
  if (!body) return jsonError("Invalid request body.");

  const minecraftUsername =
    typeof body.username === "string" ? body.username.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : "";

  const fieldErrors = validateRegistration({
    username: minecraftUsername,
    email,
    password,
    confirmPassword,
  });
  if (Object.keys(fieldErrors).length > 0) {
    return fieldErrorResponse(422, fieldErrors);
  }

  await recordLoginFailure(key, REGISTRATION_LIMIT);

  const emailTaken = await query<{ id: number }>(
    "SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1",
    [email],
  );
  if (emailTaken.rows[0]) {
    return fieldErrorResponse(
      409,
      { email: "An account with that email already exists." },
      "An account with that email already exists.",
    );
  }

  const nameTaken = await query<{ id: number }>(
    `SELECT id FROM users
     WHERE lower(minecraft_username) = lower($1)
        OR (minecraft_username IS NULL AND lower(username) = lower($1))
     LIMIT 1`,
    [minecraftUsername],
  );
  if (nameTaken.rows[0]) {
    return fieldErrorResponse(
      409,
      { username: "That Minecraft username is already registered." },
      "That Minecraft username is already registered.",
    );
  }

  const passwordHash = await hashPassword(password);
  const minecraftUuid = await resolveMinecraftUuid(minecraftUsername);
  const now = new Date().toISOString();
  let userId: number;

  try {
    const inserted = await query<{ id: number }>(
      `INSERT INTO users (
         username, minecraft_username, minecraft_uuid, email, password_hash, role,
         description, avatar_url, joined_at, created_at, disabled, rank_id
       )
       VALUES ($1, $1, $2, $3, $4, 'player', '', NULL, $5, $6, FALSE,
               (SELECT id FROM ranks WHERE key = 'member'))
       RETURNING id`,
      [minecraftUsername, minecraftUuid, email, passwordHash, now.slice(0, 10), now],
    );
    userId = inserted.rows[0].id;
  } catch (error) {
    if (isUniqueViolation(error)) {
      return jsonError("That Minecraft username or email is already registered.", 409);
    }
    console.error("Failed to create account:", error);
    return jsonError("Could not create the account.", 500);
  }

  let session = false;
  try {
    await createSession(userId);
    session = true;
  } catch (error) {
    console.error("Failed to create session after registration:", error);
  }

  invalidateSiteData();
  return NextResponse.json(
    { ok: true, session },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
