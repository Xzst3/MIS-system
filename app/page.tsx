import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  Heart,
  Compass,
  Users,
  MoveDown,
  Check,
  Flower2,
} from "lucide-react";
import { PublicShell, ArrowLink } from "@/components/public-shell";
import { services, resources } from "@/lib/content";
export default function Home() {
  return (
    <PublicShell>
      <section className="hero shell">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="tiny-sun">✳</span> GUIDANCE. CONNECTION. PEACE OF
            MIND.
          </div>
          <h1>
            A clearer path.
            <br />A little more <em>peace.</em>
          </h1>
          <p>
            Aging brings questions. You don’t have to find every answer alone.
            We help older adults and families navigate what comes next,
            together.
          </p>
          <div className="hero-actions">
            <Link href="/get-support" className="button button-dark">
              Find your next step <ArrowUpRight size={19} />
            </Link>
            <Link className="hero-secondary" href="/services">
              See how we help <ArrowRight size={17} />
            </Link>
          </div>
          <div className="hero-assurance">
            <div className="little-icon">
              <Heart size={17} />
            </div>
            <span>
              For you. For your family.
              <br />
              <strong>For every chapter ahead.</strong>
            </span>
          </div>
        </div>
        <div className="hero-art">
          <div className="hero-photo">
            <img
              src="/images/a-little-guidance.webp"
              alt="An older woman and her adult daughter enjoying a reassuring conversation at a sunlit table"
              fetchPriority="high"
            />
            <div className="hero-photo-caption">
              <span className="pulse-dot" /> THE NEXT CHAPTER STARTS WITH
              CONNECTION
            </div>
          </div>
          <div className="floating-note">
            <div className="note-icon">
              <Compass size={25} />
            </div>
            <span>
              You bring the questions.
              <br />
              <strong>We’ll help find the way.</strong>
            </span>
            <svg
              width="50"
              height="38"
              viewBox="0 0 50 38"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M3 12c25-17 37 0 22 12C11 35 5 22 16 20c10-2 17 6 27 8m-7-8 8 9-12 3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="hero-flower" aria-hidden="true">
            ✳
          </div>
        </div>
      </section>
      <div className="principle-strip">
        <div className="shell">
          <span>A human approach to navigating aging</span>
          <span>
            <Check size={16} /> Clear information
          </span>
          <span>
            <Check size={16} /> Thoughtful guidance
          </span>
          <span>
            <Check size={16} /> Trusted connections
          </span>
        </div>
      </div>
      <section className="shell section intro-section reveal">
        <div className="section-label">
          <span className="eyebrow">A LITTLE CLARITY GOES A LONG WAY</span>
          <span className="section-number">01 / OUR PURPOSE</span>
        </div>
        <div className="intro-grid">
          <h2>
            Less overwhelm.
            <br />
            <em>More living.</em>
          </h2>
          <div>
            <p className="large-copy">
              When the forms pile up and the next step feels unclear, it helps
              to have someone in your corner.
            </p>
            <p>
              We’re an information and connection network built around people.
              From understanding benefits to finding the right professional, we
              turn a complicated journey into smaller, more manageable steps.
            </p>
            <ArrowLink href="/about">Get to know our foundation</ArrowLink>
          </div>
        </div>
      </section>
      <section className="services-section">
        <div className="shell section">
          <div className="section-label reveal">
            <span className="eyebrow">SUPPORT FOR THE WHOLE PICTURE</span>
            <span className="section-number">02 / HOW WE HELP</span>
          </div>
          <div className="section-heading reveal">
            <h2>
              Life is connected.
              <br />
              <em>Your support should be, too.</em>
            </h2>
            <ArrowLink href="/services">Explore all seven areas</ArrowLink>
          </div>
          <div className="service-grid">
            {services.slice(0, 3).map((s, i) => (
              <Link
                className="service-card reveal"
                key={s.slug}
                href={"/services#" + s.slug}
              >
                <span className="service-index">0{i + 1}</span>
                <s.icon className="service-icon" size={34} strokeWidth={1.3} />
                <h3>{s.name}</h3>
                <p>{s.description}</p>
                <span className="service-arrow">
                  <ArrowUpRight size={20} />
                </span>
              </Link>
            ))}
          </div>
          <p className="service-other">
            And guidance with healthcare, benefits, end-of-life planning and
            transportation.
            <Link href="/services" aria-label="View all service areas">
              <ArrowRight size={18} />
            </Link>
          </p>
        </div>
      </section>
      <section className="shell section journey-section reveal">
        <div className="journey-heading">
          <span className="eyebrow">ONE STEP AT A TIME</span>
          <h2>
            You don’t need a plan
            <br />
            to <em>get started.</em>
          </h2>
          <p>
            Just a question, a concern, or a feeling that things could be a
            little easier.
          </p>
          <ArrowLink href="/get-support">
            Let’s talk about what you need
          </ArrowLink>
        </div>
        <div className="journey-steps">
          {[
            [
              "We listen first.",
              "Tell us what matters to you. We start with your situation, your priorities and your pace.",
            ],
            [
              "We make things clearer.",
              "Together, we identify useful information and a practical next step.",
            ],
            [
              "We connect the dots.",
              "We help you find the external services and qualified professionals that fit your needs.",
            ],
          ].map(([t, d], i) => (
            <div className="journey-step" key={t}>
              <span>0{i + 1}</span>
              <div>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
              {i < 2 && <MoveDown className="step-down" size={18} />}
            </div>
          ))}
        </div>
      </section>
      <section className="community-band">
        <div className="community-photo">
          <img
            src="/images/a-community-beside-you.webp"
            alt="An older man and a volunteer sharing a laugh in a community garden"
            loading="lazy"
          />
        </div>
        <div className="community-copy reveal">
          <span className="eyebrow">A COMMUNITY BESIDE YOU</span>
          <h2>
            A little of your time.
            <br />A world of <em>possibility.</em>
          </h2>
          <p>
            A conversation. A helpful connection. A generous gift. There are so
            many ways to make the next chapter brighter for someone else.
          </p>
          <Link className="button button-cream" href="/get-involved">
            Find your way to give back <ArrowUpRight size={18} />
          </Link>
          <div className="community-caption">
            <Users size={18} />
            <span>People helping people find their way.</span>
          </div>
        </div>
      </section>
      <section className="shell section resources-section">
        <div className="section-label reveal">
          <span className="eyebrow">
            A LITTLE KNOWLEDGE, A LITTLE CONFIDENCE
          </span>
          <span className="section-number">03 / THE RESOURCE LIBRARY</span>
        </div>
        <div className="section-heading reveal">
          <h2>
            A good place <em>to begin.</em>
          </h2>
          <ArrowLink href="/resources">Visit the resource library</ArrowLink>
        </div>
        <div className="resource-grid">
          {resources.map((r, i) => (
            <Link
              className="resource-card reveal"
              key={r.id}
              href={"/resources/" + r.id}
            >
              <div className={"resource-cover " + r.color}>
                <span className="cover-label">
                  THE ELDER CARE FOUNDATION
                  <br />A LITTLE GUIDANCE SERIES
                </span>
                {i === 0 ? (
                  <Compass size={76} strokeWidth={0.8} />
                ) : i === 1 ? (
                  <div className="paper-art">
                    <i />
                    <i />
                    <i />
                  </div>
                ) : (
                  <Flower2 size={80} strokeWidth={0.9} />
                )}
                <span className="cover-bottom">
                  {
                    [
                      "YOUR NEXT CHAPTER",
                      "MAKE SPACE FOR CLARITY",
                      "BETTER, TOGETHER",
                    ][i]
                  }
                  <ArrowUpRight size={17} />
                </span>
              </div>
              <div className="resource-info">
                <span className="eyebrow">
                  {r.category} <span>· {r.read}</span>
                </span>
                <h3>{r.title}</h3>
                <p>{r.description}</p>
                <span className="text-link">
                  Read the guide <ArrowUpRight size={17} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
      <section className="donation-banner shell reveal">
        <div className="donation-sun" aria-hidden="true">
          ✳
        </div>
        <div>
          <span className="eyebrow">SMALL ACTS. MEANINGFUL CHANGE.</span>
          <h2>
            Help someone find
            <br />
            <em>their next step.</em>
          </h2>
          <p>
            Your generosity helps build a more connected, more navigable world
            for older adults and their families.
          </p>
        </div>
        <Link className="button button-dark" href="/donate">
          Give a little good <Heart size={18} />
        </Link>
      </section>
    </PublicShell>
  );
}
