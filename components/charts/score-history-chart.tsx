"use client";

/**
 * ScoreHistoryChart — the primary retention visual: Discoverability Score over
 * time as an area chart, with the five band thresholds shaded as faint zones so
 * progress toward the next band is legible. Recharts (lazy-loaded by the card
 * wrapper so it stays off the initial /app chunk). Reads the existing
 * score_snapshots history; action-completion markers land with the scan_signals
 * migration (score_snapshots.action_id).
 */

import {
  Area,
  AreaChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SCORE_BANDS, bandFor } from "@/lib/scan/score-bands";
import type { ScoreHistoryPoint } from "@/lib/scan/engagement";
import type { HistoryMarker } from "@/lib/scan/score-history-markers";

interface Row {
  label: string;
  score: number;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function TooltipBox({ active, payload }: { active?: boolean; payload?: Array<{ payload: Row }> }) {
  const row = active ? payload?.[0]?.payload : undefined;
  if (!row) return null;
  const band = bandFor(row.score);
  return (
    <div
      className="rounded-lg border px-2.5 py-1.5 text-xs shadow-[var(--elevation-sm)]"
      style={{ borderColor: "var(--hairline)", background: "var(--color-elevated)" }}
    >
      <p className="font-mono tabular-nums" style={{ color: "var(--color-fg)" }}>
        {row.score}/100
      </p>
      <p style={{ color: band.color }}>{band.label}</p>
      <p className="font-mono text-[10px]" style={{ color: "var(--color-muted)" }}>
        {row.label}
      </p>
    </div>
  );
}

export function ScoreHistoryChart({
  history,
  markers = [],
}: {
  history: ScoreHistoryPoint[];
  markers?: HistoryMarker[];
}) {
  if (history.length === 0) {
    return (
      <div
        className="flex h-[200px] items-center justify-center rounded-lg border border-dashed px-4 text-center text-xs"
        style={{ borderColor: "var(--hairline)", color: "var(--color-muted)" }}
      >
        Your score history starts with your first scan.
      </div>
    );
  }

  const data: Row[] = history.map((p) => ({ label: fmtDate(p.takenAt), score: p.total }));

  return (
    <div>
      <div style={{ width: "100%", height: 200 }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
            {SCORE_BANDS.map((b) => (
              <ReferenceArea
                key={b.key}
                y1={b.min}
                y2={b.max}
                fill={b.color}
                fillOpacity={0.06}
                stroke="none"
              />
            ))}
            {markers.map((m, i) => (
              <ReferenceLine
                key={`m-${i}`}
                x={fmtDate(m.takenAt)}
                stroke="var(--color-success)"
                strokeDasharray="3 3"
                strokeOpacity={0.6}
                label={{ value: "✓ fix", position: "top", fontSize: 9, fill: "var(--color-success)" }}
              />
            ))}
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "var(--color-muted)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--hairline)" }}
              minTickGap={16}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 30, 50, 70, 85, 100]}
              tick={{ fontSize: 10, fill: "var(--color-muted)" }}
              tickLine={false}
              axisLine={false}
              width={28}
            />
            <Tooltip content={<TooltipBox />} cursor={{ stroke: "var(--hairline-strong)" }} />
            <Area
              type="monotone"
              dataKey="score"
              stroke="var(--color-accent-400)"
              strokeWidth={2}
              fill="var(--color-accent-400)"
              fillOpacity={0.12}
              dot={{ r: 2.5, fill: "var(--color-accent-400)", strokeWidth: 0 }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {history.length === 1 && (
        <p className="mt-2 text-center text-xs" style={{ color: "var(--color-muted)" }}>
          Baseline established. Weekly scans build your trend line.
        </p>
      )}
    </div>
  );
}
