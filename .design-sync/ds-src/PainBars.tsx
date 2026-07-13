/* @mirrors components/app/intel/pain-bars.tsx */
import * as React from "react";

/**
 * PainBars — buyer pains as mention-ranked frequency bars. Each row is a
 * focusable button expanding to a verbatim quote + a real source (an
 * EvidenceLink to `sourceUrl`, a muted "from N competitor review pages"
 * fallback using page-level `sources`, or "source not captured" — never a
 * fabricated link) and a "details ↗" affordance that opens the pain in the
 * shared EvidenceDrawer. Honesty: `mentions` is a real per-pain count and is
 * not always present — when NO pain has one, bars fall back to a gentle
 * descending-by-rank width with NO number; when SOME do, width is
 * `mentions / maxMentions` and pains without a count get a minimal bar and no
 * number. The live component opens `useEvidenceDrawer()` on click; this
 * mirror has no Provider in the sandbox, so its sample rows render as static
 * buttons (no-op onClick) with the same visual language and a fixed sample
 * dataset, matching the self-contained-mirror convention of `BuyerThreadFeed`.
 */
type SamplePain = { text: string; quote?: string; sourceUrl?: string; mentions?: number };

const MIN_BAR_PCT = 8;

const SAMPLE: SamplePain[] = [
  { text: "Onboarding takes too long to see value", mentions: 34, quote: "It took me three weeks before I understood what to even do with it.", sourceUrl: "https://www.g2.com/products/example/reviews" },
  { text: "Pricing jumps steeply at the next tier", mentions: 27, quote: "Fine at the entry plan, then it doubles the moment you add a seat." },
  { text: "Reporting exports are hard to share", mentions: 19 },
  { text: "Support replies are slow on weekends", mentions: 11, quote: "Waited two days for a reply on a blocker." },
  { text: "Mobile app lags behind the web version", mentions: 6 },
];

const SOURCES = ["g2.com", "capterra.com", "trustpilot.com"];

export function PainBars() {
  const [expanded, setExpanded] = React.useState<number | null>(0);

  const ranked = [...SAMPLE]
    .map((p, i) => ({ p, i }))
    .sort((a, b) => (b.p.mentions ?? 0) - (a.p.mentions ?? 0) || a.i - b.i)
    .map((x) => x.p);

  const hasAnyMentions = ranked.some((p) => typeof p.mentions === "number");
  const maxMentions = hasAnyMentions ? Math.max(1, ...ranked.map((p) => p.mentions ?? 0)) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {ranked.map((pain, idx) => {
        const isOpen = expanded === idx;
        const pct = hasAnyMentions
          ? typeof pain.mentions === "number"
            ? Math.max(MIN_BAR_PCT, Math.round((pain.mentions / maxMentions) * 100))
            : MIN_BAR_PCT
          : Math.max(MIN_BAR_PCT, 100 - idx * (70 / Math.max(1, ranked.length - 1 || 1)));

        return (
          <div key={idx} style={{ borderBottom: "1px solid var(--c-line)" }}>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setExpanded(isOpen ? null : idx)}
              style={{
                width: "100%", display: "flex", flexDirection: "column", gap: 6, padding: "10px 4px",
                background: "none", border: "none", cursor: "pointer", textAlign: "left", font: "inherit",
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
                    height: "100%", width: `${pct}%`, borderRadius: "var(--radius-full)",
                    background: "linear-gradient(90deg, var(--c-action), var(--c-action))",
                    opacity: 0.85, transition: "width 240ms ease",
                  }}
                />
              </div>
            </button>

            {isOpen && (
              <div style={{ padding: "2px 4px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                {pain.quote && (
                  <blockquote style={{ margin: 0, padding: "10px 12px", borderLeft: "3px solid var(--c-line)", fontSize: 13, fontStyle: "italic", color: "var(--c-muted)" }}>
                    “{pain.quote}”
                  </blockquote>
                )}

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    {pain.sourceUrl ? (
                      <a href="#" onClick={(e) => e.preventDefault()} style={{ fontSize: 12, color: "var(--c-action)", textDecoration: "none", fontWeight: 500 }}>
                        Open the source <span style={{ fontSize: "0.85em" }}>↗</span>
                      </a>
                    ) : SOURCES.length > 0 ? (
                      <span style={{ fontSize: 12, color: "var(--c-faint)" }}>
                        from {SOURCES.length} competitor review page{SOURCES.length === 1 ? "" : "s"}
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--c-faint)" }}>source not captured</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {}}
                    style={{
                      flexShrink: 0, background: "none", border: "none", padding: 0, font: "inherit",
                      fontSize: 12, fontWeight: 600, color: "var(--c-action)", cursor: "pointer",
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
