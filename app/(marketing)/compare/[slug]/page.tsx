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
  semrush: {
    name: "Semrush",
    tagline: "marketing suite",
    intro:
      "Semrush is an all-in-one suite — keyword research, backlink index, rank tracking, site audits and more — built for marketing teams. ReachKit does one thing for solo founders: it scores your live App Store listing or website and hands you a small, ranked weekly action plan with draft copy, at indie pricing.",
    rows: [
      { capability: "Discoverability score for App Store + web", cells: [check, partial("web SEO + site audit only")] },
      { capability: "Ranked weekly action plan (not a dashboard)", cells: [check, partial("audits surface issues")] },
      { capability: "Draft copy per fix", cells: [check, partial("AI writing add-on")] },
      { capability: "Change verification on re-scan", cells: [check, cross] },
      { capability: "Keyword, backlink + rank-tracking database", cells: [cross, check] },
      { capability: "Priced for solo founders", cells: [check, partial("team pricing")] },
      { capability: "Free to start", cells: [check, partial("limited free account")] },
    ],
  },
  moz: {
    name: "Moz",
    tagline: "SEO software",
    intro:
      "Moz is well-loved SEO software — Domain Authority, keyword research and rank tracking, with a strong learning community. ReachKit isn't an SEO metrics tool: it scores both App Store and web discoverability, names your positioning gap, and turns it into a ranked weekly to-do list with draft copy.",
    rows: [
      { capability: "Discoverability score for App Store + web", cells: [check, partial("web only")] },
      { capability: "Ranked, prioritised fixes", cells: [check, partial("site crawl flags issues")] },
      { capability: "Positioning / messaging gap analysis", cells: [check, cross] },
      { capability: "Draft copy per action", cells: [check, cross] },
      { capability: "Weekly action engine + verification", cells: [check, cross] },
      { capability: "Domain Authority + link metrics", cells: [cross, check] },
      { capability: "Free to start", cells: [check, partial("free tools + trial")] },
    ],
  },
  ubersuggest: {
    name: "Ubersuggest",
    tagline: "budget SEO",
    intro:
      "Ubersuggest is a budget-friendly SEO tool for keyword ideas, content suggestions and basic site audits. ReachKit is built around your own product page: it scores your live App Store or web listing across 18 signals and gives a ranked, verified weekly plan rather than a keyword list.",
    rows: [
      { capability: "Discoverability score (0–100)", cells: [check, cross] },
      { capability: "Grounded in your live page", cells: [check, partial("site audit + keyword data")] },
      { capability: "App Store / ASO coverage", cells: [check, cross] },
      { capability: "Ranked weekly action plan", cells: [check, partial("flat suggestions list")] },
      { capability: "Draft copy per action", cells: [check, cross] },
      { capability: "Keyword volume + content ideas", cells: [partial("surfaced in the report"), check] },
      { capability: "Affordable for indies", cells: [check, check] },
    ],
  },
  "google-search-console": {
    name: "Google Search Console",
    tagline: "search data",
    intro:
      "Google Search Console is the free source of truth for how Google sees your site — impressions, clicks, queries and indexing health. ReachKit reads that kind of signal and goes further: it scores your discoverability, explains what's wrong in plain English, and hands you a ranked weekly plan with draft copy.",
    rows: [
      { capability: "Discoverability score (0–100)", cells: [check, cross] },
      { capability: "App Store / web listing coverage", cells: [check, partial("web search only")] },
      { capability: "Ranked, prioritised fixes", cells: [check, partial("flags issues, no priorities")] },
      { capability: "Plain-English explanation + draft copy", cells: [check, cross] },
      { capability: "Weekly action engine + verification", cells: [check, cross] },
      { capability: "Real Google impression + query data", cells: [cross, check] },
      { capability: "Free to use", cells: [partial("first scan free"), check] },
    ],
  },
  appfigures: {
    name: "Appfigures",
    tagline: "ASO analytics",
    intro:
      "Appfigures is strong App Store analytics — keyword rankings, downloads, revenue and review tracking across stores. ReachKit isn't a metrics dashboard: it scores your live listing, names your positioning gap, and turns it into a ranked weekly action plan with draft copy — and it covers your website too.",
    rows: [
      { capability: "Discoverability score (0–100)", cells: [check, cross] },
      { capability: "Covers App Store + website", cells: [check, partial("app stores only")] },
      { capability: "Ranked weekly action plan", cells: [check, cross] },
      { capability: "Draft copy per action", cells: [check, cross] },
      { capability: "Change verification on re-scan", cells: [check, partial("tracks rank over time")] },
      { capability: "ASO keyword rank + download data", cells: [partial("listing signals only"), check] },
      { capability: "Priced for solo founders", cells: [check, partial("per-app tiers")] },
    ],
  },
  "surfer-seo": {
    name: "Surfer SEO",
    tagline: "content optimization",
    intro:
      "Surfer SEO is excellent at on-page content optimization — scoring a draft against top-ranking pages by terms, structure and length. ReachKit works one level up: it scores your whole App Store or web listing across 18 signals and gives a ranked, verified weekly plan, not just a content editor.",
    rows: [
      { capability: "Whole-listing discoverability score", cells: [check, partial("per-article content score")] },
      { capability: "Covers App Store + website", cells: [check, cross] },
      { capability: "Ranked weekly action plan", cells: [check, cross] },
      { capability: "Draft copy per action", cells: [check, partial("content editor + AI writer")] },
      { capability: "Change verification on re-scan", cells: [check, partial("re-score a draft")] },
      { capability: "SERP-based on-page content scoring", cells: [partial("copy signals in the report"), check] },
      { capability: "Free to start", cells: [check, partial("free audit, paid plans")] },
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
