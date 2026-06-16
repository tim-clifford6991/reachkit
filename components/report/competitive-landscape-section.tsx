/**
 * CompetitiveLandscapeSection — the competitive landscape.
 *
 * "Tease the question, gate the answer." The free teaser keeps the provocation:
 * every competitor, how they position, and their community footprint (the proof
 * you're being out-talked). The *answer* — your specific opening vs each rival,
 * and the creators who already reach their buyers — is gated behind the trial
 * (`unlocked={false}`). The paid dashboard renders everything in full.
 */

import type { CompetitiveLandscapeRow } from "@/lib/scan/report";
import { DeepSection } from "./deep-section-shell";

export function CompetitiveLandscapeSection({
  rows,
  unlocked = true,
}: {
  rows?: CompetitiveLandscapeRow[];
  unlocked?: boolean;
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

            {/* Your opening vs this rival — gated. Free sees a blurred teaser
                proving an opening exists; paid sees the real angle. */}
            {unlocked ? (
              row.gap ? (
                <p className="mt-2 text-xs leading-snug" style={{ color: "var(--color-fg)" }}>
                  <span style={{ color: "var(--color-danger)" }}>Your opening: </span>
                  {row.gap}
                </p>
              ) : null
            ) : (
              <p
                className="mt-2 text-xs leading-snug select-none"
                style={{ color: "var(--color-fg)" }}
                aria-hidden
              >
                <span style={{ color: "var(--color-danger)" }}>Your opening: </span>
                <span className="blur-[3px]">
                  the specific angle this rival leaves wide open for you
                </span>
              </p>
            )}

            {/* Creators reaching their buyers — gated. Free sees the count + a
                link to unlock; paid sees the named creators. */}
            {unlocked ? (
              row.creators.length > 0 ? (
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
              ) : null
            ) : (row.lockedCreatorCount ?? 0) > 0 ? (
              <a
                href="#unlock"
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors"
                style={{
                  borderColor: "var(--color-accent-900)",
                  background: "var(--color-accent-subtle)",
                  color: "var(--color-accent-400)",
                }}
              >
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
                  <rect x="1.5" y="5" width="9" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M3.5 5V3.5a2.5 2.5 0 0 1 5 0V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                {row.lockedCreatorCount} creator{row.lockedCreatorCount === 1 ? "" : "s"} reach their audience — see all
              </a>
            ) : null}
          </div>
        ))}
      </div>
    </DeepSection>
  );
}
