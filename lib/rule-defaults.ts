import type { PoolClient } from "pg";
import type { RuleIcon } from "./rule-types";

export interface DefaultRuleSeed {
  title: string;
  description: string;
  icon: RuleIcon;
  color: string;
  bold: boolean;
}

export const DEFAULT_RULE_SEEDS: DefaultRuleSeed[] = [
  {
    title: "NO CHEATS",
    description: "Cheating or gaining unfair advantages is prohibited.",
    icon: "sword",
    color: "#f4842d",
    bold: true,
  },
  {
    title: "NO SPAMMING",
    description: "Do not spam chat, commands or advertisements.",
    icon: "message",
    color: "#ff8a3d",
    bold: true,
  },
  {
    title: "NO HACK CLIENTS",
    description: "Hacked clients and unfair modifications are prohibited.",
    icon: "monitor",
    color: "#e0671a",
    bold: true,
  },
  {
    title: "NO RACISM",
    description: "Racism, hate speech and discrimination are not allowed.",
    icon: "heart",
    color: "#ffa15e",
    bold: true,
  },
  {
    title: "BE RESPECTFUL",
    description: "Respect all players and staff members.",
    icon: "users",
    color: "#f4842d",
    bold: true,
  },
  {
    title: "NO X-RAY",
    description: "X-ray resource packs and unfair resource detection are prohibited.",
    icon: "eye",
    color: "#ff8a3d",
    bold: true,
  },
  {
    title: "NO ALT GRINDING",
    description: "Do not exploit multiple accounts for rewards or farming.",
    icon: "repeat",
    color: "#e0671a",
    bold: true,
  },
  {
    title: "NO ABUSING",
    description: "Do not abuse bugs, exploits, commands or permissions.",
    icon: "wrench",
    color: "#ffa15e",
    bold: true,
  },
  {
    title: "NO BUG EXPLOITING",
    description: "Report bugs instead of intentionally exploiting them.",
    icon: "bug",
    color: "#f4842d",
    bold: true,
  },
  {
    title: "NO BAN EVADING",
    description: "Do not use alternate accounts to bypass punishments.",
    icon: "ban",
    color: "#ff8a3d",
    bold: true,
  },
];

const SEEDED_KEY = "rules.seeded";

/**
 * Seeds the ten default rules once, on a fresh rules table. The settings marker
 * makes the seed one-shot so an owner can intentionally empty the list later
 * without the defaults reappearing on the next boot.
 */
export async function seedDefaultRules(client: PoolClient): Promise<void> {
  const marker = await client.query<{ value: string }>(
    "SELECT value FROM settings WHERE key = $1",
    [SEEDED_KEY],
  );

  const now = new Date().toISOString();
  if (marker.rowCount === 0) {
    const count = await client.query<{ count: number }>("SELECT COUNT(*)::int AS count FROM rules");
    if (count.rows[0]?.count === 0) {
      for (const [index, rule] of DEFAULT_RULE_SEEDS.entries()) {
        const inserted = await client.query<{ id: number }>(
          `INSERT INTO rules (
             title, description, icon, color, bold, display_order,
             enabled, published_at, created_at, updated_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, $7, $7)
           RETURNING id`,
          [rule.title, rule.description, rule.icon, rule.color, rule.bold, index, now],
        );
        await client.query(
          `INSERT INTO published_rules (
             source_rule_id, title, description, icon, color, bold,
             display_order, enabled, published_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8)`,
          [
            inserted.rows[0].id,
            rule.title,
            rule.description,
            rule.icon,
            rule.color,
            rule.bold,
            index,
            now,
          ],
        );
      }
    }
  }

  await client.query(
    "INSERT INTO settings (key, value) VALUES ($1, '1') ON CONFLICT (key) DO NOTHING",
    [SEEDED_KEY],
  );
}
