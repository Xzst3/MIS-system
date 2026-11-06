import { redirect } from "next/navigation";
export const metadata = {
  title: "Foundation workspace",
  robots: { index: false, follow: false },
};
export default function Page() {
  redirect("/workspace");
}
