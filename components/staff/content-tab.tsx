"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EyeIcon, SettingsIcon, TypeIcon } from "@/components/icons";
import {
  apiRequest,
  ConfirmDialog,
  ErrorNote,
  errorMessage,
  Modal,
  PageSectionHeader,
  Spinner,
  type Notify,
} from "./ui";

interface EditorField {
  key: string;
  label: string;
  max: number;
  multiline: boolean;
  settingsField: string | null;
  value: string;
  defaultValue: string;
}

interface EditorSection {
  id: string;
  label: string;
  fields: EditorField[];
}

interface EditorPage {
  id: string;
  label: string;
  description: string;
  sections: EditorSection[];
}

export function ContentTab({
  notify,
  brandName = "DemonMC",
}: {
  notify: Notify;
  brandName?: string;
}) {
  const router = useRouter();
  const [pages, setPages] = useState<EditorPage[] | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [initial, setInitial] = useState<Record<string, string>>({});
  const [pageId, setPageId] = useState("home");
  const [sectionId, setSectionId] = useState("hero");
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [preview, setPreview] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const hydrate = useCallback((nextPages: EditorPage[]) => {
    const nextValues: Record<string, string> = {};
    for (const page of nextPages) {
      for (const section of page.sections) {
        for (const field of section.fields) nextValues[field.key] = field.value;
      }
    }
    setPages(nextPages);
    setValues(nextValues);
    setInitial(nextValues);
  }, []);

  const load = useCallback(async () => {
    try {
      setLoadError("");
      const data = await apiRequest<{ pages: EditorPage[] }>("/api/owner/content");
      hydrate(data.pages);
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }, [hydrate]);

  useEffect(() => {
    void load();
  }, [load]);

  const activePage = pages?.find((page) => page.id === pageId) ?? pages?.[0] ?? null;
  const activeSection =
    activePage?.sections.find((section) => section.id === sectionId) ?? activePage?.sections[0] ?? null;

  const dirtyKeys = useMemo(
    () => Object.keys(values).filter((key) => values[key] !== initial[key]),
    [values, initial],
  );

  const pageKeys = useMemo(
    () => activePage?.sections.flatMap((section) => section.fields.map((field) => field.key)) ?? [],
    [activePage],
  );

  function setValue(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    if (error) setError("");
  }

  async function save() {
    if (dirtyKeys.length === 0) {
      setError("Change at least one field before saving.");
      return;
    }

    setError("");
    setPending(true);
    try {
      const payload: Record<string, string> = {};
      for (const key of dirtyKeys) payload[key] = values[key];
      await apiRequest("/api/owner/content", { method: "PATCH", body: { values: payload } });
      setInitial((current) => {
        const next = { ...current };
        for (const key of dirtyKeys) next[key] = values[key];
        return next;
      });
      notify(`${dirtyKeys.length} content ${dirtyKeys.length === 1 ? "field" : "fields"} saved.`);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function resetPage() {
    if (!activePage) return;
    setPending(true);
    try {
      await apiRequest("/api/owner/content", { method: "POST", body: { keys: pageKeys } });
      setResetOpen(false);
      await load();
      notify(`${activePage.label} restored to the default text.`);
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
          title="Website content"
          description={`Edit the visible text across the ${brandName} site.`}
        />
        <div className="mt-5">
          <ErrorNote>{loadError}</ErrorNote>
        </div>
      </div>
    );
  }

  if (!pages || !activePage) {
    return (
      <div className="panel px-6 py-16">
        <Spinner label="Loading website content" />
      </div>
    );
  }

  return (
    <div>
      <PageSectionHeader
        title="Website content"
        description="Select a page and section, edit the copy, then save. Changes go live immediately and are stored in Neon."
        action={
          <span className="badge border-aqua-200 bg-aqua-50 text-aqua-700">
            <TypeIcon width={12} height={12} />
            {dirtyKeys.length > 0 ? `${dirtyKeys.length} unsaved` : "Up to date"}
          </span>
        }
      />

      <div className="no-scrollbar mt-5 flex gap-1.5 overflow-x-auto pb-1">
        {pages.map((page) => (
          <button
            key={page.id}
            type="button"
            onClick={() => {
              setPageId(page.id);
              setSectionId(page.sections[0]?.id ?? "");
              setError("");
            }}
            className={`shrink-0 rounded-lg px-3 py-2 text-[11px] font-semibold transition-colors ${
              page.id === activePage.id
                ? "bg-aqua-100 text-navy-900"
                : "text-navy-500 hover:bg-aqua-50 hover:text-navy-800"
            }`}
          >
            {page.label}
          </button>
        ))}
      </div>

      <div className="mt-3">
        <h3 className="font-display text-sm font-semibold text-navy-900">{activePage.label}</h3>
        <p className="mt-0.5 text-[11px] text-navy-400">{activePage.description}</p>
      </div>

      <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto pb-1">
        {activePage.sections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => {
              setSectionId(section.id);
              setError("");
            }}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
              section.id === activeSection?.id
                ? "border-ember/30 bg-ember/10 text-navy-900"
                : "border-aqua-200 bg-white/70 text-navy-500 hover:border-aqua-300 hover:text-navy-800"
            }`}
          >
            {section.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <form
          className="panel p-5"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="space-y-4">
            {activeSection?.fields.map((field) => {
              const value = values[field.key] ?? "";
              const changed = value !== initial[field.key];
              return (
                <div key={field.key}>
                  <div className="flex items-baseline justify-between gap-3">
                    <label htmlFor={`content-${field.key}`} className="label">
                      {field.label}
                      {changed && (
                        <span className="ml-2 text-[10px] font-normal text-sun-deep">edited</span>
                      )}
                    </label>
                    <span className="font-mono text-[10px] text-navy-300">
                      {value.length}/{field.max}
                    </span>
                  </div>
                  {field.multiline ? (
                    <textarea
                      id={`content-${field.key}`}
                      className="input min-h-[90px] resize-y leading-relaxed"
                      maxLength={field.max}
                      value={value}
                      onChange={(event) => setValue(field.key, event.target.value)}
                    />
                  ) : (
                    <input
                      id={`content-${field.key}`}
                      className="input"
                      maxLength={field.max}
                      value={value}
                      onChange={(event) => setValue(field.key, event.target.value)}
                    />
                  )}
                  <p className="mt-1 text-[10px] leading-relaxed text-navy-300">
                    Line breaks are preserved. Default: “{field.defaultValue}”
                  </p>
                </div>
              );
            })}
          </div>

          {error && (
            <div className="mt-4">
              <ErrorNote>{error}</ErrorNote>
            </div>
          )}

          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setResetOpen(true)}
              className="btn-subtle !py-2.5 text-xs"
              disabled={pending}
            >
              <SettingsIcon width={13} height={13} />
              Reset this page
            </button>
            <button
              type="button"
              onClick={() => setPreview(true)}
              className="btn-ghost !py-2.5 text-xs"
            >
              <EyeIcon width={13} height={13} />
              Preview changes
            </button>
            <button type="submit" disabled={pending} className="btn-primary !py-2.5 text-xs">
              {pending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>

        <aside className="panel h-fit p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-navy-400">
            {activePage.label}
          </p>
          <h3 className="mt-1 font-display text-base font-bold text-navy-900">
            {activeSection?.label}
          </h3>
          <div className="mt-4 space-y-4">
            {activeSection?.fields.slice(0, 4).map((field) => (
              <div key={field.key}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-navy-300">
                  {field.label}
                </p>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-navy-600">
                  {values[field.key] || "—"}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-5 border-t border-aqua-100 pt-4 text-[11px] leading-relaxed text-navy-400">
            The content editor only changes visible copy. It never touches accounts, permissions,
            API security or application code.
          </p>
        </aside>
      </div>

      {preview && (
        <Modal
          title="Preview changes"
          description={`${activePage.label} · ${activeSection?.label ?? ""} (draft text)`}
          onClose={() => setPreview(false)}
          wide
        >
          <div className="space-y-5">
            {activeSection?.fields.map((field) => (
              <div key={field.key}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-navy-400">
                  {field.label}
                </p>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-navy-800">
                  {values[field.key] || "—"}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className="btn-ghost !py-2.5 text-xs" onClick={() => setPreview(false)}>
              Close
            </button>
            <button
              type="button"
              className="btn-primary !py-2.5 text-xs"
              onClick={() => {
                setPreview(false);
                void save();
              }}
              disabled={pending || dirtyKeys.length === 0}
            >
              Save changes
            </button>
          </div>
        </Modal>
      )}

      {resetOpen && (
        <ConfirmDialog
          title="Reset page to default"
          message={`Restore every field on “${activePage.label}” to the built-in ${brandName} copy? Your saved edits for this page will be removed.`}
          confirmLabel="Reset page"
          pending={pending}
          onCancel={() => setResetOpen(false)}
          onConfirm={resetPage}
        />
      )}
    </div>
  );
}
