export type ThemePreference = "light" | "dark" | "rainy";

export const THEME_STORAGE_KEY = "demonmc-theme";
export const THEME_WELCOME_KEY = "demonmc-theme-welcome";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "rainy";
}

export function getSavedTheme(): ThemePreference | null {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (value === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return isThemePreference(value) ? value : null;
  } catch {
    return null;
  }
}

export function saveTheme(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // the theme still applies for this visit even if it cannot be persisted
  }
}

export function hasCompletedWelcome(): boolean {
  try {
    return window.localStorage.getItem(THEME_WELCOME_KEY) === "done";
  } catch {
    return false;
  }
}

export function completeWelcome(): void {
  try {
    window.localStorage.setItem(THEME_WELCOME_KEY, "done");
  } catch {
    // the popup stays gone for this page view; storage may be unavailable
  }
}

export function paintsDark(preference: ThemePreference): boolean {
  return preference === "dark" || preference === "rainy";
}

export function applyTheme(preference: ThemePreference): void {
  const dark = paintsDark(preference);
  const root = document.documentElement;
  root.setAttribute("data-theme", dark ? "dark" : "light");
  root.setAttribute("data-theme-pref", preference);
  root.setAttribute("data-weather", preference === "rainy" ? "rainy" : "clear");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#060d1f" : "#e7ece9");
}
