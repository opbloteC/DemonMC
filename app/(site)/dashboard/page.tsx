import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { MinecraftIdentity } from "@/components/minecraft-identity";
import { SignOutButton } from "@/components/sign-out";
import {
  ArrowRightIcon,
  MegaphoneIcon,
  SettingsIcon,
  ShieldIcon,
} from "@/components/icons";
import { UserRankBadges } from "@/components/rank-badge";
import { getSessionUser } from "@/lib/auth";
import { getBranding } from "@/lib/branding";
import { getContent } from "@/lib/content";
import { displayName, formatDate } from "@/lib/format";
import { isOwnerAccount, userCan } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getBranding();
  return {
    title: "Dashboard",
    description: `Your ${branding.name} account overview.`,
    robots: { index: false, follow: false },
  };
}

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/dashboard");
  const copy = await getContent();

  const staffWorkspace = userCan(user, "staff_workspace.access");
  const staffPanel = userCan(user, "staff_panel.access");
  const owner = isOwnerAccount(user);
  const name = displayName(user);

  return (
    <>
      <section className="hero-shell border-b border-aqua-200/60">
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-glow" aria-hidden="true" />
        <div className="container-x relative py-12 sm:py-16" data-reveal>
          <p className="eyebrow flex items-center gap-3">
            <span className="h-px w-8 bg-sun/80" />
            {copy["dashboard.heading.eyebrow"]}
          </p>
          <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar name={name} src={user.avatarUrl} size={58} />
              <div className="min-w-0">
                <h1 className="headline truncate text-3xl sm:text-4xl">
                  {copy["dashboard.heading.title"]}
                </h1>
                <p className="mt-1 truncate text-sm text-navy-500">
                  {copy["dashboard.heading.signedIn"]}{" "}
                  <span className="font-semibold text-navy-800">{name}</span>
                </p>
              </div>
            </div>
            <UserRankBadges
              rank={user.rank}
              secondaryRank={user.secondaryRank}
              size="md"
              className="w-fit"
            />
          </div>
        </div>
      </section>

      <section className="container-x py-10 sm:py-12">
        {!user.minecraftUsername && (
          <div className="mb-5 rounded-2xl border border-sun/30 bg-sun/10 p-5 sm:p-6">
            <MinecraftIdentity current={null} compact brandName={copy["brand.name"]} />
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]" data-reveal-group>
          <div className="panel p-6 sm:p-7">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-bold text-navy-900">
                  {copy["dashboard.account.title"]}
                </h2>
                <p className="mt-1 text-xs text-navy-500">{copy["dashboard.account.description"]}</p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-aqua-100 bg-aqua-50 text-aqua-700">
                <ShieldIcon width={18} height={18} />
              </span>
            </div>

            <dl className="mt-6 grid gap-4 border-t border-aqua-100 pt-5 sm:grid-cols-2">
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-navy-400">
                  {copy["dashboard.account.minecraft"]}
                </dt>
                <dd className="mt-1 break-all font-mono text-sm font-semibold text-navy-800">
                  {user.minecraftUsername ?? "Not linked"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-navy-400">
                  {copy["dashboard.account.email"]}
                </dt>
                <dd className="mt-1 break-all text-sm text-navy-800">{user.email ?? "Not set"}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-navy-400">
                  {copy["dashboard.account.role"]}
                </dt>
                <dd className="mt-1">
                  <UserRankBadges rank={user.rank} secondaryRank={user.secondaryRank} size="sm" />
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-navy-400">
                  {copy["dashboard.account.since"]}
                </dt>
                <dd className="mt-1 text-sm text-navy-800">{formatDate(user.joinedAt)}</dd>
              </div>
            </dl>

            {user.description && (
              <p className="mt-5 rounded-lg border border-aqua-100 bg-aqua-50/70 px-3.5 py-3 text-xs leading-relaxed text-navy-500">
                {user.description}
              </p>
            )}

            <p className="mt-5 text-[11px] leading-relaxed text-navy-400">
              Your password is stored as a bcrypt hash. It is never sent back to the browser.
            </p>
          </div>

          <div className="space-y-5">
            {user.minecraftUsername && (
              <MinecraftIdentity current={user.minecraftUsername} brandName={copy["brand.name"]} />
            )}

            <div className="panel p-6">
              <h2 className="font-display text-base font-bold text-navy-900">
                {copy["dashboard.session.title"]}
              </h2>
              <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-navy-500">
                {copy["dashboard.session.note"]}
              </p>
              <SignOutButton className="btn-ghost mt-5 w-full !py-2.5 text-xs" />
            </div>

            <div className="panel p-6">
              <h2 className="font-display text-base font-bold text-navy-900">
                {copy["dashboard.shortcuts.title"]}
              </h2>
              <div className="mt-4 flex flex-col gap-2">
                <Link href="/profile" className="btn-subtle justify-between !py-2.5">
                  <span className="inline-flex items-center gap-2">
                    <ShieldIcon width={14} height={14} />
                    Profile
                  </span>
                  <ArrowRightIcon width={14} height={14} />
                </Link>
                {staffPanel && (
                  <Link href="/admin" className="btn-subtle justify-between !py-2.5">
                    Staff Panel
                    <ArrowRightIcon width={14} height={14} />
                  </Link>
                )}
                {owner && (
                  <Link href="/owner" className="btn-subtle justify-between !py-2.5">
                    <span className="inline-flex items-center gap-2">
                      <SettingsIcon width={14} height={14} />
                      Owner console
                    </span>
                    <ArrowRightIcon width={14} height={14} />
                  </Link>
                )}
                {staffWorkspace && !staffPanel && (
                  <Link href="/staff" className="btn-subtle justify-between !py-2.5">
                    Staff workspace
                    <ArrowRightIcon width={14} height={14} />
                  </Link>
                )}
                <Link href="/announcements" className="btn-subtle justify-between !py-2.5">
                  <span className="inline-flex items-center gap-2">
                    <MegaphoneIcon width={14} height={14} />
                    {copy["nav.announcements"]}
                  </span>
                  <ArrowRightIcon width={14} height={14} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
