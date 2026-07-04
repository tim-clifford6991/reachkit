/**
 * WeeklyPlanCard — the dashboard's "This week's plan" panel: the first UI
 * consumer of `assembleWeeklyPlan` (§10.3). Renders this week's action queue
 * grouped by effort horizon (Quick wins / Medium / Long plays), each action as
 * the design-system PlanItem with its Mark-done→verify affordance, plus a muted
 * footer for carryover + the §7.2 rule 5 honesty note and a link to the full
 * plan board.
 *
 * Server-safe presentational component: no hooks, no handlers — it composes the
 * client-side intel kit (Card/Eyebrow/Badge) and PlanItem as children only, and
 * calls none of the kit's helper functions.
 */

import Link from "next/link";
import { Badge, Card, Eyebrow } from "@/components/app/intel/kit";
import { PlanItem, type PlanItemData } from "@/components/app/intel/plan-item";
import type { WeeklyPlan, WeeklyPlanAction } from "@/lib/scan/weekly-plan";

/** Display order = value order: quick wins first (highest impact per effort). */
const GROUPS: { key: keyof WeeklyPlan["queue"]; label: string }[] = [
  { key: "quickWins", label: "Quick wins" },
  { key: "medium", label: "Medium" },
  { key: "longPlay", label: "Long plays" },
];

/** Verify-state pill colors (kit tint foregrounds: amber / red). */
const VERIFYING_COLOR = "#c98a12";
const FAILED_COLOR = "#e5484d";

/**
 * WeeklyPlanAction → PlanItemData. predictedPts comes from
 * `expected_outcome.delta` when the generator set one (omitted otherwise —
 * never invented). The verify lifecycle maps to the status pill: an in-flight
 * "Verifying" (amber) or a retryable "Verify failed" (red); plain open items
 * get no pill.
 */
function toPlanItem(action: WeeklyPlanAction, doFirst: boolean): PlanItemData {
  const verifying = action.verifyState === "verifying";
  const failed = action.verifyState === "failed";
  return {
    id: action.id,
    title: action.title,
    type: action.category,
    why: action.why,
    predictedPts:
      action.expectedDelta != null
        ? `${action.expectedDelta > 0 ? "+" : ""}${action.expectedDelta} pts`
        : null,
    doFirst,
    status: verifying ? "Verifying" : failed ? "Verify failed" : null,
    statusColor: verifying ? VERIFYING_COLOR : failed ? FAILED_COLOR : null,
  };
}

export function WeeklyPlanCard({ plan }: { plan: WeeklyPlan }) {
  const groups = GROUPS.map((g) => ({ ...g, actions: plan.queue[g.key] })).filter(
    (g) => g.actions.length > 0,
  );
  const queuedCount = groups.reduce((s, g) => s + g.actions.length, 0);
  const carryoverCount = plan.carryover.length;
  const isEmpty = queuedCount === 0 && carryoverCount === 0;

  // "Do this first" = the first item of the highest-value non-empty group.
  const doFirstId = groups[0]?.actions[0]?.id ?? null;

  if (isEmpty) {
    return (
      <Card title="This week's plan">
        <EmptyPlanPrompt />
      </Card>
    );
  }

  return (
    <Card title="This week's plan" meta={`week of ${plan.weekOf}`}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {groups.map((g) => (
          <div key={g.key}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Eyebrow>{g.label}</Eyebrow>
              <Badge tone="neutral">{g.actions.length}</Badge>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {g.actions.map((a) => (
                <PlanItem
                  key={a.id}
                  // In-flight items already show the "Verifying" pill — a second
                  // Mark-done affordance there would double-fire the pipeline.
                  showMarkDone={a.verifyState !== "verifying"}
                  item={toPlanItem(a, a.id === doFirstId)}
                />
              ))}
            </div>
          </div>
        ))}
        {queuedCount === 0 && (
          <p style={{ fontSize: 13, color: "var(--c-faint)", margin: 0 }}>
            Nothing new queued this week — your carryover below still counts.
          </p>
        )}
      </div>

      {(carryoverCount > 0 || plan.honestyNote) && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 4 }}>
          {carryoverCount > 0 && (
            <p style={{ fontSize: 12.5, color: "var(--c-faint)", margin: 0 }}>
              {carryoverCount} carried over from last week
            </p>
          )}
          {plan.honestyNote && (
            <p style={{ fontSize: 12.5, color: "var(--c-faint)", margin: 0 }}>{plan.honestyNote}</p>
          )}
        </div>
      )}

      <div style={{ marginTop: 14, textAlign: "right" }}>
        <PlanLink href="/app/plans">Full plan board →</PlanLink>
      </div>
    </Card>
  );
}

/**
 * Empty state — no actions exist at all yet. The plan is fed by the "＋ add"
 * chips on the gap surfaces, so point the founder there.
 */
function EmptyPlanPrompt() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "26px 16px", textAlign: "center" }}>
      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--c-ink)", margin: 0 }}>
        Your plan starts from your gaps
      </p>
      <p style={{ fontSize: 12.5, color: "var(--c-muted)", margin: 0, maxWidth: 400 }}>
        Every &ldquo;＋ add&rdquo; chip on a keyword or channel gap drops an action into this
        week&rsquo;s queue.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 16, marginTop: 8 }}>
        <PlanLink href="/app/plan/content">Content gaps →</PlanLink>
        <PlanLink href="/app/plan/distribution">Distribution gaps →</PlanLink>
      </div>
    </div>
  );
}

/** The dashboard's footer-link idiom (dashboard-view `Footer`). */
function PlanLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={{ fontSize: 13, fontWeight: 600, color: "var(--c-action)", textDecoration: "none" }}>
      {children}
    </Link>
  );
}
