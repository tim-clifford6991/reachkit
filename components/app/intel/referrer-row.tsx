"use client";
/**
 * One-line BACKLINK row for the Competitors detail (R-6.7: this surface is a
 * backlink & placement map, never a "referrer/traffic" map). The host links to
 * its SOURCE page (where the `<a href>` to this domain lives) so a click never
 * lands on a rival's dead target (the fellow.ai→producthunt 404 case).
 *
 * The linking host's own organic traffic (etv) is NOT rendered as a magnitude
 * (the "~84K" mislabel, dropped 2026-07-28) — it was US·organic-only ETV shown as
 * if it were referral traffic through this one link, which we cannot measure. The
 * honest strength signals are the backlink's own attributes: authority (DR),
 * dofollow, anchor, and the placement type. Low-relevance backlinks render muted
 * but are never dropped.
 */
import { useState } from "react";
import { Badge, EvidenceLink } from "@/components/app/intel/kit";

export type ReferrerLike = {
  host: string; category: string; url: string; target?: string; anchor?: string;
  authority?: number | null; dofollow?: boolean | null; etv?: number | null; relevance?: "core" | "low";
};

const DR_HELP = "Domain Rating (0–1000) — the linking site's own authority. Higher = a more valuable, harder-to-earn backlink.";

export function ReferrerRow({ r }: { r: ReferrerLike }) {
  const [open, setOpen] = useState(false);
  const low = r.relevance === "low";
  return (
    <div style={{ opacity: low ? 0.6 : 1 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 16px", alignItems: "center", gap: 8, padding: "5px 6px", borderRadius: 6, cursor: "pointer" }}
           onClick={() => setOpen((o) => !o)}>
        {/* host → SOURCE page (never the rival's target). minWidth:0 + overflow
            let the grid track shrink; the host truncates and the badges wrap
            under it on a narrow phone instead of spilling over (the mobile-overlap
            fix — inline grid, so a media query can't touch it; the collapse must
            be intrinsic). */}
        <span style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, minWidth: 0, overflow: "hidden" }}>
          <EvidenceLink href={r.url} style={{ minWidth: 0, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.host.replace(/^www\./, "")}</EvidenceLink>
          <Badge tone="neutral">{r.category}</Badge>
          {low && <Badge tone="neutral">low relevance</Badge>}
        </span>
        {/* Authority (DR) — the honest link-strength signal, named + scaled (R-1.9). */}
        <span style={{ fontSize: 11, fontFamily: "JetBrains Mono", textAlign: "right", color: "var(--c-muted)" }}>
          {typeof r.authority === "number" && r.authority > 0 ? (
            <span title={DR_HELP} style={{ cursor: "help", borderBottom: "1px dotted var(--c-faint)" }}>DR&nbsp;{r.authority}</span>
          ) : (
            <span style={{ fontSize: 10, color: "var(--c-faint)" }}>—</span>
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
