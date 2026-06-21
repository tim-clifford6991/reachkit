"use client";

/**
 * KeywordGapList — the keyword-gap rows as drill-down triggers. Clicking a row
 * opens a Popover that surfaces `bestRivalPosition` — a value we compute but
 * never otherwise show — alongside the volume and rival count. Pure presentation
 * over data that already exists on each row (no new fetch).
 */

import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import type { KeywordGapRow } from "@/lib/scan/gap/types";

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt style={{ color: "var(--color-muted)" }}>{label}</dt>
      <dd style={{ color: "var(--color-fg)" }}>{value}</dd>
    </div>
  );
}

export function KeywordGapList({ rows }: { rows: KeywordGapRow[] }) {
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <Popover key={r.keyword}>
          <PopoverTrigger
            className="flex w-full items-center justify-between gap-3 rounded-lg px-4 py-2.5 text-left transition-colors hover:bg-[var(--fill-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            style={{ background: "var(--fill-subtle)" }}
          >
            <span className="min-w-0 truncate text-sm" style={{ color: "var(--color-fg)" }}>
              {r.keyword}
            </span>
            <span
              className="flex shrink-0 items-center gap-3 font-mono text-[11px] tabular-nums"
              style={{ color: "var(--color-muted)" }}
            >
              <span>{r.volume.toLocaleString()}/mo</span>
              <span>
                {r.rivalsRanking} rival{r.rivalsRanking === 1 ? "" : "s"}
              </span>
            </span>
          </PopoverTrigger>
          <PopoverContent>
            <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--color-muted)" }}>
              Keyword gap
            </p>
            <p className="mt-1 text-sm font-medium" style={{ color: "var(--color-fg)" }}>
              {r.keyword}
            </p>
            <dl className="mt-2 space-y-1 font-mono text-[11px] tabular-nums">
              <DetailRow label="Search volume" value={`${r.volume.toLocaleString()}/mo`} />
              <DetailRow label="Rivals ranking" value={String(r.rivalsRanking)} />
              <DetailRow label="Best rival position" value={`#${r.bestRivalPosition}`} />
            </dl>
            <p className="mt-2 text-xs leading-snug" style={{ color: "var(--color-muted)" }}>
              Rivals already rank here and you don&apos;t — a ready-made content target.
            </p>
          </PopoverContent>
        </Popover>
      ))}
    </div>
  );
}
