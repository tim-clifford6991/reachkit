/**
 * TopFixesPreview — §2.1: the three highest-impact actions as a cards strip, lead
 * "with impact" above the four-question sections. Impact-ordered by expected Δ;
 * each card shows title, a Δ pill sized by magnitude, and an effort tag.
 * Content-as-props (server-rendered); pulls from whatToDoThisWeek.
 */

import type { ReportPayload } from "@/lib/scan/report";

type ActionCard = ReportPayload["whatToDoThisWeek"]["quickWins"][number];

function effortTag(effortMin: number | null): string {
  const m = effortMin ?? 30;
  if (m < 30) return "Quick";
  if (m <= 120) return "Medium";
  return "Deep";
}

function deltaSize(delta: number): string {
  if (delta >= 10) return "text-sm font-semibold";
  if (delta >= 5) return "text-xs font-medium";
  return "text-xs";
}

function FixCard({ action, rank }: { action: ActionCard; rank: number }) {
  const delta = action.expectedOutcome?.delta ?? 0;
  return (
    <div
      className="flex flex-col gap-2 rounded-xl border px-4 py-3"
      style={{ borderColor: "var(--hairline)", background: "var(--gradient-surface)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-[10px] tabular-nums" style={{ color: "var(--color-muted)" }}>
          #{rank}
        </span>
        {delta > 0 && (
          <span
            className={`rounded-full px-2 py-0.5 tabular-nums ${deltaSize(delta)}`}
            style={{
              background: "color-mix(in oklch, var(--color-success) 14%, transparent)",
              color: "var(--color-success)",
              border: "1px solid color-mix(in oklch, var(--color-success) 30%, transparent)",
            }}
          >
            +{delta} pts
          </span>
        )}
      </div>
      <p className="text-sm font-medium leading-snug" style={{ color: "var(--color-fg)" }}>
        {action.title}
      </p>
      <span className="mt-auto font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
        {effortTag(action.effortMin)}
        {action.expectedOutcome?.scoreComponent ? ` · ${action.expectedOutcome.scoreComponent}` : ""}
      </span>
    </div>
  );
}

export function TopFixesPreview({ whatToDoThisWeek }: { whatToDoThisWeek: ReportPayload["whatToDoThisWeek"] }) {
  const all: ActionCard[] = [
    ...whatToDoThisWeek.quickWins,
    ...whatToDoThisWeek.medium,
    ...whatToDoThisWeek.longPlay,
  ];
  const top = all
    .filter((a) => (a.expectedOutcome?.delta ?? 0) > 0)
    .sort((a, b) => (b.expectedOutcome?.delta ?? 0) - (a.expectedOutcome?.delta ?? 0))
    .slice(0, 3);
  if (top.length === 0) return null;

  return (
    <section aria-label="Top fixes">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--color-muted)" }}>
        Top fixes — lead with impact
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {top.map((a, i) => (
          <FixCard key={i} action={a} rank={i + 1} />
        ))}
      </div>
    </section>
  );
}
