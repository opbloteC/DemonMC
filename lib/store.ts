import type { PoolClient } from "pg";
import { unstable_cache } from "next/cache";
import { invalidateSiteData, SITE_DATA_TAG } from "./cache";
import { query, withTransaction } from "./db";
import type { BadgeStyle } from "./rank-types";
import { isBadgeStyleValue } from "./rank-admin";
import {
  DEFAULT_PROMOTION_PERCENT,
  DEFAULT_PROMOTION_TITLE,
  isPromotionActive,
  isStoreCardStyle,
  isStoreCategory,
  isStoreDesign,
  isStoreTheme,
  MAX_PROMOTION_PERCENT,
  MIN_PROMOTION_PERCENT,
  type PublicStoreRank,
  type StoreCardStyle,
  type StoreCategory,
  type StoreDesign,
  type StoreLinkableRank,
  type StoreProductBase,
  type StorePromotion,
  type StoreRankRecord,
  type StoreState,
  type StoreTheme,
} from "./store-types";

export class StoreAdminError extends Error {
  status: number;

  constructor(message: string, status = 422) {
    super(message);
    this.name = "StoreAdminError";
    this.status = status;
  }
}

interface StoreRow {
  id: number;
  category: string;
  rank_id: number | null;
  name: string;
  description: string;
  price_cents: number;
  is_free: boolean;
  style: string;
  color: string;
  gradient_from: string;
  gradient_to: string;
  design: string;
  button_label: string;
  enabled: boolean;
  display_order: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  rank_key: string | null;
  rank_name: string | null;
  rank_color: string | null;
  rank_text_color: string | null;
  rank_bold: boolean | null;
  rank_badge_style: string | null;
  rank_display_order: number | null;
  rank_deleted_at: string | null;
}

interface PublishedStoreRow {
  id: number;
  source_store_id: number | null;
  category: string;
  rank_id: number | null;
  name: string;
  description: string;
  price_cents: number;
  is_free: boolean;
  style: string;
  color: string;
  gradient_from: string;
  gradient_to: string;
  design: string;
  button_label: string;
  display_order: number;
  enabled: boolean;
  published_at: string;
}

interface RankLinkRow {
  id: number;
  key: string;
  name: string;
  color: string;
  text_color: string;
  bold: boolean;
  badge_style: string;
  display_order: number;
  deleted_at: string | null;
}

interface PromotionRow {
  enabled: boolean;
  discount_percent: number;
  title: string;
  description: string;
  starts_at: string | null;
  ends_at: string | null;
  theme: string;
  updated_at: string | null;
  updated_by: string | null;
}

const SELECT_COLUMNS = `
  s.id, s.category, s.rank_id, s.name, s.description, s.price_cents, s.is_free, s.style,
  s.color, s.gradient_from, s.gradient_to, s.design, s.button_label,
  s.enabled, s.display_order, s.published_at, s.created_at, s.updated_at,
  r.key AS rank_key, r.name AS rank_name, r.color AS rank_color,
  r.text_color AS rank_text_color, r.bold AS rank_bold,
  r.badge_style AS rank_badge_style, r.display_order AS rank_display_order,
  r.deleted_at AS rank_deleted_at`;

function categoryOf(value: unknown): StoreCategory {
  return isStoreCategory(value) ? value : "rank";
}

function mapLinkedRank(row: StoreRow): StoreLinkableRank | null {
  if (
    row.rank_id === null ||
    row.rank_key === null ||
    row.rank_name === null ||
    row.rank_color === null
  ) {
    return null;
  }
  return {
    id: row.rank_id,
    key: row.rank_key,
    name: row.rank_name,
    color: row.rank_color,
    textColor: row.rank_text_color ?? "#ffffff",
    bold: Boolean(row.rank_bold),
    badgeStyle: isBadgeStyleValue(row.rank_badge_style) ? row.rank_badge_style : "solid",
    displayOrder: row.rank_display_order ?? 0,
    deletedAt: row.rank_deleted_at,
  };
}

function mapStoreRow(row: StoreRow): StoreRankRecord {
  return {
    id: row.id,
    category: categoryOf(row.category),
    rankId: row.rank_id,
    rank: mapLinkedRank(row),
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    free: Boolean(row.is_free),
    style: isStoreCardStyle(row.style) ? row.style : "solid",
    color: row.color,
    gradientFrom: row.gradient_from,
    gradientTo: row.gradient_to,
    design: isStoreDesign(row.design) ? row.design : "classic",
    buttonLabel: row.button_label,
    displayOrder: row.display_order,
    enabled: Boolean(row.enabled),
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPublicRow(row: PublishedStoreRow): StoreProductBase {
  return {
    id: row.id,
    category: categoryOf(row.category),
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    free: Boolean(row.is_free),
    style: isStoreCardStyle(row.style) ? row.style : "solid",
    color: row.color,
    gradientFrom: row.gradient_from,
    gradientTo: row.gradient_to,
    design: isStoreDesign(row.design) ? row.design : "classic",
    buttonLabel: row.button_label,
    displayOrder: row.display_order,
  };
}

function mapRankRow(row: RankLinkRow): StoreLinkableRank {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    color: row.color,
    textColor: row.text_color,
    bold: Boolean(row.bold),
    badgeStyle: isBadgeStyleValue(row.badge_style)
      ? (row.badge_style as BadgeStyle)
      : "solid",
    displayOrder: row.display_order,
    deletedAt: row.deleted_at,
  };
}

function mapPromotion(row: PromotionRow | undefined): StorePromotion {
  const promotion = {
    enabled: Boolean(row?.enabled),
    discountPercent: row?.discount_percent ?? DEFAULT_PROMOTION_PERCENT,
    title: row?.title ?? DEFAULT_PROMOTION_TITLE,
    description: row?.description ?? "",
    startsAt: row?.starts_at ?? null,
    endsAt: row?.ends_at ?? null,
    theme: isStoreTheme(row?.theme) ? row.theme : "normal",
    updatedAt: row?.updated_at ?? null,
    updatedBy: row?.updated_by ?? null,
  } satisfies Omit<StorePromotion, "active">;
  return { ...promotion, active: isPromotionActive(promotion) };
}

function storeRowsDiffer(draft: StoreRankRecord[], published: PublishedStoreRow[]): boolean {
  if (draft.length !== published.length) return true;
  const bySource = new Map<number, PublishedStoreRow>();
  for (const row of published) {
    if (row.source_store_id !== null) bySource.set(row.source_store_id, row);
  }
  for (const item of draft) {
    const snapshot = bySource.get(item.id);
    if (
      !snapshot ||
      snapshot.category !== item.category ||
      (snapshot.rank_id ?? null) !== item.rankId ||
      snapshot.name !== item.name ||
      snapshot.description !== item.description ||
      snapshot.price_cents !== item.priceCents ||
      Boolean(snapshot.is_free) !== item.free ||
      snapshot.style !== item.style ||
      snapshot.color !== item.color ||
      snapshot.gradient_from !== item.gradientFrom ||
      snapshot.gradient_to !== item.gradientTo ||
      snapshot.design !== item.design ||
      snapshot.button_label !== item.buttonLabel ||
      snapshot.display_order !== item.displayOrder ||
      Boolean(snapshot.enabled) !== item.enabled
    ) {
      return true;
    }
  }
  return false;
}

async function listDraftRows(): Promise<StoreRow[]> {
  const { rows } = await query<StoreRow>(
    `SELECT ${SELECT_COLUMNS}
     FROM store_ranks s
     LEFT JOIN ranks r ON r.id = s.rank_id
     ORDER BY s.category ASC, s.display_order ASC, s.id ASC`,
  );
  return rows;
}

async function listPublishedRows(): Promise<PublishedStoreRow[]> {
  const { rows } = await query<PublishedStoreRow>(
    `SELECT id, source_store_id, category, rank_id, name, description, price_cents, is_free,
            style, color, gradient_from, gradient_to, design, button_label,
            display_order, enabled, published_at
     FROM published_store_ranks
     ORDER BY category ASC, display_order ASC, id ASC`,
  );
  return rows;
}

/** Active ranks from Rank Management, ordered like the rank list. */
export async function listLinkableRanks(): Promise<StoreLinkableRank[]> {
  const { rows } = await query<RankLinkRow>(
    `SELECT id, key, name, color, text_color, bold, badge_style, display_order, deleted_at
     FROM ranks
     WHERE deleted_at IS NULL
     ORDER BY display_order ASC, lower(name) ASC, id ASC`,
  );
  return rows.map(mapRankRow);
}

export async function getStorePromotion(): Promise<StorePromotion> {
  const { rows } = await query<PromotionRow>(
    `SELECT enabled, discount_percent, title, description, starts_at, ends_at,
            theme, updated_at, updated_by
     FROM store_promotion
     WHERE id = 1`,
  );
  return mapPromotion(rows[0]);
}

export async function listStoreState(): Promise<StoreState> {
  const [draftRows, publishedRows, lastRes, availableRanks, promotion] = await Promise.all([
    listDraftRows(),
    listPublishedRows(),
    query<{ last: string | null }>(
      "SELECT MAX(published_at) AS last FROM published_store_ranks",
    ),
    listLinkableRanks(),
    getStorePromotion(),
  ]);

  const ranks = draftRows.map(mapStoreRow);
  return {
    ranks,
    availableRanks,
    promotion,
    hasUnpublishedChanges: storeRowsDiffer(ranks, publishedRows),
    lastPublishedAt: lastRes.rows[0]?.last ?? null,
  };
}

/** Only enabled cards whose linked rank is still active are shown publicly. */
async function readPublicStoreProducts(): Promise<StoreProductBase[]> {
  const { rows } = await query<PublishedStoreRow>(
    `SELECT p.id, p.source_store_id, p.category, p.rank_id, p.name, p.description,
            p.price_cents, p.is_free, p.style, p.color, p.gradient_from,
            p.gradient_to, p.design, p.button_label, p.display_order,
            p.enabled, p.published_at
     FROM published_store_ranks p
     LEFT JOIN ranks r ON r.id = p.rank_id
     WHERE p.enabled = TRUE
       AND (p.category <> 'rank' OR (r.id IS NOT NULL AND r.deleted_at IS NULL))
     ORDER BY CASE p.category WHEN 'rank' THEN 0 WHEN 'key' THEN 1 ELSE 2 END,
              p.display_order ASC, p.id ASC`,
  );
  return rows.map(mapPublicRow);
}

export const listPublicStoreProducts = unstable_cache(
  readPublicStoreProducts,
  ["public-store-products-v2"],
  { tags: [SITE_DATA_TAG], revalidate: 300 },
);

export async function getStoreRank(id: number): Promise<StoreRankRecord | null> {
  const { rows } = await query<StoreRow>(
    `SELECT ${SELECT_COLUMNS}
     FROM store_ranks s
     LEFT JOIN ranks r ON r.id = s.rank_id
     WHERE s.id = $1`,
    [id],
  );
  return rows[0] ? mapStoreRow(rows[0]) : null;
}

async function assertRankLink(rankId: number, excludeStoreId = 0): Promise<void> {
  const { rows } = await query<{ id: number; deleted_at: string | null }>(
    "SELECT id, deleted_at FROM ranks WHERE id = $1",
    [rankId],
  );
  const rank = rows[0];
  if (!rank || rank.deleted_at) {
    throw new StoreAdminError("Choose an active rank from Rank Management.", 422);
  }
  const taken = await query<{ id: number }>(
    "SELECT id FROM store_ranks WHERE rank_id = $1 AND id <> $2 LIMIT 1",
    [rankId, excludeStoreId],
  );
  if (taken.rows[0]) {
    throw new StoreAdminError("That rank already has a store card.", 409);
  }
}

export interface StoreRankInput {
  category: StoreCategory;
  rankId: number | null;
  name: string;
  description: string;
  priceCents: number;
  free: boolean;
  style: StoreCardStyle;
  color: string;
  gradientFrom: string;
  gradientTo: string;
  design: StoreDesign;
  buttonLabel: string;
  enabled: boolean;
}

export type StoreRankPatch = Partial<Omit<StoreRankInput, "category">>;

function assertPrice(free: boolean, priceCents: number): void {
  if (free && priceCents !== 0) {
    throw new StoreAdminError("A free product must have a price of $0.00.", 422);
  }
  if (!free && priceCents < 1) {
    throw new StoreAdminError("A paid product needs a price of at least $0.01.", 422);
  }
}

export async function createStoreRank(input: StoreRankInput): Promise<StoreRankRecord> {
  if (input.category === "rank" && input.rankId === null) {
    throw new StoreAdminError("Choose a rank from Rank Management.", 422);
  }
  if (input.category !== "rank" && input.free) {
    throw new StoreAdminError("Keys and coins are always paid products.", 422);
  }
  assertPrice(input.free, input.priceCents);
  if (input.category === "rank" && input.rankId !== null) {
    await assertRankLink(input.rankId);
  }

  const { rows } = await query<{ next: number }>(
    "SELECT COALESCE(MAX(display_order), -1) + 1 AS next FROM store_ranks WHERE category = $1",
    [input.category],
  );
  const now = new Date().toISOString();
  const inserted = await query<{ id: number }>(
    `INSERT INTO store_ranks (
       category, rank_id, name, description, price_cents, is_free, style, color,
       gradient_from, gradient_to, design, button_label, enabled,
       display_order, published_at, created_at, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NULL, $15, $15)
     RETURNING id`,
    [
      input.category,
      input.category === "rank" ? input.rankId : null,
      input.name,
      input.description,
      input.priceCents,
      input.free,
      input.style,
      input.color,
      input.gradientFrom,
      input.gradientTo,
      input.design,
      input.buttonLabel,
      input.enabled,
      rows[0]?.next ?? 0,
      now,
    ],
  );
  const record = await getStoreRank(inserted.rows[0].id);
  if (!record) throw new StoreAdminError("The store card could not be created.", 500);
  return record;
}

export async function updateStoreRank(
  id: number,
  input: StoreRankPatch,
): Promise<StoreRankRecord> {
  const existing = await getStoreRank(id);
  if (!existing) throw new StoreAdminError("Store card not found.", 404);

  const free = input.free ?? existing.free;
  const priceCents = input.priceCents ?? existing.priceCents;
  assertPrice(free, priceCents);
  if (free && existing.category !== "rank") {
    throw new StoreAdminError("Keys and coins are always paid products.", 422);
  }
  if (existing.category === "rank") {
    const rankId = input.rankId === undefined ? existing.rankId : input.rankId;
    if (rankId === null) {
      throw new StoreAdminError("Choose a rank from Rank Management.", 422);
    }
    // Always re-check the link so a card can never be saved against a rank that
    // was deleted in Rank Management, even if the id itself did not change.
    await assertRankLink(rankId, id);
  }

  const updates: string[] = [];
  const values: (string | boolean | number)[] = [];
  const add = (column: string, value: string | boolean | number) => {
    values.push(value);
    updates.push(`${column} = $${values.length}`);
  };

  if (
    input.rankId !== undefined &&
    existing.category === "rank" &&
    input.rankId !== existing.rankId
  ) {
    add("rank_id", input.rankId as number);
  }
  if (input.name !== undefined && input.name !== existing.name) add("name", input.name);
  if (input.description !== undefined && input.description !== existing.description) {
    add("description", input.description);
  }
  if (input.priceCents !== undefined && input.priceCents !== existing.priceCents) {
    add("price_cents", input.priceCents);
  }
  if (input.free !== undefined && input.free !== existing.free) add("is_free", input.free);
  if (input.style !== undefined && input.style !== existing.style) add("style", input.style);
  if (input.color !== undefined && input.color !== existing.color) add("color", input.color);
  if (input.gradientFrom !== undefined && input.gradientFrom !== existing.gradientFrom) {
    add("gradient_from", input.gradientFrom);
  }
  if (input.gradientTo !== undefined && input.gradientTo !== existing.gradientTo) {
    add("gradient_to", input.gradientTo);
  }
  if (input.design !== undefined && input.design !== existing.design) add("design", input.design);
  if (input.buttonLabel !== undefined && input.buttonLabel !== existing.buttonLabel) {
    add("button_label", input.buttonLabel);
  }
  if (input.enabled !== undefined && input.enabled !== existing.enabled) {
    add("enabled", input.enabled);
  }

  if (updates.length === 0) throw new StoreAdminError("No changes provided.");

  add("updated_at", new Date().toISOString());
  await query(`UPDATE store_ranks SET ${updates.join(", ")} WHERE id = $${values.length + 1}`, [
    ...values,
    id,
  ]);

  const record = await getStoreRank(id);
  if (!record) throw new StoreAdminError("Store card not found.", 404);
  return record;
}

/** Copies the linked rank's current colour into the store card. Rank untouched. */
export async function syncStoreRankColor(id: number): Promise<StoreRankRecord> {
  const existing = await getStoreRank(id);
  if (!existing) throw new StoreAdminError("Store card not found.", 404);
  if (existing.category !== "rank") {
    throw new StoreAdminError("Only rank cards can sync their colour.", 422);
  }
  if (!existing.rank || existing.rank.deletedAt) {
    throw new StoreAdminError(
      "The linked rank is no longer active. Choose another rank before syncing colours.",
      409,
    );
  }
  const now = new Date().toISOString();
  await query(
    `UPDATE store_ranks
     SET color = $1, gradient_from = $1, updated_at = $2
     WHERE id = $3`,
    [existing.rank.color, now, id],
  );
  const record = await getStoreRank(id);
  if (!record) throw new StoreAdminError("Store card not found.", 404);
  return record;
}

/** Deletes only the store card; the actual rank in Rank Management is untouched. */
export async function deleteStoreRank(id: number): Promise<void> {
  const existing = await getStoreRank(id);
  if (!existing) throw new StoreAdminError("Store card not found.", 404);
  await query("DELETE FROM store_ranks WHERE id = $1", [id]);
}

export async function reorderStoreRanks(
  category: StoreCategory,
  ids: number[],
): Promise<StoreRankRecord[]> {
  const { rows } = await query<{ id: number }>(
    "SELECT id FROM store_ranks WHERE category = $1",
    [category],
  );
  const existing = new Set(rows.map((row) => row.id));
  if (ids.length !== existing.size || new Set(ids).size !== ids.length) {
    throw new StoreAdminError(
      `Send every ${category} card in its new order.`,
      422,
    );
  }
  if (ids.some((id) => !existing.has(id))) {
    throw new StoreAdminError("The new order contains an unknown store card.", 422);
  }

  const now = new Date().toISOString();
  await withTransaction(async (client) => {
    for (let index = 0; index < ids.length; index += 1) {
      await client.query(
        "UPDATE store_ranks SET display_order = $1, updated_at = $2 WHERE id = $3",
        [index, now, ids[index]],
      );
    }
  });
  return (await listStoreState()).ranks;
}

async function syncStoreIdentity(client: PoolClient): Promise<void> {
  await client.query(
    `SELECT setval(
       pg_get_serial_sequence('store_ranks', 'id'),
       COALESCE((SELECT MAX(id) FROM store_ranks), 0) + 1,
       FALSE
     )`,
  );
}

export async function publishStore(): Promise<StoreState> {
  const now = new Date().toISOString();
  await withTransaction(async (client) => {
    await client.query("DELETE FROM published_store_ranks");
    await client.query(
      `INSERT INTO published_store_ranks (
         source_store_id, category, rank_id, name, description, price_cents, is_free,
         style, color, gradient_from, gradient_to, design, button_label,
         display_order, enabled, published_at
       )
       SELECT id, category, rank_id, name, description, price_cents, is_free,
              style, color, gradient_from, gradient_to, design, button_label,
              display_order, enabled, $1
       FROM store_ranks
       ORDER BY category ASC, display_order ASC, id ASC`,
      [now],
    );
    await client.query("UPDATE store_ranks SET published_at = $1", [now]);
  });
  invalidateSiteData();
  return listStoreState();
}

/** Reverts the draft to the last published snapshot. */
export async function discardStoreChanges(): Promise<StoreState> {
  await withTransaction(async (client) => {
    await client.query("DELETE FROM store_ranks");
    await client.query(
      `INSERT INTO store_ranks (
         id, category, rank_id, name, description, price_cents, is_free, style, color,
         gradient_from, gradient_to, design, button_label, enabled,
         display_order, published_at, created_at, updated_at
       )
       SELECT source_store_id, category, rank_id, name, description, price_cents, is_free,
              style, color, gradient_from, gradient_to, design, button_label,
              enabled, display_order, published_at, $1, $1
       FROM published_store_ranks
       WHERE source_store_id IS NOT NULL
       ORDER BY category ASC, display_order ASC, id ASC`,
      [new Date().toISOString()],
    );
    await syncStoreIdentity(client);
  });
  return listStoreState();
}

export interface StorePromotionInput {
  enabled: boolean;
  discountPercent: number;
  title: string;
  description: string;
  startsAt: string | null;
  endsAt: string | null;
  theme: StoreTheme;
}

export async function saveStorePromotion(
  input: StorePromotionInput,
  updatedBy: string,
): Promise<StorePromotion> {
  if (
    !Number.isInteger(input.discountPercent) ||
    input.discountPercent < MIN_PROMOTION_PERCENT ||
    input.discountPercent > MAX_PROMOTION_PERCENT
  ) {
    throw new StoreAdminError(
      `Discount must be a whole number between ${MIN_PROMOTION_PERCENT}% and ${MAX_PROMOTION_PERCENT}%.`,
      422,
    );
  }
  if (input.startsAt && input.endsAt && input.startsAt > input.endsAt) {
    throw new StoreAdminError("The sale end date must be on or after the start date.", 422);
  }
  if (!isStoreTheme(input.theme)) {
    throw new StoreAdminError("Choose a valid store theme.", 422);
  }

  const now = new Date().toISOString();
  await query(
    `INSERT INTO store_promotion (
       id, enabled, discount_percent, title, description, starts_at, ends_at,
       theme, updated_at, updated_by
     )
     VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (id) DO UPDATE SET
       enabled = excluded.enabled,
       discount_percent = excluded.discount_percent,
       title = excluded.title,
       description = excluded.description,
       starts_at = excluded.starts_at,
       ends_at = excluded.ends_at,
       theme = excluded.theme,
       updated_at = excluded.updated_at,
       updated_by = excluded.updated_by`,
    [
      input.enabled,
      input.discountPercent,
      input.title,
      input.description,
      input.startsAt,
      input.endsAt,
      input.theme,
      now,
      updatedBy,
    ],
  );
  invalidateSiteData();
  return getStorePromotion();
}
