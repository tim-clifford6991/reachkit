"use client";
/**
 * WS1 — one-line referrer row for the Competitors detail. The host links to its
 * SOURCE page (where the backlink lives) so a click never lands on a rival's dead
 * target (the fellow.ai→producthunt 404 case). "Platform reach" is the referring
 * host's own organic traffic (a native title clarifies: not measured click-through).
 * Low-relevance referrers render muted but are never dropped.
 */
import { useState } from "react";
import { Badge, Bar, EvidenceLink } from "@/components/app/intel/kit";
import { fmtCompact } from "@/components/app/intel/shared";

export type ReferrerLike = {
  host: string; category: string; url: string; target?: string; anchor?: string;
  authority?: number | null; dofollow?: boolean | null; etv?: number | null; relevance?: "core" | "low";
};

export function ReferrerRow({ r, maxEtv }: { r: ReferrerLike; maxEtv: number }) {
  const [open, setOpen] = useState(false);
  const low = r.relevance === "low";
  return (
    <div style={{ opacity: low ? 0.6 : 1 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 84px 64px 16px", alignItems: "center", gap: 8, padding: "5px 6px", borderRadius: 6, cursor: "pointer" }}
           onClick={() => setOpen((o) => !o)}>
        {/* host → SOURCE page (never the rival's target) */}
        <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <EvidenceLink href={r.url}>{r.host.replace(/^www\./, "")}</EvidenceLink>
          <Badge tone="neutral">{r.category}</Badge>
          {low && <Badge tone="neutral">low relevance</Badge>}
        </span>
        {/* platform reach bar (honest) */}
        <span>{typeof r.etv === "number" ? <Bar value={r.etv} max={Math.max(1, maxEtv)} /> : <span style={{ fontSize: 10, color: "var(--c-faint)" }}>—</span>}</span>
        <span style={{ fontSize: 11, fontFamily: "JetBrains Mono", textAlign: "right", color: "var(--c-muted)" }}>
          {typeof r.etv === "number" && (
            <span
              title="That site's own monthly organic traffic — how big the venue is, not measured click-through to this rival."
              style={{ cursor: "help", borderBottom: "1px dotted var(--c-faint)" }}
            >~{fmtCompact(r.etv)}</span>
          )}
        </span>
        <span title={r.dofollow ? "dofollow" : "nofollow"} style={{ fontSize: 11, color: r.dofollow ? "var(--c-band-findable)" : "var(--c-faint)" }}>●</span>
      </div>
      {open && (
        <div style={{ padding: "2px 6px 8px 6px", fontSize: 11.5, color: "var(--c-muted)", display: "flex", flexDirection: "column", gap: 2 }}>
          <span>Source: <EvidenceLink href={r.url}>{r.url}</EvidenceLink></span>
          {r.target && <span>Links to: {r.target}</span>}
          {r.anchor && <span>Anchor: &ldquo;{r.anchor}&rdquo;</span>}
          <span>Authority {r.authority ?? "—"} · {r.dofollow ? "dofollow" : "nofollow"}</span>
        </div>
      )}
    </div>
  );
}
