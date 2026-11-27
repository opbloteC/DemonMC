"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EyeIcon, EyeOffIcon, ShieldIcon } from "@/components/icons";
import {
  validateRegistration,
  type RegistrationFieldErrors,
} from "@/lib/register-validation";
import { isMinecraftUsername } from "@/lib/validation";

export function RegisterForm({
  autoFocus = true,
  copy,
}: {
  autoFocus?: boolean;
  copy?: Record<string, string>;
}) {
  const router = useRouter();
  const labels = {
    username: copy?.["register.usernameLabel"] ?? "Minecraft username",
    email: copy?.["register.emailLabel"] ?? "Email address",
    password: copy?.["register.passwordLabel"] ?? "Password",
    confirm: copy?.["register.confirmLabel"] ?? "Confirm password",
    submit: copy?.["register.submit"] ?? "Create account",
    pending: copy?.["register.pending"] ?? "Creating account…",
  };
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<RegistrationFieldErrors>({});
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const submitLock = useRef(false);

  const usernameValid = isMinecraftUsername(username);

  function validate(): boolean {
    const next = validateRegistration({ username, email, password, confirmPassword });
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  /** Keep a shown error visible until that field is actually valid again. */
  function revalidate(
    values: {
      username: string;
      email: string;
      password: string;
      confirmPassword: string;
    },
    fields: (keyof RegistrationFieldErrors)[],
  ) {
    setFieldErrors((current) => {
      if (!fields.some((field) => current[field])) return current;
      const next = validateRegistration(values);
      const updated = { ...current };
      for (const field of fields) updated[field] = next[field];
      return updated;
    });
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current || success) return;

    setError("");
    if (!validate()) return;

    submitLock.current = true;
    setPending(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          password,
          confirmPassword,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { error?: string; fieldErrors?: RegistrationFieldErrors; session?: boolean }
        | null;

      if (!res.ok) {
        if (data?.fieldErrors && Object.keys(data.fieldErrors).length > 0) {
          setFieldErrors(data.fieldErrors);
          setError("");
        } else {
          setError(data?.error ?? "Unable to create your account. Please try again.");
        }
        setPending(false);
        submitLock.current = false;
        return;
      }

      setSuccess(true);
      window.setTimeout(() => {
        router.replace(data?.session === false ? "/login?registered=1" : "/dashboard");
        router.refresh();
      }, 1200);
    } catch {
      setError("Network error. Check your connection and try again.");
      setPending(false);
      submitLock.current = false;
    }
  }

  return (
    <form onSubmit={onSubmit} method="post" action="/register" className="mt-6 space-y-4" noValidate>
      <div>
        <label htmlFor="register-username" className="label">
          {labels.username}
        </label>
        <input
          id="register-username"
          name="username"
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          required
          autoFocus={autoFocus}
          maxLength={16}
          disabled={pending}
          value={username}
          onChange={(event) => {
            const value = event.target.value.replace(/\s/g, "");
            setUsername(value);
            revalidate({ username: value, email, password, confirmPassword }, ["username"]);
            if (error) setError("");
          }}
          aria-invalid={Boolean(fieldErrors.username)}
          aria-describedby={
            fieldErrors.username ? "register-username-error" : "register-username-hint"
          }
          className={`input${fieldErrors.username ? " input-invalid" : ""}`}
          placeholder="Steve"
        />
        {fieldErrors.username ? (
          <p id="register-username-error" className="mt-1.5 text-[11px] text-red-600">
            {fieldErrors.username}
          </p>
        ) : (
          <p
            id="register-username-hint"
            className="mt-1.5 flex items-center gap-1.5 text-[11px] text-navy-400"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                usernameValid ? "bg-emerald-500" : "bg-aqua-300"
              }`}
            />
            Your in-game Java name — shown publicly on your player profile.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="register-email" className="label">
          {labels.email}
        </label>
        <input
          id="register-email"
          name="email"
          type="email"
          inputMode="email"
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
            revalidate({ username, email: value, password, confirmPassword }, ["email"]);
            if (error) setError("");
          }}
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? "register-email-error" : "register-email-hint"}
          className={`input${fieldErrors.email ? " input-invalid" : ""}`}
          placeholder="you@example.com"
        />
        {fieldErrors.email ? (
          <p id="register-email-error" className="mt-1.5 text-[11px] text-red-600">
            {fieldErrors.email}
          </p>
        ) : (
          <p id="register-email-hint" className="mt-1.5 text-[11px] text-navy-400">
            Private — used only for sign-in and never shown publicly.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="register-password" className="label">
          {labels.password}
        </label>
        <div className="relative">
          <input
            id="register-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            maxLength={200}
            disabled={pending}
            value={password}
            onChange={(event) => {
              const value = event.target.value;
              setPassword(value);
              revalidate(
                { username, email, password: value, confirmPassword },
                ["password", "confirmPassword"],
              );
              if (error) setError("");
            }}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? "register-password-error" : undefined}
            className={`input pr-11${fieldErrors.password ? " input-invalid" : ""}`}
            placeholder="10+ characters, letters and numbers"
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
          <p id="register-password-error" className="mt-1.5 text-[11px] text-red-600">
            {fieldErrors.password}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="register-confirm" className="label">
          {labels.confirm}
        </label>
        <div className="relative">
          <input
            id="register-confirm"
            name="confirmPassword"
            type={showConfirm ? "text" : "password"}
            autoComplete="new-password"
            required
            maxLength={200}
            disabled={pending}
            value={confirmPassword}
            onChange={(event) => {
              const value = event.target.value;
              setConfirmPassword(value);
              revalidate(
                { username, email, password, confirmPassword: value },
                ["confirmPassword"],
              );
              if (error) setError("");
            }}
            aria-invalid={Boolean(fieldErrors.confirmPassword)}
            aria-describedby={
              fieldErrors.confirmPassword ? "register-confirm-error" : undefined
            }
            className={`input pr-11${fieldErrors.confirmPassword ? " input-invalid" : ""}`}
            placeholder="Repeat your password"
          />
          <button
            type="button"
            onClick={() => setShowConfirm((value) => !value)}
            aria-label={showConfirm ? "Hide confirmation password" : "Show confirmation password"}
            aria-pressed={showConfirm}
            className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-navy-400 transition-colors hover:text-navy-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-aqua-400/60"
          >
            {showConfirm ? <EyeOffIcon width={16} height={16} /> : <EyeIcon width={16} height={16} />}
          </button>
        </div>
        {fieldErrors.confirmPassword && (
          <p id="register-confirm-error" className="mt-1.5 text-[11px] text-red-600">
            {fieldErrors.confirmPassword}
          </p>
        )}
      </div>

      {success && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs leading-relaxed text-emerald-700"
        >
          Account created successfully. Redirecting…
        </p>
      )}

      {error && !success && (
        <p
          role="alert"
          aria-live="polite"
          className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs leading-relaxed text-red-600"
        >
          {error}
        </p>
      )}

      <button type="submit" disabled={pending || success} className="btn-primary w-full !py-3">
        {success ? (
          <>
            <ShieldIcon width={15} height={15} />
            Account created
          </>
        ) : pending ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            {labels.pending}
          </>
        ) : (
          <>
            <ShieldIcon width={15} height={15} />
            {labels.submit}
          </>
        )}
      </button>
    </form>
  );
}
