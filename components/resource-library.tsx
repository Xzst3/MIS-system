"use client";
import Link from "next/link";
import { useState } from "react";
import { Compass, Flower2, ArrowUpRight, Search } from "lucide-react";
import { resources } from "@/lib/content";
export function ResourceLibrary() {
  const [filter, setFilter] = useState("All guides");
  const [query, setQuery] = useState("");
  const filtered = resources.filter(
    (r) =>
      (filter === "All guides" || r.category === filter.toUpperCase()) &&
      (r.title + " " + r.description)
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="resource-search">
        <div className="resource-filters">
          {[
            "All guides",
            "Getting started",
            "Practical guidance",
            "For families",
          ].map((f) => (
            <button
              key={f}
              className={filter === f ? "active" : ""}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
            >
              {f}
            </button>
          ))}
        </div>
        <input
          className="search-input"
          aria-label="Search resource library"
          placeholder="Search for a little guidance…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="resource-grid">
        {filtered.map((r) => (
          <Link
            className="resource-card"
            key={r.id}
            href={"/resources/" + r.id}
          >
            <div className={"resource-cover " + r.color}>
              <span className="cover-label">
                THE ELDER CARE FOUNDATION
                <br />A LITTLE GUIDANCE SERIES
              </span>
              {r.color === "sage" ? (
                <Compass size={90} strokeWidth={0.8} />
              ) : (
                <Flower2 size={90} strokeWidth={0.8} />
              )}
              <span className="cover-bottom">
                A CLEARER PATH, TOGETHER <ArrowUpRight size={18} />
              </span>
            </div>
            <div className="resource-info">
              <span className="eyebrow">
                {r.category} · {r.read}
              </span>
              <h3>{r.title}</h3>
              <p>{r.description}</p>
              <span className="text-link">
                Read the guide <ArrowUpRight size={17} />
              </span>
            </div>
          </Link>
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="empty-state">
          <Search size={30} />
          <h3>No guides found.</h3>
          <p>Try another word or choose a different category.</p>
        </div>
      )}
      <div className="notice">
        These introductory articles provide general organizational guidance. Our
        planned e-guides, directories and workshops are not available for
        purchase yet. No checkout or digital delivery is active.
      </div>
    </>
  );
}
