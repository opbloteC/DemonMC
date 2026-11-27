export const DEFAULT_BRAND_NAME = "DemonMC";
export const MAX_BRAND_NAME_LENGTH = 40;
export const MAX_BRAND_TITLE_LENGTH = 120;
export const MAX_BRAND_DESCRIPTION_LENGTH = 240;

export function splitBrandName(value: string): { leading: string; accent: string } {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return { leading: "", accent: DEFAULT_BRAND_NAME };
  const words = normalized.split(" ");
  if (words.length > 1) {
    return { leading: words.slice(0, -1).join(" "), accent: words[words.length - 1] };
  }
  const suffix = normalized.match(/^(.*?)([A-Z]{2,}|[A-Z][a-z]+)$/);
  if (suffix && suffix[1]) return { leading: suffix[1], accent: suffix[2] };
  return { leading: "", accent: normalized };
}
