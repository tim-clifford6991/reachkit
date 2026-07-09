/* @mirrors components/sections/company-ticker.tsx */
import * as React from "react";

/**
 * CompanyTicker — the "companies we've analyzed" social-proof strip that rides
 * below the hero input: a small mono label followed by the recently-scanned
 * company wordmarks. Mirrors `components/sections/company-ticker.tsx`.
 */
export interface CompanyTickerProps {
  label?: string;
  companies?: string[];
}

const DEFAULT = ["Raycast", "Cal.com", "Plausible", "Reflect", "Linear", "Resend", "Bearable", "CardPointers"];

export function CompanyTicker({ label = "COMPANIES WE'VE ANALYZED", companies = DEFAULT }: CompanyTickerProps) {
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "18px 28px 8px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 26, justifyContent: "center" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em", color: "var(--c-faint)" }}>{label}</span>
      {companies.map((c) => (
        <span key={c} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--c-muted)", opacity: 0.85 }}>{c}</span>
      ))}
    </div>
  );
}
