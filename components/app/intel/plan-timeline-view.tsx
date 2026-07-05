"use client";

/**
 * PlanTimelineView — THE plan: one page where the founder sees everything laid
 * out over time, executes every action in place, and watches wins verify into
 * the score.
 *
 * Merges the tracked action queue (server-loaded `actions` board) with the
 * not-yet-tracked synthesis recommendations (content + distribution, loaded
 * through the same intel layer the plan views use), then schedules the open
 * work across weeks with lib/scan/plan-schedule — §11's anti-spam cadence
 * doubling as the calendar. Below the timeline: what's verifying and what's
 * done (with measured points), so "what was done" lives on the same page as
 * "what to do".
 */

import { useMemo } from "react";
import Link from "next/link";
import { Card, Eyebrow } from "@/components/app/intel/kit";
import { useIntel, IntelShell } from "@/components/app/intel/shared";
import { PlanItem } from "@/components/app/intel/plan-item";
import { PlanEntryCard } from "@/components/app/intel/plan-entry-card";
import { mergePlanEntries, schedulePlan, type ScheduledWeek } from "@/lib/scan/plan-schedule";
import type { ActionBoard } from "@/lib/scan/action-board";
import type { Synthesis } from "./synthesis-view";

const SG = "var(--font-display)", JM = "var(--font-mono)";
const VERIFYING_COLOR = "#C98A12";
const VERIFIED_COLOR = "#1F9D5B";

function fmtPts(n: number): string {
  const v = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return `${n > 0 ? "+" : ""}${v} pts`;
}

/** Monday (local) of the ISO week `offset` weeks from now, as "Mon d". */
function weekLabel(offset: number): string {
  if (offset === 0) return "This week";
  if (offset === 1) return "Next week";
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) + offset * 7);
  return `Week of ${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

export function PlanTimelineView({ board, domain }: { board: ActionBoard; domain: string }) {
  const { data, loading, error, stages } = useIntel<Synthesis>("synthesis");
  return (
    <IntelShell loading={loading} error={error} hasData={!!data} stages={stages}>
      {data && <PlanTimelineBody board={board} synthesis={data} domain={domain || data.domain} />}
    </IntelShell>
  );
}

export function PlanTimelineBody({ board, synthesis, domain }: { board: ActionBoard; synthesis: Synthesis; domain: string }) {
  const weeks: ScheduledWeek[] = useMemo(() => {
    const allTitles = new Set(
      [...board.open, ...board.retry, ...board.verifying, ...board.done].map((a) => a.title),
    );
    const entries = mergePlanEntries({
      openActions: [...board.open, ...board.retry],
      allActionTitles: allTitles,
      content: synthesis.contentPlan,
      distribution: synthesis.distributionPlan,
    });
    return schedulePlan(entries);
  }, [board, synthesis]);

  const openCount = weeks.reduce((s, w) => s + w.entries.length, 0);
  const measured = board.done.filter((a) => a.actualDelta !== null);
  const verifiedPts = measured.length > 0 ? measured.reduce((s, a) => s + (a.actualDelta ?? 0), 0) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Summary strip — the whole plan at a glance */}
      <Card style={{ padding: "16px 22px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 32 }}>
          <Stat label="To do" value={openCount} />
          <Stat label="Verifying" value={board.verifying.length} color={board.verifying.length > 0 ? VERIFYING_COLOR : undefined} />
          <Stat label="Verified" value={board.done.length} color={board.done.length > 0 ? VERIFIED_COLOR : undefined} />
          {verifiedPts !== null && (
            <span style={{ marginLeft: "auto", fontFamily: JM, fontSize: 13, fontWeight: 700, color: verifiedPts >= 0 ? VERIFIED_COLOR : "#E5484D" }}>
              {fmtPts(verifiedPts)} verified on your score
            </span>
          )}
        </div>
      </Card>

      {/* The timeline — paced so every move lands (and never reads as spam) */}
      {weeks.length === 0 ? (
        <EmptyPlan />
      ) : (
        weeks.map((w) => (
          <section key={w.index}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "0 2px 10px" }}>
              <h3 style={{ fontFamily: SG, fontWeight: 700, fontSize: 15, color: "var(--c-ink)", margin: 0 }}>{weekLabel(w.index)}</h3>
              <span style={{ fontFamily: JM, fontSize: 11, color: "var(--c-faint)" }}>
                {w.entries.length} {w.entries.length === 1 ? "action" : "actions"} · ~{w.entries.reduce((s, e) => s + e.effortMin, 0)} min
              </span>
              {w.index === 0 && <span style={{ fontFamily: JM, fontSize: 10.5, fontWeight: 700, color: "var(--c-action)" }}>← start here</span>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {w.entries.map((e) => <PlanEntryCard key={e.key} entry={e} domain={domain} />)}
            </div>
          </section>
        ))
      )}

      {weeks.length > 0 && (
        <p style={{ fontFamily: JM, fontSize: 11, color: "var(--c-faint)", margin: "-6px 2px 0", lineHeight: 1.6 }}>
          Paced on purpose: one content piece a week, outreach spaced across venues — steady beats spam, for
          you and for the algorithms. Every draft is scrubbed of AI tells and unique to you; you always post it yourself.
        </p>
      )}

      {/* What's in flight and what's done — the same page answers both */}
      {board.verifying.length > 0 && (
        <Card title="Verifying" meta={`${board.verifying.length} in flight`}>
          <p style={{ fontSize: 12.5, color: "var(--c-muted)", margin: "0 0 12px" }}>
            Re-checking your live pages — a move only counts when it&rsquo;s confirmed.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {board.verifying.map((a) => (
              <PlanItem key={a.id} item={{ id: a.id, title: a.title, type: a.category, why: a.why, status: "Verifying", statusColor: VERIFYING_COLOR, predictedPts: a.predictedDelta !== null ? fmtPts(a.predictedDelta) : null }} />
            ))}
          </div>
        </Card>
      )}

      {board.done.length > 0 && (
        <Card title="Done" meta={`${board.done.length} verified`} info="Confirmed live, newest first — with the score movement actually measured at verification.">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {board.done.map((a) => (
              <PlanItem key={a.id} item={{ id: a.id, title: a.title, type: a.category, why: a.why, status: "Verified", statusColor: VERIFIED_COLOR, actualPts: a.actualDelta !== null ? fmtPts(a.actualDelta) : null }} />
            ))}
          </div>
        </Card>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <span style={{ fontSize: 13, color: "var(--c-faint)" }}>
          Backed by your <Link href="/app/plan/content" style={{ color: "var(--c-action)", fontWeight: 600, textDecoration: "none" }}>content</Link> and{" "}
          <Link href="/app/plan/distribution" style={{ color: "var(--c-action)", fontWeight: 600, textDecoration: "none" }}>distribution</Link> analyses.
        </span>
        <Link href="/app/progress" style={{ fontSize: 13, fontWeight: 600, color: "var(--c-action)", textDecoration: "none" }}>
          Verified wins land on your Progress timeline &rarr;
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
      <span style={{ fontFamily: JM, fontSize: 22, fontWeight: 700, lineHeight: 1, color: color ?? "var(--c-ink)" }}>{value}</span>
      <Eyebrow>{label}</Eyebrow>
    </span>
  );
}

function EmptyPlan() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "56px 20px", textAlign: "center", border: "1px dashed var(--c-line)", borderRadius: "var(--radius-xl)" }}>
      <div style={{ fontFamily: SG, fontWeight: 700, fontSize: 15, color: "var(--c-ink)" }}>Everything shipped — nice.</div>
      <p style={{ fontSize: 13, color: "var(--c-muted)", margin: 0, maxWidth: 460 }}>
        Your next scan refreshes the plan with new opportunities as your market moves.
      </p>
    </div>
  );
}
