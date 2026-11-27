"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_STORE_BRAND_NAME,
  MAX_STORE_BRAND_LENGTH,
  splitStoreBrandName,
} from "@/lib/store-types";
import {
  DEFAULT_RULES_BRAND_NAME,
  MAX_RULES_BRAND_LENGTH,
  splitRulesBrandName,
} from "@/lib/rules-branding-types";
import { DEFAULT_BRAND_NAME } from "@/lib/branding-config";
import {
  apiRequest,
  ErrorNote,
  errorMessage,
  Field,
  PageSectionHeader,
  Spinner,
  type Notify,
} from "./ui";

interface BrandingPayload {
  name: string;
  defaultName: string;
  maxLength: number;
}

interface PageNameConfig {
  id: "store" | "rules";
  title: string;
  description: string;
  fieldLabel: string;
  endpoint: string;
  defaultName: string;
  maxLength: number;
  previewEyebrow: string;
  previewDescription: string;
  split: (value: string) => { leading: string; accent: string };
  successTarget: string;
}

const STORE_CONFIG: PageNameConfig = {
  id: "store",
  title: "Store page name",
  description:
    "Changes the main heading on /store only. The navbar logo, homepage hero logo, server name and every other page stay untouched.",
  fieldLabel: "Store page name",
  endpoint: "/api/owner/store-branding",
  defaultName: DEFAULT_STORE_BRAND_NAME,
  maxLength: MAX_STORE_BRAND_LENGTH,
  previewEyebrow: "RANK STORE",
  previewDescription: "Choose your rank. Unlock your status. Join the {brand} community.",
  split: splitStoreBrandName,
  successTarget: "/store",
};

const RULES_CONFIG: PageNameConfig = {
  id: "rules",
  title: "Rules page name",
  description:
    "Changes the main heading on /rules only and never affects the Store name. The navbar logo, homepage hero logo, server name and every other page stay untouched.",
  fieldLabel: "Rules page name",
  endpoint: "/api/owner/rules-branding",
  defaultName: DEFAULT_RULES_BRAND_NAME,
  maxLength: MAX_RULES_BRAND_LENGTH,
  previewEyebrow: "{brandUpper} COMMUNITY",
  previewDescription: "Play fair. Respect everyone. Make every adventure count.",
  split: splitRulesBrandName,
  successTarget: "/rules",
};

function PageNamePanel({
  config,
  notify,
  brandName,
}: {
  config: PageNameConfig;
  notify: Notify;
  brandName: string;
}) {
  const [branding, setBranding] = useState<BrandingPayload | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await apiRequest<BrandingPayload>(config.endpoint);
      setBranding(data);
      setDraft(data.name);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [config.endpoint]);

  useEffect(() => {
    void load();
  }, [load]);

  const normalized = draft.replace(/\s+/g, " ").trim();
  const maxLength = branding?.maxLength ?? config.maxLength;
  const defaultName = branding?.defaultName || config.defaultName;
  const valid = normalized.length >= 2 && normalized.length <= maxLength;
  const dirty = Boolean(branding) && normalized !== branding?.name;
  const previewName = normalized || branding?.name || defaultName;
  const preview = config.split(previewName);
  const brandValues = { brand: brandName, brandUpper: brandName.toUpperCase() };
  const withBrand = (text: string) =>
    text.replace(/\{(brand|brandUpper)\}/g, (match, token: keyof typeof brandValues) =>
      brandValues[token] ?? match,
    );
  const id = `${config.id}-page-name`;

  async function save(restore: boolean) {
    if (saving || (!restore && !valid)) return;
    setSaving(true);
    setError("");
    try {
      const data = await apiRequest<BrandingPayload>(config.endpoint, {
        method: "PUT",
        body: restore ? { restore: true } : { name: normalized },
      });
      setBranding(data);
      setDraft(data.name);
      notify(
        restore
          ? `${config.title} restored to “${data.name}”.`
          : `${config.title} saved. ${config.successTarget} now shows “${data.name}”.`,
      );
    } catch (err) {
      setError(errorMessage(err));
      notify(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel overflow-hidden border-sun/20" aria-labelledby={`${id}-title`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-aqua-200/70 bg-gradient-to-r from-sun/[0.08] via-transparent to-transparent px-5 py-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-sun-deep">
            {config.fieldLabel}
          </p>
          <h2 id={`${id}-title`} className="mt-1 font-display text-base font-bold text-navy-900">
            {config.title}
          </h2>
          <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-navy-500">
            {config.description}
          </p>
        </div>
        <span className="badge border-sun/30 bg-sun/10 text-sun-deep">Owner only</span>
      </div>

      <div className="grid gap-5 p-5 md:grid-cols-[1fr_1fr]">
        <div>
          {!branding && !error ? (
            <div className="py-6">
              <Spinner label={`Loading ${config.title.toLowerCase()}…`} />
            </div>
          ) : (
            <>
              <Field
                label={config.fieldLabel}
                htmlFor={id}
                hint={`2–${maxLength} characters. Saved independently in Neon PostgreSQL. The final word keeps the orange accent.`}
              >
                <input
                  id={id}
                  type="text"
                  className="input"
                  value={draft}
                  maxLength={maxLength}
                  disabled={!branding || saving}
                  placeholder={defaultName}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    if (error) setError("");
                  }}
                />
              </Field>
              <div className="mt-1.5 flex items-center justify-between text-[10px] font-medium text-navy-400">
                <span>{branding ? "Saved in Neon PostgreSQL" : "Not loaded"}</span>
                <span>
                  {normalized.length}/{maxLength}
                </span>
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
                    (branding.name === defaultName && normalized === branding.name)
                  }
                  onClick={() => void save(true)}
                >
                  Restore Default
                </button>
              </div>
              <p className="mt-3 text-[10px] leading-relaxed text-navy-400">
                Default: {defaultName}
              </p>
            </>
          )}
        </div>

        <div className="rounded-xl border border-aqua-200/70 bg-gradient-to-br from-aqua-50/70 via-white/40 to-sun/[0.06] p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-navy-400">
              Live preview
            </p>
            <span className="text-[10px] font-medium text-navy-400">
              {config.successTarget} heading
            </span>
          </div>
          <div className="mt-3 rounded-lg border border-aqua-200/60 bg-white/50 px-4 py-4">
            <p className="eyebrow flex items-center gap-2">
              <span className="h-px w-6 bg-sun/80" />
              {withBrand(config.previewEyebrow)}
            </p>
            <p className="mt-2 break-words font-display text-2xl font-extrabold uppercase leading-tight tracking-tight text-navy-900">
              {preview.leading && <>{preview.leading} </>}
              <span className="text-sun-deep">{preview.accent}</span>
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-navy-500">
              {withBrand(config.previewDescription)}
            </p>
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-navy-400">
            Preview updates as you type. Save Changes to publish it on {config.successTarget}.
          </p>
        </div>
      </div>
    </section>
  );
}

export function PageNamesTab({
  notify,
  brandName = DEFAULT_BRAND_NAME,
}: {
  notify: Notify;
  brandName?: string;
}) {
  return (
    <div>
      <PageSectionHeader
        title="Page names"
        description="Edit the public Store and Rules headings. Each name is stored separately, so changing one never affects the other."
      />
      <div className="mt-5 space-y-5">
        <PageNamePanel config={STORE_CONFIG} notify={notify} brandName={brandName} />
        <PageNamePanel config={RULES_CONFIG} notify={notify} brandName={brandName} />
      </div>
    </div>
  );
}
