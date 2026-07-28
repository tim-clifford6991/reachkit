/* @mirrors components/app/intel/referrer-row.tsx */
import * as React from "react";

/**
 * ReferrerRow — Competitors detail: one dense line per BACKLINK (R-6.7 — a
 * backlink & placement map, not a "referrer/traffic" map). The host links to its
 * SOURCE page (where the `<a href>` lives) so a click never lands on a rival's
 * dead target. The linking host's own traffic (etv) is NOT rendered as a
 * magnitude (the "~84K" mislabel, dropped 2026-07-28 — US·organic ETV shown as
 * referral traffic we cannot measure). The honest strength signals are the
 * backlink's own attributes: authority (DR), dofollow, anchor, placement type.
 * Low-relevance backlinks render muted but are never dropped.
 */
export interface ReferrerRowProps {
  r: {
    host: string; category: string; url: string; target?: string; anchor?: string;
    authority?: number | null; dofollow?: boolean | null; etv?: number | null; relevance?: "core" | "low";
  };
}

const DR_HELP = "Domain Rating (0–1000) — the linking site's own authority. Higher = a more valuable, harder-to-earn backlink.";

export function ReferrerRow({ r }: ReferrerRowProps) {
  const [open, setOpen] = React.useState(false);
  const low = r.relevance === "low";
  return (
    <div style={{ fontFamily: "var(--font-sans)", opacity: low ? 0.6 : 1 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 16px", alignItems: "center", gap: 8, padding: "5px 6px", borderRadius: 6, cursor: "pointer" }}
           onClick={() => setOpen((o) => !o)}>
        {/* flexWrap + minWidth:0 let the badges wrap under the host on a narrow
            phone instead of spilling over (the mobile-overlap fix). */}
        <span style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, minWidth: 0, overflow: "hidden" }}>
          <a href={r.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "var(--c-action)", textDecoration: "none", fontSize: 12.5, minWidth: 0, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {r.host.replace(/^www\./, "")}
          </a>
          <span style={{ fontSize: 10.5, fontWeight: 600, padding: "1px 6px", borderRadius: "var(--radius-full)", background: "var(--c-soft)", color: "var(--c-muted)" }}>{r.category}</span>
          {low && <span style={{ fontSize: 10.5, fontWeight: 600, padding: "1px 6px", borderRadius: "var(--radius-full)", background: "var(--c-soft)", color: "var(--c-muted)" }}>low relevance</span>}
        </span>
        {/* Authority (DR) — the honest link-strength signal, named + scaled. */}
        <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", textAlign: "right", color: "var(--c-muted)" }}>
          {typeof r.authority === "number" && r.authority > 0
            ? <span title={DR_HELP} style={{ cursor: "help", textDecoration: "underline dotted", textUnderlineOffset: 2 }}>DR&nbsp;{r.authority}</span>
            : <span style={{ fontSize: 10, color: "var(--c-faint)" }}>—</span>}
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
