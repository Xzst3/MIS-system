import { PublicShell } from "@/components/public-shell";
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
        <h2>What we collect</h2>
        <p>
          Our public forms collect your name, email address, selected area of
          interest and, for a donation pledge, your chosen amount. We record
          your consent and the time of your request. Please do not submit
          medical records, identity numbers or financial documents.
        </p>
        <h2>How we use it</h2>
        <p>
          Authorized foundation team members use your details to review your
          request, coordinate an appropriate response and manage related
          administration. A pledge is a record of interest; we do not collect
          card details or process a payment through these forms.
        </p>
        <h2>Where information is stored</h2>
        <p>
          The site is hosted by Vercel and stores form submissions and
          operational records in a Neon Postgres database. Access to internal
          records is restricted by staff role. The current hosting configuration
          uses a US database region.
        </p>
        <h2>Cookies and security</h2>
        <p>
          Signed-in team members receive an essential session cookie lasting up
          to eight hours. Passwords are stored as salted hashes, not readable
          text. The demonstration workspace stores fictional examples in your
          browser only. This release does not add advertising or third-party
          analytics.
        </p>
        <h2>Your choices</h2>
        <p>
          You can choose not to submit a form. For questions about a request you
          have already made, use the support form with the same email address
          and select “I’m not sure where to start.” Ask the team to review,
          correct or delete your details. Do not include sensitive information.
        </p>
        <h2>Retention</h2>
        <p>
          Operational records are retained until an authorized administrator
          reviews them. A formal retention schedule, direct privacy contact and
          any jurisdiction-specific notices must be confirmed by the foundation
          before wider operational use.
        </p>
        <p>Last updated: October 28, 2026.</p>
      </article>
    </PublicShell>
  );
}
