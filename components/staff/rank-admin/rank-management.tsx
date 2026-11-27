"use client";

import { useMemo, useState } from "react";
import { CrownIcon, PencilIcon, PlusIcon, SearchIcon, TrashIcon } from "@/components/icons";
import { RankBadge } from "@/components/rank-badge";
import {
  BADGE_STYLE_LABELS,
  BADGE_STYLES,
  type BadgeStyle,
  type RankInfo,
  type RankRecord,
} from "@/lib/rank-types";
import {
  apiRequest,
  ConfirmDialog,
  ErrorNote,
  errorMessage,
  Field,
  Modal,
  PageSectionHeader,
  type Notify,
} from "../ui";
import {
  ColorInput,
  RankDataGate,
  RankPreview,
  countLabel,
  useRankAdminData,
} from "./shared";

interface RankDraft {
  name: string;
  color: string;
  textColor: string;
  bold: boolean;
  badgeStyle: BadgeStyle;
}

function draftFrom(rank: RankRecord | null): RankDraft {
  return {
    name: rank?.name ?? "",
    color: rank?.color ?? "#8b5cf6",
    textColor: rank?.textColor ?? "#ffffff",
    bold: rank?.bold ?? true,
    badgeStyle: rank?.badgeStyle ?? "solid",
  };
}

function RankEditor({
  rank,
  onClose,
  onDone,
  notify,
}: {
  rank: RankRecord | null;
  onClose: () => void;
  onDone: () => void;
  notify: Notify;
}) {
  const [draft, setDraft] = useState<RankDraft>(() => draftFrom(rank));
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const locked = rank?.key === "owner";

  const preview: RankInfo = {
    id: rank?.id ?? 0,
    key: rank?.key ?? "preview",
    name: draft.name.trim() || "New rank",
    color: /^#[0-9a-fA-F]{6}$/.test(draft.color) ? draft.color : "#808080",
    textColor: /^#[0-9a-fA-F]{6}$/.test(draft.textColor) ? draft.textColor : "#ffffff",
    bold: draft.bold,
    badgeStyle: draft.badgeStyle,
    displayOrder: rank?.displayOrder ?? 999,
  };

  function set<K extends keyof RankDraft>(key: K, value: RankDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);

    const body = {
      name: draft.name,
      color: draft.color,
      textColor: draft.textColor,
      bold: draft.bold,
      badgeStyle: draft.badgeStyle,
    };

    try {
      if (rank) {
        await apiRequest(`/api/owner/ranks/${rank.id}`, { method: "PATCH", body });
      } else {
        await apiRequest("/api/owner/ranks", { method: "POST", body });
      }
      notify(
        rank
          ? `Rank “${draft.name.trim()}” updated.`
          : `Rank “${draft.name.trim()}” created.`,
      );
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <Modal
      title={rank ? "Edit rank" : "Create a custom rank"}
      description={
        rank
          ? "Visual changes apply instantly to every player with this rank."
          : "Custom ranks can be assigned to any player and configured with their own permissions."
      }
      onClose={onClose}
      wide
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Rank name"
            htmlFor="rank-name"
            hint={
              locked
                ? "The Owner rank name is protected."
                : "2–24 characters. Shown on every badge across the site."
            }
          >
            <input
              id="rank-name"
              className="input"
              required
              minLength={2}
              maxLength={24}
              disabled={locked}
              value={draft.name}
              onChange={(event) => set("name", event.target.value)}
              placeholder="e.g. SR MOD"
            />
          </Field>

          <Field label="Badge style" htmlFor="rank-badge-style" hint="Visual only — never access.">
            <select
              id="rank-badge-style"
              className="input"
              value={draft.badgeStyle}
              onChange={(event) => set("badgeStyle", event.target.value as BadgeStyle)}
            >
              {BADGE_STYLES.map((style) => (
                <option key={style} value={style}>
                  {BADGE_STYLE_LABELS[style]}
                </option>
              ))}
            </select>
          </Field>

          <ColorInput label="Badge colour" value={draft.color} onChange={(value) => set("color", value)} />
          <ColorInput
            label="Text colour"
            value={draft.textColor}
            onChange={(value) => set("textColor", value)}
          />
        </div>

        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-aqua-100 bg-aqua-50/50 px-3.5 py-3">
          <input
            type="checkbox"
            className="h-4 w-4 accent-ember"
            checked={draft.bold}
            onChange={(event) => set("bold", event.target.checked)}
          />
          <span className="text-xs text-navy-600">
            <strong className="font-semibold text-navy-900">Bold badge text</strong> — gives the rank
            name extra weight.
          </span>
        </label>

        <RankPreview rank={preview} label="Live preview" />

        {locked && (
          <p className="rounded-lg border border-aqua-200 bg-aqua-50 px-3 py-2 text-[11px] text-navy-500">
            The Owner rank always keeps every permission and cannot be renamed or deleted. Its colours
            and badge style can still be changed.
          </p>
        )}

        {error && <ErrorNote>{error}</ErrorNote>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-ghost !py-2.5 text-xs" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={pending} className="btn-primary !py-2.5 text-xs">
            {pending ? "Saving…" : rank ? "Save changes" : "Create rank"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function RankManagementTab({ notify }: { notify: Notify }) {
  const { ranks, setRanks, error, reload } = useRankAdminData();
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<{ rank: RankRecord | null } | null>(null);
  const [deleting, setDeleting] = useState<RankRecord | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [restoringId, setRestoringId] = useState<number | null>(null);

  const term = query.trim().toLowerCase();
  const active = useMemo(
    () =>
      (ranks ?? [])
        .filter((rank) => !rank.deletedAt)
        .filter((rank) => !term || rank.name.toLowerCase().includes(term) || rank.key.includes(term)),
    [ranks, term],
  );
  const deleted = useMemo(
    () =>
      (ranks ?? []).filter(
        (rank) => rank.deletedAt && (!term || rank.name.toLowerCase().includes(term)),
      ),
    [ranks, term],
  );

  async function confirmDelete() {
    if (!deleting) return;
    setDeletePending(true);
    try {
      const data = await apiRequest<{ ranks: RankRecord[] }>(`/api/owner/ranks/${deleting.id}`, {
        method: "DELETE",
      });
      setRanks(data.ranks);
      notify(`Rank “${deleting.name}” moved to deleted ranks.`);
      setDeleting(null);
    } catch (err) {
      notify(errorMessage(err), "error");
    } finally {
      setDeletePending(false);
    }
  }

  async function restore(rank: RankRecord) {
    setRestoringId(rank.id);
    try {
      const data = await apiRequest<{ ranks: RankRecord[] }>(`/api/owner/ranks/${rank.id}`, {
        method: "PATCH",
        body: { action: "restore" },
      });
      setRanks(data.ranks);
      notify(`Rank “${rank.name}” restored.`);
    } catch (err) {
      notify(errorMessage(err), "error");
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <div>
      <PageSectionHeader
        title="Rank management"
        description="Create unlimited custom ranks with their own name, colours, weight and badge style. Visual changes never alter permissions."
        action={
          <button
            type="button"
            className="btn-primary !px-4 !py-2.5 text-xs"
            onClick={() => setEditor({ rank: null })}
          >
            <PlusIcon width={14} height={14} />
            Create rank
          </button>
        }
      />

      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-ember/15 bg-ember/[0.04] px-4 py-3 text-[11px] leading-relaxed text-navy-600">
        <CrownIcon width={14} height={14} className="mt-0.5 shrink-0 text-ember" />
        <span>
          Ranks are stored in the database and shown everywhere automatically. The{" "}
          <strong className="font-semibold text-navy-900">Owner</strong> rank is protected — it cannot
          be renamed, deleted or stripped of permissions.
        </span>
      </div>

      <div className="relative mt-5 max-w-md">
        <SearchIcon
          width={16}
          height={16}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-aqua-600"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search ranks…"
          aria-label="Search ranks"
          className="input pl-11"
        />
      </div>

      <RankDataGate loading={ranks === null} error={error}>
        <div className="panel mt-4 overflow-hidden">
          <div className="hidden grid-cols-[1.4fr_0.9fr_auto] items-center gap-4 border-b border-aqua-100 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-navy-400 sm:grid">
            <span>Rank</span>
            <span>Badge style</span>
            <span className="text-right">Players</span>
          </div>
          {active.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-navy-500">
              No ranks match “{query.trim()}”.
            </p>
          ) : (
            <ul className="divide-y divide-aqua-100">
              {active.map((rank) => (
                <li
                  key={rank.id}
                  className="grid gap-3 px-4 py-4 sm:grid-cols-[1.4fr_0.9fr_auto] sm:items-center sm:gap-4 sm:px-5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <RankBadge rank={rank} />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-navy-900">{rank.name}</p>
                      <p className="truncate font-mono text-[10px] text-navy-400">
                        key: {rank.key}
                        {rank.isSystem ? " · system" : " · custom"}
                      </p>
                    </div>
                  </div>

                  <div className="text-[11px] capitalize text-navy-500">
                    {BADGE_STYLE_LABELS[rank.badgeStyle]} · {rank.color}
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <span className="text-[11px] text-navy-500">
                      {countLabel(rank.playerCount, "player")}
                      {rank.secondaryCount > 0 ? ` · ${rank.secondaryCount} secondary` : ""}
                    </span>
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        aria-label={`Edit ${rank.name}`}
                        className="icon-btn"
                        onClick={() => setEditor({ rank })}
                      >
                        <PencilIcon width={14} height={14} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${rank.name}`}
                        className="icon-btn hover:border-ember/30 hover:text-ember-bright disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={rank.key === "owner"}
                        onClick={() => setDeleting(rank)}
                      >
                        <TrashIcon width={14} height={14} />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {deleted.length > 0 && (
          <div className="panel mt-5 overflow-hidden">
            <div className="border-b border-aqua-100 px-5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-navy-400">
                Deleted ranks
              </p>
            </div>
            <ul className="divide-y divide-aqua-100">
              {deleted.map((rank) => (
                <li key={rank.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <RankBadge rank={rank} />
                  <span className="min-w-0 flex-1 truncate text-[11px] text-navy-400">
                    Deleted {rank.deletedAt ? new Date(rank.deletedAt).toLocaleString() : ""}
                  </span>
                  <button
                    type="button"
                    className="btn-subtle !px-3 !py-1.5 text-[10px]"
                    disabled={restoringId === rank.id}
                    onClick={() => void restore(rank)}
                  >
                    {restoringId === rank.id ? "Restoring…" : "Restore"}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </RankDataGate>

      {editor && (
        <RankEditor
          key={editor.rank?.id ?? "new"}
          rank={editor.rank}
          notify={notify}
          onClose={() => setEditor(null)}
          onDone={() => {
            setEditor(null);
            void reload();
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete rank"
          message={`Delete the “${deleting.name}” rank? Players currently using it: ${deleting.playerCount}. ${
            deleting.playerCount + deleting.secondaryCount > 0
              ? "Reassign them first — ranks with members cannot be deleted."
              : "It can be restored later from the deleted ranks list."
          }`}
          confirmLabel="Delete rank"
          pending={deletePending}
          onCancel={() => setDeleting(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
