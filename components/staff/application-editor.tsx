"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  EyeIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";
import { ApplicationAnswerFields } from "@/components/applications/application-questions";
import {
  APPLICATION_CATEGORIES,
  APPLICATION_CATEGORY_META,
  APPLICATION_QUESTION_TYPE_LABELS,
  APPLICATION_QUESTION_TYPES,
  type ApplicationCategory,
  type ApplicationForm,
  type ApplicationQuestion,
  type ApplicationQuestionType,
  type ApplicationSection,
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

interface ManagementResponse {
  forms: ApplicationForm[];
  pendingCounts: Record<ApplicationCategory, number>;
}

function copyForm(form: ApplicationForm): ApplicationForm {
  return JSON.parse(JSON.stringify(form)) as ApplicationForm;
}

function newQuestion(): ApplicationQuestion {
  return { id: null, title: "", description: "", type: "long_text", required: true, options: [] };
}

export function ApplicationEditor({ notify }: { notify: Notify }) {
  const [forms, setForms] = useState<ApplicationForm[]>([]);
  const [category, setCategory] = useState<ApplicationCategory>("staff");
  const [draft, setDraft] = useState<ApplicationForm | null>(null);
  const [saved, setSaved] = useState<ApplicationForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, string | string[]>>({});
  const [removeTarget, setRemoveTarget] = useState<{ section: number; question?: number } | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiRequest<ManagementResponse>("/api/admin/applications/forms")
      .then((data) => {
        if (!active) return;
        setForms(data.forms);
        const first = data.forms.find((form) => form.category === "staff") ?? data.forms[0];
        if (first) {
          setCategory(first.category);
          setDraft(copyForm(first));
          setSaved(copyForm(first));
        }
      })
      .catch((error) => { if (active) setLoadError(errorMessage(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const questionCount = useMemo(() => draft?.sections.reduce((total, section) => total + section.questions.length, 0) ?? 0, [draft]);
  const dirty = Boolean(draft && saved && JSON.stringify(draft) !== JSON.stringify(saved));

  function chooseCategory(next: ApplicationCategory) {
    const form = forms.find((item) => item.category === next);
    if (!form) return;
    setCategory(next);
    setDraft(copyForm(form));
    setSaved(copyForm(form));
    setPreview(false);
    setPreviewAnswers({});
    setSaveError("");
  }

  function update<K extends keyof ApplicationForm>(key: K, value: ApplicationForm[K]) {
    setDraft((current) => current ? { ...current, [key]: value } : current);
  }

  function updateSection(index: number, patch: Partial<ApplicationSection>) {
    setDraft((current) => current ? {
      ...current,
      sections: current.sections.map((section, sectionIndex) => sectionIndex === index ? { ...section, ...patch } : section),
    } : current);
  }

  function updateQuestion(sectionIndex: number, questionIndex: number, patch: Partial<ApplicationQuestion>) {
    setDraft((current) => current ? {
      ...current,
      sections: current.sections.map((section, currentSectionIndex) => currentSectionIndex === sectionIndex ? {
        ...section,
        questions: section.questions.map((question, currentQuestionIndex) => currentQuestionIndex === questionIndex ? { ...question, ...patch } : question),
      } : section),
    } : current);
  }

  function moveSection(index: number, direction: -1 | 1) {
    const target = index + direction;
    setDraft((current) => {
      if (!current || target < 0 || target >= current.sections.length) return current;
      const sections = [...current.sections];
      [sections[index], sections[target]] = [sections[target], sections[index]];
      return { ...current, sections };
    });
  }

  function moveQuestion(sectionIndex: number, questionIndex: number, direction: -1 | 1) {
    const target = questionIndex + direction;
    setDraft((current) => {
      if (!current) return current;
      const sections = [...current.sections];
      const questions = [...sections[sectionIndex].questions];
      if (target < 0 || target >= questions.length) return current;
      [questions[questionIndex], questions[target]] = [questions[target], questions[questionIndex]];
      sections[sectionIndex] = { ...sections[sectionIndex], questions };
      return { ...current, sections };
    });
  }

  function addSection() {
    if (!draft || draft.sections.length >= 100) return;
    update("sections", [...draft.sections, { id: null, title: "New section", questions: [newQuestion()] }]);
  }

  function addQuestion(sectionIndex: number) {
    if (!draft || questionCount >= 500) return;
    updateSection(sectionIndex, { questions: [...draft.sections[sectionIndex].questions, newQuestion()] });
  }

  function confirmRemove() {
    if (!draft || !removeTarget) return;
    if (removeTarget.question === undefined) {
      if (draft.sections.length === 1) return;
      update("sections", draft.sections.filter((_, index) => index !== removeTarget.section));
    } else {
      const section = draft.sections[removeTarget.section];
      if (section.questions.length === 1) return;
      updateSection(removeTarget.section, { questions: section.questions.filter((_, index) => index !== removeTarget.question) });
    }
    setRemoveTarget(null);
  }

  async function save() {
    if (!draft) return;
    setSaveError("");
    setSaving(true);
    try {
      const data = await apiRequest<{ form: ApplicationForm }>("/api/admin/applications/forms", { method: "PUT", body: draft });
      const next = data.form;
      setDraft(copyForm(next));
      setSaved(copyForm(next));
      setForms((current) => current.map((form) => form.category === next.category ? next : form));
      setPreview(false);
      notify(`${APPLICATION_CATEGORY_META[next.category].cardTitle} saved. Public changes are live.`);
    } catch (error) {
      setSaveError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="panel p-10"><Spinner label="Loading application editor" /></div>;
  if (loadError) return <div className="panel p-6"><ErrorNote>{loadError}</ErrorNote></div>;
  if (!draft || !saved) return <div className="panel"><EmptyState icon={<PlusIcon width={20} height={20} />} title="No application forms" description="The default forms have not been initialized." /></div>;

  return (
    <div className="space-y-5">
      <div className="panel p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold text-navy-900">Application Editor</h2>
            <p className="mt-1 text-sm text-navy-500">Edit each category independently. Saving updates the public form without changing old submissions.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setPreview(true)} className="btn-subtle"><EyeIcon width={14} height={14} />Preview</button>
            <button type="button" onClick={() => void save()} disabled={saving || !dirty} className="btn-primary !py-2.5 text-xs">{saving ? "Saving…" : dirty ? "Save changes" : "Saved"}</button>
          </div>
        </div>
        <div className="mt-5 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Application categories">
          {APPLICATION_CATEGORIES.map((item) => (
            <button key={item} type="button" role="tab" aria-selected={category === item} onClick={() => chooseCategory(item)} className={`shrink-0 rounded-xl border px-4 py-2.5 text-xs font-semibold transition-colors ${category === item ? "border-aqua-400 bg-aqua-100 text-navy-900" : "border-aqua-200 bg-white/70 text-navy-500 hover:border-aqua-300"}`}>
              {APPLICATION_CATEGORY_META[item].label}
            </button>
          ))}
        </div>
        {dirty && <p className="mt-3 text-xs font-semibold text-amber-700">You have unsaved changes in this category.</p>}
      </div>

      {saveError && <ErrorNote>{saveError}</ErrorNote>}

      <section className="panel space-y-5 p-5 sm:p-6">
        <h3 className="font-display text-base font-bold text-navy-900">Form content & settings</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Application title" htmlFor="application-title"><input id="application-title" className="input" maxLength={120} value={draft.title} onChange={(event) => update("title", event.target.value)} /></Field>
          <Field label="Submission button text" htmlFor="application-submit-label"><input id="application-submit-label" className="input" maxLength={60} value={draft.submitLabel} onChange={(event) => update("submitLabel", event.target.value)} /></Field>
        </div>
        <Field label="Description" htmlFor="application-description"><textarea id="application-description" className="input" rows={3} maxLength={2000} value={draft.description} onChange={(event) => update("description", event.target.value)} /></Field>
        <Field label="Closing message" htmlFor="application-closing" hint="Shown after submission and when applications are closed."><textarea id="application-closing" className="input" rows={3} maxLength={2000} value={draft.closingMessage} onChange={(event) => update("closingMessage", event.target.value)} /></Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex items-center justify-between gap-3 rounded-xl border border-aqua-200 bg-white/70 px-4 py-3 text-sm text-navy-700"><span>Applications enabled</span><input type="checkbox" className="accent-[#f4842d]" checked={draft.enabled} onChange={(event) => update("enabled", event.target.checked)} /></label>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-aqua-200 bg-white/70 px-4 py-3 text-sm text-navy-700"><span>Allow reapplication</span><input type="checkbox" className="accent-[#f4842d]" checked={draft.allowReapplyAfterDenial} onChange={(event) => update("allowReapplyAfterDenial", event.target.checked)} /></label>
          <Field label="Wait after denial (hours)" htmlFor="application-wait"><input id="application-wait" type="number" min={0} max={8760} className="input" value={draft.reapplyWaitHours} onChange={(event) => update("reapplyWaitHours", Number(event.target.value))} /></Field>
        </div>
        <p className="text-xs leading-relaxed text-navy-400">Disabling applications or editing this form never deletes submissions. Reapplication waiting periods apply only after a denial.</p>
      </section>

      <div className="flex items-center justify-between gap-3">
        <div><h3 className="font-display text-base font-bold text-navy-900">Sections & questions</h3><p className="mt-1 text-xs text-navy-400">{draft.sections.length} sections · {questionCount} questions · saved order is preserved in PostgreSQL</p></div>
        <button type="button" onClick={addSection} disabled={draft.sections.length >= 100} className="btn-subtle"><PlusIcon width={14} height={14} />Add section</button>
      </div>

      {draft.sections.map((section, sectionIndex) => (
        <section key={section.id ?? `new-section-${sectionIndex}`} className="panel overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-aqua-100 bg-aqua-50/50 p-5 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1"><label htmlFor={`section-title-${sectionIndex}`} className="label">Section {sectionIndex + 1}</label><input id={`section-title-${sectionIndex}`} className="input !bg-white" maxLength={120} value={section.title} onChange={(event) => updateSection(sectionIndex, { title: event.target.value })} /></div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button type="button" className="icon-btn" disabled={sectionIndex === 0} onClick={() => moveSection(sectionIndex, -1)} aria-label={`Move section ${sectionIndex + 1} up`} title="Move up"><ArrowUpIcon width={14} height={14} /></button>
              <button type="button" className="icon-btn" disabled={sectionIndex === draft.sections.length - 1} onClick={() => moveSection(sectionIndex, 1)} aria-label={`Move section ${sectionIndex + 1} down`} title="Move down"><ArrowDownIcon width={14} height={14} /></button>
              <button type="button" className="icon-btn !border-red-200 !text-red-500" disabled={draft.sections.length === 1} onClick={() => setRemoveTarget({ section: sectionIndex })} aria-label={`Remove section ${sectionIndex + 1}`}><TrashIcon width={14} height={14} /></button>
            </div>
          </div>
          <div className="space-y-4 p-5">
            {section.questions.map((question, questionIndex) => (
              <div key={question.id ?? `new-question-${sectionIndex}-${questionIndex}`} className="rounded-xl border border-aqua-200 bg-white/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-navy-400">Question {questionIndex + 1}</p>
                  <div className="flex items-center gap-1.5">
                    <button type="button" className="icon-btn" disabled={questionIndex === 0} onClick={() => moveQuestion(sectionIndex, questionIndex, -1)} aria-label={`Move question ${questionIndex + 1} up`}><ArrowUpIcon width={13} height={13} /></button>
                    <button type="button" className="icon-btn" disabled={questionIndex === section.questions.length - 1} onClick={() => moveQuestion(sectionIndex, questionIndex, 1)} aria-label={`Move question ${questionIndex + 1} down`}><ArrowDownIcon width={13} height={13} /></button>
                    <button type="button" className="icon-btn !border-red-200 !text-red-500" disabled={section.questions.length === 1} onClick={() => setRemoveTarget({ section: sectionIndex, question: questionIndex })} aria-label={`Remove question ${questionIndex + 1}`}><TrashIcon width={13} height={13} /></button>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_200px]">
                  <Field label="Question title" htmlFor={`question-title-${sectionIndex}-${questionIndex}`}><input id={`question-title-${sectionIndex}-${questionIndex}`} className="input" maxLength={240} value={question.title} onChange={(event) => updateQuestion(sectionIndex, questionIndex, { title: event.target.value })} placeholder="Enter a question" /></Field>
                  <Field label="Answer type" htmlFor={`question-type-${sectionIndex}-${questionIndex}`}><select id={`question-type-${sectionIndex}-${questionIndex}`} className="input" value={question.type} onChange={(event) => {
                    const type = event.target.value as ApplicationQuestionType;
                    updateQuestion(sectionIndex, questionIndex, { type, options: type === "yes_no" ? ["Yes", "No"] : ["dropdown", "multiple_choice", "checkboxes"].includes(type) && question.options.length < (type === "checkboxes" ? 1 : 2) ? type === "checkboxes" ? ["Option 1"] : ["Option 1", "Option 2"] : question.options });
                  }}>{APPLICATION_QUESTION_TYPES.map((type) => <option key={type} value={type}>{APPLICATION_QUESTION_TYPE_LABELS[type]}</option>)}</select></Field>
                </div>
                <div className="mt-3"><Field label="Instructions / description" htmlFor={`question-description-${sectionIndex}-${questionIndex}`}><textarea id={`question-description-${sectionIndex}-${questionIndex}`} className="input" rows={2} maxLength={1200} value={question.description} onChange={(event) => updateQuestion(sectionIndex, questionIndex, { description: event.target.value })} placeholder="Optional help for the applicant" /></Field></div>
                {["dropdown", "multiple_choice", "checkboxes"].includes(question.type) && (
                  <div className="mt-3"><Field label="Options" hint="One option per line. Dropdowns and multiple choice need at least two; checkboxes need at least one."><textarea className="input" rows={Math.min(8, Math.max(3, question.options.length + 1))} value={question.options.join("\n")} onChange={(event) => updateQuestion(sectionIndex, questionIndex, { options: event.target.value.split("\n") })} /></Field></div>
                )}
                <label className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-navy-600"><input type="checkbox" className="accent-[#f4842d]" checked={question.required} onChange={(event) => updateQuestion(sectionIndex, questionIndex, { required: event.target.checked })} />Required answer</label>
              </div>
            ))}
            <button type="button" onClick={() => addQuestion(sectionIndex)} disabled={questionCount >= 500} className="btn-subtle w-full border-dashed"><PlusIcon width={14} height={14} />Add question</button>
          </div>
        </section>
      ))}

      <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-2xl border border-aqua-200 bg-white/95 p-4 shadow-panel backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-navy-500">{dirty ? "Review your changes, then save to publish this form." : "All changes saved."}</p>
        <div className="flex gap-2"><button type="button" className="btn-ghost !py-2.5 text-xs" onClick={() => setPreview(true)}><EyeIcon width={14} height={14} />Preview</button><button type="button" className="btn-primary !py-2.5 text-xs" disabled={saving || !dirty} onClick={() => void save()}>{saving ? "Saving…" : dirty ? "Save & publish" : "Saved"}<CheckIcon width={14} height={14} /></button></div>
      </div>

      {preview && (
        <Modal title={`Preview · ${draft.title}`} description="This is how applicants will see the current unsaved draft." onClose={() => setPreview(false)} wide>
          <div className="rounded-xl border border-aqua-100 bg-aqua-50/50 p-4"><p className="whitespace-pre-line text-sm leading-relaxed text-navy-600">{draft.description}</p></div>
          <div className="mt-6"><ApplicationAnswerFields form={draft} values={previewAnswers} onChange={(key, value) => setPreviewAnswers((current) => ({ ...current, [key]: value }))} disabled idPrefix="application-preview" /></div>
          <button type="button" disabled className="btn-primary mt-7 w-full !py-3 text-xs">{draft.submitLabel}</button>
        </Modal>
      )}

      {removeTarget && (
        <ConfirmDialog title={removeTarget.question === undefined ? "Remove this section?" : "Remove this question?"} message="This removes it from the public form when you save. Existing submissions keep their immutable snapshots and answers." confirmLabel="Remove" pending={false} onCancel={() => setRemoveTarget(null)} onConfirm={confirmRemove} />
      )}
    </div>
  );
}
