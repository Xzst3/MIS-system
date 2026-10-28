import type { Metadata } from "next";
import { PublicShell, ArrowLink } from "@/components/public-shell";
import { services } from "@/lib/content";
export const metadata: Metadata = { title: "How we help" };
export default function Page() {
  return (
    <PublicShell>
      <section className="shell page-hero">
        <span className="eyebrow">GUIDANCE FOR THE WHOLE PICTURE</span>
        <h1>
          Life has many moving parts.
          <br />
          <em>Let’s connect them.</em>
        </h1>
        <p>
          We help you find clear information and trusted external support across
          seven connected areas of life.
        </p>
      </section>
      <section className="shell page-content">
        <div className="service-list">
          {services.map((s) => (
            <article className="service-detail reveal" key={s.slug} id={s.slug}>
              <s.icon size={34} strokeWidth={1.3} />
              <div>
                <h3>{s.name}</h3>
                <p>{s.description}</p>
                <ArrowLink href="/get-support">Ask for guidance</ArrowLink>
              </div>
            </article>
          ))}
        </div>
        <div className="notice">
          Our role is to inform, guide and connect. We do not offer medical
          treatment, residential care, legal advice or individualized financial
          advice. External professionals provide their own services
          independently.
        </div>
        <div className="faq">
          <h2>
            A few things <em>you might wonder.</em>
          </h2>
          {[
            [
              "Do I need to know exactly what help I need?",
              "No. You can start with a question or simply tell us you are unsure where to begin. We will work with you to identify a practical next step.",
            ],
            [
              "Can I reach out on behalf of a family member?",
              "Yes. Family members and caregivers are welcome to contact us. The older adult’s preferences and consent remain central to the process.",
            ],
            [
              "Do you directly provide care or treatment?",
              "No. We help people find information and navigate services. Clinical, legal, financial and other professional services are provided by independent external specialists.",
            ],
            [
              "Is this an emergency service?",
              "No. This website and its request form are not monitored for emergencies. For urgent needs, contact the appropriate emergency or local support service directly.",
            ],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}
