import type { Metadata } from "next";
import { Compass, Heart, Waypoints } from "lucide-react";
import { PublicShell, ArrowLink } from "@/components/public-shell";
import Link from "next/link";
export const metadata: Metadata = { title: "Give a little good" };
export default function Page() {
  return (
    <PublicShell>
      <section className="shell giving-layout">
        <div className="giving-story giving-intro">
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
        </div>
        <section className="giving-qr" aria-labelledby="giving-qr-title">
          <h2 id="giving-qr-title">Scan to give</h2>
          <p>Scan with your phone camera to open the giving page.</p>
          <Link href="/donate/checkout" className="giving-qr-image">
            <img
              src="/images/donation-qr.png"
              alt="QR code to open the donation preview"
              width={492}
              height={492}
            />
          </Link>
          <Link href="/donate/checkout" className="button button-dark">
            Open donation preview
          </Link>
          <p className="giving-qr-note">
            Preview only. No payment is collected.
          </p>
        </section>
        <div className="giving-details">
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
      </section>
    </PublicShell>
  );
}
