"use client";

import { useEffect, useMemo, useState } from "react";
import { LockIcon, SearchIcon, ShieldIcon } from "@/components/icons";
import { MinecraftAvatar } from "@/components/minecraft-avatar";
import { UserRankBadges } from "@/components/rank-badge";
import type { EffectivePermissionSource, PermissionEffect } from "@/lib/rank-types";
import type { RankPlayer } from "@/lib/types";
import {
  apiRequest,
  ErrorNote,
  errorMessage,
  PageSectionHeader,
  type Notify,
} from "../ui";
import {
  PermissionSearch,
  RankDataGate,
  countLabel,
  usePermissionCategories,
  useRankAdminData,
} from "./shared";

type EffectChoice = PermissionEffect | "inherit";

const EFFECTS: { value: EffectChoice; label: string; active: string }[] = [
  { value: "inherit", label: "Inherit", active: "bg-navy-700 text-white border-navy-700" },
  { value: "allow", label: "Allow", active: "bg-emerald-600 text-white border-emerald-600" },
  { value: "deny", label: "Deny", active: "bg-red-600 text-white border-red-600" },
];

function sourceTone(source: EffectivePermissionSource | undefined): string {
  if (!source) return "text-navy-400";
  if (source.reason === "deny") return "text-red-600";
  if (source.allowed) return "text-emerald-700";
  return "text-navy-400";
}

export function PlayerPermissionsTab({ notify }: { notify: Notify }) {
  const { ranks, players, setPlayers, error, reload } = useRankAdminData();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [playerQuery, setPlayerQuery] = useState("");
  const [permissionQuery, setPermissionQuery] = useState("");
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (selectedId === null && players && players.length > 0) {
      const first = players.find((player) => !player.isOwner) ?? players[0];
      setSelectedId(first.id);
    }
  }, [players, selectedId]);

  const selected = useMemo(
    () => (players ?? []).find((player) => player.id === selectedId) ?? null,
    [players, selectedId],
  );

  const matchingPlayers = useMemo(() => {
    const term = playerQuery.trim().toLowerCase();
    const list = [...(players ?? [])].sort((a, b) =>
      a.username.localeCompare(b.username),
    );
    if (!term) return list;
    return list.filter(
      (player) =>
        player.username.toLowerCase().includes(term) ||
        player.loginUsername.toLowerCase().includes(term),
    );
  }, [players, playerQuery]);

  const categories = usePermissionCategories(permissionQuery);

  const overrides = useMemo(
    () => new Map((selected?.overrides ?? []).map((override) => [override.permissionKey, override.effect])),
    [selected],
  );
  const sources = useMemo(
    () => new Map((selected?.permissionSources ?? []).map((source) => [source.key, source])),
    [selected],
  );

  async function setEffect(permissionKey: string, effect: EffectChoice) {
    if (!selected || selected.isOwner) return;
    setPendingKey(permissionKey);
    setSaveError("");
    try {
      const data = await apiRequest<{ player: RankPlayer }>(
        `/api/owner/rank-players/${selected.id}/permissions`,
        { method: "PATCH", body: { permissionKey, effect } },
      );
      setPlayers((current) =>
        current
          ? current.map((player) => (player.id === data.player.id ? data.player : player))
          : current,
      );
      const label =
        effect === "inherit"
          ? "now inherits this permission again"
          : effect === "allow"
            ? "can now use this permission"
            : "is now denied this permission";
      notify(`${data.player.username} ${label}. The displayed rank did not change.`);
    } catch (err) {
      setSaveError(errorMessage(err));
      void reload();
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <div>
      <PageSectionHeader
        title="Individual player permissions"
        description="Override a single player without changing their rank. DENY always overrides ALLOW and rank permissions."
      />

      <RankDataGate loading={ranks === null || players === null} error={error}>
        <div className="mt-5 grid gap-5 lg:grid-cols-[280px_1fr]">
          <div className="panel h-fit overflow-hidden">
            <div className="border-b border-aqua-100 p-3">
              <div className="relative">
                <SearchIcon
                  width={13}
                  height={13}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-navy-300"
                />
                <input
                  type="search"
                  value={playerQuery}
                  onChange={(event) => setPlayerQuery(event.target.value)}
                  placeholder="Search players…"
                  aria-label="Search players"
                  className="input !py-2 pl-8 text-[11px]"
                />
              </div>
            </div>
            <ul className="max-h-[32rem] divide-y divide-aqua-100 overflow-y-auto">
              {matchingPlayers.length === 0 ? (
                <li className="px-3 py-6 text-center text-[11px] text-navy-400">No players found.</li>
              ) : (
                matchingPlayers.map((player) => {
                  const active = player.id === selected?.id;
                  return (
                    <li key={player.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(player.id)}
                        aria-pressed={active}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors ${
                          active ? "bg-aqua-50" : "hover:bg-aqua-50/60"
                        }`}
                      >
                        <MinecraftAvatar username={player.username} size={26} className="!rounded-lg" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1 truncate text-[11px] font-medium text-navy-800">
                            {player.username}
                            {player.isOwner && <LockIcon width={10} height={10} className="text-ember" />}
                          </span>
                          <span className="block truncate text-[10px] text-navy-400">
                            {player.rank.name}
                            {player.overrides.length > 0
                              ? ` · ${countLabel(player.overrides.length, "override")}`
                              : ""}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>

          <div className="panel p-4 sm:p-5">
            {!selected ? (
              <p className="py-10 text-center text-sm text-navy-500">Select a player to view permissions.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <MinecraftAvatar username={selected.username} size={42} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-navy-900">
                      {selected.username}
                      {selected.isOwner && <LockIcon width={12} height={12} className="text-ember" />}
                    </p>
                    <p className="truncate font-mono text-[10px] text-navy-400">
                      {selected.loginUsername}
                    </p>
                  </div>
                  <UserRankBadges rank={selected.rank} secondaryRank={selected.secondaryRank} />
                  <div className="w-full sm:w-52">
                    <PermissionSearch value={permissionQuery} onChange={setPermissionQuery} />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
                  <span className="rounded-full border border-aqua-200 bg-aqua-50 px-2 py-1 text-navy-600">
                    {countLabel(selected.effectivePermissions.length, "effective permission")}
                  </span>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">
                    {countLabel(
                      selected.overrides.filter((override) => override.effect === "allow").length,
                      "individual allow",
                    )}
                  </span>
                  <span className="rounded-full border border-red-200 bg-red-50 px-2 py-1 text-red-600">
                    {countLabel(
                      selected.overrides.filter((override) => override.effect === "deny").length,
                      "individual deny",
                      "individual denies",
                    )}
                  </span>
                </div>

                {selected.isOwner ? (
                  <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-ember/15 bg-ember/[0.04] px-3.5 py-3 text-[11px] leading-relaxed text-navy-600">
                    <LockIcon width={14} height={14} className="mt-0.5 shrink-0 text-ember" />
                    <span>
                      The owner account always has full access. Individual overrides cannot restrict it.
                    </span>
                  </div>
                ) : (
                  <p className="mt-3 text-[11px] leading-relaxed text-navy-400">
                    Inherit uses the {selected.rank.name} rank. Allow grants only this player. Deny
                    always wins and is shown with the effective outcome below each permission.
                  </p>
                )}

                {saveError && (
                  <div className="mt-3">
                    <ErrorNote>{saveError}</ErrorNote>
                  </div>
                )}

                <div className="mt-4 space-y-4">
                  {categories.map((category) => (
                    <div
                      key={category.key}
                      className="overflow-hidden rounded-xl border border-aqua-100"
                    >
                      <div className="border-b border-aqua-100 bg-aqua-50/50 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-navy-700">
                          {category.label}
                        </p>
                        <p className="text-[10px] text-navy-400">{category.description}</p>
                      </div>
                      <ul className="divide-y divide-aqua-100">
                        {category.permissions.map((permission) => {
                          const override = overrides.get(permission.key);
                          const source = sources.get(permission.key);
                          const current: EffectChoice = override ?? "inherit";
                          const busy = pendingKey === permission.key;
                          return (
                            <li
                              key={permission.key}
                              className="flex flex-wrap items-center gap-2 px-3 py-2.5"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-medium text-navy-800">
                                  {permission.label}
                                </p>
                                <p className="truncate font-mono text-[9px] text-navy-400">
                                  {permission.key}
                                </p>
                                <p className={`mt-0.5 flex items-center gap-1 text-[10px] ${sourceTone(source)}`}>
                                  <ShieldIcon width={10} height={10} />
                                  {source
                                    ? `${source.allowed ? "Allowed" : "Denied"} — ${source.label}`
                                    : "Not granted"}
                                </p>
                              </div>
                              <div className="flex overflow-hidden rounded-lg border border-aqua-200 bg-white">
                                {EFFECTS.map((effect) => {
                                  const active = current === effect.value;
                                  return (
                                    <button
                                      key={effect.value}
                                      type="button"
                                      disabled={busy || selected.isOwner}
                                      aria-pressed={active}
                                      onClick={() => {
                                        if (current === effect.value) return;
                                        void setEffect(permission.key, effect.value);
                                      }}
                                      className={`border-r border-aqua-100 px-2.5 py-1.5 text-[10px] font-semibold transition-colors last:border-r-0 disabled:cursor-not-allowed ${
                                        active
                                          ? effect.active
                                          : "text-navy-500 hover:bg-aqua-50 disabled:opacity-60"
                                      }`}
                                    >
                                      {busy && active ? "…" : effect.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </RankDataGate>
    </div>
  );
}
