import * as React from "react";
import { NavBar } from "./NavBar";
import { LandingHero } from "./LandingHero";
import { FeatureStep } from "./FeatureStep";
import { ComparisonTable } from "./ComparisonTable";
import { PricingTable } from "./PricingTable";
import { FaqItem } from "./FaqItem";
import { Footer } from "./Footer";

/**
 * LandingScreen — the marketing home page (`/`): the full top-to-bottom
 * composition — NavBar, the radial-fade hero with the scan input, the 3-step
 * "how it works" walkthrough, the feature-comparison matrix, pricing, FAQ, and
 * footer. Composes the real marketing primitives so the whole page is viewable
 * and tweakable in one card. Renders fully with no props.
 */
export interface LandingScreenProps {
  _unused?: never;
}

const SECTION: React.CSSProperties = { maxWidth: 1080, margin: "0 auto", padding: "0 24px" };

export function LandingScreen() {
  return (
    <div style={{ background: "var(--c-bg)", fontFamily: "var(--font-sans)", color: "var(--c-ink)" }}>
      <NavBar />
      <LandingHero />

      {/* HOW IT WORKS */}
      <div style={{ ...SECTION, padding: "56px 24px", display: "flex", flexDirection: "column", gap: 24 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 28, letterSpacing: "-0.02em", textAlign: "center", margin: 0 }}>From URL to a ranked plan in three steps</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, justifyContent: "center" }}>
          <div style={{ flex: "1 1 260px", maxWidth: 320 }}><FeatureStep step={1} title="Paste a URL. Get a score in under a minute." body="We scan your live page and score how findable you are across Content, Outreach and SEO — no login for your first scan." /></div>
          <div style={{ flex: "1 1 260px", maxWidth: 320 }}><FeatureStep step={2} title="See how rivals get found." body="We discover your real competitors and where their customers come from — the channels, keywords and content you can copy." /></div>
          <div style={{ flex: "1 1 260px", maxWidth: 320 }}><FeatureStep step={3} title="Work a ranked weekly plan." body="A calendar of the highest-leverage moves — with drafts ready to send — that lifts your score over time." /></div>
        </div>
      </div>

      {/* COMPARISON */}
      <div style={{ ...SECTION, padding: "24px 24px 56px" }}>
        <ComparisonTable
          tools={["ReachKit", "Ahrefs", "Doing it manually"]}
          rows={[
            { capability: "Discoverability score", cells: [true, false, false] },
            { capability: "Competitor channel teardown", cells: [true, "partial", false] },
            { capability: "Ranked weekly plan", cells: [true, false, false] },
            { capability: "Draft copy per fix", cells: [true, false, false] },
            { capability: "Backlink index", cells: [false, true, false] },
          ]}
        />
      </div>

      {/* PRICING */}
      <div style={{ background: "var(--c-surface)", borderTop: "1px solid var(--c-line)", borderBottom: "1px solid var(--c-line)", padding: "56px 0" }}>
        <div style={SECTION}><PricingTable /></div>
      </div>

      {/* FAQ */}
      <div style={{ ...SECTION, padding: "56px 24px", maxWidth: 760, display: "flex", flexDirection: "column", gap: 8 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 24, textAlign: "center", margin: "0 0 12px" }}>Questions</h2>
        <FaqItem question="How long does a scan take?" answer="Your first free scan takes under a minute. The deep paid scan (competitors + customers + plan) runs in a couple of minutes." open />
        <FaqItem question="Do I need to install anything?" answer="No. Paste your URL — we scan your live public page and public SEO signals. Nothing to embed." />
        <FaqItem question="Will this auto-post for me?" answer="Never. We draft everything and hand it to you to review and publish — auto-posting risks shadow-bans. You stay in control." />
      </div>

      <Footer />
    </div>
  );
}
