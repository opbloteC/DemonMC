import type { Metadata } from "next";
import { ApplyHub } from "@/components/applications/apply-hub";
import { getSessionUser } from "@/lib/auth";
import { getBranding } from "@/lib/branding";
import { listPublicApplicationState } from "@/lib/applications";
import { isApplicationCategory, type ApplicationCategory } from "@/lib/application-types";

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getBranding();
  return {
    title: "Apply",
    description: `Apply for a Staff or Media position on the ${branding.name} team.`,
  };
}

export const dynamic = "force-dynamic";

export default async function ApplyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [user, params] = await Promise.all([getSessionUser(), searchParams]);
  const state = await listPublicApplicationState(user?.id ?? null);
  const requested = typeof params.category === "string" ? params.category : undefined;
  const initialCategory: ApplicationCategory | undefined = requested && isApplicationCategory(requested) ? requested : undefined;

  return (
    <>
      <section className="hero-shell border-b border-aqua-200/60">
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-glow" aria-hidden="true" />
        <div className="container-x relative py-14 text-center sm:py-20" data-reveal>
          <p className="eyebrow flex items-center justify-center gap-3">
            <span className="h-px w-8 bg-sun/80" />
            Join the team
            <span className="h-px w-8 bg-sun/80" />
          </p>
          <h1 className="headline mx-auto mt-4 max-w-4xl text-4xl sm:text-5xl lg:text-6xl">
            BECOME A PART OF THE <span className="text-aqua-600">DEMONMC TEAM</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-navy-500 sm:text-base">
            Bring your passion, creativity, and experience to DemonMC. Choose the team that fits you and tell us how you can make a difference.
          </p>
        </div>
      </section>
      <ApplyHub
        forms={state.forms}
        submissions={state.submissions}
        eligibility={state.eligibility}
        signedIn={Boolean(user)}
        initialCategory={initialCategory}
      />
    </>
  );
}
