import type { Metadata } from "next";
import { PublicShell } from "@/components/public-shell";
import { ResourceLibrary } from "@/components/resource-library";
export const metadata: Metadata = { title: "Resource library" };
export default function Page() {
  return (
    <PublicShell>
      <section className="shell page-hero">
        <span className="eyebrow">A LITTLE GUIDANCE LIBRARY</span>
        <h1>
          A little knowledge.
          <br />
          <em>A little more confidence.</em>
        </h1>
        <p>
          Practical starting points for older adults, families and anyone
          helping someone navigate the next chapter.
        </p>
      </section>
      <section className="shell page-content">
        <ResourceLibrary />
      </section>
    </PublicShell>
  );
}
