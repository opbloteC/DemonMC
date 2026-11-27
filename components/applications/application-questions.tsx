"use client";

import type {
  ApplicationAnswers,
  ApplicationAnswerValue,
  ApplicationForm,
  ApplicationQuestion,
} from "@/lib/application-types";

function questionKey(question: ApplicationQuestion, sectionIndex: number, questionIndex: number): string {
  return question.id === null ? `preview-${sectionIndex}-${questionIndex}` : String(question.id);
}

export function ApplicationAnswerFields({
  form,
  values,
  errors = {},
  onChange,
  disabled = false,
  idPrefix = "application",
}: {
  form: ApplicationForm;
  values: ApplicationAnswers;
  errors?: Record<string, string>;
  onChange: (key: string, value: ApplicationAnswerValue) => void;
  disabled?: boolean;
  idPrefix?: string;
}) {
  return (
    <div className="space-y-8">
      {form.sections.map((section, sectionIndex) => (
        <fieldset key={section.id ?? `section-${sectionIndex}`} className="min-w-0">
          <legend className="font-display text-lg font-bold text-navy-900">{section.title}</legend>
          <div className="mt-5 space-y-5">
            {section.questions.map((question, questionIndex) => {
              const key = questionKey(question, sectionIndex, questionIndex);
              const id = `${idPrefix}-${key}`;
              const value = values[key] ?? (question.type === "checkboxes" ? [] : "");
              const error = errors[key];
              const isChoiceGroup = ["multiple_choice", "checkboxes", "yes_no"].includes(question.type);
              const describedBy = [question.description ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ");
              const common = {
                id,
                disabled,
                required: question.required,
                "aria-invalid": Boolean(error),
                "aria-describedby": describedBy || undefined,
                className: `input ${error ? "input-invalid" : ""}`,
              };
              return (
                <div key={key} role={isChoiceGroup ? "group" : undefined} aria-labelledby={isChoiceGroup ? `${id}-label` : undefined}>
                  <label id={`${id}-label`} htmlFor={isChoiceGroup ? undefined : id} className="label">
                    {question.title}
                    {question.required && <span className="ml-1 text-ember" aria-hidden="true">*</span>}
                    <span className="sr-only">{question.required ? " (required)" : " (optional)"}</span>
                  </label>
                  {question.description && (
                    <p id={`${id}-hint`} className="mb-2 whitespace-pre-line text-xs leading-relaxed text-navy-500">
                      {question.description}
                    </p>
                  )}
                  {question.type === "long_text" ? (
                    <textarea
                      {...common}
                      rows={6}
                      maxLength={5000}
                      value={String(value)}
                      onChange={(event) => onChange(key, event.target.value)}
                      placeholder="Write your answer here"
                    />
                  ) : question.type === "dropdown" ? (
                    <select
                      {...common}
                      value={String(value)}
                      onChange={(event) => onChange(key, event.target.value)}
                    >
                      <option value="">Choose an option</option>
                      {question.options.map((option, index) => <option key={`${option}-${index}`} value={option}>{option}</option>)}
                    </select>
                  ) : question.type === "multiple_choice" ? (
                    <div id={id} className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-required={question.required} aria-invalid={Boolean(error)} aria-describedby={question.description || error ? describedBy : undefined}>
                      {question.options.map((option, index) => (
                        <label key={`${option}-${index}`} className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-3 text-sm transition-colors ${value === option ? "border-aqua-400 bg-aqua-50 text-navy-900" : "border-aqua-200 bg-white/70 text-navy-600 hover:border-aqua-300"} ${disabled ? "cursor-not-allowed opacity-60" : ""}`}>
                          <input
                            type="radio"
                            name={id}
                            value={option}
                            checked={value === option}
                            disabled={disabled}
                            required={question.required}
                            onChange={() => onChange(key, option)}
                            className="accent-[#f4842d]"
                          />
                          {option}
                        </label>
                      ))}
                    </div>
                  ) : question.type === "checkboxes" ? (
                    <div id={id} className="grid gap-2 sm:grid-cols-2">
                      {question.options.map((option, index) => {
                        const selected = Array.isArray(value) ? value : [];
                        return (
                          <label key={`${option}-${index}`} className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-3 text-sm transition-colors ${selected.includes(option) ? "border-aqua-400 bg-aqua-50 text-navy-900" : "border-aqua-200 bg-white/70 text-navy-600 hover:border-aqua-300"} ${disabled ? "cursor-not-allowed opacity-60" : ""}`}>
                            <input
                              type="checkbox"
                              checked={selected.includes(option)}
                              disabled={disabled}
                              onChange={() => onChange(key, selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option])}
                              className="accent-[#f4842d]"
                            />
                            {option}
                          </label>
                        );
                      })}
                    </div>
                  ) : question.type === "yes_no" ? (
                    <div id={id} className="grid grid-cols-2 gap-2" role="radiogroup" aria-required={question.required} aria-invalid={Boolean(error)} aria-describedby={error ? describedBy : undefined}>
                      {question.options.map((option) => (
                        <label key={option} className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${value === option ? "border-aqua-400 bg-aqua-50 text-navy-900" : "border-aqua-200 bg-white/70 text-navy-600 hover:border-aqua-300"} ${disabled ? "cursor-not-allowed opacity-60" : ""}`}>
                          <input type="radio" name={id} checked={value === option} disabled={disabled} required={question.required} onChange={() => onChange(key, option)} className="accent-[#f4842d]" />
                          {option}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <input
                      {...common}
                      type="text"
                      maxLength={300}
                      value={String(value)}
                      onChange={(event) => onChange(key, event.target.value)}
                      placeholder="Type your answer"
                    />
                  )}
                  {error && <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs text-red-600">{error}</p>}
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

export function ApplicationReadOnlyAnswers({
  form,
  answers,
}: {
  form: ApplicationForm;
  answers: ApplicationAnswers;
}) {
  return (
    <div className="space-y-7">
      {form.sections.map((section, sectionIndex) => (
        <section key={section.id ?? `section-${sectionIndex}`}>
          <h4 className="font-display text-base font-bold text-navy-900">{section.title}</h4>
          <dl className="mt-3 space-y-4">
            {section.questions.map((question, questionIndex) => {
              const key = questionKey(question, sectionIndex, questionIndex);
              const raw = answers[key];
              const answer = Array.isArray(raw) ? raw.join(", ") : raw;
              return (
                <div key={key} className="rounded-xl border border-aqua-100 bg-aqua-50/50 px-4 py-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-navy-500">{question.title}</dt>
                  <dd className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-navy-800">{answer || "Not answered"}</dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}
    </div>
  );
}
