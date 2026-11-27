import { NextResponse } from "next/server";
import { jsonError, mutationGuard, readJson, requirePermission } from "@/lib/api";
import { invalidateSiteData } from "@/lib/cache";
import { isUniqueViolation, query } from "@/lib/db";
import { resolveMinecraftProfile } from "@/lib/minecraft";
import { RANK_JOINS, RANK_SELECT, mapRankColumns, type RankColumns } from "@/lib/rank-query";
import { recordAudit } from "@/lib/rank-admin";
import { isOwnerAccount, normalizeRole, normalizeSpecialRank, type Role } from "@/lib/ranks";
import { isMinecraftUsername } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface UsernameRow extends RankColumns {
  id: number;
  username: string;
  minecraft_username: string | null;
  minecraft_uuid: string | null;
  email: string | null;
  role: Role;
  special_rank: string | null;
  avatar_url: string | null;
  disabled: boolean;
}

const USERNAME_SELECT = `
  u.id, u.username, u.minecraft_username, u.minecraft_uuid, u.email, u.role, u.special_rank,
  u.avatar_url, u.disabled, ${RANK_SELECT}
  FROM users u
  ${RANK_JOINS}`;

function mapPlayer(row: UsernameRow) {
  const { rank, secondaryRank } = mapRankColumns(row);
  return {
    id: row.id,
    loginUsername: row.username,
    username: row.minecraft_username,
    uuid: row.minecraft_uuid,
    email: row.email,
    role: normalizeRole(row.role),
    specialRank: normalizeSpecialRank(row.special_rank),
    rank,
    secondaryRank,
    avatarUrl: row.avatar_url,
    disabled: Boolean(row.disabled),
    isOwner: isOwnerAccount({ username: row.username }),
  };
}

export async function GET() {
  const auth = await requirePermission("players.usernames.change");
  if (auth.response) return auth.response;

  const { rows } = await query<UsernameRow>(
    `SELECT ${USERNAME_SELECT}
     ORDER BY r.display_order ASC NULLS LAST, lower(u.username)`,
  );

  return NextResponse.json(
    { players: rows.map(mapPlayer) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(req: Request) {
  const auth = await requirePermission("players.usernames.change");
  if (auth.response) return auth.response;

  const guard = mutationGuard(req);
  if (guard) return guard;

  const body = await readJson(req);
  if (!body) return jsonError("Invalid request body.");

  const userId = Number(body.userId);
  if (!Number.isInteger(userId) || userId <= 0) return jsonError("Choose a player account.", 422);

  const username = typeof body.username === "string" ? body.username.trim() : "";
  if (!isMinecraftUsername(username)) {
    return jsonError(
      "Minecraft usernames must be 3–16 characters using letters, numbers or underscores.",
      422,
    );
  }

  const { rows } = await query<UsernameRow>(
    `SELECT ${USERNAME_SELECT} WHERE u.id = $1`,
    [userId],
  );
  const target = rows[0];
  if (!target) return jsonError("Player account not found.", 404);

  if (isOwnerAccount(target)) {
    return jsonError("The owner account is protected. Its Minecraft username cannot be changed.", 403);
  }

  if (target.minecraft_username && target.minecraft_username.toLowerCase() === username.toLowerCase()) {
    return jsonError("That player already uses this Minecraft username.", 422);
  }

  const taken = await query<{ id: number }>(
    `SELECT id FROM users
     WHERE id <> $1
       AND (
         lower(minecraft_username) = lower($2)
         OR (minecraft_username IS NULL AND lower(username) = lower($2))
       )
     LIMIT 1`,
    [userId, username],
  );
  if (taken.rows[0]) {
    return jsonError("That Minecraft username is already linked to another account.", 409);
  }

  let profile;
  try {
    profile = await resolveMinecraftProfile(username);
  } catch {
    profile = null;
  }

  if (!profile) {
    return jsonError(
      "Could not verify this Minecraft username with the Mojang profile service. Nothing was changed — check the name and try again.",
      422,
    );
  }

  if (profile.name.toLowerCase() !== username.toLowerCase()) {
    return jsonError(
      "The Minecraft profile service returned a different name. Nothing was changed.",
      422,
    );
  }

  const canonical = profile.name;
  if (canonical.toLowerCase() !== username.toLowerCase()) {
    return jsonError("That username is not a valid Minecraft profile name.", 422);
  }

  const canonicalTaken = await query<{ id: number }>(
    `SELECT id FROM users
     WHERE id <> $1 AND lower(minecraft_username) = lower($2)
     LIMIT 1`,
    [userId, canonical],
  );
  if (canonicalTaken.rows[0]) {
    return jsonError("That Minecraft username is already linked to another account.", 409);
  }

  try {
    await query(
      "UPDATE users SET minecraft_username = $1, minecraft_uuid = $2 WHERE id = $3",
      [canonical, profile.uuid, userId],
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      return jsonError("That Minecraft username is already linked to another account.", 409);
    }
    console.error("Failed to update Minecraft username:", error);
    return jsonError("Could not update the Minecraft username.", 500);
  }

  invalidateSiteData();

  const updated = await query<UsernameRow>(
    `SELECT ${USERNAME_SELECT} WHERE u.id = $1`,
    [userId],
  );

  await recordAudit(
    auth.user,
    "account.username",
    `Changed Minecraft username from ${target.minecraft_username ?? "(none)"} to ${canonical}.`,
    { id: userId, username: target.username },
  );

  return NextResponse.json(
    {
      player: mapPlayer(updated.rows[0]),
      previous: target.minecraft_username,
      uuidSource: "mojang",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
