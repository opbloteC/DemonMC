"use client";

import { useEffect, useMemo, useState } from "react";
import { LockIcon, SearchIcon, ShieldIcon } from "@/components/icons";
import { MinecraftAvatar } from "@/components/minecraft-avatar";
import { RankBadge, UserRankBadges } from "@/components/rank-badge";
import { PERMISSION_KEYS, PERMISSION_MAP } from "@/lib/permission-registry";
import type { AuditEntry } from "@/lib/rank-admin";
import type { EffectivePermissionSource, PermissionCategory } from "@/lib/rank-types";
import {
  apiRequest,
  ErrorNote,
  errorMessage,
  PageSectionHeader,
  Spinner,
  type Notify,
} from "../ui";
import { RankDataGate, countLabel, permissionLabel, useRankAdminData } from "./shared";

function sourceTone(source: EffectivePermissionSource): string {
  if (source.reason === "deny") return "border-red-200 bg-red-50/70 text-red-600";
  if (source.allowed) return "border-emerald-200 bg-emerald-50/70 text-emerald-700";
  return "border-aqua-100 bg-white text-navy-400";
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="panel px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-navy-400">{label}</p>
      <p className="mt-1 font-display text-xl font-bold text-navy-900">{value}</p>
      <p className="mt-0.5 text-[10px] text-navy-400">{hint}</p>
    </div>
  );
}

export function PermissionOverviewTab(_props: { notify: Notify }) {
  const { ranks, players, activeRanks, error } = useRankAdminData();
  const [query, setQuery] = useState("");
  const [permissionFilter, setPermissionFilter] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);

  const term = query.trim().toLowerCase();
  const matchedKeys = useMemo(() => {
    if (!term) return [] as string[];
    return PERMISSION_KEYS.filter((key) => {
      const definition = PERMISSION_MAP.get(key);
      return (
        key.toLowerCase().includes(term) ||
        (definition?.label.toLowerCase().includes(term) ?? false)
      );
    });
  }, [term]);

  const visiblePlayers = useMemo(() => {
    const list = [...(players ?? [])].sort((a, b) => {
      if (a.rank.displayOrder !== b.rank.displayOrder) {
        return a.rank.displayOrder - b.rank.displayOrder;
      }
      return a.username.localeCompare(b.username);
    });
    return list.filter((player) => {
      if (permissionFilter && !player.effectivePermissions.includes(permissionFilter)) return false;
      if (!term) return true;
      if (
        player.username.toLowerCase().includes(term) ||
        player.loginUsername.toLowerCase().includes(term) ||
        player.rank.name.toLowerCase().includes(term)
      ) {
        return true;
      }
      return matchedKeys.some((key) => player.effectivePermissions.includes(key));
    });
  }, [players, term, matchedKeys, permissionFilter]);

  const categories: PermissionCategory[] = useMemo(() => {
    const map = new Map<string, PermissionCategory>();
    for (const key of PERMISSION_KEYS) {
      const definition = PERMISSION_MAP.get(key);
      if (!definition) continue;
      const category = map.get(definition.category) ?? {
        key: definition.category,
        label: definition.categoryLabel,
        description: "",
        permissions: [],
      };
      category.permissions.push(definition);
      map.set(definition.category, category);
    }
    return [...map.values()];
  }, []);

  const totalOverrides = useMemo(
    () => (players ?? []).reduce((sum, player) => sum + player.overrides.length, 0),
    [players],
  );

  return (
    <div>
      <PageSectionHeader
        title="Permission overview"
        description="See exactly who can do what, where each permission comes from, and which ranks grant it."
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <div className="relative">
              <SearchIcon
                width={13}
                height={13}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-navy-300"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search players or permissions…"
                aria-label="Search players or permissions"
                className="input !py-2.5 pl-8 text-xs sm:w-64"
              />
            </div>
            <select
              className="input !py-2.5 text-xs sm:w-56"
              value={permissionFilter}
              onChange={(event) => setPermissionFilter(event.target.value)}
              aria-label="Filter by permission"
            >
              <option value="">All permissions</option>
              {PERMISSION_KEYS.map((key) => (
                <option key={key} value={key}>
                  {permissionLabel(key)}
                </option>
              ))}
            </select>
          </div>
        }
      />

      <RankDataGate loading={ranks === null || players === null} error={error}>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Active ranks"
            value={String(activeRanks.length)}
            hint="Display order is independent of access"
          />
          <StatCard
            label="Permission keys"
            value={String(PERMISSION_KEYS.length)}
            hint="Shared by every protected page and API"
          />
          <StatCard
            label="Players"
            value={String(players?.length ?? 0)}
            hint={countLabel(visiblePlayers.length, "player") + " shown"}
          />
          <StatCard
            label="Individual overrides"
            value={String(totalOverrides)}
            hint="Allow / deny entries across players"
          />
        </div>

        <div className="mt-5 space-y-3">
          {visiblePlayers.length === 0 ? (
            <div className="panel px-6 py-12 text-center">
              <p className="text-sm font-semibold text-navy-800">No players match this view</p>
              <p className="mt-1 text-xs text-navy-500">
                Clear the search or permission filter to see everyone.
              </p>
            </div>
          ) : (
            visiblePlayers.map((player) => {
              const open = openId === player.id;
              const grants = player.permissionSources.filter(
                (source) => source.allowed && source.reason !== "owner",
              );
              const denies = player.permissionSources.filter((source) => source.reason === "deny");
              return (
                <div key={player.id} className="panel overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : player.id)}
                    aria-expanded={open}
                    className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-aqua-50/50"
                  >
                    <MinecraftAvatar username={player.username} size={34} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-xs font-semibold text-navy-900">
                        {player.username}
                        {player.isOwner && <LockIcon width={11} height={11} className="text-ember" />}
                      </p>
                      <p className="truncate font-mono text-[10px] text-navy-400">
                        {player.loginUsername}
                      </p>
                    </div>
                    <UserRankBadges
                      rank={player.rank}
                      secondaryRank={player.secondaryRank}
                      size="sm"
                    />
                    <div className="flex flex-wrap items-center justify-end gap-1.5 text-[10px]">
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 font-medium text-emerald-700">
                        {countLabel(player.effectivePermissions.length, "permission")}
                      </span>
                      {player.isOwner ? (
                        <span className="rounded-full border border-ember/20 bg-ember/10 px-2 py-1 font-medium text-ember">
                          Full access
                        </span>
                      ) : (
                        <>
                          {player.overrides.some((override) => override.effect === "allow") && (
                            <span className="rounded-full border border-aqua-200 bg-aqua-50 px-2 py-1 font-medium text-navy-600">
                              {countLabel(
                                player.overrides.filter((override) => override.effect === "allow")
                                  .length,
                                "allow",
                              )}
                            </span>
                          )}
                          {denies.length > 0 && (
                            <span className="rounded-full border border-red-200 bg-red-50 px-2 py-1 font-medium text-red-600">
                              {countLabel(denies.length, "deny", "denies")}
                            </span>
                          )}
                        </>
                      )}
                      <span className="ml-1 font-mono text-navy-300">{open ? "−" : "+"}</span>
                    </div>
                  </button>

                  {open && (
                    <div className="border-t border-aqua-100 bg-white/70 px-4 py-3">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-navy-400">
                        Effective permissions and reasons
                      </p>
                      <div className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                        {player.permissionSources
                          .filter((source) => source.allowed || source.reason === "deny")
                          .map((source) => (
                            <div
                              key={source.key}
                              className={`flex items-start gap-2 rounded-lg border px-2.5 py-1.5 ${sourceTone(source)}`}
                            >
                              <ShieldIcon width={11} height={11} className="mt-0.5 shrink-0" />
                              <span className="min-w-0">
                                <span className="block truncate text-[11px] font-medium">
                                  {permissionLabel(source.key)}
                                </span>
                                <span className="block text-[9px] opacity-80">{source.label}</span>
                              </span>
                            </div>
                          ))}
                      </div>
                      {denies.length > 0 && (
                        <p className="mt-2 text-[10px] text-navy-400">
                          Individual denies override the {player.rank.name} rank and are listed in red.
                        </p>
                      )}
                      {player.isOwner && (
                        <p className="mt-2 text-[10px] text-navy-400">
                          Owner accounts bypass rank permissions entirely.
                        </p>
                      )}
                      <p className="mt-2 text-[10px] text-navy-400">
                        {player.isOwner
                          ? "Every permission is granted by the owner identity."
                          : `${countLabel(grants.length, "permission")} inherited from ${player.rank.name} or granted individually.`}
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <details className="panel mt-5 px-4 py-3">
          <summary className="cursor-pointer text-xs font-semibold text-navy-800">
            Permission matrix — which ranks grant each permission
          </summary>
          <div className="mt-3 space-y-4">
            {categories.map((category) => (
              <div key={category.key}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-navy-500">
                  {category.label}
                </p>
                <ul className="mt-1.5 space-y-1">
                  {category.permissions.map((permission) => {
                    const granting = activeRanks.filter(
                      (rank) => rank.key === "owner" || rank.permissions[permission.key],
                    );
                    return (
                      <li
                        key={permission.key}
                        className="flex flex-wrap items-center gap-2 rounded-lg border border-aqua-100 bg-aqua-50/30 px-2.5 py-1.5"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-[11px] font-medium text-navy-800">
                            {permission.label}
                          </span>
                          <span className="block truncate font-mono text-[9px] text-navy-400">
                            {permission.key}
                          </span>
                        </span>
                        <span className="flex flex-wrap items-center gap-1">
                          {granting.length === 0 ? (
                            <span className="text-[10px] text-navy-400">No rank</span>
                          ) : (
                            granting.map((rank) => <RankBadge key={rank.id} rank={rank} size="sm" />)
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </details>
      </RankDataGate>
    </div>
  );
}

export function AuditLogTab(_props: { notify: Notify }) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest<{ entries: AuditEntry[] }>("/api/owner/audit");
      setEntries(data.entries);
    } catch (err) {
      setError(errorMessage(err));
      setEntries((current) => current ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div>
      <PageSectionHeader
        title="Owner audit log"
        description="Every rank, assignment and permission change, with the acting owner and timestamp."
        action={
          <button
            type="button"
            className="btn-ghost !py-2.5 text-xs"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        }
      />

      <div className="mt-5">
        {entries === null ? (
          <div className="panel px-6 py-12">
            <Spinner label="Loading audit log" />
          </div>
        ) : error ? (
          <div className="panel px-4 py-4">
            <ErrorNote>{error}</ErrorNote>
          </div>
        ) : entries.length === 0 ? (
          <div className="panel px-6 py-12 text-center">
            <p className="text-sm font-semibold text-navy-800">No changes recorded yet</p>
            <p className="mt-1 text-xs text-navy-500">
              Rank and permission changes will appear here.
            </p>
          </div>
        ) : (
          <ol className="panel divide-y divide-aqua-100 overflow-hidden">
            {entries.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                <span className="mt-0.5 rounded-md border border-aqua-200 bg-aqua-50 px-2 py-1 font-mono text-[9px] font-semibold text-navy-500">
                  {entry.action}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-relaxed text-navy-700">{entry.details}</p>
                  <p className="mt-0.5 flex flex-wrap gap-x-3 text-[10px] text-navy-400">
                    <span>By {entry.actorUsername}</span>
                    {entry.targetUsername && <span>Target: {entry.targetUsername}</span>}
                    <span>{new Date(entry.createdAt).toLocaleString()}</span>
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
