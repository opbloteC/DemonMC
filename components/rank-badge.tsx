import type { CSSProperties } from "react";
import { rankInfoFromKey } from "@/lib/ranks";
import type { RankInfo } from "@/lib/rank-types";

const SIZES = {
  sm: "px-2 py-[3px] text-[10px]",
  md: "px-2.5 py-1 text-[11px]",
  lg: "px-3.5 py-1.5 text-xs",
} as const;

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function parseHex(value: string): [number, number, number] {
  const match = /^#?([0-9a-f]{6})$/i.exec(value.trim());
  if (!match) return [128, 128, 128];
  const number = Number.parseInt(match[1], 16);
  return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
}

function shade(value: string, amount: number): string {
  const [red, green, blue] = parseHex(value);
  return `#${[red + amount, green + amount, blue + amount]
    .map((part) => clamp(part).toString(16).padStart(2, "0"))
    .join("")}`;
}

function alpha(value: string, opacity: number): string {
  const [red, green, blue] = parseHex(value);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

export function rankBadgeStyle(rank: RankInfo): CSSProperties {
  const border = shade(rank.color, -48);
  switch (rank.badgeStyle) {
    case "outline":
      return {
        backgroundColor: "transparent",
        borderColor: rank.color,
        color: rank.color,
        boxShadow: `inset 0 0 0 1px ${alpha(rank.color, 0.18)}`,
      };
    case "soft":
      return {
        backgroundColor: alpha(rank.color, 0.16),
        borderColor: alpha(rank.color, 0.5),
        color: rank.textColor,
      };
    case "gradient":
      return {
        backgroundImage: `linear-gradient(135deg, ${rank.color} 0%, ${shade(rank.color, -45)} 100%)`,
        borderColor: border,
        color: rank.textColor,
      };
    case "glow":
      return {
        backgroundColor: rank.color,
        borderColor: border,
        color: rank.textColor,
        boxShadow: `inset 0 -2px 0 rgba(0, 0, 0, 0.22), 0 0 16px ${alpha(rank.color, 0.55)}`,
      };
    case "solid":
    default:
      return {
        backgroundColor: rank.color,
        borderColor: border,
        color: rank.textColor,
      };
  }
}

export function RankBadge({
  rank,
  size = "md",
  className = "",
  title,
}: {
  rank: RankInfo | string;
  size?: keyof typeof SIZES;
  className?: string;
  title?: string;
}) {
  const info = typeof rank === "string" ? rankInfoFromKey(rank) : rank;
  const sizing = info.key === "member" ? "px-1.5 py-[2px] text-[9px] tracking-[0.1em]" : SIZES[size];

  return (
    <span
      className={`rank-badge ${sizing} ${className}`}
      title={title ?? `${info.name} rank`}
      style={{ ...rankBadgeStyle(info), fontWeight: info.bold ? 800 : 500 }}
    >
      {info.name}
    </span>
  );
}

/** Primary rank plus an optional secondary/cosmetic rank. */
export function UserRankBadges({
  rank,
  secondaryRank,
  size = "md",
  className = "",
}: {
  rank: RankInfo | string;
  secondaryRank?: RankInfo | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}>
      <RankBadge rank={rank} size={size} />
      {secondaryRank && <RankBadge rank={secondaryRank} size="sm" />}
    </span>
  );
}
