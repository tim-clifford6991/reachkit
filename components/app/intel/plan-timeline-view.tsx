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

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, Eyebrow } from "@/components/app/intel/kit";
import { useIntel, IntelShell } from "@/components/app/intel/shared";
import { PlanItem } from "@/components/app/intel/plan-item";
import { PlanEntryCard } from "@/components/app/intel/plan-entry-card";
import {
  mergePlanEntries, schedulePlan, scheduleToDays, localDateKey,
  type PlanEntry, type ScheduledDay,
} from "@/lib/scan/plan-schedule";
import type { ActionBoard } from "@/lib/scan/action-board";
import type { Synthesis } from "./synthesis-view";

const SG = "var(--font-display)", PJ = "var(--font-sans)", JM = "var(--font-mono)";
const VERIFYING_COLOR = "#C98A12";
const VERIFIED_COLOR = "#1F9D5B";

function fmtPts(n: number): string {
  const v = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return `${n > 0 ? "+" : ""}${v} pts`;
}

export function PlanTimelineView({ board, domain }: { board: ActionBoard; domain: string }) {
  const { data, loading, error, stages } = useIntel<Synthesis>("synthesis");
  return (
    <IntelShell loading={loading} error={error} hasData={!!data} stages={stages}>
      {data && <PlanTimelineBody board={board} synthesis={data} domain={domain || data.domain} />}
    </IntelShell>
  );
}

export function PlanTimelineBody({ board, synthesis, domain, today: todayProp }: { board: ActionBoard; synthesis: Synthesis; domain: string; today?: Date }) {
  // Stable "today" for the lifetime of the view (fixture pages inject one).
  const [today] = useState(() => todayProp ?? new Date());

  const days: ScheduledDay[] = useMemo(() => {
    const allTitles = new Set(
      [...board.open, ...board.retry, ...board.verifying, ...board.done].map((a) => a.title),
    );
    const entries = mergePlanEntries({
      openActions: [...board.open, ...board.retry],
      allActionTitles: allTitles,
      content: synthesis.contentPlan,
      distribution: synthesis.distributionPlan,
    });
    return scheduleToDays(schedulePlan(entries), today);
  }, [board, synthesis, today]);

  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d.entries])), [days]);
  const [selected, setSelected] = useState<string | null>(null);
  // Default focus: today if it has work, else the first scheduled day.
  const todayKey = localDateKey(today);
  const activeDate = selected && byDate.has(selected) ? selected : byDate.has(todayKey) ? todayKey : days[0]?.date ?? null;
  const activeEntries: PlanEntry[] = activeDate ? byDate.get(activeDate) ?? [] : [];

  const openCount = days.reduce((s, d) => s + d.entries.length, 0);
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

      {/* The calendar — the plan laid out day by day, starting today */}
      {days.length === 0 ? (
        <EmptyPlan />
      ) : (
        <>
          <PlanCalendar days={days} today={today} activeDate={activeDate} onSelect={setSelected} />

          {/* The selected day, workable in place */}
          {activeDate && (
            <section>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "0 2px 10px" }}>
                <h3 style={{ fontFamily: SG, fontWeight: 700, fontSize: 15, color: "var(--c-ink)", margin: 0 }}>
                  {activeDate === todayKey ? "Today" : dayHeading(activeDate)}
                </h3>
                <span style={{ fontFamily: JM, fontSize: 11, color: "var(--c-faint)" }}>
                  {activeEntries.length} {activeEntries.length === 1 ? "action" : "actions"} · ~{activeEntries.reduce((s, e) => s + e.effortMin, 0)} min
                </span>
                {activeDate === todayKey && <span style={{ fontFamily: JM, fontSize: 10.5, fontWeight: 700, color: "var(--c-action)" }}>← start here</span>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {activeEntries.map((e) => <PlanEntryCard key={e.key} entry={e} domain={domain} />)}
              </div>
            </section>
          )}
        </>
      )}

      {days.length > 0 && (
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

// ---------------------------------------------------------------------------
// Calendar — Outrank-style month grids: every scheduled day carries its
// entries as chips; clicking a day focuses the workable panel below.
// ---------------------------------------------------------------------------

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function dayHeading(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

const CHIP_STYLE: Record<PlanEntry["kind"], { bg: string; fg: string }> = {
  content: { bg: "var(--c-soft)", fg: "var(--c-action)" },
  distribution: { bg: "var(--c-tint-green)", fg: "var(--c-band-findable)" },
};

function PlanCalendar({ days, today, activeDate, onSelect }: {
  days: ScheduledDay[];
  today: Date;
  activeDate: string | null;
  onSelect: (date: string) => void;
}) {
  const byDate = new Map(days.map((d) => [d.date, d.entries]));
  const todayKey = localDateKey(today);
  const last = days[days.length - 1]!.date;
  const [ly, lm] = last.split("-").map(Number);

  // Months from today's month through the last scheduled month.
  const months: { year: number; month: number }[] = [];
  for (let y = today.getFullYear(), m = today.getMonth(); y < ly! || (y === ly! && m <= lm! - 1); m === 11 ? (m = 0, y++) : m++) {
    months.push({ year: y, month: m });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {months.map(({ year, month }) => {
        const first = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const lead = (first.getDay() + 6) % 7; // Mon-first offset
        const cells: (number | null)[] = [
          ...Array.from({ length: lead }, () => null),
          ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
        ];
        return (
          <section key={`${year}-${month}`}>
            <h3 style={{ fontFamily: SG, fontWeight: 700, fontSize: 15, color: "var(--c-ink)", margin: "0 2px 8px" }}>
              {first.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6 }}>
              {WEEKDAYS.map((w) => (
                <span key={w} style={{ fontFamily: JM, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--c-faint)", padding: "0 4px" }}>{w}</span>
              ))}
              {cells.map((dayNum, i) => {
                if (dayNum === null) return <span key={`b${i}`} />;
                const key = localDateKey(new Date(year, month, dayNum));
                const entries = byDate.get(key) ?? [];
                const isToday = key === todayKey;
                const isActive = key === activeDate;
                const isPast = key < todayKey;
                const clickable = entries.length > 0;
                return (
                  <div
                    key={key}
                    role={clickable ? "button" : undefined}
                    tabIndex={clickable ? 0 : undefined}
                    onClick={clickable ? () => onSelect(key) : undefined}
                    onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(key); } } : undefined}
                    aria-label={clickable ? `${dayHeading(key)} — ${entries.length} ${entries.length === 1 ? "action" : "actions"}` : undefined}
                    style={{
                      minHeight: 76,
                      border: `1px solid ${isActive ? "var(--c-action)" : "var(--c-line)"}`,
                      borderRadius: "var(--radius-md)",
                      background: isActive ? "var(--c-soft)" : "var(--c-surface)",
                      padding: "6px 6px 7px",
                      opacity: isPast && !clickable ? 0.45 : 1,
                      cursor: clickable ? "pointer" : "default",
                      display: "flex", flexDirection: "column", gap: 4, minWidth: 0,
                    }}
                  >
                    <span style={{
                      fontFamily: JM, fontSize: 11, fontWeight: 700, lineHeight: 1,
                      color: isToday ? "#fff" : "var(--c-faint)",
                      background: isToday ? "var(--c-action)" : "transparent",
                      borderRadius: "var(--radius-full)", padding: isToday ? "3px 7px" : "3px 0",
                      alignSelf: "flex-start",
                    }}>
                      {dayNum}
                    </span>
                    {entries.slice(0, 2).map((e) => (
                      <span key={e.key} title={e.title} style={{
                        fontFamily: PJ, fontSize: 10, fontWeight: 600, lineHeight: 1.3,
                        color: CHIP_STYLE[e.kind].fg, background: CHIP_STYLE[e.kind].bg,
                        borderRadius: "var(--radius-sm)", padding: "3px 6px",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {e.title}
                      </span>
                    ))}
                    {entries.length > 2 && (
                      <span style={{ fontFamily: JM, fontSize: 9.5, color: "var(--c-faint)" }}>+{entries.length - 2} more</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
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
