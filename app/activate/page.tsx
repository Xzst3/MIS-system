import { AuthForm } from "@/components/auth-form";
export const metadata = {
  title: "Activate your account",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <AuthForm activate />;
}
