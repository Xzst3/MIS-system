"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, X } from "lucide-react";
import { privacySections } from "@/lib/privacy";
export function PrivacyNoticeLink({
  returnLabel = "Back to my form",
}: {
  returnLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "Tab") {
        const controls =
          ref.current?.querySelectorAll<HTMLElement>("button,a[href]");
        if (!controls?.length) return;
        const first = controls[0],
          last = controls[controls.length - 1];
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      trigger.current?.focus();
    };
  }, [open]);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="inline-privacy-link"
        onClick={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
      >
        privacy notice
      </button>
      {open &&
        createPortal(
          <div
            className="modal-backdrop"
            onClick={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <div
              ref={ref}
              className="modal privacy-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="privacy-dialog-title"
              tabIndex={-1}
            >
              <div className="modal-head">
                <h2 id="privacy-dialog-title">Your privacy.</h2>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Close privacy notice"
                  onClick={() => setOpen(false)}
                >
                  <X size={24} />
                </button>
              </div>
              <div className="privacy-copy">
                <p>
                  Your form stays right here. Read the notice, then return to
                  the details you were filling in.
                </p>
                {privacySections.map((section) => (
                  <section key={section.title}>
                    <h2>{section.title}</h2>
                    <p>{section.text}</p>
                  </section>
                ))}
                <p>Last updated: October 28, 2026.</p>
              </div>
              <div className="privacy-return">
                <button
                  type="button"
                  className="button button-dark"
                  onClick={() => setOpen(false)}
                >
                  <ArrowLeft size={18} />
                  {returnLabel}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
