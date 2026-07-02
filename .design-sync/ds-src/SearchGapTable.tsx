import * as React from "react";

/**
 * SearchGapTable — the report's "Keyword gap" card: a two-column list of
 * high-volume terms the brand doesn't rank for. Each row shows the term,
 * a mono search-volume label, and a trailing chip — a filled "→ in plan"
 * pill (reusing the action/soft tint pair) for terms already queued, or a
 * dashed "+ add" pill for terms that can still be added. Renders fully with
 * no props.
 *
 * `rows` (legacy Query/Volume/Rank/Opportunity shape) is kept for backward
 * compatibility and, when supplied without `keywords`, is mapped onto the
 * new term/volLabel/inPlan/canAdd row shape so existing callers keep working.
 */
export interface SearchGapTableProps {
  /** @deprecated legacy row shape — prefer `keywords`. Mapped onto the new layout when `keywords` is not supplied. */
  rows?: { query: string; volume: string; rank: string; opportunity: string }[];
  keywords?: { term: string; volLabel: string; inPlan?: boolean; canAdd?: boolean }[];
  title?: string;
  subtitle?: string;
}

export function SearchGapTable({
  rows,
  keywords = rows
    ? rows.map((r) => {
        const inPlan = !/not\s*rank/i.test(r.rank);
        return { term: r.query, volLabel: r.volume.replace(/\/mo$/i, ""), inPlan, canAdd: !inPlan };
      })
    : [
        { term: "discoverability tool", volLabel: "2.4k", inPlan: false, canAdd: true },
        { term: "improve SaaS SEO", volLabel: "1.9k", inPlan: true, canAdd: false },
        { term: "website audit for founders", volLabel: "880", inPlan: false, canAdd: true },
        { term: "landing page checklist", volLabel: "1.3k", inPlan: false, canAdd: true },
        { term: "AI meeting notes", volLabel: "3.1k", inPlan: true, canAdd: false },
        { term: "startup SEO audit", volLabel: "640", inPlan: false, canAdd: true },
      ],
  title = "Keyword gap",
  subtitle = "High-volume terms you don't rank for yet",
}: SearchGapTableProps) {
  return (
    <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-md)", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14, fontFamily: "var(--font-sans)", maxWidth: 680 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--c-ink)", margin: 0 }}>{title}</h3>
        <span style={{ fontSize: 12.5, color: "var(--c-muted)" }}>{subtitle}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px 28px" }}>
        {keywords.map((k, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, paddingBottom: 9, borderBottom: "1px solid var(--c-line2)" }}>
            <span style={{ fontSize: 13, color: "var(--c-ink)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.term}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--c-muted)", flex: "0 0 auto" }}>{k.volLabel}/mo</span>
            {k.inPlan ? (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: "var(--c-action)", background: "var(--c-soft)", padding: "3px 8px", borderRadius: "var(--radius-full)", cursor: "pointer", flex: "0 0 auto" }}>→ in plan</span>
            ) : k.canAdd !== false ? (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: "var(--c-muted)", border: "1px dashed var(--c-line)", padding: "2px 8px", borderRadius: "var(--radius-full)", cursor: "pointer", flex: "0 0 auto" }}>+ add</span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
