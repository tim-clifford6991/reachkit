/**
 * WhatToRankFor — the paid dashboard's "what to rank for" growth-engine board.
 *
 * Renders the FULL, unredacted target set (every category/niche search the
 * subject doesn't win yet, by demand) from the persisted `report_payload`
 * (builder: `lib/app/rank-targets-props.ts`). Every row is a SPECIFIC, actionable
 * move — "Create a page targeting «keyword»" with its real monthly volume and the
 * subject's live position — never general advice (owner rule 2026-07-22: the plan
 * always pushes a concrete artifact, never "improve your content").
 *
 * Phase 1 renders the free-computed spine (zero cost). The rival-gap "why" (who
 * outranks you) enriches each row in Phase 3.
 */

import Link from "next/link";
import type { RankTargetsProps } from "@/lib/app/rank-targets-props";
import { Card, Bar, Badge } from "./kit";

const SG = "var(--font-display, 'Space Grotesk')";
const JM = "var(--font-mono, 'JetBrains Mono')";
const MAX_ROWS = 12;

function fmt(n: number): string {
  return n.toLocaleString();
}

export function WhatToRankFor({ targets, categoryLabel, categoryDemand }: RankTargetsProps) {
  const rows = targets.slice(0, MAX_ROWS);
  const maxVol = Math.max(...rows.map((r) => r.volume), 1);
  const more = Math.max(0, targets.length - rows.length);

  return (
    <Card
      title="What to rank for"
      info="The category & niche searches your buyers make that you don't win yet, ranked by demand. Each row is a page to create — that's the move."
      meta={categoryLabel && categoryDemand ? `${categoryLabel} · ${fmt(categoryDemand)}/mo` : undefined}
    >
      {rows.length > 0 ? (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            {rows.map((r) => {
              const ranks = typeof r.yourPosition === "number";
              const pct = Math.max(6, Math.round((r.volume / maxVol) * 100));
              return (
                <div key={r.keyword}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 5 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--c-ink)", minWidth: 0, overflowWrap: "anywhere" }}>
                      Create a page targeting <span style={{ color: "var(--c-action)" }}>&ldquo;{r.keyword}&rdquo;</span>
                    </span>
                    <span style={{ display: "inline-flex", gap: 8, alignItems: "baseline", flex: "0 0 auto" }}>
                      <span style={{ fontFamily: JM, fontWeight: 700, fontSize: 13, color: "var(--c-ink)" }}>{fmt(r.volume)}</span>
                      <span style={{ fontSize: 11, color: "var(--c-faint)" }}>/ mo</span>
                      <Badge tone={ranks ? "amber" : "red"}>{ranks ? `#${r.yourPosition}` : "not ranking"}</Badge>
                    </span>
                  </div>
                  <Bar value={r.volume} max={maxVol} color="var(--c-action)" />
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--c-line)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            {more > 0 && <span style={{ fontFamily: JM, fontSize: 12, color: "var(--c-faint)" }}>+{more} more targets</span>}
            <Link href="/app/plan" style={{ fontFamily: SG, fontSize: 13, fontWeight: 700, color: "var(--c-action)", textDecoration: "none", marginLeft: "auto" }}>
              Build these into your plan →
            </Link>
          </div>
        </>
      ) : (
        <p style={{ fontSize: 13, color: "var(--c-faint)", margin: 0 }}>
          No category searches measured yet — once your footprint is scanned, the pages to create appear here.
        </p>
      )}
    </Card>
  );
}
