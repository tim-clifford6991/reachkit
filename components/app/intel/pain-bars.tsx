"use client";

/**
 * PainBars — buyer pains as mention-ranked frequency bars. Each row is a
 * focusable button that expands to the verbatim quote + a real source (an
 * `EvidenceLink` to `sourceUrl`, or a muted "from N competitor review pages"
 * fallback using page-level `sources`, or a muted "source not captured" —
 * NEVER a fabricated link) and offers a "details ↗" affordance that opens
 * the same pain in the shared EvidenceDrawer (`useEvidenceDrawer`), so a
 * pain clicked here and a pain clicked anywhere else in the app lands on
 * identical evidence.
 *
 * Honesty rule: `mentions` is a real per-pain count from the LLM extraction,
 * not always present. When NONE of the pains carry a `mentions` number, bars
 * render at a gentle descending-by-rank width (rank-based, not a fabricated
 * count) and NO number is shown. When SOME do, bar width is
 * `mentions / maxMentions` for those that have it; pains without a count get
 * a minimal bar and no number — never an invented "N".
 */
import * as React from "react";
import { useMemo, useState } from "react";
import type { PainInsight } from "@/components/app/intel/demand-view";
import { useEvidenceDrawer } from "@/components/app/intel/evidence-drawer";
import { EvidenceLink } from "@/components/app/intel/kit";

const MIN_BAR_PCT = 8;

export function PainBars({ pains, sources }: { pains: PainInsight[]; sources?: string[] }): React.JSX.Element {
  const { open } = useEvidenceDrawer();
  const [expanded, setExpanded] = useState<number | null>(null);

  // Stable sort by mentions desc — preserve input order among ties (and
  // among all-undefined counts, which is the common case).
  const ranked = useMemo(() => {
    return pains
      .map((p, i) => ({ p, i }))
      .sort((a, b) => (b.p.mentions ?? 0) - (a.p.mentions ?? 0) || a.i - b.i)
      .map((x) => x.p);
  }, [pains]);

  const hasAnyMentions = ranked.some((p) => typeof p.mentions === "number");
  const maxMentions = hasAnyMentions ? Math.max(1, ...ranked.map((p) => p.mentions ?? 0)) : 0;

  if (ranked.length === 0) {
    return <span style={{ fontSize: 13, color: "var(--c-faint)" }}>No buyer pains surfaced yet.</span>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {ranked.map((pain, idx) => {
        const isOpen = expanded === idx;
        const pct = hasAnyMentions
          ? typeof pain.mentions === "number"
            ? Math.max(MIN_BAR_PCT, Math.round((pain.mentions / maxMentions) * 100))
            : MIN_BAR_PCT
          : // no real counts anywhere — a gentle descending-by-rank visual,
            // never presented as a number
            Math.max(MIN_BAR_PCT, 100 - idx * (70 / Math.max(1, ranked.length - 1 || 1)));

        return (
          <div key={`${pain.text}-${idx}`} style={{ borderBottom: "1px solid var(--c-line)" }}>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setExpanded(isOpen ? null : idx)}
              style={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                gap: 6,
                padding: "10px 4px",
                background: "none",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                font: "inherit",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--c-ink)" }}>{pain.text}</span>
                {typeof pain.mentions === "number" && (
                  <span style={{ flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--c-faint)" }}>
                    {pain.mentions} mention{pain.mentions === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              <div style={{ height: 6, borderRadius: "var(--radius-full)", background: "var(--c-fill)", overflow: "hidden" }}>
                <div
                  className="pain-bar-fill"
                  style={{
                    height: "100%",
                    width: `${pct}%`,
                    borderRadius: "var(--radius-full)",
                    background: "linear-gradient(90deg, var(--c-action), var(--c-action))",
                    opacity: 0.85,
                    transition: "width 240ms ease",
                  }}
                />
              </div>
            </button>

            {isOpen && (
              <div style={{ padding: "2px 4px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                {pain.quote && (
                  <blockquote
                    style={{
                      margin: 0,
                      padding: "10px 12px",
                      borderLeft: "3px solid var(--c-line)",
                      fontSize: 13,
                      fontStyle: "italic",
                      color: "var(--c-muted)",
                    }}
                  >
                    “{pain.quote}”
                  </blockquote>
                )}

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    {pain.sourceUrl ? (
                      <EvidenceLink href={pain.sourceUrl} style={{ fontSize: 12 }}>
                        Open the source
                      </EvidenceLink>
                    ) : sources && sources.length > 0 ? (
                      <span style={{ fontSize: 12, color: "var(--c-faint)" }}>
                        from {sources.length} competitor review page{sources.length === 1 ? "" : "s"}
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--c-faint)" }}>source not captured</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      open({
                        kind: "pain",
                        text: pain.text,
                        quote: pain.quote,
                        sourceUrl: pain.sourceUrl,
                        mentions: pain.mentions,
                        sources,
                      })
                    }
                    style={{
                      flexShrink: 0,
                      background: "none",
                      border: "none",
                      padding: 0,
                      font: "inherit",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--c-action)",
                      cursor: "pointer",
                    }}
                  >
                    details ↗
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .pain-bar-fill { transition: none !important; }
        }
      `}</style>
    </div>
  );
}
