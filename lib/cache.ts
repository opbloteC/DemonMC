import { revalidateTag } from "next/cache";

/**
 * Public, non-personalized site data (branding, copy, rules, store cards and
 * server status) shares one cache tag so any owner or staff edit can invalidate
 * all of it without touching account or session data.
 */
export const SITE_DATA_TAG = "demonmc-site-data";

export function invalidateSiteData(): void {
  try {
    revalidateTag(SITE_DATA_TAG);
  } catch {
    // Writers run inside route handlers; this only guards non-request callers.
  }
}
