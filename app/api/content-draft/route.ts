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
 * POST { topic, regenerate? } → 200 { draft, requiresEdit: true, actionId }
 *   401 unauthed · 400 no active app / domain / missing topic · 404 unknown topic.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth/server";
import { activeAppId } from "@/lib/app/active-app";
import { serverDb } from "@/lib/db/client";
import { getSelectedCompetitors } from "@/lib/scan/competitor-selection";
import { gatherSynthesis } from "@/lib/scan/synthesis/synthesize";
import { generateContentDraft } from "@/lib/scan/synthesis/content-draft";

export const maxDuration = 240;

const Body = z.object({
  topic: z.string().trim().min(1).max(300),
  regenerate: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const viewer = await currentUser();
  if (!viewer) return NextResponse.json({ message: "authentication required" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "missing or invalid topic" }, { status: 400 });
  const { topic, regenerate } = parsed.data;

  const appId = await activeAppId(viewer.user);
  if (!appId) return NextResponse.json({ message: "no active app" }, { status: 400 });

  const db = serverDb();
  const { data: appRow } = await db.from("apps").select("store_url").eq("id", appId).maybeSingle();
  const domain = (appRow?.store_url as string | null) ?? null;
  if (!domain) return NextResponse.json({ message: "no subject domain" }, { status: 400 });

  const competitors = await getSelectedCompetitors(appId);

  // Resolve the item server-side from the cached synthesis (instant on repeat).
  let item;
  try {
    const synthesis = await gatherSynthesis(domain, { competitorDomains: competitors });
    item = synthesis.contentPlan.find((c) => c.topic === topic);
  } catch (e) {
    return NextResponse.json({ message: e instanceof Error ? e.message : "failed to load plan" }, { status: 500 });
  }
  if (!item) return NextResponse.json({ message: "unknown topic" }, { status: 404 });

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
