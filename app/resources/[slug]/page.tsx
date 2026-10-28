import { notFound } from "next/navigation";
import { Compass, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PublicShell, ArrowLink } from "@/components/public-shell";
import { resources } from "@/lib/content";
export function generateStaticParams() {
  return resources.map((r) => ({ slug: r.id }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return { title: resources.find((r) => r.id === slug)?.title || "Resource" };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const resource = resources.find((r) => r.id === slug);
  if (!resource) notFound();
  return (
    <PublicShell>
      <section className="shell page-hero">
        <span className="eyebrow">
          {resource.category} · {resource.read}
        </span>
        <h1>{resource.title}</h1>
        <p>{resource.description}</p>
      </section>
      <article className="resource-article">
        <div className={"resource-cover " + resource.color}>
          <span className="cover-label">A LITTLE GUIDANCE SERIES</span>
          <Compass size={110} strokeWidth={0.7} />
          <span className="cover-bottom">THE ELDER CARE FOUNDATION</span>
        </div>
        {resource.content.map((p, i) => (
          <div className="article-step" key={p}>
            <span>0{i + 1}</span>
            <p>{p}</p>
          </div>
        ))}
        <div className="notice">
          This article offers general information, not personalized medical,
          financial or legal advice. Speak with a qualified independent
          professional for advice specific to your situation.
        </div>
        <ArrowLink href="/get-support">
          Need a hand finding your next step?
        </ArrowLink>
        <div style={{ marginTop: 35 }}>
          <Link className="back-link" href="/resources">
            <ArrowLeft size={15} /> Back to the resource library
          </Link>
        </div>
      </article>
    </PublicShell>
  );
}
