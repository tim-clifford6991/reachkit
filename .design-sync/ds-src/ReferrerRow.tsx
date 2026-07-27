/* @mirrors components/app/intel/referrer-row.tsx */
import * as React from "react";

/**
 * ReferrerRow — WS1 Competitors detail: one dense line per referrer. The host
 * links to its SOURCE page (where the backlink lives) so a click never lands
 * on a rival's dead target. "Platform reach" is the referring host's own
 * organic traffic (hover for the honest caveat: not measured click-through
 * to the rival). Low-relevance referrers render muted but are never
 * dropped. Click a row to expand source/target/anchor/authority detail.
 */
export interface ReferrerRowProps {
  r: {
    host: string; category: string; url: string; target?: string; anchor?: string;
    authority?: number | null; dofollow?: boolean | null; etv?: number | null; relevance?: "core" | "low";
  };
  maxEtv: number;
}

const fmtCompact = (n: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n ?? 0);

export function ReferrerRow({ r, maxEtv }: ReferrerRowProps) {
  const [open, setOpen] = React.useState(false);
  const low = r.relevance === "low";
  return (
    <div style={{ fontFamily: "var(--font-sans)", opacity: low ? 0.6 : 1 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 84px 64px 16px", alignItems: "center", gap: 8, padding: "5px 6px", borderRadius: 6, cursor: "pointer" }}
           onClick={() => setOpen((o) => !o)}>
        {/* flexWrap + minWidth:0 let the badges wrap under the host on a narrow
            phone instead of spilling over the bar column (the mobile-overlap fix). */}
        <span style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, minWidth: 0, overflow: "hidden" }}>
          <a href={r.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "var(--c-action)", textDecoration: "none", fontSize: 12.5, minWidth: 0, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {r.host.replace(/^www\./, "")}
          </a>
          <span style={{ fontSize: 10.5, fontWeight: 600, padding: "1px 6px", borderRadius: "var(--radius-full)", background: "var(--c-soft)", color: "var(--c-muted)" }}>{r.category}</span>
          {low && <span style={{ fontSize: 10.5, fontWeight: 600, padding: "1px 6px", borderRadius: "var(--radius-full)", background: "var(--c-soft)", color: "var(--c-muted)" }}>low relevance</span>}
        </span>
        <span>
          {typeof r.etv === "number"
            ? <span style={{ display: "block", height: 7, borderRadius: 4, background: "var(--c-soft)", overflow: "hidden" }}>
                <span style={{ display: "block", height: "100%", width: `${Math.min(100, (r.etv / Math.max(1, maxEtv)) * 100)}%`, background: "var(--c-action)" }} />
              </span>
            : <span style={{ fontSize: 10, color: "var(--c-faint)" }}>—</span>}
        </span>
        <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", textAlign: "right", color: "var(--c-muted)" }}>
          {typeof r.etv === "number" && (
            <span title="That site's own monthly organic traffic — how big the venue is, not measured click-through to this rival." style={{ cursor: "help", textDecoration: "underline dotted", textUnderlineOffset: 2 }}>
              ~{fmtCompact(r.etv)}
            </span>
          )}
        </span>
        <span title={r.dofollow ? "dofollow" : "nofollow"} style={{ fontSize: 11, color: r.dofollow ? "var(--c-band-findable)" : "var(--c-faint)" }}>●</span>
      </div>
      {open && (
        <div style={{ padding: "2px 6px 8px 6px", fontSize: 11.5, color: "var(--c-muted)", display: "flex", flexDirection: "column", gap: 2 }}>
          <span>Source: <a href={r.url} target="_blank" rel="noreferrer" style={{ color: "var(--c-action)" }}>{r.url}</a></span>
          {r.target && <span>Links to: {r.target}</span>}
          {r.anchor && <span>Anchor: &ldquo;{r.anchor}&rdquo;</span>}
          <span>Authority {r.authority ?? "—"} · {r.dofollow ? "dofollow" : "nofollow"}</span>
        </div>
      )}
    </div>
  );
}
