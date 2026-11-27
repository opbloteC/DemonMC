"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import {
  ArrowRightIcon,
  MegaphoneIcon,
  PlusIcon,
  ShieldIcon,
  UsersIcon,
} from "@/components/icons";
import { UserRankBadges } from "@/components/rank-badge";
import { formatDate } from "@/lib/format";
import { userCan, type SessionUser } from "@/lib/types";
import { apiRequest, errorMessage, Spinner } from "./ui";
import type { TabId } from "./dashboard";

interface Counts {
  players: number;
  accounts: number;
  announcements: number;
}

const STAT_DEFS = [
  { id: "players" as TabId, key: "players" as const, label: "Players", hint: "staff-managed profiles", icon: UsersIcon, permission: "players.view" },
  { id: "accounts" as TabId, key: "accounts" as const, label: "Accounts", hint: "players and staff who can sign in", icon: ShieldIcon, permission: "accounts.view" },
  { id: "announcements" as TabId, key: "announcements" as const, label: "Announcements", hint: "published across the site", icon: MegaphoneIcon, permission: "announcements.view" },
];

function ActionRow({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-lg border border-transparent px-2.5 py-2.5 text-left transition-colors hover:border-aqua-100 hover:bg-aqua-50"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-aqua-100 bg-aqua-50/80 text-navy-600 group-hover:text-ember">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-navy-800">{label}</span>
        <span className="block text-[11px] text-navy-400">{hint}</span>
      </span>
      <ArrowRightIcon
        width={14}
        height={14}
        className="text-navy-300 transition-all group-hover:translate-x-0.5 group-hover:text-navy-600"
      />
    </button>
  );
}

export function OverviewTab({
  user,
  canEdit,
  onNavigate,
  brandName = "DemonMC",
}: {
  user: SessionUser;
  canEdit: boolean;
  onNavigate: (tab: TabId) => void;
  brandName?: string;
}) {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [error, setError] = useState("");

  const canAddPlayers = userCan(user, "players.edit") || userCan(user, "profiles.manage");
  const canManageAccounts = userCan(user, "accounts.manage");
  const canWriteAnnouncements =
    userCan(user, "announcements.create") || userCan(user, "announcements.edit");
  const hasQuickActions = canAddPlayers || canManageAccounts || canWriteAnnouncements;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await apiRequest<{ counts: Counts }>("/api/admin/overview");
        if (active) setCounts(data.counts);
      } catch (err) {
        if (active) setError(errorMessage(err));
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Dashboard</p>
        <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-navy-900">
          Welcome back, {user.username}
        </h2>
        <p className="mt-1.5 text-sm text-navy-500">
          Here is the current state of the {brandName} network.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {STAT_DEFS.filter((stat) => userCan(user, stat.permission)).map((stat) => {
          const Icon = stat.icon;
          return (
            <button
              key={stat.id}
              type="button"
              onClick={() => onNavigate(stat.id)}
              className="panel panel-hover group p-5 text-left"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-aqua-100 bg-aqua-50 text-ember">
                  <Icon width={17} height={17} />
                </span>
                <ArrowRightIcon
                  width={14}
                  height={14}
                  className="text-navy-300 transition-all group-hover:translate-x-0.5 group-hover:text-navy-600"
                />
              </div>
              <p className="mt-4 font-display text-3xl font-bold tracking-tight text-navy-900">
                {counts ? counts[stat.key] : "—"}
              </p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-navy-500">
                {stat.label}
              </p>
              <p className="mt-0.5 text-[11px] text-navy-400">{stat.hint}</p>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div className="panel p-5">
          <h3 className="font-display text-sm font-semibold text-navy-900">
            {hasQuickActions ? "Quick actions" : "Your access"}
          </h3>
          {hasQuickActions ? (
            <div className="mt-3 space-y-1">
              {canAddPlayers && (
                <ActionRow
                  icon={<PlusIcon width={15} height={15} />}
                  label="Add a player"
                  hint="Add a staff-managed profile"
                  onClick={() => onNavigate("players")}
                />
              )}
              {canManageAccounts && (
                <ActionRow
                  icon={<ShieldIcon width={15} height={15} />}
                  label="Manage accounts"
                  hint="Invite trusted people and assign ranks"
                  onClick={() => onNavigate("accounts")}
                />
              )}
              {canWriteAnnouncements && (
                <ActionRow
                  icon={<MegaphoneIcon width={15} height={15} />}
                  label="Write an announcement"
                  hint="Publish news to the homepage"
                  onClick={() => onNavigate("announcements")}
                />
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-navy-500">
              You have read-only access to the panel. If you need changes to players, accounts or
              announcements, contact a manager or the owner.
            </p>
          )}
        </div>

        <div className="panel p-5">
          <h3 className="font-display text-sm font-semibold text-navy-900">Your account</h3>
          <div className="mt-4 flex items-center gap-3">
            <Avatar name={user.username} src={user.avatarUrl} size={42} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-navy-900">{user.username}</p>
              <UserRankBadges
                rank={user.rank}
                secondaryRank={user.secondaryRank}
                size="sm"
                className="mt-1"
              />
            </div>
          </div>
          <dl className="mt-4 space-y-2 border-t border-aqua-100 pt-4 text-xs">
            <div className="flex items-center justify-between">
              <dt className="text-navy-500">Joined</dt>
              <dd className="text-navy-700">{formatDate(user.joinedAt)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-navy-500">Session</dt>
              <dd className="flex items-center gap-1.5 text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Active
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-navy-500">Access</dt>
              <dd className="text-navy-700">{canEdit ? "Management access" : "Read-only"}</dd>
            </div>
          </dl>
        </div>
      </div>

      {!counts && !error && (
        <div className="pt-1">
          <Spinner label="Loading network data" />
        </div>
      )}
    </div>
  );
}
