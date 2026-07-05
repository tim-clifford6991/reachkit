/**
 * /how-it-works — a plain-language walkthrough of what a founder gets and how
 * ReachKit gets there. Written reader-value first (see why buyers can't find
 * you, then how to fix it); the full openness — the real 18-signal registry
 * with its pillar weights (imported from lib/scan/signals, the same module the
 * engine scores with), the three-pass pipeline (what's out there → what buyers
 * search → what to do), and why the number is trustworthy — is kept as a trust
 * asset, not the thesis. Then a fixture-data glimpse of the paid dashboard,
 * ending on the free-scan CTA. Buyer language only: no internal jargon, no
 * vendor names.
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
import { DashboardGlimpseLazy as DashboardGlimpse } from "@/components/sections/dashboard-glimpse-lazy";
import { HeroFade } from "@/components/sections/hero-fade";
import { SIGNAL_REGISTRY, PILLAR_WEIGHTS, type Pillar, type SignalDefinition } from "@/lib/scan/signals";
import { SCORE_BANDS } from "@/lib/scan/score-bands";

export const metadata: Metadata = buildMetadata({
  title: "How ReachKit works — see why buyers can't find you",
  description:
    "Paste your link and watch ReachKit read your live site, score 18 discoverability signals, and hand you a ranked plan to get found. Every step shown in the open — run it free on your own product.",
  path: "/how-it-works",
});

const HOW_TO_LD = howToLd({
  name: "How ReachKit works",
  description: "Scan your product, read your Discoverability report, and work a weekly action queue.",
  steps: [
    { name: "Scan", text: "Paste your App Store URL or website. ReachKit fetches it and scores 18 discoverability signals in under a minute — no account needed." },
    { name: "Report", text: "See your score and your top findings: what's holding you back and what to fix first, every claim grounded in your live page." },
    { name: "Engine", text: "Paid plans run the full engine weekly — buyer search demand, competitor coverage, and a ranked action queue that verifies each fix and tracks your score over time." },
  ],
});

const SG = "var(--font-display)", JM = "var(--font-mono)";

const STEPS = [
  { n: "01", title: "Scan your live page", body: "Paste your App Store URL or website. ReachKit reads the real page — the same signals search engines and buyers weigh — and scores all 18 in under a minute. No account needed for your first scan.", tag: "Under a minute" },
  { n: "02", title: "See the searches your rivals win", body: "In plain language: the searches your buyers run where a competitor shows up and you don't, and the score that measures the gap — every claim pulled straight from your live page, so you can see exactly what's costing you traffic.", tag: "Grounded in evidence" },
  { n: "03", title: "Work a weekly queue that closes the gap", body: "Paid plans turn the report into a short queue each week, ranked by impact. Mark a fix done and ReachKit re-checks your live page before your score moves — so what you're watching is the gap closing, week after week.", tag: "Verified, not vanity" },
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

/** Interstitial pull toward the free scan — every major section lands here. */
function SectionCta({ text, link }: { text: string; link: string }) {
  return (
    <p style={{ textAlign: "center", margin: "26px 0 0", fontSize: 14, color: "var(--c-muted)" }}>
      {text}{" "}
      <a href="#scan" style={{ fontFamily: JM, fontSize: 12.5, fontWeight: 700, color: "var(--c-action)", background: "var(--c-soft)", padding: "6px 13px", borderRadius: 999, textDecoration: "none", whiteSpace: "nowrap", marginLeft: 6 }}>
        {link} ↓
      </a>
    </p>
  );
}

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
// Pipeline copy — grounded in the real scan modules under lib/scan (the
// profile pass, the buyer-search pass, and the final planning pass). No
// invented sources or numbers, and no vendor names: capability language only
// ("live search results", "real ranking positions").
// ---------------------------------------------------------------------------
const PIPELINE = [
  {
    n: "01",
    name: "What's out there today",
    q: "Everything your product already puts out — next to your rivals.",
    points: [
      "We crawl your live pages and parse the on-page facts: title, meta description, structured data, canonical, heading structure, content depth, share tags, image alt coverage.",
      "We read your sitemap and feeds to measure how often you really publish, and map your owned channels (blog, YouTube, newsletter).",
      "We run the same profile on a category-validated competitor set — so every gap is relative to rivals in YOUR category, not a same-named brand in another market.",
      "We check the surfaces buyers decide on: marketplace listings (Product Hunt, G2, Capterra, AlternativeTo), community mentions (Hacker News, Reddit), and comparison pages.",
    ],
  },
  {
    n: "02",
    name: "What buyers are searching for",
    q: "The searches your buyers actually run — and the rivals who win them today.",
    points: [
      "From your product brief we generate pain queries in your buyers' own words — the things they type before they know your name.",
      "Each query runs against live search results: real ranking positions and real search volumes, the same SERP data the big SEO suites are built on — not estimates.",
      "Hits are deduplicated, classified by intent, and clustered into a ranked list of themes where the search demand is real — and reachable for you.",
      "Competitor reviews are mined for buyer language: what people praise, what they complain about, and the words they use for both.",
    ],
  },
  {
    n: "03",
    name: "What to do about it",
    q: "The two crossed into your weekly queue — ranked, evidence-backed, biggest lever first.",
    points: [
      "Your content plan matches what buyers search with the format that currently wins each result page — topic, target keywords with real volumes, buyer angle, brief.",
      "Your distribution plan is the overlap of where rivals get found and where your audience already is — channel, specific target, why, and effort.",
      "Every item cites the evidence it came from. If we can't point at the evidence, the item doesn't ship.",
    ],
  },
];

const TRUST = [
  {
    title: "The number is deterministic",
    body: "Your score is computed from the 18-signal registry above — fixed weights, fixed pass/warn/fail thresholds, no AI anywhere in the arithmetic. Same inputs, same score, every time.",
    tag: "No AI in the score",
  },
  {
    title: "The words are grounded",
    body: "Every AI step reads evidence extracted from your live pages, reviews, and search results — never free association. Each recommendation cites its evidence, and a critic gate pressure-tests every card before it reaches you. Cards that can't back themselves up get dropped.",
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
    { href: "#pipeline", label: "Inside a scan" },
    { href: "#trust", label: "Why trust it" },
    { href: "#glimpse", label: "The dashboard" },
    { href: "#scan", label: "Run it free" },
  ];

  return (
    <main aria-label="How ReachKit works" style={{ background: "var(--c-surface)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(HOW_TO_LD) }} />

      {/* Hero */}
      <HeroFade>
        <p style={{ fontFamily: JM, fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-action)", margin: 0 }}>How it works</p>
        <h1 style={{ fontFamily: SG, fontWeight: 700, fontSize: "clamp(2.1rem, 4.5vw, 3.4rem)", letterSpacing: "-0.02em", lineHeight: 1.04, color: "var(--c-ink)", margin: "16px auto 0", maxWidth: 820 }}>
          See exactly why buyers can&rsquo;t find you — and how to fix it.
        </h1>
        <p style={{ fontSize: 17.5, lineHeight: 1.5, color: "var(--c-muted)", margin: "18px auto 0", maxWidth: 640 }}>
          ReachKit reads your live site the way a buyer&rsquo;s search does, shows you the searches your rivals win, and puts one score on the gap — then hands you a short weekly queue that closes it. Every step is shown in the open — no black box, nothing to take on faith.
        </p>
        <nav aria-label="On this page" style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 8, marginTop: 26 }}>
          {anchors.map((a) => (
            <a key={a.href} href={a.href} style={{ fontFamily: JM, fontSize: 12, fontWeight: 600, color: "var(--c-action)", background: "var(--c-soft)", padding: "7px 14px", borderRadius: 999, textDecoration: "none" }}>{a.label}</a>
          ))}
        </nav>
      </HeroFade>

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
          eyebrow="What we check"
          title="The 18 things we check — and how much each one counts"
          sub="This list is generated from the exact signal registry the engine scores with, so what you read here is what runs on your product. Three pillars, weighted by how much they actually move discoverability — so you always know where to spend your effort first."
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
        <SectionCta text="Wondering which of these 18 you're failing?" link="Get your score free" />
      </section>

      {/* ── The pipeline ───────────────────────────────────────────────────── */}
      <section id="pipeline" style={{ maxWidth: 1180, margin: "0 auto", padding: "64px 28px 20px", scrollMarginTop: 88 }}>
        <SectionHead
          eyebrow="Inside a scan"
          title="How your scan turns into a plan"
          sub="Every scan runs three passes: what's already out there (you vs. your rivals), what your buyers are actually searching for, and the specific plays that fall out of crossing the two. The free scan runs the first pass and scores you; paid plans run all three every week, so your queue re-ranks as the gap closes. The score is deterministic; every recommendation cites the evidence behind it."
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
        <SectionCta text="Pass one is free — see what you have (and what's missing)." link="Start the free scan" />
      </section>

      {/* ── Why trust the score ────────────────────────────────────────────── */}
      <section id="trust" style={{ maxWidth: 1180, margin: "0 auto", padding: "64px 28px 20px", scrollMarginTop: 88 }}>
        <SectionHead
          eyebrow="Why you can trust it"
          title="Why the number holds up"
          sub="Most “AI audits” are a prompt and a prayer. ReachKit keeps the maths and the language separate: a deterministic score, evidence-grounded recommendations, and a verification loop that checks reality before anything counts. The score is hard to move by design — which is exactly why you can trust it when it does."
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
        <SectionCta text="Don't take our word for the rigour — put your own product through it." link="Scan yours free" />
      </section>

      {/* ── Dashboard glimpse ──────────────────────────────────────────────── */}
      <section id="glimpse" style={{ maxWidth: 1180, margin: "0 auto", padding: "64px 28px 24px", scrollMarginTop: 88 }}>
        <SectionHead
          eyebrow="What you get"
          title="What your weekly dashboard looks like"
          sub="These are the real dashboard components with sample data from a demo scan. Your own dashboard renders your live signals, your competitor set, and your ranked queue — refreshed weekly."
        />
        <DashboardGlimpse />
        <p style={{ fontSize: 13, color: "var(--c-faint)", margin: "14px 4px 0", textAlign: "center" }}>
          Sample data shown. <a href="#scan" style={{ color: "var(--c-action)", fontWeight: 600 }}>Run a free scan</a> to see your own numbers — no account needed.
        </p>
      </section>

      {/* ── The secret is free — CTA ───────────────────────────────────────── */}
      <section id="scan" style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 28px 90px", scrollMarginTop: 88 }}>
        <div style={{ background: "linear-gradient(135deg, var(--c-dark), var(--c-dark2))", borderRadius: 22, padding: "48px 32px", textAlign: "center" }}>
          <p style={{ fontFamily: JM, fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-on-dark-muted)", margin: 0 }}>Start free</p>
          <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: "clamp(1.6rem, 3vw, 2.3rem)", letterSpacing: "-0.02em", color: "var(--c-on-dark)", margin: "12px auto 10px", maxWidth: 640 }}>
            You&rsquo;ve seen how it works. Now see why they&rsquo;re winning.
          </h2>
          <p style={{ fontSize: 15.5, lineHeight: 1.6, color: "var(--c-on-dark-muted)", margin: "0 auto 24px", maxWidth: 560 }}>
            The free scan gives you your discoverability score and your top fixes right now. Paid plans run the whole engine every week — what your buyers search, where rivals show up, the ranked queue, the verification, your score history — so you&rsquo;re never guessing what to do next.
          </p>
          <div style={{ maxWidth: 540, margin: "0 auto", textAlign: "left" }}>
            {/* No autoFocus: this input sits at the foot of the page, so focusing
                it on load would scroll the visitor straight past the content. */}
            <ScanInput autoFocus={false} />
          </div>
        </div>
      </section>
    </main>
  );
}
