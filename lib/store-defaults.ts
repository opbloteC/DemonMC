import type { PoolClient } from "pg";
import { POWER_RANK_KEY } from "./rank-defaults";
import {
  DEFAULT_PROMOTION_PERCENT,
  DEFAULT_PROMOTION_TITLE,
  type StoreCardStyle,
  type StoreCategory,
  type StoreDesign,
} from "./store-types";

export interface DefaultStoreSeed {
  rankKey: string;
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
}

export const DEFAULT_STORE_SEEDS: DefaultStoreSeed[] = [
  {
    rankKey: "demon",
    name: "Demon",
    description:
      "The ultimate DemonMC flex. A rainbow-gradient rank that makes you impossible to miss in every lobby.",
    priceCents: 350,
    free: false,
    style: "gradient",
    color: "#7a2bff",
    gradientFrom: "#ff2bd6",
    gradientTo: "#7a2bff",
    design: "rainbow",
    buttonLabel: "BUY NOW",
  },
  {
    rankKey: "deadliest",
    name: "Deadliest",
    description: "Aqua status for players who want to stand out in every fight and every lobby.",
    priceCents: 250,
    free: false,
    style: "solid",
    color: "#00FFFF",
    gradientFrom: "#00FFFF",
    gradientTo: "#00a8b3",
    design: "classic",
    buttonLabel: "BUY NOW",
  },
  {
    rankKey: "vip",
    name: "VIP",
    description: "Lime-green VIP status with a bright badge that shows everyone you mean business.",
    priceCents: 150,
    free: false,
    style: "solid",
    color: "#00FF00",
    gradientFrom: "#00FF00",
    gradientTo: "#00b800",
    design: "classic",
    buttonLabel: "BUY NOW",
  },
  {
    rankKey: "hero",
    name: "Hero",
    description: "Golden hero status that proves you are part of the DemonMC story.",
    priceCents: 100,
    free: false,
    style: "solid",
    color: "#FFD700",
    gradientFrom: "#FFD700",
    gradientTo: "#c7a600",
    design: "classic",
    buttonLabel: "BUY NOW",
  },
  {
    rankKey: POWER_RANK_KEY,
    name: "Power Rank",
    description: "A special free rank for the DemonMC community.",
    priceCents: 0,
    free: true,
    style: "solid",
    color: "#FF8C00",
    gradientFrom: "#FF8C00",
    gradientTo: "#f2701c",
    design: "featured",
    buttonLabel: "JOIN DISCORD",
  },
];

const SEEDED_KEY = "store.seeded";

/**
 * Seeds the five launch store cards once. The marker keeps this one-shot so an
 * owner can intentionally empty or restyle the store without the defaults
 * reappearing on the next boot. Cards link to real rank ids by rank key.
 */
export async function seedDefaultStore(client: PoolClient): Promise<void> {
  const marker = await client.query<{ value: string }>(
    "SELECT value FROM settings WHERE key = $1",
    [SEEDED_KEY],
  );

  const now = new Date().toISOString();
  if (marker.rowCount === 0) {
    const count = await client.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM store_ranks",
    );
    if (count.rows[0]?.count === 0) {
      for (const [index, item] of DEFAULT_STORE_SEEDS.entries()) {
        const rank = await client.query<{ id: number }>(
          "SELECT id FROM ranks WHERE key = $1 AND deleted_at IS NULL",
          [item.rankKey],
        );
        if (!rank.rows[0]) continue;

        const inserted = await client.query<{ id: number }>(
          `INSERT INTO store_ranks (
             rank_id, name, description, price_cents, is_free, style, color,
             gradient_from, gradient_to, design, button_label, enabled,
             display_order, published_at, created_at, updated_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE, $12, $13, $13, $13)
           RETURNING id`,
          [
            rank.rows[0].id,
            item.name,
            item.description,
            item.priceCents,
            item.free,
            item.style,
            item.color,
            item.gradientFrom,
            item.gradientTo,
            item.design,
            item.buttonLabel,
            index,
            now,
          ],
        );

        await client.query(
          `INSERT INTO published_store_ranks (
             source_store_id, rank_id, name, description, price_cents, is_free,
             style, color, gradient_from, gradient_to, design, button_label,
             display_order, enabled, published_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, TRUE, $14)`,
          [
            inserted.rows[0].id,
            rank.rows[0].id,
            item.name,
            item.description,
            item.priceCents,
            item.free,
            item.style,
            item.color,
            item.gradientFrom,
            item.gradientTo,
            item.design,
            item.buttonLabel,
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

interface ProductSeed {
  category: Exclude<StoreCategory, "rank">;
  name: string;
  description: string;
  priceCents: number;
  color: string;
  gradientFrom: string;
  gradientTo: string;
}

/** Launch catalogue for keys and coins. Prices are the untouched base prices. */
export const DEFAULT_PRODUCT_SEEDS: ProductSeed[] = [
  {
    category: "key",
    name: "Demon Key",
    description:
      "The premium Demon Key. Opens the rarest Demon crate and is the top pick for serious collectors.",
    priceCents: 100,
    color: "#ef4444",
    gradientFrom: "#ef4444",
    gradientTo: "#b91c1c",
  },
  {
    category: "key",
    name: "Season Key",
    description:
      "Seasonal crate key with a cool blue finish. Unlock the current season's rewards.",
    priceCents: 65,
    color: "#3b82f6",
    gradientFrom: "#3b82f6",
    gradientTo: "#1d4ed8",
  },
  {
    category: "key",
    name: "Elite Key",
    description: "Elite crate access in bright yellow. A reliable step up from standard loot.",
    priceCents: 25,
    color: "#eab308",
    gradientFrom: "#facc15",
    gradientTo: "#ca8a04",
  },
  {
    category: "key",
    name: "Party Key",
    description: "Party crate key with a playful pink glow. Great for event loot and celebrations.",
    priceCents: 20,
    color: "#ec4899",
    gradientFrom: "#f472b6",
    gradientTo: "#be185d",
  },
  {
    category: "coin",
    name: "10,000 Coins",
    description: "The biggest coin pack. Stock up for the item shop, upgrades and seasonal offers.",
    priceCents: 900,
    color: "#f59e0b",
    gradientFrom: "#fbbf24",
    gradientTo: "#b45309",
  },
  {
    category: "coin",
    name: "7,500 Coins",
    description: "A large coin pack with plenty of spending room for shop restocks.",
    priceCents: 650,
    color: "#f59e0b",
    gradientFrom: "#fbbf24",
    gradientTo: "#b45309",
  },
  {
    category: "coin",
    name: "5,000 Coins",
    description: "A balanced coin pack for regular shop visits and upgrades.",
    priceCents: 450,
    color: "#f59e0b",
    gradientFrom: "#fbbf24",
    gradientTo: "#b45309",
  },
  {
    category: "coin",
    name: "1,000 Coins",
    description: "A small coin pack to top up your balance between bigger purchases.",
    priceCents: 100,
    color: "#f59e0b",
    gradientFrom: "#fbbf24",
    gradientTo: "#b45309",
  },
];

const PRODUCTS_SEEDED_KEY = "store.products.seeded";
const PROMOTION_SEEDED_KEY = "store.promotion.seeded";

/**
 * Seeds keys and coins once, plus the default Christmas promotion. Ranks are
 * untouched and an intentionally emptied catalogue is not re-seeded.
 */
export async function seedStoreProducts(client: PoolClient): Promise<void> {
  const marker = await client.query<{ value: string }>(
    "SELECT value FROM settings WHERE key = $1",
    [PRODUCTS_SEEDED_KEY],
  );

  if (marker.rowCount === 0) {
    const count = await client.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM store_ranks WHERE category IN ('key', 'coin')",
    );
    if (count.rows[0]?.count === 0) {
      const now = new Date().toISOString();
      const order: Record<ProductSeed["category"], number> = { key: 0, coin: 0 };
      for (const item of DEFAULT_PRODUCT_SEEDS) {
        const displayOrder = order[item.category];
        order[item.category] += 1;
        const inserted = await client.query<{ id: number }>(
          `INSERT INTO store_ranks (
             category, rank_id, name, description, price_cents, is_free, style, color,
             gradient_from, gradient_to, design, button_label, enabled,
             display_order, published_at, created_at, updated_at
           )
           VALUES ($1, NULL, $2, $3, $4, FALSE, 'solid', $5, $6, $7, 'classic',
                   'BUY NOW', TRUE, $8, $9, $9, $9)
           RETURNING id`,
          [
            item.category,
            item.name,
            item.description,
            item.priceCents,
            item.color,
            item.gradientFrom,
            item.gradientTo,
            displayOrder,
            now,
          ],
        );

        await client.query(
          `INSERT INTO published_store_ranks (
             source_store_id, category, rank_id, name, description, price_cents, is_free,
             style, color, gradient_from, gradient_to, design, button_label,
             display_order, enabled, published_at
           )
           VALUES ($1, $2, NULL, $3, $4, $5, FALSE, 'solid', $6, $7, $8, 'classic',
                   'BUY NOW', $9, TRUE, $10)`,
          [
            inserted.rows[0].id,
            item.category,
            item.name,
            item.description,
            item.priceCents,
            item.color,
            item.gradientFrom,
            item.gradientTo,
            displayOrder,
            now,
          ],
        );
      }
    }
  }

  await client.query(
    "INSERT INTO settings (key, value) VALUES ($1, '1') ON CONFLICT (key) DO NOTHING",
    [PRODUCTS_SEEDED_KEY],
  );

  const promotionMarker = await client.query<{ value: string }>(
    "SELECT value FROM settings WHERE key = $1",
    [PROMOTION_SEEDED_KEY],
  );
  if (promotionMarker.rowCount === 0) {
    await client.query(
      `INSERT INTO store_promotion (
         id, enabled, discount_percent, title, description, starts_at, ends_at,
         theme, updated_at, updated_by
       )
       VALUES (1, TRUE, $1, $2, $3, NULL, NULL, 'christmas', $4, 'system')
       ON CONFLICT (id) DO NOTHING`,
      [
        DEFAULT_PROMOTION_PERCENT,
        DEFAULT_PROMOTION_TITLE,
        "Limited Christmas sale on every key and coin pack. Original prices stay saved and return automatically when the sale ends.",
        new Date().toISOString(),
      ],
    );
    await client.query(
      "INSERT INTO settings (key, value) VALUES ($1, '1') ON CONFLICT (key) DO NOTHING",
      [PROMOTION_SEEDED_KEY],
    );
  }
}
