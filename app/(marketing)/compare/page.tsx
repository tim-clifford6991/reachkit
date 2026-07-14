/**
 * /compare — comparison hub. Opens with the category story (legacy tools sell
 * data, ReachKit sells the decision), shows the end-to-end loop, then groups the
 * head-to-head pages by tool category. Kit idiom, pure server component; all
 * card copy comes from the compare-content registry.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata } from "@/lib/seo";
import { HeroFade } from "@/components/sections/hero-fade";
import { COMPARE_CATEGORIES, COMPARE_ENTRIES } from "./compare-content";

export const metadata: Metadata = buildMetadata({
  title: "Compare ReachKit — Data Tools vs a Decision Engine",
  description:
    "SEO suites, audience research, AI assistants, app-store analytics — how ReachKit compares to each, and why the real difference is data vs decision. 13 honest head-to-heads.",
  path: "/compare",
});

const SG = "var(--font-display)", JM = "var(--font-mono)", SANS = "var(--font-sans)";

const LOOP_STEPS = [
  { n: "01", title: "Scan", body: "Reads your actual site, app-store listings, and reviews — not a form you fill in." },
  { n: "02", title: "Measure", body: "Real buyer search demand in your category, and where your rivals actually show up." },
  { n: "03", title: "Score", body: "0–100 from 18 deterministic signals across SEO (45%), Content (30%), Outreach (25%)." },
  { n: "04", title: "Plan", body: "A ranked weekly action plan — every fix cites the evidence it came from." },
  { n: "05", title: "Verify", body: "Ship a fix and ReachKit re-checks it live. It only counts when it's confirmed." },
];

export default function ComparePage() {
  return (
    <main aria-label="Compare ReachKit" style={{ background: "var(--c-surface)" }}>
      {/* Hero — the category story */}
      <HeroFade padding="70px 28px 8px">
        <p style={{ fontFamily: JM, fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-action)", margin: 0 }}>Compare</p>
        <h1 style={{ fontFamily: SG, fontWeight: 700, fontSize: "clamp(2rem, 4vw, 3.25rem)", letterSpacing: "-0.02em", lineHeight: 1.05, color: "var(--c-ink)", margin: "16px auto 0", maxWidth: 820 }}>
          Every tool below sells you data.
          <br />
          ReachKit sells you the decision.
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.6, color: "var(--c-muted)", margin: "20px auto 0", maxWidth: 680 }}>
          &ldquo;SEO tool&rdquo; comparisons usually miss the point. The legacy suites are superb databases — keywords, backlinks, rankings — priced for professionals whose job is to do the analysis. ReachKit isn&apos;t a rank tracker or a keyword database. It scans your actual product, scores its discoverability, and hands you the ranked, evidence-cited fix list — then verifies you shipped it.
        </p>
      </HeroFade>

      {/* End-to-end band */}
      <section aria-label="What ReachKit does end-to-end" style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 28px 12px" }}>
        <div style={{ background: "var(--c-dark)", borderRadius: 20, padding: "34px 34px 30px", backgroundImage: "linear-gradient(120deg, var(--c-dark), var(--c-dark2))" }}>
          <p style={{ fontFamily: JM, fontSize: 11.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-on-dark-muted)", margin: 0 }}>
            What ReachKit does, end to end
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 22, marginTop: 22 }}>
            {LOOP_STEPS.map((s) => (
              <div key={s.n}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontFamily: JM, fontSize: 12, fontWeight: 600, color: "var(--c-action)" }}>{s.n}</span>
                  <span style={{ fontFamily: SG, fontWeight: 700, fontSize: 16, color: "var(--c-on-dark)" }}>{s.title}</span>
                </div>
                <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--c-on-dark-muted)", margin: "8px 0 0" }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Grouped comparison grid */}
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 28px 24px" }}>
        {COMPARE_CATEGORIES.map((cat) => {
          const entries = COMPARE_ENTRIES.filter((e) => e.category === cat.id);
          if (entries.length === 0) return null;
          return (
            <div key={cat.id} style={{ marginBottom: 44 }}>
              <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 24, letterSpacing: "-0.015em", color: "var(--c-ink)", margin: 0 }}>
                {cat.label}
              </h2>
              <p style={{ fontSize: 15, lineHeight: 1.55, color: "var(--c-muted)", margin: "8px 0 20px", maxWidth: 680 }}>
                {cat.note}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>
                {entries.map((c) => (
                  <Link key={c.slug} href={`/compare/${c.slug}`} style={{ display: "block", background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 16, padding: "24px 26px 20px", textDecoration: "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <span style={{ fontFamily: SG, fontWeight: 700, fontSize: 13, color: "var(--c-action)" }}>ReachKit</span>
                      <span style={{ fontSize: 13, color: "var(--c-faint)" }}>vs</span>
                      <span style={{ fontFamily: SG, fontWeight: 700, fontSize: 13, color: "var(--c-ink)" }}>{c.name}</span>
                    </div>
                    <div style={{ fontFamily: SG, fontWeight: 700, fontSize: 20, letterSpacing: "-0.01em", color: "var(--c-ink)" }}>ReachKit vs {c.name}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--c-faint)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "4px 0 12px" }}>{c.tagline}</div>
                    <p style={{ fontSize: 14.5, lineHeight: 1.55, color: "var(--c-muted)", margin: 0 }}>{c.verdict}</p>
                    <div style={{ marginTop: 16, fontFamily: SANS, fontWeight: 600, fontSize: 14, color: "var(--c-action)" }}>Read the full comparison →</div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {/* Closing CTA */}
      <section style={{ maxWidth: 720, margin: "0 auto", padding: "12px 28px 90px", textAlign: "center" }}>
        <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 26, letterSpacing: "-0.015em", color: "var(--c-ink)", margin: 0 }}>
          The comparison that actually matters is your product
        </h2>
        <p style={{ fontSize: 15.5, lineHeight: 1.6, color: "var(--c-muted)", margin: "12px auto 0", maxWidth: 480 }}>
          Run the free scan: your 0–100 discoverability score, the evidence behind it, and the first fixes — before you spend a cent on any tool on this page.
        </p>
        <div style={{ marginTop: 24 }}>
          <Link
            href="/scan"
            style={{ display: "inline-block", background: "var(--c-action)", color: "var(--c-on-dark)", borderRadius: 10, padding: "12px 24px", fontFamily: SANS, fontWeight: 600, fontSize: 14.5, textDecoration: "none" }}
          >
            See your Discoverability Score — free
          </Link>
        </div>
        <p style={{ fontFamily: JM, fontSize: 12, color: "var(--c-faint)", margin: "14px 0 0" }}>
          Free scan · then €59/mo Solo or €129/mo Growth
        </p>
      </section>
    </main>
  );
}
