"use client";

import { useState } from "react";

const MC_NAME = /^[A-Za-z0-9_]{1,16}$/;

function sourcesFor(username: string, uuid: string | null | undefined, px: number): string[] {
  const local = "/mc-avatar-default.svg";
  const sources: string[] = [];

  if (uuid) {
    sources.push(`https://crafatar.com/avatars/${encodeURIComponent(uuid)}?size=${px}&overlay`);
    sources.push(`https://mc-heads.net/avatar/${encodeURIComponent(uuid)}/${px}`);
  }

  if (MC_NAME.test(username)) {
    sources.push(`https://minotar.net/helm/${encodeURIComponent(username)}/${px}.png`);
    sources.push(`https://mc-heads.net/avatar/${encodeURIComponent(username)}/${px}`);
  }

  sources.push(local);
  return sources;
}

export function MinecraftAvatar({
  username,
  uuid,
  size = 72,
  className = "",
}: {
  username: string;
  uuid?: string | null;
  size?: number;
  className?: string;
}) {
  const px = Math.min(256, Math.max(64, Math.round(size * 2)));
  const [index, setIndex] = useState(0);
  const sources = sourcesFor(username, uuid, px);
  const src = sources[Math.min(index, sources.length - 1)];

  return (
    <span
      className={`mc-avatar inline-flex shrink-0 overflow-hidden rounded-xl border-2 border-white bg-aqua-100 shadow-sm ${className}`}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={src}
        src={src}
        alt={`${username} Minecraft skin`}
        width={size}
        height={size}
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setIndex((current) => Math.min(current + 1, sources.length - 1))}
        className="h-full w-full object-cover"
        style={{ imageRendering: "pixelated" }}
      />
    </span>
  );
}
