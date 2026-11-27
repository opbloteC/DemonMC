import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { query, withTransaction } from "./db";

export const RESET_CODE_TTL_MS = 10 * 60 * 1000;
export const RESET_CODE_TTL_MINUTES = RESET_CODE_TTL_MS / 60000;
export const RESEND_COOLDOWN_MS = 60 * 1000;
export const MAX_CODE_ATTEMPTS = 5;
export const VERIFY_STATE_TTL_MS = 10 * 60 * 1000;
export const RESET_VERIFY_COOKIE = "demonmc_reset_verify";

const VERIFY_NONCE_PATTERN = /^[a-f0-9]{64}$/;

export function isResetCodeFormat(code: unknown): code is string {
  return typeof code === "string" && /^\d{6}$/.test(code);
}

function resetPepper(): string {
  const configured = process.env.PASSWORD_RESET_SECRET?.trim();
  if (configured) return configured;
  // Keep hashes unusable without server-side secrets if the database leaks.
  const seed = process.env.DATABASE_URL?.trim() || "demonmc-password-reset";
  return createHash("sha256").update(`demonmc-reset|${seed}`).digest("hex");
}

function hashCode(userId: number, code: string): string {
  return createHmac("sha256", resetPepper()).update(`code:${userId}:${code}`).digest("hex");
}

function hashNonce(nonce: string): string {
  return createHmac("sha256", resetPepper()).update(`verify:${nonce}`).digest("hex");
}

export function generateResetCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function cooldownRemainingMs(key: string): Promise<number> {
  const { rows } = await query<{ reset_at: string }>(
    "SELECT reset_at FROM auth_attempts WHERE key = $1",
    [key],
  );
  const row = rows[0];
  if (!row) return 0;

  const resetAt = Number(row.reset_at);
  if (resetAt <= Date.now()) {
    await query("DELETE FROM auth_attempts WHERE key = $1", [key]);
    return 0;
  }
  return resetAt - Date.now();
}

export async function startCooldown(key: string): Promise<void> {
  const resetAt = Date.now() + RESEND_COOLDOWN_MS;
  await query(
    `INSERT INTO auth_attempts (key, count, reset_at) VALUES ($1, 1, $2)
     ON CONFLICT (key) DO UPDATE SET count = 1, reset_at = $2`,
    [key, resetAt],
  );
}

export async function createResetCode(userId: number, requestedIp: string): Promise<string> {
  const code = generateResetCode();
  const now = Date.now();
  const createdAt = new Date(now).toISOString();
  const expiresAt = new Date(now + RESET_CODE_TTL_MS).toISOString();

  await withTransaction(async (client) => {
    await client.query("DELETE FROM password_reset_codes WHERE expires_at < $1", [createdAt]);
    // Only the newest code can ever be used.
    await client.query("DELETE FROM password_reset_codes WHERE user_id = $1", [userId]);
    await client.query(
      `INSERT INTO password_reset_codes (user_id, code_hash, requested_ip, created_at, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, hashCode(userId, code), requestedIp, createdAt, expiresAt],
    );
  });

  return code;
}

export async function deleteUnusedResetCodes(userId: number): Promise<void> {
  await query("DELETE FROM password_reset_codes WHERE user_id = $1 AND used_at IS NULL", [userId]);
}

interface CodeRow {
  id: number;
  user_id: number;
  code_hash: string;
  expires_at: string;
  attempts: number;
  verified_at: string | null;
}

export type VerifyCodeResult =
  | { ok: true; userId: number; nonce: string }
  | { ok: false; reason: "invalid" | "expired" | "locked" };

export async function verifyResetCode(email: string, code: string): Promise<VerifyCodeResult> {
  const { rows: userRows } = await query<{ id: number; disabled: boolean }>(
    `SELECT id, disabled FROM users
     WHERE lower(email) = lower($1) AND email IS NOT NULL
     LIMIT 1`,
    [email],
  );
  const user = userRows[0];
  if (!user || user.disabled) return { ok: false, reason: "invalid" };

  const { rows } = await query<CodeRow>(
    `SELECT id, user_id, code_hash, expires_at, attempts, verified_at
     FROM password_reset_codes
     WHERE user_id = $1 AND used_at IS NULL
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [user.id],
  );
  const row = rows[0];
  if (!row) return { ok: false, reason: "invalid" };

  const now = Date.now();
  if (new Date(row.expires_at).getTime() <= now) {
    await query("DELETE FROM password_reset_codes WHERE id = $1", [row.id]);
    return { ok: false, reason: "expired" };
  }
  if (row.attempts >= MAX_CODE_ATTEMPTS) return { ok: false, reason: "locked" };

  const expected = Buffer.from(row.code_hash, "hex");
  const actual = Buffer.from(hashCode(row.user_id, code), "hex");
  const matches = expected.length === actual.length && timingSafeEqual(expected, actual);

  if (!matches) {
    const { rows: updated } = await query<{ attempts: number }>(
      `UPDATE password_reset_codes SET attempts = attempts + 1
       WHERE id = $1
       RETURNING attempts`,
      [row.id],
    );
    const attempts = updated[0]?.attempts ?? MAX_CODE_ATTEMPTS;
    if (attempts >= MAX_CODE_ATTEMPTS) {
      await query("DELETE FROM password_reset_codes WHERE id = $1", [row.id]);
      return { ok: false, reason: "locked" };
    }
    return { ok: false, reason: "invalid" };
  }

  const nonce = randomBytes(32).toString("hex");
  await query(
    `UPDATE password_reset_codes
     SET verified_at = $1, verify_token_hash = $2
     WHERE id = $3`,
    [new Date(now).toISOString(), hashNonce(nonce), row.id],
  );

  return { ok: true, userId: row.user_id, nonce };
}

export interface ActiveVerification {
  userId: number;
}

export async function resolveVerification(nonce: string): Promise<ActiveVerification | null> {
  if (!VERIFY_NONCE_PATTERN.test(nonce)) return null;

  const { rows } = await query<{
    user_id: number;
    verified_at: string | null;
    expires_at: string;
    disabled: boolean;
  }>(
    `SELECT c.user_id, c.verified_at, c.expires_at, u.disabled
     FROM password_reset_codes c
     JOIN users u ON u.id = c.user_id
     WHERE c.verify_token_hash = $1 AND c.used_at IS NULL`,
    [hashNonce(nonce)],
  );
  const row = rows[0];
  if (!row || row.disabled || !row.verified_at) return null;

  const now = Date.now();
  if (new Date(row.expires_at).getTime() <= now) return null;
  if (new Date(row.verified_at).getTime() + VERIFY_STATE_TTL_MS <= now) return null;

  return { userId: row.user_id };
}

export type ConsumeResetCodeState = "valid" | "invalid" | "expired";

export async function consumeVerifiedReset(
  nonce: string,
  passwordHash: string,
): Promise<ConsumeResetCodeState> {
  if (!VERIFY_NONCE_PATTERN.test(nonce)) return "invalid";
  const tokenHash = hashNonce(nonce);

  return withTransaction(async (client) => {
    const { rows } = await client.query<{
      id: number;
      user_id: number;
      verified_at: string | null;
      expires_at: string;
      used_at: string | null;
      disabled: boolean;
    }>(
      `SELECT c.id, c.user_id, c.verified_at, c.expires_at, c.used_at, u.disabled
       FROM password_reset_codes c
       JOIN users u ON u.id = c.user_id
       WHERE c.verify_token_hash = $1
       FOR UPDATE OF c`,
      [tokenHash],
    );
    const row = rows[0];
    if (!row || row.disabled || !row.verified_at) return "invalid";
    if (row.used_at) return "invalid";

    const now = Date.now();
    if (new Date(row.expires_at).getTime() <= now) return "expired";
    if (new Date(row.verified_at).getTime() + VERIFY_STATE_TTL_MS <= now) return "expired";

    const nowIso = new Date(now).toISOString();
    await client.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
      passwordHash,
      row.user_id,
    ]);
    await client.query(
      `UPDATE password_reset_codes
       SET used_at = $1, verify_token_hash = NULL
       WHERE id = $2`,
      [nowIso, row.id],
    );
    await client.query(
      "DELETE FROM password_reset_codes WHERE user_id = $1 AND id <> $2",
      [row.user_id, row.id],
    );
    // Every outstanding reset link for this account is invalidated as well.
    await client.query("DELETE FROM password_reset_tokens WHERE user_id = $1", [row.user_id]);

    return "valid";
  });
}
