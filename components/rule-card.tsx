import { RuleGlyph } from "@/components/rule-icons";
import type { RuleIcon } from "@/lib/rule-types";

export interface RuleCardData {
  id: number;
  title: string;
  description: string;
  icon: RuleIcon;
  color: string;
  bold: boolean;
}

export function RuleCard({
  rule,
  index,
  compact = false,
}: {
  rule: RuleCardData;
  index: number;
  compact?: boolean;
}) {
  const number = String(index + 1).padStart(2, "0");

  return (
    <article
      data-rule-id={rule.id}
      className={`rule-card panel relative overflow-hidden ${compact ? "p-5" : "p-6 sm:p-7"}`}
      style={{ borderColor: `${rule.color}40` }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: `linear-gradient(180deg, ${rule.color}, ${rule.color}55)` }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-14 -top-14 h-36 w-36 rounded-full opacity-60 blur-2xl"
        style={{ background: `${rule.color}24` }}
      />
      <div className="relative flex items-start gap-4">
        <span
          className={`rule-card-icon flex shrink-0 items-center justify-center rounded-xl border ${
            compact ? "h-10 w-10" : "h-12 w-12"
          }`}
          style={{
            background: `${rule.color}1f`,
            borderColor: `${rule.color}45`,
            color: rule.color,
          }}
        >
          <RuleGlyph icon={rule.icon} width={compact ? 18 : 21} height={compact ? 18 : 21} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <span
              className="font-mono text-[11px] font-bold tracking-[0.18em]"
              style={{ color: rule.color }}
            >
              {number}
            </span>
            <span className="h-px flex-1 bg-aqua-100" aria-hidden="true" />
          </div>
          <h3
            className={`mt-2 font-display uppercase leading-tight tracking-[0.03em] text-navy-900 ${
              compact ? "text-[15px]" : "text-base sm:text-[17px]"
            }`}
            style={{ fontWeight: rule.bold ? 800 : 500 }}
          >
            {rule.title}
          </h3>
          <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-navy-500">
            {rule.description}
          </p>
        </div>
      </div>
    </article>
  );
}
