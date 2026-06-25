/**
 * /compare — comparison hub. Clean Claude Design layout (flat cards, Space
 * Grotesk, violet accent) linking to each head-to-head page. Fixes the previously
 * missing index (the nav linked here but only /compare/[slug] existed).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Compare ReachKit",
  description:
    "How ReachKit — the discoverability engine for solo founders — compares to SparkToro, Ahrefs, and ChatGPT, feature by feature.",
  path: "/compare",
});

const COMPARISONS = [
  { slug: "sparktoro", name: "SparkToro", tagline: "Audience research", blurb: "Great for finding where an audience hangs out. ReachKit fixes your own discoverability with a ranked, weekly plan." },
  { slug: "ahrefs", name: "Ahrefs", tagline: "SEO toolset", blurb: "A deep SEO suite for agencies. ReachKit scores App Store + web and turns it into a small weekly to-do list at indie pricing." },
  { slug: "chatgpt", name: "ChatGPT", tagline: "General AI assistant", blurb: "Generic advice from what you tell it. ReachKit reads your real page and grounds every fix in evidence — no hallucinations." },
  { slug: "semrush", name: "Semrush", tagline: "Marketing suite", blurb: "An all-in-one suite for marketing teams. ReachKit does one thing for solo founders: scores your listing and hands you a ranked weekly plan with draft copy." },
  { slug: "moz", name: "Moz", tagline: "SEO software", blurb: "Loved SEO software for Domain Authority and rank tracking. ReachKit scores App Store + web, names your positioning gap, and turns it into a weekly to-do list." },
  { slug: "ubersuggest", name: "Ubersuggest", tagline: "Budget SEO", blurb: "Affordable keyword and content ideas. ReachKit centres on your own page — an 18-signal score and a ranked, verified weekly plan instead of a keyword list." },
  { slug: "google-search-console", name: "Google Search Console", tagline: "Search data", blurb: "Google's free source of truth for impressions and queries. ReachKit reads those signals, scores them, and explains the fixes in a ranked weekly plan." },
  { slug: "appfigures", name: "Appfigures", tagline: "ASO analytics", blurb: "Strong App Store keyword and revenue analytics. ReachKit isn't a dashboard — it scores your listing, names your positioning gap, and plans the fixes, web included." },
  { slug: "surfer-seo", name: "Surfer SEO", tagline: "Content optimization", blurb: "Great at optimizing a single article against the SERP. ReachKit works one level up: a whole-listing score for App Store + web and a ranked weekly action plan." },
];

const SG = "var(--font-display)", JM = "var(--font-mono)";

export default function ComparePage() {
  return (
    <main aria-label="Compare ReachKit" style={{ background: "var(--c-surface)" }}>
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "70px 28px 24px", textAlign: "center" }}>
        <p style={{ fontFamily: JM, fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-action)", margin: 0 }}>Compare</p>
        <h1 style={{ fontFamily: SG, fontWeight: 700, fontSize: "clamp(2rem, 4vw, 3.25rem)", letterSpacing: "-0.02em", lineHeight: 1.05, color: "var(--c-ink)", margin: "16px auto 0", maxWidth: 760 }}>
          How ReachKit stacks up
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.5, color: "var(--c-muted)", margin: "18px auto 0", maxWidth: 560 }}>
          ReachKit is the discoverability engine for solo founders — a scored report and a weekly, verified action plan. Here&apos;s how it compares, feature by feature.
        </p>
      </section>

      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "20px 28px 80px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>
          {COMPARISONS.map((c) => (
            <Link key={c.slug} href={`/compare/${c.slug}`} style={{ display: "block", background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 16, padding: "26px 26px 22px", textDecoration: "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <span style={{ fontFamily: SG, fontWeight: 700, fontSize: 13, color: "var(--c-action)" }}>ReachKit</span>
                <span style={{ fontSize: 13, color: "var(--c-faint)" }}>vs</span>
                <span style={{ fontFamily: SG, fontWeight: 700, fontSize: 13, color: "var(--c-ink)" }}>{c.name}</span>
              </div>
              <div style={{ fontFamily: SG, fontWeight: 700, fontSize: 20, letterSpacing: "-0.01em", color: "var(--c-ink)" }}>ReachKit vs {c.name}</div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--c-faint)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "4px 0 12px" }}>{c.tagline}</div>
              <p style={{ fontSize: 14.5, lineHeight: 1.55, color: "var(--c-muted)", margin: 0 }}>{c.blurb}</p>
              <div style={{ marginTop: 16, fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 14, color: "var(--c-action)" }}>See the comparison →</div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
