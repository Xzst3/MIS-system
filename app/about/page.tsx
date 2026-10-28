import type { Metadata } from "next";
import { PublicShell, ArrowLink } from "@/components/public-shell";
export const metadata: Metadata = { title: "Our story" };
export default function Page() {
  return (
    <PublicShell>
      <section className="shell page-hero">
        <span className="eyebrow">THE ELDER CARE FOUNDATION</span>
        <h1>
          More clarity.
          <br />
          <em>More possibility.</em>
        </h1>
        <p>
          We believe the journey of aging should feel more manageable, more
          connected and more human.
        </p>
      </section>
      <section className="shell page-content">
        <div className="wide-photo">
          <img
            src="/images/a-little-guidance.webp"
            alt="An older woman and her daughter looking through a folder together"
          />
        </div>
        <div className="story-grid">
          <h2>
            There is a person
            <br />
            behind <em>every question.</em>
          </h2>
          <div>
            <p>
              Insurance letters. Benefits forms. Appointments. Finding the right
              professional. For older adults and their families, the practical
              side of aging can feel like a maze.
            </p>
            <p>
              The Elder Care Foundation is a startup charitable organization
              building a centralized information, guidance and coordination
              network. We exist to make that maze easier to navigate.
            </p>
            <p>
              Our work begins with listening, continues with clear information
              and leads to connections with appropriate external services. We
              meet uncertainty with a practical next step.
            </p>
          </div>
        </div>
        <div className="service-grid">
          {[
            [
              "01",
              "A buffer against bureaucracy",
              "We help translate complicated systems, paperwork and processes into clearer, more manageable steps.",
            ],
            [
              "02",
              "Information with a human touch",
              "We connect useful research and practical guidance with the real priorities of older adults and their families.",
            ],
            [
              "03",
              "A connected support network",
              "We bring together information about independent professionals and services so people can find an appropriate starting point.",
            ],
          ].map(([n, t, d]) => (
            <article className="service-card" key={n}>
              <span className="eyebrow">{n} / OUR APPROACH</span>
              <h3 style={{ marginTop: 35 }}>{t}</h3>
              <p>{d}</p>
            </article>
          ))}
        </div>
        <div className="notice">
          We are building our foundation step by step. We do not operate
          residential care facilities or provide direct medical or physical
          treatment. Our focus is information, guidance and connections.
        </div>
        <ArrowLink href="/get-involved">
          Help us build what comes next
        </ArrowLink>
      </section>
    </PublicShell>
  );
}
