import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { PageTransition } from "@/components/site-motion";
import { getSessionUser } from "@/lib/auth";
import { getContent } from "@/lib/content";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [user, settings, copy] = await Promise.all([
    getSessionUser(),
    getSettings(),
    getContent(),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader settings={settings} user={user} copy={copy} />
      <main className="flex-1">
        <PageTransition>{children}</PageTransition>
      </main>
      <SiteFooter settings={settings} user={user} copy={copy} />
    </div>
  );
}
