import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Dashboard } from "@/components/staff/dashboard";
import { getSessionUser } from "@/lib/auth";
import { getBranding } from "@/lib/branding";
import { userCan } from "@/lib/types";

export const metadata: Metadata = {
  title: "Staff Panel",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/admin");
  if (!userCan(user, "staff_panel.access")) {
    redirect(userCan(user, "staff_workspace.access") ? "/staff" : "/");
  }

  const branding = await getBranding();

  return (
    <Dashboard user={user} mode="admin" initialTab="accounts" brandName={branding.name} />
  );
}
