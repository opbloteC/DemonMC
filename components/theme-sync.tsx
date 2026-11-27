"use client";

import { useEffect } from "react";
import {
  applyTheme,
  getSavedTheme,
  isThemePreference,
} from "@/lib/theme-preference";

function expectedAttributes(pref: "light" | "dark" | "rainy") {
  return {
    theme: pref === "light" ? "light" : "dark",
    weather: pref === "rainy" ? "rainy" : "clear",
  };
}

// React re-hydrating the document element can drop the attributes written by
// the blocking boot script, which left the page without any theme while the
// saved preference still existed. Re-assert the theme whenever it goes missing
// or becomes inconsistent, so every load and client navigation stays themed.
export function ThemeSync() {
  useEffect(() => {
    const root = document.documentElement;

    const restore = () => {
      const pref = root.getAttribute("data-theme-pref");
      const resolved = isThemePreference(pref) ? pref : getSavedTheme() ?? "light";
      const expected = expectedAttributes(resolved);
      if (
        root.getAttribute("data-theme") === expected.theme &&
        root.getAttribute("data-weather") === expected.weather &&
        (isThemePreference(pref) || resolved === "light")
      ) {
        if (pref !== resolved) applyTheme(resolved);
        return;
      }
      applyTheme(resolved);
    };

    restore();

    const observer = new MutationObserver(restore);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-theme", "data-theme-pref", "data-weather"],
    });
    return () => observer.disconnect();
  }, []);

  return null;
}
