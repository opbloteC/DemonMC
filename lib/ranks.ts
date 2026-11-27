import { DEFAULT_RANK_SEEDS } from "./rank-defaults";
import type { RankInfo } from "./rank-types";

export const ROLES = ["owner", "manager", "developer", "mod", "staff", "helper", "player"] as const;
export type Role = (typeof ROLES)[number];

export const STAFF_ROLES = ["owner", "manager", "developer", "mod", "staff", "helper"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const SPECIAL_RANKS = ["demon", "deadliest", "vip", "hero", "media", "booster"] as const;
export type SpecialRank = (typeof SPECIAL_RANKS)[number];

/** The complete 13-rank ladder, highest first. */
export const RANK_KEYS = [
  "owner",
  "manager",
  "developer",
  "mod",
  "staff",
  "helper",
  "demon",
  "deadliest",
  "vip",
  "hero",
  "media",
  "booster",
  "member",
] as const;
export type RankKey = (typeof RANK_KEYS)[number];

/** Staff roles the owner can appoint from Rank management. Owner is protected. */
export const ASSIGNABLE_STAFF_ROLES = ["manager", "developer", "mod", "staff", "helper"] as const;

export interface RankMeta {
  label: string;
  color: string;
  border: string;
  text: string;
}

export const RANK_META: Record<RankKey, RankMeta> = {
  owner: { label: "Owner", color: "#FF0000", border: "#b00000", text: "#ffffff" },
  manager: { label: "Manager", color: "#C2185B", border: "#8b1142", text: "#ffffff" },
  developer: { label: "Developer", color: "#9C27B0", border: "#6f1c7d", text: "#ffffff" },
  mod: { label: "Mod", color: "#2196F3", border: "#166fb5", text: "#ffffff" },
  staff: { label: "Staff", color: "#2196F3", border: "#166fb5", text: "#ffffff" },
  helper: { label: "Helper", color: "#7CFC00", border: "#57b400", text: "#0a2239" },
  hero: { label: "Hero", color: "#FFD700", border: "#c7a600", text: "#0a2239" },
  vip: { label: "VIP", color: "#00FF00", border: "#00b800", text: "#0a2239" },
  deadliest: { label: "Deadliest", color: "#00FFFF", border: "#00b3b3", text: "#0a2239" },
  demon: { label: "Demon", color: "#7a2bff", border: "#ff2bd6", text: "#0a2239" },
  media: { label: "Media", color: "#FF69B4", border: "#c74c8b", text: "#0a2239" },
  booster: { label: "Booster", color: "#FF1493", border: "#c2006e", text: "#ffffff" },
  member: { label: "Member", color: "#808080", border: "#5c5c5c", text: "#ffffff" },
};

/** Static fallbacks used for legacy profile categories and pre-migration data. */
export const STATIC_RANK_INFO: Record<string, RankInfo> = Object.fromEntries(
  DEFAULT_RANK_SEEDS.map((rank) => [
    rank.key,
    {
      id: rank.displayOrder + 1,
      key: rank.key,
      name: rank.name,
      color: rank.color,
      textColor: rank.textColor,
      bold: rank.bold,
      badgeStyle: rank.badgeStyle,
      displayOrder: rank.displayOrder,
    },
  ]),
);

export function rankInfoFromKey(key: string): RankInfo {
  return (
    STATIC_RANK_INFO[key] ?? {
      id: 0,
      key,
      name: key.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
      color: "#808080",
      textColor: "#ffffff",
      bold: true,
      badgeStyle: "solid",
      displayOrder: 999,
    }
  );
}

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  manager: "Manager",
  developer: "Developer",
  mod: "Mod",
  staff: "Staff",
  helper: "Helper",
  player: "Player",
};

const RANK_POSITION: Record<RankKey, number> = Object.fromEntries(
  RANK_KEYS.map((key, index) => [key, index]),
) as Record<RankKey, number>;

export const ROLE_POSITION: Record<Role, number> = {
  owner: 6,
  manager: 5,
  developer: 4,
  mod: 3,
  staff: 2,
  helper: 1,
  player: 0,
};

export function isRankKey(value: unknown): value is RankKey {
  return typeof value === "string" && (RANK_KEYS as readonly string[]).includes(value);
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function isStaffRole(role: Role): role is StaffRole {
  return role !== "player";
}

export function isSpecialRank(value: unknown): value is SpecialRank {
  return typeof value === "string" && (SPECIAL_RANKS as readonly string[]).includes(value);
}

/** Legacy role values from earlier data sets are folded into the new hierarchy. */
export function normalizeRole(value: unknown): Role {
  if (value === "admin") return "manager";
  if (value === "moderator") return "mod";
  return isRole(value) ? value : "player";
}

export function normalizeSpecialRank(value: unknown): SpecialRank | null {
  return isSpecialRank(value) ? value : null;
}

/**
 * Staff roles always outrank cosmetic ranks, so a member with both shows their
 * staff role as the primary rank.
 */
export function primaryRank(role: Role, specialRank: SpecialRank | null): RankKey {
  if (role !== "player") return role;
  return specialRank ?? "member";
}

/** Secondary cosmetic rank, only when a staff member also holds one. */
export function secondaryRank(role: Role, specialRank: SpecialRank | null): SpecialRank | null {
  return role !== "player" && specialRank ? specialRank : null;
}

export function rankPosition(key: RankKey): number {
  return RANK_POSITION[key];
}

export function canManageAccounts(role: Role): boolean {
  return role === "owner" || role === "manager";
}

/**
 * Staff Panel (/admin) access. Cosmetic and paid ranks never grant permission;
 * only the three senior staff roles can open the panel.
 */
export function canAccessStaffPanel(role: Role): boolean {
  return role === "owner" || role === "manager" || role === "developer";
}

export function canManageRole(actorRole: Role, targetRole: Role): boolean {
  if (targetRole === "owner") return false;
  if (actorRole === "owner") return true;
  return actorRole === "manager" && ROLE_POSITION[targetRole] < ROLE_POSITION.manager;
}

export function canAssignRole(actorRole: Role, role: Role): boolean {
  if (role === "owner") return false;
  if (actorRole === "owner") return true;
  return actorRole === "manager" && ROLE_POSITION[role] < ROLE_POSITION.manager;
}

export const OWNER_LOGIN = "opblote";

export function isOwnerAccount(user: { username: string }): boolean {
  return user.username.trim().toLowerCase() === OWNER_LOGIN;
}
