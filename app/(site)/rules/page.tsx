import type { Metadata } from "next";
import { DiscordIcon, ShieldIcon } from "@/components/icons";
import { RuleCard } from "@/components/rule-card";
import { listPublicRules } from "@/lib/rules";
import { getBranding } from "@/lib/branding";
import { getContent } from "@/lib/content";
import { getRulesBrandName } from "@/lib/rules-branding";
import { splitRulesBrandName } from "@/lib/rules-branding-types";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getBranding();
  return {
    title: "Server Rules",
    description: `The ${branding.name} community rules. Play fair, respect everyone and make every adventure count.`,
  };
}

export const dynamic = "force-dynamic";

const DISCORD_FALLBACK = "https://discord.gg/mFYwCJBTuA";

export default async function RulesPage() {
  const [rules, settings, rulesBrandName, copy] = await Promise.all([
    listPublicRules(),
    getSettings(),
    getRulesBrandName(),
    getContent(),
  ]);
  const discord = settings.discord || DISCORD_FALLBACK;
  const rulesHeading = splitRulesBrandName(rulesBrandName);

  return (
    <>
      <section className="hero-shell border-b border-aqua-200/60">
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-glow" aria-hidden="true" />
        <div className="container-x relative py-14 sm:py-16" data-reveal>
          <p className="eyebrow flex items-center gap-3">
            <span className="h-px w-8 bg-sun/80" />
            {copy["rules.eyebrow"]}
          </p>
          <h1 className="headline mt-3 break-words text-4xl sm:text-5xl">
            {rulesHeading.leading && <>{rulesHeading.leading} </>}
            <span className="text-sun-deep">{rulesHeading.accent}</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-navy-500 sm:text-base">
            {copy["rules.description"]}
          </p>
        </div>
      </section>

      <section className="container-x pb-16 pt-10 sm:pt-12">
        {rules.length === 0 ? (
          <div className="panel mx-auto flex max-w-2xl flex-col items-center px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-aqua-100 bg-aqua-50 text-ember">
              <ShieldIcon width={20} height={20} />
            </span>
            <h2 className="mt-4 font-display text-lg font-bold text-navy-900">
              The rules are being updated
            </h2>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-navy-500">
              Our staff is publishing a fresh set of server rules. Check back shortly.
            </p>
          </div>
        ) : (
          <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-2 sm:gap-5" data-reveal-group>
            {rules.map((rule, index) => (
              <RuleCard key={rule.id} rule={rule} index={index} />
            ))}
          </div>
        )}
      </section>

      <section className="container-x pb-24">
        <div className="panel relative overflow-hidden border-ember/25 bg-gradient-to-br from-white/95 via-aqua-50/90 to-ember/[0.07]" data-reveal>
          <div className="block-motif pointer-events-none absolute inset-0 opacity-30" aria-hidden="true" />
          <div
            className="absolute -left-20 -top-24 h-56 w-56 rounded-full bg-ember/10 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative flex flex-col items-center gap-6 px-6 py-10 text-center sm:px-10">
            <p className="font-display text-xl font-extrabold uppercase leading-tight tracking-[0.06em] text-navy-900 sm:text-2xl">
              {copy["rules.closing.title"]}
            </p>
            <a
              href={discord}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary !rounded-full !px-7 !py-3.5 text-sm"
            >
              <DiscordIcon width={18} height={18} />
              {copy["rules.closing.cta"]}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
