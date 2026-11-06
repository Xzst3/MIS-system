import type { Metadata } from "next";
import { PublicShell, ArrowLink } from "@/components/public-shell";
import { services } from "@/lib/content";
import { serviceDetails } from "@/lib/service-details";
export const metadata: Metadata = { title: "Our services" };
export default function Page() {
  return (
    <PublicShell>
      <section className="shell page-hero">
        <span className="eyebrow">
          INFORMATION. CONNECTION. PRACTICAL SUPPORT.
        </span>
        <h1>
          The next step,
          <br />
          <em>with someone beside you.</em>
        </h1>
        <p>
          Seven connected areas of support. We listen, help make sense of your
          options and connect you with the right people.
        </p>
        <div className="service-jump-nav">
          {services.map((s) => (
            <a key={s.slug} href={"#" + s.slug}>
              {s.short}
            </a>
          ))}
        </div>
      </section>
      <section className="shell service-stories">
        {services.map((s, i) => {
          const d = serviceDetails[s.slug];
          return (
            <article
              className={"service-story reveal " + (i % 2 ? "reverse" : "")}
              key={s.slug}
              id={s.slug}
            >
              <div className="service-story-image">
                <img
                  src={"/images/service-" + d.image + ".webp"}
                  alt={d.alt}
                  loading={i ? "lazy" : "eager"}
                />
                <span>0{i + 1} / A CLEARER NEXT STEP</span>
              </div>
              <div className="service-story-copy">
                <s.icon size={33} strokeWidth={1.3} />
                <h2>{s.name}</h2>
                <p>{s.description}</p>
                <ul>
                  {d.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
                <div className="service-example">
                  <span className="eyebrow">WHAT THIS CAN LOOK LIKE</span>
                  <p>{d.example}</p>
                </div>
                <ArrowLink href="/get-support">
                  Leave your email. Let’s arrange a conversation.
                </ArrowLink>
              </div>
            </article>
          );
        })}
        <div className="service-scope">
          <h2>
            Guidance from us.
            <br />
            <em>Specialist care from the right people.</em>
          </h2>
          <p>
            Our team provides information, administrative support, referrals and
            practical coordination. Independent professionals provide clinical
            treatment, legal advice and individualized financial advice.
            Transport and accompaniment depend on availability and agreed
            arrangements.
          </p>
          <ArrowLink href="/get-support">Start with a question</ArrowLink>
        </div>
      </section>
    </PublicShell>
  );
}
