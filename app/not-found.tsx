import Link from "next/link";
import { PublicShell } from "@/components/public-shell";
export default function NotFound() {
  return (
    <PublicShell>
      <div className="shell empty-page">
        <span className="eyebrow">LET’S FIND YOUR WAY BACK</span>
        <h1>
          A little <em>detour.</em>
        </h1>
        <p>We couldn’t find that page.</p>
        <Link href="/" className="button button-dark">
          Back to our home
        </Link>
      </div>
    </PublicShell>
  );
}
