"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { X, RefreshCw } from "lucide-react";
export const dollars = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(cents / 100);
export const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
export const dateText = (value: string) =>
  value
    ? new Date(
        value.length === 10 ? value + "T12:00:00Z" : value,
      ).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "Asia/Shanghai",
      })
    : "—";
export const timeText = (value: string) =>
  new Date(value).toLocaleString("en-US", {
    timeZone: "Asia/Shanghai",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }) + " (UTC+8)";
export async function send(endpoint: string, body: unknown) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => {
    throw new Error("We could not load the response. Please try again.");
  });
  if (!response.ok)
    throw new Error(result.error || "Unable to save. Please try again.");
  return result;
}
export function useRemote<T>(endpoint: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }
      const result = await response.json().catch(() => {
        throw new Error("We could not load the response. Please try again.");
      });
      if (!response.ok)
        throw new Error(result.error || "Unable to load records.");
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load.");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return { data, error, setError, loading, refresh };
}
export function LoadState({
  error,
  loading,
  onRetry,
}: {
  error: string;
  loading: boolean;
  onRetry: () => void;
}) {
  return error ? (
    <div className="business-error" role="alert">
      <span>{error}</span>
      <button className="button button-outline" onClick={onRetry}>
        <RefreshCw size={17} /> Retry
      </button>
    </div>
  ) : loading ? (
    <div className="business-loading" role="status">
      Bringing your workspace together…
    </div>
  ) : null;
}
export function BusinessModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close.current();
      }
      if (e.key === "Tab") {
        const nodes = ref.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]',
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="business-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="business-modal"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
      >
        <header>
          <h2 id={id}>{title}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={24} />
          </button>
        </header>
        <div className="business-modal-body">{children}</div>
      </div>
    </div>
  );
}
export function Status({ value }: { value: string }) {
  return (
    <span
      className={
        "business-status " +
        (value === "Posted" ||
        value === "Approved" ||
        value === "Active" ||
        value === "Completed"
          ? "green"
          : value === "Rejected" || value === "Ended" || value === "Cancelled"
            ? "red"
            : "amber")
      }
    >
      {value}
    </span>
  );
}
export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="business-empty">{children}</div>;
}
