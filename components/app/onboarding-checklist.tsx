/**
 * OnboardingChecklist — the activation nudge for new users: derived steps with a
 * progress bar; the next incomplete step gets the CTA. Renders nothing once every
 * step is done (the dashboard always mounts it; it self-hides).
 */

import Link from "next/link";
import type { ChecklistStep } from "@/lib/scan/onboarding-checklist";

export function OnboardingChecklist({ steps }: { steps: ChecklistStep[] }) {
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;
  const nextKey = steps.find((s) => !s.done)?.key;

  return (
    <section
      className="rounded-2xl border p-5 shadow-[var(--elevation-sm),var(--edge-highlight)]"
      style={{ borderColor: "var(--hairline)", background: "var(--gradient-surface)" }}
    >
      <div className="mb-3 flex items-baseline justify-between">
        <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--color-muted)" }}>
          Get set up
        </p>
        <span className="font-mono text-[10px] tabular-nums" style={{ color: "var(--color-muted)" }}>
          {doneCount} of {steps.length} done
        </span>
      </div>

      <div className="mb-4 h-1 w-full overflow-hidden rounded-full" style={{ background: "var(--fill-subtle)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${(doneCount / steps.length) * 100}%`, background: "var(--color-success)" }} />
      </div>

      <ul className="space-y-2.5">
        {steps.map((s, i) => {
          const isNext = s.key === nextKey;
          return (
            <li key={s.key} className="flex items-center gap-3">
              <span
                className="flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums"
                style={
                  s.done
                    ? { background: "var(--color-success)", color: "var(--color-on-accent, white)" }
                    : { border: "1.5px solid var(--hairline-strong)", color: "var(--color-muted)" }
                }
                aria-hidden
              >
                {s.done ? "✓" : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className="text-sm font-medium"
                  style={{ color: s.done ? "var(--color-muted)" : "var(--color-fg)", textDecoration: s.done ? "line-through" : "none" }}
                >
                  {s.label}
                </span>
                {isNext && <span className="ml-2 text-xs" style={{ color: "var(--color-muted)" }}>{s.hint}</span>}
              </span>
              {isNext && (
                <Link
                  href={s.href}
                  className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors"
                  style={{ background: "var(--color-accent-500)", color: "var(--color-on-accent, white)" }}
                >
                  Do it →
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
