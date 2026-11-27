import { normalizeHexColor } from "./rank-admin";
import { StoreAdminError, type StorePromotionInput, type StoreRankPatch } from "./store";
import {
  isStoreCardStyle,
  isStoreCategory,
  isStoreDesign,
  isStoreTheme,
  MAX_PROMOTION_DESCRIPTION_LENGTH,
  MAX_PROMOTION_PERCENT,
  MAX_PROMOTION_TITLE_LENGTH,
  MAX_STORE_PRICE_CENTS,
  MIN_PROMOTION_PERCENT,
  type StoreCategory,
} from "./store-types";
import { isIsoDate, text } from "./validation";

export type StorePatch = StoreRankPatch & { category?: StoreCategory };

function hex(value: unknown, label: string): string {
  const color = normalizeHexColor(value);
  if (!color) throw new StoreAdminError(`${label} must be a six-digit HEX color.`, 422);
  return color;
}

function price(value: unknown): number {
  const cents = Number(value);
  if (!Number.isInteger(cents) || cents < 0 || cents > MAX_STORE_PRICE_CENTS) {
    throw new StoreAdminError("Price must be between $0.00 and $999.99.", 422);
  }
  return cents;
}

/**
 * Validates manager input for a store card. Pass `requireAll` when creating;
 * otherwise only the provided keys are validated for a partial update.
 */
export function parseStoreInput(
  body: Record<string, unknown>,
  requireAll: boolean,
): StorePatch {
  const patch: StorePatch = {};
  const has = (key: string) => requireAll || key in body;

  if (has("category")) {
    if (!isStoreCategory(body.category)) {
      throw new StoreAdminError("Choose a valid store category.", 422);
    }
    patch.category = body.category;
  }

  const category = patch.category ?? "rank";

  if (category === "rank" && has("rankId")) {
    const rankId = Number(body.rankId);
    if (!Number.isInteger(rankId) || rankId <= 0) {
      throw new StoreAdminError("Choose a rank from Rank Management.", 422);
    }
    patch.rankId = rankId;
  }

  if (has("name")) {
    const name = text(body.name, 2, 40);
    if (!name) throw new StoreAdminError("Store name must be between 2 and 40 characters.", 422);
    patch.name = name;
  }

  if (has("description")) {
    const description = text(body.description, 2, 300);
    if (!description) {
      throw new StoreAdminError("Description must be between 2 and 300 characters.", 422);
    }
    patch.description = description;
  }

  if (has("priceCents")) patch.priceCents = price(body.priceCents);

  if (has("free")) {
    if (typeof body.free !== "boolean") {
      throw new StoreAdminError("Free must be true or false.", 422);
    }
    if (category !== "rank" && body.free) {
      throw new StoreAdminError("Keys and coins are always paid products.", 422);
    }
    patch.free = body.free;
  }

  if (has("style")) {
    if (!isStoreCardStyle(body.style)) {
      throw new StoreAdminError("Choose a valid card color style.", 422);
    }
    patch.style = body.style;
  }

  if (has("color")) patch.color = hex(body.color, "Accent color");
  if (has("gradientFrom")) patch.gradientFrom = hex(body.gradientFrom, "Gradient start");
  if (has("gradientTo")) patch.gradientTo = hex(body.gradientTo, "Gradient end");

  if (has("design")) {
    if (!isStoreDesign(body.design)) {
      throw new StoreAdminError("Choose a valid card design.", 422);
    }
    patch.design = body.design;
  }

  if (has("buttonLabel")) {
    const buttonLabel = text(body.buttonLabel, 2, 24);
    if (!buttonLabel) {
      throw new StoreAdminError("Button text must be between 2 and 24 characters.", 422);
    }
    patch.buttonLabel = buttonLabel;
  }

  if (has("enabled")) {
    if (typeof body.enabled !== "boolean") {
      throw new StoreAdminError("Enabled must be true or false.", 422);
    }
    patch.enabled = body.enabled;
  }

  return patch;
}

export function parsePromotionInput(body: Record<string, unknown>): StorePromotionInput {
  if (typeof body.enabled !== "boolean") {
    throw new StoreAdminError("Promotion enabled must be true or false.", 422);
  }

  const discountPercent = Number(body.discountPercent);
  if (
    !Number.isInteger(discountPercent) ||
    discountPercent < MIN_PROMOTION_PERCENT ||
    discountPercent > MAX_PROMOTION_PERCENT
  ) {
    throw new StoreAdminError(
      `Discount must be a whole number between ${MIN_PROMOTION_PERCENT}% and ${MAX_PROMOTION_PERCENT}%.`,
      422,
    );
  }

  const title = text(body.title, 2, MAX_PROMOTION_TITLE_LENGTH);
  if (!title) {
    throw new StoreAdminError(
      `Promotion title must be between 2 and ${MAX_PROMOTION_TITLE_LENGTH} characters.`,
      422,
    );
  }

  let description = "";
  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== "string") {
      throw new StoreAdminError("Promotion description must be text.", 422);
    }
    description = body.description.trim();
    if (description.length > MAX_PROMOTION_DESCRIPTION_LENGTH) {
      throw new StoreAdminError(
        `Promotion description can be at most ${MAX_PROMOTION_DESCRIPTION_LENGTH} characters.`,
        422,
      );
    }
  }

  const date = (value: unknown, label: string): string | null => {
    if (value === null || value === undefined || value === "") return null;
    if (!isIsoDate(value)) {
      throw new StoreAdminError(`${label} must be a real date (YYYY-MM-DD).`, 422);
    }
    return value;
  };

  const startsAt = date(body.startsAt, "Sale start date");
  const endsAt = date(body.endsAt, "Sale end date");
  if (startsAt && endsAt && startsAt > endsAt) {
    throw new StoreAdminError("The sale end date must be on or after the start date.", 422);
  }

  if (!isStoreTheme(body.theme)) {
    throw new StoreAdminError("Choose a valid store theme.", 422);
  }

  return {
    enabled: body.enabled,
    discountPercent,
    title,
    description,
    startsAt,
    endsAt,
    theme: body.theme,
  };
}
