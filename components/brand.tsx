import Link from "next/link";
export function Mark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="42"
      height="42"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M24 38V23M24 28C13 28 7 21 8 12c10 0 16 6 16 16ZM24 23C24 12 31 6 40 8c0 10-6 16-16 15Z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 39h20"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="brand"
      aria-label="The Elder Care Foundation home"
    >
      <Mark />
      <span>
        The Elder Care{!compact && <br />}
        <span className={compact ? "compact-foundation" : ""}> Foundation</span>
      </span>
    </Link>
  );
}
