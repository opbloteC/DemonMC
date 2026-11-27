import { WrenchIcon } from "@/components/icons";
import type { PublicServerStatus } from "@/lib/types";

const STYLES: Record<
  PublicServerStatus,
  { label: string; wrap: string; dot: string; ring: string | null }
> = {
  online: {
    label: "Status Online",
    wrap: "border-emerald-200/90 bg-emerald-50/90 text-emerald-700",
    dot: "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.16)]",
    ring: "bg-emerald-400/50",
  },
  offline: {
    label: "Status Offline",
    wrap: "border-red-200/90 bg-red-50/90 text-red-600",
    dot: "bg-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.14)]",
    ring: null,
  },
  maintenance: {
    label: "Under Maintenance",
    wrap: "border-orange-200/90 bg-gradient-to-r from-orange-50 via-amber-50 to-red-50 text-orange-700",
    dot: "bg-gradient-to-br from-orange-500 to-red-500 shadow-[0_0_0_3px_rgba(249,115,22,0.18)]",
    ring: "bg-orange-400/50",
  },
  unknown: {
    label: "Status Unknown",
    wrap: "border-aqua-200/90 bg-white/80 text-navy-500",
    dot: "bg-aqua-300 shadow-[0_0_0_3px_rgba(99,196,240,0.16)]",
    ring: null,
  },
};

export function StatusBadge({
  status,
  className = "",
}: {
  status: PublicServerStatus;
  className?: string;
}) {
  const style = STYLES[status];

  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-2.5 rounded-full border px-4 py-2.5 shadow-[0_14px_30px_-22px_rgba(9,60,90,0.55)] ${style.wrap} ${className}`}
    >
      <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
        {style.ring && (
          <span className={`absolute inset-0 animate-pulse rounded-full ${style.ring}`} />
        )}
        <span className={`relative h-2.5 w-2.5 rounded-full ${style.dot}`} />
      </span>
      {status === "maintenance" && (
        <WrenchIcon width={13} height={13} className="shrink-0 text-orange-600" />
      )}
      <span className="font-display text-[11px] font-extrabold uppercase leading-none tracking-[0.18em] sm:text-xs">
        {style.label}
      </span>
    </span>
  );
}
