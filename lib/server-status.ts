import { cache } from "react";
import { unstable_cache } from "next/cache";
import { invalidateSiteData, SITE_DATA_TAG } from "./cache";
import { query, withTransaction } from "./db";
import { getServerStatus } from "./minecraft";
import {
  OWNER_SERVER_STATUSES,
  type OwnerServerStatus,
  type PublicServerStatus,
  type ServerStatus,
} from "./types";

const STATUS_KEY = "server.status";
const MESSAGE_KEY = "server.status.message";

export function isOwnerServerStatus(value: unknown): value is OwnerServerStatus {
  return (
    typeof value === "string" &&
    (OWNER_SERVER_STATUSES as readonly string[]).includes(value)
  );
}

export interface OwnerStatusSetting {
  /** null means the owner has never pinned a status; the badge follows the live ping. */
  status: OwnerServerStatus | null;
  message: string;
}

async function readOwnerStatusSetting(): Promise<OwnerStatusSetting> {
  const { rows } = await query<{ key: string; value: string }>(
    "SELECT key, value FROM settings WHERE key = ANY($1)",
    [[STATUS_KEY, MESSAGE_KEY]],
  );
  const map = new Map(rows.map((row) => [row.key, row.value]));
  const raw = map.get(STATUS_KEY) ?? "";
  return {
    status: isOwnerServerStatus(raw) ? raw : null,
    message: (map.get(MESSAGE_KEY) ?? "").trim(),
  };
}

const ownerStatusCache = unstable_cache(readOwnerStatusSetting, ["owner-server-status"], {
  tags: [SITE_DATA_TAG],
  revalidate: 15,
});

export const getOwnerStatusSetting = cache(ownerStatusCache);

export async function saveOwnerStatus(
  status: OwnerServerStatus,
  message: string,
): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
      [STATUS_KEY, status],
    );
    await client.query(
      "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
      [MESSAGE_KEY, message],
    );
  });
  invalidateSiteData();
}

/**
 * The badge follows the owner's saved choice. Until a choice is saved it mirrors
 * the live Minecraft ping, and the ping is never allowed to override a saved status.
 */
async function readPublicServerStatus(ip: string): Promise<ServerStatus> {
  const [ping, owner] = await Promise.all([
    getServerStatus(ip),
    getOwnerStatusSetting().catch(() => ({ status: null, message: "" }) as OwnerStatusSetting),
  ]);

  const status: PublicServerStatus =
    owner.status ??
    (ping.reachable ? (ping.online ? "online" : "offline") : "unknown");

  return {
    ...ping,
    status,
    message: status === "maintenance" ? owner.message : "",
    source: owner.status ? "owner" : "auto",
  };
}

const publicStatusCache = unstable_cache(readPublicServerStatus, ["public-server-status"], {
  tags: [SITE_DATA_TAG],
  revalidate: 15,
});

export const getPublicServerStatus = cache(publicStatusCache);
