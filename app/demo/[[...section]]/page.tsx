import { notFound } from "next/navigation";
import { Workspace } from "@/components/workspace";
import { demoUser } from "@/lib/demo-data";
import { canAccess } from "@/lib/permissions.mjs";
export const metadata = {
  title: "Workspace demo",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section } = await params;
  const view = section?.[0] || "overview";
  if (!canAccess("admin", view) || (section && section.length > 1)) notFound();
  return <Workspace user={demoUser} view={view} demo />;
}
