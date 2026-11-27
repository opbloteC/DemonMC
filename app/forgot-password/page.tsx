import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { getBranding } from "@/lib/branding";
import { getContent } from "@/lib/content";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getBranding();
  return {
    title: "Forgot password",
    description: `Request a secure ${branding.name} password reset verification code.`,
    robots: { index: false, follow: false },
  };
}

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  const [settings, copy] = await Promise.all([getSettings(), getContent()]);

  return (
    <AuthShell
      heading={copy["forgot.heading"]}
      subheading={copy["forgot.subheading"]}
      cardTitle={copy["forgot.cardTitle"]}
      cardDescription={copy["forgot.cardDescription"]}
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
      <ForgotPasswordForm brandName={copy["brand.login"]} />
    </AuthShell>
  );
}
