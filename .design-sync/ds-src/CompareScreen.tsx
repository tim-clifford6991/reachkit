/* @mirrors app/(marketing)/compare/page.tsx */
import * as React from "react";
import { NavBar } from "./NavBar";
import { PageHeader } from "./PageHeader";
import { Footer } from "./Footer";

/**
 * CompareScreen — the `/compare` hub: NavBar, a centred PageHeader ("Compare" ·
 * "Every tool below sells you data. / ReachKit sells you the decision."), the
 * dark "what ReachKit does, end to end" 5-step band, the grouped comparison grid
 * (four categories, 13 head-to-heads), and the closing CTA. Mirrors the live
 * inline page + compare-content registry.
 */
export interface CompareScreenProps {
  _unused?: never;
}

const SG = "var(--font-display)", JM = "var(--font-mono)";

const STEPS = [
  { n: "01", title: "Scan", body: "Reads your actual site, app-store listings, and reviews — not a form you fill in." },
  { n: "02", title: "Measure", body: "Real buyer search demand in your category, and where your rivals actually show up." },
  { n: "03", title: "Score", body: "0–100 from 18 deterministic signals across SEO (45%), Content (30%), Outreach (25%)." },
  { n: "04", title: "Plan", body: "A ranked weekly action plan — every fix cites the evidence it came from." },
  { n: "05", title: "Verify", body: "Ship a fix and ReachKit re-checks it live. It only counts when it's confirmed." },
];

type Entry = { name: string; tagline: string; verdict: string; slug: string };
const CATEGORIES: { label: string; note: string; entries: Entry[] }[] = [
  {
    label: "SEO suites & rank trackers",
    note: "Deep keyword and link databases built for professionals. Superb data — but the analysis, prioritisation, and follow-through are left to you.",
    entries: [
      { name: "Ahrefs", tagline: "SEO toolset", verdict: "World-class link and keyword data for SEO pros. ReachKit skips the dataset and hands a founder the decision.", slug: "ahrefs" },
      { name: "Semrush", tagline: "marketing suite", verdict: "Fifty tools for a marketing team with a driver. ReachKit is one engine that decides for you.", slug: "semrush" },
      { name: "Moz", tagline: "SEO software", verdict: "The tool that taught the industry SEO. ReachKit is for founders who'd rather skip the course.", slug: "moz" },
      { name: "Ubersuggest", tagline: "budget SEO", verdict: "Honest budget keyword research. ReachKit spends the same money on answers instead of ideas.", slug: "ubersuggest" },
      { name: "Mangools", tagline: "keyword research", verdict: "The friendliest keyword research on the market. ReachKit answers the question keywords can't: what do I fix?", slug: "mangools" },
      { name: "SE Ranking", tagline: "rank tracking suite", verdict: "An agency's daily rank tracker at fair prices. ReachKit tracks one thing: whether buyers can find you.", slug: "se-ranking" },
    ],
  },
  {
    label: "Audience & market research",
    note: "Tools that tell you about your market — who your buyers are, where they gather, what rivals' traffic looks like. None of them examine your own product's presence.",
    entries: [
      { name: "SparkToro", tagline: "audience research", verdict: "The best tool for learning where your audience hangs out. ReachKit fixes whether they can find you.", slug: "sparktoro" },
      { name: "GummySearch", tagline: "Reddit research", verdict: "The best window into Reddit pain points. ReachKit turns your whole presence into a scored, fixable system.", slug: "gummysearch" },
      { name: "Similarweb", tagline: "traffic intelligence", verdict: "Market-level traffic estimates for enterprises. ReachKit measures your niche precisely — and fixes it.", slug: "similarweb" },
    ],
  },
  {
    label: "AI assistants & content tools",
    note: "Great at producing words. Weak at measuring your actual situation — and a plan built on guesses inherits the guesses.",
    entries: [
      { name: "ChatGPT", tagline: "general AI assistant", verdict: "Brilliant generalist, ungrounded advisor. ReachKit measures first — so the plan can't hallucinate.", slug: "chatgpt" },
      { name: "Surfer SEO", tagline: "content optimization", verdict: "Excellent at optimizing the article you chose. ReachKit tells you whether that article was the right move.", slug: "surfer-seo" },
    ],
  },
  {
    label: "Search & app-store data",
    note: "First-party dashboards that report what already happened. Essential inputs — ReachKit reads the same kinds of signals and turns them into the fix list.",
    entries: [
      { name: "Google Search Console", tagline: "search data", verdict: "The free source of truth every founder should have. ReachKit is what turns its data into a plan.", slug: "google-search-console" },
      { name: "Appfigures", tagline: "ASO analytics", verdict: "Serious app-store analytics for app businesses. ReachKit scores your whole presence — store and web — and plans the fixes.", slug: "appfigures" },
    ],
  },
];

function CompareCard({ e }: { e: Entry }) {
  return (
    <a href={`/compare/${e.slug}`} style={{ display: "flex", flexDirection: "column", gap: 10, border: "1px solid var(--c-line)", borderRadius: 16, padding: 22, background: "var(--c-surface)", textDecoration: "none" }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>
        <span style={{ color: "var(--c-action)" }}>ReachKit</span> <span style={{ color: "var(--c-faint)" }}>vs</span> <span style={{ color: "var(--c-ink)" }}>{e.name}</span>
      </div>
      <div style={{ fontFamily: SG, fontWeight: 700, fontSize: 19, color: "var(--c-ink)" }}>ReachKit vs {e.name}</div>
      <div style={{ fontFamily: JM, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--c-faint)" }}>{e.tagline}</div>
      <p style={{ flex: 1, fontSize: 13.5, lineHeight: 1.55, color: "var(--c-muted)", margin: 0 }}>{e.verdict}</p>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--c-action)" }}>Read the full comparison →</span>
    </a>
  );
}

export function CompareScreen() {
  return (
    <div style={{ background: "var(--c-bg)", fontFamily: "var(--font-sans)", color: "var(--c-ink)" }}>
      <NavBar />
      <PageHeader
        center
        padding="70px 28px 8px"
        titleMaxWidth={860}
        eyebrow="Compare"
        title={<>Every tool below sells you data.<br />ReachKit sells you the decision.</>}
        subhead={'"SEO tool" comparisons usually miss the point. The legacy suites are superb databases — keywords, backlinks, rankings — priced for professionals whose job is to do the analysis. ReachKit isn’t a rank tracker or a keyword database. It scans your actual product, scores its discoverability, and hands you the ranked, evidence-cited fix list — then verifies you shipped it.'}
      />

      {/* End-to-end dark band */}
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 28px 0" }}>
        <div style={{ background: "linear-gradient(160deg, var(--c-dark), var(--c-dark2))", borderRadius: 20, padding: "36px 34px", color: "var(--c-on-dark)" }}>
          <div style={{ fontFamily: JM, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-on-dark-muted)", marginBottom: 22 }}>What ReachKit does, end to end</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 22 }}>
            {STEPS.map((s) => (
              <div key={s.n}>
                <div style={{ fontFamily: JM, fontSize: 13, fontWeight: 700, color: "color-mix(in oklab, var(--c-action), white 32%)" }}>{s.n}</div>
                <div style={{ fontFamily: SG, fontWeight: 700, fontSize: 17, color: "var(--c-on-dark)", margin: "6px 0 6px" }}>{s.title}</div>
                <p style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--c-on-dark-muted)", margin: 0 }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Grouped comparisons */}
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 28px 8px" }}>
        {CATEGORIES.map((cat) => (
          <div key={cat.label} style={{ marginBottom: 44 }}>
            <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 22, letterSpacing: "-0.02em", margin: "0 0 6px" }}>{cat.label}</h2>
            <p style={{ fontSize: 14.5, lineHeight: 1.55, color: "var(--c-muted)", margin: "0 0 18px", maxWidth: 720 }}>{cat.note}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>
              {cat.entries.map((e) => <CompareCard key={e.slug} e={e} />)}
            </div>
          </div>
        ))}
      </section>

      {/* Closing CTA */}
      <section style={{ maxWidth: 720, margin: "0 auto", padding: "24px 28px 72px", textAlign: "center" }}>
        <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 28, letterSpacing: "-0.02em", margin: 0 }}>The comparison that actually matters is your product</h2>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: "var(--c-muted)", maxWidth: 480, margin: "14px auto 22px" }}>Run the free scan: your 0–100 discoverability score, the evidence behind it, and the first fixes — before you spend a cent on any tool on this page.</p>
        <a href="/scan" style={{ display: "inline-block", fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 15, color: "var(--c-on-dark)", background: "var(--c-action)", borderRadius: 11, padding: "13px 24px", textDecoration: "none" }}>See your Discoverability Score — free</a>
        <p style={{ fontFamily: JM, fontSize: 12.5, color: "var(--c-faint)", marginTop: 16 }}>Free scan · then $59/mo Solo or $129/mo Growth</p>
      </section>
      <Footer />
    </div>
  );
}
