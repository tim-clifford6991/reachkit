import * as React from "react";
import { NavBar } from "./NavBar";
import { CompareCard } from "./CompareCard";
import { Footer } from "./Footer";

/**
 * CompareScreen — the public compare hub (`/compare`): NavBar, a hero, and a grid of
 * CompareCard "ReachKit vs X" index cards linking to each comparison page. SEO +
 * conversion surface for high-intent "alternative to" queries. Composes CompareCard.
 */
export interface CompareScreenProps {
  _unused?: never;
}

const SECTION: React.CSSProperties = { maxWidth: 1080, margin: "0 auto", padding: "0 24px" };
const RIVALS = [
  { competitor: "Ahrefs", tagline: "SEO toolset", blurb: "A deep SEO suite for agencies. ReachKit scores web + App Store and turns it into a small weekly to-do list at indie pricing." },
  { competitor: "Semrush", tagline: "Marketing platform", blurb: "Enterprise breadth and price. ReachKit is the focused, founder-first alternative — score, plan, drafts." },
  { competitor: "Otter.ai", tagline: "Meeting notes", blurb: "For nudgi-class products: see exactly how Otter out-ranks you and the keywords to take back." },
  { competitor: "Doing it manually", tagline: "Spreadsheets & vibes", blurb: "Trade the guesswork for a grounded score and a ranked plan you can actually work." },
];

export function CompareScreen() {
  return (
    <div style={{ background: "var(--c-bg)", fontFamily: "var(--font-sans)", color: "var(--c-ink)" }}>
      <NavBar />
      <div style={{ background: "radial-gradient(900px 380px at 50% -10%, var(--c-soft), transparent 70%)" }}>
        <div style={{ ...SECTION, padding: "56px 24px 32px", textAlign: "center", display: "flex", flexDirection: "column", gap: 12 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(2.1rem, 4.5vw, 3.2rem)", letterSpacing: "-0.02em", lineHeight: 1.05, margin: 0 }}>ReachKit vs the alternatives</h1>
          <p style={{ fontSize: 16, color: "var(--c-muted)", maxWidth: 620, margin: "0 auto", lineHeight: 1.6 }}>Honest comparisons for the tools founders weigh us against.</p>
        </div>
      </div>
      <div style={{ ...SECTION, padding: "16px 24px 64px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {RIVALS.map((r) => (
            <CompareCard key={r.competitor} competitor={r.competitor} tagline={r.tagline} blurb={r.blurb} />
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
}
