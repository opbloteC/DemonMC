import { cache } from "react";
import { unstable_cache } from "next/cache";
import { invalidateSiteData, SITE_DATA_TAG } from "./cache";
import { query, withTransaction } from "./db";
import { toSmallCapsIp } from "./ip-display-format";

const DISPLAY_KEY = "site.ip.display";
const GLOBE_KEY = "site.ip.showGlobe";

export interface IpDisplaySettings {
  /** Empty means the display follows the real server address in small caps. */
  displayText: string;
  showGlobe: boolean;
}

export function effectiveIpDisplayText(ip: string, displayText: string): string {
  const custom = displayText.trim();
  return custom || toSmallCapsIp(ip);
}

async function readIpDisplaySettings(): Promise<IpDisplaySettings> {
  const { rows } = await query<{ key: string; value: string }>(
    "SELECT key, value FROM settings WHERE key = ANY($1)",
    [[DISPLAY_KEY, GLOBE_KEY]],
  );
  const map = new Map(rows.map((row) => [row.key, row.value]));
  return {
    displayText: map.get(DISPLAY_KEY) ?? "",
    showGlobe: (map.get(GLOBE_KEY) ?? "true") !== "false",
  };
}

const ipDisplayCache = unstable_cache(readIpDisplaySettings, ["site-ip-display"], {
  tags: [SITE_DATA_TAG],
  revalidate: 300,
});

export const getIpDisplaySettings = cache(ipDisplayCache);

export async function saveIpDisplaySettings(
  displayText: string,
  showGlobe: boolean,
): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
      [DISPLAY_KEY, displayText],
    );
    await client.query(
      "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
      [GLOBE_KEY, showGlobe ? "true" : "false"],
    );
  });
  invalidateSiteData();
}
