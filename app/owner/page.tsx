import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Dashboard } from "@/components/staff/dashboard";
import { getSessionUser } from "@/lib/auth";
import { getBranding } from "@/lib/branding";
import { isOwnerAccount, userCan } from "@/lib/types";

export const metadata: Metadata = {
  title: "Owner console",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OwnerPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/owner");
  if (!isOwnerAccount(user)) {
    redirect(
      userCan(user, "staff_panel.access")
        ? "/admin"
        : userCan(user, "staff_workspace.access")
          ? "/staff"
          : "/",
    );
  }

  const branding = await getBranding();

  return (
    <Dashboard
      user={user}
      mode="owner"
      initialTab="rank-management"
      brandName={branding.name}
      tabs={[
        "overview",
        "players",
        "accounts",
        "announcements",
        "rules",
        "applications",
        "application-editor",
        "reports",
        "store",
        "page-names",
        "branding",
        "rank-management",
        "rank-order",
        "rank-players",
        "rank-permissions",
        "player-permissions",
        "permission-overview",
        "audit",
        "logos",
        "content",
        "usernames",
        "server-status",
        "settings",
        "account",
      ]}
    />
  );
}
