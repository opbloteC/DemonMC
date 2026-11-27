import { query } from "./db";
import { PERMISSION_KEYS, PERMISSION_MAP } from "./permission-registry";
import type {
  EffectivePermissionSource,
  PermissionEffect,
  PlayerPermissionOverride,
} from "./rank-types";

export interface PermissionState {
  rankPermissions: Record<string, boolean>;
  overrides: PlayerPermissionOverride[];
  effectivePermissions: string[];
  permissionSources: EffectivePermissionSource[];
}

export function isOwnerUsername(username: string): boolean {
  return username.trim().toLowerCase() === "opblote";
}

export async function getRankPermissions(rankId: number | null): Promise<Record<string, boolean>> {
  if (!rankId) return {};
  const { rows } = await query<{ permission_key: string; allowed: boolean }>(
    "SELECT permission_key, allowed FROM rank_permissions WHERE rank_id = $1",
    [rankId],
  );
  return Object.fromEntries(rows.map((row) => [row.permission_key, Boolean(row.allowed)]));
}

export async function getPlayerOverrides(userId: number): Promise<PlayerPermissionOverride[]> {
  const { rows } = await query<{ permission_key: string; effect: PermissionEffect }>(
    "SELECT permission_key, effect FROM player_permissions WHERE user_id = $1",
    [userId],
  );
  return rows
    .filter((row) => row.effect === "allow" || row.effect === "deny")
    .map((row) => ({ permissionKey: row.permission_key, effect: row.effect }));
}

export function resolvePermissionState(
  owner: boolean,
  rankName: string,
  rankPermissions: Record<string, boolean>,
  overrides: PlayerPermissionOverride[],
): PermissionState {
  const overrideMap = new Map(overrides.map((override) => [override.permissionKey, override.effect]));
  const sources: EffectivePermissionSource[] = [];
  const effective = new Set<string>();

  for (const key of PERMISSION_KEYS) {
    const definition = PERMISSION_MAP.get(key);
    const label = definition?.label ?? key;
    const override = overrideMap.get(key);
    const inherited = Boolean(rankPermissions[key]);

    if (owner) {
      effective.add(key);
      sources.push({ key, allowed: true, reason: "owner", label: "Owner account — full access" });
      continue;
    }

    if (override === "deny") {
      sources.push({ key, allowed: false, reason: "deny", label: "Denied for this player" });
      continue;
    }

    if (override === "allow") {
      effective.add(key);
      sources.push({
        key,
        allowed: true,
        reason: "allow",
        label: inherited
          ? `Individual allow · also granted by ${rankName}`
          : "Individual allow",
      });
      continue;
    }

    if (inherited) {
      effective.add(key);
      sources.push({ key, allowed: true, reason: "rank", label: `Rank — ${rankName}` });
      continue;
    }

    sources.push({ key, allowed: false, reason: "none", label: "Not granted" });
  }

  return {
    rankPermissions,
    overrides,
    effectivePermissions: [...effective],
    permissionSources: sources,
  };
}

export async function getPermissionState(
  userId: number,
  rankId: number | null,
  rankName: string,
  owner: boolean,
): Promise<PermissionState> {
  if (owner) return resolvePermissionState(true, rankName, {}, []);
  const [rankPermissions, overrides] = await Promise.all([
    getRankPermissions(rankId),
    getPlayerOverrides(userId),
  ]);
  return resolvePermissionState(false, rankName, rankPermissions, overrides);
}

export function hasPermission(
  permissions: readonly string[],
  key: string,
): boolean {
  return permissions.includes(key);
}
