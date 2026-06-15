/**
 * CompetitiveLandscapeSection — the full competitive landscape.
 *
 * The deliberate free-teaser "wow": every competitor with how they position,
 * the gap vs you, their community footprint, and the creators who cover them —
 * all built from data the scan already collects. Shown in full on both the
 * public teaser and the paid dashboard.
 */

import type { CompetitiveLandscapeRow } from "@/lib/scan/report";
import { DeepSection } from "./deep-section-shell";

export function CompetitiveLandscapeSection({
  rows,
}: {
  rows?: CompetitiveLandscapeRow[];
}) {
  const list = rows ?? [];
  if (list.length === 0) return null;

  return (
    <DeepSection eyebrow="Competitive landscape" title="Who you're up against — and where">
      <div className="space-y-3">
        {list.map((row, i) => (
          <div
            key={i}
            className="rounded-lg px-4 py-3.5"
            style={{ background: "var(--fill-subtle)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium" style={{ color: "var(--color-fg)" }}>
                  {row.competitor}
                </p>
                {row.positioning ? (
                  <p className="mt-0.5 text-xs leading-snug" style={{ color: "var(--color-muted)" }}>
                    {row.positioning}
                  </p>
                ) : null}
              </div>
              {row.communityMentions > 0 ? (
                <div className="shrink-0 text-right">
                  <span className="font-mono text-sm tabular-nums" style={{ color: "var(--color-fg)" }}>
                    {row.communityMentions}
                  </span>
                  <p
                    className="mt-0.5 font-mono text-[9px] uppercase tracking-wider"
                    style={{ color: "var(--color-muted)" }}
                  >
                    mentions
                  </p>
                </div>
              ) : null}
            </div>

            {row.gap ? (
              <p className="mt-2 text-xs leading-snug" style={{ color: "var(--color-fg)" }}>
                <span style={{ color: "var(--color-danger)" }}>Your opening: </span>
                {row.gap}
              </p>
            ) : null}

            {row.creators.length > 0 ? (
              <div className="mt-2.5">
                <p
                  className="mb-1.5 font-mono text-[9px] uppercase tracking-wider"
                  style={{ color: "var(--color-muted)" }}
                >
                  Creators covering them
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {row.creators.slice(0, 6).map((c, j) => (
                    <li key={j}>
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block rounded px-2 py-0.5 text-[11px] transition-colors text-accent-400 hover:text-accent-300"
                        style={{ background: "var(--color-surface)", border: "1px solid var(--hairline)" }}
                      >
                        {c.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </DeepSection>
  );
}
