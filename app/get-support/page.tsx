import type { Metadata } from "next";
import { PublicShell } from "@/components/public-shell";
import { IntakeForm } from "@/components/intake-form";
export const metadata: Metadata = { title: "Find support" };
export default function Page() {
  return (
    <PublicShell>
      <section className="shell form-layout">
        <div className="form-intro">
          <span className="eyebrow">A GOOD PLACE TO START</span>
          <h1>
            One question.
            <br />
            <em>A way forward.</em>
          </h1>
          <p>
            You don’t need to have everything figured out. Tell us a little
            about the kind of guidance you’re looking for, and we’ll begin
            there.
          </p>
          <div className="form-mini-photo">
            <img
              src="/images/a-little-guidance.webp"
              alt="A reassuring conversation between an older woman and her daughter"
            />
          </div>
          <div className="notice">
            This form is for initial contact only. Please keep sensitive
            documents and personal health information out of your request. In an
            emergency, contact your local emergency service.
          </div>
        </div>
        <IntakeForm kind="support" />
      </section>
    </PublicShell>
  );
}
