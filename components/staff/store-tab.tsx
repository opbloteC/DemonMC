"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CoinIcon,
  EyeIcon,
  EyeOffIcon,
  KeyIcon,
  MenuIcon,
  PencilIcon,
  PlusIcon,
  RepeatIcon,
  ShieldIcon,
  SparklesIcon,
  StoreIcon,
  TrashIcon,
} from "@/components/icons";
import { RankBadge } from "@/components/rank-badge";
import { StoreCard } from "@/components/store/store-card";
import { BADGE_STYLE_LABELS } from "@/lib/rank-types";
import type {
  PublicStoreRank,
  StoreCardStyle,
  StoreCategory,
  StoreDesign,
  StoreLinkableRank,
  StorePromotion,
  StoreRankRecord,
  StoreState,
  StoreTheme,
} from "@/lib/store-types";
import {
  applyStorePromotion,
  DEFAULT_PROMOTION_TITLE,
  DEFAULT_STORE_BRAND_NAME,
  formatStorePrice,
  isPromotionActive,
  MAX_PROMOTION_DESCRIPTION_LENGTH,
  MAX_PROMOTION_PERCENT,
  MAX_PROMOTION_TITLE_LENGTH,
  MAX_STORE_BRAND_LENGTH,
  MAX_STORE_PRICE_CENTS,
  MIN_PROMOTION_PERCENT,
  splitStoreBrandName,
  STORE_CATEGORIES,
  STORE_CATEGORY_LABELS,
  STORE_CATEGORY_SINGULAR,
  STORE_DESIGNS,
  STORE_DESIGN_LABELS,
  STORE_STYLES,
  STORE_STYLE_LABELS,
  STORE_THEMES,
  STORE_THEME_HINTS,
  STORE_THEME_LABELS,
  toPublicStoreRank,
} from "@/lib/store-types";
import { isOwnerAccount, type SessionUser } from "@/lib/types";
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
import { ColorInput } from "./rank-admin/shared";

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

function orderOf(ranks: StoreRankRecord[]): number[] {
  return ranks.map((rank) => rank.id);
}

function centsFromInput(value: string): number | null {
  const cleaned = value.replace(/^\$/, "").trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(cleaned)) return null;
  const cents = Math.round(Number(cleaned) * 100);
  if (!Number.isFinite(cents) || cents < 0 || cents > MAX_STORE_PRICE_CENTS) return null;
  return cents;
}

function dollarsFromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

interface StoreDraft {
  category: StoreCategory;
  rankId: string;
  name: string;
  description: string;
  price: string;
  free: boolean;
  style: StoreCardStyle;
  color: string;
  gradientFrom: string;
  gradientTo: string;
  design: StoreDesign;
  buttonLabel: string;
  enabled: boolean;
}

const CATEGORY_DEFAULTS: Record<
  StoreCategory,
  { color: string; gradientFrom: string; gradientTo: string; name: string; price: string }
> = {
  rank: {
    name: "",
    price: "1.00",
    color: "#f4842d",
    gradientFrom: "#ff8c00",
    gradientTo: "#f2701c",
  },
  key: {
    name: "New Key",
    price: "0.25",
    color: "#eab308",
    gradientFrom: "#facc15",
    gradientTo: "#ca8a04",
  },
  coin: {
    name: "1,000 Coins",
    price: "1.00",
    color: "#f59e0b",
    gradientFrom: "#fbbf24",
    gradientTo: "#b45309",
  },
};

function draftFrom(card: StoreRankRecord | null, category: StoreCategory): StoreDraft {
  const defaults = CATEGORY_DEFAULTS[card?.category ?? category];
  return {
    category: card?.category ?? category,
    rankId: card?.rankId ? String(card.rankId) : "",
    name: card?.name ?? defaults.name,
    description: card?.description ?? "",
    price: card ? dollarsFromCents(card.priceCents) : defaults.price,
    free: card?.free ?? false,
    style: card?.style ?? "solid",
    color: card?.color ?? defaults.color,
    gradientFrom: card?.gradientFrom ?? defaults.gradientFrom,
    gradientTo: card?.gradientTo ?? defaults.gradientTo,
    design: card?.design ?? "classic",
    buttonLabel: card?.buttonLabel ?? "BUY NOW",
    enabled: card?.enabled ?? true,
  };
}

function sameAsCard(draft: StoreDraft, card: StoreRankRecord): boolean {
  const price = draft.free ? 0 : centsFromInput(draft.price);
  return (
    draft.rankId === String(card.rankId ?? "") &&
    draft.name.trim() === card.name &&
    draft.description.trim() === card.description &&
    price === card.priceCents &&
    draft.free === card.free &&
    draft.style === card.style &&
    draft.color.toLowerCase() === card.color.toLowerCase() &&
    draft.gradientFrom.toLowerCase() === card.gradientFrom.toLowerCase() &&
    draft.gradientTo.toLowerCase() === card.gradientTo.toLowerCase() &&
    draft.design === card.design &&
    draft.buttonLabel.trim() === card.buttonLabel &&
    draft.enabled === card.enabled
  );
}

function previewFromDraft(
  draft: StoreDraft,
  id: number,
  promotion: StorePromotion,
): PublicStoreRank {
  const parsed = centsFromInput(draft.price);
  const base = {
    id,
    category: draft.category,
    name: draft.name.trim() || `New ${STORE_CATEGORY_SINGULAR[draft.category]}`,
    description: draft.description.trim() || "Your store description will appear right here.",
    priceCents: draft.free ? 0 : (parsed ?? 0),
    free: draft.free,
    style: draft.style,
    color: draft.color,
    gradientFrom: draft.gradientFrom,
    gradientTo: draft.gradientTo,
    design: draft.design,
    buttonLabel: draft.buttonLabel.trim() || "BUY NOW",
    displayOrder: 0,
  };
  return toPublicStoreRank(base, promotion);
}

function StoreEditor({
  card,
  category,
  promotion,
  availableRanks,
  notify,
  onClose,
  onSaved,
}: {
  card: StoreRankRecord | null;
  category: StoreCategory;
  promotion: StorePromotion;
  availableRanks: StoreLinkableRank[];
  notify: Notify;
  onClose: () => void;
  onSaved: (state: StoreState) => void;
}) {
  const [draft, setDraft] = useState<StoreDraft>(() => draftFrom(card, category));
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const taken = useMemo(() => {
    // Available ranks come from the parent already filtered, so every option is
    // safe to link. Keep the current rank selectable while editing.
    return availableRanks;
  }, [availableRanks]);

  const selectedRank = taken.find((rank) => String(rank.id) === draft.rankId) ?? null;
  const currentRankGone = !selectedRank && Boolean(draft.rankId);
  const priceCents = centsFromInput(draft.price);
  const priceValid = draft.free || (priceCents !== null && priceCents >= 1);

  function set<K extends keyof StoreDraft>(key: K, value: StoreDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function chooseRank(value: string) {
    const rank = taken.find((item) => String(item.id) === value) ?? null;
    setDraft((current) => ({
      ...current,
      rankId: value,
      name: rank ? rank.name : current.name,
      color: rank ? rank.color : current.color,
      gradientFrom: rank ? rank.color : current.gradientFrom,
    }));
  }

  function useRankColor() {
    if (!selectedRank) return;
    setDraft((current) => ({
      ...current,
      color: selectedRank.color,
      gradientFrom: selectedRank.color,
    }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (draft.category === "rank" && !draft.rankId) {
      setError("Choose a rank from Rank Management.");
      return;
    }
    if (draft.category === "rank" && currentRankGone) {
      setError("The linked rank was deleted. Choose another active rank before saving.");
      return;
    }
    if (card && sameAsCard(draft, card)) {
      notify("No changes to save.");
      onClose();
      return;
    }
    if (!priceValid) {
      setError("Enter a price between $0.01 and $999.99, or mark the rank as free.");
      return;
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(draft.color)) {
      setError("Accent color must be a six-digit HEX value.");
      return;
    }
    setPending(true);

    const body: Record<string, unknown> = {
      name: draft.name,
      description: draft.description,
      priceCents: draft.free ? 0 : (priceCents ?? 0),
      free: draft.free,
      style: draft.style,
      color: draft.color,
      gradientFrom: draft.gradientFrom,
      gradientTo: draft.gradientTo,
      design: draft.design,
      buttonLabel: draft.buttonLabel,
      enabled: draft.enabled,
    };
    if (draft.category === "rank") body.rankId = Number(draft.rankId);
    if (!card) body.category = draft.category;

    try {
      const state = card
        ? await apiRequest<StoreState>(`/api/owner/store/${card.id}`, {
            method: "PATCH",
            body,
          })
        : await apiRequest<StoreState>("/api/owner/store", { method: "POST", body });
      notify(
        card
          ? `Store card “${draft.name.trim()}” saved to the draft. Publish to update /store.`
          : `Store card “${draft.name.trim()}” added to the draft. Publish to update /store.`,
      );
      onSaved(state);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  const preview = previewFromDraft(draft, card?.id ?? 0, promotion);
  const editorCopy =
    draft.category === "rank"
      ? {
          title: card ? "Edit rank card" : "Add a store rank",
          description:
            "Rank cards link to a real rank from Rank Management. Styling here never changes the actual rank.",
        }
      : draft.category === "key"
        ? {
            title: card ? "Edit key" : "Add a key",
            description:
              "Key cards set their own name, price and colour. The active promotion is applied automatically on /store.",
          }
        : {
            title: card ? "Edit coin pack" : "Add a coin pack",
            description:
              "Coin packs set their own name, price and gold accent. The active promotion is applied automatically on /store.",
          };

  return (
    <Modal
      title={editorCopy.title}
      description={editorCopy.description}
      onClose={onClose}
      wide
    >
      <form onSubmit={submit} className="grid gap-5 sm:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          {draft.category === "rank" && (
            <>
              <Field
                label="Linked rank"
                htmlFor="store-rank"
                hint="Only the store card changes — the player rank stays untouched."
              >
                <select
                  id="store-rank"
                  className="input"
                  required
                  value={draft.rankId}
                  onChange={(event) => chooseRank(event.target.value)}
                >
                  <option value="">Choose a rank…</option>
                  {taken.map((rank) => (
                    <option key={rank.id} value={rank.id}>
                      {rank.name} · {rank.color}
                    </option>
                  ))}
                </select>
                {currentRankGone && (
                  <p className="mt-1.5 text-[11px] text-red-600">
                    This card&apos;s rank was deleted in Rank Management. Choose another active rank.
                  </p>
                )}
              </Field>

              {selectedRank && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-aqua-100 bg-aqua-50/60 px-3.5 py-3">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-navy-400">
                    Actual rank
                  </span>
                  <RankBadge rank={selectedRank} />
                  <span className="text-[11px] text-navy-500">
                    {BADGE_STYLE_LABELS[selectedRank.badgeStyle]} · {selectedRank.color}
                  </span>
                  <button
                    type="button"
                    className="btn-subtle ml-auto !px-3 !py-1.5 text-[10px]"
                    onClick={useRankColor}
                  >
                    Use this colour
                  </button>
                </div>
              )}
            </>
          )}

          <Field
            label={draft.category === "coin" ? "Coin pack name" : "Store name"}
            htmlFor="store-name"
            hint={
              draft.category === "rank"
                ? "Can differ from the actual rank name shown on badges."
                : "Shown exactly as written on the store card."
            }
          >
            <input
              id="store-name"
              className="input"
              required
              minLength={2}
              maxLength={40}
              value={draft.name}
              onChange={(event) => set("name", event.target.value)}
              placeholder={draft.category === "key" ? "Demon Key" : "10,000 Coins"}
            />
          </Field>

          <Field label="Description" htmlFor="store-description">
            <textarea
              id="store-description"
              className="input min-h-[84px] resize-y"
              required
              minLength={2}
              maxLength={300}
              rows={3}
              value={draft.description}
              onChange={(event) => set("description", event.target.value)}
              placeholder={
                draft.category === "rank"
                  ? "What does this rank give the player?"
                  : "What does this product include?"
              }
            />
          </Field>

          <div className={`grid gap-3 ${draft.category === "rank" ? "sm:grid-cols-2" : ""}`}>
            <Field label="Original price (USD)" htmlFor="store-price">
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-navy-400">
                  $
                </span>
                <input
                  id="store-price"
                  className="input pl-7"
                  inputMode="decimal"
                  value={draft.free ? "0.00" : draft.price}
                  disabled={draft.free}
                  onChange={(event) => set("price", event.target.value)}
                  placeholder="3.50"
                />
              </div>
            </Field>

            {draft.category === "rank" && (
            <div>
              <span className="label">Availability</span>
              <button
                type="button"
                role="switch"
                aria-checked={draft.free}
                onClick={() => set("free", !draft.free)}
                className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left text-xs transition-colors ${
                  draft.free
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                    : "border-aqua-200 bg-white text-navy-600"
                }`}
              >
                <span>{draft.free ? "FREE rank" : "PAID rank"}</span>
                <span
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                    draft.free ? "bg-emerald-500" : "bg-navy-200"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      draft.free ? "translate-x-[18px]" : "translate-x-0.5"
                    }`}
                  />
                </span>
              </button>
              {!draft.free && !priceValid && (
                <p className="mt-1.5 text-[11px] text-red-600">
                  Paid ranks need at least $0.01.
                </p>
              )}
            </div>
            )}
          </div>

          <Field label="Button text" htmlFor="store-button">
            <input
              id="store-button"
              className="input"
              required
              minLength={2}
              maxLength={24}
              value={draft.buttonLabel}
              onChange={(event) => set("buttonLabel", event.target.value)}
              placeholder="BUY NOW"
            />
          </Field>

          <div className={`grid gap-3 ${draft.category === "rank" ? "sm:grid-cols-2" : ""}`}>
            <Field label="Colour style" htmlFor="store-style">
              <select
                id="store-style"
                className="input"
                value={draft.style}
                onChange={(event) => set("style", event.target.value as StoreCardStyle)}
              >
                {STORE_STYLES.map((style) => (
                  <option key={style} value={style}>
                    {STORE_STYLE_LABELS[style]}
                  </option>
                ))}
              </select>
            </Field>

            {draft.category === "rank" && (
              <Field label="Card design" htmlFor="store-design">
                <select
                  id="store-design"
                  className="input"
                  value={draft.design}
                  onChange={(event) => set("design", event.target.value as StoreDesign)}
                >
                  {STORE_DESIGNS.map((design) => (
                    <option key={design} value={design}>
                      {STORE_DESIGN_LABELS[design]}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>

          <ColorInput
            label="Accent color"
            value={draft.color}
            onChange={(value) => set("color", value)}
          />
          {draft.style === "gradient" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <ColorInput
                label="Gradient start"
                value={draft.gradientFrom}
                onChange={(value) => set("gradientFrom", value)}
              />
              <ColorInput
                label="Gradient end"
                value={draft.gradientTo}
                onChange={(value) => set("gradientTo", value)}
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4">
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
              {draft.enabled ? "Enabled — visible after publish" : "Disabled — hidden from /store"}
            </span>
          </div>
        </div>

        <div>
          <p className="label">Live preview</p>
          <div
            className="rounded-2xl border border-dashed border-aqua-200 bg-aqua-50/60 p-3"
            aria-live="polite"
          >
            <StoreCard compact item={preview} />
          </div>
          {preview.discountPercent > 0 && (
            <p className="mt-2 rounded-lg border border-red-200/70 bg-red-50/60 px-2.5 py-2 text-[11px] leading-relaxed text-red-800">
              Sale preview: the {promotion.title} is active, so this card shows{" "}
              {formatStorePrice(preview.finalPriceCents)} instead of{" "}
              {formatStorePrice(preview.priceCents)}. The original price stays saved.
            </p>
          )}
          <p className="mt-2 text-[11px] leading-relaxed text-navy-400">
            {draft.category === "rank"
              ? "The real rank keeps its own colour and badge style. Use “Use this colour” to match the store card after changing the rank in Rank Management."
              : "Only the store card changes. The active promotion applies to keys and coins without editing this price."}
          </p>
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
            disabled={
              pending ||
              (draft.category === "rank" && (!draft.rankId || currentRankGone)) ||
              !priceValid
            }
            className="btn-primary !py-2.5 text-xs"
          >
            {pending ? "Saving…" : "Save card"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

type ConfirmKind = "delete" | "publish" | "discard";

function ActionConfirm({
  kind,
  card,
  liveCount,
  pending,
  onCancel,
  onConfirm,
}: {
  kind: ConfirmKind;
  card: StoreRankRecord | null;
  liveCount: number;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (kind === "delete") {
    return (
      <ConfirmDialog
        title="Delete store card"
        message={`Delete “${card?.name ?? "this card"}” from the store draft? The actual rank in Rank Management is not deleted. The public page keeps the last published version until you publish again.`}
        confirmLabel="Delete card"
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
        message="Discard every unpublished store change and reload the last published store? New cards, edits, deletions and order changes in the draft are lost."
        confirmLabel="Cancel changes"
        pending={pending}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );
  }

  return (
    <Modal title="Publish store" onClose={onCancel}>
      <p className="text-sm leading-relaxed text-navy-600">
        Publish {liveCount} enabled store card{liveCount === 1 ? "" : "s"} to the public{" "}
        <span className="font-mono text-xs text-navy-800">/store</span> page? The live page updates
        immediately without a redeploy.
      </p>
      <p className="mt-2 text-xs leading-relaxed text-navy-500">
        Publishing only changes the website. Ranks are still assigned manually by staff in Discord.
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
          {pending ? "Publishing…" : "Publish store"}
        </button>
      </div>
    </Modal>
  );
}

interface BrandingPayload {
  name: string;
  defaultName: string;
  maxLength: number;
}

function StoreBrandingPanel({
  notify,
  onNameChange,
  brandName,
}: {
  notify: Notify;
  onNameChange: (name: string) => void;
  brandName: string;
}) {
  const [branding, setBranding] = useState<BrandingPayload | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await apiRequest<BrandingPayload>("/api/owner/store-branding");
      setBranding(data);
      setDraft(data.name);
      onNameChange(data.name);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [onNameChange]);

  useEffect(() => {
    void load();
  }, [load]);

  const normalized = draft.replace(/\s+/g, " ").trim();
  const maxLength = branding?.maxLength ?? MAX_STORE_BRAND_LENGTH;
  const valid = normalized.length >= 2 && normalized.length <= maxLength;
  const dirty = Boolean(branding) && normalized !== branding?.name;
  const previewName = normalized || branding?.name || DEFAULT_STORE_BRAND_NAME;
  const preview = splitStoreBrandName(previewName);

  useEffect(() => {
    onNameChange(previewName);
  }, [onNameChange, previewName]);

  async function save(restore: boolean) {
    if (saving || (!restore && !valid)) return;
    setSaving(true);
    setError("");
    try {
      const data = await apiRequest<BrandingPayload>("/api/owner/store-branding", {
        method: "PUT",
        body: restore ? { restore: true } : { name: normalized },
      });
      setBranding(data);
      setDraft(data.name);
      onNameChange(data.name);
      notify(
        restore
          ? `Store name restored to “${data.name}”.`
          : `Store name saved. /store now shows “${data.name}”.`,
      );
    } catch (err) {
      setError(errorMessage(err));
      notify(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className="panel mt-5 overflow-hidden border-sun/20"
      aria-labelledby="store-branding-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-aqua-200/70 bg-gradient-to-r from-sun/[0.08] via-transparent to-transparent px-5 py-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-sun-deep">
            Store branding
          </p>
          <h2
            id="store-branding-title"
            className="mt-1 font-display text-base font-bold text-navy-900"
          >
            Public store name
          </h2>
          <p className="mt-1 text-[11px] leading-relaxed text-navy-500">
            Changes the main heading on /store only. The {brandName} logo, navbar and server name
            are never affected.
          </p>
        </div>
        <span className="badge border-sun/30 bg-sun/10 text-sun-deep">Owner only</span>
      </div>

      <div className="grid gap-5 p-5 md:grid-cols-[1fr_1fr]">
        <div>
          <Field
            label="Store Name"
            htmlFor="store-brand-name"
            hint={`2–${maxLength} characters. The final word keeps the orange accent.`}
          >
            <input
              id="store-brand-name"
              type="text"
              className="input"
              value={draft}
              maxLength={maxLength}
              disabled={!branding || saving}
              placeholder={DEFAULT_STORE_BRAND_NAME}
              onChange={(event) => {
                setDraft(event.target.value);
                if (error) setError("");
              }}
            />
          </Field>
          <div className="mt-1.5 flex items-center justify-between text-[10px] font-medium text-navy-400">
            <span>{branding ? "Saved in Neon PostgreSQL" : "Loading branding…"}</span>
            <span>{normalized.length}/{maxLength}</span>
          </div>

          {error && (
            <div className="mt-3">
              <ErrorNote>{error}</ErrorNote>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary !py-2.5 text-xs"
              disabled={saving || !branding || !valid || !dirty}
              onClick={() => void save(false)}
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
            <button
              type="button"
              className="btn-ghost !py-2.5 text-xs"
              disabled={
                saving ||
                !branding ||
                (branding.name === (branding.defaultName || DEFAULT_STORE_BRAND_NAME) &&
                  normalized === branding.name)
              }
              onClick={() => void save(true)}
            >
              Restore Default
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-aqua-200/70 bg-gradient-to-br from-aqua-50/70 via-white/40 to-sun/[0.06] p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-navy-400">
              Live preview
            </p>
            <span className="text-[10px] font-medium text-navy-400">/store heading</span>
          </div>
          <div className="mt-3 rounded-lg border border-aqua-200/60 bg-white/50 px-4 py-4">
            <p className="eyebrow flex items-center gap-2">
              <span className="h-px w-6 bg-sun/80" />
              RANK STORE
            </p>
            <p className="mt-2 break-words font-display text-2xl font-extrabold uppercase leading-tight tracking-tight text-navy-900">
              {preview.leading && <>{preview.leading} </>}
              <span className="text-sun-deep">{preview.accent}</span>
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-navy-500">
              Choose your rank. Unlock your status. Join the {brandName} community.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

interface PromotionDraft {
  enabled: boolean;
  discountPercent: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  theme: StoreTheme;
}

function promotionDraftFrom(promotion: StorePromotion): PromotionDraft {
  return {
    enabled: promotion.enabled,
    discountPercent: String(promotion.discountPercent),
    title: promotion.title,
    description: promotion.description,
    startsAt: promotion.startsAt ?? "",
    endsAt: promotion.endsAt ?? "",
    theme: promotion.theme,
  };
}

function PromotionPanel({
  promotion,
  sample,
  notify,
  onSaved,
}: {
  promotion: StorePromotion;
  sample: StoreRankRecord | null;
  notify: Notify;
  onSaved: (state: StoreState) => void;
}) {
  const [draft, setDraft] = useState<PromotionDraft>(() => promotionDraftFrom(promotion));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(promotionDraftFrom(promotion));
  }, [promotion]);

  function set<K extends keyof PromotionDraft>(key: K, value: PromotionDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  const discount = Number(draft.discountPercent);
  const discountValid =
    Number.isInteger(discount) && discount >= MIN_PROMOTION_PERCENT && discount <= MAX_PROMOTION_PERCENT;
  const titleValid = draft.title.trim().length >= 2 && draft.title.trim().length <= MAX_PROMOTION_TITLE_LENGTH;
  const descriptionValid = draft.description.length <= MAX_PROMOTION_DESCRIPTION_LENGTH;
  const datesValid = !draft.startsAt || !draft.endsAt || draft.startsAt <= draft.endsAt;
  const canSave =
    !saving && discountValid && titleValid && descriptionValid && datesValid;

  const previewPromotion = {
    enabled: draft.enabled,
    discountPercent: discountValid ? discount : 0,
    startsAt: draft.startsAt || null,
    endsAt: draft.endsAt || null,
  };
  const active = isPromotionActive(previewPromotion);
  const previewItem = sample ? toPublicStoreRank(sample, previewPromotion) : null;

  const status = !draft.enabled
    ? "Sale disabled"
    : !datesValid
      ? "Check the dates"
      : active
        ? "Live now"
        : draft.startsAt && new Date().toISOString().slice(0, 10) < draft.startsAt
          ? "Scheduled"
          : "Ended or not started";

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError("");
    try {
      const state = await apiRequest<StoreState>("/api/owner/store/promotion", {
        method: "PUT",
        body: {
          enabled: draft.enabled,
          discountPercent: discount,
          title: draft.title,
          description: draft.description,
          startsAt: draft.startsAt || null,
          endsAt: draft.endsAt || null,
          theme: draft.theme,
        },
      });
      onSaved(state);
      notify(
        state.promotion.enabled
          ? `Promotion saved. ${state.promotion.discountPercent}% pricing and the ${STORE_THEME_LABELS[state.promotion.theme]} theme update /store immediately.`
          : "Promotion settings saved. The sale is disabled on /store.",
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel mt-5 overflow-hidden border-ember/20" aria-labelledby="store-promotion-title">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-aqua-200/70 bg-gradient-to-r from-ember/[0.07] via-transparent to-transparent px-5 py-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-ember-dark">
            Seasonal settings
          </p>
          <h2 id="store-promotion-title" className="mt-1 font-display text-base font-bold text-navy-900">
            Promotions &amp; theme
          </h2>
          <p className="mt-1 text-[11px] leading-relaxed text-navy-500">
            The discount applies to keys and coins only. Original prices are never overwritten, and
            changing the theme never changes the percentage.
          </p>
        </div>
        <span
          className={`badge ${
            status === "Live now"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : status === "Scheduled"
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-navy-200 bg-navy-100 text-navy-600"
          }`}
        >
          {status}
        </span>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-[1.15fr_1fr]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-aqua-100 bg-aqua-50/50 px-3.5 py-3">
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
              {draft.enabled
                ? "Promotion enabled — active inside the date range"
                : "Promotion disabled — normal prices are shown"}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Discount (%)" htmlFor="promotion-percent">
              <input
                id="promotion-percent"
                className="input"
                inputMode="numeric"
                value={draft.discountPercent}
                onChange={(event) => set("discountPercent", event.target.value)}
                placeholder="50"
              />
              {!discountValid && (
                <p className="mt-1.5 text-[11px] text-red-600">
                  Whole number from {MIN_PROMOTION_PERCENT} to {MAX_PROMOTION_PERCENT}.
                </p>
              )}
            </Field>

            <Field label="Seasonal theme" htmlFor="promotion-theme">
              <select
                id="promotion-theme"
                className="input"
                value={draft.theme}
                onChange={(event) => set("theme", event.target.value as StoreTheme)}
              >
                {STORE_THEMES.map((theme) => (
                  <option key={theme} value={theme}>
                    {STORE_THEME_LABELS[theme]}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[11px] leading-relaxed text-navy-400">
                {STORE_THEME_HINTS[draft.theme]}
              </p>
            </Field>
          </div>

          <Field label="Promotion title" htmlFor="promotion-title">
            <input
              id="promotion-title"
              className="input"
              maxLength={MAX_PROMOTION_TITLE_LENGTH}
              value={draft.title}
              onChange={(event) => set("title", event.target.value)}
              placeholder={DEFAULT_PROMOTION_TITLE}
            />
            {!titleValid && (
              <p className="mt-1.5 text-[11px] text-red-600">
                Use between 2 and {MAX_PROMOTION_TITLE_LENGTH} characters.
              </p>
            )}
          </Field>

          <Field label="Promotion description" htmlFor="promotion-description">
            <textarea
              id="promotion-description"
              className="input min-h-[72px] resize-y"
              rows={2}
              maxLength={MAX_PROMOTION_DESCRIPTION_LENGTH}
              value={draft.description}
              onChange={(event) => set("description", event.target.value)}
              placeholder="Optional line shown under the promotion title."
            />
            <p className="mt-1.5 text-right text-[10px] text-navy-400">
              {draft.description.length}/{MAX_PROMOTION_DESCRIPTION_LENGTH}
            </p>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Starts (optional)" htmlFor="promotion-start">
              <input
                id="promotion-start"
                type="date"
                className="input"
                value={draft.startsAt}
                onChange={(event) => set("startsAt", event.target.value)}
              />
            </Field>
            <Field label="Ends (optional)" htmlFor="promotion-end">
              <input
                id="promotion-end"
                type="date"
                className="input"
                value={draft.endsAt}
                onChange={(event) => set("endsAt", event.target.value)}
              />
            </Field>
          </div>
          {!datesValid && (
            <p className="text-[11px] text-red-600">The end date must be on or after the start date.</p>
          )}

          {error && <ErrorNote>{error}</ErrorNote>}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary !py-2.5 text-xs"
              disabled={!canSave}
              onClick={() => void save()}
            >
              {saving ? "Saving…" : "Save Promotion"}
            </button>
            <button
              type="button"
              className="btn-ghost !py-2.5 text-xs"
              disabled={saving}
              onClick={() => setDraft(promotionDraftFrom(promotion))}
            >
              Reset fields
            </button>
          </div>
          <p className="text-[11px] leading-relaxed text-navy-400">
            Saving updates the public page immediately. Sale prices are calculated on the server
            from the original price; the saved product price is never reduced.
          </p>
        </div>

        <div>
          <p className="label">Live promotion preview</p>
          <div
            className={`rounded-2xl border border-dashed p-3 ${
              draft.theme === "christmas"
                ? "border-emerald-200 bg-[linear-gradient(120deg,rgba(220,38,38,0.06),rgba(255,255,255,0.6)_50%,rgba(16,185,129,0.08))]"
                : draft.theme === "summer"
                  ? "border-amber-200 bg-[linear-gradient(120deg,rgba(251,191,36,0.14),rgba(255,255,255,0.6)_55%,rgba(249,115,22,0.08))]"
                  : "border-aqua-200 bg-aqua-50/60"
            }`}
            aria-live="polite"
          >
            <div className="flex items-start gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-red-600 text-white">
                <SparklesIcon width={15} height={15} />
              </span>
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-extrabold uppercase tracking-[0.05em] text-navy-900">
                  {draft.title.trim() || DEFAULT_PROMOTION_TITLE}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-navy-500">
                  {draft.description.trim() || "Add a short line about the sale."}
                </p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-navy-400">
                  {STORE_THEME_LABELS[draft.theme]} ·{" "}
                  {discountValid ? `${discount}% off keys & coins` : "Invalid discount"}
                  {draft.startsAt || draft.endsAt
                    ? ` · ${draft.startsAt || "now"} → ${draft.endsAt || "no end"}`
                    : " · no date limit"}
                </p>
              </div>
            </div>
            {previewItem && (
              <div className="mt-3">
                <StoreCard compact item={previewItem} />
              </div>
            )}
            {!sample && (
              <p className="mt-3 rounded-lg border border-dashed border-aqua-200 bg-white/60 px-3 py-4 text-center text-[11px] text-navy-500">
                Add a key or coin pack to preview sale pricing.
              </p>
            )}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-navy-400">
            The theme only changes decorative colours. The discount stays exactly at the percentage
            above unless you edit it.
          </p>
        </div>
      </div>
    </section>
  );
}

export function StoreManagementTab({
  user,
  notify,
  brandName = "DemonMC",
}: {
  user: SessionUser;
  notify: Notify;
  brandName?: string;
}) {
  const [state, setState] = useState<StoreState | null>(null);
  const [order, setOrder] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [savingOrder, setSavingOrder] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editor, setEditor] = useState<{
    card: StoreRankRecord | null;
    category: StoreCategory;
  } | null>(null);
  const [confirm, setConfirm] = useState<{ kind: ConfirmKind; card: StoreRankRecord | null } | null>(
    null,
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewBrandName, setPreviewBrandName] = useState(DEFAULT_STORE_BRAND_NAME);
  const previewBrand = splitStoreBrandName(previewBrandName);

  const load = useCallback(async () => {
    try {
      const data = await apiRequest<StoreState>("/api/owner/store");
      setState(data);
      setOrder(orderOf(data.ranks));
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const apply = useCallback((next: StoreState, resetOrder = false) => {
    setState(next);
    const ids = orderOf(next.ranks);
    if (resetOrder) {
      setOrder(ids);
      return;
    }
    // Keep an unsaved local drag order while applying unrelated edits.
    setOrder((current) => {
      const kept = current.filter((id) => ids.includes(id));
      const added = ids.filter((id) => !kept.includes(id));
      return [...kept, ...added];
    });
  }, []);

  const byId = useMemo(
    () => new Map((state?.ranks ?? []).map((rank) => [rank.id, rank])),
    [state],
  );
  const ordered = order
    .map((id) => byId.get(id))
    .filter((rank): rank is StoreRankRecord => Boolean(rank));

  const changedCategories = useMemo(() => {
    if (!state) return [] as StoreCategory[];
    return STORE_CATEGORIES.filter((category) => {
      const local = order
        .map((id) => byId.get(id))
        .filter((card): card is StoreRankRecord => card !== undefined && card.category === category)
        .map((card) => card.id);
      const server = state.ranks
        .filter((card) => card.category === category)
        .map((card) => card.id);
      return local.join(",") !== server.join(",");
    });
  }, [byId, order, state]);
  const orderChanged = changedCategories.length > 0;

  const enabledCards = ordered.filter((card) => card.enabled);
  const previewItems = applyStorePromotion(enabledCards, state?.promotion ?? null);
  const deletedLinks = ordered.filter(
    (card) => card.category === "rank" && (!card.rank || card.rank.deletedAt),
  );
  const promotionSample =
    ordered.find((card) => card.category === "key") ??
    ordered.find((card) => card.category === "coin") ??
    null;

  const linkedRankIds = useMemo(
    () => new Set((state?.ranks ?? []).map((card) => card.rankId).filter(Boolean)),
    [state],
  );

  function pickerRanks(card: StoreRankRecord | null): StoreLinkableRank[] {
    const available = state?.availableRanks ?? [];
    const list = available.filter(
      (rank) => !linkedRankIds.has(rank.id) || rank.id === card?.rankId,
    );
    // Keep the current active rank visible while editing even if the list was
    // refreshed between opening the editor and this render.
    if (card?.rank && !card.rank.deletedAt && !list.some((rank) => rank.id === card.rank?.id)) {
      list.push(card.rank);
    }
    return list;
  }

  function move(card: StoreRankRecord, direction: -1 | 1) {
    setOrder((current) => {
      const index = current.indexOf(card.id);
      if (index < 0) return current;
      const group = current.filter((id) => byId.get(id)?.category === card.category);
      const groupIndex = group.indexOf(card.id);
      const targetId = group[groupIndex + direction];
      if (!targetId) return current;
      const targetIndex = current.indexOf(targetId);
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }

  function dropOn(target: StoreRankRecord) {
    if (dragIndex === null) return;
    const dragged = ordered[dragIndex];
    if (!dragged || dragged.id === target.id || dragged.category !== target.category) {
      setDragIndex(null);
      return;
    }
    setOrder((current) => {
      const from = current.indexOf(dragged.id);
      const to = current.indexOf(target.id);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDragIndex(null);
  }

  async function saveOrder() {
    if (!orderChanged) return;
    setSavingOrder(true);
    try {
      let data: StoreState | null = null;
      for (const category of changedCategories) {
        const ids = order.filter((id) => byId.get(id)?.category === category);
        data = await apiRequest<StoreState>("/api/owner/store/reorder", {
          method: "PUT",
          body: { category, ids },
        });
      }
      if (data) apply(data, true);
      notify("Store order saved to the draft. Publish to update the public page.");
    } catch (err) {
      notify(errorMessage(err), "error");
    } finally {
      setSavingOrder(false);
    }
  }

  async function toggleEnabled(card: StoreRankRecord) {
    setBusyId(card.id);
    try {
      const data = await apiRequest<StoreState>(`/api/owner/store/${card.id}`, {
        method: "PATCH",
        body: { enabled: !card.enabled },
      });
      apply(data);
      notify(
        card.enabled
          ? `“${card.name}” disabled in the draft. Publish to hide it on /store.`
          : `“${card.name}” enabled in the draft. Publish to show it on /store.`,
      );
    } catch (err) {
      notify(errorMessage(err), "error");
    } finally {
      setBusyId(null);
    }
  }

  async function syncColor(card: StoreRankRecord) {
    setBusyId(card.id);
    try {
      const data = await apiRequest<StoreState>(`/api/owner/store/${card.id}`, {
        method: "PATCH",
        body: { syncColor: true },
      });
      apply(data);
      notify(`Store colour synced from the “${card.rank?.name ?? "linked"}” rank. Publish to update /store.`);
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
      if (confirm.kind === "delete" && confirm.card) {
        const data = await apiRequest<StoreState>(`/api/owner/store/${confirm.card.id}`, {
          method: "DELETE",
        });
        apply(data);
        notify(`“${confirm.card.name}” deleted from the draft. Publish to update /store.`);
      } else if (confirm.kind === "discard") {
        const data = await apiRequest<StoreState>("/api/owner/store/discard", {
          method: "POST",
        });
        apply(data, true);
        notify("Unpublished store changes discarded. The draft matches the live page.");
      } else {
        const data = await apiRequest<StoreState>("/api/owner/store/publish", {
          method: "POST",
        });
        apply(data, true);
        notify("Store published. The public /store page is live.");
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
      notify("All draft edits are stored in Neon. Use Publish Changes to update /store.");
    } else {
      notify("Everything is saved and published.");
    }
  }

  return (
    <div>
      <PageSectionHeader
        title="Store management"
        description="Manage rank cards, keys and coin packs, set original prices and the seasonal promotion, then preview and publish."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary !py-2.5 text-xs"
              onClick={() => setEditor({ card: null, category: "rank" })}
              disabled={Boolean(state) && pickerRanks(null).length === 0}
              title={
                state && pickerRanks(null).length === 0
                  ? "Every active rank already has a store card."
                  : undefined
              }
            >
              <PlusIcon width={14} height={14} />
              RANK
            </button>
            <button
              type="button"
              className="btn-subtle !py-2.5 text-xs"
              onClick={() => setEditor({ card: null, category: "key" })}
            >
              <KeyIcon width={14} height={14} />
              KEY
            </button>
            <button
              type="button"
              className="btn-subtle !py-2.5 text-xs"
              onClick={() => setEditor({ card: null, category: "coin" })}
            >
              <CoinIcon width={14} height={14} />
              COINS
            </button>
          </div>
        }
      />

      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-ember/15 bg-ember/[0.04] px-4 py-3 text-[11px] leading-relaxed text-navy-600">
        <StoreIcon width={14} height={14} className="mt-0.5 shrink-0 text-ember" />
        <span>
          <strong className="font-semibold text-navy-900">Ranks, keys and coins are managed here.</strong>{" "}
          Rank cards still link to Rank Management; editing or deleting a card never changes the
          actual rank. Every purchase is confirmed by staff in Discord — this page never takes
          payments or marks an order paid.
        </span>
      </div>

      {isOwnerAccount(user) && (
        <StoreBrandingPanel notify={notify} onNameChange={setPreviewBrandName} brandName={brandName} />
      )}

      {state && <PromotionPanel promotion={state.promotion} sample={promotionSample} notify={notify} onSaved={apply} />}

      {state === null && !error && (
        <div className="panel mt-5 py-14">
          <Spinner label="Loading store" />
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
                Last published:{" "}
                <strong className="text-navy-700">{timestamp(state.lastPublishedAt)}</strong>
              </span>
              <span>
                {ordered.length} cards · {enabledCards.length} live ·{" "}
                {ordered.length - enabledCards.length} hidden ·{" "}
                {STORE_CATEGORIES.map(
                  (category) =>
                    `${ordered.filter((card) => card.category === category).length} ${STORE_CATEGORY_LABELS[category].toLowerCase()}`,
                ).join(" / ")}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-subtle"
                onClick={() => setPreviewOpen(true)}
              >
                <EyeIcon width={14} height={14} />
                Preview Store
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
                onClick={() => setConfirm({ kind: "publish", card: null })}
              >
                Publish Changes
              </button>
              <button
                type="button"
                className="btn-danger disabled:opacity-40"
                disabled={!state.hasUnpublishedChanges}
                onClick={() => setConfirm({ kind: "discard", card: null })}
              >
                Cancel Changes
              </button>
            </div>
          </div>

          {deletedLinks.length > 0 && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] leading-relaxed text-amber-800">
              <ShieldIcon width={14} height={14} className="mt-0.5 shrink-0 text-amber-600" />
              <span>
                <strong className="font-semibold text-amber-900">
                  {deletedLinks.length} store card{deletedLinks.length === 1 ? " is" : "s are"} linked
                  to a deleted rank
                </strong>{" "}
                and {deletedLinks.length === 1 ? "stays" : "stay"} hidden from /store. Edit the card to
                choose another active rank, or delete the card.
              </span>
            </div>
          )}

          <div className="panel mt-5 overflow-hidden">
            {ordered.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-14 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-aqua-200 bg-aqua-50 text-navy-500">
                  <StoreIcon width={18} height={18} />
                </span>
                <h3 className="mt-4 font-display text-base font-semibold text-navy-900">
                  No store cards in the draft
                </h3>
                <p className="mt-1.5 max-w-sm text-sm text-navy-500">
                  Add a rank, key or coin pack above, then publish when you are ready.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-aqua-100">
                {ordered.map((card, index) => {
                  const rankGone =
                    card.category === "rank" && (!card.rank || Boolean(card.rank.deletedAt));
                  const syncNeeded =
                    card.category === "rank" &&
                    Boolean(card.rank) &&
                    !card.rank?.deletedAt &&
                    card.rank?.color.toLowerCase() !== card.color.toLowerCase();
                  const group = ordered.filter((item) => item.category === card.category);
                  const groupIndex = group.findIndex((item) => item.id === card.id);
                  const salePreview = toPublicStoreRank(card, state.promotion);
                  return (
                    <li
                      key={card.id}
                      draggable
                      onDragStart={() => setDragIndex(index)}
                      onDragEnd={() => setDragIndex(null)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => dropOn(card)}
                      data-store-row={card.id}
                      className={`flex flex-wrap items-start gap-3 px-4 py-3.5 transition-colors sm:flex-nowrap sm:items-center sm:px-5 ${
                        dragIndex === index ? "bg-aqua-50" : card.enabled ? "" : "opacity-70"
                      }`}
                    >
                      <span className="flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg border border-aqua-100 bg-white text-navy-400">
                        <MenuIcon width={15} height={15} />
                      </span>
                      <span className="w-6 shrink-0 text-center font-mono text-[11px] text-navy-400">
                        {index + 1}
                      </span>
                      <span
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[10px] font-extrabold text-white"
                        style={{
                          background:
                            card.design === "rainbow"
                              ? "linear-gradient(90deg,#ff0044,#ff7a00,#ffe600,#2bff88,#00e5ff,#6a5cff,#ff2bd6)"
                              : card.style === "gradient"
                                ? `linear-gradient(135deg, ${card.gradientFrom}, ${card.gradientTo})`
                                : card.color,
                        }}
                      >
                        {card.category === "key" ? (
                          <KeyIcon width={16} height={16} />
                        ) : card.category === "coin" ? (
                          <CoinIcon width={16} height={16} />
                        ) : (
                          card.name.slice(0, 2).toUpperCase()
                        )}
                      </span>
                      <span className="min-w-0 flex-1 basis-44">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold text-navy-900">
                            {card.name}
                          </span>
                          <span className="badge border-aqua-200 bg-aqua-50 text-navy-500">
                            {STORE_CATEGORY_SINGULAR[card.category]}
                          </span>
                          <span className="text-[11px] font-mono text-navy-400">
                            {card.free ? "FREE" : formatStorePrice(card.priceCents)}
                          </span>
                          {salePreview.discountPercent > 0 && (
                            <span className="badge border-red-200 bg-red-50 text-red-700">
                              Sale {formatStorePrice(salePreview.finalPriceCents)}
                            </span>
                          )}
                          {!card.enabled && (
                            <span className="badge border-navy-200 bg-navy-100 text-navy-600">
                              Hidden
                            </span>
                          )}
                          {rankGone && (
                            <span className="badge border-red-200 bg-red-50 text-red-600">
                              Rank deleted
                            </span>
                          )}
                          {syncNeeded && (
                            <span className="badge border-amber-200 bg-amber-50 text-amber-800">
                              Colour out of sync
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-navy-400">
                          <span
                            className="inline-block h-2 w-2 rounded-full ring-1 ring-black/10"
                            style={{ backgroundColor: card.color }}
                          />
                          <span className="truncate">
                            {card.category !== "rank"
                              ? STORE_CATEGORY_LABELS[card.category]
                              : card.rank
                                ? `Linked to “${card.rank.name}”`
                                : "No active rank linked"}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {card.category === "rank"
                              ? STORE_DESIGN_LABELS[card.design]
                              : "Promotion eligible"}
                          </span>
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          className="icon-btn disabled:opacity-30"
                          aria-label={`Move ${card.name} up`}
                          disabled={groupIndex === 0}
                          onClick={() => move(card, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="icon-btn disabled:opacity-30"
                          aria-label={`Move ${card.name} down`}
                          disabled={groupIndex === group.length - 1}
                          onClick={() => move(card, 1)}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={card.enabled ? `Disable ${card.name}` : `Enable ${card.name}`}
                          title={card.enabled ? "Hide from /store after publish" : "Show on /store after publish"}
                          disabled={busyId === card.id}
                          onClick={() => void toggleEnabled(card)}
                        >
                          {card.enabled ? (
                            <EyeIcon width={14} height={14} />
                          ) : (
                            <EyeOffIcon width={14} height={14} />
                          )}
                        </button>
                        {card.category === "rank" && (
                          <button
                            type="button"
                            className="icon-btn disabled:opacity-30"
                            aria-label={`Sync ${card.name} colour from its rank`}
                            title={
                              rankGone
                                ? "The linked rank is deleted"
                                : "Copy the rank's current colour into this store card"
                            }
                            disabled={rankGone || !syncNeeded || busyId === card.id}
                            onClick={() => void syncColor(card)}
                          >
                            <RepeatIcon width={14} height={14} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Edit ${card.name}`}
                          onClick={() => setEditor({ card, category: card.category })}
                        >
                          <PencilIcon width={13} height={13} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn hover:border-red-300 hover:text-red-600"
                          aria-label={`Delete ${card.name}`}
                          onClick={() => setConfirm({ kind: "delete", card })}
                        >
                          <TrashIcon width={13} height={13} />
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-navy-400">
              Drag a row or use the arrows, then save the order. The public page follows this order
              exactly.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-ghost !py-2.5 text-xs"
                disabled={!orderChanged || savingOrder}
                onClick={() => setOrder(state ? orderOf(state.ranks) : [])}
              >
                Discard order
              </button>
              <button
                type="button"
                className="btn-primary !py-2.5 text-xs"
                disabled={!orderChanged || savingOrder}
                onClick={() => void saveOrder()}
              >
                {savingOrder ? "Saving…" : "Save Order"}
              </button>
            </div>
          </div>
        </>
      )}

      {editor && state && (
        <StoreEditor
          card={editor.card}
          category={editor.category}
          promotion={state.promotion}
          availableRanks={pickerRanks(editor.card)}
          notify={notify}
          onClose={() => setEditor(null)}
          onSaved={apply}
        />
      )}

      {previewOpen && state && (
        <Modal
          title="Store preview"
          description={
            state.hasUnpublishedChanges
              ? "This preview shows the current draft. Only enabled cards appear publicly after you publish."
              : "This is exactly what visitors currently see on /store."
          }
          onClose={() => setPreviewOpen(false)}
          wide
        >
          <div className="rounded-2xl border border-aqua-200/70 bg-gradient-to-b from-aqua-50/70 to-white/40 p-4 sm:p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-aqua-700">
              Rank store
            </p>
            <p className="mt-1 break-words font-display text-2xl font-extrabold uppercase tracking-tight text-navy-900">
              {previewBrand.leading && <>{previewBrand.leading} </>}
              <span className="text-sun-deep">{previewBrand.accent}</span>
            </p>
            <p className="mt-1 text-xs text-navy-500">
              Choose your rank. Unlock your status. Join the {brandName} community.
            </p>

            {state.promotion.enabled && state.promotion.active && (
              <p className="mt-3 rounded-xl border border-red-200/70 bg-red-50/60 px-3 py-2 text-[11px] text-red-800">
                <strong className="font-semibold">{state.promotion.title}</strong> —{" "}
                {state.promotion.discountPercent}% off keys and coins.{" "}
                {STORE_THEME_LABELS[state.promotion.theme]} theme.
              </p>
            )}

            {previewItems.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-aqua-200 bg-white/60 px-4 py-8 text-center text-xs text-navy-500">
                No enabled store cards. The public page will show its “store is being updated”
                message.
              </p>
            ) : (
              STORE_CATEGORIES.map((category) => {
                const cards = previewItems.filter((card) => card.category === category);
                if (cards.length === 0) return null;
                return (
                  <div key={category} className="mt-4">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-navy-400">
                      {STORE_CATEGORY_LABELS[category]}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {cards.map((card) => (
                        <div
                          key={card.id}
                          className={
                            card.design === "featured" && card.category === "rank"
                              ? "sm:col-span-2"
                              : ""
                          }
                        >
                          <StoreCard compact item={card} />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}

            <div className="mt-4 rounded-xl border border-ember/25 bg-white/70 px-4 py-4 text-center">
              <p className="font-display text-xs font-extrabold uppercase tracking-[0.08em] text-navy-900">
                Choose your rank, key or coin pack. Join the community.
              </p>
              <p className="mt-1 text-[11px] text-navy-400">
                Every purchase is confirmed by staff in Discord — no checkout on the website.
              </p>
            </div>
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
              onClick={() => {
                setPreviewOpen(false);
                setConfirm({ kind: "publish", card: null });
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
          card={confirm.card}
          liveCount={enabledCards.length}
          pending={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={() => void runConfirm()}
        />
      )}
    </div>
  );
}
