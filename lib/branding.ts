import { cache } from "react";
import { unstable_cache } from "next/cache";
import { invalidateSiteData, SITE_DATA_TAG } from "./cache";
import {
  DEFAULT_BRAND_NAME,
  MAX_BRAND_DESCRIPTION_LENGTH,
  MAX_BRAND_NAME_LENGTH,
  MAX_BRAND_TITLE_LENGTH,
  splitBrandName,
} from "./branding-config";
import { query } from "./db";

export {
  DEFAULT_BRAND_NAME,
  MAX_BRAND_DESCRIPTION_LENGTH,
  MAX_BRAND_NAME_LENGTH,
  MAX_BRAND_TITLE_LENGTH,
  splitBrandName,
} from "./branding-config";

const DEFAULT_SITE_TITLE = "{brand} — Your Adventure. Your Legacy.";
const DEFAULT_META_DESCRIPTION =
  "{brand} is a Minecraft network built for competitive players. Join at {ip} and build your legacy.";

export const BRAND_KEYS = {
  name: "brand.name",
  siteTitle: "brand.site.title",
  metaDescription: "brand.meta.description",
  navbar: "brand.navbar.name",
  hero: "brand.hero.name",
  login: "brand.login.name",
  footer: "brand.footer.name",
} as const;

export const BRAND_DRAFT_KEY = "brand.draft";
const ALL_KEYS = Object.values(BRAND_KEYS);

export interface BrandOverrides {
  navbar: string;
  hero: string;
  login: string;
  footer: string;
}

export interface Branding {
  /** The master brand name shown wherever no independent override is set. */
  name: string;
  /** Effective navbar name (override or master). */
  navbar: string;
  /** Effective homepage hero name (override or master). */
  hero: string;
  /** Effective login/registration name (override or master). */
  login: string;
  /** Effective footer name (override or master). */
  footer: string;
  /** Browser tab / search title with {brand} tokens resolved. */
  siteTitle: string;
  /** Search description with {brand} and {ip} tokens resolved. */
  metaDescription: string;
  overrides: BrandOverrides;
}

export interface BrandingEditor extends Branding {
  /** Raw override values; empty means "inherit the master brand name". */
  rawOverrides: BrandOverrides;
  rawSiteTitle: string;
  rawMetaDescription: string;
}

export interface BrandingState {
  published: BrandingEditor;
  draft: BrandingEditor;
  hasDraft: boolean;
}

function compact(value: string | undefined, max: number): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function validName(value: string | undefined): string | null {
  const name = compact(value, MAX_BRAND_NAME_LENGTH);
  return name.length >= 2 ? name : null;
}

export function brandTokens(branding: Pick<Branding, "name" | "navbar" | "hero" | "login" | "footer">) {
  return {
    brand: branding.name,
    brandUpper: branding.name.toUpperCase(),
    brandNavbar: branding.navbar,
    brandHero: branding.hero,
    brandLogin: branding.login,
    brandFooter: branding.footer,
  } satisfies Record<string, string>;
}

/** Replace {brand} style tokens and leave unknown placeholders intact. */
export function fillBrandTokens(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, token: string) =>
    Object.prototype.hasOwnProperty.call(values, token) ? values[token] : match,
  );
}

export function resolveBranding(
  raw: Partial<Record<keyof typeof BRAND_KEYS, string>>,
): BrandingEditor {
  const name = validName(raw.name) ?? DEFAULT_BRAND_NAME;
  const overrides: BrandOverrides = {
    navbar: compact(raw.navbar, MAX_BRAND_NAME_LENGTH),
    hero: compact(raw.hero, MAX_BRAND_NAME_LENGTH),
    login: compact(raw.login, MAX_BRAND_NAME_LENGTH),
    footer: compact(raw.footer, MAX_BRAND_NAME_LENGTH),
  };
  const effective = {
    name,
    navbar: overrides.navbar.length >= 2 ? overrides.navbar : name,
    hero: overrides.hero.length >= 2 ? overrides.hero : name,
    login: overrides.login.length >= 2 ? overrides.login : name,
    footer: overrides.footer.length >= 2 ? overrides.footer : name,
  };
  const tokens = brandTokens(effective);
  const rawSiteTitle = compact(raw.siteTitle, MAX_BRAND_TITLE_LENGTH) || DEFAULT_SITE_TITLE;
  const rawMetaDescription =
    compact(raw.metaDescription, MAX_BRAND_DESCRIPTION_LENGTH) || DEFAULT_META_DESCRIPTION;

  return {
    ...effective,
    siteTitle: fillBrandTokens(rawSiteTitle, tokens),
    metaDescription: fillBrandTokens(rawMetaDescription, tokens),
    overrides,
    rawOverrides: overrides,
    rawSiteTitle,
    rawMetaDescription,
  };
}

function editorFromRowMap(map: Map<string, string>): BrandingEditor {
  return resolveBranding({
    name: map.get(BRAND_KEYS.name),
    siteTitle: map.get(BRAND_KEYS.siteTitle),
    metaDescription: map.get(BRAND_KEYS.metaDescription),
    navbar: map.get(BRAND_KEYS.navbar),
    hero: map.get(BRAND_KEYS.hero),
    login: map.get(BRAND_KEYS.login),
    footer: map.get(BRAND_KEYS.footer),
  });
}

async function readBranding(): Promise<BrandingEditor> {
  const { rows } = await query<{ key: string; value: string }>(
    "SELECT key, value FROM settings WHERE key = ANY($1::text[])",
    [ALL_KEYS],
  );
  return editorFromRowMap(new Map(rows.map((row) => [row.key, row.value])));
}

const brandingCache = unstable_cache(readBranding, ["site-branding"], {
  tags: [SITE_DATA_TAG],
  revalidate: 300,
});

export const getBranding = cache(brandingCache);

function draftFromJson(published: BrandingEditor, raw: string | undefined): BrandingEditor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Record<keyof BrandingInput, unknown>>;
    if (!parsed || typeof parsed !== "object") return null;
    const values: Record<string, string> = {
      name: published.name,
      siteTitle: published.rawSiteTitle,
      metaDescription: published.rawMetaDescription,
      navbar: published.rawOverrides.navbar,
      hero: published.rawOverrides.hero,
      login: published.rawOverrides.login,
      footer: published.rawOverrides.footer,
    };
    for (const key of Object.keys(values) as Array<keyof BrandingInput>) {
      if (typeof parsed[key] === "string") values[key] = parsed[key] as string;
    }
    return resolveBranding(values);
  } catch {
    return null;
  }
}

export const getBrandingState = cache(async (): Promise<BrandingState> => {
  const { rows } = await query<{ key: string; value: string }>(
    "SELECT key, value FROM settings WHERE key = ANY($1::text[])",
    [[...ALL_KEYS, BRAND_DRAFT_KEY]],
  );
  const map = new Map(rows.map((row) => [row.key, row.value]));
  const published = editorFromRowMap(map);
  const draft = draftFromJson(published, map.get(BRAND_DRAFT_KEY)) ?? published;
  return {
    published,
    draft,
    hasDraft: Boolean(map.get(BRAND_DRAFT_KEY)),
  };
});

export class BrandingError extends Error {
  status: number;

  constructor(message: string, status = 422) {
    super(message);
    this.name = "BrandingError";
    this.status = status;
  }
}

export interface BrandingInput {
  name: string;
  siteTitle: string;
  metaDescription: string;
  navbar: string;
  hero: string;
  login: string;
  footer: string;
}

function requiredText(value: unknown, label: string, max: number, min = 2): string {
  if (typeof value !== "string") throw new BrandingError(`${label} is required.`);
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length < min) throw new BrandingError(`${label} must be at least ${min} characters.`);
  if (text.length > max) throw new BrandingError(`${label} must be ${max} characters or fewer.`);
  return text;
}

function optionalText(value: unknown, label: string): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new BrandingError(`${label} must be text.`);
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length === 1) throw new BrandingError(`${label} must be at least 2 characters or empty.`);
  if (text.length > MAX_BRAND_NAME_LENGTH) {
    throw new BrandingError(`${label} must be ${MAX_BRAND_NAME_LENGTH} characters or fewer.`);
  }
  return text;
}

export function normalizeBrandingInput(input: Partial<Record<keyof BrandingInput, unknown>>): BrandingInput {
  return {
    name: requiredText(input.name, "Brand name", MAX_BRAND_NAME_LENGTH),
    siteTitle: requiredText(input.siteTitle, "Website title", MAX_BRAND_TITLE_LENGTH),
    metaDescription: requiredText(
      input.metaDescription,
      "Meta description",
      MAX_BRAND_DESCRIPTION_LENGTH,
    ),
    navbar: optionalText(input.navbar, "Navbar brand name"),
    hero: optionalText(input.hero, "Homepage hero brand name"),
    login: optionalText(input.login, "Login and registration brand name"),
    footer: optionalText(input.footer, "Footer brand name"),
  };
}

export function draftFromEditor(editor: BrandingEditor): BrandingInput {
  return {
    name: editor.name,
    siteTitle: editor.rawSiteTitle,
    metaDescription: editor.rawMetaDescription,
    navbar: editor.rawOverrides.navbar,
    hero: editor.rawOverrides.hero,
    login: editor.rawOverrides.login,
    footer: editor.rawOverrides.footer,
  };
}

export async function saveBrandingDraft(input: BrandingInput): Promise<BrandingEditor> {
  await query(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    [BRAND_DRAFT_KEY, JSON.stringify(input)],
  );
  return resolveBranding(input);
}

export async function publishBranding(input: BrandingInput): Promise<BrandingEditor> {
  const entries = Object.entries(input) as Array<[keyof BrandingInput, string]>;
  for (const [field, value] of entries) {
    const key = BRAND_KEYS[field];
    if (value) {
      await query(
        `INSERT INTO settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
        [key, value],
      );
    } else {
      await query("DELETE FROM settings WHERE key = $1", [key]);
    }
  }
  await query("DELETE FROM settings WHERE key = $1", [BRAND_DRAFT_KEY]);
  invalidateSiteData();
  // Resolve the freshly published values directly so the caller does not read a stale cache.
  return resolveBranding(input);
}

export async function discardBrandingDraft(): Promise<void> {
  await query("DELETE FROM settings WHERE key = $1", [BRAND_DRAFT_KEY]);
}

export async function resetBranding(): Promise<BrandingEditor> {
  await query("DELETE FROM settings WHERE key = ANY($1::text[])", [
    [...ALL_KEYS, BRAND_DRAFT_KEY],
  ]);
  invalidateSiteData();
  return resolveBranding({});
}
