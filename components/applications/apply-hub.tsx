"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  ImageIcon,
  ShieldIcon,
} from "@/components/icons";
import type {
  ApplicationAnswers,
  ApplicationAnswerValue,
  ApplicationCategory,
  ApplicationEligibility,
  ApplicationForm,
  ApplicationSubmissionDetail,
  ApplicationSubmissionSummary,
} from "@/lib/application-types";
import { APPLICATION_CATEGORY_META, isApplicationCategory } from "@/lib/application-types";
import { ApplicationAnswerFields, ApplicationReadOnlyAnswers } from "./application-questions";
import { ApplicationStatusBadge, formatApplicationDate } from "./application-status";
import { apiRequest, EmptyState, ErrorNote, errorMessage, Modal, Spinner } from "@/components/staff/ui";

const CATEGORY_ICONS = {
  staff: ShieldIcon,
  media: ImageIcon,
};

export function ApplyHub({
  forms,
  submissions: initialSubmissions,
  eligibility,
  signedIn,
  initialCategory,
}: {
  forms: ApplicationForm[];
  submissions: ApplicationSubmissionSummary[];
  eligibility: ApplicationEligibility[];
  signedIn: boolean;
  initialCategory?: ApplicationCategory;
}) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<ApplicationCategory | null>(initialCategory ?? null);
  const [answers, setAnswers] = useState<ApplicationAnswers>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState<ApplicationSubmissionSummary | null>(null);
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [detail, setDetail] = useState<ApplicationSubmissionDetail | null>(null);
  const [detailPending, setDetailPending] = useState(false);
  const [detailError, setDetailError] = useState("");

  const selectedForm = forms.find((form) => form.category === selectedCategory) ?? null;
  const selectedEligibility = eligibility.find((item) => item.category === selectedCategory) ?? null;

  function chooseCategory(category: ApplicationCategory) {
    setSelectedCategory(category);
    setAnswers({});
    setErrors({});
    setFormError("");
    setSuccess(null);
    window.setTimeout(() => document.getElementById("application-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
  }

  function updateAnswer(key: string, value: ApplicationAnswerValue) {
    setAnswers((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedForm || !selectedEligibility?.canApply) return;
    setFormError("");
    setErrors({});
    const localErrors: Record<string, string> = {};
    for (const section of selectedForm.sections) {
      for (const question of section.questions) {
        if (question.id === null || !question.required) continue;
        const value = answers[String(question.id)];
        if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
          localErrors[String(question.id)] = "This answer is required.";
        }
      }
    }
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      setFormError("Please complete every required question.");
      return;
    }
    setPending(true);
    try {
      const data = await apiRequest<{ submission: ApplicationSubmissionSummary }>("/api/applications/submit", {
        method: "POST",
        body: { category: selectedForm.category, version: selectedForm.version, answers },
      });
      setSuccess(data.submission);
      setSubmissions((current) => [data.submission, ...current]);
      setAnswers({});
      router.refresh();
    } catch (error) {
      const data = error as Error & { fieldErrors?: Record<string, string> };
      if (data.fieldErrors) setErrors(data.fieldErrors);
      setFormError(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  async function openSubmission(id: number) {
    setDetail(null);
    setDetailError("");
    setDetailPending(true);
    try {
      const data = await apiRequest<{ submission: ApplicationSubmissionDetail }>(`/api/applications/mine/${id}`);
      setDetail(data.submission);
    } catch (error) {
      setDetailError(errorMessage(error));
    } finally {
      setDetailPending(false);
    }
  }

  return (
    <>
      <section className="container-x pb-8 pt-10 sm:pt-12" data-reveal-group>
        <div className="grid gap-4 md:grid-cols-2">
          {forms.map((form) => {
            const meta = APPLICATION_CATEGORY_META[form.category];
            const Icon = CATEGORY_ICONS[form.category];
            const status = eligibility.find((item) => item.category === form.category);
            const selected = selectedCategory === form.category;
            return (
              <button
                key={form.id}
                type="button"
                onClick={() => chooseCategory(form.category)}
                aria-pressed={selected}
                className={`panel group relative overflow-hidden p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-aqua-300 hover:shadow-[0_28px_60px_-34px_rgba(12,110,160,0.55)] ${selected ? "!border-sun/60 !bg-white ring-2 ring-sun/15" : ""}`}
              >
                <span className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-sun/10 transition-transform duration-300 group-hover:scale-125" aria-hidden="true" />
                <span className="relative grid h-12 w-12 place-items-center rounded-2xl border border-aqua-200 bg-aqua-50 text-aqua-600 transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105">
                  <Icon width={22} height={22} />
                </span>
                <h2 className="relative mt-5 font-display text-xl font-bold text-navy-900">{meta.cardTitle}</h2>
                <p className="relative mt-2 min-h-[60px] text-sm leading-relaxed text-navy-500">{meta.description}</p>
                <span className="relative mt-5 inline-flex items-center gap-2 text-xs font-semibold text-sun-deep">
                  {form.enabled ? "View application" : "Applications closed"}
                  <ArrowRightIcon width={14} height={14} className="transition-transform group-hover:translate-x-1" />
                </span>
                {status?.latestStatus && <span className="absolute bottom-5 right-5"><ApplicationStatusBadge status={status.latestStatus} /></span>}
              </button>
            );
          })}
        </div>
      </section>

      {selectedForm && selectedEligibility && (
        <section id="application-form" className="container-x scroll-mt-28 pb-10">
          {success ? (
            <div className="panel mx-auto max-w-3xl p-7 text-center sm:p-10">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600">
                <CheckIcon width={25} height={25} />
              </span>
              <p className="eyebrow mt-5">Application received</p>
              <h2 className="mt-2 font-display text-2xl font-extrabold text-navy-900">THANK YOU FOR APPLYING</h2>
              <p className="mx-auto mt-3 max-w-xl whitespace-pre-line text-sm leading-relaxed text-navy-500">{selectedForm.closingMessage}</p>
              <div className="mx-auto mt-6 max-w-sm rounded-xl border border-aqua-100 bg-aqua-50/70 p-4 text-sm text-navy-700">
                <p><strong>{success.displayId}</strong> · {APPLICATION_CATEGORY_META[success.category].label}</p>
                <p className="mt-2 text-xs text-navy-500">Submitted {formatApplicationDate(success.submittedAt)}</p>
              </div>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <button type="button" className="btn-primary !py-2.5 text-xs" onClick={() => document.getElementById("my-applications")?.scrollIntoView({ behavior: "smooth" })}>Track application</button>
                <button type="button" className="btn-ghost !py-2.5 text-xs" onClick={() => { setSelectedCategory(null); setSuccess(null); }}>Back to categories</button>
              </div>
            </div>
          ) : !selectedEligibility.canApply ? (
            <div className="panel mx-auto max-w-3xl p-7 sm:p-9">
              <div className="flex items-start gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600"><ClockIcon width={20} height={20} /></span>
                <div>
                  <h2 className="font-display text-xl font-bold text-navy-900">{selectedForm.title}</h2>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-navy-500">{selectedEligibility.message}</p>
                  {!signedIn && <Link href="/login?next=/apply" className="btn-primary mt-5 !py-2.5 text-xs">Sign in to apply <ArrowRightIcon width={14} height={14} /></Link>}
                </div>
              </div>
            </div>
          ) : (
            <div className="panel mx-auto max-w-3xl overflow-hidden">
              <div className="border-b border-aqua-100 bg-aqua-50/50 px-6 py-6 sm:px-8">
                <p className="eyebrow">{APPLICATION_CATEGORY_META[selectedForm.category].label}</p>
                <h2 className="mt-2 font-display text-2xl font-extrabold text-navy-900">{selectedForm.title}</h2>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-navy-500">{selectedForm.description}</p>
                <p className="mt-3 text-xs text-navy-400">Fields marked <span className="text-ember">*</span> are required. Your answers cannot be edited after submission.</p>
              </div>
              <form onSubmit={submit} noValidate className="space-y-7 p-6 sm:p-8">
                {formError && <ErrorNote>{formError}</ErrorNote>}
                <ApplicationAnswerFields form={selectedForm} values={answers} errors={errors} onChange={updateAnswer} disabled={pending} />
                <div className="flex flex-col gap-3 border-t border-aqua-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[11px] leading-relaxed text-navy-400">Submitting creates a permanent application record. Accepting it does not grant server permissions.</p>
                  <button type="submit" disabled={pending} className="btn-primary shrink-0 !py-3 text-xs">
                    {pending ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Submitting…</> : <>{selectedForm.submitLabel}<ArrowRightIcon width={14} height={14} /></>}
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>
      )}

      <section id="my-applications" className="container-x scroll-mt-28 pb-24 pt-4">
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Your applications</p>
              <h2 className="mt-2 font-display text-2xl font-bold text-navy-900">APPLICATION STATUS</h2>
              <p className="mt-1.5 text-sm text-navy-500">Only you can see your submissions and decisions.</p>
            </div>
            {submissions.length > 0 && <span className="badge border-aqua-200 bg-white text-navy-600">{submissions.length} total</span>}
          </div>
          <div className="panel mt-5 overflow-hidden">
            {!signedIn ? (
              <EmptyState icon={<ClockIcon width={20} height={20} />} title="Sign in to track applications" description="Your application history is private to your DemonMC account." action={<Link href="/login?next=/apply" className="btn-primary !py-2.5 text-xs">Sign in</Link>} />
            ) : submissions.length === 0 ? (
              <EmptyState icon={<ClockIcon width={20} height={20} />} title="No applications yet" description="Choose a category above to send your first application." />
            ) : (
              <div className="divide-y divide-aqua-100">
                {submissions.map((submission) => (
                  <button key={submission.id} type="button" onClick={() => void openSubmission(submission.id)} className="flex w-full flex-col gap-3 px-5 py-4 text-left transition-colors hover:bg-aqua-50/60 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-navy-900">{submission.displayId}</span>
                        <ApplicationStatusBadge status={submission.status} />
                      </div>
                      <p className="mt-1.5 text-sm font-semibold text-navy-700">{APPLICATION_CATEGORY_META[submission.category].cardTitle} · {submission.minecraftUsername}</p>
                      <p className="mt-1 text-xs text-navy-400">Submitted {formatApplicationDate(submission.submittedAt)}</p>
                    </div>
                    <span className="inline-flex items-center gap-2 text-xs font-semibold text-aqua-700">View submission <ArrowRightIcon width={13} height={13} /></span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {(detailPending || detail || detailError) && (
        <Modal title={detail ? `${detail.displayId} · ${APPLICATION_CATEGORY_META[detail.category].cardTitle}` : "Application details"} description={detail ? `Submitted ${formatApplicationDate(detail.submittedAt)}` : undefined} onClose={() => { setDetail(null); setDetailError(""); }} wide>
          {detailPending ? <Spinner label="Loading your submission" /> : detailError ? <ErrorNote>{detailError}</ErrorNote> : detail ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-aqua-100 bg-aqua-50/60 p-4">
                <ApplicationStatusBadge status={detail.status} />
                <span className="text-xs text-navy-500">Minecraft: <strong className="text-navy-800">{detail.minecraftUsername}</strong></span>
                <span className="text-xs text-navy-500">Discord: <strong className="text-navy-800">{detail.discordUsername}</strong></span>
              </div>
              {detail.status === "denied" && detail.denialReason && <div className="rounded-xl border border-red-200 bg-red-50 p-4"><p className="label !text-red-600">Denial reason</p><p className="whitespace-pre-wrap text-sm leading-relaxed text-red-700">{detail.denialReason}</p></div>}
              {detail.status === "accepted" && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">Your application was accepted. Server permissions, if any, are assigned separately by management.</p>}
              <ApplicationReadOnlyAnswers form={detail.formSnapshot} answers={detail.answers} />
              <p className="border-t border-aqua-100 pt-4 text-xs text-navy-400">These answers are a read-only snapshot from when you applied.</p>
            </div>
          ) : null}
        </Modal>
      )}
    </>
  );
}
