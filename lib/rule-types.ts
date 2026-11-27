export const RULE_ICONS = [
  "shield",
  "sword",
  "message",
  "monitor",
  "heart",
  "users",
  "eye",
  "repeat",
  "wrench",
  "bug",
  "ban",
  "megaphone",
  "lock",
  "cube",
  "server",
  "crown",
  "alert",
] as const;

export type RuleIcon = (typeof RULE_ICONS)[number];

export const RULE_ICON_LABELS: Record<RuleIcon, string> = {
  shield: "Shield",
  sword: "Sword",
  message: "Chat bubble",
  monitor: "Monitor",
  heart: "Heart",
  users: "Players",
  eye: "Eye",
  repeat: "Repeat",
  wrench: "Wrench",
  bug: "Bug",
  ban: "Ban",
  megaphone: "Megaphone",
  lock: "Lock",
  cube: "Block",
  server: "Server",
  crown: "Crown",
  alert: "Alert",
};

export function isRuleIcon(value: unknown): value is RuleIcon {
  return typeof value === "string" && (RULE_ICONS as readonly string[]).includes(value);
}

export interface RuleRecord {
  id: number;
  title: string;
  description: string;
  icon: RuleIcon;
  color: string;
  bold: boolean;
  displayOrder: number;
  enabled: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicRule {
  id: number;
  title: string;
  description: string;
  icon: RuleIcon;
  color: string;
  bold: boolean;
  displayOrder: number;
}

export interface RulesState {
  rules: RuleRecord[];
  hasUnpublishedChanges: boolean;
  lastPublishedAt: string | null;
}
