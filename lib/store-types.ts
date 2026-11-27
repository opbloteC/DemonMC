import type { BadgeStyle } from "./rank-types";

export const STORE_STYLES = ["solid", "gradient"] as const;
export type StoreCardStyle = (typeof STORE_STYLES)[number];

export const STORE_STYLE_LABELS: Record<StoreCardStyle, string> = {
  solid: "Solid color",
  gradient: "Gradient",
};

export const STORE_DESIGNS = ["classic", "featured", "rainbow"] as const;
export type StoreDesign = (typeof STORE_DESIGNS)[number];

export const STORE_DESIGN_LABELS: Record<StoreDesign, string> = {
  classic: "Classic",
  featured: "Featured",
  rainbow: "Rainbow",
};

export const STORE_CATEGORIES = ["rank", "key", "coin"] as const;
export type StoreCategory = (typeof STORE_CATEGORIES)[number];

export const STORE_CATEGORY_LABELS: Record<StoreCategory, string> = {
  rank: "Ranks",
  key: "Keys",
  coin: "Coins",
};

export const STORE_CATEGORY_SINGULAR: Record<StoreCategory, string> = {
  rank: "Rank",
  key: "Key",
  coin: "Coins",
};

export const STORE_THEMES = ["normal", "christmas", "summer"] as const;
export type StoreTheme = (typeof STORE_THEMES)[number];

export const STORE_THEME_LABELS: Record<StoreTheme, string> = {
  normal: "Normal Store",
  christmas: "Christmas",
  summer: "Summer",
};

export const STORE_THEME_HINTS: Record<StoreTheme, string> = {
  normal: "The regular store look with the aqua and orange accents.",
  christmas: "Subtle festive red, evergreen and snow details. No layout changes.",
  summer: "Warm sunshine golds and a light sun glow. No layout changes.",
};

export const MAX_STORE_PRICE_CENTS = 99999;
export const MIN_PROMOTION_PERCENT = 1;
export const MAX_PROMOTION_PERCENT = 90;
export const DEFAULT_PROMOTION_PERCENT = 50;
export const DEFAULT_PROMOTION_TITLE = "50% OFF – CHRISTMAS SALE";
export const MAX_PROMOTION_TITLE_LENGTH = 60;
export const MAX_PROMOTION_DESCRIPTION_LENGTH = 240;

export const DEFAULT_STORE_BRAND_NAME = "DEMONMC STORE";
export const MAX_STORE_BRAND_LENGTH = 40;

/** Splits the editable store name so the final word can carry the orange accent. */
export function splitStoreBrandName(value: string): { leading: string; accent: string } {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return splitStoreBrandName(DEFAULT_STORE_BRAND_NAME);
  if (words.length === 1) return { leading: "", accent: words[0] };
  return { leading: words.slice(0, -1).join(" "), accent: words[words.length - 1] };
}

export function isStoreCardStyle(value: unknown): value is StoreCardStyle {
  return typeof value === "string" && (STORE_STYLES as readonly string[]).includes(value);
}

export function isStoreDesign(value: unknown): value is StoreDesign {
  return typeof value === "string" && (STORE_DESIGNS as readonly string[]).includes(value);
}

export function isStoreCategory(value: unknown): value is StoreCategory {
  return typeof value === "string" && (STORE_CATEGORIES as readonly string[]).includes(value);
}

export function isStoreTheme(value: unknown): value is StoreTheme {
  return typeof value === "string" && (STORE_THEMES as readonly string[]).includes(value);
}

export function formatStorePrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** "Demon" → "Demon Rank"; "Power Rank" stays as it is. */
export function storeRankTitle(name: string): string {
  const trimmed = name.trim();
  return /rank$/i.test(trimmed) ? trimmed : `${trimmed} Rank`;
}

/** Only rank cards get the automatic "Rank" suffix. Keys and coins keep their name. */
export function storeProductTitle(item: Pick<StoreProductBase, "name" | "category">): string {
  return item.category === "rank" ? storeRankTitle(item.name) : item.name;
}

/** The original product record. `priceCents` is always the untouched base price. */
export interface StoreProductBase {
  id: number;
  category: StoreCategory;
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
  displayOrder: number;
}

/** The public card shape shared by the /store page and the owner preview. */
export interface PublicStoreRank extends StoreProductBase {
  /** Price after the active promotion. Equals `priceCents` when there is no sale. */
  finalPriceCents: number;
  /** Discount actually applied to this card (0 for ranks or inactive promotions). */
  discountPercent: number;
}

/** An active rank from Rank Management that a store card can link to. */
export interface StoreLinkableRank {
  id: number;
  key: string;
  name: string;
  color: string;
  textColor: string;
  bold: boolean;
  badgeStyle: BadgeStyle;
  displayOrder: number;
  deletedAt: string | null;
}

export interface StoreRankRecord extends StoreProductBase {
  rankId: number | null;
  rank: StoreLinkableRank | null;
  enabled: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StorePromotion {
  enabled: boolean;
  discountPercent: number;
  title: string;
  description: string;
  /** Inclusive UTC day (YYYY-MM-DD) or null for no start limit. */
  startsAt: string | null;
  /** Inclusive UTC day (YYYY-MM-DD) or null for no end limit. */
  endsAt: string | null;
  theme: StoreTheme;
  /** Computed by the server; the client may recompute with `isPromotionActive`. */
  active: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface StoreState {
  ranks: StoreRankRecord[];
  /** Active ranks from Rank Management, used by the rank picker. */
  availableRanks: StoreLinkableRank[];
  promotion: StorePromotion;
  hasUnpublishedChanges: boolean;
  lastPublishedAt: string | null;
}

export function utcDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Promotions run on whole UTC days; empty dates mean open-ended. */
export function isPromotionActive(
  promotion: Pick<StorePromotion, "enabled" | "discountPercent" | "startsAt" | "endsAt">,
  now: Date = new Date(),
): boolean {
  if (!promotion.enabled) return false;
  if (
    !Number.isInteger(promotion.discountPercent) ||
    promotion.discountPercent < MIN_PROMOTION_PERCENT ||
    promotion.discountPercent > MAX_PROMOTION_PERCENT
  ) {
    return false;
  }
  const today = utcDay(now);
  if (promotion.startsAt && today < promotion.startsAt) return false;
  if (promotion.endsAt && today > promotion.endsAt) return false;
  return true;
}

/** Round to the nearest cent, so a 50% sale turns $0.65 into $0.33. */
export function salePriceCents(priceCents: number, discountPercent: number): number {
  if (priceCents <= 0 || discountPercent <= 0) return priceCents;
  const clamped = Math.min(MAX_PROMOTION_PERCENT, Math.max(0, discountPercent));
  return Math.round((priceCents * (100 - clamped)) / 100);
}

/** Applies an active sale to keys and coins only. Ranks keep their stored price. */
export function toPublicStoreRank(
  item: StoreProductBase,
  promotion: Pick<StorePromotion, "enabled" | "discountPercent" | "startsAt" | "endsAt"> | null,
  now: Date = new Date(),
): PublicStoreRank {
  const applies =
    item.category !== "rank" &&
    !item.free &&
    promotion !== null &&
    isPromotionActive(promotion, now);
  const discountPercent = applies && promotion ? promotion.discountPercent : 0;
  return {
    ...item,
    finalPriceCents:
      discountPercent > 0 ? salePriceCents(item.priceCents, discountPercent) : item.priceCents,
    discountPercent,
  };
}

export function applyStorePromotion(
  items: StoreProductBase[],
  promotion: Pick<StorePromotion, "enabled" | "discountPercent" | "startsAt" | "endsAt"> | null,
  now: Date = new Date(),
): PublicStoreRank[] {
  return items.map((item) => toPublicStoreRank(item, promotion, now));
}
