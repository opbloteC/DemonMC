import type { PoolClient } from "pg";
import { PERMISSIONS, PERMISSION_KEYS } from "./permission-registry";
import { DEFAULT_RANK_SEEDS, OWNER_RANK_KEY } from "./rank-defaults";

/**
 * Idempotent rank/permission seed. It never removes data and never overwrites
 * an owner's visual or permission choices.
 */
export async function seedRankSystem(client: PoolClient): Promise<void> {
  const now = new Date().toISOString();

  for (const rank of DEFAULT_RANK_SEEDS) {
    await client.query(
      `INSERT INTO ranks (
         key, name, color, text_color, bold, badge_style, display_order,
         is_system, deleted_at, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, NULL, $8, $9)
       ON CONFLICT DO NOTHING`,
      [
        rank.key,
        rank.name,
        rank.color,
        rank.textColor,
        rank.bold,
        rank.badgeStyle,
        rank.displayOrder,
        now,
        now,
      ],
    );
  }

  for (const permission of PERMISSIONS) {
    await client.query(
      `INSERT INTO permissions (key, label, description, category, category_label, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (key) DO UPDATE SET
         label = EXCLUDED.label,
         description = EXCLUDED.description,
         category = EXCLUDED.category,
         category_label = EXCLUDED.category_label,
         sort_order = EXCLUDED.sort_order`,
      [
        permission.key,
        permission.label,
        permission.description,
        permission.category,
        permission.categoryLabel,
        permission.sortOrder,
      ],
    );
  }

  await client.query(
    `UPDATE users u
     SET rank_id = r.id
     FROM ranks r
     WHERE u.rank_id IS NULL
       AND r.key = CASE
         WHEN u.role IN ('owner', 'manager', 'developer', 'mod', 'staff', 'helper') THEN u.role
         WHEN u.special_rank IN ('demon', 'deadliest', 'vip', 'hero', 'media', 'booster')
           THEN u.special_rank
         ELSE 'member'
       END`,
  );

  await client.query(
    `UPDATE users u
     SET secondary_rank_id = r.id
     FROM ranks r
     WHERE u.secondary_rank_id IS NULL
       AND u.role <> 'player'
       AND u.special_rank IS NOT NULL
       AND r.key = u.special_rank`,
  );

  const { rows } = await client.query<{ id: number; key: string }>(
    "SELECT id, key FROM ranks",
  );
  const rankIds = new Map(rows.map((row) => [row.key, row.id]));

  for (const rank of DEFAULT_RANK_SEEDS) {
    const rankId = rankIds.get(rank.key);
    if (!rankId) continue;
    const keys = rank.key === OWNER_RANK_KEY ? PERMISSION_KEYS : rank.defaultPermissions;
    for (const permissionKey of keys) {
      await client.query(
        `INSERT INTO rank_permissions (rank_id, permission_key, allowed)
         VALUES ($1, $2, TRUE)
         ON CONFLICT (rank_id, permission_key) DO NOTHING`,
        [rankId, permissionKey],
      );
    }
  }
}
