"use client";

/**
 * Minimal recharts wrapper — used ONLY for axis-based bar charts (theme volumes,
 * keyword opportunity), where ticks/scales earn recharts' weight. Pure-SVG charts
 * (donut, gauge, scatter, matrix) stay in components/charts. Consumers lazy-load
 * this via next/dynamic so recharts stays off the initial bundle (see how
 * ScoreHistoryCard wraps ScoreHistoryChart). Themed tooltip mirrors the existing
 * TooltipBox in score-history-chart.tsx.
 */
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface HBarDatum {
  label: string;
  value: number;
  color?: string;
  /** Optional secondary line under the value in the tooltip (e.g. intent). */
  note?: string;
}

function ChartTip({ active, payload, valueFormatter }: { active?: boolean; payload?: Array<{ payload: HBarDatum }>; valueFormatter?: (n: number) => string }) {
  const d = active ? payload?.[0]?.payload : undefined;
  if (!d) return null;
  return (
    <div className="rounded-lg border px-2.5 py-1.5 text-xs shadow-[var(--elevation-sm)]" style={{ borderColor: "var(--hairline)", background: "var(--color-elevated)" }}>
      <p style={{ color: "var(--color-fg)" }}>{d.label}</p>
      <p className="font-mono tabular-nums" style={{ color: "var(--color-muted)" }}>
        {valueFormatter ? valueFormatter(d.value) : d.value.toLocaleString()}
      </p>
      {d.note && <p className="text-[10px]" style={{ color: "var(--color-muted)" }}>{d.note}</p>}
    </div>
  );
}

export function HBarChart({
  data,
  height,
  labelWidth = 150,
  valueFormatter,
  onBarClick,
}: {
  data: HBarDatum[];
  height?: number;
  labelWidth?: number;
  valueFormatter?: (n: number) => string;
  onBarClick?: (d: HBarDatum, index: number) => void;
}) {
  return (
    <ResponsiveContainer width="100%" height={height ?? Math.max(140, data.length * 38)}>
      <BarChart layout="vertical" data={data} margin={{ left: 0, right: 16, top: 4, bottom: 4 }} barCategoryGap={6}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          width={labelWidth}
          tick={{ fontSize: 11, fill: "var(--color-muted)" }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip cursor={{ fill: "var(--fill-subtle)" }} content={<ChartTip valueFormatter={valueFormatter} />} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false} onClick={onBarClick ? ((_, index) => onBarClick(data[index]!, index)) : undefined} cursor={onBarClick ? "pointer" : undefined}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color ?? "var(--chart-1)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
