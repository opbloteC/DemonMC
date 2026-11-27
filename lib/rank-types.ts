export const BADGE_STYLES = ["solid", "outline", "soft", "gradient", "glow"] as const;
export type BadgeStyle = (typeof BADGE_STYLES)[number];

export const BADGE_STYLE_LABELS: Record<BadgeStyle, string> = {
  solid: "Solid",
  outline: "Outline",
  soft: "Soft",
  gradient: "Gradient",
  glow: "Glow",
};

export interface RankInfo {
  id: number;
  key: string;
  name: string;
  color: string;
  textColor: string;
  bold: boolean;
  badgeStyle: BadgeStyle;
  displayOrder: number;
}

export interface RankRecord extends RankInfo {
  isSystem: boolean;
  deletedAt: string | null;
  playerCount: number;
  secondaryCount: number;
  permissions: Record<string, boolean>;
}

export type PermissionEffect = "allow" | "deny";

export interface PlayerPermissionOverride {
  permissionKey: string;
  effect: PermissionEffect;
}

export interface PermissionDefinition {
  key: string;
  label: string;
  description: string;
  category: string;
  categoryLabel: string;
  sortOrder: number;
}

export interface PermissionCategory {
  key: string;
  label: string;
  description: string;
  permissions: PermissionDefinition[];
}

export interface EffectivePermissionSource {
  key: string;
  allowed: boolean;
  reason: "owner" | "rank" | "allow" | "deny" | "none";
  label: string;
}

export interface RankPlayerRecord {
  id: number;
  username: string;
  loginUsername: string;
  avatarUrl: string | null;
  disabled: boolean;
  isOwner: boolean;
  rank: RankInfo;
  secondaryRank: RankInfo | null;
  overrides: PlayerPermissionOverride[];
  effectivePermissions: string[];
  permissionSources: EffectivePermissionSource[];
}

export const FALLBACK_RANK: RankInfo = {
  id: 0,
  key: "member",
  name: "Member",
  color: "#808080",
  textColor: "#ffffff",
  bold: true,
  badgeStyle: "solid",
  displayOrder: 9999,
};

export function isBadgeStyle(value: unknown): value is BadgeStyle {
  return typeof value === "string" && (BADGE_STYLES as readonly string[]).includes(value);
}
