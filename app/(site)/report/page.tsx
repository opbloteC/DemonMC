import type { Metadata } from "next";
import { ReportHub } from "@/components/reports/report-hub";
import { getSessionUser } from "@/lib/auth";
import { getBranding } from "@/lib/branding";

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getBranding();
  return {
    title: "Report",
    description: `Report a player or a bug to the ${branding.name} staff team.`,
  };
}

export const dynamic = "force-dynamic";

export default async function ReportPage() {
  const user = await getSessionUser();
  const defaultSubmitter = user ? (user.minecraftUsername ?? user.username) : "";

  return (
    <>
      <section className="hero-shell border-b border-aqua-200/60">
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-glow" aria-hidden="true" />
        <div className="container-x relative py-14 text-center sm:py-20" data-reveal>
          <p className="eyebrow flex items-center justify-center gap-3">
            <span className="h-px w-8 bg-sun/80" />
            Help the team
            <span className="h-px w-8 bg-sun/80" />
          </p>
          <h1 className="headline mx-auto mt-4 max-w-4xl text-4xl sm:text-5xl lg:text-6xl">
            REPORT A PLAYER OR <span className="text-aqua-600">A BUG</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-navy-500 sm:text-base">
            Reports go straight to the DemonMC staff team. Choose what you are reporting, add proof,
            and we will review it privately.
          </p>
        </div>
      </section>
      <ReportHub defaultSubmitter={defaultSubmitter} />
    </>
  );
}
