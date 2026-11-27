"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { RankBadge } from "@/components/rank-badge";
import { PERMISSION_CATEGORIES, PERMISSION_MAP } from "@/lib/permission-registry";
import type { RankInfo, RankRecord } from "@/lib/rank-types";
import type { RankPlayer } from "@/lib/types";
import { apiRequest, ErrorNote, errorMessage, Spinner } from "../ui";

export interface RankAdminData {
  ranks: RankRecord[];
  players: RankPlayer[];
}

export function useRankAdminData() {
  const [ranks, setRanks] = useState<RankRecord[] | null>(null);
  const [players, setPlayers] = useState<RankPlayer[] | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      setError("");
      const [rankData, playerData] = await Promise.all([
        apiRequest<{ ranks: RankRecord[] }>("/api/owner/ranks"),
        apiRequest<{ players: RankPlayer[] }>("/api/owner/rank-players"),
      ]);
      setRanks(rankData.ranks);
      setPlayers(playerData.players);
    } catch (err) {
      setError(errorMessage(err));
      setRanks((current) => current ?? []);
      setPlayers((current) => current ?? []);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const activeRanks = useMemo(
    () => (ranks ?? []).filter((rank) => !rank.deletedAt),
    [ranks],
  );

  return { ranks, setRanks, players, setPlayers, activeRanks, error, reload };
}

export function RankDataGate({
  loading,
  error,
  children,
}: {
  loading: boolean;
  error: string;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div className="panel px-6 py-16">
        <Spinner label="Loading rank data" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="panel px-6 py-10">
        <ErrorNote>{error}</ErrorNote>
      </div>
    );
  }
  return <>{children}</>;
}

export function RankPreview({ rank, label }: { rank: RankInfo; label?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-aqua-100 bg-aqua-50/60 px-3.5 py-3">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-navy-400">
        {label ?? "Preview"}
      </span>
      <RankBadge rank={rank} />
      <span className="text-[11px] text-navy-500">{rank.name} · {rank.color}</span>
    </div>
  );
}

export function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#808080"}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-12 cursor-pointer rounded-lg border border-aqua-200 bg-white p-1"
        />
        <input
          className="input font-mono text-xs"
          value={value}
          maxLength={7}
          spellCheck={false}
          onChange={(event) => onChange(event.target.value)}
          placeholder="#FF5500"
        />
      </div>
    </div>
  );
}

export function PermissionSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Search permissions…"
      aria-label="Search permissions"
      className="input !py-2.5 text-xs"
    />
  );
}

export function permissionLabel(key: string): string {
  return PERMISSION_MAP.get(key)?.label ?? key;
}

export function usePermissionCategories(query: string) {
  const term = query.trim().toLowerCase();
  return useMemo(() => {
    if (!term) return PERMISSION_CATEGORIES;
    return PERMISSION_CATEGORIES.map((category) => ({
      ...category,
      permissions: category.permissions.filter(
        (permission) =>
          permission.label.toLowerCase().includes(term) ||
          permission.key.toLowerCase().includes(term) ||
          permission.description.toLowerCase().includes(term),
      ),
    })).filter((category) => category.permissions.length > 0);
  }, [term]);
}

export function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
