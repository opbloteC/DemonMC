"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AccountDrawer } from "@/components/account-drawer";
import { BrandLogo } from "@/components/logo";
import { MinecraftAvatar } from "@/components/minecraft-avatar";
import { CloseIcon, HammerIcon, MenuIcon } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { userCan, type SessionUser, type SiteSettings } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  emoji: string;
  external?: boolean;
}

function StaffHammer({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/admin"
      aria-label="Staff Panel"
      title="Staff Panel"
      className={`group relative grid h-9 w-9 shrink-0 place-items-center rounded-full border border-sun/30 bg-sun/10 text-ember transition-all duration-200 hover:-translate-y-0.5 hover:border-sun/60 hover:bg-sun/20 hover:text-sun-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun/60 ${className}`}
    >
      <HammerIcon
        width={16}
        height={16}
        className="transition-transform duration-200 group-hover:-rotate-12"
      />
      <span
        role="tooltip"
        className="pointer-events-none absolute right-0 top-full z-20 mt-2 hidden whitespace-nowrap rounded-md border border-aqua-200 bg-white px-2 py-1 text-[10px] font-semibold text-navy-700 shadow-card group-hover:block group-focus-visible:block"
      >
        Staff Panel
      </span>
    </Link>
  );
}

export function SiteHeader({
  settings,
  user,
  copy,
}: {
  settings: SiteSettings;
  user: SessionUser | null;
  copy: Record<string, string>;
}) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);

  const displayName = user ? (user.minecraftUsername ?? user.username) : "";
  const brandName = copy["brand.navbar"] || "DemonMC";
  const canUseStaffPanel = Boolean(user && userCan(user, "staff_panel.access"));
  const storedProfileLabel = copy["nav.account"]?.trim();
  const profileLabel =
    !storedProfileLabel || storedProfileLabel.toLowerCase() === "account"
      ? "Profile"
      : storedProfileLabel;

  const nav: NavItem[] = [
    { href: "/", label: copy["nav.home"] ?? "Home", emoji: "🏠" },
    { href: "/rules", label: copy["nav.rules"] ?? "Rules", emoji: "📜" },
    {
      href: "/announcements",
      label: copy["nav.announcements"] ?? "Announcements",
      emoji: "📢",
    },
    { href: "/store", label: copy["nav.store"] ?? "Store", emoji: "🛒" },
    { href: "/apply", label: "Apply", emoji: "📝" },
    { href: "/report", label: "Report", emoji: "🚩" },
  ];

  useEffect(() => {
    let frame = 0;
    const apply = () => {
      frame = 0;
      setScrolled(window.scrollY > 8);
    };
    const onScroll = () => {
      if (frame === 0) frame = window.requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    setAccountOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!shellRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onResize = () => {
      if (desktop.matches) setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    desktop.addEventListener("change", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
      desktop.removeEventListener("change", onResize);
    };
  }, [menuOpen]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  const isHome = pathname === "/";

  return (
    <>
      <header className="sticky top-0 z-50 px-3 pt-3 sm:px-5">
        <div
          ref={shellRef}
          className={`site-header-shell relative mx-auto w-full max-w-6xl rounded-2xl border backdrop-blur-xl transition-all duration-300 ${
            scrolled
              ? `border-white/90 shadow-[0_20px_45px_-32px_rgba(9,60,90,0.55)] ${
                  isHome ? "bg-white/90" : "bg-white/85"
                }`
              : `shadow-[0_18px_40px_-36px_rgba(9,60,90,0.45)] ${
                  isHome ? "border-white/75 bg-white/75" : "border-white/60 bg-white/60"
                }`
          }`}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-sun/45 to-transparent"
          />

          <div className="relative flex h-[64px] flex-nowrap items-center gap-2 px-3 sm:h-[76px] sm:gap-3 sm:px-5">
            <Link
              href="/"
              className="group flex shrink-0 items-center"
              aria-label={`${brandName} home`}
            >
              <BrandLogo
                name={brandName}
                className="h-[45px] w-[145px] shrink-0 object-contain drop-shadow-[0_6px_14px_rgba(12,110,160,0.3)] transition-transform duration-300 group-hover:scale-[1.03] sm:h-[60px] sm:w-[190px]"
              />
            </Link>

            <nav
              className="hidden min-w-0 flex-1 flex-nowrap items-center justify-center gap-0.5 lg:flex"
              aria-label="Main navigation"
            >
              {nav.map((item) => {
                const active = !item.external && isActive(item.href);
                const className = `group relative flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-2 text-[12px] font-semibold transition-all duration-200 hover:-translate-y-px active:translate-y-0 active:scale-[0.98] xl:px-3 ${
                  active
                    ? "bg-sun/10 text-navy-900"
                    : "text-navy-500 hover:bg-white/70 hover:text-navy-900"
                }`;
                const content = (
                  <>
                    <span
                      aria-hidden="true"
                      className="text-[13px] leading-none transition-transform duration-200 group-hover:-translate-y-0.5 xl:text-sm"
                    >
                      {item.emoji}
                    </span>
                    {item.label}
                    {!item.external && (
                      <span
                        aria-hidden="true"
                        className={`absolute inset-x-2 bottom-0.5 h-[2px] origin-center rounded-full bg-sun-deep transition-all duration-200 ${
                          active ? "scale-x-100 opacity-100" : "scale-x-50 opacity-0"
                        }`}
                      />
                    )}
                  </>
                );

                return item.external ? (
                  <a
                    key={item.href}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={className}
                  >
                    {content}
                  </a>
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={className}
                    aria-current={active ? "page" : undefined}
                  >
                    {content}
                  </Link>
                );
              })}
            </nav>

            <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2.5">
              <ThemeToggle />
              {canUseStaffPanel && <StaffHammer className="hidden lg:grid" />}

              {user ? (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setAccountOpen(true);
                  }}
                  aria-label={`Open ${profileLabel}`}
                  aria-haspopup="dialog"
                  aria-expanded={accountOpen}
                  className="inline-flex items-center rounded-full border border-sun/25 bg-white/90 p-1 shadow-sm transition hover:-translate-y-0.5 hover:border-sun/50 hover:bg-white active:translate-y-0 active:scale-95"
                >
                  <MinecraftAvatar username={displayName} size={30} className="!rounded-full" />
                  <span className="sr-only">{profileLabel}</span>
                </button>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="btn-ghost hidden !rounded-full !px-3.5 !py-2 text-xs lg:inline-flex"
                  >
                    {copy["nav.login"] ?? "Login"}
                  </Link>
                  <Link
                    href="/register"
                    className="btn-primary hidden !rounded-full !px-4 !py-2 text-xs min-[380px]:inline-flex"
                  >
                    {copy["nav.register"] ?? "Register"}
                  </Link>
                </>
              )}

              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
                aria-expanded={menuOpen}
                aria-controls="mobile-navigation"
                className="grid h-9 w-9 place-items-center rounded-full border border-aqua-200 bg-white/90 text-navy-600 shadow-sm transition hover:border-sun/40 hover:text-sun-deep active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun/50 lg:hidden"
              >
                {menuOpen ? (
                  <CloseIcon width={16} height={16} />
                ) : (
                  <MenuIcon width={17} height={17} />
                )}
              </button>
            </div>
          </div>

          <div
            id="mobile-navigation"
            className={`site-mobile-navigation absolute inset-x-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-white/80 bg-white/95 shadow-[0_26px_60px_-30px_rgba(9,60,90,0.55)] backdrop-blur-xl transition-all duration-300 ease-out lg:hidden ${
              menuOpen
                ? "pointer-events-auto translate-y-0 opacity-100"
                : "pointer-events-none -translate-y-1 opacity-0"
            }`}
            aria-hidden={!menuOpen}
          >
            <nav className="p-2" aria-label="Mobile navigation">
              {nav.map((item) => {
                const active = !item.external && isActive(item.href);
                const rowClass = `flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-200 active:scale-[0.99] ${
                  active
                    ? "bg-sun/10 text-navy-900"
                    : "text-navy-600 hover:bg-aqua-50 hover:text-navy-900"
                }`;
                const row = (
                  <>
                    <span
                      aria-hidden="true"
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-aqua-100 bg-white/70 text-[13px] leading-none"
                    >
                      {item.emoji}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {active && (
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 rounded-full bg-sun-deep"
                      />
                    )}
                  </>
                );
                return item.external ? (
                  <a
                    key={item.href}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={rowClass}
                    tabIndex={menuOpen ? undefined : -1}
                  >
                    {row}
                  </a>
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={rowClass}
                    aria-current={active ? "page" : undefined}
                    tabIndex={menuOpen ? undefined : -1}
                  >
                    {row}
                  </Link>
                );
              })}

              <div className="my-1.5 h-px bg-aqua-200/70" aria-hidden="true" />

              {canUseStaffPanel && (
                <Link
                  href="/admin"
                  className="flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-navy-600 transition-colors hover:bg-sun/10 hover:text-sun-deep"
                  tabIndex={menuOpen ? undefined : -1}
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-sun/30 bg-sun/10 text-sun-deep">
                    <HammerIcon width={14} height={14} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">Staff Panel</span>
                </Link>
              )}

              {user ? (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setAccountOpen(true);
                  }}
                  className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-navy-600 transition-colors hover:bg-aqua-50 hover:text-navy-900"
                  tabIndex={menuOpen ? undefined : -1}
                >
                  <span
                    aria-hidden="true"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-aqua-100 bg-white/70 text-[13px] leading-none"
                  >
                    👤
                  </span>
                  <span className="min-w-0 flex-1 truncate text-left">{profileLabel}</span>
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-2 p-1 pt-2">
                  <Link
                    href="/login"
                    className="btn-ghost !rounded-xl !py-2.5 text-xs"
                    tabIndex={menuOpen ? undefined : -1}
                  >
                    {copy["nav.login"] ?? "Login"}
                  </Link>
                  <Link
                    href="/register"
                    className="btn-primary !rounded-xl !py-2.5 text-xs"
                    tabIndex={menuOpen ? undefined : -1}
                  >
                    {copy["nav.register"] ?? "Register"}
                  </Link>
                </div>
              )}
            </nav>
          </div>
        </div>
      </header>

      {user && (
        <AccountDrawer
          user={user}
          open={accountOpen}
          onClose={() => setAccountOpen(false)}
          discord={settings.discord}
          brandName={brandName}
        />
      )}
    </>
  );
}
