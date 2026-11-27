"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRightIcon, CheckIcon, SparklesIcon } from "@/components/icons";
import {
  applyTheme,
  completeWelcome,
  getSavedTheme,
  hasCompletedWelcome,
  saveTheme,
  type ThemePreference,
} from "@/lib/theme-preference";

type ThemeOption = {
  value: ThemePreference;
  label: string;
  emoji: string;
  note: string;
};

const OPTIONS: ThemeOption[] = [
  { value: "light", label: "Light", emoji: "☀️", note: "Soft & clear" },
  { value: "dark", label: "Dark", emoji: "🌙", note: "Midnight mode" },
  { value: "rainy", label: "Rainy", emoji: "🌧️", note: "Cinematic storm" },
];

function ThemePreview({ tone }: { tone: ThemePreference }) {
  if (tone === "rainy") {
    return (
      <span
        aria-hidden="true"
        className="relative block h-16 w-full overflow-hidden rounded-xl border sm:h-20"
        style={{
          borderColor: "#596573",
          background: "linear-gradient(160deg,#6f7984 0%,#39434f 48%,#171e27 100%)",
        }}
      >
        <span className="absolute inset-x-2 top-3 h-5 rounded-[48%] bg-slate-300/75 shadow-[0_7px_0_-3px_rgba(12,17,23,0.8)]" />
        <span className="absolute left-6 top-8 h-4 w-20 rounded-full bg-slate-400/65" />
        <span
          className="absolute inset-0 opacity-65"
          style={{
            backgroundImage:
              "repeating-linear-gradient(105deg,transparent 0 13px,rgba(225,232,240,0.3) 14px 15px,transparent 16px 29px)",
          }}
        />
        <span className="absolute right-5 top-5 h-6 w-px rotate-[18deg] bg-white/80 shadow-[0_0_10px_rgba(255,255,255,0.65)]" />
      </span>
    );
  }

  const light = tone === "light";

  return (
    <span
      aria-hidden="true"
      className="block h-16 w-full overflow-hidden rounded-xl border sm:h-20"
      style={{
        borderColor: light ? "#bdcecd" : "#243a58",
        background: light
          ? "linear-gradient(160deg,#f0f1ee 0%,#dbe6e3 100%)"
          : "linear-gradient(160deg,#13233c 0%,#060d1b 100%)",
      }}
    >
      <span className="block px-2 pt-2">
        <span className="flex items-center justify-between">
          <span className="flex gap-1">
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className="h-1 w-1 rounded-full"
                style={{ backgroundColor: light ? "#8eaaad" : "#3d5a7e" }}
              />
            ))}
          </span>
          <span
            className="h-1 w-4 rounded-full"
            style={{ backgroundColor: light ? "#f4842d" : "#ff9a52" }}
          />
        </span>
        <span
          className="mt-2 block h-1.5 w-4/5 rounded-full"
          style={{ backgroundColor: light ? "#354a52" : "#dceaff" }}
        />
        <span
          className="mt-1 block h-1 w-1/2 rounded-full"
          style={{ backgroundColor: light ? "#7e969b" : "#617a9c" }}
        />
        <span className="mt-2 flex gap-1.5">
          <span
            className="h-4 flex-1 rounded"
            style={{
              backgroundColor: light ? "#f0f1ee" : "#182844",
              boxShadow: light ? "0 0 0 1px #bdcecd" : "0 0 0 1px #27405f",
            }}
          />
          <span
            className="h-4 flex-1 rounded"
            style={{
              backgroundColor: light ? "#f0f1ee" : "#182844",
              boxShadow: light ? "0 0 0 1px #bdcecd" : "0 0 0 1px #27405f",
            }}
          />
        </span>
      </span>
    </span>
  );
}

export function WelcomeTheme({ brandName = "DemonMC" }: { brandName?: string }) {
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  const [selection, setSelection] = useState<ThemePreference>(() =>
    typeof window === "undefined" ? "light" : getSavedTheme() ?? "light",
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const finished = useRef(false);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    if (mounted || hasCompletedWelcome()) return;
    setMounted(true);
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const frame = window.requestAnimationFrame(() => setShown(true));
    const focusTimer = window.setTimeout(() => {
      panelRef.current
        ?.querySelector<HTMLButtonElement>('[role="radio"][aria-checked="true"]')
        ?.focus({ preventScroll: true });
    }, 140);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(focusTimer);
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
      document.body.style.overflow = previousOverflow;
      if (previousFocus && document.contains(previousFocus)) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [mounted]);

  if (!mounted) return null;

  function choose(index: number) {
    const option = OPTIONS[index];
    if (!option) return;
    setSelection(option.value);
    applyTheme(option.value);
    optionRefs.current[index]?.focus({ preventScroll: true });
  }

  function onOptionKey(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      choose(event.key === "Home" ? 0 : OPTIONS.length - 1);
      return;
    }
    const delta =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (!delta) return;
    event.preventDefault();
    choose((index + delta + OPTIONS.length) % OPTIONS.length);
  }

  function trapFocus(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const controls = panelRef.current
      ? Array.from(panelRef.current.querySelectorAll<HTMLElement>("[data-welcome-control]"))
      : [];
    if (controls.length === 0) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (
      event.shiftKey &&
      (document.activeElement === first || !panelRef.current?.contains(document.activeElement))
    ) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function finish() {
    if (finished.current) return;
    finished.current = true;
    saveTheme(selection);
    completeWelcome();
    applyTheme(selection);
    setShown(false);
    closeTimer.current = window.setTimeout(() => setMounted(false), 320);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-theme-title"
      aria-describedby="welcome-theme-subtitle"
      onKeyDown={trapFocus}
      className="fixed inset-0 z-[120] flex items-center justify-center px-4 py-5 sm:px-6 sm:py-8"
    >
      <div
        aria-hidden="true"
        className={`absolute inset-0 bg-navy-900/60 backdrop-blur-md transition-opacity duration-300 ${
          shown ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        ref={panelRef}
        className={`relative max-h-[calc(100svh-2.5rem)] w-full max-w-[620px] overflow-y-auto rounded-[26px] border border-aqua-200/90 bg-white/95 text-center shadow-[0_45px_120px_-45px_rgba(9,60,90,0.8)] backdrop-blur-2xl transition-all duration-300 ease-out ${
          shown ? "scale-100 opacity-100" : "scale-[0.94] opacity-0"
        }`}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-12 top-0 h-[3px] rounded-b-full bg-gradient-to-r from-transparent via-sun to-transparent"
        />
        <span
          aria-hidden="true"
          className="block-motif pointer-events-none absolute inset-0 opacity-[0.14]"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 -top-24 h-52 w-52 rounded-full bg-aqua-300/25 blur-3xl"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -right-16 h-56 w-56 rounded-full bg-sun/15 blur-3xl"
        />

        <div className="relative px-5 pb-7 pt-8 sm:px-9 sm:pb-9 sm:pt-10">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sun-bright to-sun-deep text-white shadow-[0_14px_30px_-14px_rgba(242,112,28,0.8)]">
            <SparklesIcon width={20} height={20} />
          </span>

          <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-sun-deep">
            Personalize your experience
          </p>
          <h2
            id="welcome-theme-title"
            className="mt-2 font-display text-[26px] font-extrabold leading-tight tracking-tight text-navy-900 sm:text-[32px]"
          >
            Welcome to <span className="text-sun-deep">{brandName}</span>!
          </h2>
          <p
            id="welcome-theme-subtitle"
            className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-navy-500"
          >
            Choose your preferred website appearance.
          </p>

          <div
            role="radiogroup"
            aria-label="Website appearance"
            className="mt-6 grid grid-cols-3 gap-2 sm:mt-7 sm:gap-3.5"
          >
            {OPTIONS.map((option, index) => {
              const selected = selection === option.value;
              return (
                <button
                  key={option.value}
                  ref={(node) => {
                    optionRefs.current[index] = node;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={selected ? 0 : -1}
                  data-welcome-control
                  onClick={() => choose(index)}
                  onKeyDown={(event) => onOptionKey(event, index)}
                  className={`group relative rounded-2xl border p-1.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-deep/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:p-2 ${
                    selected
                      ? "border-sun-deep bg-white/95 shadow-[0_20px_40px_-22px_rgba(242,112,28,0.7)] ring-4 ring-sun/25"
                      : "border-aqua-200/90 bg-white/75 hover:-translate-y-0.5 hover:border-aqua-300 hover:bg-white/90 hover:shadow-card"
                  }`}
                >
                  <ThemePreview tone={option.value} />
                  <span className="mt-2 flex flex-col items-center gap-0.5 px-0.5 pb-0.5 sm:mt-2.5 sm:flex-row sm:gap-2 sm:px-1 sm:pb-1">
                    <span aria-hidden="true" className="text-[15px] leading-none">
                      {option.emoji}
                    </span>
                    <span className="min-w-0 text-center sm:text-left">
                      <span
                        className={`block text-[11px] font-bold sm:text-xs ${
                          selected ? "text-sun-deep" : "text-navy-800"
                        }`}
                      >
                        {option.label}
                      </span>
                      <span className="hidden truncate text-[10px] text-navy-400 sm:block">
                        {option.note}
                      </span>
                    </span>
                  </span>
                  {selected && (
                    <span className="absolute right-2.5 top-2.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-sun-deep text-white shadow-md">
                      <CheckIcon width={11} height={11} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            data-welcome-control
            onClick={finish}
            className="btn-primary mt-6 w-full !rounded-2xl !py-3.5 text-xs font-extrabold tracking-[0.2em] sm:mt-7 sm:text-sm"
          >
            CONTINUE
            <ArrowRightIcon width={16} height={16} />
          </button>

          <p className="mt-3 text-[11px] leading-relaxed text-navy-400">
            Your choice is saved on this device and can be changed anytime.
          </p>
        </div>
      </div>
    </div>
  );
}
