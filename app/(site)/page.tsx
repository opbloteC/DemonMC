import Link from "next/link";
import { AnnouncementCard } from "@/components/announcement-card";
import { CopyIp } from "@/components/copy-ip";
import { ServerStatusBar } from "@/components/server-status";
import { RankBadge } from "@/components/rank-badge";
import { SectionHeading } from "@/components/section-heading";
import { BrandLogo } from "@/components/logo";
import {
  ArrowRightIcon,
  CubeIcon,
  DiscordIcon,
  ExternalIcon,
  MegaphoneIcon,
  ShieldIcon,
  UsersIcon,
} from "@/components/icons";
import { getSessionUser } from "@/lib/auth";
import { fillCopy, getContent } from "@/lib/content";
import { formatDate, displayName } from "@/lib/format";
import { effectiveIpDisplayText, getIpDisplaySettings } from "@/lib/ip-display";
import { getPublicServerStatus } from "@/lib/server-status";
import { listPublicAnnouncements } from "@/lib/queries";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const settingsPromise = getSettings();
  const [settings, content, ipDisplay, announcements, status, user] = await Promise.all([
    settingsPromise,
    getContent(),
    getIpDisplaySettings(),
    listPublicAnnouncements(3),
    settingsPromise.then((value) => getPublicServerStatus(value.ip)),
    getSessionUser(),
  ]);
  const displayIp = effectiveIpDisplayText(settings.ip, ipDisplay.displayText);

  const features = [
    {
      icon: CubeIcon,
      tag: content["home.features.one.tag"],
      title: content["home.features.one.title"],
      copy: content["home.features.one.copy"],
    },
    {
      icon: UsersIcon,
      tag: content["home.features.two.tag"],
      title: content["home.features.two.title"],
      copy: content["home.features.two.copy"],
    },
    {
      icon: ShieldIcon,
      tag: content["home.features.three.tag"],
      title: content["home.features.three.title"],
      copy: content["home.features.three.copy"],
    },
    {
      icon: MegaphoneIcon,
      tag: content["home.features.four.tag"],
      title: content["home.features.four.title"],
      copy: content["home.features.four.copy"],
    },
  ];

  const steps = [
    {
      step: "01",
      title: content["home.steps.one.title"],
      copy: fillCopy(content["home.steps.one.copy"], { ip: settings.ip }),
    },
    {
      step: "02",
      title: content["home.steps.two.title"],
      copy: fillCopy(content["home.steps.two.copy"], { ip: settings.ip }),
    },
    {
      step: "03",
      title: content["home.steps.three.title"],
      copy: fillCopy(content["home.steps.three.copy"], { ip: settings.ip }),
    },
  ];

  const kicker = content["home.hero.kicker"];
  const kickerBreak = kicker.lastIndexOf(" ");

  const inviteLabel = settings.discord.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <>
      <section className="home-hero relative isolate overflow-hidden">
        <div className="container-x relative z-10 flex min-h-[calc(100svh-100px)] flex-col items-center justify-center py-16 text-center sm:py-20">
          {user ? (
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/90 bg-white/85 px-3.5 py-1.5 text-[11px] font-semibold text-navy-600 shadow-md backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Signed in as {displayName(user)} ·{" "}
              <RankBadge rank={user.rank} size="sm" />
            </div>
          ) : null}

          <h1 className="sr-only">{content["site.headline"]}</h1>

          <BrandLogo
            name={content["brand.hero"]}
            variant="hero"
            widths={[520, 780, 1040, 1170, 1560]}
            sizes="(min-width: 1024px) 520px, (min-width: 640px) 470px, min(92vw, 430px)"
            className="mt-4 h-auto w-[min(92vw,430px)] max-w-full object-contain drop-shadow-[0_28px_46px_rgba(12,110,160,0.28)] animate-fade-up sm:mt-6 sm:w-[470px] lg:w-[520px]"
          />

          <div className="mt-7 flex items-center gap-4 animate-fade-up [animation-delay:80ms] sm:gap-6">
            <span className="hidden h-px w-14 bg-navy-400/40 sm:block" aria-hidden="true" />
            <p className="font-display text-[19px] font-extrabold uppercase leading-none tracking-[0.08em] text-navy-900 sm:text-2xl lg:text-[1.7rem]">
              {kickerBreak > 0 ? (
                <>
                  {kicker.slice(0, kickerBreak)}{" "}
                  <span className="text-sun-deep">{kicker.slice(kickerBreak + 1)}</span>
                </>
              ) : (
                kicker
              )}
            </p>
            <span className="hidden h-px w-14 bg-navy-400/40 sm:block" aria-hidden="true" />
          </div>

          <p className="mt-5 max-w-2xl whitespace-pre-line text-[15px] leading-relaxed text-navy-600 animate-fade-up [animation-delay:140ms] sm:text-lg">
            {content["site.subtitle"]}
          </p>

          <div className="mt-9 flex w-full justify-center animate-fade-up [animation-delay:200ms]">
            <ServerStatusBar
              initial={status}
              ip={settings.ip}
              displayText={displayIp}
              showGlobe={ipDisplay.showGlobe}
            />
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3 animate-fade-up [animation-delay:260ms]">
            <a
              href={settings.discord}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary group !rounded-full !px-7 !py-3.5 text-sm sm:text-[15px]"
            >
              <DiscordIcon width={18} height={18} />
              {content["home.hero.primaryCta"]}
              <ArrowRightIcon
                width={16}
                height={16}
                className="transition-transform duration-200 group-hover:translate-x-0.5"
              />
            </a>
            <Link
              href="/report"
              className="btn-ghost group !rounded-full !px-6 !py-3.5 text-sm sm:text-[15px]"
            >
              <ShieldIcon width={17} height={17} className="text-navy-500" />
              Report a player or bug
              <ArrowRightIcon
                width={16}
                height={16}
                className="transition-transform duration-200 group-hover:translate-x-0.5"
              />
            </Link>
          </div>
        </div>
      </section>

      <section className="container-x py-20 sm:py-24">
        <SectionHeading
          eyebrow={content["home.steps.eyebrow"]}
          title={content["home.steps.title"]}
          description={content["home.steps.description"]}
        />
        <div className="mt-9 grid gap-4 sm:grid-cols-3" data-reveal-group>
          {steps.map((item) => (
            <article key={item.step} className="panel panel-hover relative overflow-hidden p-6">
              <span className="font-mono text-[11px] font-semibold text-sun-deep">{item.step}</span>
              <h3 className="mt-3 font-display text-lg font-bold text-navy-900">{item.title}</h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-navy-500">
                {item.copy}
              </p>
            </article>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-aqua-200/80 bg-white/70 px-5 py-4 text-center shadow-sm backdrop-blur">
          <p className="flex flex-wrap items-center justify-center gap-2 text-sm text-navy-500">
            <span>{content["home.steps.ipPrompt"]}</span>
            <CopyIp ip={settings.ip} />
          </p>
        </div>
      </section>

      <section className="container-x pb-20 sm:pb-24">
        <SectionHeading
          eyebrow={content["home.features.eyebrow"]}
          title={content["home.features.title"]}
          description={content["home.features.description"]}
        />
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-reveal-group>
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <article
                key={`${feature.title}-${index}`}
                className="panel panel-hover group p-6"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-aqua-100 bg-aqua-50 text-aqua-700 transition-colors group-hover:border-sun/30 group-hover:bg-sun/10 group-hover:text-sun-deep">
                    <Icon width={19} height={19} />
                  </span>
                  <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-aqua-500">
                    {feature.tag}
                  </span>
                </div>
                <h3 className="mt-5 font-display text-base font-bold text-navy-900">
                  {feature.title}
                </h3>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-navy-500">
                  {feature.copy}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="container-x pb-20 sm:pb-24">
        <SectionHeading
          eyebrow={content["home.news.eyebrow"]}
          title={content["home.news.title"]}
          description={content["home.news.description"]}
          action={
            <Link href="/announcements" className="btn-subtle group">
              {content["home.news.all"]}
              <ArrowRightIcon
                width={13}
                height={13}
                className="transition-transform duration-200 group-hover:translate-x-0.5"
              />
            </Link>
          }
        />

        {announcements.length > 0 ? (
          <div className="mt-8 grid gap-4 md:grid-cols-3" data-reveal-group>
            {announcements.map((announcement) => (
              <AnnouncementCard key={announcement.id} announcement={announcement} clamped />
            ))}
          </div>
        ) : (
          <div className="panel mt-8 flex flex-col items-center px-6 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-aqua-100 bg-aqua-50 text-aqua-600">
              <MegaphoneIcon width={20} height={20} />
            </span>
            <h3 className="mt-4 font-display text-lg font-bold text-navy-900">
              {content["home.news.empty.title"]}
            </h3>
            <p className="mt-2 max-w-sm text-sm text-navy-500">
              {content["home.news.empty.description"]} Latest check:{" "}
              {formatDate(new Date().toISOString())}.
            </p>
          </div>
        )}
      </section>

      <section className="container-x pb-24">
        <div className="panel relative overflow-hidden border-aqua-200/90 bg-gradient-to-br from-white/95 via-aqua-50/90 to-aqua-100/80" data-reveal>
          <div className="block-motif pointer-events-none absolute inset-0 opacity-30" aria-hidden="true" />
          <div
            className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-sun/10 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative grid gap-9 p-7 sm:p-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div>
              <p className="eyebrow flex items-center gap-3">
                <span className="h-px w-8 bg-sun/80" />
                {content["home.community.eyebrow"]}
              </p>
              <h2 className="mt-3 font-display text-2xl font-bold uppercase tracking-tight text-navy-900 sm:text-3xl">
                {content["home.community.title"]}
              </h2>
              <p className="mt-3 max-w-lg whitespace-pre-line text-sm leading-relaxed text-navy-500 sm:text-[15px]">
                {content["home.community.description"]}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={settings.discord}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary"
                >
                  <DiscordIcon width={17} height={17} />
                  {content["home.community.cta"]}
                </a>
                <Link href="/report" className="btn-ghost">
                  Report a player or bug
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-aqua-200 bg-white/90 p-5 shadow-card">
              <div className="flex items-center gap-3.5">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#5865F2]/12 text-[#5865F2]">
                  <DiscordIcon width={22} height={22} />
                </span>
                <div className="min-w-0">
                  <p className="font-display text-sm font-bold text-navy-900">
                    {content["home.community.cardTitle"]}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-xs text-navy-400">{inviteLabel}</p>
                </div>
              </div>
              <div className="divider my-4" />
              <p className="whitespace-pre-line text-xs leading-relaxed text-navy-500">
                {content["home.community.cardNote"]}
              </p>
              <a
                href={settings.discord}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost mt-4 w-full !py-2.5 text-xs"
              >
                {content["home.community.cardCta"]}
                <ExternalIcon width={14} height={14} />
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
