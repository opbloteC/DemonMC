"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRightIcon,
  BugIcon,
  CheckIcon,
  CloseIcon,
  ImageIcon,
  ShieldIcon,
} from "@/components/icons";
import { formatApplicationDate } from "@/components/applications/application-status";
import { apiRequest, ErrorNote, errorMessage, Field } from "@/components/staff/ui";
import {
  REPORT_KIND_META,
  type PendingReportFile,
  type ReportKind,
  type ReportSummary,
} from "@/lib/report-types";

const KIND_ICONS = {
  player: ShieldIcon,
  bug: BugIcon,
} as const;

const MAX_FILES = 3;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 80 * 1024 * 1024;
const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime";

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

type UploadStatus = "uploading" | "ready" | "error";

interface UploadItem {
  id: string;
  file: File;
  previewUrl: string;
  mediaKind: "image" | "video";
  progress: number;
  status: UploadStatus;
  token?: string;
  error?: string;
}

function mediaKindFor(type: string): "image" | "video" | null {
  if (IMAGE_TYPES.has(type)) return "image";
  if (VIDEO_TYPES.has(type)) return "video";
  return null;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function ReportHub({ defaultSubmitter }: { defaultSubmitter: string }) {
  const [kind, setKind] = useState<ReportKind | null>(null);
  const [submitterUsername, setSubmitterUsername] = useState(defaultSubmitter);
  const [reportedUsername, setReportedUsername] = useState("");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<UploadItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState<ReportSummary | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploads = useRef(new Map<string, XMLHttpRequest>());
  const itemsRef = useRef<UploadItem[]>([]);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    const active = uploads.current;
    return () => {
      active.forEach((xhr) => xhr.abort());
      active.clear();
      itemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  function applyFile(file: File): boolean {
    const mediaKind = mediaKindFor(file.type);
    if (!mediaKind) {
      setUploadError("Only PNG, JPEG, WEBP or GIF images and MP4, WEBM or MOV videos are allowed.");
      return false;
    }
    const limit = mediaKind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
    if (file.size > limit) {
      setUploadError(
        mediaKind === "image" ? "Images must be 8 MB or smaller." : "Videos must be 80 MB or smaller.",
      );
      return false;
    }
    return true;
  }

  function startUpload(item: UploadItem) {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/reports/upload");
    xhr.responseType = "json";
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const progress = Math.min(99, Math.round((event.loaded / event.total) * 100));
      setItems((current) =>
        current.map((entry) => (entry.id === item.id ? { ...entry, progress } : entry)),
      );
    };
    xhr.onload = () => {
      uploads.current.delete(item.id);
      const data = xhr.response as { file?: PendingReportFile; error?: string } | null;
      if (xhr.status === 201 && data?.file?.token) {
        setItems((current) =>
          current.map((entry) =>
            entry.id === item.id
              ? { ...entry, status: "ready", progress: 100, token: data.file?.token }
              : entry,
          ),
        );
        return;
      }
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? { ...entry, status: "error", error: data?.error ?? "Upload failed. Please try again." }
            : entry,
        ),
      );
    };
    xhr.onerror = () => {
      uploads.current.delete(item.id);
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? { ...entry, status: "error", error: "Upload failed. Check your connection and try again." }
            : entry,
        ),
      );
    };
    uploads.current.set(item.id, xhr);
    const form = new FormData();
    form.append("file", item.file, item.file.name);
    xhr.send(form);
  }

  function addFiles(fileList: FileList | File[]) {
    setUploadError("");
    const incoming = Array.from(fileList);
    const room = MAX_FILES - items.length;
    if (room <= 0) {
      setUploadError(`You can attach up to ${MAX_FILES} proof files.`);
      return;
    }
    const accepted: UploadItem[] = [];
    for (const file of incoming.slice(0, room)) {
      if (!applyFile(file)) continue;
      const mediaKind = mediaKindFor(file.type);
      if (!mediaKind) continue;
      accepted.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        mediaKind,
        progress: 0,
        status: "uploading",
      });
    }
    if (incoming.length > room) {
      setUploadError(`Only ${MAX_FILES} proof files can be attached. Extra files were skipped.`);
    }
    if (accepted.length === 0) return;
    setItems((current) => [...current, ...accepted]);
    accepted.forEach(startUpload);
  }

  function removeItem(id: string) {
    uploads.current.get(id)?.abort();
    uploads.current.delete(id);
    setItems((current) => {
      const target = current.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((item) => item.id !== id);
    });
    setUploadError("");
  }

  function chooseKind(next: ReportKind) {
    setKind(next);
    setSuccess(null);
    setErrors({});
    setFormError("");
    setUploadError("");
    if (next !== "player") {
      setReportedUsername("");
      setReason("");
    }
    if (next !== "bug") setDescription("");
    window.setTimeout(
      () => document.getElementById("report-form")?.scrollIntoView({ behavior: "smooth", block: "start" }),
      30,
    );
  }

  function clearFieldError(key: string) {
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!kind) return;

    const localErrors: Record<string, string> = {};
    if (!/^[A-Za-z0-9_ ]{3,16}$/.test(submitterUsername.trim())) {
      localErrors.submitterUsername = "Use 3–16 letters, numbers or underscores.";
    }
    if (kind === "player" && !/^[A-Za-z0-9_ ]{3,16}$/.test(reportedUsername.trim())) {
      localErrors.reportedUsername = "Use 3–16 letters, numbers or underscores.";
    }
    if (kind === "player" && reason.trim().length < 3) {
      localErrors.reason = "Add a short reason (at least 3 characters).";
    }
    if (kind === "bug" && description.trim().length < 5) {
      localErrors.description = "Add a short description (at least 5 characters).";
    }
    if (items.some((item) => item.status === "uploading")) {
      localErrors.proof = "Wait for the proof uploads to finish.";
    } else if (items.some((item) => item.status === "error")) {
      localErrors.proof = "Remove the failed upload and try again.";
    } else if (items.length === 0) {
      localErrors.proof = "Proof is required. Attach at least one screenshot or video.";
    }

    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      setFormError("Please fix the highlighted fields before submitting.");
      return;
    }

    setPending(true);
    setFormError("");
    setErrors({});
    try {
      const data = await apiRequest<{ report: ReportSummary }>("/api/reports", {
        method: "POST",
        body: {
          kind,
          submitterUsername: submitterUsername.trim(),
          reportedUsername: kind === "player" ? reportedUsername.trim() : "",
          reason: kind === "player" ? reason : "",
          description: kind === "bug" ? description : "",
          files: items.map((item) => item.token).filter(Boolean),
        },
      });
      setSuccess(data.report);
      items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      setItems([]);
      setReportedUsername("");
      setReason("");
      setDescription("");
    } catch (error) {
      const data = error as Error & { fieldErrors?: Record<string, string> };
      if (data.fieldErrors) setErrors(data.fieldErrors);
      setFormError(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  const uploading = items.some((item) => item.status === "uploading");
  const readyCount = items.filter((item) => item.status === "ready").length;

  return (
    <>
      <section className="container-x pb-8 pt-10 sm:pt-12" data-reveal-group>
        <div className="grid gap-4 md:grid-cols-2">
          {(Object.keys(REPORT_KIND_META) as ReportKind[]).map((option) => {
            const meta = REPORT_KIND_META[option];
            const Icon = KIND_ICONS[option];
            const selected = kind === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => chooseKind(option)}
                aria-pressed={selected}
                className={`panel group relative overflow-hidden p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-aqua-300 hover:shadow-[0_28px_60px_-34px_rgba(12,110,160,0.55)] ${
                  selected ? "!border-sun/60 !bg-white ring-2 ring-sun/15" : ""
                }`}
              >
                <span
                  className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-sun/10 transition-transform duration-300 group-hover:scale-125"
                  aria-hidden="true"
                />
                <span className="relative grid h-12 w-12 place-items-center rounded-2xl border border-aqua-200 bg-aqua-50 text-aqua-600 transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105">
                  <Icon width={22} height={22} />
                </span>
                <h2 className="relative mt-5 font-display text-xl font-bold text-navy-900">
                  {meta.cardTitle}
                </h2>
                <p className="relative mt-2 min-h-[60px] text-sm leading-relaxed text-navy-500">
                  {meta.description}
                </p>
                <span className="relative mt-5 inline-flex items-center gap-2 text-xs font-semibold text-sun-deep">
                  {selected ? "Report selected" : "Start report"}
                  <ArrowRightIcon
                    width={14}
                    height={14}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {kind && (
        <section id="report-form" className="container-x scroll-mt-28 pb-24">
          {success ? (
            <div className="panel mx-auto max-w-3xl p-7 text-center sm:p-10">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600">
                <CheckIcon width={25} height={25} />
              </span>
              <p className="eyebrow mt-5">Report received</p>
              <h2 className="mt-2 font-display text-2xl font-extrabold text-navy-900">
                THANK YOU FOR REPORTING
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-navy-500">
                The staff team will review your report privately. Keep the report ID below if you
                need to contact us about it.
              </p>
              <div className="mx-auto mt-6 max-w-sm rounded-xl border border-aqua-100 bg-aqua-50/70 p-4 text-sm text-navy-700">
                <p>
                  <strong>{success.displayId}</strong> · {REPORT_KIND_META[success.kind].label}
                </p>
                <p className="mt-2 text-xs text-navy-500">
                  Submitted {formatApplicationDate(success.submittedAt)}
                </p>
              </div>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  className="btn-primary !py-2.5 text-xs"
                  onClick={() => {
                    setSuccess(null);
                    setFormError("");
                    setErrors({});
                  }}
                >
                  Submit another report
                </button>
                <button
                  type="button"
                  className="btn-ghost !py-2.5 text-xs"
                  onClick={() => {
                    setKind(null);
                    setSuccess(null);
                  }}
                >
                  Choose another type
                </button>
              </div>
            </div>
          ) : (
            <div className="panel mx-auto max-w-3xl overflow-hidden">
              <div className="border-b border-aqua-100 bg-aqua-50/50 px-6 py-6 sm:px-8">
                <p className="eyebrow">{REPORT_KIND_META[kind].label}</p>
                <h2 className="mt-2 font-display text-2xl font-extrabold text-navy-900">
                  {kind === "player" ? "REPORT A PLAYER" : "REPORT A BUG"}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-navy-500">
                  {kind === "player"
                    ? "Tell us who broke the rules and what happened. Proof is required."
                    : "Describe what broke and how to reproduce it. Proof is required."}
                </p>
                <p className="mt-3 text-xs text-navy-400">
                  Fields marked <span className="text-ember">*</span> are required. Reports and proof
                  are only visible to senior staff.
                </p>
              </div>

              <form onSubmit={submit} noValidate className="space-y-5 p-6 sm:p-8">
                {formError && <ErrorNote>{formError}</ErrorNote>}

                {kind === "player" && (
                  <Field
                    label="Player's Username *"
                    htmlFor="report-reported"
                    hint="The Minecraft username of the player you are reporting."
                  >
                    <input
                      id="report-reported"
                      className="input"
                      value={reportedUsername}
                      onChange={(event) => {
                        setReportedUsername(event.target.value);
                        clearFieldError("reportedUsername");
                      }}
                      maxLength={16}
                      placeholder="Minecraft username"
                      autoComplete="off"
                      disabled={pending}
                    />
                    {errors.reportedUsername && (
                      <p className="mt-1.5 text-[11px] text-red-600">{errors.reportedUsername}</p>
                    )}
                  </Field>
                )}

                <Field
                  label="Your Username *"
                  htmlFor="report-submitter"
                  hint="Your Minecraft username, so staff can follow up if needed."
                >
                  <input
                    id="report-submitter"
                    className="input"
                    value={submitterUsername}
                    onChange={(event) => {
                      setSubmitterUsername(event.target.value);
                      clearFieldError("submitterUsername");
                    }}
                    maxLength={16}
                    placeholder="Minecraft username"
                    autoComplete="off"
                    disabled={pending}
                  />
                  {errors.submitterUsername && (
                    <p className="mt-1.5 text-[11px] text-red-600">{errors.submitterUsername}</p>
                  )}
                </Field>

                {kind === "player" ? (
                  <Field label="Reason *" htmlFor="report-reason">
                    <textarea
                      id="report-reason"
                      className="input"
                      rows={4}
                      maxLength={1000}
                      value={reason}
                      onChange={(event) => {
                        setReason(event.target.value);
                        clearFieldError("reason");
                      }}
                      placeholder="What did this player do? Include server, time and any witnesses."
                      disabled={pending}
                    />
                    {errors.reason && (
                      <p className="mt-1.5 text-[11px] text-red-600">{errors.reason}</p>
                    )}
                  </Field>
                ) : (
                  <Field label="Bug Description *" htmlFor="report-description">
                    <textarea
                      id="report-description"
                      className="input"
                      rows={5}
                      maxLength={4000}
                      value={description}
                      onChange={(event) => {
                        setDescription(event.target.value);
                        clearFieldError("description");
                      }}
                      placeholder="What happened, what did you expect, and how can we reproduce it?"
                      disabled={pending}
                    />
                    {errors.description && (
                      <p className="mt-1.5 text-[11px] text-red-600">{errors.description}</p>
                    )}
                  </Field>
                )}

                <div>
                  <p className="label">Proof Upload *</p>
                  <input
                    ref={fileInput}
                    type="file"
                    accept={ACCEPT}
                    multiple
                    className="sr-only"
                    onChange={(event) => {
                      if (event.target.files) addFiles(event.target.files);
                      event.target.value = "";
                    }}
                    disabled={pending}
                  />
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => fileInput.current?.click()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        fileInput.current?.click();
                      }
                    }}
                    onDragEnter={(event) => {
                      event.preventDefault();
                      dragDepth.current += 1;
                      setDragging(true);
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDragLeave={(event) => {
                      event.preventDefault();
                      dragDepth.current -= 1;
                      if (dragDepth.current <= 0) setDragging(false);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      dragDepth.current = 0;
                      setDragging(false);
                      if (!pending) addFiles(event.dataTransfer.files);
                    }}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-5 py-8 text-center transition-colors ${
                      dragging
                        ? "border-sun bg-sun/10"
                        : "border-aqua-300 bg-aqua-50/40 hover:border-aqua-400 hover:bg-aqua-50"
                    }`}
                  >
                    <span className="grid h-11 w-11 place-items-center rounded-xl border border-aqua-200 bg-white text-aqua-600">
                      <ImageIcon width={20} height={20} />
                    </span>
                    <span className="mt-3 text-sm font-semibold text-navy-800">
                      Drop files here or click to upload
                    </span>
                    <span className="mt-1 text-[11px] leading-relaxed text-navy-400">
                      Screenshots or video proof. Up to {MAX_FILES} files — images 8 MB, videos 80 MB.
                    </span>
                  </div>
                  {uploadError && (
                    <p className="mt-1.5 text-[11px] text-red-600" role="alert">
                      {uploadError}
                    </p>
                  )}
                  {errors.proof && <p className="mt-1.5 text-[11px] text-red-600">{errors.proof}</p>}

                  {items.length > 0 && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="relative overflow-hidden rounded-xl border border-aqua-200 bg-white"
                        >
                          {item.mediaKind === "image" ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.previewUrl}
                              alt={`Preview of ${item.file.name}`}
                              className="h-32 w-full object-cover"
                            />
                          ) : (
                            <video
                              src={item.previewUrl}
                              className="h-32 w-full bg-navy-900 object-contain"
                              controls
                              muted
                              playsInline
                              preload="metadata"
                            />
                          )}
                          <div className="px-3 py-2">
                            <p className="truncate text-[11px] font-semibold text-navy-700" title={item.file.name}>
                              {item.file.name}
                            </p>
                            <p className="mt-0.5 text-[10px] text-navy-400">
                              {formatSize(item.file.size)}
                              {item.status === "ready" && " · Uploaded"}
                              {item.status === "uploading" && ` · Uploading ${item.progress}%`}
                            </p>
                            {item.status === "uploading" && (
                              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-aqua-100">
                                <div
                                  className="h-full rounded-full bg-sun-deep transition-all"
                                  style={{ width: `${item.progress}%` }}
                                />
                              </div>
                            )}
                            {item.status === "error" && (
                              <p className="mt-1 text-[10px] text-red-600">{item.error}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            disabled={pending}
                            aria-label={`Remove ${item.file.name}`}
                            className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full border border-aqua-200 bg-white/95 text-navy-600 shadow-sm transition hover:border-red-200 hover:text-red-600"
                          >
                            <CloseIcon width={12} height={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {items.length > 0 && (
                    <p className="mt-2 text-[11px] text-navy-400">
                      {readyCount} of {items.length} proof file{items.length === 1 ? "" : "s"} ready.
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-3 border-t border-aqua-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[11px] leading-relaxed text-navy-400">
                    False reports may be rejected. Do not upload private information unrelated to
                    this report.
                  </p>
                  <button
                    type="submit"
                    disabled={pending || uploading}
                    className="btn-primary shrink-0 !py-3 text-xs"
                  >
                    {pending ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        Submitting…
                      </>
                    ) : (
                      <>
                        Send report
                        <ArrowRightIcon width={14} height={14} />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>
      )}
    </>
  );
}
