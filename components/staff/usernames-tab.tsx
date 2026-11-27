"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MinecraftAvatar } from "@/components/minecraft-avatar";
import { PencilIcon, SearchIcon, ShieldIcon } from "@/components/icons";
import { UserRankBadges } from "@/components/rank-badge";
import type { RankInfo } from "@/lib/rank-types";
import {
  apiRequest,
  ErrorNote,
  errorMessage,
  Field,
  Modal,
  PageSectionHeader,
  Spinner,
  type Notify,
} from "./ui";

interface ManagedPlayer {
  id: number;
  loginUsername: string;
  username: string | null;
  uuid: string | null;
  email: string | null;
  rank: RankInfo;
  secondaryRank: RankInfo | null;
  isOwner: boolean;
  avatarUrl: string | null;
  disabled: boolean;
}

const MC_USERNAME = /^[A-Za-z0-9_]{3,16}$/;

export function UsernamesTab({ notify }: { notify: Notify }) {
  const router = useRouter();
  const [players, setPlayers] = useState<ManagedPlayer[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<ManagedPlayer | null>(null);
  const [newName, setNewName] = useState("");
  const [step, setStep] = useState<"form" | "review">("form");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoadError("");
      const data = await apiRequest<{ players: ManagedPlayer[] }>("/api/owner/usernames");
      setPlayers(data.players);
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!players) return [];
    const term = query.trim().toLowerCase();
    if (!term) return players;
    return players.filter(
      (player) =>
        player.username?.toLowerCase().includes(term) ||
        player.loginUsername.toLowerCase().includes(term),
    );
  }, [players, query]);

  function open(target: ManagedPlayer) {
    setTarget(target);
    setNewName(target.username ?? "");
    setStep("form");
    setError("");
  }

  function close() {
    if (pending) return;
    setTarget(null);
    setStep("form");
    setError("");
  }

  function review(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!target) return;
    if (!MC_USERNAME.test(newName.trim())) {
      setError("Use 3–16 letters, numbers or underscores — a valid Java Edition username.");
      return;
    }
    if (newName.trim().toLowerCase() === (target.username ?? "").toLowerCase()) {
      setError("Enter a different Minecraft username.");
      return;
    }
    setError("");
    setStep("review");
  }

  async function apply() {
    if (!target) return;
    setPending(true);
    setError("");
    try {
      const data = await apiRequest<{ player: ManagedPlayer }>("/api/owner/usernames", {
        method: "PATCH",
        body: { userId: target.id, username: newName.trim() },
      });
      setPlayers((current) =>
        current
          ? current.map((player) => (player.id === data.player.id ? data.player : player))
          : current,
      );
      notify(`Minecraft username updated to ${data.player.username}.`);
      setTarget(null);
      setStep("form");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setStep("form");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <PageSectionHeader
        title="Player account management"
        description="Change a player's Minecraft username. The Mojang profile is verified first, then the existing account, rank and login stay untouched."
      />

      <div className="mt-4 flex items-start gap-3 rounded-xl border border-ember/15 bg-ember/[0.04] px-4 py-3 text-xs leading-relaxed text-navy-600">
        <ShieldIcon width={15} height={15} className="mt-0.5 shrink-0 text-ember" />
        <span>
          Owner-only. The username is verified against the Minecraft profile service; if it cannot
          be verified, nothing is changed. The owner account is protected.
        </span>
      </div>

      {loadError && (
        <div className="mt-5">
          <ErrorNote>{loadError}</ErrorNote>
        </div>
      )}

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
          placeholder="Search by Minecraft or login username…"
          aria-label="Search player accounts"
          className="input pl-11"
        />
      </div>

      {!players ? (
        <div className="panel mt-5 px-6 py-16">
          <Spinner label="Loading player accounts" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="panel mt-5 flex flex-col items-center px-6 py-14 text-center">
          <h3 className="font-display text-base font-bold text-navy-900">No players found</h3>
          <p className="mt-1.5 text-sm text-navy-500">
            Nothing matches “{query.trim()}”. Try another username.
          </p>
        </div>
      ) : (
        <div className="panel mt-5 overflow-hidden">
          <div className="hidden grid-cols-[1fr_1fr_auto_auto] gap-4 border-b border-aqua-100 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-navy-400 lg:grid">
            <span>Minecraft username</span>
            <span>Login account</span>
            <span>Rank</span>
            <span className="text-right">Action</span>
          </div>
          <ul className="divide-y divide-aqua-100">
            {filtered.map((player) => {
              const protectedOwner = player.isOwner;
              return (
                <li
                  key={player.id}
                  className="grid gap-3 px-4 py-4 lg:grid-cols-[1fr_1fr_auto_auto] lg:items-center lg:gap-4 lg:px-5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <MinecraftAvatar
                      username={player.username ?? player.loginUsername}
                      uuid={player.uuid}
                      size={38}
                      className="!rounded-lg"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-navy-900">
                        {player.username ?? "Not linked"}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[10px] text-navy-400">
                        {player.uuid ?? "No Minecraft UUID"}
                      </p>
                    </div>
                  </div>

                  <div className="min-w-0 text-[11px] text-navy-500">
                    <p className="truncate">{player.loginUsername}</p>
                    <p className="truncate text-[10px] text-navy-400">
                      {player.email ?? "No email"}
                    </p>
                  </div>

                  <div>
                    <UserRankBadges
                      rank={player.rank}
                      secondaryRank={player.secondaryRank}
                      size="sm"
                    />
                  </div>

                  <div className="lg:text-right">
                    {protectedOwner ? (
                      <span className="badge border-aqua-200 bg-aqua-50 text-[10px] text-aqua-700">
                        Protected
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => open(player)}
                        className="btn-subtle !px-3 !py-2 text-[11px]"
                      >
                        <PencilIcon width={12} height={12} />
                        Edit username
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {target && (
        <Modal
          title="Change Minecraft username"
          description={`${target.loginUsername} · account #${target.id}`}
          onClose={close}
        >
          {step === "form" ? (
            <form onSubmit={review} className="space-y-4">
              <div className="rounded-xl border border-aqua-100 bg-aqua-50/60 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-navy-400">
                  Current username
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <MinecraftAvatar
                    username={target.username ?? target.loginUsername}
                    uuid={target.uuid}
                    size={40}
                    className="!rounded-lg"
                  />
                  <div>
                    <p className="font-mono text-sm font-semibold text-navy-900">
                      {target.username ?? "Not linked"}
                    </p>
                    <p className="text-[10px] text-navy-400">
                      Login account: {target.loginUsername}
                    </p>
                  </div>
                </div>
              </div>

              <Field
                label="New Minecraft username"
                htmlFor="managed-username"
                hint="3–16 letters, numbers or underscores. The name must exist in Mojang's profile service."
              >
                <input
                  id="managed-username"
                  className="input font-mono"
                  maxLength={16}
                  autoFocus
                  spellCheck={false}
                  value={newName}
                  onChange={(event) => {
                    setNewName(event.target.value.replace(/\s/g, ""));
                    if (error) setError("");
                  }}
                  placeholder="e.g. Notch"
                />
              </Field>

              {error && <ErrorNote>{error}</ErrorNote>}

              <p className="text-[11px] leading-relaxed text-navy-400">
                Changing this updates the player's name, public profile and skin everywhere on the
                site. Email, password, rank and permissions are preserved.
              </p>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={close} className="btn-ghost !py-2.5 text-xs">
                  Cancel
                </button>
                <button type="submit" className="btn-primary !py-2.5 text-xs">
                  Review change
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-sun/30 bg-sun/10 p-4 text-sm text-navy-700">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-navy-500">
                  Confirm username change
                </p>
                <p className="mt-2 flex flex-wrap items-center gap-2 font-mono text-sm">
                  <span className="text-navy-500">{target.username ?? "Not linked"}</span>
                  <span aria-hidden="true">→</span>
                  <span className="font-bold text-navy-900">{newName.trim()}</span>
                </p>
                <p className="mt-2 text-[11px] leading-relaxed text-navy-500">
                  The Mojang profile service will be checked before the change is saved.
                </p>
              </div>

              {error && <ErrorNote>{error}</ErrorNote>}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setStep("form")}
                  className="btn-ghost !py-2.5 text-xs"
                  disabled={pending}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={apply}
                  className="btn-primary !py-2.5 text-xs"
                  disabled={pending}
                >
                  {pending ? "Verifying & saving…" : "Save username"}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
