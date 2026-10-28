"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="shell empty-page">
      <h1>
        A little <em>pause.</em>
      </h1>
      <p>Something didn’t load. Please try again.</p>
      <button className="button button-dark" onClick={reset}>
        Try again
      </button>
      <a href="/" className="text-link">
        Return to our home
      </a>
    </div>
  );
}
