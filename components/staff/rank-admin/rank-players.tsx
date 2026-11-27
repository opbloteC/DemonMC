"use client";

import { useMemo, useState } from "react";
import { LockIcon, PencilIcon, SearchIcon } from "@/components/icons";
import { MinecraftAvatar } from "@/components/minecraft-avatar";
import { RankBadge, UserRankBadges } from "@/components/rank-badge";
import type { RankInfo } from "@/lib/rank-types";
import type { RankPlayer } from "@/lib/types";
import {
  apiRequest,
  ErrorNote,
  errorMessage,
  Field,
  Modal,
  PageSectionHeader,
  type Notify,
} from "../ui";
import { RankDataGate, RankPreview, countLabel, useRankAdminData } from "./shared";

interface RankDraft {
  rankId: number;
  secondaryRankId: number | null;
}

function sortPlayers(players: RankPlayer[]): RankPlayer[] {
  return [...players].sort((a, b) => {
    if (a.rank.displayOrder !== b.rank.displayOrder) {
      return a.rank.displayOrder - b.rank.displayOrder;
    }
    return a.username.localeCompare(b.username);
  });
}

function PlayerRankEditor({
  player,
  ranks,
  onClose,
  onSaved,
  notify,
}: {
  player: RankPlayer;
  ranks: RankInfo[];
  onClose: () => void;
  onSaved: (player: RankPlayer) => void;
  notify: Notify;
}) {
  const assignable = ranks.filter((rank) => rank.key !== "owner");
  const memberRank = assignable.find((rank) => rank.key === "member") ?? assignable[0];
  const [draft, setDraft] = useState<RankDraft>({
    rankId: player.rank.id,
    secondaryRankId: player.secondaryRank?.id ?? null,
  });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const primary = assignable.find((rank) => rank.id === draft.rankId) ?? player.rank;
  const secondary = assignable.find((rank) => rank.id === draft.secondaryRankId) ?? null;
  const changed =
    draft.rankId !== player.rank.id ||
    (draft.secondaryRankId ?? null) !== (player.secondaryRank?.id ?? null);

  async function save(next: RankDraft = draft) {
    setPending(true);
    setError("");
    try {
      const data = await apiRequest<{ player: RankPlayer }>(
        `/api/owner/rank-players/${player.id}`,
        {
          method: "PATCH",
          body: { rankId: next.rankId, secondaryRankId: next.secondaryRankId },
        },
      );
      onSaved(data.player);
      notify(
        `${data.player.username} is now ${data.player.rank.name}${
          data.player.secondaryRank ? ` (+ ${data.player.secondaryRank.name})` : ""
        }.`,
      );
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      title={`Edit rank — ${player.username}`}
      description="Assign what this player displays. This does not change rank permissions."
      onClose={onClose}
    >
      {player.isOwner ? (
        <div className="rounded-xl border border-ember/15 bg-ember/[0.04] px-4 py-3 text-xs leading-relaxed text-navy-600">
          This is the owner account. Its rank and access are protected and cannot be changed here.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-aqua-100 bg-aqua-50/60 px-3.5 py-3">
            <MinecraftAvatar username={player.username} size={40} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-navy-900">{player.username}</p>
              <p className="truncate font-mono text-[10px] text-navy-400">{player.loginUsername}</p>
            </div>
            <UserRankBadges rank={player.rank} secondaryRank={player.secondaryRank} className="ml-auto" />
          </div>

          <Field label="Primary rank" htmlFor="rank-primary">
            <select
              id="rank-primary"
              className="input"
              value={draft.rankId}
              disabled={pending}
              onChange={(event) => {
                const rankId = Number(event.target.value);
                setDraft((current) => ({
                  ...current,
                  rankId,
                  secondaryRankId:
                    current.secondaryRankId === rankId ? null : current.secondaryRankId,
                }));
              }}
            >
              {assignable.map((rank) => (
                <option key={rank.id} value={rank.id}>
                  {rank.name}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Secondary / cosmetic rank"
            htmlFor="rank-secondary"
            hint="Optional extra badge shown next to the primary rank."
          >
            <select
              id="rank-secondary"
              className="input"
              value={draft.secondaryRankId ?? ""}
              disabled={pending}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  secondaryRankId: event.target.value ? Number(event.target.value) : null,
                }))
              }
            >
              <option value="">None</option>
              {assignable
                .filter((rank) => rank.id !== draft.rankId)
                .map((rank) => (
                  <option key={rank.id} value={rank.id}>
                    {rank.name}
                  </option>
                ))}
            </select>
          </Field>

          <RankPreview rank={primary} label="Live preview" />
          {secondary && (
            <p className="-mt-2 flex items-center gap-2 text-[11px] text-navy-400">
              Secondary badge:
              <RankBadge rank={secondary} size="sm" />
            </p>
          )}

          {error && <ErrorNote>{error}</ErrorNote>}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-aqua-100 pt-4">
            <button
              type="button"
              className="btn-subtle !py-2 text-[11px]"
              disabled={pending || !memberRank}
              onClick={() => {
                if (!memberRank) return;
                const next = { rankId: memberRank.id, secondaryRankId: null };
                setDraft(next);
                void save(next);
              }}
            >
              Reset to Member
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-ghost !py-2.5 text-xs">
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary !py-2.5 text-xs"
                disabled={pending || !changed}
                onClick={() => void save()}
              >
                {pending ? "Saving…" : "Save rank"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function RankPlayersTab({ notify }: { notify: Notify }) {
  const { ranks, players, setPlayers, activeRanks, error, reload } = useRankAdminData();
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

  const term = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    const list = sortPlayers(players ?? []);
    if (!term) return list;
    return list.filter(
      (player) =>
        player.username.toLowerCase().includes(term) ||
        player.loginUsername.toLowerCase().includes(term) ||
        player.rank.name.toLowerCase().includes(term) ||
        (player.secondaryRank?.name.toLowerCase().includes(term) ?? false),
    );
  }, [players, term]);

  const grouped = useMemo(() => {
    const groups = new Map<number, RankPlayer[]>();
    for (const player of filtered) {
      const bucket = groups.get(player.rank.id) ?? [];
      bucket.push(player);
      groups.set(player.rank.id, bucket);
    }
    return groups;
  }, [filtered]);

  const editing = (players ?? []).find((player) => player.id === editingId) ?? null;

  function updatePlayer(player: RankPlayer) {
    setPlayers((current) =>
      current ? current.map((entry) => (entry.id === player.id ? player : entry)) : current,
    );
    void reload();
  }

  return (
    <div>
      <PageSectionHeader
        title="Player rank assignment"
        description="Search by Minecraft username, then assign, change or reset a player's displayed rank. Owner accounts are protected."
        action={
          <div className="relative w-full sm:w-64">
            <SearchIcon
              width={14}
              height={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy-300"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search players or ranks…"
              aria-label="Search players"
              className="input !py-2.5 pl-9 text-xs"
            />
          </div>
        }
      />

      <RankDataGate loading={ranks === null || players === null} error={error}>
        {filtered.length === 0 ? (
          <div className="panel mt-5 px-6 py-14 text-center">
            <p className="text-sm font-semibold text-navy-800">No matching players</p>
            <p className="mt-1 text-xs text-navy-500">Try a different Minecraft username or rank.</p>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {activeRanks
              .filter((rank) => grouped.has(rank.id))
              .map((rank) => {
                const members = grouped.get(rank.id) ?? [];
                return (
                  <section key={rank.id} className="panel overflow-hidden">
                    <div className="flex items-center justify-between gap-3 border-b border-aqua-100 bg-aqua-50/40 px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-navy-400">
                          Order {rank.displayOrder + 1}
                        </span>
                        <span className="h-1 w-1 rounded-full bg-aqua-300" />
                        <span className="text-xs font-semibold text-navy-800">{rank.name}</span>
                      </div>
                      <span className="text-[10px] text-navy-400">
                        {countLabel(members.length, "player")}
                      </span>
                    </div>
                    <ul className="divide-y divide-aqua-100">
                      {members.map((player) => (
                        <li
                          key={player.id}
                          className="flex flex-wrap items-center gap-3 px-4 py-2.5 transition-colors hover:bg-aqua-50/40"
                        >
                          <MinecraftAvatar username={player.username} size={32} />
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1.5 truncate text-xs font-semibold text-navy-900">
                              {player.username}
                              {player.isOwner && (
                                <LockIcon width={11} height={11} className="text-ember" />
                              )}
                              {player.disabled && (
                                <span className="rounded border border-red-200 bg-red-50 px-1 py-0.5 text-[9px] font-medium text-red-600">
                                  Disabled
                                </span>
                              )}
                            </p>
                            <p className="truncate font-mono text-[10px] text-navy-400">
                              {player.loginUsername}
                              {player.overrides.length > 0
                                ? ` · ${countLabel(player.overrides.length, "override")}`
                                : ""}
                            </p>
                          </div>
                          <UserRankBadges
                            rank={player.rank}
                            secondaryRank={player.secondaryRank}
                            size="sm"
                          />
                          <button
                            type="button"
                            className="icon-btn shrink-0"
                            aria-label={`Edit rank for ${player.username}`}
                            disabled={player.isOwner}
                            onClick={() => setEditingId(player.id)}
                          >
                            <PencilIcon width={13} height={13} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
          </div>
        )}
      </RankDataGate>

      {editing && (
        <PlayerRankEditor
          player={editing}
          ranks={activeRanks}
          notify={notify}
          onClose={() => setEditingId(null)}
          onSaved={updatePlayer}
        />
      )}
    </div>
  );
}
