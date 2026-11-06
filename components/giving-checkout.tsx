"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  Heart,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { PrivacyNoticeLink } from "./privacy-notice-link";
const purposes = [
  ["general", "Where it is needed most"],
  ["nutrition", "Nutrition navigation"],
  ["financial", "Financial guidance"],
  ["wellbeing", "Mental wellbeing connections"],
  ["healthcare", "Healthcare navigation"],
  ["welfare", "Social welfare support"],
  ["planning", "Later-life planning"],
  ["transport", "Transport & accompaniment"],
  ["operations", "Foundation operations"],
];
export function GivingCheckout() {
  const card = useRef<HTMLDivElement>(null);
  const completion = useRef<HTMLHeadingElement>(null);
  const [amount, setAmount] = useState("50");
  const [state, setState] = useState<"form" | "processing" | "complete">(
    "form",
  );
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  const [clientReference, setClientReference] = useState("");
  useEffect(() => {
    if (state === "complete") {
      card.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
      completion.current?.focus({ preventScroll: true });
    }
  }, [state]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const key = clientReference || crypto.randomUUID();
    setClientReference(key);
    setState("processing");
    setError("");
    try {
      const [response] = await Promise.all([
        fetch("/api/giving", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_reference: key,
            name: form.get("name"),
            email: form.get("email"),
            amount,
            fund_code: form.get("fund_code"),
            consent: form.get("consent") === "on",
            communication_consent: form.get("updates") === "on",
            website: form.get("website") || "",
          }),
        }),
        new Promise((resolve) => setTimeout(resolve, 1400)),
      ]);
      const result = await response.json().catch(() => {
        throw new Error(
          "We could not confirm this checkout. Please retry with the same details.",
        );
      });
      if (!response.ok) throw new Error(result.error);
      setReference(result.reference);
      setState("complete");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
      setState("form");
    }
  }
  return (
    <div className="giving-card" id="giving-checkout" ref={card}>
      <div className="giving-preview-note">
        <ShieldCheck size={18} />
        <span>Interactive checkout · No money will be charged.</span>
      </div>
      {state === "complete" ? (
        <div className="giving-complete" role="status">
          <CheckCircle2 size={54} strokeWidth={1.3} />
          <span className="eyebrow">A LITTLE GOOD, RECORDED</span>
          <h2 ref={completion} tabIndex={-1}>
            Thank you for
            <br />
            <em>being part of it.</em>
          </h2>
          <p>
            Your $
            {Number(amount).toLocaleString("en-US", {
              minimumFractionDigits: 2,
            })}{" "}
            contribution has been recorded. Our team can now review its
            designation and follow its use.
          </p>
          <div className="giving-reference">
            <small>Your transaction reference</small>
            <strong>{reference}</strong>
            <span>Checkout complete · Awaiting team review</span>
          </div>
          <p className="field-hint">
            Keep this reference for your records. This checkout does not create
            a bank charge or a tax receipt.
          </p>
          <Link href="/services" className="button button-dark">
            See the work you support <ArrowUpRight size={18} />
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} aria-busy={state === "processing"}>
          <h2>Give a little good.</h2>
          <p>Choose your gift and the work you would like it to support.</p>
          <fieldset disabled={state === "processing"}>
            <div className="giving-options" aria-label="Suggested gift amounts">
              {["25", "50", "100", "250"].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={amount === value}
                  className={amount === value ? "selected" : ""}
                  onClick={() => {
                    setAmount(value);
                    setClientReference("");
                  }}
                >
                  ${value}
                </button>
              ))}
            </div>
            <label className="field">
              Your gift (USD)
              <input
                type="number"
                min="1"
                max="10000"
                step="0.01"
                required
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setClientReference("");
                }}
              />
            </label>
            <label className="field">
              Put my gift toward
              <select
                name="fund_code"
                defaultValue="general"
                onChange={() => setClientReference("")}
              >
                {purposes.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <div className="giving-name-grid">
              <label className="field">
                Your full name
                <input
                  name="name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={100}
                  placeholder="First and last name"
                  onChange={() => setClientReference("")}
                />
              </label>
              <label className="field">
                Email address
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  placeholder="you@example.com"
                  onChange={() => setClientReference("")}
                />
              </label>
            </div>
            <div className="honeypot" aria-hidden="true">
              <input name="website" tabIndex={-1} autoComplete="off" />
            </div>
            <label className="check-field">
              <input type="checkbox" name="consent" required />
              <span>
                I agree that the foundation may record my details and contact me
                about this gift. Read our{" "}
                <PrivacyNoticeLink returnLabel="Back to my gift" />.
              </span>
            </label>
            <label className="check-field">
              <input type="checkbox" name="updates" />
              <span>I would also like to receive foundation updates.</span>
            </label>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <button type="submit" className="button button-dark">
              {state === "processing" ? (
                <>
                  <LoaderCircle className="spin" size={21} /> Processing your
                  gift…
                </>
              ) : (
                <>
                  Give $
                  {Number(amount || 0).toLocaleString("en-US", {
                    maximumFractionDigits: 2,
                  })}{" "}
                  <Heart size={19} />
                </>
              )}
            </button>
          </fieldset>
          {state === "processing" && (
            <p role="status" className="giving-progress">
              Please keep this page open while we record your contribution.
            </p>
          )}
        </form>
      )}
    </div>
  );
}
