import type { ReactNode } from "react";

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-5" data-reveal>
      <div>
        <p className="eyebrow flex items-center gap-3">
          <span className="h-px w-8 bg-sun/80" />
          {eyebrow}
        </p>
        <h2 className="mt-3 font-display text-2xl font-bold uppercase tracking-tight text-navy-900 sm:text-3xl">
          {title}
        </h2>
        {description && (
          <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-navy-500">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
