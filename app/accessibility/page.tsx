import { PublicShell, ArrowLink } from "@/components/public-shell";
export const metadata = { title: "Accessibility" };
export default function Page() {
  return (
    <PublicShell>
      <section className="shell page-hero">
        <span className="eyebrow">A CLEARER PATH FOR EVERYONE</span>
        <h1>
          Made to be <em>approachable.</em>
        </h1>
        <p>We want information to feel easier to read, understand and use.</p>
      </section>
      <article className="shell legal">
        <h2>Using this website</h2>
        <p>
          You can navigate links, buttons and forms with a keyboard. Use Tab to
          move forward and Shift + Tab to move back. A skip link takes you
          directly to the main content. Browser zoom can enlarge the page.
        </p>
        <h2>Motion and readability</h2>
        <p>
          The layout adjusts to smaller screens. Decorative motion is reduced
          when your device’s reduced-motion setting is enabled. Images have text
          alternatives and forms have visible labels.
        </p>
        <h2>Help us improve</h2>
        <p>
          If a page or form is difficult to use, please let the team know
          through our support form. Accessibility review is ongoing; we do not
          claim independent accessibility certification.
        </p>
        <ArrowLink href="/get-support">Tell us what you need</ArrowLink>
      </article>
    </PublicShell>
  );
}
