/* @mirrors app/(marketing)/teardowns/[slug]/page.tsx */
import * as React from "react";
import { NavBar } from "./NavBar";
import { Footer } from "./Footer";

/**
 * TeardownsScreen — a public teardown detail (`/teardowns/[slug]`): NavBar, a
 * breadcrumb, the "Discoverability teardown" header (title + intro + published
 * date), then a two-column body — the teardown sections on the left and a
 * sidebar with the Discoverability Score panel (total + band + Content /
 * Outreach / SEO ·ASO breakdown + "Last verified" + editorial-estimate
 * provenance), a "Key takeaways" list, and a "What does your app score?" CTA —
 * closing with the "← All teardowns" back link. Mirrors the live teardown page
 * (sample data from the real Raycast teardown).
 */
export interface TeardownsScreenProps {
  _unused?: never;
}

const JM = "var(--font-mono)", SG = "var(--font-display)", SANS = "var(--font-sans)";
const scoreColor = (s: number) => (s < 35 ? "var(--c-band-invisible)" : s < 55 ? "var(--c-band-hard)" : s < 70 ? "var(--c-band-fair)" : "var(--c-band-findable)");
const scoreLabel = (s: number) => (s >= 80 ? "Excellent" : s >= 60 ? "Good" : s >= 40 ? "Fair" : s >= 20 ? "Needs Work" : "Critical");

const APP_NAME = "Raycast";
const TITLE = "Web Teardown: Raycast";
const PLATFORM: "web" | "ios" = "web";
const PUBLISHED = "June 8, 2026";
const LAST_VERIFIED = "June 20, 2026";
const INTRO =
  "Raycast has something most products would trade a lot for: genuine, evangelical love from its users and a thriving extension store that compounds its value daily. Its discoverability gap is not awareness inside the Mac-power-user bubble — it is the framing that keeps it inside that bubble.";

const SCORE = 49;
const BREAKDOWN = [{ label: "Content", value: 52 }, { label: "Outreach", value: 50 }, { label: "SEO / ASO", value: 45 }];

const SECTIONS = [
  {
    heading: "What does Raycast do differently from Spotlight and Alfred?",
    body: [
      "Raycast is a keyboard-first command bar for the Mac: a single hotkey that launches apps, runs calculations, manages clipboard history, controls windows, and — crucially — extends into almost anything via its extension store. It does what Spotlight and Alfred do, faster and more elegantly, but the extension ecosystem is what turns a launcher into a platform.",
      "The newer and more strategically important differentiator is AI. Raycast has folded AI directly into the command bar — ask a question, run a quick prompt, trigger an AI command from anywhere on the system — which is a category that did not exist when Alfred defined the launcher genre.",
    ],
  },
  {
    heading: "Where is Raycast's audience searching?",
    body: [
      "The classic queries — 'alfred alternative' and 'spotlight replacement' — are reliable but small and recruit only the launcher-curious. The growth is in the adjacent clusters where intent is rising fast and Raycast's framing has not yet planted a flag.",
      "The AI cluster is the high-upside one: 'AI command bar' and 'AI launcher mac', plus the broad, fast-growing space around 'how to use AI without a browser tab'-style intent. The category is young enough that the term is still up for grabs.",
    ],
  },
];

const TAKEAWAYS = [
  "Treat 'alfred alternative' and 'spotlight replacement' as a held position, not a growth lever — they only recruit the finite launcher-curious pool.",
  "Build a dedicated AI page targeting 'AI command bar' and 'AI launcher mac' — the category term is young and winnable, and cheaper to claim now than reclaim later.",
  "Publish 'the fastest way to use AI without leaving what you're doing' to capture rising AI-shopper intent that will never type 'Spotlight alternative'.",
  "Give the team-adoption motion explicit 'Raycast for Teams' collateral so existing individual champions have a page to forward.",
];

function ScorePanel() {
  const c = scoreColor(SCORE);
  return (
    <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 16, padding: "22px 24px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div style={{ fontFamily: JM, fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-faint)" }}>Discoverability Score</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, margin: "4px 0 2px" }}>
            <span style={{ fontFamily: JM, fontWeight: 700, fontSize: 40, lineHeight: 1, color: c }}>{SCORE}</span>
            <span style={{ fontFamily: JM, fontSize: 14, color: "var(--c-faint)" }}>/ 100</span>
          </div>
          <div style={{ fontFamily: JM, fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: c }}>{scoreLabel(SCORE)}</div>
        </div>
        <div style={{ flexShrink: 0, border: "1px solid var(--c-line)", borderRadius: 8, padding: "5px 10px", fontFamily: JM, fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-faint)" }}>
          {PLATFORM === "ios" ? "iOS App Store" : "Web"}
        </div>
      </div>

      <div style={{ height: 1, background: "var(--c-line)", margin: "20px 0" }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {BREAKDOWN.map((p) => (
          <div key={p.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 64, flexShrink: 0, fontFamily: JM, fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-faint)" }}>{p.label}</span>
            <span style={{ flex: 1, height: 4, borderRadius: 999, background: "var(--c-line)", overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${p.value}%`, background: scoreColor(p.value) }} /></span>
            <span style={{ width: 28, textAlign: "right", fontFamily: JM, fontWeight: 600, fontSize: 12, color: "var(--c-ink)" }}>{p.value}</span>
          </div>
        ))}
      </div>

      <p style={{ fontFamily: JM, fontSize: 11, color: "var(--c-faint)", margin: "20px 0 0" }}>
        Last verified: {LAST_VERIFIED}
      </p>
      <p style={{ fontFamily: JM, fontSize: 11, lineHeight: 1.5, color: "var(--c-faint)", margin: "8px 0 0" }}>
        Editorial estimate from our public rubric at time of writing —{" "}
        <a href="/scan" style={{ color: "var(--c-action)", textDecoration: "underline" }}>run a free scan</a>{" "}
        for the live score.
      </p>
    </div>
  );
}

export function TeardownsScreen() {
  return (
    <div style={{ background: "var(--c-bg)", fontFamily: SANS, color: "var(--c-ink)" }}>
      <NavBar />
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 28px 96px" }}>
        {/* Breadcrumb */}
        <nav style={{ marginBottom: 32 }}>
          <ol style={{ display: "flex", alignItems: "center", gap: 8, margin: 0, padding: 0, listStyle: "none", fontFamily: JM, fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-faint)" }}>
            <li><a href="/" style={{ color: "var(--c-faint)", textDecoration: "none" }}>ReachKit</a></li>
            <li aria-hidden style={{ opacity: 0.4 }}>/</li>
            <li><a href="/teardowns" style={{ color: "var(--c-faint)", textDecoration: "none" }}>Teardowns</a></li>
            <li aria-hidden style={{ opacity: 0.4 }}>/</li>
            <li style={{ color: "var(--c-ink)" }}>{APP_NAME}</li>
          </ol>
        </nav>

        {/* Header */}
        <header style={{ marginBottom: 40 }}>
          <p style={{ fontFamily: JM, fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-action)", margin: "0 0 12px" }}>Discoverability teardown</p>
          <h1 style={{ fontFamily: SG, fontWeight: 700, fontSize: "clamp(30px, 4vw, 40px)", letterSpacing: "-0.02em", lineHeight: 1.1, color: "var(--c-ink)", margin: 0 }}>{TITLE}</h1>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: "var(--c-muted)", margin: "16px 0 0", maxWidth: 640 }}>{INTRO}</p>
          <p style={{ fontFamily: JM, fontSize: 12, color: "var(--c-faint)", margin: "16px 0 0" }}>Published {PUBLISHED}</p>
        </header>

        {/* Two-column: content + sidebar */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 40, alignItems: "start" }}>
          {/* Main content */}
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 36 }}>
            {SECTIONS.map((s) => (
              <section key={s.heading}>
                <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 22, letterSpacing: "-0.02em", lineHeight: 1.25, color: "var(--c-ink)", margin: 0 }}>{s.heading}</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
                  {s.body.map((para, i) => (
                    <p key={i} style={{ fontSize: 16, lineHeight: 1.6, color: "var(--c-muted)", margin: 0 }}>{para}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* Sidebar */}
          <aside style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 340 }}>
            <ScorePanel />

            <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 16, padding: "22px 24px" }}>
              <p style={{ fontFamily: JM, fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-action)", margin: 0 }}>Key takeaways</p>
              <ol style={{ margin: "16px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
                {TAKEAWAYS.map((t, i) => (
                  <li key={i} style={{ display: "flex", gap: 12 }}>
                    <span style={{ flexShrink: 0, fontFamily: JM, fontSize: 12, fontWeight: 700, color: "var(--c-action)" }}>{String(i + 1).padStart(2, "0")}</span>
                    <span style={{ fontSize: 15, lineHeight: 1.6, color: "var(--c-muted)" }}>{t}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div style={{ textAlign: "center", background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 16, padding: "22px 24px" }}>
              <p style={{ fontFamily: SG, fontWeight: 700, fontSize: 16, letterSpacing: "-0.02em", color: "var(--c-ink)", margin: 0 }}>What does your app score?</p>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--c-muted)", margin: "6px 0 0" }}>Run a free scan and see your discoverability gaps in under a minute.</p>
              <a href="/scan" style={{ display: "inline-flex", alignItems: "center", marginTop: 16, background: "var(--c-action)", color: "var(--c-on-dark)", borderRadius: 10, padding: "11px 20px", fontFamily: SANS, fontWeight: 600, fontSize: 14, textDecoration: "none" }}>Scan my app free</a>
            </div>
          </aside>
        </div>

        {/* Back link */}
        <div style={{ marginTop: 64, paddingTop: 32, borderTop: "1px solid var(--c-line)" }}>
          <a href="/teardowns" style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: "var(--c-action)", textDecoration: "none" }}>← All teardowns</a>
        </div>
      </div>
      <Footer />
    </div>
  );
}
