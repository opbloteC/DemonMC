import type { Metadata } from "next";
import { AnnouncementCard } from "@/components/announcement-card";
import { MegaphoneIcon } from "@/components/icons";
import { getBranding } from "@/lib/branding";
import { getContent } from "@/lib/content";
import { listPublicAnnouncements } from "@/lib/queries";

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getBranding();
  return {
    title: "Announcements",
    description: `News, updates and events from the ${branding.name} network.`,
  };
}

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  const [announcements, copy] = await Promise.all([listPublicAnnouncements(), getContent()]);

  return (
    <>
      <section className="hero-shell border-b border-aqua-200/60">
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-glow" aria-hidden="true" />
        <div className="container-x relative py-14 text-center sm:py-16" data-reveal>
          <p className="eyebrow flex items-center justify-center gap-3">
            <span className="h-px w-8 bg-sun/80" />
            {copy["announcements.eyebrow"]}
          </p>
          <h1 className="headline mt-3 text-4xl sm:text-5xl">
            {copy["announcements.titlePre"]}
            <span className="text-aqua-600">{copy["announcements.titleHighlight"]}</span>
          </h1>
          <p className="mx-auto mt-3 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-navy-500">
            {copy["announcements.description"]}
          </p>
        </div>
      </section>

      <section className="container-x pb-24 pt-10">
        {announcements.length === 0 ? (
          <div className="panel flex flex-col items-center px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-aqua-100 bg-aqua-50 text-aqua-600">
              <MegaphoneIcon width={20} height={20} />
            </span>
            <h2 className="mt-4 font-display text-lg font-bold text-navy-900">
              {copy["announcements.empty.title"]}
            </h2>
            <p className="mt-2 max-w-sm whitespace-pre-line text-sm text-navy-500">
              {copy["announcements.empty.description"]}
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-4" data-reveal-group>
            {announcements.map((announcement) => (
              <AnnouncementCard key={announcement.id} announcement={announcement} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
