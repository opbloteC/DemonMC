import { cache } from "react";
import { unstable_cache } from "next/cache";
import { invalidateSiteData, SITE_DATA_TAG } from "./cache";
import { query, withTransaction } from "./db";

export type LogoSlot = "navbar" | "hero";

export function parseLogoSlot(value: unknown): LogoSlot | null {
  return value === "navbar" || value === "hero" ? value : null;
}

const SLOT_KEYS: Record<LogoSlot, string> = {
  navbar: "site.logo.navbar",
  hero: "site.logo.hero",
};

// Kept only so an existing single-logo selection keeps working until each
// position is explicitly changed or restored to its default.
const LEGACY_LOGO_KEY = "site.logo.active";

export interface LogoRecord {
  id: number;
  label: string;
  mime: string;
  sizeBytes: number;
  storage: "postgres" | "vercel";
  url: string | null;
  createdAt: string;
  usedInNavbar: boolean;
  usedInHero: boolean;
}

interface LogoRow {
  id: number;
  label: string;
  mime: string;
  size_bytes: number;
  storage: string;
  url: string | null;
  created_at: string;
}

interface SlotSelection {
  navbar: number | null;
  hero: number | null;
}

function publicUrl(row: LogoRow): string {
  if (row.storage === "vercel" && row.url) return row.url;
  return `/api/brand/logos/${row.id}`;
}

function mapLogo(row: LogoRow, selected: SlotSelection): LogoRecord {
  return {
    id: row.id,
    label: row.label,
    mime: row.mime,
    sizeBytes: Number(row.size_bytes),
    storage: row.storage === "vercel" ? "vercel" : "postgres",
    url: publicUrl(row),
    createdAt: row.created_at,
    usedInNavbar: row.id === selected.navbar,
    usedInHero: row.id === selected.hero,
  };
}

function parseLogoId(value: string | undefined): number | null {
  const id = Number(value ?? "");
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function slotSelection(): Promise<SlotSelection> {
  const { rows } = await query<{ key: string; value: string }>(
    "SELECT key, value FROM settings WHERE key IN ($1, $2, $3)",
    [SLOT_KEYS.navbar, SLOT_KEYS.hero, LEGACY_LOGO_KEY],
  );
  const values = new Map(rows.map((row) => [row.key, row.value]));
  const legacy = values.has(LEGACY_LOGO_KEY)
    ? parseLogoId(values.get(LEGACY_LOGO_KEY))
    : null;

  return {
    navbar: values.has(SLOT_KEYS.navbar)
      ? parseLogoId(values.get(SLOT_KEYS.navbar))
      : legacy,
    hero: values.has(SLOT_KEYS.hero) ? parseLogoId(values.get(SLOT_KEYS.hero)) : legacy,
  };
}

export async function listLogos(): Promise<LogoRecord[]> {
  const [logos, selected] = await Promise.all([
    query<LogoRow>(
      "SELECT id, label, mime, size_bytes, storage, url, created_at FROM site_logos ORDER BY id DESC",
    ),
    slotSelection(),
  ]);
  return logos.rows.map((row) => mapLogo(row, selected));
}

async function readSlotLogo(slot: LogoSlot): Promise<LogoRecord | null> {
  const selected = await slotSelection();
  const id = selected[slot];
  if (!id) return null;
  const { rows } = await query<LogoRow>(
    "SELECT id, label, mime, size_bytes, storage, url, created_at FROM site_logos WHERE id = $1",
    [id],
  );
  return rows[0] ? mapLogo(rows[0], selected) : null;
}

const slotLogoCache = unstable_cache(readSlotLogo, ["slot-logo"], {
  tags: [SITE_DATA_TAG],
  revalidate: 300,
});

export const getSlotLogo = cache(slotLogoCache);

export async function getLogo(id: number): Promise<LogoRecord | null> {
  const [logo, selected] = await Promise.all([
    query<LogoRow>(
      "SELECT id, label, mime, size_bytes, storage, url, created_at FROM site_logos WHERE id = $1",
      [id],
    ),
    slotSelection(),
  ]);
  return logo.rows[0] ? mapLogo(logo.rows[0], selected) : null;
}

export async function setSlotLogo(slot: LogoSlot, id: number | null): Promise<void> {
  const key = SLOT_KEYS[slot];

  if (id === null) {
    await query(
      "INSERT INTO settings (key, value) VALUES ($1, '') ON CONFLICT (key) DO UPDATE SET value = ''",
      [key],
    );
    invalidateSiteData();
    return;
  }

  const { rowCount } = await query("SELECT 1 FROM site_logos WHERE id = $1", [id]);
  if (rowCount === 0) throw new Error("Logo not found.");

  await query(
    "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
    [key, String(id)],
  );
  invalidateSiteData();
}

const BLOB_BASE = "https://blob.vercel-storage.com";

function blobToken(): string | null {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || null;
}

async function uploadToBlob(
  buffer: Buffer,
  mime: string,
  label: string,
): Promise<{ storage: "vercel"; url: string }> {
  const token = blobToken();
  if (!token) throw new Error("Blob storage is not configured.");

  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "logo";
  const extension =
    mime === "image/svg+xml"
      ? "svg"
      : mime === "image/png"
        ? "png"
        : mime === "image/webp"
          ? "webp"
          : "jpg";
  const pathname = `demonmc/logos/${Date.now()}-${slug}.${extension}`;

  const res = await fetch(`${BLOB_BASE}/${pathname}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "x-api-version": "7",
      "x-content-type": mime,
      "x-add-random-suffix": "0",
    },
    body: new Uint8Array(buffer),
  });

  if (!res.ok) {
    throw new Error("The logo could not be uploaded to cloud storage.");
  }

  const data = (await res.json().catch(() => null)) as { url?: unknown } | null;
  if (!data || typeof data.url !== "string" || !data.url.startsWith("https://")) {
    throw new Error("Cloud storage returned an invalid logo address.");
  }

  return { storage: "vercel", url: data.url };
}

async function deleteFromBlob(url: string): Promise<void> {
  const token = blobToken();
  if (!token) return;
  try {
    await fetch(`${BLOB_BASE}/delete`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "x-api-version": "7",
      },
      body: JSON.stringify({ urls: [url] }),
    });
  } catch (error) {
    console.error("Failed to remove logo from blob storage:", error);
  }
}

export interface StoredLogo {
  id: number;
  label: string;
  mime: string;
  sizeBytes: number;
  storage: "postgres" | "vercel";
  url: string;
}

export async function storeLogo(
  buffer: Buffer,
  mime: string,
  label: string,
): Promise<StoredLogo> {
  const now = new Date().toISOString();

  if (blobToken()) {
    const uploaded = await uploadToBlob(buffer, mime, label);
    const { rows } = await query<{ id: number }>(
      `INSERT INTO site_logos (label, mime, size_bytes, storage, url, created_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [label, mime, buffer.length, uploaded.storage, uploaded.url, now],
    );
    return {
      id: rows[0].id,
      label,
      mime,
      sizeBytes: buffer.length,
      storage: uploaded.storage,
      url: uploaded.url,
    };
  }

  return withTransaction(async (client) => {
    const inserted = await client.query<{ id: number }>(
      `INSERT INTO site_logos (label, mime, size_bytes, storage, url, created_at)
       VALUES ($1, $2, $3, 'postgres', NULL, $4) RETURNING id`,
      [label, mime, buffer.length, now],
    );
    const id = inserted.rows[0].id;
    await client.query("INSERT INTO site_logo_files (logo_id, data) VALUES ($1, $2)", [
      id,
      buffer,
    ]);
    return {
      id,
      label,
      mime,
      sizeBytes: buffer.length,
      storage: "postgres" as const,
      url: `/api/brand/logos/${id}`,
    };
  });
}

export async function deleteLogo(id: number): Promise<void> {
  const logo = await getLogo(id);
  if (!logo) throw new Error("Logo not found.");
  if (logo.usedInNavbar || logo.usedInHero) {
    throw new Error(
      "This logo is still used by the navbar or homepage hero. Choose another logo for those positions first.",
    );
  }

  await query("DELETE FROM site_logos WHERE id = $1", [id]);
  if (logo.storage === "vercel" && logo.url) {
    await deleteFromBlob(logo.url);
  }
}

export async function readLogoFile(id: number): Promise<{ data: Buffer; mime: string } | null> {
  const { rows } = await query<{ data: Buffer; mime: string }>(
    `SELECT f.data, l.mime
     FROM site_logo_files f
     JOIN site_logos l ON l.id = f.logo_id
     WHERE f.logo_id = $1`,
    [id],
  );
  const row = rows[0];
  return row ? { data: row.data, mime: row.mime } : null;
}
