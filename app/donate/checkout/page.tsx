import type { Metadata } from "next";
import Link from "next/link";
import { GivingCheckout } from "@/components/giving-checkout";
import { PublicShell } from "@/components/public-shell";

export const metadata: Metadata = { title: "Donation preview" };

export default function DonationCheckoutPage() {
  return (
    <PublicShell>
      <section className="shell giving-checkout-page">
        <Link href="/donate" className="text-link">
          Back to giving
        </Link>
        <h1>Donation preview</h1>
        <GivingCheckout />
      </section>
    </PublicShell>
  );
}
