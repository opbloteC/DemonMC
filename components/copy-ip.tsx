"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon } from "@/components/icons";

const RESET_MS = 2000;

export function CopyIp({ ip }: { ip: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

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
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), RESET_MS);
    } catch {
      // clipboard unavailable — leave the IP selectable
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? "Copied!" : "Copy server IP"}
      aria-label={`Copy server IP ${ip}`}
      className="inline-flex items-center gap-1.5 rounded-md border border-aqua-200/80 bg-aqua-50 px-2 py-1 font-mono text-[13px] font-bold text-aqua-800 transition-colors hover:border-aqua-300 hover:bg-aqua-100 hover:text-aqua-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-aqua-400/70"
    >
      {ip}
      {copied ? (
        <CheckIcon width={12} height={12} className="text-emerald-600" />
      ) : (
        <CopyIcon width={12} height={12} className="text-aqua-600" />
      )}
      <span role="status" className="sr-only">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </button>
  );
}
