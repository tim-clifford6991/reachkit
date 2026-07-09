/* @mirrors components/sections/company-ticker.tsx */
import * as React from "react";

/**
 * CompanyTicker — the "companies we've analyzed" trust strip under the hero: a
 * centred mono-uppercase label above a seamless, edge-faded marquee of
 * favicon + name chips (the row is duplicated and translated -50% so it loops
 * with no seam; pauses on hover). Mirrors `components/sections/company-ticker.tsx`.
 */
export interface CompanyTickerProps {
  companies?: { name: string; domain: string }[];
}

const JM = "var(--font-mono)", PJ = "var(--font-sans)";
const favicon = (domain: string) => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;

const DEFAULT: NonNullable<CompanyTickerProps["companies"]> = [
  { name: "Raycast", domain: "raycast.com" },
  { name: "Cal.com", domain: "cal.com" },
  { name: "Plausible", domain: "plausible.io" },
  { name: "Reflect", domain: "reflect.app" },
  { name: "Linear", domain: "linear.app" },
  { name: "Resend", domain: "resend.com" },
  { name: "Bearable", domain: "bearable.app" },
  { name: "CardPointers", domain: "cardpointers.com" },
];

const TICKER_CSS = `
@keyframes rk-ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.rk-ticker__track { animation: rk-ticker 55s linear infinite; will-change: transform; }
.rk-ticker:hover .rk-ticker__track { animation-play-state: paused; }
.rk-ticker__chip:hover span { color: var(--c-ink); }
.rk-ticker__chip:hover img { box-shadow: 0 0 0 1px var(--c-action); }
@media (prefers-reduced-motion: reduce) { .rk-ticker__track { animation: none; transform: none; } }
`;

export function CompanyTicker({ companies = DEFAULT }: CompanyTickerProps) {
  const row = [...companies, ...companies];
  return (
    <section aria-label="Companies analyzed by ReachKit" style={{ padding: "8px 0 2px" }}>
      <style>{TICKER_CSS}</style>
      <p style={{ fontFamily: JM, fontSize: 11.5, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--c-faint)", textAlign: "center", margin: "0 0 18px" }}>
        Companies we&apos;ve analyzed
      </p>
      <div className="rk-ticker" style={{ overflow: "hidden", WebkitMaskImage: "linear-gradient(to right, transparent, #000 8%, #000 92%, transparent)", maskImage: "linear-gradient(to right, transparent, #000 8%, #000 92%, transparent)" }}>
        <div className="rk-ticker__track" style={{ display: "flex", alignItems: "center", gap: 40, width: "max-content", paddingLeft: 40 }}>
          {row.map((c, i) => (
            <span key={`${c.domain}-${i}`} aria-hidden={i >= companies.length ? true : undefined} className="rk-ticker__chip" style={{ display: "inline-flex", alignItems: "center", gap: 11, flexShrink: 0, textDecoration: "none" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={favicon(c.domain)} alt="" width={24} height={24} loading="lazy" style={{ borderRadius: 6, flexShrink: 0, background: "var(--c-surface)", boxShadow: "0 0 0 1px var(--c-line)" }} />
              <span style={{ fontFamily: PJ, fontSize: 15, fontWeight: 600, color: "var(--c-muted)", whiteSpace: "nowrap" }}>{c.name}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
