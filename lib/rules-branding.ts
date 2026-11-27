import { cache } from "react";
import { unstable_cache } from "next/cache";
import { getBranding } from "./branding";
import { invalidateSiteData, SITE_DATA_TAG } from "./cache";
import { query } from "./db";
import { MAX_RULES_BRAND_LENGTH } from "./rules-branding-types";

export const RULES_BRAND_KEY = "rules.brand.name";

export async function defaultRulesBrandName(): Promise<string> {
  const branding = await getBranding();
  return `${branding.name} Server Rules`;
}

export class RulesBrandingError extends Error {
  status: number;

  constructor(message: string, status = 422) {
    super(message);
    this.name = "RulesBrandingError";
    this.status = status;
  }
}

export function normalizeRulesBrandName(value: unknown): string {
  if (typeof value !== "string") {
    throw new RulesBrandingError("Enter a rules page name.");
  }
  const name = value.replace(/\s+/g, " ").trim();
  if (name.length < 2) {
    throw new RulesBrandingError("Rules page name must be at least 2 characters.");
  }
  if (name.length > MAX_RULES_BRAND_LENGTH) {
    throw new RulesBrandingError(
      `Rules page name must be ${MAX_RULES_BRAND_LENGTH} characters or fewer.`,
    );
  }
  return name;
}

async function readRulesBrandName(): Promise<string> {
  const { rows } = await query<{ value: string }>(
    "SELECT value FROM settings WHERE key = $1",
    [RULES_BRAND_KEY],
  );
  const stored = rows[0]?.value?.replace(/\s+/g, " ").trim();
  if (!stored || stored.length < 2 || stored.length > MAX_RULES_BRAND_LENGTH) {
    return defaultRulesBrandName();
  }
  return stored;
}

const rulesBrandCache = unstable_cache(readRulesBrandName, ["rules-brand-name"], {
  tags: [SITE_DATA_TAG],
  revalidate: 300,
});

export const getRulesBrandName = cache(rulesBrandCache);

export async function saveRulesBrandName(value: unknown): Promise<string> {
  const name = normalizeRulesBrandName(value);
  await query(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [RULES_BRAND_KEY, name],
  );
  invalidateSiteData();
  return name;
}

export async function resetRulesBrandName(): Promise<string> {
  await query("DELETE FROM settings WHERE key = $1", [RULES_BRAND_KEY]);
  invalidateSiteData();
  return defaultRulesBrandName();
}
