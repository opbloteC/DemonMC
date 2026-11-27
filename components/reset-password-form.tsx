"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckIcon, EyeIcon, EyeOffIcon, LockIcon } from "@/components/icons";

function passwordIssue(value: string): string | null {
  if (value.length < 10 || value.length > 200) return "Password must be 10–200 characters.";
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    return "Password must include at least one letter and one number.";
  }
  return null;
}

export function ResetPasswordForm({ brandName = "DemonMC" }: { brandName?: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => {
      router.replace("/login?reset=1");
      router.refresh();
    }, 2500);
    return () => clearTimeout(timer);
  }, [done, router]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || done) return;

    const issue = passwordIssue(password);
    if (issue) {
      setError(issue);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setPending(true);
    setError("");
    setExpired(false);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmPassword }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;

      if (!res.ok) {
        setError(data?.error ?? "Unable to reset your password. Please try again.");
        if (res.status === 401 || res.status === 410) setExpired(true);
        setPending(false);
        return;
      }

      setDone(true);
      setPending(false);
    } catch {
      setError("Network error. Check your connection and try again.");
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="mt-7">
        <div className="flex flex-col items-center rounded-xl border border-emerald-200 bg-emerald-50/80 px-5 py-7 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-200 bg-white text-emerald-600 shadow-sm">
            <CheckIcon width={22} height={22} />
          </span>
          <h3 className="mt-4 font-display text-base font-bold text-navy-900">Password updated</h3>
          <p className="mt-2 max-w-[320px] text-xs leading-relaxed text-navy-500">
            Your password has been reset successfully. Please log in with your new password.
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-navy-400">
            Taking you to sign in with {brandName}…
          </p>
          <Link href="/login?reset=1" className="btn-primary mt-5 w-full !py-3">
            <LockIcon width={15} height={15} />
            Continue to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} method="post" action="/reset-password" className="mt-7 space-y-4" noValidate>
      <div>
        <label htmlFor="new-password" className="label">
          New password
        </label>
        <div className="relative">
          <input
            id="new-password"
            name="newPassword"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            autoFocus
            maxLength={200}
            disabled={pending}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (error) setError("");
            }}
            className="input pr-11"
            placeholder="••••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-navy-400 transition-colors hover:text-navy-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-aqua-400/60"
          >
            {showPassword ? <EyeOffIcon width={16} height={16} /> : <EyeIcon width={16} height={16} />}
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="confirm-password" className="label">
          Confirm new password
        </label>
        <div className="relative">
          <input
            id="confirm-password"
            name="confirmPassword"
            type={showConfirm ? "text" : "password"}
            autoComplete="new-password"
            required
            maxLength={200}
            disabled={pending}
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              if (error) setError("");
            }}
            className="input pr-11"
            placeholder="••••••••••"
          />
          <button
            type="button"
            onClick={() => setShowConfirm((value) => !value)}
            aria-label={showConfirm ? "Hide password confirmation" : "Show password confirmation"}
            aria-pressed={showConfirm}
            className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-navy-400 transition-colors hover:text-navy-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-aqua-400/60"
          >
            {showConfirm ? <EyeOffIcon width={16} height={16} /> : <EyeIcon width={16} height={16} />}
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-navy-400">
          At least 10 characters, including a letter and a number.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs leading-relaxed text-red-600"
        >
          <p>{error}</p>
          {expired && (
            <Link
              href="/forgot-password"
              className="mt-1.5 inline-block font-semibold text-red-700 underline underline-offset-2"
            >
              Request a new verification code
            </Link>
          )}
        </div>
      )}

      <button type="submit" disabled={pending} className="btn-primary w-full !py-3">
        {pending ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            Resetting password…
          </>
        ) : (
          <>
            <LockIcon width={15} height={15} />
            Reset password
          </>
        )}
      </button>

      <div className="divider my-6" />

      <p className="text-center text-[11px] leading-relaxed text-navy-400">
        Code expired or not working?{" "}
        <Link
          href="/forgot-password"
          className="font-semibold text-aqua-700 transition-colors hover:text-aqua-800"
        >
          Start over
        </Link>
      </p>
    </form>
  );
}
