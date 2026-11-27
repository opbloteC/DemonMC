import { cache } from "react";
import { unstable_cache } from "next/cache";
import { invalidateSiteData, SITE_DATA_TAG } from "./cache";
import { DEFAULT_SETTINGS, query, withTransaction } from "./db";
import type { SiteSettings } from "./types";

const KEYS = {
  headline: "site.headline",
  subtitle: "site.subtitle",
  ip: "site.ip",
  discord: "site.discord",
} as const;

// Seeded before branding tokens existed; treat it as the built-in default so renames follow.
const LEGACY_DEFAULT_HEADLINE = "YOUR ADVENTURE. YOUR LEGACY. YOUR DEMONMC.";

function headline(value: string | undefined): string {
  const stored = value ?? DEFAULT_SETTINGS[KEYS.headline];
  return stored.trim().toUpperCase() === LEGACY_DEFAULT_HEADLINE
    ? DEFAULT_SETTINGS[KEYS.headline]
    : stored;
}

async function readSettings(): Promise<SiteSettings> {
  const { rows } = await query<{ key: string; value: string }>(
    "SELECT key, value FROM settings",
  );
  const map = new Map(rows.map((row) => [row.key, row.value]));
  return {
    headline: headline(map.get(KEYS.headline)),
    subtitle: map.get(KEYS.subtitle) ?? DEFAULT_SETTINGS[KEYS.subtitle],
    ip: map.get(KEYS.ip) ?? DEFAULT_SETTINGS[KEYS.ip],
    discord: map.get(KEYS.discord) ?? DEFAULT_SETTINGS[KEYS.discord],
  };
}

const settingsCache = unstable_cache(readSettings, ["site-settings"], {
  tags: [SITE_DATA_TAG],
  revalidate: 300,
});

export const getSettings = cache(settingsCache);

export async function updateSettings(patch: Partial<SiteSettings>): Promise<SiteSettings> {
  await withTransaction(async (client) => {
    for (const [field, key] of Object.entries(KEYS) as [keyof SiteSettings, string][]) {
      const value = patch[field];
      if (typeof value === "string") {
        await client.query(
          "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
          [key, value],
        );
      }
    }
  });
  invalidateSiteData();
  return readSettings();
}
