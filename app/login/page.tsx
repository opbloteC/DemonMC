import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DiscordIcon, LockIcon } from "@/components/icons";
import { BrandLogo } from "@/components/logo";
import { LoginForm } from "@/components/login-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { getSessionUser } from "@/lib/auth";
import { getBranding } from "@/lib/branding";
import { getContent } from "@/lib/content";
import { getSettings } from "@/lib/settings";
import { isStaffRole } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getBranding();
  return {
    title: "Sign in",
    description: `Sign in to the ${branding.name} Minecraft network.`,
    robots: { index: false, follow: false },
  };
}

export const dynamic = "force-dynamic";

function safeNext(value: string | string[] | undefined): string {
  if (typeof value !== "string") return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/dashboard";
  if (value.startsWith("/login")) return "/dashboard";
  return value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string | string[];
    registered?: string | string[];
    reset?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const target = safeNext(params.next);
  const registered = params.registered === "1";
  const passwordReset = params.reset === "1";
  const user = await getSessionUser();

  if (user) {
    redirect(!isStaffRole(user.role) && target.startsWith("/staff") ? "/dashboard" : target);
  }

  const [settings, copy] = await Promise.all([getSettings(), getContent()]);

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

      <header className="container-x relative z-10 flex h-20 items-center justify-end">
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <a
            href={settings.discord}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-2 text-xs font-semibold text-navy-500 transition-colors hover:text-navy-900 sm:inline-flex"
          >
            <DiscordIcon width={15} height={15} />
            Discord
          </a>
          <Link href="/register" className="btn-ghost !px-4 !py-2 text-xs">
            {copy["nav.register"]}
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-5 py-10 sm:py-14">
        <div className="w-full max-w-[440px] animate-fade-up">
          <div className="mb-7 text-center">
            <BrandLogo
              name={copy["brand.login"]}
              variant="hero"
              className="mx-auto h-auto w-[min(78vw,350px)] max-w-full object-contain drop-shadow-[0_28px_46px_rgba(12,110,160,0.28)] sm:w-[370px] lg:w-[390px]"
            />
            <p className="eyebrow mt-5">{copy["login.eyebrow"]}</p>
            <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-navy-900 sm:text-4xl">
              {copy["login.heading"]}
            </h1>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-navy-500">
              {copy["login.subheading"]}
            </p>
          </div>

          <div className="panel relative overflow-hidden p-6 shadow-[0_30px_70px_-40px_rgba(9,60,90,0.5)] sm:p-7">
            <span
              className="absolute inset-x-8 top-0 h-1 rounded-full bg-gradient-to-r from-transparent via-sun to-transparent"
              aria-hidden="true"
            />

            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-sm font-bold text-navy-900">
                  {copy["login.cardTitle"]}
                </h2>
                <p className="mt-1 text-[11px] text-navy-400">{copy["login.cardDescription"]}</p>
              </div>
              <span className="badge border-aqua-200 bg-aqua-50 text-aqua-700">
                <LockIcon width={12} height={12} />
                Secure
              </span>
            </div>

            {registered && (
              <p
                role="status"
                className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs leading-relaxed text-emerald-700"
              >
                {copy["login.registered"]}              </p>
            )}

            {passwordReset && (
              <p
                role="status"
                className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs leading-relaxed text-emerald-700"
              >
                {copy["login.reset"]}
              </p>
            )}

            <LoginForm nextPath={target} copy={copy} />

            <div className="divider my-6" />

            <p className="text-center text-[11px] leading-relaxed text-navy-400">
              {copy["login.newHere"]}{" "}
              <Link
                href="/register"
                className="font-semibold text-aqua-700 transition-colors hover:text-aqua-800"
              >
                {copy["login.create"]}
              </Link>
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] text-navy-400">
            <span className="font-mono">{settings.ip}</span>
            <span className="h-3 w-px bg-aqua-200" aria-hidden="true" />
            <a
              href={settings.discord}
              target="_blank"
              rel="noopener noreferrer"
              className="link-muted inline-flex items-center gap-1.5"
            >
              <DiscordIcon width={13} height={13} />
              {copy["login.community"]}
            </a>
          </div>
        </div>
      </main>

      <footer className="relative z-10 pb-6 text-center text-[10px] uppercase tracking-[0.24em] text-navy-300">
        {copy["login.footer"]}
      </footer>
    </div>
  );
}
