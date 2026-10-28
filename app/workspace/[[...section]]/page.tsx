import { redirect, notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { canAccess } from "@/lib/permissions.mjs";
import { Workspace } from "@/components/workspace";
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
  return <Workspace user={user} view={view} />;
}
