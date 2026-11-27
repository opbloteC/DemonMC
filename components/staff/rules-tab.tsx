"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookIcon,
  EyeIcon,
  EyeOffIcon,
  MenuIcon,
  PencilIcon,
  PlusIcon,
  ShieldIcon,
  TrashIcon,
} from "@/components/icons";
import { RuleCard } from "@/components/rule-card";
import { RuleGlyph } from "@/components/rule-icons";
import { RULE_ICON_LABELS, RULE_ICONS, type RuleIcon } from "@/lib/rule-types";
import type { RuleRecord, RulesState } from "@/lib/rule-types";
import type { SessionUser } from "@/lib/types";
import { userCan } from "@/lib/types";
import {
  apiRequest,
  ConfirmDialog,
  ErrorNote,
  errorMessage,
  Field,
  Modal,
  PageSectionHeader,
  Spinner,
  type Notify,
} from "./ui";

const PRESET_COLORS = [
  "#f4842d",
  "#ff8a3d",
  "#e0671a",
  "#ffa15e",
  "#e11d48",
  "#8b5cf6",
  "#0ea5e9",
  "#10b981",
  "#eab308",
  "#64748b",
];

function timestamp(value: string | null): string {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function orderOf(rules: RuleRecord[]): number[] {
  return rules.map((rule) => rule.id);
}

interface RuleDraft {
  title: string;
  description: string;
  icon: RuleIcon;
  color: string;
  bold: boolean;
  enabled: boolean;
}

function draftFrom(rule: RuleRecord | null): RuleDraft {
  return {
    title: rule?.title ?? "",
    description: rule?.description ?? "",
    icon: rule?.icon ?? "shield",
    color: rule?.color ?? "#f4842d",
    bold: rule?.bold ?? true,
    enabled: rule?.enabled ?? true,
  };
}

function RuleEditor({
  rule,
  previewIndex,
  canEdit,
  notify,
  onClose,
  onSaved,
}: {
  rule: RuleRecord | null;
  previewIndex: number;
  canEdit: boolean;
  notify: Notify;
  onClose: () => void;
  onSaved: (state: RulesState) => void;
}) {
  const [draft, setDraft] = useState<RuleDraft>(() => draftFrom(rule));
  const [hexInput, setHexInput] = useState(draft.color);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const colorValid = /^#[0-9a-fA-F]{6}$/.test(hexInput);

  function set<K extends keyof RuleDraft>(key: K, value: RuleDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function setColor(value: string) {
    setHexInput(value);
    if (/^#[0-9a-fA-F]{6}$/.test(value)) set("color", value.toLowerCase());
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;
    setError("");
    setPending(true);

    const body = {
      title: draft.title,
      description: draft.description,
      icon: draft.icon,
      color: colorValid ? hexInput.toLowerCase() : draft.color,
      bold: draft.bold,
      enabled: draft.enabled,
    };

    try {
      const data = rule
        ? await apiRequest<RulesState>(`/api/owner/rules/${rule.id}`, {
            method: "PATCH",
            body,
          })
        : await apiRequest<RulesState>("/api/owner/rules", { method: "POST", body });
      notify(
        rule
          ? `Rule “${draft.title.trim()}” saved to the draft. Publish to make it public.`
          : `Rule “${draft.title.trim()}” added to the draft. Publish to make it public.`,
      );
      onSaved(data);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <Modal
      title={rule ? "Edit rule" : "Add a new rule"}
      description={
        rule
          ? "Changes are saved to the draft. Only published rules appear on /rules."
          : "Create a custom rule with its own icon, color and styling."
      }
      onClose={onClose}
      wide
    >
      <form onSubmit={submit} className="grid gap-5 sm:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <Field label="Title" htmlFor="rule-title">
            <input
              id="rule-title"
              className="input"
              value={draft.title}
              maxLength={80}
              required
              minLength={2}
              onChange={(event) => set("title", event.target.value)}
              placeholder="NO CHEATS"
            />
          </Field>

          <Field label="Description" htmlFor="rule-description">
            <textarea
              id="rule-description"
              className="input min-h-[92px] resize-y"
              value={draft.description}
              maxLength={400}
              required
              minLength={2}
              rows={3}
              onChange={(event) => set("description", event.target.value)}
              placeholder="Explain the rule in one clear sentence."
            />
          </Field>

          <Field label="Icon" hint="Shown in the rule card badge.">
            <div className="grid grid-cols-6 gap-1.5">
              {RULE_ICONS.map((icon) => {
                const selected = draft.icon === icon;
                return (
                  <button
                    key={icon}
                    type="button"
                    title={RULE_ICON_LABELS[icon]}
                    aria-label={RULE_ICON_LABELS[icon]}
                    aria-pressed={selected}
                    onClick={() => set("icon", icon)}
                    className={`flex h-10 items-center justify-center rounded-lg border transition-colors ${
                      selected
                        ? "border-ember bg-ember/10 text-ember"
                        : "border-aqua-200 bg-white text-navy-500 hover:border-aqua-300 hover:text-navy-900"
                    }`}
                  >
                    <RuleGlyph icon={icon} width={17} height={17} />
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Custom color" hint="Used for the card accent, number and icon.">
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Pick rule color"
                value={colorValid ? hexInput : draft.color}
                onChange={(event) => setColor(event.target.value)}
                className="h-10 w-12 cursor-pointer rounded-lg border border-aqua-200 bg-white p-1"
              />
              <input
                aria-label="HEX color"
                className="input font-mono uppercase"
                value={hexInput}
                maxLength={7}
                onChange={(event) => setColor(event.target.value)}
                placeholder="#f4842d"
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Use color ${color}`}
                  onClick={() => {
                    setHexInput(color);
                    set("color", color);
                  }}
                  className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
                    draft.color === color ? "border-navy-900" : "border-white"
                  }`}
                  style={{ background: color }}
                />
              ))}
            </div>
            {!colorValid && (
              <p className="mt-1.5 text-[11px] text-red-600">
                Enter a six-digit HEX color such as #f4842d.
              </p>
            )}
          </Field>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              role="switch"
              aria-checked={draft.bold}
              onClick={() => set("bold", !draft.bold)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                draft.bold ? "bg-ember" : "bg-navy-200"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  draft.bold ? "translate-x-[22px]" : "translate-x-0.5"
                }`}
              />
            </button>
            <span className="text-xs font-medium text-navy-600">Bold title</span>

            {rule && (
              <>
                <span className="h-4 w-px bg-aqua-200" aria-hidden="true" />
                <button
                  type="button"
                  role="switch"
                  aria-checked={draft.enabled}
                  onClick={() => set("enabled", !draft.enabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                    draft.enabled ? "bg-emerald-500" : "bg-navy-200"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      draft.enabled ? "translate-x-[22px]" : "translate-x-0.5"
                    }`}
                  />
                </button>
                <span className="text-xs font-medium text-navy-600">
                  {draft.enabled ? "Enabled" : "Disabled"}
                </span>
              </>
            )}
          </div>
        </div>

        <div>
          <p className="label">Live preview</p>
          <div
            className="rounded-2xl border border-dashed border-aqua-200 bg-aqua-50/60 p-3"
            aria-live="polite"
          >
            <RuleCard
              compact
              index={previewIndex}
              rule={{
                id: rule?.id ?? 0,
                title: draft.title.trim() || "New rule",
                description:
                  draft.description.trim() || "Your description will appear right here.",
                icon: draft.icon,
                color: colorValid ? hexInput.toLowerCase() : draft.color,
                bold: draft.bold,
              }}
            />
          </div>
          {error && (
            <div className="mt-3">
              <ErrorNote>{error}</ErrorNote>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" onClick={onClose} className="btn-ghost !py-2.5 text-xs">
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending || !canEdit || !colorValid}
            className="btn-primary !py-2.5 text-xs"
          >
            {pending ? "Saving…" : "Save rule"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

type ConfirmKind = "delete" | "reset" | "publish" | "discard";

function ActionConfirm({
  kind,
  rule,
  publishedCount,
  pending,
  brandName,
  onCancel,
  onConfirm,
}: {
  kind: ConfirmKind;
  rule: RuleRecord | null;
  publishedCount: number;
  pending: boolean;
  brandName: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (kind === "delete") {
    return (
      <ConfirmDialog
        title="Delete rule"
        message={`Delete “${rule?.title ?? "this rule"}” from the draft? The public page keeps the last published version until you publish again.`}
        confirmLabel="Delete rule"
        pending={pending}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );
  }

  if (kind === "reset") {
    return (
      <ConfirmDialog
        title="Reset to defaults"
        message={`Replace every rule in the draft with the ten original ${brandName} defaults? Custom rules, colors and order in the draft are replaced. The public page is not changed until you publish.`}
        confirmLabel="Reset to defaults"
        pending={pending}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );
  }

  if (kind === "discard") {
    return (
      <ConfirmDialog
        title="Cancel changes"
        message="Discard every unpublished change and reload the last published rules? New rules, edits, deletions and order changes in the draft are lost."
        confirmLabel="Cancel changes"
        pending={pending}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );
  }

  return (
    <Modal title="Publish changes" onClose={onCancel}>
      <p className="text-sm leading-relaxed text-navy-600">
        Publish {publishedCount} enabled rule{publishedCount === 1 ? "" : "s"} to the public{" "}
        <span className="font-mono text-xs text-navy-800">/rules</span> page? The live page updates
        immediately without a redeploy.
      </p>
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn-ghost !py-2.5 text-xs">
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className="btn-primary !py-2.5 text-xs"
        >
          {pending ? "Publishing…" : "Publish changes"}
        </button>
      </div>
    </Modal>
  );
}

export function RulesManagementTab({
  user,
  notify,
  brandName = "DemonMC",
}: {
  user: SessionUser;
  notify: Notify;
  brandName?: string;
}) {
  const canEdit = userCan(user, "rules.edit");
  const canPublish = userCan(user, "rules.publish");
  const canDelete = userCan(user, "rules.delete");

  const [state, setState] = useState<RulesState | null>(null);
  const [order, setOrder] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [savingOrder, setSavingOrder] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editor, setEditor] = useState<{ rule: RuleRecord | null } | null>(null);
  const [confirm, setConfirm] = useState<{ kind: ConfirmKind; rule: RuleRecord | null } | null>(
    null,
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiRequest<RulesState>("/api/owner/rules");
      setState(data);
      setOrder(orderOf(data.rules));
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const apply = useCallback((next: RulesState) => {
    setState(next);
    const ids = orderOf(next.rules);
    setOrder((current) => {
      const kept = current.filter((id) => ids.includes(id));
      const added = ids.filter((id) => !kept.includes(id));
      return [...kept, ...added];
    });
  }, []);

  const byId = useMemo(
    () => new Map((state?.rules ?? []).map((rule) => [rule.id, rule])),
    [state],
  );
  const ordered = order
    .map((id) => byId.get(id))
    .filter((rule): rule is RuleRecord => Boolean(rule));
  const serverOrder = state ? orderOf(state.rules).join(",") : "";
  const orderChanged = ordered.length > 0 && order.join(",") !== serverOrder;

  const enabledRules = ordered.filter((rule) => rule.enabled);

  function move(index: number, direction: -1 | 1) {
    setOrder((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function dropOn(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) return;
    setOrder((current) => {
      const next = [...current];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    setDragIndex(null);
  }

  async function saveOrder() {
    if (!orderChanged) return;
    setSavingOrder(true);
    try {
      const data = await apiRequest<RulesState>("/api/owner/rules/reorder", {
        method: "PUT",
        body: { ids: order },
      });
      apply(data);
      notify("Rule order saved to the draft. Publish to update the public page.");
    } catch (err) {
      notify(errorMessage(err), "error");
    } finally {
      setSavingOrder(false);
    }
  }

  async function toggleEnabled(rule: RuleRecord) {
    setBusyId(rule.id);
    try {
      const data = await apiRequest<RulesState>(`/api/owner/rules/${rule.id}`, {
        method: "PATCH",
        body: { enabled: !rule.enabled },
      });
      apply(data);
      notify(
        rule.enabled
          ? `“${rule.title}” disabled in the draft. Publish to hide it on /rules.`
          : `“${rule.title}” enabled in the draft. Publish to show it on /rules.`,
      );
    } catch (err) {
      notify(errorMessage(err), "error");
    } finally {
      setBusyId(null);
    }
  }

  async function runConfirm() {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.kind === "delete" && confirm.rule) {
        const data = await apiRequest<RulesState>(`/api/owner/rules/${confirm.rule.id}`, {
          method: "DELETE",
        });
        apply(data);
        notify(`“${confirm.rule.title}” deleted from the draft. Publish to update /rules.`);
      } else if (confirm.kind === "reset") {
        const data = await apiRequest<RulesState>("/api/owner/rules/reset", { method: "POST" });
        apply(data);
        notify("Default rules restored in the draft. Publish to make them live.");
      } else if (confirm.kind === "discard") {
        const data = await apiRequest<RulesState>("/api/owner/rules/discard", { method: "POST" });
        apply(data);
        notify("Unpublished changes discarded. The draft matches the live page.");
      } else {
        const data = await apiRequest<RulesState>("/api/owner/rules/publish", { method: "POST" });
        apply(data);
        notify("Rules published. The public /rules page is live.");
      }
      setConfirm(null);
    } catch (err) {
      notify(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveChanges() {
    if (orderChanged) {
      await saveOrder();
      return;
    }
    if (state?.hasUnpublishedChanges) {
      notify("All draft edits are stored in Neon. Use Publish Changes to update /rules.");
    } else {
      notify("Everything is saved and published.");
    }
  }

  const counts = {
    total: ordered.length,
    enabled: enabledRules.length,
    disabled: ordered.length - enabledRules.length,
  };

  return (
    <div>
      <PageSectionHeader
        title="Rules management"
        description="Build the public /rules page: add unlimited rules, style them, reorder, preview and publish. Draft edits stay private until you publish."
        action={
          canEdit ? (
            <button
              type="button"
              className="btn-primary !py-2.5 text-xs"
              onClick={() => setEditor({ rule: null })}
            >
              <PlusIcon width={14} height={14} />
              ADD NEW RULE
            </button>
          ) : undefined
        }
      />

      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-ember/15 bg-ember/[0.04] px-4 py-3 text-[11px] leading-relaxed text-navy-600">
        <ShieldIcon width={14} height={14} className="mt-0.5 shrink-0 text-ember" />
        <span>
          <strong className="font-semibold text-navy-900">Owner-only controls.</strong> Managers and
          developers only get this section when the owner grants the rules permissions. Every action
          is checked on the server and written to the audit log.
        </span>
      </div>

      {state === null && !error && (
        <div className="panel mt-5 py-14">
          <Spinner label="Loading rules" />
        </div>
      )}

      {error && (
        <div className="panel mt-5 p-6">
          <ErrorNote>{error}</ErrorNote>
          <button type="button" className="btn-subtle mt-4" onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}

      {state && (
        <>
          <div className="panel mt-5 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-navy-500">
              <span
                className={`badge ${
                  state.hasUnpublishedChanges
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    state.hasUnpublishedChanges ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                />
                {state.hasUnpublishedChanges ? "Unpublished changes" : "Published"}
              </span>
              <span>
                Last published: <strong className="text-navy-700">{timestamp(state.lastPublishedAt)}</strong>
              </span>
              <span>
                {counts.total} rules · {counts.enabled} live · {counts.disabled} hidden
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-subtle"
                onClick={() => setPreviewOpen(true)}
              >
                <EyeIcon width={14} height={14} />
                Preview Changes
              </button>
              <button
                type="button"
                className="btn-subtle"
                onClick={() => void saveChanges()}
                disabled={savingOrder}
              >
                Save Changes
              </button>
              <button
                type="button"
                className="btn-primary !px-4 !py-2 text-xs"
                disabled={!canPublish}
                onClick={() => setConfirm({ kind: "publish", rule: null })}
              >
                Publish Changes
              </button>
              <button
                type="button"
                className="btn-danger disabled:opacity-40"
                disabled={!canEdit || !state.hasUnpublishedChanges}
                onClick={() => setConfirm({ kind: "discard", rule: null })}
              >
                Cancel Changes
              </button>
            </div>
          </div>

          <div className="panel mt-5 overflow-hidden">
            {ordered.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-14 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-aqua-200 bg-aqua-50 text-navy-500">
                  <BookIcon width={18} height={18} />
                </span>
                <h3 className="mt-4 font-display text-base font-semibold text-navy-900">
                  No rules in the draft
                </h3>
                <p className="mt-1.5 max-w-sm text-sm text-navy-500">
                  Add a new rule or restore the ten {brandName} defaults, then publish when you are
                  ready.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-aqua-100">
                {ordered.map((rule, index) => (
                  <li
                    key={rule.id}
                    draggable={canEdit}
                    onDragStart={() => setDragIndex(index)}
                    onDragEnd={() => setDragIndex(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => dropOn(index)}
                    data-rule-row={rule.id}
                    className={`flex flex-wrap items-start gap-3 px-4 py-3.5 transition-colors sm:flex-nowrap sm:items-center sm:px-5 ${
                      dragIndex === index ? "bg-aqua-50" : rule.enabled ? "" : "opacity-70"
                    }`}
                  >
                    <span className="flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg border border-aqua-100 bg-white text-navy-400">
                      <MenuIcon width={15} height={15} />
                    </span>
                    <span className="w-6 shrink-0 text-center font-mono text-[11px] text-navy-400">
                      {index + 1}
                    </span>
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
                      style={{
                        background: `${rule.color}1f`,
                        borderColor: `${rule.color}45`,
                        color: rule.color,
                      }}
                    >
                      <RuleGlyph icon={rule.icon} width={16} height={16} />
                    </span>
                    <span className="min-w-0 flex-1 basis-40">
                      <span className="flex flex-wrap items-center gap-2">
                        <span
                          className="truncate text-sm text-navy-900"
                          style={{ fontWeight: rule.bold ? 800 : 500 }}
                        >
                          {rule.title}
                        </span>
                        {!rule.enabled && (
                          <span className="badge border-navy-200 bg-navy-100 text-navy-600">
                            Hidden
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-navy-400">
                        {rule.description}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        className="icon-btn disabled:opacity-30"
                        aria-label={`Move ${rule.title} up`}
                        disabled={index === 0 || !canEdit}
                        onClick={() => move(index, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="icon-btn disabled:opacity-30"
                        aria-label={`Move ${rule.title} down`}
                        disabled={index === ordered.length - 1 || !canEdit}
                        onClick={() => move(index, 1)}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={rule.enabled ? `Disable ${rule.title}` : `Enable ${rule.title}`}
                        title={rule.enabled ? "Hide from /rules after publish" : "Show on /rules after publish"}
                        disabled={!canEdit || busyId === rule.id}
                        onClick={() => void toggleEnabled(rule)}
                      >
                        {rule.enabled ? (
                          <EyeIcon width={14} height={14} />
                        ) : (
                          <EyeOffIcon width={14} height={14} />
                        )}
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Edit ${rule.title}`}
                        disabled={!canEdit}
                        onClick={() => setEditor({ rule })}
                      >
                        <PencilIcon width={13} height={13} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn hover:border-red-300 hover:text-red-600"
                        aria-label={`Delete ${rule.title}`}
                        disabled={!canDelete}
                        onClick={() => setConfirm({ kind: "delete", rule })}
                      >
                        <TrashIcon width={13} height={13} />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] text-navy-400">
                Drag a row or use the arrows, then save the order. The public page follows this order
                exactly.
              </p>
              {canDelete && (
                <button
                  type="button"
                  className="btn-subtle !border-red-200 !text-red-600 hover:!bg-red-50"
                  onClick={() => setConfirm({ kind: "reset", rule: null })}
                >
                  Reset to Defaults
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-ghost !py-2.5 text-xs"
                disabled={!orderChanged || savingOrder}
                onClick={() => setOrder(state ? orderOf(state.rules) : [])}
              >
                Discard order
              </button>
              <button
                type="button"
                className="btn-primary !py-2.5 text-xs"
                disabled={!orderChanged || savingOrder || !canEdit}
                onClick={() => void saveOrder()}
              >
                {savingOrder ? "Saving…" : "Save Order"}
              </button>
            </div>
          </div>
        </>
      )}

      {editor && (
        <RuleEditor
          rule={editor.rule}
          previewIndex={
            editor.rule
              ? Math.max(0, ordered.findIndex((rule) => rule.id === editor.rule?.id))
              : ordered.length
          }
          canEdit={canEdit}
          notify={notify}
          onClose={() => setEditor(null)}
          onSaved={apply}
        />
      )}

      {previewOpen && state && (
        <Modal
          title="Rules page preview"
          description={
            state.hasUnpublishedChanges
              ? "This preview shows the current draft. Only enabled rules appear publicly after you publish."
              : "This is exactly what visitors currently see on /rules."
          }
          onClose={() => setPreviewOpen(false)}
          wide
        >
          <div className="rounded-2xl border border-aqua-200/70 bg-gradient-to-b from-aqua-50/70 to-white/40 p-4 sm:p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-aqua-700">
              {brandName} Community
            </p>
            <p className="mt-1 font-display text-2xl font-extrabold uppercase tracking-tight text-navy-900">
              Server Rules
            </p>
            <p className="mt-1 text-xs text-navy-500">
              Play fair. Respect everyone. Make every adventure count.
            </p>

            {enabledRules.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-aqua-200 bg-white/60 px-4 py-8 text-center text-xs text-navy-500">
                No enabled rules. The public page will show its “rules are being updated” message.
              </p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {enabledRules.map((rule, index) => (
                  <RuleCard key={rule.id} rule={rule} index={index} compact />
                ))}
              </div>
            )}

            <div className="mt-4 rounded-xl border border-ember/25 bg-white/70 px-4 py-4 text-center">
              <p className="font-display text-xs font-extrabold uppercase tracking-[0.08em] text-navy-900">
                Play fair. Respect others. Enjoy the server.
              </p>
            </div>

            {counts.disabled > 0 && (
              <p className="mt-3 text-[11px] text-navy-400">
                {counts.disabled} disabled rule{counts.disabled === 1 ? "" : "s"} hidden from this
                preview and from the public page.
              </p>
            )}
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              className="btn-ghost !py-2.5 text-xs"
              onClick={() => setPreviewOpen(false)}
            >
              Close preview
            </button>
            <button
              type="button"
              className="btn-primary !py-2.5 text-xs"
              disabled={!canPublish}
              onClick={() => {
                setPreviewOpen(false);
                setConfirm({ kind: "publish", rule: null });
              }}
            >
              Publish Changes
            </button>
          </div>
        </Modal>
      )}

      {confirm && (
        <ActionConfirm
          kind={confirm.kind}
          rule={confirm.rule}
          publishedCount={counts.enabled}
          pending={busy}
          brandName={brandName}
          onCancel={() => setConfirm(null)}
          onConfirm={() => void runConfirm()}
        />
      )}
    </div>
  );
}
