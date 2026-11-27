import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { ResetPasswordFlow } from "@/components/reset-password-flow";
import { getBranding } from "@/lib/branding";
import { getContent } from "@/lib/content";
import { RESET_VERIFY_COOKIE, resolveVerification } from "@/lib/password-reset-code";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getBranding();
  return {
    title: "Reset password",
    description: `Choose a new password for your ${branding.name} account.`,
    robots: { index: false, follow: false },
    other: { referrer: "no-referrer" },
  };
}

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  const [settings, copy] = await Promise.all([getSettings(), getContent()]);
  const store = await cookies();
  const nonce = store.get(RESET_VERIFY_COOKIE)?.value ?? "";
  const verification = nonce ? await resolveVerification(nonce) : null;

  return (
    <AuthShell
      heading={copy["reset.heading"]}
      subheading={copy["reset.subheading"]}
      cardTitle={copy["reset.cardTitle"]}
      cardDescription={copy["reset.cardDescription"]}
      headerAction={
        <Link href="/login" className="btn-ghost !px-4 !py-2 text-xs">
          {copy["password.backToLogin"]}
        </Link>
      }
      ip={settings.ip}
      discord={settings.discord}
      brandName={copy["brand.login"]}
      community={copy["password.community"]}
      footer={copy["password.footer"]}
    >
      <ResetPasswordFlow brandName={copy["brand.login"]} verified={Boolean(verification)} />
    </AuthShell>
  );
}
