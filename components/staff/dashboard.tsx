"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { LogoMark, Wordmark } from "@/components/logo";
import { DEFAULT_BRAND_NAME } from "@/lib/branding-config";
import {
  AtSignIcon,
  BookIcon,
  BugIcon,
  CrownIcon,
  DashboardIcon,
  ExternalIcon,
  ImageIcon,
  LockIcon,
  LogoutIcon,
  MegaphoneIcon,
  MenuIcon,
  MessageIcon,
  PencilIcon,
  SearchIcon,
  ServerIcon,
  SettingsIcon,
  ShieldIcon,
  StoreIcon,
  TypeIcon,
  UsersIcon,
} from "@/components/icons";
import { UserRankBadges } from "@/components/rank-badge";
import { isOwnerAccount, userCan, type SessionUser } from "@/lib/types";
import { AccountTab } from "./account-tab";
import { AccountsTab } from "./accounts-tab";
import { AnnouncementsTab } from "./announcements-tab";
import { BrandingTab } from "./branding-tab";
import { ContentTab } from "./content-tab";
import { LogosTab } from "./logos-tab";
import { OverviewTab } from "./overview-tab";
import { PageNamesTab } from "./page-names-tab";
import { PlayersTab } from "./players-tab";
import { ServerStatusTab } from "./server-status-tab";
import { SettingsTab } from "./settings-tab";
import { UsernamesTab } from "./usernames-tab";
import { RankManagementTab } from "./rank-admin/rank-management";
import { RankOrderTab } from "./rank-admin/rank-order";
import { RankPermissionsTab } from "./rank-admin/rank-permissions";
import { RankPlayersTab } from "./rank-admin/rank-players";
import { PlayerPermissionsTab } from "./rank-admin/player-permissions";
import { AuditLogTab, PermissionOverviewTab } from "./rank-admin/permission-overview";
import { ApplicationsManagement } from "./applications-management";
import { ApplicationEditor } from "./application-editor";
import { ReportsTab } from "./reports-tab";
import { RulesManagementTab } from "./rules-tab";
import { StoreManagementTab } from "./store-tab";
import type { Notify } from "./ui";

export type TabId =
  | "overview"
  | "players"
  | "accounts"
  | "announcements"
  | "rules"
  | "applications"
  | "application-editor"
  | "reports"
  | "store"
  | "page-names"
  | "branding"
  | "account"
  | "settings"
  | "server-status"
  | "rank-management"
  | "rank-order"
  | "rank-players"
  | "rank-permissions"
  | "player-permissions"
  | "permission-overview"
  | "audit"
  | "logos"
  | "content"
  | "usernames";

interface TabDef {
  id: TabId;
  label: string;
  icon: typeof UsersIcon;
  anyOf?: readonly string[];
  ownerOnly?: boolean;
  seniorOnly?: boolean;
}

const TABS: TabDef[] = [
  { id: "overview", label: "Overview", icon: DashboardIcon, anyOf: ["staff.dashboard.view", "staff_panel.access"] },
  { id: "players", label: "Players", icon: UsersIcon, anyOf: ["players.view"] },
  { id: "accounts", label: "Accounts", icon: ShieldIcon, anyOf: ["accounts.view"] },
  { id: "announcements", label: "Announcements", icon: MegaphoneIcon, anyOf: ["announcements.view", "announcements.create"] },
  { id: "rules", label: "Rules management", icon: BookIcon, anyOf: ["rules.view", "rules.edit", "rules.publish", "rules.delete"] },
  { id: "applications", label: "Applications", icon: MessageIcon, anyOf: ["applications.manage"], seniorOnly: true },
  { id: "application-editor", label: "Application Editor", icon: PencilIcon, anyOf: ["applications.manage"], seniorOnly: true },
  { id: "reports", label: "Reports", icon: BugIcon, anyOf: ["moderation.view"], seniorOnly: true },
  { id: "store", label: "Store management", icon: StoreIcon, seniorOnly: true },
  { id: "page-names", label: "Page names", icon: TypeIcon, ownerOnly: true },
  { id: "branding", label: "Global branding", icon: TypeIcon, ownerOnly: true },
  { id: "rank-management", label: "Rank management", icon: CrownIcon, anyOf: ["ranks.manage"], ownerOnly: true },
  { id: "rank-order", label: "Rank order", icon: MenuIcon, anyOf: ["ranks.hierarchy"], ownerOnly: true },
  { id: "rank-players", label: "Player ranks", icon: UsersIcon, anyOf: ["ranks.assign"], ownerOnly: true },
  { id: "rank-permissions", label: "Rank permissions", icon: ShieldIcon, anyOf: ["permissions.manage"], ownerOnly: true },
  { id: "player-permissions", label: "Player permissions", icon: LockIcon, anyOf: ["permissions.manage"], ownerOnly: true },
  { id: "permission-overview", label: "Permission overview", icon: SearchIcon, anyOf: ["permissions.manage"], ownerOnly: true },
  { id: "audit", label: "Audit log", icon: TypeIcon, anyOf: ["owner.access"], ownerOnly: true },
  { id: "logos", label: "Logo management", icon: ImageIcon, anyOf: ["website.logos.upload"] },
  { id: "content", label: "Website content", icon: TypeIcon, anyOf: ["website.content.edit"] },
  { id: "usernames", label: "Player accounts", icon: AtSignIcon, anyOf: ["players.usernames.change"] },
  { id: "server-status", label: "Server status", icon: ServerIcon, anyOf: ["owner.access"], ownerOnly: true },
  { id: "settings", label: "Site settings", icon: SettingsIcon, anyOf: ["website.settings.view", "website.settings.edit"] },
  { id: "account", label: "My account", icon: LockIcon },
];

function canSeeTab(user: SessionUser, tab: TabDef): boolean {
  if (tab.ownerOnly && !isOwnerAccount(user)) return false;
  if (
    tab.seniorOnly &&
    !(isOwnerAccount(user) || ["manager", "developer"].includes(user.role))
  ) {
    return false;
  }
  if (!tab.anyOf) return true;
  return tab.anyOf.some((permission) => userCan(user, permission));
}

interface ToastItem {
  id: number;
  message: string;
  tone: "success" | "error";
}

export type DashboardMode = "staff" | "admin" | "owner";

const MANAGEMENT_PERMISSIONS = [
  "players.edit",
  "players.usernames.change",
  "profiles.manage",
  "accounts.manage",
  "announcements.create",
  "announcements.edit",
  "announcements.delete",
  "announcements.pin",
  "announcements.publish",
  "rules.edit",
  "rules.publish",
  "rules.delete",
  "applications.manage",
  "website.content.edit",
  "website.logos.upload",
  "website.settings.edit",
  "ranks.manage",
  "permissions.manage",
] as const;

export function Dashboard({
  user,
  mode = "staff",
  initialTab = "overview",
  tabs,
  brandName = DEFAULT_BRAND_NAME,
}: {
  user: SessionUser;
  mode?: DashboardMode;
  initialTab?: TabId;
  tabs?: readonly TabId[];
  brandName?: string;
}) {
  const router = useRouter();
  const ownerAccount = isOwnerAccount(user);
  const visibleTabs = TABS.filter(
    (item) => canSeeTab(user, item) && (!tabs || tabs.includes(item.id)),
  );
  const [tab, setTab] = useState<TabId>(
    visibleTabs.some((item) => item.id === initialTab)
      ? initialTab
      : visibleTabs[0]?.id ?? "account",
  );
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [loggingOut, setLoggingOut] = useState(false);

  const panelLabel =
    mode === "owner" ? "Owner console" : mode === "admin" ? "Staff Panel" : "Staff workspace";
  const active = TABS.find((item) => item.id === tab) ?? TABS[TABS.length - 1];
  const hasManagement = MANAGEMENT_PERMISSIONS.some((permission) => userCan(user, permission));
  const canManageProfiles = userCan(user, "profiles.manage");

  function notify(message: string, tone: "success" | "error" = "success") {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4200);
  }

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Even if the request fails, the cookie is cleared by the redirect below.
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col lg:flex-row">
        <aside className="border-b border-aqua-100 bg-white/40 backdrop-blur-sm lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[248px] lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between px-4 py-4">
            <Link href="/" className="flex items-center gap-2.5" aria-label={`${brandName} home`}>
              <LogoMark size={28} />
              <Wordmark name={brandName} className="text-sm" />
            </Link>
            <Link href="/" aria-label="View site" className="icon-btn lg:hidden">
              <ExternalIcon width={14} height={14} />
            </Link>
          </div>

          <nav
            className="flex gap-1 overflow-x-auto px-3 pb-3 lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-y-auto lg:overflow-x-visible lg:pb-0"
            aria-label="Staff sections"
          >
            {visibleTabs.map((item) => {
              const Icon = item.icon;
              const isActive = item.id === tab;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition-colors ${
                    isActive
                      ? "bg-aqua-100 text-navy-900"
                      : "text-navy-500 hover:bg-aqua-50 hover:text-navy-800"
                  }`}
                >
                  <Icon
                    width={16}
                    height={16}
                    className={isActive ? "text-ember" : "text-navy-400"}
                  />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto hidden px-3 pb-4 lg:block">
            <div className="rounded-xl border border-aqua-100 bg-white p-3">
              <div className="flex items-center gap-2.5">
                <Avatar name={user.minecraftUsername ?? user.username} src={user.avatarUrl} size={34} />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-navy-900">
                    {user.minecraftUsername ?? user.username}
                  </p>
                  <UserRankBadges
                    rank={user.rank}
                    secondaryRank={user.secondaryRank}
                    size="sm"
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                <Link href="/profile" className="text-navy-500 transition-colors hover:text-navy-900">
                  Profile
                </Link>
                {userCan(user, "staff_panel.access") && mode !== "admin" && (
                  <Link href="/admin" className="text-navy-500 transition-colors hover:text-navy-900">
                    Staff Panel
                  </Link>
                )}
                {ownerAccount && mode !== "owner" && (
                  <Link href="/owner" className="text-navy-500 transition-colors hover:text-navy-900">
                    Owner console
                  </Link>
                )}
              </div>
              <button
                type="button"
                onClick={logout}
                disabled={loggingOut}
                className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg border border-aqua-100 py-2 text-[11px] text-navy-600 transition-colors hover:border-aqua-200 hover:text-navy-900 disabled:opacity-50"
              >
                <LogoutIcon width={13} height={13} />
                {loggingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-aqua-100 bg-white/85 px-5 py-4 backdrop-blur-xl sm:px-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-navy-400">
                  {panelLabel}
                </p>
                {mode === "admin" ? (
                  <h2 className="mt-0.5 font-display text-lg font-semibold text-navy-900">
                    {active.label}
                  </h2>
                ) : (
                  <h1 className="mt-0.5 font-display text-lg font-semibold text-navy-900">
                    {active.label}
                  </h1>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                <Link href="/" className="btn-subtle hidden sm:inline-flex">
                  <ExternalIcon width={13} height={13} />
                  View site
                </Link>
                <div className="flex items-center gap-2 lg:hidden">
                  <Avatar name={user.minecraftUsername ?? user.username} src={user.avatarUrl} size={30} />
                  <button
                    type="button"
                    onClick={logout}
                    disabled={loggingOut}
                    aria-label="Sign out"
                    className="icon-btn"
                  >
                    <LogoutIcon width={14} height={14} />
                  </button>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 px-5 py-7 sm:px-8">
            <div className="mx-auto w-full max-w-5xl">
              {mode === "admin" && (
                <section className="mb-6 overflow-hidden rounded-2xl border border-aqua-200/80 bg-white/75 shadow-card backdrop-blur-sm">
                  <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-aqua-700">
                        {brandName} Network
                      </p>
                      <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-navy-900 sm:text-3xl">
                        {brandName.toUpperCase()} STAFF PANEL
                      </h1>
                      <p className="mt-1.5 text-xs leading-relaxed text-navy-500">
                        Private staff area — access follows your rank&apos;s permissions, not its name.
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 rounded-xl border border-aqua-100 bg-white px-3.5 py-3">
                      <Avatar
                        name={user.minecraftUsername ?? user.username}
                        src={user.avatarUrl}
                        size={38}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-navy-900">
                          {user.minecraftUsername ?? user.username}
                        </p>
                        <UserRankBadges
                          rank={user.rank}
                          secondaryRank={user.secondaryRank}
                          size="sm"
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {mode === "owner" && (
                <div className="mb-6 flex items-start gap-3 rounded-xl border border-ember/15 bg-ember/[0.04] px-4 py-3 text-xs leading-relaxed text-navy-600">
                  <ShieldIcon width={15} height={15} className="mt-0.5 shrink-0 text-ember" />
                  <span>
                    <strong className="font-semibold text-navy-900">Owner console.</strong> Create
                    and style custom ranks, set their display order, assign ranks and fine-tune
                    individual permissions. Display order never changes permissions, and every
                    change is written to the audit log.
                  </span>
                </div>
              )}

              {!hasManagement && (
                <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
                  <LockIcon width={15} height={15} className="mt-0.5 shrink-0 text-amber-600" />
                  <span>
                    <strong className="font-semibold text-amber-900">Read-only access.</strong> Your
                    rank grants view access only. Ask the owner to grant the permissions you need.
                  </span>
                </div>
              )}

              {tab === "overview" && (
                <OverviewTab
                  user={user}
                  canEdit={hasManagement}
                  onNavigate={setTab}
                  brandName={brandName}
                />
              )}
              {tab === "players" && <PlayersTab isOwner={canManageProfiles} notify={notify} />}
              {tab === "accounts" && (
                <AccountsTab actor={user} notify={notify} brandName={brandName} />
              )}
              {tab === "announcements" && <AnnouncementsTab user={user} notify={notify} />}
              {tab === "rules" && (
                <RulesManagementTab user={user} notify={notify} brandName={brandName} />
              )}
              {tab === "applications" && <ApplicationsManagement notify={notify} />}
              {tab === "application-editor" && <ApplicationEditor notify={notify} />}
              {tab === "reports" && <ReportsTab notify={notify} />}
              {tab === "store" && (
                <StoreManagementTab user={user} notify={notify} brandName={brandName} />
              )}
              {tab === "page-names" && <PageNamesTab notify={notify} brandName={brandName} />}
              {tab === "branding" && <BrandingTab notify={notify} />}
              {tab === "rank-management" && <RankManagementTab notify={notify} />}
              {tab === "rank-order" && <RankOrderTab notify={notify} />}
              {tab === "rank-players" && <RankPlayersTab notify={notify} />}
              {tab === "rank-permissions" && <RankPermissionsTab notify={notify} />}
              {tab === "player-permissions" && <PlayerPermissionsTab notify={notify} />}
              {tab === "permission-overview" && <PermissionOverviewTab notify={notify} />}
              {tab === "audit" && <AuditLogTab notify={notify} />}
              {tab === "logos" && <LogosTab notify={notify} brandName={brandName} />}
              {tab === "content" && <ContentTab notify={notify} brandName={brandName} />}
              {tab === "usernames" && <UsernamesTab notify={notify} />}
              {tab === "account" && <AccountTab user={user} notify={notify} />}
              {tab === "server-status" && <ServerStatusTab notify={notify} />}
              {tab === "settings" && (
                <SettingsTab user={user} notify={notify} brandName={brandName} />
              )}
            </div>
          </main>
        </div>
      </div>

      <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-full max-w-xs flex-col gap-2 px-4 sm:px-0">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto animate-fade-up rounded-lg border px-4 py-3 text-sm shadow-panel backdrop-blur ${
              toast.tone === "error"
                ? "border-red-200 bg-white text-red-600"
                : "border-emerald-200 bg-white text-emerald-700"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
