/* @mirrors components/sections/captured/pricing-screen.tsx */
import * as React from "react";
import { NavBar } from "./NavBar";
import { PricingTable } from "./PricingTable";
import { FaqItem } from "./FaqItem";
import { Footer } from "./Footer";

/**
 * PricingScreen — the marketing pricing page (`/pricing`): NavBar, a centred
 * header, the plan-selection table, a short billing FAQ, and the footer. Composes
 * the real PricingTable primitive. Renders fully with no props.
 */
export interface PricingScreenProps {
  _unused?: never;
}

const SECTION: React.CSSProperties = { maxWidth: 1080, margin: "0 auto", padding: "0 24px" };

export function PricingScreen() {
  return (
    <div style={{ background: "var(--c-bg)", fontFamily: "var(--font-sans)", color: "var(--c-ink)", minHeight: "100%" }}>
      <NavBar />

      <div style={{ ...SECTION, padding: "56px 24px 20px", textAlign: "center", display: "flex", flexDirection: "column", gap: 10 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 34, letterSpacing: "-0.02em", margin: 0 }}>Start free. Upgrade when you can see the gap.</h1>
        <p style={{ fontSize: 16, color: "var(--c-muted)", maxWidth: 560, margin: "0 auto", lineHeight: 1.6 }}>Your first scan and score are free. The Solo plan unlocks competitors, customer demand, and your ranked weekly plan.</p>
      </div>

      <div style={{ ...SECTION, padding: "24px 24px 56px" }}>
        <PricingTable />
      </div>

      <div style={{ ...SECTION, padding: "8px 24px 64px", maxWidth: 760, display: "flex", flexDirection: "column", gap: 8 }}>
        <FaqItem question="Is there a free trial on paid plans?" answer="Yes — Solo starts with a 7-day trial. Cancel any time from the billing portal." open />
        <FaqItem question="Can I cancel any time?" answer="Yes. Manage or cancel your subscription yourself from the self-service billing portal — no email required." />
        <FaqItem question="What counts as a scan?" answer="One URL, scanned. Your free scan is unlimited to re-run; paid deep scans + the weekly refresh keep your plan current." />
      </div>

      <Footer />
    </div>
  );
}
