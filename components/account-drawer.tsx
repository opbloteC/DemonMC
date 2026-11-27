"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MinecraftAvatar } from "@/components/minecraft-avatar";
import { SignOutButton } from "@/components/sign-out";
import {
  CloseIcon,
  CubeIcon,
  LockIcon,
  MailIcon,
  UserIcon,
} from "@/components/icons";
import { UserRankBadges } from "@/components/rank-badge";
import { ThemeSwitch } from "@/components/theme-switch";
import { displayName } from "@/lib/format";
import type { SessionUser } from "@/lib/types";

const EMAIL =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

type Msg = { tone: "ok" | "error"; text: string } | null;

export function AccountDrawer({
  user,
  open,
  onClose,
  discord,
  brandName = "DemonMC",
}: {
  user: SessionUser;
  open: boolean;
  onClose: () => void;
  discord: string;
  brandName?: string;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  const username = user.minecraftUsername ?? "";
  const [email, setEmail] = useState(user.email ?? "");
  const [savedEmail, setSavedEmail] = useState(user.email ?? "");
  const [profileMsg, setProfileMsg] = useState<Msg>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [password, setPassword] = useState({ current: "", next: "", confirm: "" });
  const [passwordMsg, setPasswordMsg] = useState<Msg>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const frame = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(frame);
    }
    setShown(false);
    const timer = setTimeout(() => setMounted(false), 320);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = setTimeout(() => closeRef.current?.focus(), 120);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
      clearTimeout(focusTimer);
    };
  }, [open, onClose]);

  if (!mounted) return null;

  const display = username.trim() || displayName(user);
  const emailChanged = email.trim().toLowerCase() !== savedEmail;
  const profileDirty = emailChanged;

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingProfile || !profileDirty) return;
    setProfileMsg(null);

    const nextEmail = email.trim().toLowerCase();

    if (!EMAIL.test(nextEmail)) {
      setProfileMsg({ tone: "error", text: "Enter a valid email address." });
      return;
    }

    setSavingProfile(true);
    try {
      const res = await fetch("/api/auth/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: nextEmail }),
      });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setProfileMsg({ tone: "error", text: data?.error ?? "Could not save your email address." });
        return;
      }
      setSavedEmail(nextEmail);
      setEmail(nextEmail);

      setProfileMsg({ tone: "ok", text: "Profile information updated." });
      router.refresh();
    } catch {
      setProfileMsg({ tone: "error", text: "Network error. Please try again." });
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingPassword) return;
    setPasswordMsg(null);

    if (!password.current) {
      setPasswordMsg({ tone: "error", text: "Enter your current password." });
      return;
    }
    if (password.next.length < 10 || !/[A-Za-z]/.test(password.next) || !/\d/.test(password.next)) {
      setPasswordMsg({
        tone: "error",
        text: "New password must be 10–200 characters and include a letter and a number.",
      });
      return;
    }
    if (password.next !== password.confirm) {
      setPasswordMsg({ tone: "error", text: "New password and confirmation do not match." });
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: password.current,
          newPassword: password.next,
        }),
      });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setPasswordMsg({ tone: "error", text: data?.error ?? "Could not update your password." });
        return;
      }
      setPassword({ current: "", next: "", confirm: "" });
      setPasswordMsg({
        tone: "ok",
        text: "Password updated. Other signed-in devices were signed out.",
      });
    } catch {
      setPasswordMsg({ tone: "error", text: "Network error. Please try again." });
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className={`fixed inset-0 z-[60] ${open ? "" : "pointer-events-none"}`}>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`absolute inset-0 bg-navy-900/35 backdrop-blur-[2px] transition-opacity duration-300 ${
          shown ? "opacity-100" : "opacity-0"
        }`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Profile"
        className={`absolute inset-y-0 right-0 flex w-full flex-col overflow-hidden bg-gradient-to-b from-aqua-50 via-white to-aqua-50 shadow-[0_30px_80px_-30px_rgba(9,60,90,0.6)] transition-transform duration-300 ease-[cubic-bezier(0.22,0.75,0.22,1)] sm:max-w-[430px] sm:rounded-l-[28px] sm:border-l sm:border-white/80 ${
          shown ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="relative overflow-hidden border-b border-aqua-200/70 bg-gradient-to-br from-aqua-100 via-aqua-50 to-white px-5 py-5 sm:px-6">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-sun/15 blur-2xl"
          />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <MinecraftAvatar username={display} size={58} />
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-extrabold leading-tight text-navy-900">
                  {display}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <UserRankBadges rank={user.rank} secondaryRank={user.secondaryRank} size="sm" />
                  <span className="text-[11px] font-medium text-navy-400">{brandName} profile</span>
                </div>
              </div>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close profile panel"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-aqua-200 bg-white/90 text-navy-500 shadow-sm transition hover:bg-white hover:text-navy-800"
            >
              <CloseIcon width={16} height={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="mb-4 grid grid-cols-3 gap-2">
            <Link
              href="/profile"
              className="flex flex-col items-center gap-1.5 rounded-xl border border-aqua-200/80 bg-white/80 px-2 py-3 text-[11px] font-semibold text-navy-600 transition hover:-translate-y-0.5 hover:border-sun/40 hover:text-sun-deep"
            >
              <span aria-hidden="true" className="text-base leading-none">
                👤
              </span>
              Profile
            </Link>
            <Link
              href="/announcements"
              className="flex flex-col items-center gap-1.5 rounded-xl border border-aqua-200/80 bg-white/80 px-2 py-3 text-[11px] font-semibold text-navy-600 transition hover:-translate-y-0.5 hover:border-sun/40 hover:text-sun-deep"
            >
              <span aria-hidden="true" className="text-base leading-none">
                📢
              </span>
              What&apos;s New
            </Link>
            <a
              href={discord}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1.5 rounded-xl border border-aqua-200/80 bg-white/80 px-2 py-3 text-[11px] font-semibold text-navy-600 transition hover:-translate-y-0.5 hover:border-sun/40 hover:text-sun-deep"
            >
              <span aria-hidden="true" className="text-base leading-none">
                💬
              </span>
              Support
            </a>
          </div>

          <form
            onSubmit={saveProfile}
            noValidate
            className="rounded-2xl border border-aqua-200/80 bg-white/85 p-4 shadow-card sm:p-5"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-aqua-100 bg-aqua-50 text-aqua-700">
                <UserIcon width={16} height={16} />
              </span>
              <div>
                <h2 className="font-display text-sm font-bold text-navy-900">Profile information</h2>
                <p className="text-[11px] text-navy-400">Used for your roster profile and sign-in.</p>
              </div>
            </div>

            <div className="mt-4 space-y-3.5">
              <div>
                <label htmlFor="drawer-username" className="label">
                  Minecraft username
                </label>
                <div className="relative">
                  <CubeIcon
                    width={15}
                    height={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy-400"
                  />
                  <input
                    id="drawer-username"
                    type="text"
                    className="input !pl-9 cursor-not-allowed bg-aqua-50/70 text-navy-600 focus:border-aqua-200 focus:ring-0"
                    value={username}
                    readOnly
                    aria-readonly="true"
                    autoComplete="username"
                    placeholder="Not linked"
                    title="Minecraft usernames are locked"
                  />
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-navy-400">
                  Minecraft usernames are locked and cannot be changed here.
                </p>
              </div>

              <div>
                <label htmlFor="drawer-email" className="label">
                  Email address
                </label>
                <div className="relative">
                  <MailIcon
                    width={15}
                    height={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy-400"
                  />
                  <input
                    id="drawer-email"
                    type="email"
                    className="input !pl-9"
                    value={email}
                    autoComplete="email"
                    placeholder="you@example.com"
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (profileMsg) setProfileMsg(null);
                    }}
                    disabled={savingProfile}
                  />
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-navy-400">
                  Your email stays private and is never shown on public player pages.
                </p>
              </div>
            </div>

            {profileMsg && (
              <p
                role="status"
                className={`mt-3 rounded-lg border px-3 py-2 text-[11px] leading-relaxed ${
                  profileMsg.tone === "ok"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-red-200 bg-red-50 text-red-600"
                }`}
              >
                {profileMsg.text}
              </p>
            )}

            <button
              type="submit"
              disabled={savingProfile || !profileDirty}
              className="btn-primary mt-4 w-full !rounded-xl !py-2.5 text-xs"
            >
              {savingProfile ? "Saving…" : "Save Changes"}
            </button>
          </form>

          <form
            onSubmit={savePassword}
            noValidate
            className="mt-4 rounded-2xl border border-aqua-200/80 bg-white/85 p-4 shadow-card sm:p-5"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-aqua-100 bg-aqua-50 text-aqua-700">
                <LockIcon width={16} height={16} />
              </span>
              <div>
                <h2 className="font-display text-sm font-bold text-navy-900">Change password</h2>
                <p className="text-[11px] text-navy-400">Confirm with your current password.</p>
              </div>
            </div>

            <div className="mt-4 space-y-3.5">
              <div>
                <label htmlFor="drawer-current-password" className="label">
                  Current password
                </label>
                <input
                  id="drawer-current-password"
                  type="password"
                  className="input"
                  autoComplete="current-password"
                  value={password.current}
                  onChange={(event) => {
                    setPassword((value) => ({ ...value, current: event.target.value }));
                    if (passwordMsg) setPasswordMsg(null);
                  }}
                  disabled={savingPassword}
                  required
                />
              </div>
              <div className="grid gap-3.5 sm:grid-cols-2">
                <div>
                  <label htmlFor="drawer-next-password" className="label">
                    New password
                  </label>
                  <input
                    id="drawer-next-password"
                    type="password"
                    className="input"
                    autoComplete="new-password"
                    minLength={10}
                    maxLength={200}
                    value={password.next}
                    onChange={(event) => {
                      setPassword((value) => ({ ...value, next: event.target.value }));
                      if (passwordMsg) setPasswordMsg(null);
                    }}
                    disabled={savingPassword}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="drawer-confirm-password" className="label">
                    Confirm password
                  </label>
                  <input
                    id="drawer-confirm-password"
                    type="password"
                    className="input"
                    autoComplete="new-password"
                    minLength={10}
                    maxLength={200}
                    value={password.confirm}
                    onChange={(event) => {
                      setPassword((value) => ({ ...value, confirm: event.target.value }));
                      if (passwordMsg) setPasswordMsg(null);
                    }}
                    disabled={savingPassword}
                    required
                  />
                </div>
              </div>
              <p className="text-[11px] leading-relaxed text-navy-400">
                At least 10 characters, with a letter and a number.
              </p>
            </div>

            {passwordMsg && (
              <p
                role="status"
                className={`mt-3 rounded-lg border px-3 py-2 text-[11px] leading-relaxed ${
                  passwordMsg.tone === "ok"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-red-200 bg-red-50 text-red-600"
                }`}
              >
                {passwordMsg.text}
              </p>
            )}

            <button
              type="submit"
              disabled={savingPassword}
              className="btn-aqua mt-4 w-full !rounded-xl !py-2.5 text-xs"
            >
              {savingPassword ? "Updating…" : "Update password"}
            </button>
          </form>

          <ThemeSwitch />

          <div className="mt-4 rounded-2xl border border-red-200/70 bg-red-50/60 p-4 sm:p-5">
            <h2 className="font-display text-sm font-bold text-navy-900">Sign out</h2>
            <p className="mt-1 text-[11px] leading-relaxed text-navy-500">
              End your session on this device. Profile settings above stay unchanged.
            </p>
            <SignOutButton className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-50" />
          </div>
        </div>
      </aside>
    </div>
  );
}
