import type { PoolClient } from "pg";
import { unstable_cache } from "next/cache";
import { invalidateSiteData, SITE_DATA_TAG } from "./cache";
import { query, withTransaction } from "./db";
import { DEFAULT_RULE_SEEDS } from "./rule-defaults";
import {
  isRuleIcon,
  type PublicRule,
  type RuleIcon,
  type RuleRecord,
  type RulesState,
} from "./rule-types";

export class RuleAdminError extends Error {
  status: number;

  constructor(message: string, status = 422) {
    super(message);
    this.name = "RuleAdminError";
    this.status = status;
  }
}

interface RuleRow {
  id: number;
  title: string;
  description: string;
  icon: string;
  color: string;
  bold: boolean;
  display_order: number;
  enabled: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

interface PublishedRuleRow {
  source_rule_id: number | null;
  title: string;
  description: string;
  icon: string;
  color: string;
  bold: boolean;
  display_order: number;
  enabled: boolean;
}

const RULE_COLUMNS = `id, title, description, icon, color, bold, display_order,
  enabled, published_at, created_at, updated_at`;

function normalizeIcon(value: unknown): RuleIcon {
  return isRuleIcon(value) ? value : "shield";
}

export function normalizeRuleColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

function mapRule(row: RuleRow): RuleRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    icon: normalizeIcon(row.icon),
    color: row.color,
    bold: Boolean(row.bold),
    displayOrder: row.display_order,
    enabled: Boolean(row.enabled),
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPublicRule(row: PublishedRuleRow & { id: number }): PublicRule {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    icon: normalizeIcon(row.icon),
    color: row.color,
    bold: Boolean(row.bold),
    displayOrder: row.display_order,
  };
}

function rulesDiffer(draft: RuleRecord[], published: PublishedRuleRow[]): boolean {
  if (draft.length !== published.length) return true;
  const bySource = new Map<number, PublishedRuleRow>();
  for (const row of published) {
    if (row.source_rule_id !== null) bySource.set(row.source_rule_id, row);
  }
  for (const rule of draft) {
    const snapshot = bySource.get(rule.id);
    if (
      !snapshot ||
      snapshot.title !== rule.title ||
      snapshot.description !== rule.description ||
      snapshot.icon !== rule.icon ||
      snapshot.color !== rule.color ||
      Boolean(snapshot.bold) !== rule.bold ||
      snapshot.display_order !== rule.displayOrder ||
      Boolean(snapshot.enabled) !== rule.enabled
    ) {
      return true;
    }
  }
  return false;
}

export async function listRulesState(): Promise<RulesState> {
  const [draftRes, publishedRes, lastRes] = await Promise.all([
    query<RuleRow>(`SELECT ${RULE_COLUMNS} FROM rules ORDER BY display_order ASC, id ASC`),
    query<PublishedRuleRow>(
      `SELECT source_rule_id, title, description, icon, color, bold,
              display_order, enabled
       FROM published_rules
       ORDER BY display_order ASC, id ASC`,
    ),
    query<{ last: string | null }>("SELECT MAX(published_at) AS last FROM published_rules"),
  ]);

  const rules = draftRes.rows.map(mapRule);
  return {
    rules,
    hasUnpublishedChanges: rulesDiffer(rules, publishedRes.rows),
    lastPublishedAt: lastRes.rows[0]?.last ?? null,
  };
}

async function readPublicRules(): Promise<PublicRule[]> {
  const { rows } = await query<PublishedRuleRow & { id: number }>(
    `SELECT id, source_rule_id, title, description, icon, color, bold,
            display_order, enabled
     FROM published_rules
     WHERE enabled = TRUE
     ORDER BY display_order ASC, id ASC`,
  );
  return rows.map(mapPublicRule);
}

export const listPublicRules = unstable_cache(readPublicRules, ["public-rules"], {
  tags: [SITE_DATA_TAG],
  revalidate: 300,
});

export async function getRule(id: number): Promise<RuleRecord | null> {
  const { rows } = await query<RuleRow>(`SELECT ${RULE_COLUMNS} FROM rules WHERE id = $1`, [id]);
  return rows[0] ? mapRule(rows[0]) : null;
}

interface RuleInput {
  title: string;
  description: string;
  icon: RuleIcon;
  color: string;
  bold: boolean;
}

export async function createRule(input: RuleInput): Promise<RuleRecord> {
  const { rows } = await query<{ next: number }>(
    "SELECT COALESCE(MAX(display_order), -1) + 1 AS next FROM rules",
  );
  const now = new Date().toISOString();
  const inserted = await query<{ id: number }>(
    `INSERT INTO rules (
       title, description, icon, color, bold, display_order,
       enabled, published_at, created_at, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, TRUE, NULL, $7, $7)
     RETURNING id`,
    [
      input.title,
      input.description,
      input.icon,
      input.color,
      input.bold,
      rows[0]?.next ?? 0,
      now,
    ],
  );
  const record = await getRule(inserted.rows[0].id);
  if (!record) throw new RuleAdminError("The rule could not be created.", 500);
  return record;
}

export async function updateRule(
  id: number,
  input: Partial<RuleInput & { enabled: boolean }>,
): Promise<RuleRecord> {
  const existing = await getRule(id);
  if (!existing) throw new RuleAdminError("Rule not found.", 404);

  const updates: string[] = [];
  const values: (string | boolean | number)[] = [];
  const add = (column: string, value: string | boolean | number) => {
    values.push(value);
    updates.push(`${column} = $${values.length}`);
  };

  if (input.title !== undefined && input.title !== existing.title) add("title", input.title);
  if (input.description !== undefined && input.description !== existing.description) {
    add("description", input.description);
  }
  if (input.icon !== undefined && input.icon !== existing.icon) add("icon", input.icon);
  if (input.color !== undefined && input.color !== existing.color) add("color", input.color);
  if (input.bold !== undefined && input.bold !== existing.bold) add("bold", input.bold);
  if (input.enabled !== undefined && input.enabled !== existing.enabled) {
    add("enabled", input.enabled);
  }

  if (updates.length === 0) throw new RuleAdminError("No changes provided.");

  add("updated_at", new Date().toISOString());
  await query(`UPDATE rules SET ${updates.join(", ")} WHERE id = $${values.length + 1}`, [
    ...values,
    id,
  ]);

  const record = await getRule(id);
  if (!record) throw new RuleAdminError("Rule not found.", 404);
  return record;
}

export async function deleteRule(id: number): Promise<void> {
  const existing = await getRule(id);
  if (!existing) throw new RuleAdminError("Rule not found.", 404);
  await query("DELETE FROM rules WHERE id = $1", [id]);
}

export async function reorderRules(ids: number[]): Promise<RuleRecord[]> {
  const { rows } = await query<{ id: number }>("SELECT id FROM rules");
  const existing = new Set(rows.map((row) => row.id));
  if (ids.length !== existing.size || new Set(ids).size !== ids.length) {
    throw new RuleAdminError("Send every rule in its new order.", 422);
  }
  if (ids.some((id) => !existing.has(id))) {
    throw new RuleAdminError("The new order contains an unknown rule.", 422);
  }

  const now = new Date().toISOString();
  await withTransaction(async (client) => {
    for (let index = 0; index < ids.length; index += 1) {
      await client.query(
        "UPDATE rules SET display_order = $1, updated_at = $2 WHERE id = $3",
        [index, now, ids[index]],
      );
    }
  });
  return (await listRulesState()).rules;
}

async function syncRulesIdentity(client: PoolClient): Promise<void> {
  await client.query(
    `SELECT setval(
       pg_get_serial_sequence('rules', 'id'),
       COALESCE((SELECT MAX(id) FROM rules), 0) + 1,
       FALSE
     )`,
  );
}

export async function publishRules(): Promise<RulesState> {
  const now = new Date().toISOString();
  await withTransaction(async (client) => {
    await client.query("DELETE FROM published_rules");
    await client.query(
      `INSERT INTO published_rules (
         source_rule_id, title, description, icon, color, bold,
         display_order, enabled, published_at
       )
       SELECT id, title, description, icon, color, bold, display_order, enabled, $1
       FROM rules
       ORDER BY display_order ASC, id ASC`,
      [now],
    );
    await client.query("UPDATE rules SET published_at = $1", [now]);
  });
  invalidateSiteData();
  return listRulesState();
}

/** Reverts the working copy to the last published snapshot. */
export async function discardRuleChanges(): Promise<RulesState> {
  await withTransaction(async (client) => {
    await client.query("DELETE FROM rules");
    await client.query(
      `INSERT INTO rules (
         id, title, description, icon, color, bold, display_order,
         enabled, published_at, created_at, updated_at
       )
       SELECT source_rule_id, title, description, icon, color, bold, display_order,
              enabled, published_at, $1, $1
       FROM published_rules
       WHERE source_rule_id IS NOT NULL
       ORDER BY display_order ASC, id ASC`,
      [new Date().toISOString()],
    );
    await syncRulesIdentity(client);
  });
  return listRulesState();
}

/** Rewrites the working copy with the ten original defaults. Publish separately. */
export async function resetRulesToDefaults(): Promise<RulesState> {
  await withTransaction(async (client) => {
    await client.query("DELETE FROM rules");
    const now = new Date().toISOString();
    for (const [index, rule] of DEFAULT_RULE_SEEDS.entries()) {
      await client.query(
        `INSERT INTO rules (
           title, description, icon, color, bold, display_order,
           enabled, published_at, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, TRUE, NULL, $7, $7)`,
        [rule.title, rule.description, rule.icon, rule.color, rule.bold, index, now],
      );
    }
    await syncRulesIdentity(client);
  });
  return listRulesState();
}
