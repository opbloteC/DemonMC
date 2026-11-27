"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EyeIcon, EyeOffIcon, LockIcon } from "@/components/icons";
import { validateLogin, type LoginFieldErrors } from "@/lib/login-validation";

export function LoginForm({
  nextPath = "/dashboard",
  autoFocus = true,
  copy,
}: {
  nextPath?: string;
  autoFocus?: boolean;
  copy?: Record<string, string>;
}) {
  const labels = {
    passwordLabel: copy?.["login.passwordLabel"] ?? "Password",
    forgot: copy?.["login.forgot"] ?? "Forgot password?",
    submit: copy?.["login.submit"] ?? "Sign in",
    pending: copy?.["login.pending"] ?? "Signing in…",
    error: copy?.["login.error"] ?? "Unable to sign in. Please try again.",
    networkError: copy?.["login.networkError"] ?? "Network error. Check your connection and try again.",
  };
  const router = useRouter();
  const [minecraftUsername, setMinecraftUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function validate(): boolean {
    const next = validateLogin({
      username: minecraftUsername,
      email,
      password,
    });
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  /** Keep a shown error visible until that field is actually valid again. */
  function revalidate(
    values: { username: string; email: string; password: string },
    fields: (keyof LoginFieldErrors)[],
  ) {
    setFieldErrors((current) => {
      if (!fields.some((field) => current[field])) return current;
      const next = validateLogin(values);
      const updated = { ...current };
      for (const field of fields) updated[field] = next[field];
      return updated;
    });
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setError("");
    if (!validate()) return;

    const username = minecraftUsername.trim();
    const emailAddress = email.trim();

    setPending(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email: emailAddress, password }),
      });
      const data = (await res.json().catch(() => null)) as
        | { error?: string; fieldErrors?: LoginFieldErrors }
        | null;

      if (!res.ok) {
        if (data?.fieldErrors && Object.keys(data.fieldErrors).length > 0) {
          setFieldErrors(data.fieldErrors);
          setError("");
        } else {
          setError(data?.error ?? labels.error);
        }
        setPending(false);
        return;
      }

      router.replace(nextPath);
      router.refresh();
    } catch {
      setError(labels.networkError);
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} method="post" action="/login" className="mt-7 space-y-4" noValidate>
      <div>
        <label htmlFor="username" className="label">
          Minecraft Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          autoFocus={autoFocus}
          maxLength={254}
          disabled={pending}
          value={minecraftUsername}
          onChange={(event) => {
            const value = event.target.value;
            setMinecraftUsername(value);
            revalidate({ username: value, email, password }, ["username"]);
            if (error) setError("");
          }}
          aria-invalid={Boolean(fieldErrors.username)}
          aria-describedby={fieldErrors.username ? "login-username-error" : undefined}
          className={`input${fieldErrors.username ? " input-invalid" : ""}`}
          placeholder="Enter your Minecraft username"
        />
        {fieldErrors.username && (
          <p id="login-username-error" className="mt-1.5 text-[11px] text-red-600">
            {fieldErrors.username}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="label">
          Email Address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={254}
          disabled={pending}
          value={email}
          onChange={(event) => {
            const value = event.target.value;
            setEmail(value);
            revalidate({ username: minecraftUsername, email: value, password }, ["email"]);
            if (error) setError("");
          }}
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
          className={`input${fieldErrors.email ? " input-invalid" : ""}`}
          placeholder="Enter your registered email address"
        />
        {fieldErrors.email && (
          <p id="login-email-error" className="mt-1.5 text-[11px] text-red-600">
            {fieldErrors.email}
          </p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="password" className="label">
            {labels.passwordLabel}
          </label>
          <Link
            href="/forgot-password"
            className="mb-1.5 text-[11px] font-semibold text-aqua-700 transition-colors hover:text-aqua-800"
          >
            {labels.forgot}
          </Link>
        </div>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            maxLength={200}
            disabled={pending}
            value={password}
            onChange={(event) => {
              const value = event.target.value;
              setPassword(value);
              revalidate({ username: minecraftUsername, email, password: value }, ["password"]);
              if (error) setError("");
            }}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
            className={`input pr-11${fieldErrors.password ? " input-invalid" : ""}`}
            placeholder="Enter your password"
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
        {fieldErrors.password && (
          <p id="login-password-error" className="mt-1.5 text-[11px] text-red-600">
            {fieldErrors.password}
          </p>
        )}
      </div>

      {error && (
        <p
          role="alert"
          aria-live="polite"
          className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs leading-relaxed text-red-600"
        >
          {error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn-primary w-full !py-3">
        {pending ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            {labels.pending}
          </>
        ) : (
          <>
            <LockIcon width={15} height={15} />
            {labels.submit}
          </>
        )}
      </button>
    </form>
  );
}
