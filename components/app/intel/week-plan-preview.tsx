"use client";

/**
 * WeekPlanPreview — the dashboard's "This week's plan": the SAME rolling plan
 * the /app/plan calendar shows (one shared builder, one kind-color language),
 * compressed to the current week. Mon–Sun columns with kind-colored chips,
 * today ringed, plus today's focus line — and one obvious way in: the whole
 * point of the dashboard card is to take the founder to their plan.
 *
 * Synthesis loads through the same cached intel layer as the plan page
 * (instant once the plan has been built once); until it lands the preview
 * renders tracked actions only, so the card is never blank.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/app/intel/kit";
import { useIntel } from "@/components/app/intel/shared";
import { KIND_STYLE } from "@/components/app/intel/plan-kind-style";
import { buildPlanDays, localDateKey, mondayOf, type ScheduledDay } from "@/lib/scan/plan-schedule";
import type { ActionBoard } from "@/lib/scan/action-board";
import type { Synthesis } from "./synthesis-view";

const SG = "var(--font-display)", PJ = "var(--font-sans)", JM = "var(--font-mono)";
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function WeekPlanPreview({ board, today: todayProp }: { board: ActionBoard; today?: Date }) {
  const { data: synthesis } = useIntel<Synthesis>("synthesis");
  // Fixture pages inject a fixed `today`; live callers sit under a Suspense
  // boundary (Next 16 cacheComponents requires one around client-side Date).
  const [today] = useState(() => todayProp ?? new Date());

  const days: ScheduledDay[] = useMemo(
    () => buildPlanDays({
      board,
      category: synthesis?.category ?? "",
      content: synthesis?.contentPlan ?? [],
      distribution: synthesis?.distributionPlan ?? [],
      today,
    }),
    [board, synthesis, today],
  );

  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d.entries])), [days]);
  const todayKey = localDateKey(today);
  const monday = mondayOf(today);
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  const todayEntries = byDate.get(todayKey) ?? [];
  const todayMin = todayEntries.reduce((s, e) => s + e.effortMin, 0);

  return (
    <Card
      title="This week's plan"
      meta={
        <Link href="/app/plan" style={{ color: "var(--c-action)", fontWeight: 600, textDecoration: "none" }}>
          full 30-day plan →
        </Link>
      }
      info="The same rolling plan as your calendar, compressed to this week. Every day carries your 10-minute post; the bigger moves are paced around it."
    >
      {/* Mon–Sun strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6 }}>
        {week.map((d, i) => {
          const key = localDateKey(d);
          const entries = byDate.get(key) ?? [];
          const isToday = key === todayKey;
          const isPast = key < todayKey;
          return (
            <Link
              key={key}
              href="/app/plan"
              aria-label={`${WEEKDAYS[i]} — ${entries.length} ${entries.length === 1 ? "action" : "actions"}`}
              style={{
                textDecoration: "none",
                minHeight: 64,
                border: `1px solid ${isToday ? "var(--c-action)" : "var(--c-line)"}`,
                borderRadius: "var(--radius-md)",
                background: isToday ? "var(--c-soft)" : "var(--c-surface)",
                padding: "5px 5px 6px",
                opacity: isPast ? 0.5 : 1,
                display: "flex", flexDirection: "column", gap: 3, minWidth: 0,
              }}
            >
              <span style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontFamily: JM, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: isToday ? "var(--c-action)" : "var(--c-faint)" }}>{WEEKDAYS[i]}</span>
                <span style={{ fontFamily: JM, fontSize: 10, color: "var(--c-faint)" }}>{d.getDate()}</span>
              </span>
              {entries.slice(0, 2).map((e) => (
                <span key={e.key} title={e.title} style={{
                  fontFamily: PJ, fontSize: 9.5, fontWeight: 600, lineHeight: 1.25,
                  color: KIND_STYLE[e.kind].fg, background: KIND_STYLE[e.kind].bg,
                  borderRadius: "var(--radius-sm)", padding: "2px 5px",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {e.title}
                </span>
              ))}
              {entries.length > 2 && (
                <span style={{ fontFamily: JM, fontSize: 9, color: "var(--c-faint)" }}>+{entries.length - 2}</span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Today's focus + the way in */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
        {todayEntries.length > 0 ? (
          <span style={{ minWidth: 0, flex: 1, fontSize: 13, color: "var(--c-muted)" }}>
            <span style={{ fontFamily: SG, fontWeight: 700, color: "var(--c-ink)" }}>Today:</span>{" "}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{todayEntries[0]!.title}</span>
            <span style={{ fontFamily: JM, fontSize: 11, color: "var(--c-faint)" }}> · {todayEntries.length} {todayEntries.length === 1 ? "action" : "actions"} · ~{todayMin} min</span>
          </span>
        ) : (
          <span style={{ flex: 1, fontSize: 13, color: "var(--c-muted)" }}>Nothing scheduled today — your plan rolls 30 days ahead.</span>
        )}
        <Link
          href="/app/plan"
          style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6, background: "var(--c-action)", color: "var(--c-on-dark)", fontFamily: PJ, fontWeight: 700, fontSize: 12, padding: "8px 14px", borderRadius: "var(--radius-full)", textDecoration: "none", whiteSpace: "nowrap" }}
        >
          Open your plan →
        </Link>
      </div>
    </Card>
  );
}
