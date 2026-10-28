import type { Metadata } from "next";
import { Heart, Compass, Users, ArrowUpRight } from "lucide-react";
import { PublicShell } from "@/components/public-shell";
import { IntakeForm } from "@/components/intake-form";
export const metadata: Metadata = { title: "Give a little good" };
export default function Page() {
  const checkout = process.env.NEXT_PUBLIC_DONATION_URL;
  return (
    <PublicShell>
      <section className="shell form-layout">
        <div className="form-intro">
          <span className="eyebrow">SMALL ACTS. MEANINGFUL CHANGE.</span>
          <h1>
            A little generosity.
            <br />
            <em>A brighter chapter.</em>
          </h1>
          <p>
            Help us build an information and navigation network that makes aging
            feel less overwhelming for older adults and their families.
          </p>
          <div style={{ marginTop: 35 }}>
            {[
              [
                Compass,
                "Clearer information",
                "Support accessible guidance and practical navigation resources.",
              ],
              [
                Users,
                "Stronger connections",
                "Help connect people with relevant services and external professionals.",
              ],
              [
                Heart,
                "A foundation for the future",
                "Be part of building a thoughtful, sustainable charitable network.",
              ],
            ].map(([Icon, t, d]) => {
              const I = Icon as typeof Compass;
              return (
                <div className="task-item" key={String(t)}>
                  <I size={22} strokeWidth={1.3} />
                  <div>
                    <strong style={{ fontSize: 15 }}>{String(t)}</strong>
                    <p style={{ fontSize: 12 }}>{String(d)}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="notice">
            No goods or services are promised in exchange for a pledge. We do
            not make any claim about tax deductibility. Donation processing and
            receipting will be confirmed by the foundation.
          </div>
          {checkout && /^https:\/\//.test(checkout) && (
            <a
              className="button button-dark"
              href={checkout}
              rel="noopener noreferrer"
            >
              Open secure donation checkout <ArrowUpRight size={17} />
            </a>
          )}
        </div>
        <IntakeForm kind="donation" />
      </section>
    </PublicShell>
  );
}
