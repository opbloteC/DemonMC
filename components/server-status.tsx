"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon } from "@/components/icons";
import type { PublicServerStatus, ServerStatus } from "@/lib/types";

const POLL_MS = 30_000;
const COPY_RESET_MS = 2000;

type StatusStyle = {
  label: string;
  text: string;
  dot: string;
};

const STATUS_STYLES: Record<PublicServerStatus, StatusStyle> = {
  online: {
    label: "Online",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
  },
  offline: {
    label: "Offline",
    text: "text-red-600",
    dot: "bg-red-500",
  },
  maintenance: {
    label: "Maintenance",
    text: "text-orange-700",
    dot: "bg-orange-500",
  },
  unknown: {
    label: "Unknown",
    text: "text-navy-500",
    dot: "bg-aqua-400",
  },
};

function deriveStatus(status: ServerStatus | null): PublicServerStatus {
  if (!status) return "unknown";
  if (status.status) return status.status;
  if (!status.reachable) return "unknown";
  return status.online ? "online" : "offline";
}

export function ServerStatusBar({
  initial,
  ip,
  displayText,
  showGlobe,
}: {
  initial: ServerStatus | null;
  ip: string;
  displayText: string;
  showGlobe: boolean;
}) {
  const [status, setStatus] = useState<ServerStatus | null>(initial);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const mounted = useRef(true);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/status", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as ServerStatus;
        if (mounted.current) setStatus(data);
      } else if (mounted.current) {
        setStatus(null);
      }
    } catch {
      // keep the last known status; the next poll retries
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    // The first snapshot is server-rendered, so only poll for later updates,
    // and only while the tab is visible to avoid needless network and DB work.
    let interval: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (interval === null) interval = setInterval(() => void refresh(), POLL_MS);
    };
    const stop = () => {
      if (interval !== null) {
        clearInterval(interval);
        interval = null;
      }
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
        return;
      }
      void refresh();
      start();
    };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      mounted.current = false;
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, [refresh]);

  async function copy() {
    const legacyCopy = () => {
      const area = document.createElement("textarea");
      area.value = ip;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      if (!ok) throw new Error("copy rejected");
    };

    try {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(ip);
        } catch {
          legacyCopy();
        }
      } else {
        legacyCopy();
      }
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopyState("idle"), COPY_RESET_MS);
  }

  const state = deriveStatus(status);
  const ui = STATUS_STYLES[state];
  const maintenanceMessage = state === "maintenance" ? (status?.message ?? "").trim() : "";
  const copied = copyState === "copied";

  return (
    <div className="w-full max-w-[360px] text-left">
      <div className="rounded-xl border border-white/90 bg-white/90 px-4 py-3 shadow-[0_12px_32px_-24px_rgba(9,60,90,0.55)] backdrop-blur-md transition-colors duration-300 sm:px-5 sm:py-3.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-navy-500">
            Server status
          </p>

          <div role="status" aria-live="polite" className="flex items-center gap-1.5">
            {state === "online" ? (
              <span className="text-[11px] leading-none" aria-hidden="true">
                🟢
              </span>
            ) : (
              <span className={`h-2 w-2 shrink-0 rounded-full ${ui.dot}`} aria-hidden="true" />
            )}
            <span
              className={`text-xs font-bold uppercase leading-none tracking-[0.14em] ${ui.text}`}
            >
              {ui.label}
            </span>
          </div>
        </div>

        {maintenanceMessage && (
          <p className="mt-1 text-[10px] leading-snug text-orange-700">{maintenanceMessage}</p>
        )}

        <div className="mt-2.5 flex items-center justify-center gap-1.5 border-t border-aqua-100/80 pt-2.5">
          {showGlobe && (
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center"
              aria-hidden="true"
            >
              <span className="text-[10px] leading-none">🌐</span>
            </span>
          )}
          <p
            title={ip}
            className="min-w-0 select-all truncate font-mono text-xs font-medium tracking-[0.04em] text-navy-900"
          >
            {displayText}
          </p>

          <button
            type="button"
            onClick={copy}
            title={
              copyState === "error"
                ? "Copy failed — try selecting the IP"
                : copied
                  ? "Copied"
                  : "Copy server IP"
            }
            aria-label={
              copyState === "error"
                ? "Copy failed"
                : copied
                  ? "Server IP copied"
                  : `Copy server IP ${ip}`
            }
            className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-aqua-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
              copied
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-aqua-200/80 bg-white/60 text-navy-500 hover:border-aqua-300 hover:bg-white hover:text-navy-900"
            }`}
          >
            <span className="relative block h-4 w-4">
              <CopyIcon
                width={13}
                height={13}
                className={`absolute inset-0 m-auto transition-opacity duration-150 ${
                  copied ? "opacity-0" : "opacity-100"
                }`}
              />
              <CheckIcon
                width={13}
                height={13}
                className={`absolute inset-0 m-auto transition-opacity duration-150 ${
                  copied ? "opacity-100" : "opacity-0"
                }`}
              />
            </span>
          </button>

          <span role="status" aria-live="polite" className="sr-only">
            {copyState === "error" ? "Copy failed" : copied ? "Server IP copied" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
