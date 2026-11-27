import { PERMISSION_KEYS } from "./permission-registry";
import type { BadgeStyle } from "./rank-types";

export const OWNER_RANK_KEY = "owner";
export const MEMBER_RANK_KEY = "member";
export const POWER_RANK_KEY = "power";

interface RankSeed {
  key: string;
  name: string;
  color: string;
  textColor: string;
  bold: boolean;
  badgeStyle: BadgeStyle;
  displayOrder: number;
  defaultPermissions: readonly string[];
}

const MANAGER_PERMISSIONS = [
  "staff_panel.access",
  "staff_workspace.access",
  "staff.dashboard.view",
  "staff.info.view",
  "staff.tools.manage",
  "announcements.view",
  "announcements.create",
  "announcements.edit",
  "announcements.delete",
  "announcements.publish",
  "announcements.pin",
  "players.view",
  "players.edit",
  "profiles.manage",
  "accounts.view",
  "accounts.manage",
  "website.access",
  "website.settings.view",
  "website.settings.edit",
  "website.announcements.manage",
  "moderation.view",
  "reports.manage",
  "moderation.actions",
  "applications.manage",
] as const;

const DEVELOPER_PERMISSIONS = [
  "staff_panel.access",
  "staff_workspace.access",
  "staff.dashboard.view",
  "staff.info.view",
  "staff.tools.manage",
  "announcements.view",
  "players.view",
  "accounts.view",
  "website.access",
  "website.settings.view",
  "moderation.view",
  "applications.manage",
] as const;

const MODERATOR_PERMISSIONS = [
  "staff_workspace.access",
  "staff.dashboard.view",
  "staff.info.view",
  "announcements.view",
  "players.view",
  "moderation.view",
  "reports.manage",
] as const;

const ENTRY_STAFF_PERMISSIONS = [
  "staff_workspace.access",
  "announcements.view",
  "players.view",
  "moderation.view",
] as const;

export const DEFAULT_RANK_SEEDS: RankSeed[] = [
  {
    key: OWNER_RANK_KEY,
    name: "Owner",
    color: "#FF0000",
    textColor: "#ffffff",
    bold: true,
    badgeStyle: "solid",
    displayOrder: 0,
    defaultPermissions: PERMISSION_KEYS,
  },
  {
    key: "manager",
    name: "Manager",
    color: "#C2185B",
    textColor: "#ffffff",
    bold: true,
    badgeStyle: "solid",
    displayOrder: 1,
    defaultPermissions: MANAGER_PERMISSIONS,
  },
  {
    key: "developer",
    name: "Developer",
    color: "#9C27B0",
    textColor: "#ffffff",
    bold: true,
    badgeStyle: "solid",
    displayOrder: 2,
    defaultPermissions: DEVELOPER_PERMISSIONS,
  },
  {
    key: "mod",
    name: "Mod",
    color: "#2196F3",
    textColor: "#ffffff",
    bold: true,
    badgeStyle: "solid",
    displayOrder: 3,
    defaultPermissions: MODERATOR_PERMISSIONS,
  },
  {
    key: "staff",
    name: "Staff",
    color: "#2196F3",
    textColor: "#ffffff",
    bold: true,
    badgeStyle: "solid",
    displayOrder: 4,
    defaultPermissions: ENTRY_STAFF_PERMISSIONS,
  },
  {
    key: "helper",
    name: "Helper",
    color: "#7CFC00",
    textColor: "#0a2239",
    bold: true,
    badgeStyle: "solid",
    displayOrder: 5,
    defaultPermissions: ENTRY_STAFF_PERMISSIONS,
  },
  {
    key: "demon",
    name: "Demon",
    color: "#7a2bff",
    textColor: "#0a2239",
    bold: true,
    badgeStyle: "gradient",
    displayOrder: 6,
    defaultPermissions: [],
  },
  {
    key: "deadliest",
    name: "Deadliest",
    color: "#00FFFF",
    textColor: "#0a2239",
    bold: true,
    badgeStyle: "solid",
    displayOrder: 7,
    defaultPermissions: [],
  },
  {
    key: "vip",
    name: "VIP",
    color: "#00FF00",
    textColor: "#0a2239",
    bold: true,
    badgeStyle: "solid",
    displayOrder: 8,
    defaultPermissions: [],
  },
  {
    key: "hero",
    name: "Hero",
    color: "#FFD700",
    textColor: "#0a2239",
    bold: true,
    badgeStyle: "solid",
    displayOrder: 9,
    defaultPermissions: [],
  },
  {
    key: "media",
    name: "Media",
    color: "#FF69B4",
    textColor: "#0a2239",
    bold: true,
    badgeStyle: "solid",
    displayOrder: 10,
    defaultPermissions: [],
  },
  {
    key: "booster",
    name: "Booster",
    color: "#FF1493",
    textColor: "#ffffff",
    bold: true,
    badgeStyle: "solid",
    displayOrder: 11,
    defaultPermissions: [],
  },
  {
    key: MEMBER_RANK_KEY,
    name: "Member",
    color: "#808080",
    textColor: "#ffffff",
    bold: true,
    badgeStyle: "solid",
    displayOrder: 12,
    defaultPermissions: [],
  },
  {
    // The free Power Rank sold in the store. It is a real rank record so the
    // store card can link to it and staff can assign it like any cosmetic rank.
    key: POWER_RANK_KEY,
    name: "Power Rank",
    color: "#FF8C00",
    textColor: "#0a2239",
    bold: true,
    badgeStyle: "solid",
    displayOrder: 13,
    defaultPermissions: [],
  },
];

export const DEFAULT_RANK_BY_KEY = new Map(
  DEFAULT_RANK_SEEDS.map((rank) => [rank.key, rank]),
);
