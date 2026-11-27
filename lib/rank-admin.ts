import { invalidateSiteData } from "./cache";
import { query, withTransaction } from "./db";
import { PERMISSION_KEYS } from "./permission-registry";
import { resolvePermissionState } from "./permissions";
import {
  RANK_JOINS,
  RANK_SELECT,
  mapRankColumns,
  type RankColumns,
} from "./rank-query";
import { BADGE_STYLES, type BadgeStyle, type RankInfo, type RankRecord } from "./rank-types";
import { isOwnerAccount, normalizeRole, normalizeSpecialRank } from "./ranks";
import type { RankPlayer, SessionUser } from "./types";

const STAFF_RANK_KEYS = new Set(["owner", "manager", "developer", "mod", "staff", "helper"]);
const COSMETIC_RANK_KEYS = new Set(["demon", "deadliest", "vip", "hero", "media", "booster"]);

export class RankAdminError extends Error {
  status: number;

  constructor(message: string, status = 422) {
    super(message);
    this.name = "RankAdminError";
    this.status = status;
  }
}

interface RankRow {
  id: number;
  key: string;
  name: string;
  color: string;
  text_color: string;
  bold: boolean;
  badge_style: string;
  display_order: number;
  is_system: boolean;
  deleted_at: string | null;
  player_count: number;
  secondary_count: number;
}

interface PermissionRow {
  rank_id: number;
  permission_key: string;
  allowed: boolean;
}

interface PlayerStateRow extends RankColumns {
  id: number;
  username: string;
  login_username: string;
  role: string;
  special_rank: string | null;
  avatar_url: string | null;
  disabled: boolean;
}

const RANK_RECORD_SELECT = `
  r.id, r.key, r.name, r.color, r.text_color, r.bold, r.badge_style,
  r.display_order, r.is_system, r.deleted_at,
  (SELECT COUNT(*)::int FROM users u WHERE u.rank_id = r.id) AS player_count,
  (SELECT COUNT(*)::int FROM users u WHERE u.secondary_rank_id = r.id) AS secondary_count`;

function toRecord(row: RankRow, permissions: Record<string, boolean>): RankRecord {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    color: row.color,
    textColor: row.text_color,
    bold: Boolean(row.bold),
    badgeStyle: (BADGE_STYLES as readonly string[]).includes(row.badge_style)
      ? (row.badge_style as BadgeStyle)
      : "solid",
    displayOrder: row.display_order,
    isSystem: Boolean(row.is_system),
    deletedAt: row.deleted_at,
    playerCount: row.player_count,
    secondaryCount: row.secondary_count,
    permissions,
  };
}

async function permissionMap(): Promise<Map<number, Record<string, boolean>>> {
  const { rows } = await query<PermissionRow>(
    "SELECT rank_id, permission_key, allowed FROM rank_permissions",
  );
  const map = new Map<number, Record<string, boolean>>();
  for (const row of rows) {
    const bucket = map.get(row.rank_id) ?? {};
    bucket[row.permission_key] = Boolean(row.allowed);
    map.set(row.rank_id, bucket);
  }
  return map;
}

export async function listRankRecords(): Promise<RankRecord[]> {
  const [{ rows }, permissions] = await Promise.all([
    query<RankRow>(
      `SELECT ${RANK_RECORD_SELECT}
       FROM ranks r
       ORDER BY r.display_order ASC, lower(r.name) ASC, r.id ASC`,
    ),
    permissionMap(),
  ]);
  return rows.map((row) => toRecord(row, permissions.get(row.id) ?? {}));
}

export async function getRankRecord(id: number): Promise<RankRecord | null> {
  const { rows } = await query<RankRow>(
    `SELECT ${RANK_RECORD_SELECT} FROM ranks r WHERE r.id = $1`,
    [id],
  );
  const row = rows[0];
  if (!row) return null;
  const permissions = await permissionMap();
  return toRecord(row, permissions.get(row.id) ?? {});
}

export async function getActiveRank(id: number): Promise<RankRecord | null> {
  const rank = await getRankRecord(id);
  return rank && !rank.deletedAt ? rank : null;
}

export function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

export function isBadgeStyleValue(value: unknown): value is BadgeStyle {
  return typeof value === "string" && (BADGE_STYLES as readonly string[]).includes(value);
}

function slugifyRank(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
  return slug || "rank";
}

async function nextDisplayOrder(): Promise<number> {
  const { rows } = await query<{ next: number }>(
    "SELECT COALESCE(MAX(display_order), -1) + 1 AS next FROM ranks WHERE deleted_at IS NULL",
  );
  return rows[0]?.next ?? 0;
}

async function generateRankKey(name: string): Promise<string> {
  const base = slugifyRank(name);
  const { rows } = await query<{ key: string }>("SELECT key FROM ranks");
  const taken = new Set(rows.map((row) => row.key));
  if (!taken.has(base)) return base;
  for (let index = 2; index < 500; index += 1) {
    const candidate = `${base}_${index}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}_${Date.now().toString(36)}`;
}

async function ensureNameAvailable(name: string, excludeId = 0): Promise<void> {
  const { rows } = await query<{ id: number }>(
    `SELECT id FROM ranks
     WHERE lower(name) = lower($1) AND deleted_at IS NULL AND id <> $2
     LIMIT 1`,
    [name, excludeId],
  );
  if (rows[0]) throw new RankAdminError("Another rank already uses that name.", 409);
}

export interface RankVisualInput {
  name: string;
  color: string;
  textColor: string;
  bold: boolean;
  badgeStyle: BadgeStyle;
}

export async function createRank(input: RankVisualInput): Promise<RankRecord> {
  await ensureNameAvailable(input.name);
  const key = await generateRankKey(input.name);
  const order = await nextDisplayOrder();
  const now = new Date().toISOString();
  const { rows } = await query<{ id: number }>(
    `INSERT INTO ranks (
       key, name, color, text_color, bold, badge_style, display_order,
       is_system, deleted_at, created_at, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, NULL, $8, $9)
     RETURNING id`,
    [key, input.name, input.color, input.textColor, input.bold, input.badgeStyle, order, now, now],
  );
  const record = await getRankRecord(rows[0].id);
  if (!record) throw new RankAdminError("The rank could not be created.", 500);
  invalidateSiteData();
  return record;
}

export async function updateRank(
  id: number,
  input: Partial<RankVisualInput>,
): Promise<RankRecord> {
  const existing = await getRankRecord(id);
  if (!existing) throw new RankAdminError("Rank not found.", 404);
  if (existing.deletedAt) throw new RankAdminError("Restore this rank before editing it.", 409);

  const updates: string[] = [];
  const values: (string | boolean | number)[] = [];
  const add = (column: string, value: string | boolean | number) => {
    values.push(value);
    updates.push(`${column} = $${values.length}`);
  };

  if (input.name !== undefined && input.name !== existing.name) {
    if (existing.key === "owner") {
      throw new RankAdminError("The Owner rank cannot be renamed.", 403);
    }
    await ensureNameAvailable(input.name, id);
    add("name", input.name);
  }
  if (input.color !== undefined) add("color", input.color);
  if (input.textColor !== undefined) add("text_color", input.textColor);
  if (input.bold !== undefined) add("bold", input.bold);
  if (input.badgeStyle !== undefined) add("badge_style", input.badgeStyle);

  if (updates.length === 0) throw new RankAdminError("No changes provided.");

  add("updated_at", new Date().toISOString());
  await query(
    `UPDATE ranks SET ${updates.join(", ")} WHERE id = $${values.length + 1}`,
    [...values, id],
  );

  const record = await getRankRecord(id);
  if (!record) throw new RankAdminError("Rank not found.", 404);
  invalidateSiteData();
  return record;
}

export async function deleteRank(id: number): Promise<RankRecord> {
  const existing = await getRankRecord(id);
  if (!existing) throw new RankAdminError("Rank not found.", 404);
  if (existing.deletedAt) throw new RankAdminError("This rank is already deleted.", 409);
  if (existing.key === "owner") {
    throw new RankAdminError("The Owner rank cannot be deleted.", 403);
  }
  if (existing.playerCount > 0 || existing.secondaryCount > 0) {
    throw new RankAdminError(
      `Reassign the ${existing.playerCount + existing.secondaryCount} player(s) using this rank before deleting it.`,
      409,
    );
  }

  await query("UPDATE ranks SET deleted_at = $1, updated_at = $1 WHERE id = $2", [
    new Date().toISOString(),
    id,
  ]);
  const record = await getRankRecord(id);
  if (!record) throw new RankAdminError("Rank not found.", 404);
  invalidateSiteData();
  return record;
}

export async function restoreRank(id: number): Promise<RankRecord> {
  const existing = await getRankRecord(id);
  if (!existing) throw new RankAdminError("Rank not found.", 404);
  if (!existing.deletedAt) throw new RankAdminError("This rank is already active.", 409);
  await ensureNameAvailable(existing.name, id);
  const order = await nextDisplayOrder();
  await query(
    "UPDATE ranks SET deleted_at = NULL, display_order = $1, updated_at = $2 WHERE id = $3",
    [order, new Date().toISOString(), id],
  );
  const record = await getRankRecord(id);
  if (!record) throw new RankAdminError("Rank not found.", 404);
  invalidateSiteData();
  return record;
}

export async function reorderRanks(ids: number[]): Promise<RankRecord[]> {
  const active = await listRankRecords();
  const activeIds = active.filter((rank) => !rank.deletedAt).map((rank) => rank.id);
  if (ids.length !== activeIds.length || new Set(ids).size !== ids.length) {
    throw new RankAdminError("Send the full list of active ranks in their new order.", 422);
  }
  const activeSet = new Set(activeIds);
  if (ids.some((id) => !activeSet.has(id))) {
    throw new RankAdminError("The rank order contains an unknown rank.", 422);
  }

  const now = new Date().toISOString();
  await withTransaction(async (client) => {
    for (let index = 0; index < ids.length; index += 1) {
      await client.query(
        "UPDATE ranks SET display_order = $1, updated_at = $2 WHERE id = $3",
        [index, now, ids[index]],
      );
    }
  });
  invalidateSiteData();
  return listRankRecords();
}

export async function setRankPermissions(
  rankId: number,
  allowedKeys: string[],
): Promise<RankRecord> {
  const existing = await getRankRecord(rankId);
  if (!existing) throw new RankAdminError("Rank not found.", 404);
  if (existing.deletedAt) throw new RankAdminError("Restore this rank before editing it.", 409);
  if (existing.key === "owner") {
    throw new RankAdminError(
      "The Owner rank always has every permission and cannot be restricted.",
      403,
    );
  }

  const cleaned = [...new Set(allowedKeys)];
  if (cleaned.some((key) => !PERMISSION_KEYS.includes(key))) {
    throw new RankAdminError("Unknown permission key.", 422);
  }

  await withTransaction(async (client) => {
    await client.query("DELETE FROM rank_permissions WHERE rank_id = $1", [rankId]);
    for (const key of cleaned) {
      await client.query(
        "INSERT INTO rank_permissions (rank_id, permission_key, allowed) VALUES ($1, $2, TRUE)",
        [rankId, key],
      );
    }
  });

  const record = await getRankRecord(rankId);
  if (!record) throw new RankAdminError("Rank not found.", 404);
  return record;
}

function mirrorLegacyColumns(rank: RankInfo, secondary: RankInfo | null): {
  role: string;
  specialRank: string | null;
} {
  if (STAFF_RANK_KEYS.has(rank.key)) {
    return {
      role: rank.key,
      specialRank: secondary && COSMETIC_RANK_KEYS.has(secondary.key) ? secondary.key : null,
    };
  }
  if (COSMETIC_RANK_KEYS.has(rank.key)) {
    return { role: "player", specialRank: rank.key };
  }
  return { role: "player", specialRank: null };
}

async function loadPlayerState(
  row: PlayerStateRow,
  permissions: Map<number, Record<string, boolean>>,
  overrides: Map<number, { permissionKey: string; effect: "allow" | "deny" }[]>,
): Promise<RankPlayer> {
  const { rank, secondaryRank } = mapRankColumns(row);
  const owner = isOwnerAccount({ username: row.login_username });
  const state = resolvePermissionState(
    owner,
    rank.name,
    permissions.get(rank.id) ?? {},
    overrides.get(row.id) ?? [],
  );
  return {
    id: row.id,
    username: row.username,
    loginUsername: row.login_username,
    role: normalizeRole(row.role),
    specialRank: normalizeSpecialRank(row.special_rank),
    rank,
    secondaryRank,
    avatarUrl: row.avatar_url,
    disabled: Boolean(row.disabled),
    isOwner: owner,
    overrides: state.overrides,
    effectivePermissions: state.effectivePermissions,
    permissionSources: state.permissionSources,
  };
}

async function loadAllStates(): Promise<{
  rows: PlayerStateRow[];
  permissions: Map<number, Record<string, boolean>>;
  overrides: Map<number, { permissionKey: string; effect: "allow" | "deny" }[]>;
}> {
  const [players, permissions, overrideRows] = await Promise.all([
    query<PlayerStateRow>(
      `SELECT u.id, COALESCE(u.minecraft_username, u.username) AS username,
              u.username AS login_username, u.role, u.special_rank, u.avatar_url, u.disabled,
              ${RANK_SELECT}
       FROM users u
       ${RANK_JOINS}
       ORDER BY r.display_order ASC NULLS LAST, lower(r.name) ASC NULLS LAST, lower(u.username)`,
    ),
    permissionMap(),
    query<{ user_id: number; permission_key: string; effect: "allow" | "deny" }>(
      "SELECT user_id, permission_key, effect FROM player_permissions",
    ),
  ]);

  const overrides = new Map<number, { permissionKey: string; effect: "allow" | "deny" }[]>();
  for (const row of overrideRows.rows) {
    if (row.effect !== "allow" && row.effect !== "deny") continue;
    const bucket = overrides.get(row.user_id) ?? [];
    bucket.push({ permissionKey: row.permission_key, effect: row.effect });
    overrides.set(row.user_id, bucket);
  }

  return { rows: players.rows, permissions, overrides };
}

export async function listPlayersWithPermissions(): Promise<RankPlayer[]> {
  const { rows, permissions, overrides } = await loadAllStates();
  return Promise.all(rows.map((row) => loadPlayerState(row, permissions, overrides)));
}

export async function getPlayerWithPermissions(userId: number): Promise<RankPlayer | null> {
  const { rows } = await query<PlayerStateRow>(
    `SELECT u.id, COALESCE(u.minecraft_username, u.username) AS username,
            u.username AS login_username, u.role, u.special_rank, u.avatar_url, u.disabled,
            ${RANK_SELECT}
     FROM users u
     ${RANK_JOINS}
     WHERE u.id = $1`,
    [userId],
  );
  const row = rows[0];
  if (!row) return null;
  const permissions = await permissionMap();
  const overrideRows = await query<{
    user_id: number;
    permission_key: string;
    effect: "allow" | "deny";
  }>("SELECT user_id, permission_key, effect FROM player_permissions WHERE user_id = $1", [
    userId,
  ]);
  const overrides = new Map<
    number,
    { permissionKey: string; effect: "allow" | "deny" }[]
  >();
  overrides.set(
    userId,
    overrideRows.rows
      .filter((item) => item.effect === "allow" || item.effect === "deny")
      .map((item) => ({ permissionKey: item.permission_key, effect: item.effect })),
  );
  return loadPlayerState(row, permissions, overrides);
}

export async function assignPlayerRank(
  userId: number,
  rankId: number,
  secondaryRankId: number | null,
): Promise<RankPlayer> {
  const player = await getPlayerWithPermissions(userId);
  if (!player) throw new RankAdminError("Player not found.", 404);
  if (player.isOwner) {
    throw new RankAdminError("The owner account's rank is protected and cannot be changed.", 403);
  }

  const rank = await getActiveRank(rankId);
  if (!rank) throw new RankAdminError("Choose an active rank.", 422);
  if (rank.key === "owner") {
    throw new RankAdminError("The Owner rank cannot be assigned.", 403);
  }

  let secondary: RankRecord | null = null;
  if (secondaryRankId !== null) {
    secondary = await getActiveRank(secondaryRankId);
    if (!secondary) throw new RankAdminError("Choose an active secondary rank.", 422);
    if (secondary.key === "owner") {
      throw new RankAdminError("The Owner rank cannot be assigned.", 403);
    }
    if (secondary.id === rank.id) {
      throw new RankAdminError("The secondary rank must be different from the primary rank.", 422);
    }
  }

  const legacy = mirrorLegacyColumns(rank, secondary);
  await query(
    `UPDATE users
     SET rank_id = $1, secondary_rank_id = $2, role = $3, special_rank = $4
     WHERE id = $5`,
    [rank.id, secondary?.id ?? null, legacy.role, legacy.specialRank, userId],
  );
  invalidateSiteData();

  const updated = await getPlayerWithPermissions(userId);
  if (!updated) throw new RankAdminError("Player not found.", 404);
  return updated;
}

export async function setPlayerPermission(
  userId: number,
  permissionKey: string,
  effect: "allow" | "deny" | "inherit",
): Promise<RankPlayer> {
  const player = await getPlayerWithPermissions(userId);
  if (!player) throw new RankAdminError("Player not found.", 404);
  if (player.isOwner) {
    throw new RankAdminError(
      "The owner account always has full access; individual permissions cannot be changed.",
      403,
    );
  }
  if (!PERMISSION_KEYS.includes(permissionKey)) {
    throw new RankAdminError("Unknown permission key.", 422);
  }

  if (effect === "inherit") {
    await query(
      "DELETE FROM player_permissions WHERE user_id = $1 AND permission_key = $2",
      [userId, permissionKey],
    );
  } else {
    await query(
      `INSERT INTO player_permissions (user_id, permission_key, effect, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, permission_key)
       DO UPDATE SET effect = excluded.effect, updated_at = excluded.updated_at`,
      [userId, permissionKey, effect, new Date().toISOString()],
    );
  }

  const updated = await getPlayerWithPermissions(userId);
  if (!updated) throw new RankAdminError("Player not found.", 404);
  return updated;
}

export async function recordAudit(
  actor: SessionUser,
  action: string,
  details: string,
  target?: { id: number; username: string } | null,
): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_log (
         actor_user_id, actor_username, target_user_id, target_username,
         action, details, created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        actor.id,
        actor.username,
        target?.id ?? null,
        target?.username ?? null,
        action,
        details,
        new Date().toISOString(),
      ],
    );
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}

export interface AuditEntry {
  id: number;
  actorUsername: string;
  targetUsername: string | null;
  action: string;
  details: string;
  createdAt: string;
}

export async function listAuditEntries(limit = 40): Promise<AuditEntry[]> {
  const { rows } = await query<{
    id: number;
    actor_username: string;
    target_username: string | null;
    action: string;
    details: string;
    created_at: string;
  }>(
    `SELECT id, actor_username, target_username, action, details, created_at
     FROM audit_log
     ORDER BY created_at DESC, id DESC
     LIMIT $1`,
    [limit],
  );
  return rows.map((row) => ({
    id: row.id,
    actorUsername: row.actor_username,
    targetUsername: row.target_username,
    action: row.action,
    details: row.details,
    createdAt: row.created_at,
  }));
}
