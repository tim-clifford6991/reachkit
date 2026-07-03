/**
 * /how-it-works — the methodology deep-dive. "We give away the secret, we sell
 * the implementation": this page publishes the full scoring model — the real
 * 18-signal registry with its pillar weights (imported from lib/scan/signals,
 * the same module the engine scores with), the supply→demand→synthesis
 * pipeline, and why the number is trustworthy — then shows a fixture-data
 * glimpse of the paid dashboard and ends on the free-scan CTA.
 *
 * Design idiom: intel-kit style — inline styles on --c-* tokens, Space Grotesk /
 * JetBrains Mono / Plus Jakarta Sans. Server component: registry/band data is
 * imported from server-safe modules (lib/scan/signals, lib/scan/score-bands),
 * NEVER from the "use client" kit. The dashboard glimpse is a client component
 * fed only static fixture data.
 */

import type { Metadata } from "next";
import { buildMetadata, howToLd } from "@/lib/seo";
import { ScanInput } from "@/app/(marketing)/scan-input";
import { DashboardGlimpse } from "@/components/sections/dashboard-glimpse";
import { SIGNAL_REGISTRY, PILLAR_WEIGHTS, type Pillar, type SignalDefinition } from "@/lib/scan/signals";
import { SCORE_BANDS } from "@/lib/scan/score-bands";

export const metadata: Metadata = buildMetadata({
  title: "How it works — the full methodology",
  description:
    "The complete ReachKit methodology, published: all 18 discoverability signals and their weights, the supply→demand→synthesis pipeline, and why the score is deterministic and verifiable. Then run it free on your own product.",
  path: "/how-it-works",
});

const HOW_TO_LD = howToLd({
  name: "How ReachKit works",
  description: "Scan your product, read your Discoverability report, and work a weekly action queue.",
  steps: [
    { name: "Scan", text: "Paste your App Store URL or website. ReachKit fetches it and scores 18 discoverability signals in about 90 seconds." },
    { name: "Report", text: "Read a four-question report: what you offer, who it's for, where they are, and what to fix first — grounded in your live page." },
    { name: "Engine", text: "Paid plans unlock a weekly, prioritised action queue that verifies each fix and tracks your score over time." },
  ],
});

const SG = "var(--font-display)", JM = "var(--font-mono)";

const STEPS = [
  { n: "01", title: "Scan your live page", body: "Paste your App Store URL or website. ReachKit fetches the real page and scores 18 discoverability signals — in about 90 seconds, no account for your first scan.", tag: "~90 seconds" },
  { n: "02", title: "Read the four-question report", body: "What you offer, who it's for, where they are, and what to fix first — every claim grounded in evidence from your live page, plus your positioning gap.", tag: "Grounded in evidence" },
  { n: "03", title: "Work the weekly action engine", body: "Paid plans turn the report into a small, ranked weekly queue. Mark a fix done, ReachKit re-reads your page and verifies the move — your score tracks over time.", tag: "Verified, not vanity" },
];

// ---------------------------------------------------------------------------
// Signal registry, grouped by pillar (display order = pillar weight, desc).
// This reads the SAME module the scoring engine uses — the page can't drift
// from the product.
// ---------------------------------------------------------------------------
const PILLAR_ORDER: Pillar[] = ["seo", "content", "outreach"];
const PILLAR_LABEL: Record<Pillar, string> = { seo: "SEO", content: "Content", outreach: "Outreach" };
const PILLAR_BLURB: Record<Pillar, string> = {
  seo: "Can search engines find, understand, and rank you — and do you already rank?",
  content: "Do you publish enough substance, often enough, on enough owned surfaces?",
  outreach: "Are you present where buyers actually decide — marketplaces, communities, comparisons, press?",
};

function signalsByPillar(pillar: Pillar): SignalDefinition[] {
  return SIGNAL_REGISTRY.filter((s) => s.pillar === pillar);
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

// ---------------------------------------------------------------------------
// Local layout helpers (server-safe, page-local — NOT imports from kit.tsx)
// ---------------------------------------------------------------------------
function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub: string }) {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto 30px", textAlign: "center" }}>
      <p style={{ fontFamily: JM, fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-action)", margin: 0 }}>{eyebrow}</p>
      <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: "clamp(1.7rem, 3.2vw, 2.4rem)", letterSpacing: "-0.02em", lineHeight: 1.1, color: "var(--c-ink)", margin: "12px 0 0" }}>{title}</h2>
      <p style={{ fontSize: 15.5, lineHeight: 1.55, color: "var(--c-muted)", margin: "12px auto 0", maxWidth: 620 }}>{sub}</p>
    </div>
  );
}

function SignalRow({ s }: { s: SignalDefinition }) {
  return (
    <li style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "9px 0", borderTop: "1px solid var(--c-line2)" }}>
      <span style={{ fontFamily: JM, fontSize: 11, fontWeight: 700, color: "var(--c-faint)", flexShrink: 0, width: 34 }}>{pct(s.weight)}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ fontFamily: SG, fontWeight: 700, fontSize: 13.5, color: "var(--c-ink)" }}>{s.label}</span>
        {s.source === "new" && (
          <span style={{ marginLeft: 8, fontFamily: JM, fontSize: 10, fontWeight: 600, color: "var(--c-faint)", background: "var(--c-fill)", padding: "2px 7px", borderRadius: 6, whiteSpace: "nowrap" }}>
            not yet scored — never a fake zero
          </span>
        )}
        <span style={{ display: "block", fontSize: 12.5, lineHeight: 1.5, color: "var(--c-muted)", marginTop: 2 }}>{s.why}</span>
      </span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Pipeline copy — grounded in lib/scan/profile (supply), lib/scan/demand, and
// lib/scan/synthesis/synthesize.ts. No invented sources or numbers.
// ---------------------------------------------------------------------------
const PIPELINE = [
  {
    n: "01",
    name: "Supply",
    q: "What exists today — for you and your rivals?",
    points: [
      "We crawl your live pages and parse the on-page facts: title, meta description, structured data, canonical, heading structure, content depth, share tags, image alt coverage.",
      "We read your sitemap and feeds to measure real publishing cadence, and map your owned channels (blog, YouTube, newsletter).",
      "We run the same profile on a category-validated competitor set — so every gap is relative to rivals in YOUR category, not a same-named brand in another market.",
      "We check the surfaces buyers decide on: marketplace listings (Product Hunt, G2, Capterra, AlternativeTo), community mentions (Hacker News, Reddit), and comparison pages.",
    ],
  },
  {
    n: "02",
    name: "Demand",
    q: "What are buyers actually searching for?",
    points: [
      "From your product brief we generate pain queries in your buyers' own words — the things they type before they know your name.",
      "Each query runs through live search-engine results (via DataForSEO's SERP data — real rankings and search volumes, not estimates we made up).",
      "Hits are deduplicated, classified by intent, and clustered into ranked demand pockets — the themes where demand is real and reachable.",
      "Competitor reviews are mined for buyer language: what people praise, what they complain about, and the words they use for both.",
    ],
  },
  {
    n: "03",
    name: "Synthesis",
    q: "Supply × Demand → what to do about it",
    points: [
      "The content plan crosses demand themes with the format that currently wins each SERP and your positioning — topic, target keywords with real volumes, buyer angle, brief.",
      "The distribution plan is the intersection of where rivals are found and where your audience already is — channel, specific target, why, and effort.",
      "Every item cites the evidence it came from. If we can't point at the evidence, the item doesn't ship.",
    ],
  },
];

const TRUST = [
  {
    title: "The number is deterministic",
    body: "Your score is computed from the 18-signal registry above — fixed weights, fixed pass/warn/fail thresholds, no LLM anywhere in the arithmetic. Same inputs, same score, every time.",
    tag: "No LLM in the score",
  },
  {
    title: "The words are grounded",
    body: "Every LLM step reads evidence extracted from your live pages, reviews, and search results — never free association. Each recommendation cites its evidence, and a critic gate pressure-tests every card before it reaches you. Cards that can't back themselves up get dropped.",
    tag: "Evidence-cited, critic-gated",
  },
  {
    title: "Not measured never means zero",
    body: "If a signal hasn't been verified for your product yet, it renders as “not measured” — it is never counted as a failing zero to make the number scarier. The score only speaks to what was actually checked.",
    tag: "Anti-vanity by design",
  },
  {
    title: "Fixes are verified, not self-declared",
    body: "When you mark an action done, ReachKit re-checks reality first — the page must be live, or the rank check must show movement — before the fix counts and your score re-snapshots. Progress you can defend.",
    tag: "Verify loop",
  },
];

export default function HowItWorksPage() {
  const anchors = [
    { href: "#signals", label: "The 18 signals" },
    { href: "#pipeline", label: "The pipeline" },
    { href: "#trust", label: "Why trust it" },
    { href: "#glimpse", label: "The dashboard" },
  ];

  return (
    <main aria-label="How ReachKit works" style={{ background: "var(--c-surface)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(HOW_TO_LD) }} />

      {/* Hero */}
      <section style={{ position: "relative", overflow: "hidden", background: "radial-gradient(1100px 480px at 50% -8%, var(--c-soft) 0%, rgba(242,238,255,0) 62%), var(--c-bg)" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "72px 28px 44px", textAlign: "center" }}>
          <p style={{ fontFamily: JM, fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-action)", margin: 0 }}>How it works</p>
          <h1 style={{ fontFamily: SG, fontWeight: 700, fontSize: "clamp(2.1rem, 4.5vw, 3.4rem)", letterSpacing: "-0.02em", lineHeight: 1.04, color: "var(--c-ink)", margin: "16px auto 0", maxWidth: 820 }}>
            The whole methodology, published. The execution is the product.
          </h1>
          <p style={{ fontSize: 17.5, lineHeight: 1.5, color: "var(--c-muted)", margin: "18px auto 0", maxWidth: 640 }}>
            No black box. Below is exactly how ReachKit scores discoverability — all 18 signals, the real weights, the pipeline, and why the number holds up. You could do all of this by hand. ReachKit does it in ~90 seconds, then keeps doing it every week.
          </p>
          <nav aria-label="On this page" style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 8, marginTop: 26 }}>
            {anchors.map((a) => (
              <a key={a.href} href={a.href} style={{ fontFamily: JM, fontSize: 12, fontWeight: 600, color: "var(--c-action)", background: "var(--c-soft)", padding: "7px 14px", borderRadius: 999, textDecoration: "none" }}>{a.label}</a>
            ))}
          </nav>
        </div>
      </section>

      {/* Three steps */}
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 28px 20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>
          {STEPS.map((s) => (
            <div key={s.n} style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 18, padding: "26px 26px 24px" }}>
              <div style={{ fontFamily: JM, fontWeight: 700, fontSize: 28, color: "var(--c-action)", letterSpacing: "-0.02em" }}>{s.n}</div>
              <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 19, letterSpacing: "-0.01em", color: "var(--c-ink)", margin: "14px 0 8px" }}>{s.title}</h2>
              <p style={{ fontSize: 14.5, lineHeight: 1.55, color: "var(--c-muted)", margin: 0 }}>{s.body}</p>
              <span style={{ display: "inline-block", marginTop: 16, fontFamily: JM, fontSize: 11, fontWeight: 600, color: "var(--c-action)", background: "var(--c-soft)", padding: "5px 11px", borderRadius: 7 }}>{s.tag}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── The 18-signal registry ─────────────────────────────────────────── */}
      <section id="signals" style={{ maxWidth: 1180, margin: "0 auto", padding: "64px 28px 20px", scrollMarginTop: 88 }}>
        <SectionHead
          eyebrow="The scoring model"
          title="All 18 signals, with their real weights"
          sub="This list is rendered from the same signal registry the scoring engine runs — it cannot drift from the product. Three pillars, weighted by how much they move discoverability; within each pillar, every signal declares its weight and pass/warn thresholds."
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>
          {PILLAR_ORDER.map((pillar) => (
            <div key={pillar} style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 18, padding: "24px 24px 18px" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                <h3 style={{ fontFamily: SG, fontWeight: 700, fontSize: 18, letterSpacing: "-0.01em", color: "var(--c-ink)", margin: 0 }}>{PILLAR_LABEL[pillar]}</h3>
                <span style={{ fontFamily: JM, fontSize: 13, fontWeight: 700, color: "var(--c-action)", background: "var(--c-soft)", padding: "4px 10px", borderRadius: 7, whiteSpace: "nowrap" }}>
                  {pct(PILLAR_WEIGHTS[pillar])} of score
                </span>
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--c-muted)", margin: "8px 0 14px" }}>{PILLAR_BLURB[pillar]}</p>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {signalsByPillar(pillar).map((s) => (
                  <SignalRow key={s.key} s={s} />
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12.5, color: "var(--c-faint)", margin: "14px 4px 0", textAlign: "center" }}>
          Percentages are each signal&rsquo;s weight within its pillar (web). App Store scans score the subset of signals that apply and renormalise — nothing inapplicable is counted against you.
        </p>

        {/* Band scale */}
        <div style={{ marginTop: 26, background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 18, padding: "20px 24px" }}>
          <p style={{ fontFamily: JM, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-faint)", margin: "0 0 12px" }}>What the number means</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {SCORE_BANDS.map((b) => (
              <span key={b.key} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `color-mix(in oklab, ${b.color} 10%, transparent)`, border: `1px solid color-mix(in oklab, ${b.color} 28%, transparent)`, borderRadius: 10, padding: "8px 13px" }}>
                <span style={{ width: 9, height: 9, borderRadius: 999, background: b.color, flexShrink: 0 }} />
                <span style={{ fontFamily: SG, fontWeight: 700, fontSize: 13, color: "var(--c-ink)" }}>{b.label}</span>
                <span style={{ fontFamily: JM, fontSize: 11.5, color: "var(--c-faint)" }}>{b.min}–{b.max}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── The pipeline ───────────────────────────────────────────────────── */}
      <section id="pipeline" style={{ maxWidth: 1180, margin: "0 auto", padding: "64px 28px 20px", scrollMarginTop: 88 }}>
        <SectionHead
          eyebrow="The pipeline"
          title="Supply × Demand → Synthesis"
          sub="A scan is three passes: what exists today (you vs. competitors), what buyers are actually searching for, and the plans that fall out of crossing the two. Scoring is deterministic; every generated insight cites the evidence it came from."
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>
          {PIPELINE.map((p) => (
            <div key={p.n} style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 18, padding: "26px 26px 22px" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontFamily: JM, fontWeight: 700, fontSize: 24, color: "var(--c-action)", letterSpacing: "-0.02em" }}>{p.n}</span>
                <h3 style={{ fontFamily: SG, fontWeight: 700, fontSize: 19, letterSpacing: "-0.01em", color: "var(--c-ink)", margin: 0 }}>{p.name}</h3>
              </div>
              <p style={{ fontFamily: JM, fontSize: 12, fontWeight: 600, color: "var(--c-muted)", margin: "10px 0 12px" }}>{p.q}</p>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 9 }}>
                {p.points.map((pt, i) => (
                  <li key={i} style={{ display: "flex", gap: 9, fontSize: 13.5, lineHeight: 1.55, color: "var(--c-muted)" }}>
                    <span aria-hidden style={{ color: "var(--c-action)", fontWeight: 700, flexShrink: 0 }}>→</span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── Why trust the score ────────────────────────────────────────────── */}
      <section id="trust" style={{ maxWidth: 1180, margin: "0 auto", padding: "64px 28px 20px", scrollMarginTop: 88 }}>
        <SectionHead
          eyebrow="Why trust it"
          title="Why the score holds up"
          sub="Most “AI audits” are a prompt and a prayer. ReachKit separates the arithmetic from the language: deterministic scoring, evidence-grounded generation, and a verification loop that checks reality before anything counts."
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>
          {TRUST.map((t) => (
            <div key={t.title} style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 18, padding: "26px 26px 22px" }}>
              <span style={{ display: "inline-block", fontFamily: JM, fontSize: 11, fontWeight: 600, color: "var(--c-action)", background: "var(--c-soft)", padding: "5px 11px", borderRadius: 7 }}>{t.tag}</span>
              <h3 style={{ fontFamily: SG, fontWeight: 700, fontSize: 18, letterSpacing: "-0.01em", color: "var(--c-ink)", margin: "14px 0 8px" }}>{t.title}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--c-muted)", margin: 0 }}>{t.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Dashboard glimpse ──────────────────────────────────────────────── */}
      <section id="glimpse" style={{ maxWidth: 1180, margin: "0 auto", padding: "64px 28px 24px", scrollMarginTop: 88 }}>
        <SectionHead
          eyebrow="The implementation"
          title="What the paid dashboard looks like"
          sub="These are the real dashboard components with sample data from a demo scan. Your own dashboard renders your live signals, your competitor set, and your ranked queue — refreshed weekly."
        />
        <DashboardGlimpse />
        <p style={{ fontSize: 13, color: "var(--c-faint)", margin: "14px 4px 0", textAlign: "center" }}>
          Sample data shown. Run a free scan below to see your own numbers — no account needed.
        </p>
      </section>

      {/* ── The secret is free — CTA ───────────────────────────────────────── */}
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 28px 90px" }}>
        <div style={{ background: "linear-gradient(135deg, var(--c-dark), var(--c-dark2))", borderRadius: 22, padding: "48px 32px", textAlign: "center" }}>
          <p style={{ fontFamily: JM, fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-on-dark-muted)", margin: 0 }}>The secret is free</p>
          <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: "clamp(1.6rem, 3vw, 2.3rem)", letterSpacing: "-0.02em", color: "var(--c-on-dark)", margin: "12px auto 10px", maxWidth: 640 }}>
            You&rsquo;ve just read the entire methodology. Now run it.
          </h2>
          <p style={{ fontSize: 15.5, lineHeight: 1.6, color: "var(--c-on-dark-muted)", margin: "0 auto 24px", maxWidth: 560 }}>
            Everything above is public because the model isn&rsquo;t the moat — the execution is. The free scan gives you the score and your top fixes. Paid plans run the whole engine every week: the ranked queue, the drafts, the verification, the score history.
          </p>
          <div style={{ maxWidth: 540, margin: "0 auto", textAlign: "left" }}>
            <ScanInput />
          </div>
        </div>
      </section>
    </main>
  );
}
