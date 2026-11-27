import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { MinecraftAvatar } from "@/components/minecraft-avatar";
import { MinecraftIdentity } from "@/components/minecraft-identity";
import { ProfileSettings } from "@/components/profile-settings";
import { SignOutButton } from "@/components/sign-out";
import {
  ArrowRightIcon,
  DashboardIcon,
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
    title: "Profile",
    description: `Your ${branding.name} account profile.`,
    robots: { index: false, follow: false },
  };
}

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/profile");
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
            {copy["profile.eyebrow"]}
          </p>
          <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              {user.minecraftUsername ? (
                <MinecraftAvatar
                  username={user.minecraftUsername}
                  size={62}
                  className="!rounded-xl"
                />
              ) : (
                <Avatar name={name} src={user.avatarUrl} size={62} />
              )}
              <div className="min-w-0">
                <p className="break-all text-sm text-navy-500">
                  {name} · member since {formatDate(user.joinedAt)}
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
        <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]" data-reveal-group>
          <div className="space-y-5">
            <MinecraftIdentity current={user.minecraftUsername} brandName={copy["brand.name"]} />

            <div className="panel p-6">
              <h2 className="font-display text-base font-bold text-navy-900">
                {copy["profile.account.title"]}
              </h2>
              <dl className="mt-4 space-y-3 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-navy-400">{copy["profile.email"]}</dt>
                  <dd className="break-all text-right text-navy-800">{user.email ?? "Not set"}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-navy-400">{copy["profile.role"]}</dt>
                  <dd>
                    <UserRankBadges rank={user.rank} secondaryRank={user.secondaryRank} size="sm" />
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-navy-400">{copy["profile.joined"]}</dt>
                  <dd className="text-navy-800">{formatDate(user.joinedAt)}</dd>
                </div>
              </dl>
              <p className="mt-4 whitespace-pre-line rounded-lg border border-aqua-100 bg-aqua-50/70 px-3.5 py-3 text-[11px] leading-relaxed text-navy-400">
                {copy["profile.privacy"]}
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <ProfileSettings user={user} />

            <div className="panel p-6">
              <h2 className="font-display text-base font-bold text-navy-900">
                {copy["profile.shortcuts.title"]}
              </h2>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Link href="/dashboard" className="btn-subtle justify-between !py-2.5">
                  <span className="inline-flex items-center gap-2">
                    <DashboardIcon width={14} height={14} />
                    Dashboard
                  </span>
                  <ArrowRightIcon width={14} height={14} />
                </Link>
                {staffWorkspace && !staffPanel && (
                  <Link href="/staff" className="btn-subtle justify-between !py-2.5">
                    <span className="inline-flex items-center gap-2">
                      <ShieldIcon width={14} height={14} />
                      Staff workspace
                    </span>
                    <ArrowRightIcon width={14} height={14} />
                  </Link>
                )}
                {staffPanel && (
                  <Link href="/admin" className="btn-subtle justify-between !py-2.5">
                    <span className="inline-flex items-center gap-2">
                      <ShieldIcon width={14} height={14} />
                      Staff Panel
                    </span>
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
                <Link href="/announcements" className="btn-subtle justify-between !py-2.5">
                  <span className="inline-flex items-center gap-2">
                    <MegaphoneIcon width={14} height={14} />
                    {copy["nav.announcements"]}
                  </span>
                  <ArrowRightIcon width={14} height={14} />
                </Link>
              </div>

              <div className="mt-5 flex flex-col gap-2 border-t border-aqua-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] leading-relaxed text-navy-400">
                  Signing out clears your session cookie on this device.
                </p>
                <SignOutButton className="btn-ghost !py-2.5 text-xs" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
