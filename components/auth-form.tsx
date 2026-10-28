"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Brand } from "./brand";
export function AuthForm({ activate = false }: { activate?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);
  const [token, setToken] = useState("");
  useEffect(() => {
    if (activate) {
      setToken(
        new URLSearchParams(window.location.hash.slice(1)).get("token") || "",
      );
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [activate]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget);
    if (activate && data.get("password") !== data.get("confirm")) {
      setError("The passwords do not match.");
      setBusy(false);
      return;
    }
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: activate ? "activate" : "login",
          username: data.get("username"),
          password: data.get("password"),
          token,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      window.location.assign("/workspace");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign in.");
      setBusy(false);
    }
  }
  return (
    <div className="login-screen">
      <section className="login-story">
        <Brand />
        <div>
          <span className="eyebrow">THE PEOPLE BEHIND THE PURPOSE</span>
          <h1 style={{ marginTop: 25 }}>
            A little teamwork.
            <br />
            <em>A lot of possibility.</em>
          </h1>
          <p>
            One connected workspace to help our foundation guide, coordinate and
            care about what comes next.
          </p>
        </div>
        <span>THE ELDER CARE FOUNDATION · TEAM WORKSPACE</span>
      </section>
      <section className="login-panel">
        <div className="login-box">
          <Link href="/" className="back-link">
            <ArrowLeft size={14} /> Back to our public website
          </Link>
          <span className="eyebrow">
            {activate
              ? "YOUR NEXT CHAPTER STARTS HERE"
              : "STAFF & VOLUNTEER ACCESS"}
          </span>
          <h2>
            {activate ? "Make yourself at home." : "Good to see you again."}
          </h2>
          <p>
            {activate
              ? "Choose a strong password to activate your invited account."
              : "Sign in to your foundation workspace. Your role determines what you can access."}
          </p>
          <form onSubmit={submit}>
            {!activate && (
              <label className="field">
                Username
                <input
                  name="username"
                  type="text"
                  autoComplete="username"
                  placeholder="e.g. admin"
                  required
                  minLength={3}
                  maxLength={32}
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </label>
            )}
            <label className="field">
              {activate ? "Create a password" : "Password"}
              <div style={{ position: "relative" }}>
                <input
                  name="password"
                  type={show ? "text" : "password"}
                  autoComplete={activate ? "new-password" : "current-password"}
                  required
                  minLength={activate ? 12 : 1}
                  maxLength={128}
                  placeholder={
                    activate ? "At least 12 characters" : "Enter your password"
                  }
                  style={{ paddingRight: 45 }}
                />
                <button
                  type="button"
                  className="icon-button"
                  style={{ position: "absolute", right: 7, top: 7 }}
                  aria-label={show ? "Hide password" : "Show password"}
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
            {activate && (
              <label className="field">
                Confirm password
                <input
                  name="confirm"
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={128}
                />
              </label>
            )}
            {activate && !token && (
              <div className="form-error" role="alert">
                Open the complete invitation link provided by your
                administrator. Invitations expire after 24 hours.
              </div>
            )}
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <button
              className="button button-dark"
              disabled={busy || (activate && !token)}
            >
              {busy
                ? "Please wait…"
                : activate
                  ? "Activate my account"
                  : "Sign in to workspace"}
              <ArrowUpRight size={18} />
            </button>
          </form>
          <div className="login-help">
            {activate
              ? "Invitation links can only be used once."
              : "Need access or a password reset? Contact your foundation administrator for an invitation."}
          </div>
          {!activate && (
            <div className="login-demo">
              <p>Exploring the workspace before getting started?</p>
              <Link className="text-link" href="/demo">
                Take a look around the demo <ArrowUpRight size={16} />
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
