"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  CloseIcon,
  SearchIcon,
  ShieldIcon,
} from "@/components/icons";
import { ApplicationReadOnlyAnswers } from "@/components/applications/application-questions";
import { ApplicationStatusBadge, formatApplicationDate } from "@/components/applications/application-status";
import {
  APPLICATION_CATEGORIES,
  APPLICATION_CATEGORY_META,
  APPLICATION_STATUSES,
  type ApplicationCategory,
  type ApplicationStatus,
  type ApplicationSubmissionDetail,
  type ApplicationSubmissionSummary,
} from "@/lib/application-types";
import {
  apiRequest,
  ConfirmDialog,
  EmptyState,
  ErrorNote,
  errorMessage,
  Field,
  Modal,
  Spinner,
  type Notify,
} from "./ui";

interface ManagementPage {
  forms: Array<{ category: ApplicationCategory; enabled: boolean }>;
  pendingCounts: Record<ApplicationCategory, number>;
  submissions: ApplicationSubmissionSummary[];
  nextOffset: number | null;
}

export function ApplicationsManagement({ notify }: { notify: Notify }) {
  const [category, setCategory] = useState<ApplicationCategory>("staff");
  const [status, setStatus] = useState<ApplicationStatus | "all">("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [submissions, setSubmissions] = useState<ApplicationSubmissionSummary[]>([]);
  const [pendingCounts, setPendingCounts] = useState<Record<ApplicationCategory, number>>({ staff: 0, media: 0 });
  const [forms, setForms] = useState<Array<{ category: ApplicationCategory; enabled: boolean }>>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<ApplicationSubmissionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [note, setNote] = useState("");
  const [notePending, setNotePending] = useState(false);
  const [noteError, setNoteError] = useState("");
  const [decision, setDecision] = useState<"accepted" | "denied" | null>(null);
  const [decisionPending, setDecisionPending] = useState(false);
  const [decisionError, setDecisionError] = useState("");
  const [denialReason, setDenialReason] = useState("");
  const requestId = useRef(0);

  const load = useCallback(async (offset = 0, append = false) => {
    const id = ++requestId.current;
    if (append) setLoadingMore(true); else setLoading(true);
    setError("");
    const params = new URLSearchParams({ category, sort });
    if (status !== "all") params.set("status", status);
    if (search) params.set("search", search);
    params.set("offset", String(offset));
    try {
      const data = await apiRequest<ManagementPage>(`/api/admin/applications?${params}`);
      if (id !== requestId.current) return;
      setSubmissions((current) => append ? [...current, ...data.submissions] : data.submissions);
      setPendingCounts(data.pendingCounts);
      setForms(data.forms);
      setNextOffset(data.nextOffset);
    } catch (err) {
      if (id === requestId.current) setError(errorMessage(err));
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [category, search, sort, status]);

  useEffect(() => { void load(); }, [load]);

  function chooseCategory(next: ApplicationCategory) {
    setCategory(next);
    setSearch("");
    setSearchInput("");
    setStatus("all");
  }

  async function openSubmission(id: number) {
    setSelected(null);
    setDetailError("");
    setNote("");
    setNoteError("");
    setDecision(null);
    setDenialReason("");
    setDetailLoading(true);
    try {
      const data = await apiRequest<{ submission: ApplicationSubmissionDetail }>(`/api/admin/applications/${id}`);
      setSelected(data.submission);
    } catch (err) {
      setDetailError(errorMessage(err));
    } finally {
      setDetailLoading(false);
    }
  }

  async function addNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setNotePending(true);
    setNoteError("");
    try {
      const data = await apiRequest<{ notes: ApplicationSubmissionDetail["notes"] }>(`/api/admin/applications/${selected.id}/notes`, { method: "POST", body: { body: note } });
      setSelected((current) => current ? { ...current, notes: data.notes } : current);
      setNote("");
      notify("Private review note saved.");
    } catch (err) {
      setNoteError(errorMessage(err));
    } finally {
      setNotePending(false);
    }
  }

  async function confirmDecision() {
    if (!selected || !decision) return;
    setDecisionPending(true);
    setDecisionError("");
    try {
      const data = await apiRequest<{ submission: ApplicationSubmissionDetail }>(`/api/admin/applications/${selected.id}/decision`, {
        method: "POST",
        body: { status: decision, reason: decision === "denied" ? denialReason : "" },
      });
      setSelected(data.submission);
      setSubmissions((current) => current.map((item) => item.id === data.submission.id ? { ...item, ...data.submission } : item));
      setPendingCounts((current) => ({ ...current, [category]: Math.max(0, current[category] - 1) }));
      setDecision(null);
      setDenialReason("");
      notify(`Application ${data.submission.displayId} ${decision}.`);
      void load(0, false);
    } catch (err) {
      setDecisionError(errorMessage(err));
    } finally {
      setDecisionPending(false);
    }
  }

  const totalPending = Object.values(pendingCounts).reduce((total, count) => total + count, 0);
  const currentForm = forms.find((form) => form.category === category);

  return (
    <div className="space-y-5">
      <section className="panel p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold text-navy-900">Applications</h2>
            <p className="mt-1 text-sm text-navy-500">Review submissions without changing applicant answers or granting server permissions.</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center"><p className="font-display text-2xl font-extrabold text-amber-700">{totalPending}</p><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-600">Total pending</p></div>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2" role="tablist" aria-label="Application categories">
          {APPLICATION_CATEGORIES.map((item) => (
            <button key={item} type="button" role="tab" aria-selected={category === item} onClick={() => chooseCategory(item)} className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${category === item ? "border-aqua-400 bg-aqua-100" : "border-aqua-200 bg-white/70 hover:border-aqua-300"}`}>
              <span><span className="block text-xs font-semibold text-navy-800">{APPLICATION_CATEGORY_META[item].label}</span><span className="mt-1 block text-[11px] text-navy-400">{currentForm?.enabled === false && item === category ? "Applications closed" : "Review submissions"}</span></span>
              <span className="badge border-amber-200 bg-amber-50 text-amber-700">{pendingCounts[item]} pending</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel p-4 sm:p-5">
        <form onSubmit={(event) => { event.preventDefault(); setSearch(searchInput.trim()); }} className="grid gap-3 md:grid-cols-[1fr_160px_160px_auto]">
          <Field label="Search Minecraft username or application ID" htmlFor="application-search"><div className="relative"><SearchIcon width={15} height={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" /><input id="application-search" className="input !pl-9" value={searchInput} maxLength={100} onChange={(event) => setSearchInput(event.target.value)} placeholder="e.g. Notch or DMC-000123" /></div></Field>
          <Field label="Status" htmlFor="application-status"><select id="application-status" className="input" value={status} onChange={(event) => setStatus(event.target.value as ApplicationStatus | "all")}><option value="all">All statuses</option>{APPLICATION_STATUSES.map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}</select></Field>
          <Field label="Sort" htmlFor="application-sort"><select id="application-sort" className="input" value={sort} onChange={(event) => setSort(event.target.value as "newest" | "oldest")}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></Field>
          <div className="flex items-end gap-2"><button type="submit" className="btn-primary !py-2.5 text-xs">Search</button>{(search || status !== "all") && <button type="button" className="btn-ghost !px-3 !py-2.5 text-xs" onClick={() => { setSearch(""); setSearchInput(""); setStatus("all"); }}>Clear</button>}</div>
        </form>
      </section>

      {error && <ErrorNote>{error}</ErrorNote>}

      <section className="panel overflow-hidden">
        {loading ? <div className="p-10"><Spinner label="Loading applications" /></div> : submissions.length === 0 ? (
          <EmptyState icon={<ClockIcon width={20} height={20} />} title="No applications found" description={search || status !== "all" ? "Try a different search or status filter." : "New submissions in this category will appear here."} />
        ) : (
          <>
            <div className="hidden grid-cols-[130px_1fr_1fr_150px_130px_36px] gap-4 border-b border-aqua-100 bg-aqua-50/60 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-navy-400 lg:grid">
              <span>Application</span><span>Minecraft</span><span>Discord</span><span>Submitted</span><span>Status</span><span className="sr-only">Open</span>
            </div>
            <div className="divide-y divide-aqua-100">
              {submissions.map((submission) => (
                <button key={submission.id} type="button" onClick={() => void openSubmission(submission.id)} className="grid w-full gap-3 px-5 py-4 text-left transition-colors hover:bg-aqua-50/60 lg:grid-cols-[130px_1fr_1fr_150px_130px_36px] lg:items-center lg:gap-4">
                  <span className="font-mono text-xs font-bold text-navy-900">{submission.displayId}</span>
                  <span className="min-w-0 truncate text-sm font-semibold text-navy-700" title={submission.minecraftUsername}>{submission.minecraftUsername}</span>
                  <span className="hidden min-w-0 truncate text-sm text-navy-500 lg:block" title={submission.discordUsername}>{submission.discordUsername}</span>
                  <span className="text-xs text-navy-400">{formatApplicationDate(submission.submittedAt)}</span>
                  <span><ApplicationStatusBadge status={submission.status} /></span>
                  <span className="hidden h-8 w-8 place-items-center rounded-lg border border-aqua-200 text-aqua-600 lg:grid"><ArrowRightIcon width={14} height={14} /></span>
                  <span className="text-xs text-navy-400 lg:hidden">Discord: {submission.discordUsername} · Tap to review</span>
                </button>
              ))}
            </div>
            {nextOffset !== null && <div className="border-t border-aqua-100 p-4 text-center"><button type="button" className="btn-subtle" disabled={loadingMore} onClick={() => void load(nextOffset, true)}>{loadingMore ? "Loading…" : "Load more applications"}</button></div>}
          </>
        )}
      </section>

      {(detailLoading || selected || detailError) && (
        <Modal title={selected ? `${selected.displayId} · ${APPLICATION_CATEGORY_META[selected.category].cardTitle}` : "Application review"} description={selected ? `${selected.minecraftUsername} · Submitted ${formatApplicationDate(selected.submittedAt)}` : undefined} onClose={() => { setSelected(null); setDetailError(""); setDecision(null); }} wide>
          {detailLoading ? <Spinner label="Loading application" /> : detailError ? <ErrorNote>{detailError}</ErrorNote> : selected ? (
            <div className="space-y-7">
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-aqua-100 bg-aqua-50/60 p-4">
                <ApplicationStatusBadge status={selected.status} />
                <span className="text-xs text-navy-500">Applicant account: <strong className="text-navy-800">{selected.applicantUsername}</strong></span>
                <span className="text-xs text-navy-500">Discord: <strong className="text-navy-800">{selected.discordUsername}</strong></span>
              </div>
              {selected.denialReason && <div className="rounded-xl border border-red-200 bg-red-50 p-4"><p className="label !text-red-600">Denial reason</p><p className="whitespace-pre-wrap text-sm leading-relaxed text-red-700">{selected.denialReason}</p></div>}
              <ApplicationReadOnlyAnswers form={selected.formSnapshot} answers={selected.answers} />

              <section className="rounded-xl border border-aqua-200 p-4">
                <div className="flex items-center gap-2"><ShieldIcon width={16} height={16} className="text-aqua-600" /><h3 className="font-display text-base font-bold text-navy-900">Private review notes</h3></div>
                <p className="mt-1 text-xs text-navy-400">Only Owner, Manager, and Developer application managers can see these notes.</p>
                <form onSubmit={addNote} className="mt-4 space-y-3">
                  <Field label="Add a note" htmlFor="application-note"><textarea id="application-note" className="input" rows={3} maxLength={4000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Private context for other reviewers" /></Field>
                  {noteError && <ErrorNote>{noteError}</ErrorNote>}
                  <button type="submit" className="btn-subtle" disabled={notePending || note.trim().length < 2}>{notePending ? "Saving…" : "Save private note"}</button>
                </form>
                {selected.notes.length > 0 && <div className="mt-4 space-y-3 border-t border-aqua-100 pt-4">{selected.notes.map((item) => <div key={item.id} className="rounded-lg bg-aqua-50/60 p-3"><p className="whitespace-pre-wrap text-sm leading-relaxed text-navy-700">{item.body}</p><p className="mt-2 text-[11px] text-navy-400">{item.authorUsername} · {formatApplicationDate(item.createdAt)}</p></div>)}</div>}
              </section>

              <section className="rounded-xl border border-aqua-200 p-4">
                <h3 className="font-display text-base font-bold text-navy-900">Status history</h3>
                <div className="mt-4 space-y-3">{selected.history.map((entry) => <div key={entry.id} className="flex gap-3"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-aqua-400" /><div><p className="text-xs font-semibold text-navy-700">{entry.action.replaceAll("_", " ")}{entry.toStatus ? ` → ${entry.toStatus}` : ""}</p><p className="mt-0.5 text-[11px] text-navy-400">{entry.actorUsername} · {formatApplicationDate(entry.createdAt)}</p>{entry.reason && <p className="mt-1 whitespace-pre-wrap text-xs text-navy-500">{entry.reason}</p>}</div></div>)}</div>
              </section>

              {selected.status === "pending" ? (
                <div className="flex flex-col gap-3 border-t border-aqua-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="max-w-md text-xs leading-relaxed text-navy-400">Accepting records a decision only. It does not assign a rank or grant Minecraft permissions.</p>
                  <div className="flex shrink-0 gap-2"><button type="button" className="btn-danger" onClick={() => { setDecision("denied"); setDecisionError(""); }}><CloseIcon width={14} height={14} />Deny</button><button type="button" className="btn bg-emerald-600 px-4 py-2 text-xs text-white hover:bg-emerald-700" onClick={() => { setDecision("accepted"); setDecisionError(""); }}><CheckIcon width={14} height={14} />Accept</button></div>
                </div>
              ) : <p className="rounded-xl border border-aqua-100 bg-aqua-50/60 p-4 text-xs text-navy-500">This application is {selected.status}{selected.reviewedBy ? ` by ${selected.reviewedBy}` : ""}{selected.decidedAt ? ` on ${formatApplicationDate(selected.decidedAt)}` : ""}. Decisions cannot be changed in the application system.</p>}
            </div>
          ) : null}
        </Modal>
      )}

      {decision && selected && (
        <Modal title={decision === "accepted" ? `Accept ${selected.displayId}?` : `Deny ${selected.displayId}?`} description={decision === "accepted" ? "This records your decision and notifies the applicant on their status page." : "A clear denial reason is required and will be visible to the applicant."} onClose={() => { if (!decisionPending) { setDecision(null); setDecisionError(""); } }}>
          {decision === "denied" && <Field label="Denial reason" htmlFor="denial-reason" hint="10–2000 characters. Avoid sharing private review notes."><textarea id="denial-reason" className="input" rows={5} maxLength={2000} value={denialReason} onChange={(event) => setDenialReason(event.target.value)} placeholder="Explain the decision respectfully" /></Field>}
          {decision === "accepted" && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-800">Accepting does <strong>not</strong> grant Minecraft permissions or assign a staff rank. Handle any server access separately.</p>}
          {decisionError && <div className="mt-3"><ErrorNote>{decisionError}</ErrorNote></div>}
          <div className="mt-6 flex justify-end gap-2"><button type="button" className="btn-ghost !py-2.5 text-xs" disabled={decisionPending} onClick={() => setDecision(null)}>Cancel</button><button type="button" className={`btn !py-2.5 text-xs ${decision === "accepted" ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-red-600 text-white hover:bg-red-700"}`} disabled={decisionPending || (decision === "denied" && denialReason.trim().length < 10)} onClick={() => void confirmDecision()}>{decisionPending ? "Saving…" : decision === "accepted" ? "Confirm acceptance" : "Confirm denial"}</button></div>
        </Modal>
      )}
    </div>
  );
}
