import { cookies } from "next/headers";
import { cache } from "react";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { query } from "./db";
import { getPermissionState } from "./permissions";
import { RANK_JOINS, RANK_SELECT, mapRankColumns, type RankColumns } from "./rank-query";
import { isOwnerAccount, normalizeRole, normalizeSpecialRank } from "./ranks";
import type { Role, SessionUser } from "./types";

const COOKIE_NAME = "demonmc_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const BCRYPT_ROUNDS = 12;

interface UserRow extends RankColumns {
  id: number;
  username: string;
  minecraft_username: string | null;
  email: string | null;
  password_hash: string;
  role: Role;
  special_rank: string | null;
  description: string;
  avatar_url: string | null;
  joined_at: string;
  disabled: boolean;
}

async function toSessionUser(row: UserRow): Promise<SessionUser> {
  const { rank, secondaryRank } = mapRankColumns(row);
  const owner = isOwnerAccount({ username: row.username });
  const state = await getPermissionState(row.id, rank.id || null, rank.name, owner);

  return {
    id: row.id,
    username: row.username,
    minecraftUsername: row.minecraft_username,
    email: row.email,
    role: normalizeRole(row.role),
    specialRank: normalizeSpecialRank(row.special_rank),
    rank,
    secondaryRank,
    permissions: state.effectivePermissions,
    description: row.description,
    avatarUrl: row.avatar_url,
    joinedAt: row.joined_at,
  };
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

let dummyHash: string | null = null;

export async function authenticate(
  username: string,
  email: string,
  password: string,
): Promise<SessionUser | null> {
  const { rows } = await query<UserRow>(
    `SELECT u.id, u.username, u.minecraft_username, u.email, u.password_hash, u.role,
            u.special_rank, u.description, u.avatar_url, u.joined_at, u.disabled,
            ${RANK_SELECT}
     FROM users u
     ${RANK_JOINS}
     WHERE (lower(u.username) = lower($1) OR lower(u.minecraft_username) = lower($1))
       AND lower(u.email) = lower($2)
     LIMIT 1`,
    [username, email],
  );
  const row = rows[0];

  if (!row) {
    // Equalize timing so accounts cannot be enumerated.
    dummyHash ??= bcrypt.hashSync("demonmc-invalid-account", 10);
    await bcrypt.compare(password, dummyHash);
    return null;
  }

  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid || row.disabled) return null;

  return toSessionUser(row);
}

export async function createSession(userId: number): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  const createdAt = new Date(now).toISOString();
  const expiresAt = new Date(now + SESSION_TTL_MS).toISOString();

  await query("DELETE FROM sessions WHERE expires_at < $1", [createdAt]);
  await query(
    "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES ($1, $2, $3, $4)",
    [sha256(token), userId, createdAt, expiresAt],
  );

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export async function revokeUserSessions(userId: number): Promise<void> {
  await query("DELETE FROM sessions WHERE user_id = $1", [userId]);
}

export async function revokeOtherSessions(userId: number): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) {
    await query("DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2", [
      userId,
      sha256(token),
    ]);
  } else {
    await query("DELETE FROM sessions WHERE user_id = $1", [userId]);
  }
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) {
    await query("DELETE FROM sessions WHERE token_hash = $1", [sha256(token)]);
  }
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const { rows } = await query<UserRow & { expires_at: string }>(
    `SELECT u.id, u.username, u.minecraft_username, u.email, u.role, u.special_rank, u.description, u.avatar_url,
            u.joined_at, u.disabled, s.expires_at,
            ${RANK_SELECT}
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     ${RANK_JOINS}
     WHERE s.token_hash = $1`,
    [sha256(token)],
  );
  const row = rows[0];

  if (!row) return null;

  if (row.disabled) {
    await query("DELETE FROM sessions WHERE user_id = $1", [row.id]);
    return null;
  }

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await query("DELETE FROM sessions WHERE token_hash = $1", [sha256(token)]);
    return null;
  }

  return toSessionUser(row);
});
