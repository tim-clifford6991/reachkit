/**
 * ActionPlanSection — Q4: "What to do this week" (bucketed by effort).
 *
 * §5.6 four-question report: answers "What is the single highest-leverage
 * action to take this week, for my exact situation?"
 *
 * Reusable: consumed by the funnel results page (moment 5) and the app
 * dashboard (Task 20, E3). Content-as-props — never fetches its own data.
 *
 * §10.3 horizon mix: quickWins → medium → longPlay.
 * Each action card shows title + effort + why + optional draft.
 * When `unlocked` is false (free tier), draft is null and cards are dimmed.
 */

import type { ReportPayload } from "@/lib/scan/report";
import type { ActionCard } from "@/lib/llm/types";
import { EvidencePanel } from "./evidence-panel";
import { LockNote } from "./deep-section-shell";

interface ActionPlanSectionProps {
  whatToDoThisWeek: ReportPayload["whatToDoThisWeek"];
  /** When false, drafts are hidden and evidence is limited (free tier). */
  unlocked?: boolean;
  /** Locked-state CTA label shown under the preview (free tier only). */
  lockLabel?: string;
}

export function ActionPlanSection({
  whatToDoThisWeek,
  unlocked = true,
  lockLabel,
}: ActionPlanSectionProps) {
  const { quickWins, medium, longPlay } = whatToDoThisWeek;
  const hasAny =
    quickWins.length > 0 || medium.length > 0 || longPlay.length > 0;

  return (
    <section
      aria-labelledby="action-plan-heading"
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
            Question 4
          </p>
          <h2
            id="action-plan-heading"
            className="mt-0.5 text-base font-semibold"
            style={{ color: "var(--color-fg)" }}
          >
            What to do this week
          </h2>
        </div>

        {!hasAny && (
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            No actions yet.
          </p>
        )}

        <div className="space-y-6">
          <ActionBucket
            label="Quick wins"
            sublabel="under 30 min"
            actions={quickWins}
            unlocked={unlocked}
            accentColor="var(--color-success)"
          />
          <ActionBucket
            label="Medium effort"
            sublabel="30–120 min"
            actions={medium}
            unlocked={unlocked}
            accentColor="var(--color-accent-500)"
          />
          <ActionBucket
            label="Long play"
            sublabel="over 120 min"
            actions={longPlay}
            unlocked={unlocked}
            accentColor="var(--color-warning)"
          />
        </div>

        {!unlocked && hasAny && (
          <div className="mt-5">
            <LockNote
              label={lockLabel ?? "Unlock the full action queue with ready-to-send draft copy"}
            />
          </div>
        )}
      </div>
    </section>
  );
}

// ── Action bucket ─────────────────────────────────────────────────────────────

interface ActionBucketProps {
  label: string;
  sublabel: string;
  actions: ActionCard[];
  unlocked: boolean;
  accentColor: string;
}

function ActionBucket({
  label,
  sublabel,
  actions,
  unlocked,
  accentColor,
}: ActionBucketProps) {
  if (actions.length === 0) return null;

  return (
    <div>
      <div className="mb-3 flex items-baseline gap-2">
        <p
          className="font-mono text-[10px] uppercase tracking-wider"
          style={{ color: accentColor }}
        >
          {label}
        </p>
        <p
          className="font-mono text-[10px]"
          style={{ color: "var(--color-muted)" }}
        >
          ({sublabel})
        </p>
      </div>
      <div className="space-y-3">
        {actions.map((action, i) => (
          <ActionCardRow
            key={i}
            action={action}
            unlocked={unlocked}
            accentColor={accentColor}
          />
        ))}
      </div>
    </div>
  );
}

// ── Individual action card ────────────────────────────────────────────────────

interface ActionCardRowProps {
  action: ActionCard;
  unlocked: boolean;
  accentColor: string;
}

function categoryLabel(cat: string): string {
  if (cat === "seo_aso") return "SEO / ASO";
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

function ActionCardRow({ action, unlocked, accentColor }: ActionCardRowProps) {
  const hasDraft = action.draft !== null && action.draft.length > 0;

  return (
    <div
      className="space-y-2.5 rounded-lg px-4 py-3"
      style={{ border: "1px solid var(--hairline)" }}
    >
      {/* Header: title + effort badge + category */}
      <div className="flex items-start justify-between gap-3">
        <p
          className="text-sm font-medium leading-snug"
          style={{ color: "var(--color-fg)" }}
        >
          {action.title}
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className="rounded-full border px-2 py-0.5 font-mono text-xs tabular-nums"
            style={{
              borderColor: `${accentColor.replace(")", " / 0.3)")}`,
              color: accentColor,
            }}
          >
            {action.effortMin}m
          </span>
        </div>
      </div>

      {/* Category + basis */}
      <div className="flex items-center gap-2">
        <span
          className="rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider"
          style={{
            background: "var(--fill-subtle)",
            color: "var(--color-muted)",
            border: "1px solid var(--hairline)",
          }}
        >
          {categoryLabel(action.category)}
        </span>
        <span
          className="font-mono text-[10px]"
          style={{ color: "var(--hairline-strong)" }}
        >
          {action.basis === "evidence_based" ? "evidence-based" : "probability"}
        </span>
      </div>

      {/* Why */}
      <p className="text-xs leading-relaxed" style={{ color: "var(--color-muted)" }}>
        {action.why}
      </p>

      {/* Draft copy (only when unlocked and present) */}
      {unlocked && hasDraft && (
        <div
          className="rounded-lg px-3 py-2.5"
          style={{ background: "var(--fill-subtle)" }}
        >
          <p
            className="mb-1.5 font-mono text-[10px] uppercase tracking-wider"
            style={{ color: "var(--color-muted)" }}
          >
            Draft copy — requires edit before use
          </p>
          <p
            className="whitespace-pre-wrap font-mono text-xs leading-relaxed"
            style={{ color: "oklch(0.87 0 0)" }}
          >
            {action.draft}
          </p>
        </div>
      )}

      {/* Evidence panel */}
      {action.evidence.length > 0 && (
        <EvidencePanel
          items={action.evidence}
          maxVisible={unlocked ? undefined : 1}
        />
      )}

      {/* Expected outcome */}
      <div
        className="flex items-center gap-2 rounded-lg px-3 py-2"
        style={{ background: "var(--fill-subtle)" }}
      >
        <span
          className="font-mono text-[10px] uppercase tracking-wider"
          style={{ color: "var(--color-muted)" }}
        >
          Expected outcome
        </span>
        <span
          className="font-mono text-xs font-medium"
          style={{ color: accentColor }}
        >
          {action.expectedOutcome.scoreComponent} +{action.expectedOutcome.delta}
        </span>
        {action.expectedOutcome.secondary && (
          <span className="font-mono text-[10px]" style={{ color: "var(--color-muted)" }}>
            · {action.expectedOutcome.secondary}
          </span>
        )}
      </div>
    </div>
  );
}
