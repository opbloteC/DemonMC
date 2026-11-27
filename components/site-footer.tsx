import Link from "next/link";
import { LogoWordmark } from "@/components/logo";
import { DiscordIcon } from "@/components/icons";
import { fillCopy } from "@/lib/content";
import {
  isOwnerAccount,
  userCan,
  type SessionUser,
  type SiteSettings,
} from "@/lib/types";

export function SiteFooter({
  settings,
  user,
  copy,
}: {
  settings: SiteSettings;
  user: SessionUser | null;
  copy: Record<string, string>;
}) {
  const staffPanel = user ? userCan(user, "staff_panel.access") : false;
  const staffWorkspace = user ? userCan(user, "staff_workspace.access") : false;
  const ownerAccount = user ? isOwnerAccount(user) : false;
  const brandName = copy["brand.footer"] || "DemonMC";

  return (
    <footer className="relative border-t border-aqua-200/70 bg-white/70 backdrop-blur-md">
      <div className="container-x py-14">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center" aria-label={`${brandName} home`}>
              <LogoWordmark height={34} name={brandName} />
            </Link>
            <p className="mt-4 max-w-xs whitespace-pre-line text-sm leading-relaxed text-navy-500">
              {copy["footer.tagline"]}
            </p>
            <a
              href={settings.discord}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-aqua-200 bg-white px-3.5 py-2 text-sm font-semibold text-navy-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-aqua-300 hover:text-aqua-800 active:translate-y-0 active:scale-[0.98]"
            >
              <DiscordIcon width={16} height={16} />
              {copy["footer.joinDiscord"]}
            </a>
          </div>

          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-navy-400">
              {copy["footer.navigate"]}
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li><Link className="link-muted" href="/">{copy["nav.home"]}</Link></li>
              <li><Link className="link-muted" href="/rules">{copy["nav.rules"] ?? "Rules"}</Link></li>
              <li><Link className="link-muted" href="/store">{copy["nav.store"] ?? "Store"}</Link></li>
              <li><Link className="link-muted" href="/apply">Apply</Link></li>
              <li><Link className="link-muted" href="/report">Report</Link></li>
              <li><Link className="link-muted" href="/announcements">{copy["nav.announcements"]}</Link></li>
              {user ? (
                <>
                  <li><Link className="link-muted" href="/dashboard">Dashboard</Link></li>
                  <li><Link className="link-muted" href="/profile">Profile</Link></li>
                </>
              ) : (
                <>
                  <li><Link className="link-muted" href="/login">{copy["nav.login"]}</Link></li>
                  <li><Link className="link-muted" href="/register">{copy["nav.register"]}</Link></li>
                </>
              )}
              {user && staffWorkspace && !staffPanel && (
                <li><Link className="link-muted" href="/staff">Staff workspace</Link></li>
              )}
              {user && staffPanel && (
                <li><Link className="link-muted" href="/admin">{copy["nav.staff"]}</Link></li>
              )}
              {user && ownerAccount && (
                <li><Link className="link-muted" href="/owner">Owner console</Link></li>
              )}
            </ul>
          </div>

          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-navy-400">
              {copy["footer.connect"]}
            </h3>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <span className="text-xs text-navy-400">{copy["footer.serverIp"]}</span>
                <div className="mt-1 inline-flex rounded-lg border border-aqua-200 bg-white px-2.5 py-1 font-mono text-[13px] font-semibold text-aqua-800 shadow-sm">
                  {settings.ip}
                </div>
              </li>
              <li>
                <a
                  className="link-muted inline-flex items-center gap-1.5"
                  href={settings.discord}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <DiscordIcon width={14} height={14} />
                  {copy["footer.discord"]}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="divider my-10" />

        <div className="flex flex-col gap-3 text-xs text-navy-400 sm:flex-row sm:items-center sm:justify-between">
          <p>{fillCopy(copy["footer.copyright"], { year: new Date().getFullYear() })}</p>
          <p>{copy["footer.owner"]}</p>
        </div>
      </div>
    </footer>
  );
}
