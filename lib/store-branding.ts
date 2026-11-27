import { cache } from "react";
import { unstable_cache } from "next/cache";
import { getBranding } from "./branding";
import { invalidateSiteData, SITE_DATA_TAG } from "./cache";
import { query } from "./db";
import { MAX_STORE_BRAND_LENGTH } from "./store-types";

export async function defaultStoreBrandName(): Promise<string> {
  const branding = await getBranding();
  return `${branding.name} Store`;
}

export const STORE_BRAND_KEY = "store.brand.name";

export class StoreBrandingError extends Error {
  status: number;

  constructor(message: string, status = 422) {
    super(message);
    this.name = "StoreBrandingError";
    this.status = status;
  }
}

export function normalizeStoreBrandName(value: unknown): string {
  if (typeof value !== "string") {
    throw new StoreBrandingError("Enter a store name.");
  }
  const name = value.replace(/\s+/g, " ").trim();
  if (name.length < 2) {
    throw new StoreBrandingError("Store name must be at least 2 characters.");
  }
  if (name.length > MAX_STORE_BRAND_LENGTH) {
    throw new StoreBrandingError(
      `Store name must be ${MAX_STORE_BRAND_LENGTH} characters or fewer.`,
    );
  }
  return name;
}

async function readStoreBrandName(): Promise<string> {
  const { rows } = await query<{ value: string }>(
    "SELECT value FROM settings WHERE key = $1",
    [STORE_BRAND_KEY],
  );
  const stored = rows[0]?.value?.replace(/\s+/g, " ").trim();
  if (!stored || stored.length < 2 || stored.length > MAX_STORE_BRAND_LENGTH) {
    return defaultStoreBrandName();
  }
  return stored;
}

const storeBrandCache = unstable_cache(readStoreBrandName, ["store-brand-name"], {
  tags: [SITE_DATA_TAG],
  revalidate: 300,
});

export const getStoreBrandName = cache(storeBrandCache);

export async function saveStoreBrandName(value: unknown): Promise<string> {
  const name = normalizeStoreBrandName(value);
  await query(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [STORE_BRAND_KEY, name],
  );
  invalidateSiteData();
  return name;
}

export async function resetStoreBrandName(): Promise<string> {
  await query("DELETE FROM settings WHERE key = $1", [STORE_BRAND_KEY]);
  invalidateSiteData();
  return defaultStoreBrandName();
}
