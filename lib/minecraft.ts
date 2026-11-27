import type { ServerStatus } from "./types";

const UUID_CACHE = new Map<string, string | null>();
const PROFILE_CACHE = new Map<string, MinecraftProfile | null>();

export interface MinecraftProfile {
  uuid: string;
  name: string;
}

function withDashes(id: string): string {
  if (id.includes("-")) return id;
  return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
}

/** Resolve a Minecraft username to its real account UUID (Mojang profile services). */
export async function resolveMinecraftUuid(name: string): Promise<string | null> {
  const profile = await resolveMinecraftProfile(name);
  return profile?.uuid ?? null;
}

/**
 * Verifies a username against the Minecraft profile services and returns the
 * canonical casing plus UUID. Returns null when the profile cannot be verified,
 * so callers never assign a made-up UUID or skin.
 */
export async function resolveMinecraftProfile(name: string): Promise<MinecraftProfile | null> {
  const key = name.trim().toLowerCase();
  const cached = PROFILE_CACHE.get(key);
  if (cached !== undefined) return cached;

  let profile: MinecraftProfile | null = null;

  try {
    const res = await fetch(`https://api.ashcon.app/mojang/v2/user/${encodeURIComponent(name)}`, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(4000),
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const data = (await res.json().catch(() => null)) as
        | { uuid?: unknown; username?: unknown }
        | null;
      if (
        typeof data?.uuid === "string" &&
        data.uuid.length >= 32 &&
        typeof data.username === "string" &&
        data.username.length > 0
      ) {
        profile = { uuid: withDashes(data.uuid), name: data.username };
      }
    }
  } catch {
    // fall through to the Mojang endpoint
  }

  if (!profile) {
    try {
      const res = await fetch(
        `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(name)}`,
        {
          next: { revalidate: 86400 },
          signal: AbortSignal.timeout(4000),
          headers: { Accept: "application/json" },
        },
      );
      if (res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { id?: unknown; name?: unknown }
          | null;
        if (typeof data?.id === "string" && data.id.length >= 32) {
          profile = {
            uuid: withDashes(data.id),
            name: typeof data.name === "string" && data.name.length > 0 ? data.name : name,
          };
        }
      }
    } catch {
      // unknown profile — callers must surface a verification error
    }
  }

  PROFILE_CACHE.set(key, profile);
  UUID_CACHE.set(key, profile?.uuid ?? null);
  return profile;
}

interface StatusApiResponse {
  online?: boolean;
  players?: {
    online?: number;
    max?: number;
    list?: Array<{ name_clean?: string; name_raw?: string } | null>;
  };
  version?: { name_clean?: string } | string;
  motd?: { clean?: string | string[] };
}

export async function getServerStatus(host: string): Promise<ServerStatus> {
  const edition = process.env.MC_EDITION === "bedrock" ? "bedrock" : "java";
  const address = (process.env.MC_STATUS_HOST || host).trim();
  const checkedAt = new Date().toISOString();

  if (!address) {
    return { reachable: false, online: false, players: null, version: null, checkedAt };
  }

  const url = `https://api.mcstatus.io/v2/status/${edition}/${encodeURI(address)}`;

  try {
    const res = await fetch(url, {
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(3500),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Status API responded ${res.status}`);

    const data = (await res.json()) as StatusApiResponse;
    const version =
      typeof data.version === "string" ? data.version : (data.version?.name_clean ?? null);

    return {
      reachable: true,
      online: Boolean(data.online),
      players: data.players
        ? {
            online: Math.max(0, Number(data.players.online) || 0),
            max: Math.max(0, Number(data.players.max) || 0),
            names: (data.players.list ?? [])
              .map((entry) => entry?.name_clean || entry?.name_raw || "")
              .filter((name) => name.length > 0),
          }
        : null,
      version,
      checkedAt,
    };
  } catch {
    return { reachable: false, online: false, players: null, version: null, checkedAt };
  }
}
