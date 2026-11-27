import type { ReactNode } from "react";
import Link from "next/link";
import { DiscordIcon, LockIcon } from "@/components/icons";
import { LogoMark, Wordmark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export function AuthShell({
  heading,
  subheading,
  cardTitle,
  cardDescription,
  headerAction,
  ip,
  discord,
  brandName = "DemonMC",
  community = "Community Discord",
  footer,
  children,
}: {
  heading: string;
  subheading: string;
  cardTitle: string;
  cardDescription: string;
  headerAction: ReactNode;
  ip: string;
  discord: string;
  brandName?: string;
  community?: string;
  footer?: string;
  children: ReactNode;
}) {
  return (
    <div className="hero-shell relative flex min-h-screen flex-col">
      <div className="hero-grid" aria-hidden="true" />
      <div className="hero-glow" aria-hidden="true" />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[8%] top-[24%] hidden h-16 w-16 rotate-12 rounded-lg border border-white/70 bg-white/40 lg:block"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[10%] top-[58%] hidden h-10 w-10 -rotate-6 rounded-md border border-sun/40 bg-sun/20 lg:block"
      />

      <header className="container-x relative z-10 flex h-20 items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5" aria-label={`${brandName} home`}>
          <LogoMark size={34} />
          <Wordmark name={brandName} className="text-[16px]" />
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <a
            href={discord}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-2 text-xs font-semibold text-navy-500 transition-colors hover:text-navy-900 sm:inline-flex"
          >
            <DiscordIcon width={15} height={15} />
            Discord
          </a>
          {headerAction}
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-5 py-10 sm:py-14">
        <div className="w-full max-w-[440px] animate-fade-up">
          <div className="mb-7 text-center">
            <div className="mx-auto flex h-[70px] w-[70px] items-center justify-center rounded-2xl border border-aqua-200/70 bg-white/90 shadow-[0_18px_40px_-22px_rgba(12,110,160,0.6)]">
              <LogoMark size={46} />
            </div>
            <p className="eyebrow mt-5">{brandName} Network</p>
            <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-navy-900 sm:text-4xl">
              {heading}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-navy-500">{subheading}</p>
          </div>

          <div className="panel relative overflow-hidden p-6 shadow-[0_30px_70px_-40px_rgba(9,60,90,0.5)] sm:p-7">
            <span
              className="absolute inset-x-8 top-0 h-1 rounded-full bg-gradient-to-r from-transparent via-sun to-transparent"
              aria-hidden="true"
            />

            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-sm font-bold text-navy-900">{cardTitle}</h2>
                <p className="mt-1 text-[11px] text-navy-400">{cardDescription}</p>
              </div>
              <span className="badge border-aqua-200 bg-aqua-50 text-aqua-700">
                <LockIcon width={12} height={12} />
                Secure
              </span>
            </div>

            {children}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] text-navy-400">
            <span className="font-mono">{ip}</span>
            <span className="h-3 w-px bg-aqua-200" aria-hidden="true" />
            <a
              href={discord}
              target="_blank"
              rel="noopener noreferrer"
              className="link-muted inline-flex items-center gap-1.5"
            >
              <DiscordIcon width={13} height={13} />
              {community}
            </a>
          </div>
        </div>
      </main>

      <footer className="relative z-10 pb-6 text-center text-[10px] uppercase tracking-[0.24em] text-navy-300">
        {footer ?? `${brandName} · Enter the world`}
      </footer>
    </div>
  );
}
