import type { Metadata } from "next";
import { Compass, Heart, Waypoints } from "lucide-react";
import { PublicShell, ArrowLink } from "@/components/public-shell";
import { GivingCheckout } from "@/components/giving-checkout";
export const metadata: Metadata = { title: "Give a little good" };
export default function Page() {
  return (
    <PublicShell>
      <section className="shell giving-layout">
        <div className="giving-story">
          <span className="eyebrow">GENEROSITY, WITH A CLEAR PURPOSE</span>
          <h1>
            A little generosity.
            <br />
            <em>A clearer way forward.</em>
          </h1>
          <p className="large-copy">
            Help older adults find the information, connections and practical
            support that make the next chapter easier.
          </p>
          <a href="#giving-checkout" className="button button-dark giving-skip">
            Make a gift
          </a>
          <div className="giving-story-photo">
            <img
              src="/images/service-transport.webp"
              alt="An older adult and a volunteer preparing for an accompanied journey"
            />
          </div>
          <div className="giving-principles">
            {[
              [
                Compass,
                "A purpose for every gift",
                "Choose a service area or let the foundation direct support where it is needed most.",
              ],
              [
                Waypoints,
                "A traceable journey",
                "Our team records each contribution, reviews its use and connects spending to the work it supports.",
              ],
              [
                Heart,
                "People at the centre",
                "Your generosity supports guidance, referrals, transport and the everyday work behind them.",
              ],
            ].map(([Icon, title, copy]) => {
              const I = Icon as typeof Compass;
              return (
                <div key={String(title)}>
                  <I size={24} strokeWidth={1.4} />
                  <span>
                    <strong>{String(title)}</strong>
                    <p>{String(copy)}</p>
                  </span>
                </div>
              );
            })}
          </div>
          <ArrowLink href="/get-involved">
            Giving an item or exploring a partnership?
          </ArrowLink>
        </div>
        <GivingCheckout />
      </section>
    </PublicShell>
  );
}
