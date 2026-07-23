"use client";

/**
 * WhatToRankFor — the paid dashboard's "what to rank for" growth-engine board.
 *
 * Renders the FULL, unredacted target set (every category/niche search the
 * subject doesn't win yet, by demand) from the persisted `report_payload`
 * (builder: `lib/app/rank-targets-props.ts`). Every row is a SPECIFIC, actionable
 * move — "Create a page targeting «keyword»" with its real monthly volume and the
 * subject's live position — never general advice (owner rule 2026-07-22).
 *
 * L2 (2026-07-23) — the targets→plan round-trip: each row now carries a real
 * add-to-plan chip (the shared `add-to-plan` module — same one the competitor
 * LESSONS and customer COMMUNITIES use), so a target the founder picks POSTs to
 * /api/action and appears on /app/plan. Before this the "Build these into your
 * plan →" link was a dead end: the board's keyword targets never reached the plan
 * store (the paid deepen wrote signal-fix actions from a different source), so the
 * flagship "score → targets → plan" spine broke at the targets→plan hop (paid
 * week-1 incoherence #1).
 */

import Link from "next/link";
import type { RankTargetsProps } from "@/lib/app/rank-targets-props";
import { Card, Bar, Badge } from "./kit";
import { useActionPlan, AddToPlanChip } from "./add-to-plan";

const SG = "var(--font-display, 'Space Grotesk')";
const JM = "var(--font-mono, 'JetBrains Mono')";
const MAX_ROWS = 12;

function fmt(n: number): string {
  return n.toLocaleString();
}

/** The plan-store title for a keyword target — matches the row's visible move so
 *  a chip-added action reads identically on /app/plan (round-trips by title). */
const targetActionTitle = (keyword: string) => `Create a page targeting “${keyword}”`;

export function WhatToRankFor({ targets, categoryLabel, categoryDemand }: RankTargetsProps) {
  const plan = useActionPlan();
  const rows = targets.slice(0, MAX_ROWS);
  const maxVol = Math.max(...rows.map((r) => r.volume), 1);
  const more = Math.max(0, targets.length - rows.length);

  return (
    <Card
      title="What to rank for"
      info="The category & niche searches your buyers make that you don't win yet, ranked by demand. Each row is a page to create — add it to your plan."
      meta={categoryLabel && categoryDemand ? `${categoryLabel} · ${fmt(categoryDemand)}/mo` : undefined}
    >
      {rows.length > 0 ? (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            {rows.map((r) => {
              const ranks = typeof r.yourPosition === "number";
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
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}><Bar value={r.volume} max={maxVol} color="var(--c-action)" /></div>
                    <AddToPlanChip
                      title={targetActionTitle(r.keyword)}
                      category="content"
                      why={`${fmt(r.volume)}/mo category search you don't win yet${ranks ? ` (you're #${r.yourPosition})` : ""} — create a page for it.`}
                      plan={plan}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--c-line)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            {more > 0 && <span style={{ fontFamily: JM, fontSize: 12, color: "var(--c-faint)" }}>+{more} more targets</span>}
            <Link href="/app/plan" style={{ fontFamily: SG, fontSize: 13, fontWeight: 700, color: "var(--c-action)", textDecoration: "none", marginLeft: "auto" }}>
              See your plan &rarr;
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
