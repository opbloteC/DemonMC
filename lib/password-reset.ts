import { randomBytes } from "node:crypto";
import { sha256 } from "./auth";
import { query, withTransaction } from "./db";

export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
export const RESET_TOKEN_TTL_MINUTES = RESET_TOKEN_TTL_MS / 60000;

const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

export type ResetTokenState = "valid" | "invalid" | "expired" | "used";

export interface ResetTokenInfo {
  state: ResetTokenState;
  userId?: number;
}

interface ResetTokenRow {
  user_id: number;
  expires_at: string;
  used_at: string | null;
  disabled: boolean;
}

export function isResetTokenFormat(token: unknown): token is string {
  return typeof token === "string" && TOKEN_PATTERN.test(token);
}

export async function createPasswordResetToken(userId: number, email: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + RESET_TOKEN_TTL_MS).toISOString();

  await withTransaction(async (client) => {
    await client.query(
      "DELETE FROM password_reset_tokens WHERE expires_at < $1",
      [createdAt],
    );
    // Only the newest link stays valid.
    await client.query(
      "DELETE FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL",
      [userId],
    );
    await client.query(
      `INSERT INTO password_reset_tokens (token_hash, user_id, requested_email, created_at, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [sha256(token), userId, email, createdAt, expiresAt],
    );
  });

  return token;
}

export async function deletePasswordResetToken(token: string): Promise<void> {
  await query("DELETE FROM password_reset_tokens WHERE token_hash = $1", [sha256(token)]);
}

export async function inspectPasswordResetToken(token: string): Promise<ResetTokenInfo> {
  if (!isResetTokenFormat(token)) return { state: "invalid" };

  const { rows } = await query<ResetTokenRow>(
    `SELECT rt.user_id, rt.expires_at, rt.used_at, u.disabled
     FROM password_reset_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1`,
    [sha256(token)],
  );
  const row = rows[0];
  if (!row || row.disabled) return { state: "invalid" };
  if (row.used_at) return { state: "used" };
  if (new Date(row.expires_at).getTime() <= Date.now()) return { state: "expired" };
  return { state: "valid", userId: row.user_id };
}

/**
 * Applies a new password hash if the token is valid, marking it used in the
 * same transaction so a link can never be redeemed twice.
 */
export async function consumePasswordResetToken(
  token: string,
  passwordHash: string,
): Promise<ResetTokenState> {
  if (!isResetTokenFormat(token)) return "invalid";
  const tokenHash = sha256(token);

  return withTransaction(async (client) => {
    const { rows } = await client.query<ResetTokenRow>(
      `SELECT rt.user_id, rt.expires_at, rt.used_at, u.disabled
       FROM password_reset_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1
       FOR UPDATE OF rt`,
      [tokenHash],
    );
    const row = rows[0];
    if (!row || row.disabled) return "invalid";
    if (row.used_at) return "used";
    if (new Date(row.expires_at).getTime() <= Date.now()) return "expired";

    const now = new Date().toISOString();
    await client.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
      passwordHash,
      row.user_id,
    ]);
    await client.query(
      "UPDATE password_reset_tokens SET used_at = $1 WHERE token_hash = $2",
      [now, tokenHash],
    );
    await client.query(
      "DELETE FROM password_reset_tokens WHERE user_id = $1 AND token_hash <> $2",
      [row.user_id, tokenHash],
    );

    return "valid";
  });
}
