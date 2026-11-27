"use client";

import { useCallback, useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { PencilIcon, PlusIcon, ShieldIcon, TrashIcon, UsersIcon } from "@/components/icons";
import { UserRankBadges } from "@/components/rank-badge";
import { formatDate } from "@/lib/format";
import {
  isOwnerAccount,
  userCan,
  type Account,
  type SessionUser,
} from "@/lib/types";
import {
  apiRequest,
  ConfirmDialog,
  EmptyState,
  ErrorNote,
  errorMessage,
  Field,
  Modal,
  PageSectionHeader,
  Spinner,
  type Notify,
} from "./ui";

interface AccountFormState {
  username: string;
  password: string;
  description: string;
  joinedAt: string;
  avatarUrl: string;
}

function AccountEditor({
  account,
  onClose,
  onSaved,
}: {
  account: Account | null;
  onClose: () => void;
  onSaved: (username: string, mode: "create" | "edit") => void;
}) {
  const [form, setForm] = useState<AccountFormState>({
    username: account?.username ?? "",
    password: "",
    description: account?.description ?? "",
    joinedAt: account?.joinedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    avatarUrl: account?.avatarUrl ?? "",
  });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function set<K extends keyof AccountFormState>(key: K, value: AccountFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);

    try {
      if (!account) {
        await apiRequest("/api/admin/accounts", {
          method: "POST",
          body: {
            username: form.username,
            password: form.password,
            description: form.description,
            joinedAt: form.joinedAt,
            avatarUrl: form.avatarUrl,
          },
        });
        onSaved(form.username.trim(), "create");
        return;
      }

      const body: Record<string, unknown> = {
        description: form.description,
        joinedAt: form.joinedAt,
        avatarUrl: form.avatarUrl,
      };
      if (form.password.trim()) body.password = form.password;

      await apiRequest(`/api/admin/accounts/${account.id}`, { method: "PATCH", body });
      onSaved(account.username, "edit");
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <Modal
      title={account ? "Edit account" : "Create account"}
      description={
        account
          ? "Update this member's details or reset their password. Ranks are assigned from the Owner console's Player rank assignment."
          : "New accounts start on the Member rank and can sign in immediately. Assign ranks later from the Owner console."
      }
      onClose={onClose}
      wide
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Username"
            htmlFor="account-username"
            hint={account ? "Usernames cannot be changed." : "3–24 characters. Used to sign in."}
          >
            <input
              id="account-username"
              className="input"
              required={!account}
              disabled={Boolean(account)}
              minLength={3}
              maxLength={24}
              pattern="[A-Za-z0-9_.-]{3,24}"
              autoComplete="off"
              spellCheck={false}
              value={form.username}
              onChange={(event) => set("username", event.target.value)}
              placeholder="Minecraft username"
            />
          </Field>

          <Field label="Rank" htmlFor="account-rank">
            <div className="input flex items-center justify-between gap-2 !py-2.5">
              {account ? (
                <UserRankBadges
                  rank={account.rank}
                  secondaryRank={account.secondaryRank}
                  size="sm"
                />
              ) : (
                <span className="text-xs text-navy-500">Member (default)</span>
              )}
              <span className="text-[10px] text-navy-400">Owner console</span>
            </div>
          </Field>

          <Field
            label={account ? "Reset password" : "Password"}
            htmlFor="account-password"
            hint={
              account
                ? "Leave blank to keep the current password."
                : "At least 10 characters, including a letter and a number."
            }
          >
            <input
              id="account-password"
              type="password"
              className="input"
              autoComplete="new-password"
              required={!account}
              minLength={10}
              maxLength={200}
              value={form.password}
              onChange={(event) => set("password", event.target.value)}
              placeholder={account ? "Leave blank to keep current" : "••••••••••"}
            />
          </Field>

          <Field label="Date joined" htmlFor="account-joined">
            <input
              id="account-joined"
              type="date"
              className="input"
              required
              value={form.joinedAt}
              onChange={(event) => set("joinedAt", event.target.value)}
            />
          </Field>
        </div>

        <Field
          label="Description"
          htmlFor="account-description"
          hint="Optional, up to 300 characters. Shown to staff."
        >
          <textarea
            id="account-description"
            rows={3}
            maxLength={300}
            className="input resize-none"
            value={form.description}
            onChange={(event) => set("description", event.target.value)}
            placeholder="A short line about this member."
          />
        </Field>

        <Field
          label="Avatar URL"
          htmlFor="account-avatar"
          hint="Optional. Leave blank to use the Minecraft head for the username."
        >
          <input
            id="account-avatar"
            type="url"
            className="input"
            maxLength={500}
            value={form.avatarUrl}
            onChange={(event) => set("avatarUrl", event.target.value)}
            placeholder="https://…"
          />
        </Field>

        {error && <ErrorNote>{error}</ErrorNote>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-ghost !py-2.5 text-xs" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={pending} className="btn-primary !py-2.5 text-xs">
            {pending ? "Saving…" : account ? "Save changes" : "Create account"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function AccountsTab({
  actor,
  notify,
  brandName = "DemonMC",
}: {
  actor: SessionUser;
  notify: Notify;
  brandName?: string;
}) {
  const canManage = userCan(actor, "accounts.manage");
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [editor, setEditor] = useState<{ mode: "create" } | { mode: "edit"; account: Account } | null>(
    null,
  );
  const [confirming, setConfirming] = useState<{
    account: Account;
    action: "disable" | "delete";
  } | null>(null);
  const [confirmPending, setConfirmPending] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoadError("");
      const data = await apiRequest<{ accounts: Account[] }>("/api/admin/accounts");
      setAccounts(data.accounts);
    } catch (error) {
      setAccounts([]);
      setLoadError(errorMessage(error));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleDisabled(account: Account) {
    try {
      await apiRequest(`/api/admin/accounts/${account.id}`, {
        method: "PATCH",
        body: { disabled: !account.disabled },
      });
      notify(account.disabled ? `${account.username} was re-enabled.` : `${account.username} was disabled.`);
      await load();
    } catch (error) {
      notify(errorMessage(error), "error");
    }
  }

  async function confirmAction() {
    if (!confirming) return;
    setConfirmPending(true);
    try {
      if (confirming.action === "delete") {
        await apiRequest(`/api/admin/accounts/${confirming.account.id}`, { method: "DELETE" });
        notify(`${confirming.account.username} was deleted.`);
      } else {
        await apiRequest(`/api/admin/accounts/${confirming.account.id}`, {
          method: "PATCH",
          body: { disabled: true },
        });
        notify(`${confirming.account.username} was disabled and signed out.`);
      }
      setConfirming(null);
      await load();
    } catch (error) {
      notify(errorMessage(error), "error");
    } finally {
      setConfirmPending(false);
    }
  }

  return (
    <div>
      <PageSectionHeader
        title="Accounts"
        description="Create accounts and control who can sign in. Ranks are assigned from the Owner console."
        action={
          canManage ? (
            <button
              type="button"
              className="btn-primary !px-4 !py-2.5 text-xs"
              onClick={() => setEditor({ mode: "create" })}
            >
              <PlusIcon width={14} height={14} />
              Create account
            </button>
          ) : undefined
        }
      />

      <p className="mt-3 text-[11px] leading-relaxed text-navy-400">
        New accounts start on the Member rank, and sign-ups always receive Member. Only the owner
        can change ranks or permissions. The owner account is protected.
      </p>

      {loadError && <div className="mt-5"><ErrorNote>{loadError}</ErrorNote></div>}

      <div className="panel mt-5 overflow-hidden">
        {accounts === null ? (
          <div className="px-6 py-16">
            <Spinner label="Loading accounts" />
          </div>
        ) : accounts.length === 0 ? (
          <EmptyState
            icon={<UsersIcon width={19} height={19} />}
            title="No accounts yet"
            description={`Create a player or staff account to give someone access to ${brandName}.`}
          />
        ) : (
          <ul className="divide-y divide-aqua-100">
            {accounts.map((account) => {
              const manageable = canManage && !isOwnerAccount(account);
              const isSelf = account.id === actor.id;

              return (
                <li
                  key={account.id}
                  className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4"
                >
                  <div className="flex min-w-0 items-center gap-3 sm:w-56 sm:shrink-0">
                    <Avatar name={account.username} src={account.avatarUrl} size={36} />
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate text-sm font-medium text-navy-900">
                        {account.username}
                        {isSelf && (
                          <span className="rounded border border-aqua-200 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-navy-500">
                            You
                          </span>
                        )}
                      </p>
                      <p className="truncate text-[11px] text-navy-500">
                        {account.description || "—"}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    <UserRankBadges
                      rank={account.rank}
                      secondaryRank={account.secondaryRank}
                      size="sm"
                    />
                    <span
                      className={`badge ${
                        account.disabled
                          ? "border-ember/25 bg-ember/[0.06] text-ember-bright"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {account.disabled ? "Disabled" : "Active"}
                    </span>
                  </div>

                  <div className="text-[11px] text-navy-500 sm:w-32 sm:shrink-0">
                    Joined {formatDate(account.joinedAt)}
                  </div>

                  {manageable && (
                    <div className="flex flex-wrap gap-1.5 sm:shrink-0">
                      <button
                        type="button"
                        aria-label={`Edit ${account.username}`}
                        className="icon-btn"
                        onClick={() => setEditor({ mode: "edit", account })}
                      >
                        <PencilIcon width={14} height={14} />
                      </button>
                      <button
                        type="button"
                        className="btn-subtle !px-2.5 !py-1.5 text-[10px]"
                        onClick={() =>
                          account.disabled
                            ? void toggleDisabled(account)
                            : setConfirming({ account, action: "disable" })
                        }
                      >
                        {account.disabled ? "Enable" : "Disable"}
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${account.username}`}
                        className="icon-btn hover:border-ember/30 hover:text-ember-bright"
                        onClick={() => setConfirming({ account, action: "delete" })}
                      >
                        <TrashIcon width={14} height={14} />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {editor && (
        <AccountEditor
          key={editor.mode === "edit" ? editor.account.id : "new"}
          account={editor.mode === "edit" ? editor.account : null}
          onClose={() => setEditor(null)}
          onSaved={(username, mode) => {
            setEditor(null);
            notify(
              mode === "create" ? `Account ${username} was created.` : `${username} was updated.`,
              "success",
            );
            void load();
          }}
        />
      )}

      {confirming && (
        <ConfirmDialog
          title={confirming.action === "delete" ? "Delete account" : "Disable account"}
          message={
            confirming.action === "delete"
              ? `Permanently delete “${confirming.account.username}”? Their sessions will end and this cannot be undone.`
              : `Disable “${confirming.account.username}”? They will be signed out and unable to sign in until re-enabled.`
          }
          confirmLabel={confirming.action === "delete" ? "Delete" : "Disable"}
          pending={confirmPending}
          onCancel={() => setConfirming(null)}
          onConfirm={confirmAction}
        />
      )}

      <div className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-navy-400">
        <ShieldIcon width={14} height={14} className="mt-0.5 shrink-0" />
        Password resets immediately revoke that account&apos;s active sessions. Ranks, cosmetic ranks
        and individual permissions are managed in the Owner console.
      </div>
    </div>
  );
}
