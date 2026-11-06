import { redirect, notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { canAccess } from "@/lib/permissions.mjs";
import { Workspace } from "@/components/workspace";
import { BusinessWorkspace } from "@/components/business-workspace";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Foundation workspace",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { section } = await params;
  const view = section?.[0] || "overview";
  if (section && section.length > 1) notFound();
  if (!canAccess(user.role, view)) redirect("/workspace");
  if (["overview","finance","transparency","people","services","reports","donors","volunteers","clients","referrals"].includes(view)) return <BusinessWorkspace user={user} view={view}/>;
  return <Workspace user={user} view={view} />;
}
