"use client";

import { useEffect, useMemo, useState } from "react";
import { LockIcon, ShieldIcon } from "@/components/icons";
import { RankBadge } from "@/components/rank-badge";
import { PERMISSION_KEYS } from "@/lib/permission-registry";
import type { RankRecord } from "@/lib/rank-types";
import {
  ErrorNote,
  apiRequest,
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

function allowedFrom(rank: RankRecord | undefined): Set<string> {
  if (!rank) return new Set();
  return new Set(Object.keys(rank.permissions).filter((key) => rank.permissions[key]));
}

export function RankPermissionsTab({ notify }: { notify: Notify }) {
  const { ranks, setRanks, activeRanks, error } = useRankAdminData();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [allowed, setAllowed] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const selected = useMemo(
    () => activeRanks.find((rank) => rank.id === selectedId) ?? activeRanks[0],
    [activeRanks, selectedId],
  );
  const locked = selected?.key === "owner";

  useEffect(() => {
    if (!selectedId && activeRanks[0]) setSelectedId(activeRanks[0].id);
  }, [activeRanks, selectedId]);

  useEffect(() => {
    setAllowed(locked && selected ? new Set(PERMISSION_KEYS) : allowedFrom(selected));
    setSaveError("");
  }, [selected, locked]);

  const categories = usePermissionCategories(query);

  const baseline = useMemo(
    () => (locked && selected ? PERMISSION_KEYS.join("|") : [...allowedFrom(selected)].sort().join("|")),
    [selected, locked],
  );
  const current = useMemo(() => [...allowed].sort().join("|"), [allowed]);
  const changed = baseline !== current;

  function toggle(key: string) {
    if (locked) return;
    setAllowed((currentSet) => {
      const next = new Set(currentSet);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleCategory(keys: string[], grant: boolean) {
    if (locked) return;
    setAllowed((currentSet) => {
      const next = new Set(currentSet);
      for (const key of keys) {
        if (grant) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  }

  async function save() {
    if (!selected || locked) return;
    setSaving(true);
    setSaveError("");
    try {
      const data = await apiRequest<{ rank: RankRecord }>(
        `/api/owner/ranks/${selected.id}/permissions`,
        { method: "PUT", body: { allowed: [...allowed] } },
      );
      setRanks((currentRanks) =>
        currentRanks
          ? currentRanks.map((rank) => (rank.id === data.rank.id ? data.rank : rank))
          : currentRanks,
      );
      notify(`Permissions updated for ${data.rank.name}. All its members now inherit them.`);
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageSectionHeader
        title="Rank permissions"
        description="Grant access to each rank. Members inherit changes instantly — display order and visual style never affect permissions."
      />

      <RankDataGate loading={ranks === null} error={error}>
        <div className="mt-5 grid gap-5 lg:grid-cols-[280px_1fr]">
          <div className="panel h-fit overflow-hidden">
            <div className="border-b border-aqua-100 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-navy-400">
                Choose a rank
              </p>
            </div>
            <ul className="max-h-[32rem] divide-y divide-aqua-100 overflow-y-auto">
              {activeRanks.map((rank) => {
                const isSelected = rank.id === selected?.id;
                const granted = Object.values(rank.permissions).filter(Boolean).length;
                return (
                  <li key={rank.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(rank.id)}
                      aria-pressed={isSelected}
                      className={`flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors ${
                        isSelected ? "bg-aqua-50" : "hover:bg-aqua-50/60"
                      }`}
                    >
                      <RankBadge rank={rank} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-medium text-navy-800">
                          {rank.name}
                        </span>
                        <span className="block text-[10px] text-navy-400">
                          {rank.key === "owner" ? "Full access" : countLabel(granted, "permission")}
                        </span>
                      </span>
                      {rank.key === "owner" && <LockIcon width={12} height={12} className="text-ember" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="panel p-4 sm:p-5">
            {!selected ? (
              <p className="py-10 text-center text-sm text-navy-500">No active ranks.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <RankBadge rank={selected} />
                    <div>
                      <p className="text-xs font-semibold text-navy-900">{selected.name} permissions</p>
                      <p className="text-[10px] text-navy-400">
                        {countLabel(selected.playerCount, "member")} inherit this rank
                      </p>
                    </div>
                  </div>
                  <div className="w-full sm:w-56">
                    <PermissionSearch value={query} onChange={setQuery} />
                  </div>
                </div>

                {locked && (
                  <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-ember/15 bg-ember/[0.04] px-3.5 py-3 text-[11px] leading-relaxed text-navy-600">
                    <LockIcon width={14} height={14} className="mt-0.5 shrink-0 text-ember" />
                    <span>
                      The Owner rank always has every permission and cannot be restricted. The owner
                      account keeps full access even if this badge changes.
                    </span>
                  </div>
                )}

                <div className="mt-4 space-y-4">
                  {categories.map((category) => {
                    const keys = category.permissions.map((permission) => permission.key);
                    const grantedCount = keys.filter((key) => allowed.has(key)).length;
                    return (
                      <div
                        key={category.key}
                        className="rounded-xl border border-aqua-100 bg-aqua-50/30 p-3.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-navy-700">
                              {category.label}
                            </p>
                            <p className="text-[10px] text-navy-400">{category.description}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-navy-400">
                              {grantedCount}/{keys.length}
                            </span>
                            <button
                              type="button"
                              className="btn-subtle !px-2 !py-1 text-[10px]"
                              disabled={locked || grantedCount === keys.length}
                              onClick={() => toggleCategory(keys, true)}
                            >
                              All
                            </button>
                            <button
                              type="button"
                              className="btn-subtle !px-2 !py-1 text-[10px]"
                              disabled={locked || grantedCount === 0}
                              onClick={() => toggleCategory(keys, false)}
                            >
                              None
                            </button>
                          </div>
                        </div>

                        <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                          {category.permissions.map((permission) => (
                            <label
                              key={permission.key}
                              className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-2.5 py-2 transition-colors ${
                                allowed.has(permission.key)
                                  ? "border-emerald-200 bg-emerald-50/70"
                                  : "border-aqua-100 bg-white"
                              } ${locked ? "cursor-not-allowed opacity-80" : ""}`}
                              title={permission.description}
                            >
                              <input
                                type="checkbox"
                                className="mt-0.5 h-3.5 w-3.5 accent-emerald-500"
                                checked={allowed.has(permission.key)}
                                disabled={locked}
                                onChange={() => toggle(permission.key)}
                              />
                              <span className="min-w-0">
                                <span className="block text-[11px] font-medium text-navy-800">
                                  {permission.label}
                                </span>
                                <span className="block truncate font-mono text-[9px] text-navy-400">
                                  {permission.key}
                                </span>
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {saveError && (
                  <div className="mt-4">
                    <ErrorNote>{saveError}</ErrorNote>
                  </div>
                )}

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-aqua-100 pt-4">
                  <p className="flex items-center gap-2 text-[11px] text-navy-400">
                    <ShieldIcon width={13} height={13} />
                    {locked
                      ? "Owner permissions are locked to full access."
                      : "Changes apply to every member of this rank immediately."}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn-ghost !py-2.5 text-xs"
                      disabled={!changed || saving}
                      onClick={() => setAllowed(locked ? new Set(PERMISSION_KEYS) : allowedFrom(selected))}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn-primary !py-2.5 text-xs"
                      disabled={!changed || saving || locked}
                      onClick={() => void save()}
                    >
                      {saving ? "Saving…" : "Save permissions"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </RankDataGate>
    </div>
  );
}
