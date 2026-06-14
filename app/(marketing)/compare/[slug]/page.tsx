import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import { buildMetadata } from "@/lib/seo";
import {
  ComparisonTable,
  type ComparisonRow,
} from "@/components/sections/comparison-table";

interface Competitor {
  name: string;
  tagline: string;
  intro: string;
  rows: readonly ComparisonRow[];
}

const check = { type: "check" } as const;
const cross = { type: "cross" } as const;
const partial = (note: string) => ({ type: "partial", note }) as const;

const COMPETITORS: Record<string, Competitor> = {
  sparktoro: {
    name: "SparkToro",
    tagline: "audience research",
    intro:
      "SparkToro is great for finding where an audience already hangs out. ReachKit is built to fix your own discoverability — it scores your live App Store listing or website and hands you a ranked, weekly action plan.",
    rows: [
      { capability: "Discoverability score (0–100)", cells: [check, cross] },
      { capability: "Grounded in your live page", cells: [check, partial("audience data, not your page")] },
      { capability: "Ranked, prioritised fixes", cells: [check, cross] },
      { capability: "Draft copy per action", cells: [check, cross] },
      { capability: "Weekly action engine + verification", cells: [check, cross] },
      { capability: "Audience / where-they-gather research", cells: [partial("surfaced in the report"), check] },
      { capability: "Free to start", cells: [check, check] },
    ],
  },
  ahrefs: {
    name: "Ahrefs",
    tagline: "SEO toolset",
    intro:
      "Ahrefs is a deep SEO toolset built for agencies and SEO pros. ReachKit is built for solo founders: it scores both App Store and web discoverability and turns the findings into a small, ranked weekly to-do list — at indie pricing.",
    rows: [
      { capability: "Discoverability score for App Store + web", cells: [check, partial("web SEO only")] },
      { capability: "Ranked action plan (not just data)", cells: [check, partial("audits list issues")] },
      { capability: "Draft copy per fix", cells: [check, cross] },
      { capability: "Weekly queue + change verification", cells: [check, cross] },
      { capability: "Deep backlink / keyword index", cells: [cross, check] },
      { capability: "Priced for solo founders", cells: [check, partial("agency pricing")] },
      { capability: "Free to start", cells: [check, partial("limited free tools")] },
    ],
  },
  chatgpt: {
    name: "ChatGPT",
    tagline: "general AI assistant",
    intro:
      "ChatGPT gives generic advice based on what you tell it. ReachKit fetches your real product page, extracts the actual signals, and grounds every answer in evidence — so there are no hallucinations and nothing that doesn't apply to you.",
    rows: [
      { capability: "Grounded in your live page", cells: [check, cross] },
      { capability: "Discoverability score (0–100)", cells: [check, cross] },
      { capability: "Ranked, evidence-based fixes", cells: [check, partial("generic, unranked")] },
      { capability: "Draft copy per action", cells: [check, partial("with prompting")] },
      { capability: "Weekly action engine + verification", cells: [check, cross] },
      { capability: "Free to start", cells: [check, check] },
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(COMPETITORS).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const c = COMPETITORS[slug];
  if (!c) return {};
  return buildMetadata({
    title: `ReachKit vs ${c.name}`,
    description: `ReachKit vs ${c.name}: how a discoverability engine for solo founders compares to ${c.name} (${c.tagline}). Feature-by-feature.`,
    path: `/compare/${slug}`,
  });
}

export default async function ComparePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = COMPETITORS[slug];
  if (!c) notFound();

  return (
    <main aria-label={`ReachKit versus ${c.name}`}>
      {/* Hero */}
      <section className="mx-auto max-w-2xl px-(--spacing-content-x) pb-8 pt-20 text-center sm:pt-28">
        <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--color-accent-400)" }}>
          Compare
        </p>
        <h1 className="mt-3 text-4xl sm:text-5xl lg:text-6xl" style={{ color: "var(--color-fg)", lineHeight: 1.05 }}>
          ReachKit vs {c.name}
        </h1>
        <p className="mt-4 text-lg leading-relaxed" style={{ color: "var(--color-muted)" }}>
          {c.intro}
        </p>
      </section>

      {/* Table */}
      <ComparisonTable
        content={{
          eyebrow: "Feature by feature",
          headline: `What you get with each`,
          tools: ["ReachKit", c.name],
          rows: c.rows,
        }}
      />

      {/* CTA */}
      <section className="px-(--spacing-content-x) pb-(--spacing-section-y) pt-4 text-center">
        <Link
          href="/scan"
          className="inline-flex h-11 items-center rounded-lg px-6 text-sm font-semibold shadow-[var(--elevation-glow)] transition-transform hover:-translate-y-px motion-reduce:transform-none"
          style={{ background: "var(--color-accent)", color: "var(--color-accent-fg)" }}
        >
          See your Discoverability Score — free
        </Link>
      </section>
    </main>
  );
}
