import type { Metadata } from "next";
import { PublicShell, ArrowLink } from "@/components/public-shell";
import { IntakeForm } from "@/components/intake-form";
export const metadata: Metadata = { title: "Get involved" };
export default function Page() {
  return (
    <PublicShell>
      <section className="shell page-hero">
        <span className="eyebrow">GOOD THINGS GROW THROUGH CONNECTION</span>
        <h1>
          Bring a little of yourself.
          <br />
          <em>Make room for good.</em>
        </h1>
        <p>
          Your time, skills and connections can help shape a clearer path for
          older adults and their families.
        </p>
      </section>
      <section className="shell page-content">
        <div className="wide-photo">
          <img
            src="/images/a-community-beside-you.webp"
            alt="A volunteer and an older man walking and talking in a sunny garden"
          />
        </div>
        <div className="form-layout" id="interest">
          <div className="form-intro">
            <span className="eyebrow">LET’S BUILD SOMETHING MEANINGFUL</span>
            <h2>
              There’s more than
              <br />
              one way <em>to help.</em>
            </h2>
            <p>
              Share your interest in volunteering, community outreach,
              fundraising or a professional partnership. We’ll review your
              details as our network grows.
            </p>
            <div className="notice">
              Volunteer applications and partnership requests are expressions of
              interest. Roles and referrals are subject to the foundation’s
              review and appropriate checks.
            </div>
            <ArrowLink href="/donate">Prefer to support with a gift?</ArrowLink>
          </div>
          <IntakeForm kind="volunteer" />
        </div>
        <div className="involve-options">
          <article className="involve-card">
            <span className="eyebrow">COMMUNITY & FUNDRAISING</span>
            <h3>Something good is growing.</h3>
            <p>
              Charity auctions, community initiatives and fundraising
              opportunities are part of our plans. Confirmed events will be
              shared here as they become available.
            </p>
            <ArrowLink href="#interest">Register your interest</ArrowLink>
          </article>
          <article className="involve-card">
            <span className="eyebrow">PROFESSIONAL PARTNERS</span>
            <h3>Your expertise. A shared purpose.</h3>
            <p>
              We welcome interest from qualified professionals and organizations
              across our seven service areas. Help us build a connected resource
              network.
            </p>
            <ArrowLink href="#interest">
              Start a partnership conversation
            </ArrowLink>
          </article>
        </div>
      </section>
    </PublicShell>
  );
}
