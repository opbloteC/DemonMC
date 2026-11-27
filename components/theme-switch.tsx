"use client";

import { useEffect, useState } from "react";
import {
  applyTheme,
  getSavedTheme,
  isThemePreference,
  saveTheme,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "@/lib/theme-preference";

export type { ThemePreference } from "@/lib/theme-preference";

const OPTIONS = [
  { value: "light", label: "Light", emoji: "☀️" },
  { value: "dark", label: "Dark", emoji: "🌙" },
  { value: "rainy", label: "Rainy", emoji: "🌧️" },
] as const;

function readPreference(): ThemePreference {
  const attribute = document.documentElement.getAttribute("data-theme-pref");
  if (isThemePreference(attribute)) return attribute;
  const stored = getSavedTheme();
  return stored ?? "light";
}

export function ThemeSwitch() {
  // Deterministic initial state keeps SSR and hydration in sync; the mount
  // effect below picks up whatever preference is live.
  const [preference, setPreference] = useState<ThemePreference>("light");

  useEffect(() => {
    setPreference(readPreference());
    const sync = () => setPreference(readPreference());
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme-pref"],
    });
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY || !isThemePreference(event.newValue)) return;
      setPreference(event.newValue);
      applyTheme(event.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => {
      observer.disconnect();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  function choose(next: ThemePreference) {
    setPreference(next);
    saveTheme(next);
    applyTheme(next);
  }

  return (
    <div className="mt-4 rounded-2xl border border-aqua-200/80 bg-white/85 px-4 py-3.5 shadow-card sm:px-5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-sm font-bold text-navy-900">Theme</p>
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-navy-400">
          {OPTIONS.find((option) => option.value === preference)?.label}
        </span>
      </div>

      <div
        role="group"
        aria-label="Color theme"
        className="mt-2.5 grid grid-cols-3 gap-1 rounded-xl border border-aqua-200/80 bg-aqua-50/80 p-1"
      >
        {OPTIONS.map(({ value, label, emoji }) => {
          const selected = preference === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => choose(value)}
              aria-label={`${label} mode`}
              aria-pressed={selected}
              title={`${label} mode`}
              className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-deep/60 active:scale-95 ${
                selected
                  ? "bg-sun-deep text-white shadow-[0_6px_14px_-6px_rgba(242,112,28,0.85)]"
                  : "text-navy-500 hover:bg-white hover:text-navy-900"
              }`}
            >
              <span aria-hidden="true" className="text-[13px] leading-none">
                {emoji}
              </span>
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
