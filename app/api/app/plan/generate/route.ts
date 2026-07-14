import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth/server";
import { assertPaid, EntitlementError } from "@/lib/billing/entitlements";
import { activeAppId } from "@/lib/app/active-app";
import { costedIntelStep, latestScanIdForApp } from "@/lib/app/latest-scan";
import { serverDb } from "@/lib/db/client";
import type { Json } from "@/lib/db/types";
import { getSelectedCompetitors } from "@/lib/scan/competitor-selection";
import { gatherSynthesis, type ContentPlanItem, type DistributionPlanItem } from "@/lib/scan/synthesis/synthesize";
import { actionBoard } from "@/lib/scan/action-board";
import { linkSignalKeys, recomputeActionImpacts } from "@/lib/scan/action-linking";
import { EFFORT_MIN, CONTENT_EFFORT_MIN } from "@/lib/scan/plan-schedule";
import type { ScanSignalRow } from "@/lib/scan/compute-signals";
import type { ActionCard, ActionTarget, ActionTargetChannel } from "@/lib/llm/types";

/**
 * /api/app/plan/generate — "Generate more actions" for the plan page.
 *
 * Surfaces MORE of the app's already-computed recommendations (the synthesis
 * `contentPlan`/`distributionPlan` — the same cached output the Synthesis/Plans
 * intel pages already read) as real, persisted `pending` actions. This is
 * deliberately NOT a fresh-generation endpoint: no per-click LLM action-writing
 * call, no fresh external (DataForSEO/Tavily) scan in the common (warm-cache)
 * path — `gatherSynthesis` is the exact same cached call `/api/app/intel?layer=synthesis`
 * makes, so a founder who has already opened the Plans page gets an instant,
 * cache-hit response here.
 *
 * POST { higherImpactOnly?: boolean } → 200 { added: {id,title,category}[] }
 *   402 EntitlementError (assertPaid gate, mirrors app/api/app/intel/route.ts
 *   EXACTLY — this route triggers the same class of metered spend on a cache
 *   miss and must never be reachable by an inactive/free viewer).
 *   400 no active app / no subject domain. 401 unauthenticated.
 *
 * Dedupe + rank + cap:
 *   - Recommendations already present as an action (ANY lifecycle state — open,
 *     verifying, done, retry) are dropped, matching the same title-based dedupe
 *     `mergePlanEntries` (lib/scan/plan-schedule.ts) already uses for suggestion
 *     display, so a persisted action here disappears from the "suggested" pool
 *     everywhere else too.
 *   - `higherImpactOnly=true` keeps only `priority === "high"` recommendations.
 *   - Ranked by the recommendation's own priority (high > medium > low, stable
 *     within a tier), capped at `MAX_GENERATED` (5) total across both plans.
 *
 * Impact honesty (invariant #5a): every persisted card's `expected_outcome.delta`
 * is the model-computed signal shortfall via `linkSignalKeys` + `recomputeActionImpacts`
 * — NEVER the LLM's free-choice priority label. When no per-signal breakdown is
 * available for the app's latest scan (cold start / scan predates `scan_signals`),
 * this degrades to `delta: 0` — never a fabricated number.
 *
 * §11 no-auto (invariant #7): every persisted row carries `draft: null,
 * draft_requires_edit: true` — these are drafts entering the normal
 * add-to-plan lifecycle, never auto-sent/auto-posted.
 */

const Body = z.object({
  higherImpactOnly: z.boolean().optional(),
});

/** Bounded — a single "generate more" click never floods the plan. */
const MAX_GENERATED = 5;

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

export async function POST(req: NextRequest) {
  const viewer = await currentUser();
  if (!viewer) {
    return NextResponse.json({ message: "authentication required" }, { status: 401 });
  }

  // Paid gate BEFORE any gather — mirrors app/api/app/intel/route.ts exactly
  // (the /app UI paywall does not protect this API; invariant #5b).
  try {
    await assertPaid(viewer.user.id);
  } catch (e) {
    if (e instanceof EntitlementError) return NextResponse.json({ error: "upgrade required" }, { status: 402 });
    return NextResponse.json({ error: "unexpected entitlement error" }, { status: 500 });
  }

  const raw = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(raw ?? {});
  const higherImpactOnly = parsed.success ? (parsed.data.higherImpactOnly ?? false) : false;

  const appId = await activeAppId(viewer.user);
  if (!appId) return NextResponse.json({ message: "no active app" }, { status: 400 });

  const db = serverDb();
  const { data: appRow } = await db.from("apps").select("store_url").eq("id", appId).maybeSingle();
  const domain = (appRow?.store_url as string | null) ?? null;
  if (!domain) return NextResponse.json({ message: "no subject domain" }, { status: 400 });

  try {
    const added = await costedIntelStep(appId, "plan-generate", async () => {
      const competitors = await getSelectedCompetitors(appId);
      // Cache-only: the SAME cached synthesis the Synthesis/Plans intel pages
      // read (gatherSynthesis is itself cached 7d by domain+cohort) — a warm
      // cache means this whole step costs nothing extra.
      const synth = await gatherSynthesis(domain, { competitorDomains: competitors });

      const board = await actionBoard(appId);
      const existingTitles = new Set(
        [...board.open, ...board.verifying, ...board.done, ...board.retry].map((a) => a.title),
      );

      let candidates: Candidate[] = [
        ...synth.contentPlan.filter((c) => !existingTitles.has(c.topic)).map(fromContent),
        ...synth.distributionPlan.filter((d) => !existingTitles.has(d.action)).map(fromDistribution),
      ];

      if (higherImpactOnly) {
        candidates = candidates.filter((c) => c.priority === "high");
      }

      candidates = candidates
        .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
        .slice(0, MAX_GENERATED);

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
        // §11 no-auto: every generated card is review-required by definition.
        draft_requires_edit: true,
        effort_min: c.effortMin,
        target: (c.target ?? null) as Json | null,
      }));

      const { data: inserted, error: insErr } = await db
        .from("actions")
        .insert(rows)
        .select("id, title, category");
      if (insErr) throw insErr;

      return (inserted ?? []).map((r) => ({
        id: r.id as string,
        title: r.title as string,
        category: r.category as string,
      }));
    });

    return NextResponse.json({ added });
  } catch (e) {
    return NextResponse.json({ message: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
