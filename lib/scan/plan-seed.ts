/**
 * Plan seeding — turn a cohort's synthesis (contentPlan + distributionPlan) into
 * real, persisted `pending` tracked actions.
 *
 * A2 (2026-07-26): this is the ONE path both surfaces use to feed the plan from
 * the referral/distribution planner — the manual "Generate more actions" button
 * (`/api/app/plan/generate`) AND the onboarding competitor-approval
 * (`/api/competitors/select`, in `after()`). So the funnel-grounded plan
 * (`synthDistribution`'s `channelsMissing`/`discoveryChannels`) drives the tracked
 * plan on the APPROVED cohort, never an auto cohort, and never a per-scan funnel
 * gather (the ~€1 funnel fires once, deliberately, at competitor-approval where it
 * already renders — no per-scan cost increase; Option B, owner ruling 2026-07-26).
 *
 * The good planner already existed and already persisted — it was just gated
 * behind a manual click. This extraction lets competitor-approval seed the plan
 * proactively, so a founder arrives at a real, referral-grounded plan.
 *
 * Impact honesty (invariant #5a): every persisted card's `expected_outcome.delta`
 * is the model-computed signal shortfall (`linkSignalKeys` + `recomputeActionImpacts`)
 * — NEVER the LLM's/priority-derived free-choice number. When no per-signal
 * breakdown is available (cold start / scan predates `scan_signals`), it degrades
 * to `delta: 0`, never a fabricated number.
 *
 * §11 no-auto (invariant #7): every seeded row carries `draft: null,
 * draft_requires_edit: true` — drafts entering the normal add-to-plan lifecycle,
 * never auto-sent/auto-posted.
 */
import { serverDb } from "@/lib/db/client";
import type { Json } from "@/lib/db/types";
import type { Synthesis, ContentPlanItem, DistributionPlanItem } from "@/lib/scan/synthesis/synthesize";
import { actionBoard } from "@/lib/scan/action-board";
import { linkSignalKeys, recomputeActionImpacts } from "@/lib/scan/action-linking";
import { EFFORT_MIN, CONTENT_EFFORT_MIN } from "@/lib/scan/plan-schedule";
import { latestScanIdForApp } from "@/lib/app/latest-scan";
import type { ScanSignalRow } from "@/lib/scan/compute-signals";
import type { ActionCard, ActionTarget, ActionTargetChannel } from "@/lib/llm/types";

/** Bounded — a single seed (button click OR onboarding) never floods the plan. */
export const MAX_SEEDED = 5;

const PRIORITY_RANK: Record<"high" | "medium" | "low", number> = { high: 0, medium: 1, low: 2 };

const KNOWN_TARGET_CHANNELS = new Set<string>([
  "community", "creator", "directory", "media", "podcast", "newsletter", "partner", "x",
]);

interface Candidate {
  title: string;
  category: "content" | "outreach";
  why: string;
  priority: "high" | "medium" | "low";
  target: ActionTarget | null;
  effortMin: number;
}

function fromContent(c: ContentPlanItem): Candidate {
  return {
    title: c.topic,
    category: "content",
    why: c.buyerAngle || c.evidence || `Content gap: ${c.targetKeywords.join(", ")}`,
    priority: c.priority,
    target: null,
    effortMin: CONTENT_EFFORT_MIN,
  };
}

function fromDistribution(d: DistributionPlanItem): Candidate {
  const channel = KNOWN_TARGET_CHANNELS.has(d.channel) ? (d.channel as ActionTargetChannel) : null;
  return {
    title: d.action,
    category: "outreach",
    why: d.why || `Distribution gap: ${d.target}`,
    priority: d.priority,
    target: channel ? { channel, label: d.target, url: d.targetUrl || undefined } : null,
    effortMin: EFFORT_MIN[d.effort] ?? EFFORT_MIN.medium!,
  };
}

/** Best-effort per-signal breakdown for the app's latest scan — powers honest
 *  impact recompute. Empty (never throws) when unavailable: `recomputeActionImpacts`
 *  degrades cleanly to `delta: 0` over an empty row set, never a fabricated number. */
async function fetchSignalRows(appId: string): Promise<ScanSignalRow[]> {
  try {
    const scanId = await latestScanIdForApp(appId);
    if (!scanId) return [];
    const { data } = await serverDb()
      .from("scan_signals")
      .select("signal_key, pillar, weight, normalised, state, platform")
      .eq("scan_id", scanId);
    if (!data) return [];
    return data.map((r) => ({
      signalKey: r.signal_key as string,
      pillar: r.pillar as ScanSignalRow["pillar"],
      weight: (r.weight as number | null) ?? 0,
      normalised: r.normalised as number | null,
      state: (r.state as ScanSignalRow["state"]) ?? "unmeasured",
      rawValue: null,
      contribution: null,
      platform: (r.platform as ScanSignalRow["platform"]) ?? "web",
    }));
  } catch {
    return [];
  }
}

export interface SeededAction {
  id: string;
  title: string;
  category: string;
}

/**
 * Seed the tracked plan from a synthesis. Dedupes against every existing action
 * (any lifecycle state), ranks by the recommendation's own priority, caps at
 * `max` (default `MAX_SEEDED`), and persists with honest impact + §11 no-auto.
 * Returns the inserted rows (empty when nothing new to add).
 */
export async function seedPlanFromSynthesis(opts: {
  appId: string;
  synth: Synthesis;
  /** The founder's local "YYYY-MM-DD" so seeded actions land on the right day. */
  scheduledFor: string;
  higherImpactOnly?: boolean;
  max?: number;
}): Promise<SeededAction[]> {
  const { appId, synth, scheduledFor } = opts;
  const max = opts.max ?? MAX_SEEDED;

  const board = await actionBoard(appId);
  const existingTitles = new Set(
    [...board.open, ...board.verifying, ...board.done, ...board.retry].map((a) => a.title),
  );

  let candidates: Candidate[] = [
    ...synth.contentPlan.filter((c) => !existingTitles.has(c.topic)).map(fromContent),
    ...synth.distributionPlan.filter((d) => !existingTitles.has(d.action)).map(fromDistribution),
  ];

  if (opts.higherImpactOnly) {
    candidates = candidates.filter((c) => c.priority === "high");
  }

  candidates = candidates
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
    .slice(0, max);

  if (candidates.length === 0) return [];

  const cards: ActionCard[] = candidates.map((c) => ({
    category: c.category,
    title: c.title,
    why: c.why,
    evidenceIds: [],
    evidence: [],
    effortMin: c.effortMin,
    suggestedDeadline: "",
    expectedOutcome: { scoreComponent: c.category, delta: 0 },
    draft: null,
    draftRequiresEdit: true,
    verification: { method: "self_report", state: "pending" },
    basis: "evidence_based",
    confidence: 0.6,
    target: c.target,
    signalKeys: [],
  }));

  // Impact honesty (#5a): overwrite with the model-computed shortfall —
  // never the LLM's/priority-derived free-choice number.
  const sigRows = await fetchSignalRows(appId);
  const withImpact = recomputeActionImpacts(linkSignalKeys(cards, sigRows), sigRows);

  const rows = withImpact.map((c) => ({
    app_id: appId,
    category: c.category,
    title: c.title,
    why: c.why,
    status: "pending",
    signal_keys: c.signalKeys ?? [],
    expected_outcome: { delta: c.expectedOutcome.delta } as Json,
    draft: null as string | null,
    // §11 no-auto: every seeded card is review-required by definition.
    draft_requires_edit: true,
    effort_min: c.effortMin,
    target: (c.target ?? null) as Json | null,
    scheduled_for: scheduledFor,
  }));

  const { data: inserted, error: insErr } = await serverDb()
    .from("actions")
    .insert(rows)
    .select("id, title, category");
  if (insErr) throw insErr;

  return (inserted ?? []).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    category: r.category as string,
  }));
}
