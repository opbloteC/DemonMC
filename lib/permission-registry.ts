import type { PermissionCategory, PermissionDefinition } from "./rank-types";

interface CategorySeed {
  key: string;
  label: string;
  description: string;
  permissions: Array<Omit<PermissionDefinition, "category" | "categoryLabel" | "sortOrder">>;
}

const CATEGORY_SEEDS: CategorySeed[] = [
  {
    key: "staff",
    label: "Staff Panel",
    description: "Open and use the private staff areas.",
    permissions: [
      {
        key: "staff_panel.access",
        label: "Access Staff Panel",
        description: "Open the Staff Panel at /admin and use permitted sections.",
      },
      {
        key: "staff_workspace.access",
        label: "Access Staff Workspace",
        description: "Open the staff workspace at /staff.",
      },
      {
        key: "staff.dashboard.view",
        label: "View staff dashboard",
        description: "See the staff overview, counts and quick actions.",
      },
      {
        key: "staff.info.view",
        label: "View staff information",
        description: "Read staff-only information and internal notes.",
      },
      {
        key: "staff.tools.manage",
        label: "Use staff tools",
        description: "Use operational staff tools and workflows.",
      },
    ],
  },
  {
    key: "announcements",
    label: "Announcements",
    description: "Create and manage public announcements.",
    permissions: [
      {
        key: "announcements.view",
        label: "View announcements",
        description: "Read the announcement manager and drafts.",
      },
      {
        key: "announcements.create",
        label: "Create announcements",
        description: "Publish new announcements to the website.",
      },
      {
        key: "announcements.edit",
        label: "Edit announcements",
        description: "Change existing announcement titles and text.",
      },
      {
        key: "announcements.delete",
        label: "Delete announcements",
        description: "Permanently remove announcements.",
      },
      {
        key: "announcements.publish",
        label: "Publish announcements",
        description: "Control whether an announcement is publicly visible.",
      },
      {
        key: "announcements.pin",
        label: "Pin announcements",
        description: "Feature or pin important announcements.",
      },
    ],
  },
  {
    key: "rules",
    label: "Server Rules",
    description: "Manage the public server rules page.",
    permissions: [
      {
        key: "rules.view",
        label: "View rules management",
        description: "Open the Rules Management section and read drafts.",
      },
      {
        key: "rules.edit",
        label: "Edit server rules",
        description: "Create, edit, enable, disable and reorder rules.",
      },
      {
        key: "rules.publish",
        label: "Publish server rules",
        description: "Push draft rules live to the public /rules page.",
      },
      {
        key: "rules.delete",
        label: "Delete and reset rules",
        description: "Delete rules or restore the original defaults.",
      },
    ],
  },
  {
    key: "players",
    label: "Player Management",
    description: "Manage player profiles, identity and ranks.",
    permissions: [
      {
        key: "players.view",
        label: "View players",
        description: "See player accounts and roster profiles.",
      },
      {
        key: "players.edit",
        label: "Edit player profiles",
        description: "Edit staff-managed player profiles and descriptions.",
      },
      {
        key: "players.usernames.change",
        label: "Change Minecraft usernames",
        description: "Verify and change a player's linked Minecraft username.",
      },
      {
        key: "ranks.assign",
        label: "Assign ranks",
        description: "Reserved for owner rank assignment controls.",
      },
      {
        key: "ranks.remove",
        label: "Remove ranks",
        description: "Reserved for owner rank removal controls.",
      },
      {
        key: "profiles.manage",
        label: "Manage profiles",
        description: "Create, update and delete staff-managed player profiles.",
      },
    ],
  },
  {
    key: "accounts",
    label: "Account Management",
    description: "Create and manage website accounts.",
    permissions: [
      {
        key: "accounts.view",
        label: "View accounts",
        description: "See the full account list and account status.",
      },
      {
        key: "accounts.manage",
        label: "Manage accounts",
        description: "Create, disable, reset and delete non-owner accounts.",
      },
    ],
  },
  {
    key: "website",
    label: "Website Management",
    description: "Control public content, logos and site settings.",
    permissions: [
      {
        key: "website.access",
        label: "Access website management",
        description: "Open website management areas in the panel.",
      },
      {
        key: "website.content.edit",
        label: "Edit website content",
        description: "Change homepage, page and public website copy.",
      },
      {
        key: "website.logos.upload",
        label: "Upload website logos",
        description: "Upload and choose navbar and hero logos.",
      },
      {
        key: "website.settings.view",
        label: "View site settings",
        description: "See the public site settings such as server IP and Discord.",
      },
      {
        key: "website.settings.edit",
        label: "Edit site settings",
        description: "Change the headline, subtitle, server IP and Discord invite.",
      },
      {
        key: "website.announcements.manage",
        label: "Manage website news",
        description: "Control which announcements appear on the website.",
      },
    ],
  },
  {
    key: "moderation",
    label: "Moderation",
    description: "Review reports and take moderation actions.",
    permissions: [
      {
        key: "moderation.view",
        label: "View moderation",
        description: "See moderation queues, reports and player history.",
      },
      {
        key: "reports.manage",
        label: "Manage reports",
        description: "Assign, resolve and close player reports.",
      },
      {
        key: "moderation.actions",
        label: "Take moderation actions",
        description: "Apply warnings, mutes and other moderation controls.",
      },
    ],
  },
  {
    key: "applications",
    label: "Applications",
    description: "Review staff applications and manage public application forms.",
    permissions: [
      {
        key: "applications.manage",
        label: "Manage applications",
        description: "Review, accept or deny applications and edit all application forms and settings.",
      },
    ],
  },
  {
    key: "owner",
    label: "Owner Management",
    description: "Sensitive owner-only controls. The owner account always has full access.",
    permissions: [
      {
        key: "ranks.manage",
        label: "Manage ranks",
        description: "Open the rank management controls.",
      },
      {
        key: "ranks.create_delete",
        label: "Create and delete ranks",
        description: "Create new ranks or remove existing ranks.",
      },
      {
        key: "ranks.hierarchy",
        label: "Reorder ranks",
        description: "Change the display order of ranks across the site.",
      },
      {
        key: "permissions.manage",
        label: "Manage permissions",
        description: "Grant or revoke rank and individual permissions.",
      },
      {
        key: "owner.access",
        label: "Access owner controls",
        description: "Open owner-level management areas.",
      },
    ],
  },
];

export const PERMISSION_CATEGORIES: PermissionCategory[] = CATEGORY_SEEDS.map((category) => ({
  key: category.key,
  label: category.label,
  description: category.description,
  permissions: category.permissions.map((permission, index) => ({
    ...permission,
    category: category.key,
    categoryLabel: category.label,
    sortOrder: index + 1,
  })),
}));

export const PERMISSIONS: PermissionDefinition[] = PERMISSION_CATEGORIES.flatMap(
  (category) => category.permissions,
);

export const PERMISSION_KEYS = PERMISSIONS.map((permission) => permission.key);

export const PERMISSION_MAP = new Map(PERMISSIONS.map((permission) => [permission.key, permission]));

export function isPermissionKey(value: unknown): value is string {
  return typeof value === "string" && PERMISSION_MAP.has(value);
}
