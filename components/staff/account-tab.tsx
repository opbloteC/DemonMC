"use client";

import { useState } from "react";
import { LockIcon } from "@/components/icons";
import { apiRequest, ErrorNote, errorMessage, Field, type Notify } from "./ui";
import type { SessionUser } from "@/lib/types";

export function AccountTab({ user, notify }: { user: SessionUser; notify: Notify }) {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (form.next !== form.confirm) {
      setError("New password and confirmation do not match.");
      return;
    }

    setPending(true);
    try {
      await apiRequest<{ ok: boolean }>("/api/auth/password", {
        method: "POST",
        body: { currentPassword: form.current, newPassword: form.next },
      });
      setForm({ current: "", next: "", confirm: "" });
      notify("Password updated. Other active sessions were signed out.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="panel p-6">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-aqua-100 bg-aqua-50 text-aqua-700">
          <LockIcon width={16} height={16} />
        </span>
        <div>
          <h2 className="font-display text-base font-bold text-navy-900">Password &amp; security</h2>
          <p className="text-[11px] text-navy-400">
            Signed in as {user.email ?? user.username}. Use a password you do not use elsewhere.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <Field label="Current password" htmlFor="account-current">
          <input
            id="account-current"
            type="password"
            className="input"
            autoComplete="current-password"
            required
            value={form.current}
            onChange={(event) => {
              setForm((current) => ({ ...current, current: event.target.value }));
              if (error) setError("");
            }}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="New password"
            htmlFor="account-next"
            hint="At least 10 characters, with a letter and a number."
          >
            <input
              id="account-next"
              type="password"
              className="input"
              autoComplete="new-password"
              required
              minLength={10}
              maxLength={200}
              value={form.next}
              onChange={(event) => {
                setForm((current) => ({ ...current, next: event.target.value }));
                if (error) setError("");
              }}
            />
          </Field>

          <Field label="Confirm new password" htmlFor="account-confirm">
            <input
              id="account-confirm"
              type="password"
              className="input"
              autoComplete="new-password"
              required
              minLength={10}
              maxLength={200}
              value={form.confirm}
              onChange={(event) => {
                setForm((current) => ({ ...current, confirm: event.target.value }));
                if (error) setError("");
              }}
            />
          </Field>
        </div>
      </div>

      {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-[11px] leading-relaxed text-navy-400">
          Other signed-in devices are logged out after a change.
        </p>
        <button type="submit" disabled={pending} className="btn-primary !py-2.5 text-xs">
          {pending ? "Updating…" : "Update password"}
        </button>
      </div>
    </form>
  );
}
