export const DEFAULT_RULES_BRAND_NAME = "DEMONMC SERVER RULES";
export const MAX_RULES_BRAND_LENGTH = 40;

/** Splits the editable rules name so the final word can carry the orange accent. */
export function splitRulesBrandName(value: string): { leading: string; accent: string } {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return splitRulesBrandName(DEFAULT_RULES_BRAND_NAME);
  if (words.length === 1) return { leading: "", accent: words[0] };
  return { leading: words.slice(0, -1).join(" "), accent: words[words.length - 1] };
}
