"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { BrandingEditor, BrandingState, BrandingInput } from "@/lib/branding";
import {
  DEFAULT_BRAND_NAME,
  MAX_BRAND_DESCRIPTION_LENGTH,
  MAX_BRAND_NAME_LENGTH,
  MAX_BRAND_TITLE_LENGTH,
} from "@/lib/branding-config";
import { BrandLogo, Wordmark } from "@/components/logo";
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

type Draft = BrandingInput;

function fromEditor(editor: BrandingEditor): Draft {
  return {
    name: editor.name,
    siteTitle: editor.rawSiteTitle,
    metaDescription: editor.rawMetaDescription,
    navbar: editor.rawOverrides.navbar,
    hero: editor.rawOverrides.hero,
    login: editor.rawOverrides.login,
    footer: editor.rawOverrides.footer,
  };
}

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function sameDraft(a: Draft, b: Draft): boolean {
  return (Object.keys(a) as Array<keyof Draft>).every((key) => normalize(a[key]) === normalize(b[key]));
}

function effective(value: string, name: string): string {
  const trimmed = normalize(value);
  return trimmed.length >= 2 ? trimmed : name;
}

function tokensFor(draft: Draft) {
  const name = normalize(draft.name) || DEFAULT_BRAND_NAME;
  return {
    brand: name,
    brandUpper: name.toUpperCase(),
    brandNavbar: effective(draft.navbar, name),
    brandHero: effective(draft.hero, name),
    brandLogin: effective(draft.login, name),
    brandFooter: effective(draft.footer, name),
  };
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, token: string) =>
    Object.prototype.hasOwnProperty.call(values, token) ? values[token] : match,
  );
}

const INHERIT_FIELDS = [
  {
    key: "navbar",
    label: "Navbar brand name",
    hint: "Shown in the public site header. Leave empty to inherit the main brand name.",
  },
  {
    key: "hero",
    label: "Homepage hero brand name",
    hint: "Shown in the homepage hero. Leave empty to inherit the main brand name.",
  },
  {
    key: "login",
    label: "Login & registration brand name",
    hint: "Used on sign-in, registration and password pages. Leave empty to inherit.",
  },
  {
    key: "footer",
    label: "Footer brand name",
    hint: "Used in the footer copyright and sign-in footers. Leave empty to inherit.",
  },
] as const;

export function BrandingTab({ notify }: { notify: Notify }) {
  const router = useRouter();
  const [published, setPublished] = useState<BrandingEditor | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [baseline, setBaseline] = useState<Draft | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [editing, setEditing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoadError("");
      const data = await apiRequest<BrandingState>("/api/owner/branding");
      setPublished(data.published);
      setDraft(fromEditor(data.draft));
      setBaseline(fromEditor(data.draft));
      setHasDraft(data.hasDraft);
      setEditing(false);
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const clean = useMemo<Draft | null>(() => {
    if (!draft) return null;
    return {
      name: normalize(draft.name),
      siteTitle: normalize(draft.siteTitle),
      metaDescription: normalize(draft.metaDescription),
      navbar: normalize(draft.navbar),
      hero: normalize(draft.hero),
      login: normalize(draft.login),
      footer: normalize(draft.footer),
    };
  }, [draft]);

  const valid = Boolean(
    clean &&
      clean.name.length >= 2 &&
      clean.name.length <= MAX_BRAND_NAME_LENGTH &&
      clean.siteTitle.length >= 2 &&
      clean.siteTitle.length <= MAX_BRAND_TITLE_LENGTH &&
      clean.metaDescription.length >= 2 &&
      clean.metaDescription.length <= MAX_BRAND_DESCRIPTION_LENGTH &&
      ["navbar", "hero", "login", "footer"].every(
        (key) => !clean[key as keyof Draft] || clean[key as keyof Draft].length >= 2,
      ),
  );

  const dirty = Boolean(draft && baseline && !sameDraft(draft, baseline));
  const liveName = published?.name ?? DEFAULT_BRAND_NAME;
  const tokens = draft
    ? tokensFor(draft)
    : {
        brand: DEFAULT_BRAND_NAME,
        brandUpper: DEFAULT_BRAND_NAME.toUpperCase(),
        brandNavbar: DEFAULT_BRAND_NAME,
        brandHero: DEFAULT_BRAND_NAME,
        brandLogin: DEFAULT_BRAND_NAME,
        brandFooter: DEFAULT_BRAND_NAME,
      };
  const previewName = tokens.brand;
  const previewNavbar = tokens.brandNavbar;
  const previewHero = tokens.brandHero;
  const previewLogin = tokens.brandLogin;
  const previewFooter = tokens.brandFooter;
  const previewTitle = draft ? fill(draft.siteTitle || "", tokens) : "";

  function update(key: keyof Draft, value: string) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    if (error) setError("");
  }

  async function send(action: "save" | "publish" | "discard") {
    if (!clean || pending) return;
    if (action !== "discard" && !valid) {
      setError("Fix the highlighted branding fields before saving.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const data = await apiRequest<BrandingState>("/api/owner/branding", {
        method: "PUT",
        body: action === "discard" ? { action } : { ...clean, action },
      });
      setPublished(data.published);
      setDraft(fromEditor(data.draft));
      setBaseline(fromEditor(data.draft));
      setHasDraft(data.hasDraft);
      if (action === "save") {
        notify("Branding draft saved. Publish changes to make it live.");
      } else if (action === "publish") {
        setEditing(false);
        notify(`Global branding published for “${data.published.name}”.`);
        router.refresh();
      } else {
        setEditing(false);
        notify("Branding draft discarded.");
        router.refresh();
      }
    } catch (err) {
      setError(errorMessage(err));
      notify(errorMessage(err), "error");
    } finally {
      setPending(false);
    }
  }

  async function reset() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const data = await apiRequest<BrandingState>("/api/owner/branding", {
        method: "PUT",
        body: { restore: true },
      });
      setPublished(data.published);
      setDraft(fromEditor(data.draft));
      setBaseline(fromEditor(data.draft));
      setHasDraft(false);
      setResetOpen(false);
      setEditing(false);
      notify("Global branding restored to the built-in defaults.");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  if (loadError) {
    return (
      <div>
        <PageSectionHeader
          title="Global branding"
          description="Change the network name everywhere it appears."
        />
        <div className="mt-5">
          <ErrorNote>{loadError}</ErrorNote>
        </div>
      </div>
    );
  }

  if (!draft || !published) {
    return (
      <div className="panel px-6 py-16">
        <Spinner label="Loading global branding" />
      </div>
    );
  }

  const disabled = !editing || pending;

  return (
    <div>
      <PageSectionHeader
        title="Global branding"
        description="Rename the network once and publish it across every page. Navbar, hero, login and footer can each keep their own name."
        action={
          <span
            className={`badge ${
              hasDraft
                ? "border-sun/40 bg-sun/10 text-sun-deep"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {hasDraft ? "Draft saved" : "Published"}
          </span>
        }
      />

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <section className="panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-bold text-navy-900">Brand settings</h3>
              <p className="mt-0.5 text-[11px] leading-relaxed text-navy-400">
                Live site name: <strong className="text-navy-700">{liveName}</strong>. Store and
                Rules headings keep their own names under Page names.
              </p>
            </div>
            {!editing && (
              <button
                type="button"
                className="btn-subtle !py-2 text-xs"
                onClick={() => setEditing(true)}
                disabled={pending}
              >
                Edit branding
              </button>
            )}
          </div>

          <div className="mt-5 space-y-4">
            <Field
              label="Brand name"
              htmlFor="brand-name"
              hint="Master name. 2–40 characters. Areas without their own override use this name."
            >
              <input
                id="brand-name"
                className="input"
                value={draft.name}
                maxLength={MAX_BRAND_NAME_LENGTH}
                disabled={disabled}
                onChange={(event) => update("name", event.target.value)}
                placeholder={DEFAULT_BRAND_NAME}
              />
            </Field>

            <Field
              label="Website title (browser tab & search)"
              htmlFor="brand-site-title"
              hint="Use {brand} to insert the master name automatically."
            >
              <input
                id="brand-site-title"
                className="input"
                value={draft.siteTitle}
                maxLength={MAX_BRAND_TITLE_LENGTH}
                disabled={disabled}
                onChange={(event) => update("siteTitle", event.target.value)}
              />
            </Field>

            <Field
              label="Meta description"
              htmlFor="brand-meta-description"
              hint="Search result summary. Supports {brand} and {ip}."
            >
              <textarea
                id="brand-meta-description"
                className="input min-h-[76px] resize-y leading-relaxed"
                value={draft.metaDescription}
                maxLength={MAX_BRAND_DESCRIPTION_LENGTH}
                disabled={disabled}
                onChange={(event) => update("metaDescription", event.target.value)}
              />
            </Field>

            <div className="rounded-xl border border-aqua-200/70 bg-aqua-50/40 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-navy-400">
                Independent overrides
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-navy-500">
                Leave a field empty to follow the master brand name. A custom value here changes only
                that location.
              </p>
              <div className="mt-4 space-y-4">
                {INHERIT_FIELDS.map((item) => (
                  <div key={item.key}>
                    <label htmlFor={`brand-${item.key}`} className="label">
                      {item.label}
                    </label>
                    <input
                      id={`brand-${item.key}`}
                      className="input"
                      value={draft[item.key]}
                      maxLength={MAX_BRAND_NAME_LENGTH}
                      disabled={disabled}
                      placeholder={`Inherit: ${normalize(draft.name) || DEFAULT_BRAND_NAME}`}
                      onChange={(event) => update(item.key, event.target.value)}
                    />
                    <p className="mt-1 text-[10px] leading-relaxed text-navy-300">{item.hint}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4">
              <ErrorNote>{error}</ErrorNote>
            </div>
          )}

          {editing && (
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="btn-ghost !py-2.5 text-xs"
                onClick={() => void send("discard")}
                disabled={pending || (!dirty && !hasDraft)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-subtle !py-2.5 text-xs"
                onClick={() => setPreviewOpen(true)}
              >
                Preview changes
              </button>
              <button
                type="button"
                className="btn-subtle !py-2.5 text-xs"
                onClick={() => void send("save")}
                disabled={pending || !valid || !dirty}
              >
                Save draft
              </button>
              <button
                type="button"
                className="btn-primary !py-2.5 text-xs"
                onClick={() => void send("publish")}
                disabled={pending || !valid || (!dirty && !hasDraft)}
              >
                {pending ? "Publishing…" : "Publish changes"}
              </button>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-aqua-100 pt-4">
            <p className="text-[10px] leading-relaxed text-navy-400">
              Every save is written to Neon PostgreSQL and survives refresh, restart and redeploy.
            </p>
            <button
              type="button"
              className="btn-subtle !py-2 text-xs"
              onClick={() => setResetOpen(true)}
              disabled={pending}
            >
              Reset to default
            </button>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="panel overflow-hidden">
            <div className="rounded-t-xl border-b border-aqua-200/60 bg-white/70 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-navy-400">
                Live preview
              </p>
            </div>
            <div className="space-y-4 p-4">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-aqua-200/70 bg-white/60 px-3 py-2">
                <BrandLogo name={previewNavbar} className="h-auto max-w-[160px]" />
                <span className="text-[10px] font-semibold text-navy-400">Navbar</span>
              </div>

              <div className="rounded-xl border border-aqua-200/70 bg-gradient-to-br from-aqua-50/70 via-white/40 to-sun/[0.06] px-4 py-5 text-center">
                <div className="flex justify-center">
                  <BrandLogo name={previewHero} variant="hero" className="h-auto max-w-[240px]" />
                </div>
                <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-navy-400">
                  Homepage hero
                </p>
              </div>

              <div className="rounded-xl border border-aqua-200/70 bg-white/60 px-4 py-4">
                <p className="eyebrow">{previewLogin} Network</p>
                <p className="mt-2 font-display text-base font-bold text-navy-900">
                  Welcome back
                </p>
                <p className="mt-1 text-[11px] text-navy-400">
                  Sign in to your {previewLogin} account.
                </p>
              </div>

              <div className="rounded-xl border border-aqua-200/70 bg-white/60 px-4 py-3 text-center">
                <LogoWordmarkPreview name={previewFooter} />
                <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-navy-400">
                  © {new Date().getFullYear()} {previewFooter}. All rights reserved.
                </p>
              </div>

              <div className="rounded-xl border border-aqua-200/70 bg-aqua-50/50 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-navy-400">
                  Browser tab
                </p>
                <p className="mt-1 truncate text-xs font-semibold text-navy-700">
                  {previewTitle || previewName}
                </p>
              </div>
            </div>
          </div>

          <div className="panel p-5">
            <h3 className="font-display text-sm font-bold text-navy-900">How it connects</h3>
            <ul className="mt-2 space-y-2 text-[11px] leading-relaxed text-navy-500">
              <li>The master name updates navbar, homepage, login, footer and page copy together.</li>
              <li>Navbar, hero, login and footer overrides are independent of each other.</li>
              <li>Store and Rules headings stay in Page names and are never overwritten here.</li>
              <li>Draft changes stay private until you press Publish changes.</li>
            </ul>
          </div>
        </aside>
      </div>

      {previewOpen && (
        <Modal
          title="Preview changes"
          description="Draft branding. Nothing is published until you choose Publish changes."
          onClose={() => setPreviewOpen(false)}
          wide
        >
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-aqua-200/70 bg-white px-4 py-3">
              <BrandLogo name={previewNavbar} className="h-auto max-w-[200px]" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-navy-400">
                Navbar
              </span>
            </div>
            <div className="rounded-xl border border-aqua-200/70 bg-aqua-50/40 px-5 py-8 text-center">
              <div className="flex justify-center">
                <BrandLogo name={previewHero} variant="hero" className="h-auto max-w-[300px]" />
              </div>
              <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.24em] text-navy-400">
                Homepage hero
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-aqua-200/70 bg-white px-4 py-4">
                <p className="eyebrow">{previewLogin} Network</p>
                <p className="mt-2 font-display text-base font-bold text-navy-900">Welcome back</p>
                <p className="mt-1 text-[11px] text-navy-400">
                  Sign in to your {previewLogin} account.
                </p>
              </div>
              <div className="rounded-xl border border-aqua-200/70 bg-white px-4 py-4 text-center">
                <p className="text-sm font-extrabold uppercase tracking-[0.06em] text-navy-900">
                  <Wordmark name={previewFooter} className="text-sm" />
                </p>
                <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-navy-400">
                  © {new Date().getFullYear()} {previewFooter}. All rights reserved.
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-aqua-100 bg-white px-4 py-3 text-xs text-navy-500">
              <span className="font-semibold text-navy-700">Tab title:</span>{" "}
              {previewTitle || previewName}
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className="btn-ghost !py-2.5 text-xs" onClick={() => setPreviewOpen(false)}>
              Close
            </button>
            <button
              type="button"
              className="btn-primary !py-2.5 text-xs"
              disabled={pending || !valid || (!dirty && !hasDraft)}
              onClick={() => {
                setPreviewOpen(false);
                void send("publish");
              }}
            >
              Publish changes
            </button>
          </div>
        </Modal>
      )}

      {resetOpen && (
        <ConfirmDialog
          title="Reset global branding"
          message="Remove every custom brand name, title and override and restore the built-in defaults? This also discards any saved draft."
          confirmLabel="Reset branding"
          pending={pending}
          onCancel={() => setResetOpen(false)}
          onConfirm={reset}
        />
      )}
    </div>
  );
}

function LogoWordmarkPreview({ name }: { name: string }) {
  return <Wordmark name={name} className="text-base" />;
}
