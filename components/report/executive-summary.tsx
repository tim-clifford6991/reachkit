/**
 * ExecutiveSummary — the report's "page 1" scorecard (ChannelIntel UX).
 *
 * A scannable top-of-report card: headline score + verdict, top-3 rivals with
 * their footprint, your organic-keyword standing vs the rival median, the single
 * biggest move, and 1–2 quick wins. Content-as-props (pure `ExecutiveSummary`
 * from `buildExecutiveSummary`), server-rendered. Identical for free + paid —
 * it's a summary of what's already shown, a strong teaser without gating.
 */

import type { ExecutiveSummary as ExecutiveSummaryData } from "@/lib/scan/report";
import { NumberTicker } from "@/components/motion/number-ticker";

function scoreColor(total: number): string {
  if (total >= 70) return "var(--color-success)";
  if (total >= 40) return "var(--color-accent-400)";
  return "var(--color-warning)";
}

function StatCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg px-4 py-3" style={{ background: "var(--fill-subtle)" }}>
      <p className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
        {label}
      </p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export function ExecutiveSummary({ summary }: { summary: ExecutiveSummaryData }) {
  const { score, topCompetitors, traffic, biggestGap, quickWins } = summary;
  const color = scoreColor(score.total);

  return (
    <section
      id="summary"
      className="scroll-mt-8 rounded-2xl border shadow-[var(--elevation-sm),var(--edge-highlight)]"
      style={{ borderColor: "var(--hairline)", background: "var(--gradient-surface)" }}
      aria-label="Executive summary"
    >
      <div className="px-7 pb-6 pt-6">
        <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--color-muted)" }}>
          The short version
        </p>

        {/* Headline score + verdict */}
        <div className="mt-2 flex items-baseline gap-3">
          <span
            className="font-mono text-3xl font-semibold tabular-nums leading-none"
            style={{ color, viewTransitionName: "exec-summary-score" } as React.CSSProperties}
          >
            <NumberTicker value={score.total} />
          </span>
          <span className="font-mono text-sm" style={{ color: "var(--color-muted)" }}>/100</span>
          <span className="text-sm font-medium" style={{ color: "var(--color-fg)" }}>{score.verdict}</span>
        </div>
        <p className="mt-1.5 font-mono text-[11px] tabular-nums" style={{ color: "var(--color-muted)" }}>
          Content {score.breakdown.content} · Outreach {score.breakdown.outreach} · SEO {score.breakdown.seo}
        </p>

        {/* Proof grid */}
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {topCompetitors.length > 0 && (
            <StatCell label="Top rivals">
              <ul className="space-y-0.5">
                {topCompetitors.map((c) => (
                  <li key={c.domain} className="flex items-baseline justify-between gap-2 text-sm" style={{ color: "var(--color-fg)" }}>
                    <span className="min-w-0 truncate">{c.domain}</span>
                    {c.organicKeywords != null && (
                      <span className="shrink-0 font-mono text-[11px] tabular-nums" style={{ color: "var(--color-muted)" }}>
                        {c.organicKeywords.toLocaleString()} kw
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </StatCell>
          )}

          {traffic && (
            <StatCell label="Organic footprint">
              <p className="font-mono text-sm tabular-nums" style={{ color: "var(--color-fg)" }}>
                <span style={{ color: traffic.youKeywords >= traffic.rivalMedianKeywords ? "var(--color-success)" : "var(--color-warning)" }}>
                  you {traffic.youKeywords.toLocaleString()}
                </span>
                <span style={{ color: "var(--color-muted)" }}> · rival median {traffic.rivalMedianKeywords.toLocaleString()} kw</span>
              </p>
            </StatCell>
          )}

          {biggestGap && (
            <StatCell label="Biggest move">
              <p className="text-sm" style={{ color: "var(--color-fg)" }}>{biggestGap}</p>
            </StatCell>
          )}

          {quickWins.length > 0 && (
            <StatCell label="Start this week">
              <ul className="space-y-0.5">
                {quickWins.map((q, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-snug" style={{ color: "var(--color-fg)" }}>
                    <span style={{ color: "var(--color-accent-400)" }}>·</span>
                    {q}
                  </li>
                ))}
              </ul>
            </StatCell>
          )}
        </div>
      </div>
    </section>
  );
}
