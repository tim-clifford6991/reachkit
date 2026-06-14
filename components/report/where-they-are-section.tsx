/**
 * WhereTheyAreSection — Q3: "Where they are" (surfaces + competitor gap).
 *
 * §5.6 four-question report: answers "Where do your potential buyers
 * already gather, and where are competitors outranking you?"
 *
 * Reusable: consumed by the funnel results page (moment 5) and the app
 * dashboard (Task 20, E3). Content-as-props — never fetches its own data.
 */

import type { ReportPayload } from "@/lib/scan/report";

interface WhereTheyAreSectionProps {
  whereTheyAre: ReportPayload["whereTheyAre"];
  /** When false (free tier), surface list and competitor table are limited. */
  unlocked?: boolean;
  /** Max surfaces to show when locked (default 3). */
  previewSurfaceCount?: number;
}

export function WhereTheyAreSection({
  whereTheyAre,
  unlocked = true,
  previewSurfaceCount = 3,
}: WhereTheyAreSectionProps) {
  const surfaces = unlocked
    ? whereTheyAre.surfaces
    : whereTheyAre.surfaces.slice(0, previewSurfaceCount);

  const hiddenSurfaces = unlocked
    ? 0
    : whereTheyAre.surfaces.length - surfaces.length;

  const competitorGap = unlocked
    ? whereTheyAre.competitorGap
    : whereTheyAre.competitorGap.slice(0, 2);

  const hiddenGaps = unlocked
    ? 0
    : whereTheyAre.competitorGap.length - competitorGap.length;

  return (
    <section
      aria-labelledby="where-they-are-heading"
      className="rounded-2xl border shadow-[var(--elevation-sm),var(--edge-highlight)]"
      style={{
        borderColor: "var(--hairline)",
        background: "var(--gradient-surface)",
      }}
    >
      <div className="px-7 pb-6 pt-6">
        <div className="mb-4">
          <p
            className="font-mono text-[10px] uppercase tracking-widest"
            style={{ color: "var(--color-muted)" }}
          >
            Question 3
          </p>
          <h2
            id="where-they-are-heading"
            className="mt-0.5 text-base font-semibold"
            style={{ color: "var(--color-fg)" }}
          >
            Where they are
          </h2>
        </div>

        <div className="space-y-5">
          {/* Community + surface list */}
          {surfaces.length > 0 && (
            <div>
              <p
                className="mb-2.5 font-mono text-[10px] uppercase tracking-wider"
                style={{ color: "var(--color-muted)" }}
              >
                Where your buyers gather
              </p>
              <ul className="space-y-2">
                {surfaces.map((s, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-sm"
                  >
                    <span
                      className="mt-px rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider shrink-0"
                      style={{
                        background: "var(--fill-subtle)",
                        color: "var(--color-muted)",
                        border: "1px solid var(--hairline)",
                      }}
                    >
                      {s.source}
                    </span>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 leading-snug transition-colors text-accent-400 hover:text-accent-300"
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>

              {hiddenSurfaces > 0 && (
                <p
                  className="mt-2.5 font-mono text-xs"
                  style={{ color: "var(--color-muted)" }}
                >
                  +{hiddenSurfaces} more communit{hiddenSurfaces === 1 ? "y" : "ies"} in your full report
                </p>
              )}
            </div>
          )}

          {/* Competitor gap table */}
          {competitorGap.length > 0 && (
            <div>
              <p
                className="mb-2.5 font-mono text-[10px] uppercase tracking-wider"
                style={{ color: "var(--color-muted)" }}
              >
                Competitor gap
              </p>
              <div className="space-y-2">
                {competitorGap.map((gap, i) => (
                  <div
                    key={i}
                    className="rounded-lg px-4 py-3"
                    style={{ background: "var(--fill-subtle)" }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p
                          className="text-sm font-medium"
                          style={{ color: "var(--color-fg)" }}
                        >
                          {gap.competitor}
                        </p>
                        {gap.positioning ? (
                          <p
                            className="mt-0.5 text-xs leading-snug"
                            style={{ color: "var(--color-muted)" }}
                          >
                            {gap.positioning}
                          </p>
                        ) : null}
                      </div>
                      {/* Only show the comparison bars when there's a real signal
                          (community-mention counts). Early-stage apps with 0/0
                          show just the positioning + gap text instead. */}
                      {gap.them > 0 || gap.you > 0 ? (
                        <div className="shrink-0 text-right">
                          <GapScorePair them={gap.them} you={gap.you} />
                          <p
                            className="mt-0.5 font-mono text-[9px] uppercase tracking-wider"
                            style={{ color: "var(--color-muted)" }}
                          >
                            {gap.dimension}
                          </p>
                        </div>
                      ) : null}
                    </div>
                    {gap.gap ? (
                      <p
                        className="mt-2 text-xs leading-snug"
                        style={{ color: "var(--color-fg)" }}
                      >
                        <span style={{ color: "var(--color-danger)" }}>Gap: </span>
                        {gap.gap}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>

              {hiddenGaps > 0 && (
                <p
                  className="mt-2.5 font-mono text-xs"
                  style={{ color: "var(--color-muted)" }}
                >
                  +{hiddenGaps} more competitor{hiddenGaps === 1 ? "" : "s"} in your full report
                </p>
              )}
            </div>
          )}

          {surfaces.length === 0 && competitorGap.length === 0 && (
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>
              No surfaces or competitor data yet.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

// ── Competitor score pair ─────────────────────────────────────────────────────

function GapScorePair({ them, you }: { them: number; you: number }) {
  const delta = you - them;
  const isAhead = delta >= 0;

  return (
    <div className="flex items-center gap-1.5">
      <span
        className="font-mono text-sm tabular-nums"
        style={{
          color: isAhead ? "var(--color-success)" : "var(--color-danger)",
        }}
        title={`You: ${you}`}
      >
        {you}
      </span>
      <span style={{ color: "var(--hairline-strong)" }} aria-hidden>
        vs
      </span>
      <span
        className="font-mono text-sm tabular-nums"
        style={{ color: "var(--color-muted)" }}
        title={`Them: ${them}`}
      >
        {them}
      </span>
    </div>
  );
}
