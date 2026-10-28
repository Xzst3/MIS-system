import { PublicShell } from "@/components/public-shell";
import { BackButton } from "@/components/back-button";
import { privacySections } from "@/lib/privacy";
export const metadata = { title: "Privacy notice" };
export default function Page() {
  return (
    <PublicShell>
      <section className="shell page-hero">
        <span className="eyebrow">YOUR INFORMATION MATTERS</span>
        <h1>
          Privacy <em>notice.</em>
        </h1>
        <p>How this website handles the information you choose to share.</p>
      </section>
      <article className="shell legal">
        <BackButton />
        {privacySections.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.text}</p>
          </section>
        ))}
        <p>Last updated: October 28, 2026.</p>
        <BackButton />
      </article>
    </PublicShell>
  );
}
