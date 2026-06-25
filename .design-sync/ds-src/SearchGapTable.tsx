import * as React from "react";

/**
 * SearchGapTable — the report's "Search Gap" table: Query / Volume / Your rank /
 * Opportunity rows in a bordered card. Volume + rank are mono; a non-ranking
 * rank reads red; opportunity is heat-chipped. Renders fully with no props.
 */
export interface SearchGapTableProps {
  rows?: { query: string; volume: string; rank: string; opportunity: string }[];
}

export function SearchGapTable({
  rows = [
    { query: "discoverability tool", volume: "2,400/mo", rank: "Not ranking", opportunity: "High" },
    { query: "improve SaaS SEO", volume: "1,900/mo", rank: "Page 4", opportunity: "High" },
    { query: "website audit for founders", volume: "880/mo", rank: "Page 2", opportunity: "Medium" },
    { query: "landing page checklist", volume: "1,300/mo", rank: "Not ranking", opportunity: "Medium" },
  ],
}: SearchGapTableProps) {
  const oppColors = (opp: string) =>
    /high/i.test(opp) ? { fg: "#E5484D", bg: "var(--c-tint-orange)" }
    : /med/i.test(opp) ? { fg: "#C98A12", bg: "var(--c-tint-amber)" }
    : { fg: "var(--c-faint)", bg: "var(--c-fill)" };
  const cols = "2.2fr 1fr 1fr 0.9fr";
  return (
    <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-xl)", overflow: "hidden", fontFamily: "var(--font-sans)", color: "var(--c-ink)", maxWidth: 680 }}>
      <div style={{ display: "grid", gridTemplateColumns: cols, padding: "13px 22px", borderBottom: "1px solid var(--c-line)", fontSize: 11.5, fontWeight: 700, letterSpacing: "0.04em", color: "var(--c-faint)", textTransform: "uppercase", background: "var(--c-fill)" }}>
        <span>Query</span><span>Volume / mo</span><span>Your rank</span><span>Opportunity</span>
      </div>
      {rows.map((r, i) => {
        const oc = oppColors(r.opportunity);
        const ranked = !/not\s*rank/i.test(r.rank);
        return (
          <div key={i} style={{ display: "grid", gridTemplateColumns: cols, padding: "14px 22px", borderBottom: "1px solid var(--c-fill)", alignItems: "center" }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{r.query}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--c-muted)" }}>{r.volume}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: ranked ? "var(--c-muted)" : "#E5484D" }}>{r.rank}</span>
            <span><span style={{ fontSize: 11.5, fontWeight: 700, color: oc.fg, background: oc.bg, padding: "3px 10px", borderRadius: "var(--radius-md)" }}>{r.opportunity}</span></span>
          </div>
        );
      })}
    </div>
  );
}
