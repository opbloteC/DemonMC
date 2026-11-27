"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertIcon,
  ArrowRightIcon,
  BugIcon,
  ClockIcon,
  SearchIcon,
  ShieldIcon,
} from "@/components/icons";
import { formatApplicationDate } from "@/components/applications/application-status";
import {
  REPORT_KIND_META,
  REPORT_STATUSES,
  REPORT_STATUS_META,
  type ReportDetail,
  type ReportKind,
  type ReportListPage,
  type ReportStatus,
} from "@/lib/report-types";
import {
  apiRequest,
  EmptyState,
  ErrorNote,
  errorMessage,
  Field,
  Modal,
  Spinner,
  type Notify,
} from "./ui";

const KIND_ICONS = {
  player: ShieldIcon,
  bug: BugIcon,
} as const;

function ReportStatusBadge({ status }: { status: ReportStatus }) {
  return (
    <span className={`badge ${REPORT_STATUS_META[status].tone}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {REPORT_STATUS_META[status].label}
    </span>
  );
}

export function ReportsTab({ notify }: { notify: Notify }) {
  const [kind, setKind] = useState<ReportKind>("player");
  const [status, setStatus] = useState<ReportStatus | "all">("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [reports, setReports] = useState<ReportListPage["reports"]>([]);
  const [counts, setCounts] = useState<ReportListPage["counts"]>({
    player: { pending: 0, reviewing: 0, resolved: 0, rejected: 0 },
    bug: { pending: 0, reviewing: 0, resolved: 0, rejected: 0 },
  });
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<ReportDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [statusPending, setStatusPending] = useState<ReportStatus | null>(null);
  const [statusError, setStatusError] = useState("");
  const [note, setNote] = useState("");
  const [notePending, setNotePending] = useState(false);
  const [noteError, setNoteError] = useState("");
  const requestId = useRef(0);

  const load = useCallback(
    async (offset = 0, append = false) => {
      const id = ++requestId.current;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError("");
      const params = new URLSearchParams({ kind, sort });
      if (status !== "all") params.set("status", status);
      if (search) params.set("search", search);
      params.set("offset", String(offset));
      try {
        const data = await apiRequest<ReportListPage>(`/api/admin/reports?${params}`);
        if (id !== requestId.current) return;
        setReports((current) => (append ? [...current, ...data.reports] : data.reports));
        setCounts(data.counts);
        setNextOffset(data.nextOffset);
      } catch (err) {
        if (id === requestId.current) setError(errorMessage(err));
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [kind, search, sort, status],
  );

  useEffect(() => {
    void load();
  }, [load]);

  function chooseKind(next: ReportKind) {
    setKind(next);
    setSearch("");
    setSearchInput("");
    setStatus("all");
  }

  async function openReport(id: number) {
    setSelected(null);
    setDetailError("");
    setStatusError("");
    setNote("");
    setNoteError("");
    setDetailLoading(true);
    try {
      const data = await apiRequest<{ report: ReportDetail }>(`/api/admin/reports/${id}`);
      setSelected(data.report);
    } catch (err) {
      setDetailError(errorMessage(err));
    } finally {
      setDetailLoading(false);
    }
  }

  async function changeStatus(next: ReportStatus) {
    if (!selected || selected.status === next) return;
    setStatusPending(next);
    setStatusError("");
    try {
      const data = await apiRequest<{ report: ReportDetail }>(
        `/api/admin/reports/${selected.id}/status`,
        { method: "POST", body: { status: next } },
      );
      setSelected(data.report);
      setReports((current) =>
        current.map((item) =>
          item.id === data.report.id
            ? { ...item, status: data.report.status, updatedAt: data.report.updatedAt, reviewedBy: data.report.reviewedBy }
            : item,
        ),
      );
      notify(`${data.report.displayId} marked ${REPORT_STATUS_META[next].label.toLowerCase()}.`);
      void load(0, false);
    } catch (err) {
      setStatusError(errorMessage(err));
    } finally {
      setStatusPending(null);
    }
  }

  async function addNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setNotePending(true);
    setNoteError("");
    try {
      const data = await apiRequest<{ notes: ReportDetail["notes"] }>(
        `/api/admin/reports/${selected.id}/notes`,
        { method: "POST", body: { body: note } },
      );
      setSelected((current) => (current ? { ...current, notes: data.notes } : current));
      setNote("");
      notify("Private report note saved.");
    } catch (err) {
      setNoteError(errorMessage(err));
    } finally {
      setNotePending(false);
    }
  }

  const totalPending = counts.player.pending + counts.bug.pending;

  return (
    <div className="space-y-5">
      <section className="panel p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold text-navy-900">Reports</h2>
            <p className="mt-1 text-sm text-navy-500">
              Review player reports and bug reports. Proof files and staff notes are private to
              Owner, Manager and Developer accounts.
            </p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center">
            <p className="font-display text-2xl font-extrabold text-amber-700">{totalPending}</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-600">
              Total pending
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2" role="tablist" aria-label="Report types">
          {(Object.keys(REPORT_KIND_META) as ReportKind[]).map((item) => {
            const Icon = KIND_ICONS[item];
            return (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={kind === item}
                onClick={() => chooseKind(item)}
                className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                  kind === item
                    ? "border-aqua-400 bg-aqua-100"
                    : "border-aqua-200 bg-white/70 hover:border-aqua-300"
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg border border-aqua-200 bg-white text-aqua-600">
                    <Icon width={16} height={16} />
                  </span>
                  <span>
                    <span className="block text-xs font-semibold text-navy-800">
                      {REPORT_KIND_META[item].label}
                    </span>
                    <span className="mt-1 block text-[11px] text-navy-400">
                      View {item} reports
                    </span>
                  </span>
                </span>
                <span className="badge border-amber-200 bg-amber-50 text-amber-700">
                  {counts[item].pending} pending
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="panel p-4 sm:p-5">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(searchInput.trim());
          }}
          className="grid gap-3 md:grid-cols-[1fr_160px_160px_auto]"
        >
          <Field label="Search username or report ID" htmlFor="report-search">
            <div className="relative">
              <SearchIcon
                width={15}
                height={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy-400"
              />
              <input
                id="report-search"
                className="input !pl-9"
                value={searchInput}
                maxLength={100}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="e.g. Notch or RPT-000012"
              />
            </div>
          </Field>
          <Field label="Status" htmlFor="report-status">
            <select
              id="report-status"
              className="input"
              value={status}
              onChange={(event) => setStatus(event.target.value as ReportStatus | "all")}
            >
              <option value="all">All statuses</option>
              {REPORT_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {REPORT_STATUS_META[item].label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sort" htmlFor="report-sort">
            <select
              id="report-sort"
              className="input"
              value={sort}
              onChange={(event) => setSort(event.target.value as "newest" | "oldest")}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </Field>
          <div className="flex items-end gap-2">
            <button type="submit" className="btn-primary !py-2.5 text-xs">
              Search
            </button>
            {(search || status !== "all") && (
              <button
                type="button"
                className="btn-ghost !px-3 !py-2.5 text-xs"
                onClick={() => {
                  setSearch("");
                  setSearchInput("");
                  setStatus("all");
                }}
              >
                Clear
              </button>
            )}
          </div>
        </form>
      </section>

      {error && <ErrorNote>{error}</ErrorNote>}

      <section className="panel overflow-hidden">
        {loading ? (
          <div className="p-10">
            <Spinner label="Loading reports" />
          </div>
        ) : reports.length === 0 ? (
          <EmptyState
            icon={<ClockIcon width={20} height={20} />}
            title="No reports found"
            description={
              search || status !== "all"
                ? "Try a different search or status filter."
                : `New ${kind} reports will appear here.`
            }
          />
        ) : (
          <>
            <div className="hidden grid-cols-[130px_1fr_1fr_150px_130px_36px] gap-4 border-b border-aqua-100 bg-aqua-50/60 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-navy-400 lg:grid">
              <span>Report</span>
              <span>{kind === "player" ? "Reported player" : "Bug report"}</span>
              <span>Submitted by</span>
              <span>Submitted</span>
              <span>Status</span>
              <span className="sr-only">Open</span>
            </div>
            <div className="divide-y divide-aqua-100">
              {reports.map((report) => (
                <button
                  key={report.id}
                  type="button"
                  onClick={() => void openReport(report.id)}
                  className="grid w-full gap-3 px-5 py-4 text-left transition-colors hover:bg-aqua-50/60 lg:grid-cols-[130px_1fr_1fr_150px_130px_36px] lg:items-center lg:gap-4"
                >
                  <span className="font-mono text-xs font-bold text-navy-900">{report.displayId}</span>
                  <span className="min-w-0 truncate text-sm font-semibold text-navy-700">
                    {report.reportedUsername ?? report.description}
                  </span>
                  <span className="hidden min-w-0 truncate text-sm text-navy-500 lg:block">
                    {report.submitterUsername}
                  </span>
                  <span className="text-xs text-navy-400">
                    {formatApplicationDate(report.submittedAt)}
                  </span>
                  <span>
                    <ReportStatusBadge status={report.status} />
                  </span>
                  <span className="hidden h-8 w-8 place-items-center rounded-lg border border-aqua-200 text-aqua-600 lg:grid">
                    <ArrowRightIcon width={14} height={14} />
                  </span>
                  <span className="text-xs text-navy-400 lg:hidden">
                    By {report.submitterUsername} · {report.fileCount} proof file
                    {report.fileCount === 1 ? "" : "s"} · Tap to review
                  </span>
                </button>
              ))}
            </div>
            {nextOffset !== null && (
              <div className="border-t border-aqua-100 p-4 text-center">
                <button
                  type="button"
                  className="btn-subtle"
                  disabled={loadingMore}
                  onClick={() => void load(nextOffset, true)}
                >
                  {loadingMore ? "Loading…" : "Load more reports"}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {(detailLoading || selected || detailError) && (
        <Modal
          title={
            selected
              ? `${selected.displayId} · ${REPORT_KIND_META[selected.kind].label}`
              : "Report review"
          }
          description={
            selected
              ? `Submitted by ${selected.submitterUsername} · ${formatApplicationDate(selected.submittedAt)}`
              : undefined
          }
          onClose={() => {
            setSelected(null);
            setDetailError("");
            setStatusError("");
          }}
          wide
        >
          {detailLoading ? (
            <Spinner label="Loading report" />
          ) : detailError ? (
            <ErrorNote>{detailError}</ErrorNote>
          ) : selected ? (
            <div className="space-y-7">
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-aqua-100 bg-aqua-50/60 p-4">
                <ReportStatusBadge status={selected.status} />
                <span className="text-xs text-navy-500">
                  Report ID <strong className="text-navy-800">{selected.displayId}</strong>
                </span>
                <span className="text-xs text-navy-500">
                  Submitted <strong className="text-navy-800">{formatApplicationDate(selected.submittedAt)}</strong>
                </span>
                {selected.reviewedBy && (
                  <span className="text-xs text-navy-500">
                    Last reviewed by <strong className="text-navy-800">{selected.reviewedBy}</strong>
                  </span>
                )}
              </div>

              <section className="rounded-xl border border-aqua-200 p-4">
                <h3 className="font-display text-base font-bold text-navy-900">Report details</h3>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-navy-400">
                      Your username
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-navy-800">
                      {selected.submitterUsername}
                    </dd>
                  </div>
                  {selected.kind === "player" && (
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-navy-400">
                        Reported player
                      </dt>
                      <dd className="mt-1 text-sm font-semibold text-navy-800">
                        {selected.reportedUsername ?? "—"}
                      </dd>
                    </div>
                  )}
                </dl>
                <div className="mt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-navy-400">
                    {selected.kind === "player" ? "Reason" : "Bug description"}
                  </p>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-navy-700">
                    {selected.kind === "player" ? selected.reason : selected.description}
                  </p>
                </div>
              </section>

              <section className="rounded-xl border border-aqua-200 p-4">
                <h3 className="font-display text-base font-bold text-navy-900">
                  Proof ({selected.files.length})
                </h3>
                {selected.files.length === 0 ? (
                  <p className="mt-2 text-xs text-navy-400">No proof files attached.</p>
                ) : (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {selected.files.map((file) => (
                      <figure
                        key={file.id}
                        className="overflow-hidden rounded-xl border border-aqua-200 bg-white"
                      >
                        {file.mediaKind === "image" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={file.url}
                            alt={file.name}
                            className="h-48 w-full bg-aqua-50 object-contain"
                          />
                        ) : (
                          <video
                            src={file.url}
                            className="h-48 w-full bg-navy-900 object-contain"
                            controls
                            playsInline
                            preload="metadata"
                          />
                        )}
                        <figcaption className="flex items-center justify-between gap-2 px-3 py-2">
                          <span className="min-w-0 truncate text-[11px] font-semibold text-navy-700" title={file.name}>
                            {file.name}
                          </span>
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 text-[11px] font-semibold text-aqua-700 hover:text-aqua-900"
                          >
                            Open
                          </a>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-aqua-200 p-4">
                <h3 className="font-display text-base font-bold text-navy-900">Status</h3>
                <p className="mt-1 text-xs text-navy-400">
                  Update the report status as you review it. The reporter does not see staff notes.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {REPORT_STATUSES.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => void changeStatus(item)}
                      disabled={statusPending !== null || selected.status === item}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-default ${
                        selected.status === item
                          ? REPORT_STATUS_META[item].tone
                          : "border-aqua-200 bg-white text-navy-600 hover:border-aqua-300 hover:bg-aqua-50"
                      }`}
                    >
                      {statusPending === item ? "Saving…" : REPORT_STATUS_META[item].label}
                    </button>
                  ))}
                </div>
                {statusError && <div className="mt-3"><ErrorNote>{statusError}</ErrorNote></div>}
              </section>

              <section className="rounded-xl border border-aqua-200 p-4">
                <div className="flex items-center gap-2">
                  <AlertIcon width={16} height={16} className="text-aqua-600" />
                  <h3 className="font-display text-base font-bold text-navy-900">
                    Private staff notes
                  </h3>
                </div>
                <p className="mt-1 text-xs text-navy-400">
                  Only Owner, Manager and Developer accounts can see these notes.
                </p>
                <form onSubmit={addNote} className="mt-4 space-y-3">
                  <Field label="Add a note" htmlFor="report-note">
                    <textarea
                      id="report-note"
                      className="input"
                      rows={3}
                      maxLength={2000}
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Private context for other reviewers"
                    />
                  </Field>
                  {noteError && <ErrorNote>{noteError}</ErrorNote>}
                  <button
                    type="submit"
                    className="btn-subtle"
                    disabled={notePending || note.trim().length < 2}
                  >
                    {notePending ? "Saving…" : "Save private note"}
                  </button>
                </form>
                {selected.notes.length > 0 && (
                  <div className="mt-4 space-y-3 border-t border-aqua-100 pt-4">
                    {selected.notes.map((item) => (
                      <div key={item.id} className="rounded-lg bg-aqua-50/60 p-3">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-navy-700">
                          {item.body}
                        </p>
                        <p className="mt-2 text-[11px] text-navy-400">
                          {item.authorUsername} · {formatApplicationDate(item.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          ) : null}
        </Modal>
      )}
    </div>
  );
}
