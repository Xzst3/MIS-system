"use client";
import Link from "next/link";
import { PrivacyNoticeLink } from "./privacy-notice-link";
import { useState } from "react";
import { ArrowUpRight, CheckCircle2, Heart, ShieldCheck } from "lucide-react";
import { services } from "@/lib/content";
export function IntakeForm({
  kind,
  category = "",
}: {
  kind: "support" | "volunteer" | "donation" | "resource";
  category?: string;
}) {
  const [amount, setAmount] = useState(50);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const isDonation = kind === "donation";
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          name: form.get("name"),
          email: form.get("email"),
          category: form.get("category") || category || "General support",
          amount: isDonation ? Number(form.get("amount") || amount) : undefined,
          consent: form.get("consent") === "on",
          website: form.get("website") || "",
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setMessage(result.message);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to submit. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (message)
    return (
      <div className="form-card form-success" role="status">
        <CheckCircle2 size={44} strokeWidth={1.3} />
        <h2>A good next step.</h2>
        <p>{message}</p>
        <p style={{ marginTop: 15 }}>
          Please keep a note of your request. We do not send an automatic
          confirmation email yet.
        </p>
        <Link className="text-link" href="/">
          Back to our home <ArrowUpRight size={17} />
        </Link>
      </div>
    );
  return (
    <form className="form-card" onSubmit={submit}>
      <h2>
        {isDonation
          ? "Give with intention."
          : kind === "volunteer"
            ? "Make a connection."
            : kind === "resource"
              ? "Stay in the loop."
              : "Let’s begin with you."}
      </h2>
      <p>
        {isDonation
          ? "Register a pledge to support our information and navigation work."
          : kind === "volunteer"
            ? "Tell us how you would like to help. Our team will review your interest."
            : kind === "resource"
              ? "Register your interest in our upcoming educational resources."
              : "A few details are all we need to start a conversation."}
      </p>
      {isDonation && (
        <>
          <div className="giving-options" aria-label="Suggested pledge amounts">
            {[25, 50, 100, 250].map((a) => (
              <button
                type="button"
                key={a}
                className={amount === a ? "selected" : ""}
                onClick={() => setAmount(a)}
                aria-pressed={amount === a}
              >
                ${a}
              </button>
            ))}
          </div>
          <label className="field">
            Pledge amount (USD)
            <input
              name="amount"
              type="number"
              min="1"
              max="1000000"
              step="1"
              required
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </label>
          <div className="donation-explainer">
            This is a pledge, not a payment. No card details are collected and
            no money is charged. Our team will arrange the next step with you.
          </div>
        </>
      )}
      <label className="field">
        Your full name
        <input
          name="name"
          autoComplete="name"
          placeholder="First and last name"
          required
          minLength={2}
          maxLength={100}
        />
      </label>
      <label className="field">
        Email address
        <input
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          maxLength={254}
        />
      </label>
      {kind === "support" && (
        <label className="field">
          Where would you like some guidance?
          <select name="category" required defaultValue="">
            <option disabled value="">
              Choose an area of support
            </option>
            {services.map((s) => (
              <option key={s.slug}>{s.short}</option>
            ))}
            <option>I’m not sure where to start</option>
          </select>
        </label>
      )}
      {kind === "volunteer" && (
        <label className="field">
          How would you like to get involved?
          <select name="category" required defaultValue="">
            <option disabled value="">
              Choose your interest
            </option>
            <option>Navigation & administrative support</option>
            <option>Community outreach</option>
            <option>Fundraising & events</option>
            <option>Professional partnership</option>
            <option>Something else</option>
          </select>
        </label>
      )}
      {isDonation && (
        <input type="hidden" name="category" value="General giving" />
      )}
      {kind === "resource" && (
        <label className="field">
          I’m interested in
          <select
            name="category"
            defaultValue={category || "Educational guides"}
          >
            <option>Educational guides</option>
            <option>Planning checklists</option>
            <option>Workshops & webinars</option>
          </select>
        </label>
      )}
      <div className="honeypot" aria-hidden="true">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {kind === "support" && (
        <p className="field-hint">
          Please do not share medical details, identity numbers, financial
          documents or urgent requests here. This form is not monitored for
          emergencies.
        </p>
      )}
      <label className="check-field">
        <input type="checkbox" name="consent" required />
        <span>
          I agree that The Elder Care Foundation may store these details and
          contact me about this request. Read our{" "}
          <PrivacyNoticeLink
            returnLabel={isDonation ? "Back to my pledge" : "Back to my form"}
          />
          .
        </span>
      </label>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <button className="button button-dark" disabled={busy} type="submit">
        {busy
          ? "Sending…"
          : isDonation
            ? "Record my pledge"
            : kind === "volunteer"
              ? "Share my interest"
              : kind === "resource"
                ? "Register my interest"
                : "Send my request"}
        {isDonation ? <Heart size={17} /> : <ArrowUpRight size={18} />}
      </button>
      <div
        className="consent-label"
        style={{ justifyContent: "center", marginTop: 17 }}
      >
        <ShieldCheck size={13} /> Your details are only for our team.
      </div>
    </form>
  );
}
