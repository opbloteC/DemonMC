"use client";

import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "@/components/icons";
import {
  applyTheme,
  isThemePreference,
  saveTheme,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "@/lib/theme-preference";

const CYCLE: ThemePreference[] = ["light", "dark", "rainy"];

const LABELS: Record<ThemePreference, string> = {
  light: "Light",
  dark: "Dark",
  rainy: "Rainy",
};

function RainIcon({ width = 18, height = 18, className = "" }: { width?: number; height?: number; className?: string }) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M17.5 15a4.5 4.5 0 1 0-.44-8.98 6 6 0 0 0-11.4 2.2A3.8 3.8 0 0 0 6 15" />
      <path d="M8 18.5 7 21" />
      <path d="m12.5 18.5-1 2.5" />
      <path d="m17 18.5-1 2.5" />
    </svg>
  );
}

function readPreference(): ThemePreference {
  const attribute = document.documentElement.getAttribute("data-theme-pref");
  if (isThemePreference(attribute)) return attribute;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemePreference(stored)) return stored;
  } catch {
    // storage may be unavailable; fall through to the default
  }
  return "light";
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  // Start deterministic so SSR and hydration agree, then sync to the live
  // preference on mount; the visible icon is already driven by CSS.
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
      if (event.key !== THEME_STORAGE_KEY) return;
      if (!isThemePreference(event.newValue)) return;
      setPreference(event.newValue);
      applyTheme(event.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => {
      observer.disconnect();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const next = CYCLE[(CYCLE.indexOf(preference) + 1) % CYCLE.length];

  function chooseNext() {
    setPreference(next);
    saveTheme(next);
    applyTheme(next);
  }

  return (
    <button
      type="button"
      onClick={chooseNext}
      aria-label={`Theme: ${LABELS[preference]}. Switch to ${LABELS[next]}`}
      title={`Theme: ${LABELS[preference]} — switch to ${LABELS[next]}`}
      className={`group relative grid h-9 w-9 shrink-0 place-items-center rounded-full border border-sun/30 bg-sun/10 text-ember transition-all duration-200 hover:-translate-y-0.5 hover:border-sun/60 hover:bg-sun/20 hover:text-sun-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun/60 active:translate-y-0 active:scale-95 ${className}`}
    >
      <span className="theme-toggle-icon theme-toggle-icon-sun">
        <SunIcon width={16} height={16} />
      </span>
      <span className="theme-toggle-icon theme-toggle-icon-moon">
        <MoonIcon width={16} height={16} />
      </span>
      <span className="theme-toggle-icon theme-toggle-icon-rain">
        <RainIcon width={16} height={16} />
      </span>
    </button>
  );
}
