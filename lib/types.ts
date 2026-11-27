import type { Role, SpecialRank } from "./ranks";
import type {
  BadgeStyle,
  EffectivePermissionSource,
  PermissionDefinition,
  PermissionEffect,
  PlayerPermissionOverride,
  RankInfo,
  RankRecord,
} from "./rank-types";

export {
  ROLES,
  STAFF_ROLES,
  SPECIAL_RANKS,
  RANK_KEYS,
  RANK_META,
  STATIC_RANK_INFO,
  ASSIGNABLE_STAFF_ROLES,
  ROLE_LABELS,
  OWNER_LOGIN,
  canAccessStaffPanel,
  canAssignRole,
  canManageAccounts,
  canManageRole,
  isOwnerAccount,
  isRole,
  isRankKey,
  isSpecialRank,
  isStaffRole,
  normalizeRole,
  normalizeSpecialRank,
  primaryRank,
  rankInfoFromKey,
  rankPosition,
  secondaryRank,
} from "./ranks";
export type { RankKey, RankMeta, Role, StaffRole } from "./ranks";
export type {
  BadgeStyle,
  EffectivePermissionSource,
  PermissionDefinition,
  PermissionEffect,
  PlayerPermissionOverride,
  RankInfo,
  RankRecord,
};

export function userCan(
  user: { username: string; permissions: readonly string[] },
  permission: string,
): boolean {
  return (
    user.username.trim().toLowerCase() === "opblote" ||
    user.permissions.includes(permission)
  );
}

export const PLAYER_CATEGORIES = [
  "owner",
  "manager",
  "developer",
  "mod",
  "staff",
  "helper",
  "hero",
  "vip",
  "deadliest",
  "demon",
  "media",
  "booster",
  "member",
] as const;
export type PlayerCategory = (typeof PLAYER_CATEGORIES)[number];

export const PLAYER_CATEGORY_LABELS: Record<PlayerCategory, string> = {
  owner: "Owner",
  manager: "Manager",
  developer: "Developer",
  mod: "Mod",
  staff: "Staff",
  helper: "Helper",
  hero: "Hero",
  vip: "VIP",
  deadliest: "Deadliest",
  demon: "Demon",
  media: "Media",
  booster: "Booster",
  member: "Member",
};

export interface SessionUser {
  id: number;
  username: string;
  minecraftUsername: string | null;
  email: string | null;
  role: Role;
  specialRank: SpecialRank | null;
  rank: RankInfo;
  secondaryRank: RankInfo | null;
  permissions: string[];
  description: string;
  avatarUrl: string | null;
  joinedAt: string;
}

export interface StaffMember {
  id: number;
  username: string;
  role: Role;
  rank: RankInfo;
  secondaryRank: RankInfo | null;
  description: string;
  avatarUrl: string | null;
  joinedAt: string;
}

export interface Account {
  id: number;
  username: string;
  role: Role;
  specialRank: SpecialRank | null;
  rank: RankInfo;
  secondaryRank: RankInfo | null;
  disabled: boolean;
  description: string;
  avatarUrl: string | null;
  joinedAt: string;
  createdAt: string;
}

export interface PlayerProfile {
  id: number;
  username: string;
  category: PlayerCategory;
  rankLabel: string;
  description: string;
  avatarUrl: string | null;
  joinedAt: string;
}

export interface RankPlayer {
  id: number;
  username: string;
  loginUsername: string;
  role: Role;
  specialRank: SpecialRank | null;
  rank: RankInfo;
  secondaryRank: RankInfo | null;
  avatarUrl: string | null;
  disabled: boolean;
  isOwner: boolean;
  overrides: PlayerPermissionOverride[];
  effectivePermissions: string[];
  permissionSources: EffectivePermissionSource[];
}

export interface AnnouncementAuthor {
  id: number;
  username: string;
  minecraftUsername: string | null;
  minecraftUuid: string | null;
  avatarUrl: string | null;
  rank: RankInfo;
}

export interface Announcement {
  id: number;
  title: string;
  body: string;
  pinned: boolean;
  published: boolean;
  createdAt: string;
  updatedAt: string;
  author: AnnouncementAuthor | null;
}

export interface SiteSettings {
  headline: string;
  subtitle: string;
  ip: string;
  discord: string;
}

export interface ServerStatus {
  reachable: boolean;
  online: boolean;
  players: { online: number; max: number; names?: string[] } | null;
  version: string | null;
  checkedAt: string;
  /** Public status shown on the site. Online/offline/maintenance are owner-controlled. */
  status?: PublicServerStatus;
  /** Optional maintenance note, only shown while the status is maintenance. */
  message?: string;
  source?: "owner" | "auto";
}

export const OWNER_SERVER_STATUSES = ["online", "offline", "maintenance"] as const;
export type OwnerServerStatus = (typeof OWNER_SERVER_STATUSES)[number];
export type PublicServerStatus = OwnerServerStatus | "unknown";

export const MAX_STATUS_MESSAGE = 160;
