"use client";

import { useEffect, useMemo, useState } from "react";
import { MenuIcon, ShieldIcon } from "@/components/icons";
import { RankBadge } from "@/components/rank-badge";
import type { RankRecord } from "@/lib/rank-types";
import { apiRequest, errorMessage, PageSectionHeader, type Notify } from "../ui";
import { RankDataGate, useRankAdminData } from "./shared";

function sortByOrder(ranks: RankRecord[]): RankRecord[] {
  return [...ranks].sort(
    (left, right) => left.displayOrder - right.displayOrder || left.name.localeCompare(right.name),
  );
}

export function RankOrderTab({ notify }: { notify: Notify }) {
  const { ranks, setRanks, activeRanks, error } = useRankAdminData();
  const [order, setOrder] = useState<number[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const sorted = useMemo(() => sortByOrder(activeRanks), [activeRanks]);

  useEffect(() => {
    setOrder(sorted.map((rank) => rank.id));
  }, [sorted]);

  const byId = useMemo(() => new Map(activeRanks.map((rank) => [rank.id, rank])), [activeRanks]);
  const ordered = order.map((id) => byId.get(id)).filter((rank): rank is RankRecord => Boolean(rank));
  const original = sorted.map((rank) => rank.id).join(",");
  const changed = order.join(",") !== original;

  function move(index: number, direction: -1 | 1) {
    setOrder((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function dropOn(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) return;
    setOrder((current) => {
      const next = [...current];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    setDragIndex(null);
  }

  async function save() {
    setSaving(true);
    try {
      const data = await apiRequest<{ ranks: RankRecord[] }>("/api/owner/ranks/reorder", {
        method: "PUT",
        body: { ids: order },
      });
      setRanks(data.ranks);
      notify("Rank display order saved. Permissions were not changed.");
    } catch (err) {
      notify(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageSectionHeader
        title="Rank order"
        description="Drag or use the arrows to change the display position of each rank. This order is used on the leaderboard, profiles, Staff Panel and every rank selector."
      />

      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-ember/15 bg-ember/[0.04] px-4 py-3 text-[11px] leading-relaxed text-navy-600">
        <ShieldIcon width={14} height={14} className="mt-0.5 shrink-0 text-ember" />
        <span>
          <strong className="font-semibold text-navy-900">Display order is independent of permissions.</strong>{" "}
          Moving a rank up or down never grants or removes access.
        </span>
      </div>

      <RankDataGate loading={ranks === null} error={error}>
        <div className="panel mt-5 overflow-hidden">
          <ul className="divide-y divide-aqua-100">
            {ordered.map((rank, index) => (
              <li
                key={rank.id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragEnd={() => setDragIndex(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => dropOn(index)}
                className={`flex items-center gap-3 px-4 py-3 transition-colors sm:px-5 ${
                  dragIndex === index ? "bg-aqua-50" : "bg-transparent"
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg border border-aqua-100 bg-white text-navy-400">
                  <MenuIcon width={15} height={15} />
                </span>
                <span className="w-6 shrink-0 text-center font-mono text-[11px] text-navy-400">
                  {index + 1}
                </span>
                <RankBadge rank={rank} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-navy-900">{rank.name}</span>
                  <span className="block truncate font-mono text-[10px] text-navy-400">
                    {rank.playerCount} player{rank.playerCount === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    className="icon-btn disabled:opacity-30"
                    aria-label={`Move ${rank.name} up`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="icon-btn disabled:opacity-30"
                    aria-label={`Move ${rank.name} down`}
                    disabled={index === ordered.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    ↓
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-navy-400">
            {ordered.length} active ranks. Drag a row or use the arrows, then save the order.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-ghost !py-2.5 text-xs"
              disabled={!changed || saving}
              onClick={() => setOrder(sorted.map((rank) => rank.id))}
            >
              Reset
            </button>
            <button
              type="button"
              className="btn-primary !py-2.5 text-xs"
              disabled={!changed || saving}
              onClick={() => void save()}
            >
              {saving ? "Saving…" : "Save order"}
            </button>
          </div>
        </div>
      </RankDataGate>
    </div>
  );
}
