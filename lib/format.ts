import type { SessionUser } from "./types";

export function formatDate(value: string): string {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function avatarFor(username: string, custom?: string | null): string {
  if (custom) return custom;
  return `https://mc-heads.net/avatar/${encodeURIComponent(username)}/96`;
}

export function displayName(user: Pick<SessionUser, "username" | "minecraftUsername">): string {
  return user.minecraftUsername ?? user.username;
}

