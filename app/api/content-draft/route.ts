/**
 * /api/content-draft — generate a review-required first draft for ONE approved
 * content-plan item, on demand (automation enablement, Phase 1).
 *
 * The content item is resolved SERVER-SIDE from the cached synthesis for the
 * caller's active app (never a client-supplied prompt), so this can't be used
 * to run arbitrary LLM calls. The generated draft is §11-scrubbed and stored on
 * the matching `actions` row's `draft` column, marked pending — the founder
 * edits and publishes it themselves. We never publish anything.
 *
 * POST { topic, angle?, regenerate? } → 200 { draft, requiresEdit: true, actionId }
 *   401 unauthed · 400 no active app / domain / missing topic.
 *
 * The topic is preferentially resolved against the cached synthesis content plan
 * (rich brief + keywords). But the plan also surfaces tracked on-site actions whose
 * titles aren't literal plan topics (e.g. a floor action "Publish keyword-targeted
 * pages …"): for those we draft from a minimal item built from the title + the
 * caller's `angle` (the action's `why`) rather than 404ing. Either way the draft is
 * a single, bounded, §11-scrubbed, review-required piece — never auto-published.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth/server";
import { activeAppId } from "@/lib/app/active-app";
import { serverDb } from "@/lib/db/client";
import { getSelectedCompetitors } from "@/lib/scan/competitor-selection";
import { gatherSynthesis, type ContentPlanItem } from "@/lib/scan/synthesis/synthesize";
import { generateContentDraft } from "@/lib/scan/synthesis/content-draft";

export const maxDuration = 240;

const Body = z.object({
  topic: z.string().trim().min(1).max(300),
  /** The action's rationale (`why`), used as the buyer angle for on-site actions
   *  that aren't literal synthesis plan topics. */
  angle: z.string().trim().max(600).optional(),
  regenerate: z.boolean().optional(),
});

/** Minimal content-plan item for a tracked on-site action that isn't in the
 *  synthesis plan — enough for the draft engine to write a grounded first draft. */
function fallbackItem(topic: string, angle?: string): ContentPlanItem {
  return {
    topic,
    targetKeywords: [],
    estMonthlyVolume: 0,
    intent: "informational",
    format: "article",
    depthTarget: "800–1,500 words",
    buyerAngle: angle ?? "",
    competitorExemplars: [],
    brief: "",
    agentPrompt: "",
    priority: "medium",
    evidence: "",
  };
}

export async function POST(req: NextRequest) {
  const viewer = await currentUser();
  if (!viewer) return NextResponse.json({ message: "authentication required" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "missing or invalid topic" }, { status: 400 });
  const { topic, angle, regenerate } = parsed.data;

  const appId = await activeAppId(viewer.user);
  if (!appId) return NextResponse.json({ message: "no active app" }, { status: 400 });

  const db = serverDb();
  const { data: appRow } = await db.from("apps").select("store_url").eq("id", appId).maybeSingle();
  const domain = (appRow?.store_url as string | null) ?? null;
  if (!domain) return NextResponse.json({ message: "no subject domain" }, { status: 400 });

  const competitors = await getSelectedCompetitors(appId);

  // Resolve the item server-side from the cached synthesis (instant on repeat).
  // A plan topic carries a rich brief + keywords; a tracked on-site action that
  // isn't a plan topic falls back to a minimal item built from title + angle, so
  // "Generate draft" always produces a draft instead of 404ing.
  let item: ContentPlanItem;
  try {
    const synthesis = await gatherSynthesis(domain, { competitorDomains: competitors });
    item = synthesis.contentPlan.find((c) => c.topic === topic) ?? fallbackItem(topic, angle);
  } catch {
    // Synthesis unavailable (cohort not selected / gather failed) — still draft
    // from the action's own title + angle rather than blocking the founder.
    item = fallbackItem(topic, angle);
  }

  // Reuse an existing open action for this topic; return its stored draft unless
  // the caller explicitly asked to regenerate (keeps repeat clicks free).
  const { data: existingRows, error: findErr } = await db
    .from("actions")
    .select("id, status, draft")
    .eq("app_id", appId)
    .eq("title", topic);
  if (findErr) return NextResponse.json({ message: "failed to check for existing action" }, { status: 500 });
  const openMatch = (existingRows ?? []).find((a) => a.status !== "done");

  if (openMatch && typeof openMatch.draft === "string" && openMatch.draft.length > 0 && !regenerate) {
    return NextResponse.json({ draft: openMatch.draft, requiresEdit: true, actionId: openMatch.id as string });
  }

  const { markdown } = await generateContentDraft(item);

  // Store on the action (update the open one, else create it) so the draft
  // travels into the worked queue — not just returned to this view.
  let actionId: string;
  if (openMatch) {
    const { error: updErr } = await db.from("actions").update({ draft: markdown }).eq("id", openMatch.id);
    if (updErr) return NextResponse.json({ message: "failed to store draft" }, { status: 500 });
    actionId = openMatch.id as string;
  } else {
    const { data: inserted, error: insErr } = await db
      .from("actions")
      .insert({
        app_id: appId,
        category: "content",
        title: topic,
        why: item.buyerAngle || null,
        status: "pending",
        draft: markdown,
        expected_outcome: null,
      })
      .select("id")
      .single();
    if (insErr || !inserted) return NextResponse.json({ message: "failed to store draft" }, { status: 500 });
    actionId = inserted.id as string;
  }

  return NextResponse.json({ draft: markdown, requiresEdit: true, actionId });
}
