"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowUpRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { PrivacyNoticeLink } from "./privacy-notice-link";
import { services } from "@/lib/content";
export function IntakeForm({
  kind,
  category = "",
}: {
  kind: "support" | "volunteer" | "resource";
  category?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const reference = useRef("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    if (!reference.current) reference.current = crypto.randomUUID();
    try {
      const response = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          name: form.get("name"),
          email: form.get("email"),
          category: form.get("category") || category || "General support",
          consent: form.get("consent") === "on",
          website: form.get("website") || "",
          client_reference: reference.current,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setMessage(result.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
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
          Our team will review your request and contact you by email. An
          appointment time will be agreed with you.
        </p>
        <Link className="text-link" href="/">
          Back to our home <ArrowUpRight size={17} />
        </Link>
      </div>
    );
  return (
    <form className="form-card" onSubmit={submit} onChange={()=>{reference.current="";}}>
      <h2>
        {kind === "volunteer"
          ? "Make a connection."
          : kind === "resource"
            ? "Stay in the loop."
            : "Let’s arrange a conversation."}
      </h2>
      <p>
        {kind === "volunteer"
          ? "Tell us how you would like to help. Our team will review your interest."
          : kind === "resource"
            ? "Register your interest in our upcoming educational resources."
            : "Leave your email and tell us where you would like some guidance. We will be in touch to agree the next step."}
      </p>
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
            <option>In-kind giving</option>
            <option>Something else</option>
          </select>
        </label>
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
          Please keep medical details, identity numbers and financial documents
          out of this form. It is not monitored for emergencies.
        </p>
      )}
      <label className="check-field">
        <input type="checkbox" name="consent" required />
        <span>
          I agree that The Elder Care Foundation may store these details and
          contact me about this request. Read our{" "}
          <PrivacyNoticeLink returnLabel="Back to my form" />.
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
          : kind === "volunteer"
            ? "Share my interest"
            : kind === "resource"
              ? "Register my interest"
              : "Send my request"}
        <ArrowUpRight size={18} />
      </button>
      <div
        className="consent-label"
        style={{ justifyContent: "center", marginTop: 17 }}
      >
        <ShieldCheck size={14} />
        Your details are only for our team.
      </div>
    </form>
  );
}
