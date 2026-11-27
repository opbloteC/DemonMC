import { NextResponse } from "next/server";
import {
  jsonError,
  mutationGuard,
  readJson,
  requireAnyPermission,
  requirePermission,
} from "@/lib/api";
import { invalidateSiteData } from "@/lib/cache";
import {
  CONTENT_FIELDS,
  contentPagesForEditor,
  DEFAULT_CONTENT,
  getContent,
  normalizeAndValidateContent,
} from "@/lib/content";
import { DEFAULT_SETTINGS, query, withTransaction } from "@/lib/db";
import { updateSettings } from "@/lib/settings";
import {
  isDiscordInvite,
  isServerAddress,
  text,
} from "@/lib/validation";
import type { SiteSettings } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validateSettingsField(field: string, value: string) {
  switch (field) {
    case "site.headline": {
      const parsed = text(value, 3, 90);
      return parsed ? { ok: true as const, value: parsed } : { ok: false as const, error: "Headline must be between 3 and 90 characters." };
    }
    case "site.subtitle": {
      const parsed = text(value, 3, 140);
      return parsed ? { ok: true as const, value: parsed } : { ok: false as const, error: "Subtitle must be between 3 and 140 characters." };
    }
    case "site.ip":
      return isServerAddress(value)
        ? { ok: true as const, value }
        : { ok: false as const, error: "Enter a valid server address, for example play.demonmc.net." };
    case "site.discord":
      return isDiscordInvite(value)
        ? { ok: true as const, value }
        : { ok: false as const, error: "Enter a valid Discord invite link." };
    default:
      return { ok: true as const, value };
  }
}

export async function GET() {
  const auth = await requireAnyPermission(["website.content.edit", "website.access"]);
  if (auth.response) return auth.response;

  const content = await getContent();
  return NextResponse.json(
    { pages: contentPagesForEditor(content) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(req: Request) {
  const auth = await requirePermission("website.content.edit");
  if (auth.response) return auth.response;

  const guard = mutationGuard(req);
  if (guard) return guard;

  const body = await readJson(req);
  if (!body) return jsonError("Invalid request body.");

  const values = body.values;
  if (!values || typeof values !== "object" || Array.isArray(values)) {
    return jsonError("Send the content fields to update.", 422);
  }

  const writes: Array<[string, string]> = [];
  const settingsPatch: Partial<SiteSettings> = {};

  for (const [key, raw] of Object.entries(values as Record<string, unknown>)) {
    const field = CONTENT_FIELDS.get(key);
    if (!field) return jsonError("Unknown content field.", 422);

    const result = field.settingsField
      ? validateSettingsField(key, typeof raw === "string" ? raw.trim() : "")
      : normalizeAndValidateContent(key, raw);

    if (!result.ok) return jsonError(result.error, 422);

    if (field.settingsField) {
      settingsPatch[field.settingsField as keyof SiteSettings] = result.value;
    } else {
      writes.push([key, result.value]);
    }
  }

  if (writes.length === 0 && Object.keys(settingsPatch).length === 0) {
    return jsonError("No changes provided.", 422);
  }

  const now = new Date().toISOString();
  if (writes.length > 0) {
    await withTransaction(async (client) => {
      for (const [key, value] of writes) {
        await client.query(
          `INSERT INTO site_content (key, value, updated_at) VALUES ($1, $2, $3)
           ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
          [key, value, now],
        );
      }
    });
  }

  if (Object.keys(settingsPatch).length > 0) {
    await updateSettings(settingsPatch);
  }
  invalidateSiteData();

  return NextResponse.json(
    { ok: true, saved: writes.length + Object.keys(settingsPatch).length },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: Request) {
  const auth = await requirePermission("website.content.edit");
  if (auth.response) return auth.response;

  const guard = mutationGuard(req);
  if (guard) return guard;

  const body = await readJson(req);
  if (!body) return jsonError("Invalid request body.");

  const keys = body.keys;
  if (!Array.isArray(keys) || keys.length === 0) {
    return jsonError("Choose the fields to reset.", 422);
  }

  const contentKeys: string[] = [];
  const settingsPatch: Partial<SiteSettings> = {};

  for (const rawKey of keys) {
    if (typeof rawKey !== "string") return jsonError("Invalid content field.", 422);
    const field = CONTENT_FIELDS.get(rawKey);
    if (!field) return jsonError("Unknown content field.", 422);
    if (field.settingsField) {
      settingsPatch[field.settingsField as keyof SiteSettings] =
        DEFAULT_SETTINGS[rawKey] ?? DEFAULT_CONTENT[rawKey] ?? "";
    } else {
      contentKeys.push(rawKey);
    }
  }

  if (contentKeys.length > 0) {
    await query("DELETE FROM site_content WHERE key = ANY($1::text[])", [contentKeys]);
  }
  if (Object.keys(settingsPatch).length > 0) {
    await updateSettings(settingsPatch);
  }
  invalidateSiteData();

  return NextResponse.json(
    { ok: true, reset: keys.length },
    { headers: { "Cache-Control": "no-store" } },
  );
}
