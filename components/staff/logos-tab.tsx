"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, ImageIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { DEFAULT_LOGO_SRC } from "@/components/logo";
import {
  apiRequest,
  ConfirmDialog,
  ErrorNote,
  errorMessage,
  PageSectionHeader,
  Spinner,
  type Notify,
} from "./ui";

type LogoSlot = "navbar" | "hero";

interface LogoRecord {
  id: number;
  label: string;
  mime: string;
  sizeBytes: number;
  storage: "postgres" | "vercel";
  url: string | null;
  createdAt: string;
  usedInNavbar: boolean;
  usedInHero: boolean;
}

const MAX_BYTES = 2 * 1024 * 1024;
const CHECKERBOARD =
  "bg-[linear-gradient(45deg,#f5fbfe_25%,transparent_25%,transparent_75%,#f5fbfe_75%),linear-gradient(45deg,#f5fbfe_25%,transparent_25%,transparent_75%,#f5fbfe_75%)] bg-[length:18px_18px] bg-[position:0_0,9px_9px]";

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function useFilePreview(file: File | null): string {
  const [preview, setPreview] = useState("");

  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return preview;
}

function SlotCard({
  slot,
  title,
  description,
  current,
  brandName,
  notify,
  onLogos,
}: {
  slot: LogoSlot;
  title: string;
  description: string;
  current: LogoRecord | null;
  brandName: string;
  notify: Notify;
  onLogos: (logos: LogoRecord[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const preview = useFilePreview(file);
  const position = slot === "navbar" ? "navbar" : "homepage hero";
  const busy = pending || restoring;

  function clearFile() {
    setFile(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  function pickFile(next: File | null) {
    setError("");
    if (next && next.size > MAX_BYTES) {
      setError("Logos must be 2 MB or smaller.");
      clearFile();
      return;
    }
    setFile(next);
    if (next && !label) setLabel(next.name.replace(/\.[^.]+$/, ""));
  }

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || busy) return;

    setPending(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("label", label);
      form.append("slot", slot);

      const res = await fetch("/api/owner/logos", { method: "POST", body: form });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      const data = (await res.json().catch(() => null)) as
        | { logos?: LogoRecord[]; error?: string }
        | null;
      if (!res.ok) throw new Error(data?.error ?? `The ${position} logo could not be saved.`);

      if (data?.logos) onLogos(data.logos);
      clearFile();
      setLabel("");
      notify(`The ${position} logo was saved.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function restoreDefault() {
    if (busy) return;
    setRestoring(true);
    setError("");
    try {
      const data = await apiRequest<{ logos: LogoRecord[] }>("/api/owner/logos", {
        method: "PATCH",
        body: { slot, activeId: null },
      });
      onLogos(data.logos);
      notify(`Default ${position} logo restored.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRestoring(false);
    }
  }

  return (
    <section className="panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-sm font-semibold text-navy-900">{title}</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-navy-400">{description}</p>
        </div>
        <span
          className={`badge shrink-0 ${
            current
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-aqua-100 bg-aqua-50 text-navy-400"
          }`}
        >
          {current && <CheckIcon width={12} height={12} />}
          {current ? "Custom" : "Default"}
        </span>
      </div>

      <div
        className={`mt-4 flex min-h-[132px] items-center justify-center rounded-xl border border-aqua-100 p-5 ${CHECKERBOARD}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current?.url ?? DEFAULT_LOGO_SRC}
          alt={current ? current.label : `Default ${position} logo`}
          className={
            slot === "navbar"
              ? "max-h-16 w-auto max-w-full object-contain"
              : "max-h-28 w-auto max-w-full object-contain"
          }
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-navy-400">
        <span className="truncate">
          {current ? current.label : `Default ${brandName} logo`}
        </span>
        {current && <span className="shrink-0 font-mono">{formatSize(current.sizeBytes)}</span>}
      </div>

      <div className="my-5 h-px bg-aqua-100" />

      <form onSubmit={upload}>
        <p className="text-xs font-semibold text-navy-700">Upload a replacement</p>
        <p className="mt-1 text-[11px] text-navy-400">
          PNG, JPG, JPEG, SVG or WebP · up to 2 MB. Preview it before saving.
        </p>

        <label
          htmlFor={`logo-file-${slot}`}
          className="mt-3 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-aqua-200 bg-aqua-50/40 px-4 py-6 text-center transition-colors hover:border-aqua-300 hover:bg-aqua-50/70"
        >
          {preview ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Selected logo preview"
                className={
                  slot === "navbar"
                    ? "max-h-16 w-auto max-w-full object-contain"
                    : "max-h-24 w-auto max-w-[260px] object-contain"
                }
              />
              <span className="text-[11px] text-navy-500">
                {file?.name} · {file ? formatSize(file.size) : ""}
              </span>
            </>
          ) : (
            <>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-aqua-200 bg-white text-aqua-700">
                <ImageIcon width={20} height={20} />
              </span>
              <span className="text-xs font-semibold text-navy-600">
                Choose a {position} logo from your computer
              </span>
              <span className="text-[11px] text-navy-400">
                Square marks and wide wordmarks both work.
              </span>
            </>
          )}
          <input
            id={`logo-file-${slot}`}
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml,.jpg,.jpeg"
            className="sr-only"
            onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
          />
        </label>

        <label htmlFor={`logo-label-${slot}`} className="label mt-4">
          Logo name
        </label>
        <input
          id={`logo-label-${slot}`}
          className="input"
          maxLength={60}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder={slot === "navbar" ? "e.g. Navbar mark 2026" : "e.g. Hero logo 2026"}
        />

        {error && (
          <div className="mt-4">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          {file && (
            <button
              type="button"
              className="btn-ghost !py-2.5 text-xs"
              onClick={clearFile}
              disabled={busy}
            >
              Clear
            </button>
          )}
          <button
            type="submit"
            disabled={!file || busy}
            className="btn-primary !py-2.5 text-xs"
          >
            <PlusIcon width={14} height={14} />
            {pending
              ? "Saving…"
              : `Save ${slot === "navbar" ? "navbar" : "hero"} logo`}
          </button>
        </div>
      </form>

      <button
        type="button"
        onClick={restoreDefault}
        disabled={!current || busy}
        className="btn-subtle mt-3 w-full !py-2.5 text-xs disabled:pointer-events-none disabled:opacity-40"
      >
        {restoring
          ? "Restoring…"
          : `Restore default ${slot === "navbar" ? "navbar" : "hero"} logo`}
      </button>
    </section>
  );
}

export function LogosTab({
  notify,
  brandName = "DemonMC",
}: {
  notify: Notify;
  brandName?: string;
}) {
  const router = useRouter();
  const [logos, setLogos] = useState<LogoRecord[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [removing, setRemoving] = useState<LogoRecord | null>(null);

  const load = useCallback(async () => {
    try {
      setLoadError("");
      const data = await apiRequest<{ logos: LogoRecord[] }>("/api/owner/logos");
      setLogos(data.logos);
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const applyLogos = useCallback(
    (next: LogoRecord[]) => {
      setLogos(next);
      router.refresh();
    },
    [router],
  );

  const navbarLogo = logos?.find((logo) => logo.usedInNavbar) ?? null;
  const heroLogo = logos?.find((logo) => logo.usedInHero) ?? null;

  async function assign(logo: LogoRecord, slot: LogoSlot) {
    setBusy(`${slot}-${logo.id}`);
    try {
      const data = await apiRequest<{ logos: LogoRecord[] }>("/api/owner/logos", {
        method: "PATCH",
        body: { slot, activeId: logo.id },
      });
      applyLogos(data.logos);
      notify(
        `“${logo.label}” is now the ${slot === "navbar" ? "navbar" : "homepage hero"} logo.`,
      );
    } catch (err) {
      notify(errorMessage(err), "error");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!removing) return;
    if (removing.usedInNavbar || removing.usedInHero) {
      notify("Choose another logo for both positions before deleting this one.", "error");
      setRemoving(null);
      return;
    }

    setBusy(`delete-${removing.id}`);
    try {
      const data = await apiRequest<{ logos: LogoRecord[] }>(
        `/api/owner/logos/${removing.id}`,
        { method: "DELETE" },
      );
      applyLogos(data.logos);
      notify("Logo removed from the library.");
      setRemoving(null);
    } catch (err) {
      notify(errorMessage(err), "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageSectionHeader
        title="Logo management"
        description="The navbar and homepage hero logos are managed separately. Changing one never changes the other."
      />

      {loadError && (
        <div className="mt-5">
          <ErrorNote>{loadError}</ErrorNote>
        </div>
      )}

      {!logos ? (
        <div className="panel mt-5 px-6 py-14">
          <Spinner label="Loading logo settings" />
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <SlotCard
              slot="navbar"
              title="Navbar logo management"
              description="Small logo in the header, plus sign-in pages, dashboards and the footer. It never changes the homepage hero logo."
              current={navbarLogo}
              brandName={brandName}
              notify={notify}
              onLogos={applyLogos}
            />
            <SlotCard
              slot="hero"
              title="Homepage hero logo management"
              description="Large centered logo on the homepage. It can be a completely different image and never changes the navbar logo."
              current={heroLogo}
              brandName={brandName}
              notify={notify}
              onLogos={applyLogos}
            />
          </div>

          <section className="mt-6">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h3 className="font-display text-sm font-semibold text-navy-900">Logo library</h3>
                <p className="mt-1 text-[11px] text-navy-400">
                  Every saved logo stays here. Select any logo for either position independently.
                  Logos used in the navbar or hero cannot be deleted.
                </p>
              </div>
              <span className="shrink-0 text-[11px] text-navy-400">{logos.length} saved</span>
            </div>

            {logos.length === 0 ? (
              <div className="panel mt-4 flex flex-col items-center px-6 py-12 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-aqua-100 bg-aqua-50 text-aqua-600">
                  <ImageIcon width={20} height={20} />
                </span>
                <p className="mt-3 font-display text-sm font-semibold text-navy-900">
                  No saved logos yet
                </p>
                <p className="mt-1 text-xs text-navy-500">
                  The default {brandName} logo stays in both positions until you upload a replacement.
                </p>
              </div>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {logos.map((logo) => (
                  <article key={logo.id} className="panel flex flex-col overflow-hidden">
                    <div className="flex min-h-[110px] items-center justify-center border-b border-aqua-100 bg-white/60 p-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={logo.url ?? DEFAULT_LOGO_SRC}
                        alt={logo.label}
                        className="max-h-20 w-auto max-w-full object-contain"
                      />
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      <p className="min-w-0 truncate text-xs font-semibold text-navy-900">
                        {logo.label}
                      </p>
                      <p className="mt-1 font-mono text-[10px] text-navy-400">
                        {formatSize(logo.sizeBytes)} ·{" "}
                        {logo.storage === "vercel" ? "Cloud storage" : "Neon storage"}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {logo.usedInNavbar && (
                          <span className="badge border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700">
                            Navbar
                          </span>
                        )}
                        {logo.usedInHero && (
                          <span className="badge border-sun/40 bg-sun/10 text-[10px] text-sun-deep">
                            Hero
                          </span>
                        )}
                        {!logo.usedInNavbar && !logo.usedInHero && (
                          <span className="badge border-aqua-100 bg-aqua-50 text-[10px] text-navy-400">
                            Unused
                          </span>
                        )}
                      </div>

                      <div className="mt-4 flex gap-2 pt-0">
                        <button
                          type="button"
                          onClick={() => assign(logo, "navbar")}
                          disabled={logo.usedInNavbar || busy !== null}
                          className="btn-subtle min-w-0 flex-1 !px-2 !py-2 text-[10px] disabled:pointer-events-none disabled:opacity-40"
                        >
                          {busy === `navbar-${logo.id}` ? "Saving…" : "Use in navbar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => assign(logo, "hero")}
                          disabled={logo.usedInHero || busy !== null}
                          className="btn-subtle min-w-0 flex-1 !px-2 !py-2 text-[10px] disabled:pointer-events-none disabled:opacity-40"
                        >
                          {busy === `hero-${logo.id}` ? "Saving…" : "Use in hero"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRemoving(logo)}
                          disabled={logo.usedInNavbar || logo.usedInHero || busy !== null}
                          aria-label={`Delete ${logo.label}`}
                          title={
                            logo.usedInNavbar || logo.usedInHero
                              ? "This logo is in use. Choose another logo for both positions first."
                              : `Delete ${logo.label}`
                          }
                          className="icon-btn shrink-0 disabled:pointer-events-none disabled:opacity-30"
                        >
                          <TrashIcon width={14} height={14} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {removing && (
        <ConfirmDialog
          title="Delete logo"
          message={`Remove “${removing.label}” from the library? This cannot be undone.`}
          confirmLabel="Delete logo"
          pending={busy === `delete-${removing.id}`}
          onCancel={() => setRemoving(null)}
          onConfirm={remove}
        />
      )}
    </div>
  );
}
