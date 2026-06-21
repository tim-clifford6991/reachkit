/**
 * SignalBreakdownSection — the §2.5 "how findable are you" drill-down: the 18
 * signals behind the score, grouped by pillar, each as a pass/warn/fail row with
 * a weight bar and (when not passing) a one-line fix. Degrades to a note when no
 * per-signal data exists yet (pre-migration scans).
 */

import { DeepSection } from "./deep-section-shell";
import type { BreakdownGroup, BreakdownSignal } from "@/lib/scan/signal-breakdown";

const STATE_COLOR: Record<string, string> = {
  pass: "var(--color-success)",
  warn: "var(--color-warning)",
  fail: "var(--color-danger)",
  unmeasured: "var(--color-muted)",
};
const PILLAR_LABEL: Record<string, string> = { seo: "SEO", content: "Content", outreach: "Outreach" };
const MAX_WEIGHT = 0.25;

function SignalRow({ s }: { s: BreakdownSignal }) {
  const measured = s.state !== "unmeasured";
  const color = STATE_COLOR[s.state] ?? "var(--color-muted)";
  return (
    <div className="flex items-start gap-3 py-1.5">
      <span className="mt-1 size-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm" style={{ color: "var(--color-fg)" }}>{s.label}</span>
          <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color }}>
            {measured ? s.state : "not measured"}
          </span>
        </div>
        <div
          className="mt-1 h-1.5 w-full overflow-hidden rounded-full"
          style={{ background: "var(--fill-subtle)" }}
          aria-hidden
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(100, (s.weight / MAX_WEIGHT) * 100)}%`,
              background: measured ? color : "var(--hairline-strong)",
              opacity: measured ? 1 : 0.4,
            }}
          />
        </div>
        {measured && s.state !== "pass" && (
          <p className="mt-1 text-xs leading-snug" style={{ color: "var(--color-muted)" }}>
            {s.howToFix}
          </p>
        )}
      </div>
    </div>
  );
}

export function SignalBreakdownSection({ groups }: { groups: BreakdownGroup[] }) {
  if (groups.length === 0) {
    return (
      <DeepSection id="score-breakdown" eyebrow="Score breakdown" title="The signals behind your score">
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          Signal-level detail is computed on your next scan.
        </p>
      </DeepSection>
    );
  }

  return (
    <DeepSection id="score-breakdown" eyebrow="Score breakdown" title="The 18 signals behind your score">
      <div className="space-y-5">
        {groups.map((g) => (
          <div key={g.pillar}>
            <p
              className="mb-1.5 font-mono text-[10px] uppercase tracking-widest"
              style={{ color: "var(--color-accent-400)" }}
            >
              {PILLAR_LABEL[g.pillar] ?? g.pillar}
            </p>
            <div className="divide-y" style={{ borderColor: "var(--hairline)" }}>
              {g.signals.map((s) => (
                <SignalRow key={s.key} s={s} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </DeepSection>
  );
}
