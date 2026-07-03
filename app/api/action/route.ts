import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth/server";
import { activeAppId } from "@/lib/app/active-app";
import { serverDb } from "@/lib/db/client";
import type { Json } from "@/lib/db/types";

/**
 * /api/action — "Add to plan" backend. Lets the plan views (content /
 * distribution) turn a synthesized recommendation into a real, persisted
 * `actions` row without going through the weekly-refresh pipeline.
 *
 * Auth follows the intel-feed convention (`currentUser` + `activeAppId`, see
 * app/api/app/intel/route.ts) rather than the id-ownership check in
 * app/api/action/[id]/complete/route.ts, since there's no existing action id
 * to check ownership against here — everything is scoped to the caller's
 * active app.
 *
 * POST { title, category, why?, expectedDelta?, signalKeys? } → 200 { id, existing? }
 *   Creates an open `actions` row for the caller's active app. Dedupes on an
 *   OPEN (status !== "done") action with the same title for the app — returns
 *   the existing row's id with `existing: true` instead of duplicating.
 *   401 unauthed, 400 missing/invalid title or category.
 *
 * GET → 200 { actions: { id, title, category, status }[] }
 *   All actions for the caller's active app (no archived filter — the schema
 *   has none). 401 unauthed.
 */

const Body = z.object({
  title: z.string().trim().min(1),
  category: z.enum(["content", "outreach", "seo"]),
  why: z.string().optional(),
  expectedDelta: z.number().optional(),
  signalKeys: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  const viewer = await currentUser();
  if (!viewer) {
    return NextResponse.json({ message: "authentication required" }, { status: 401 });
  }

  const raw = await req.json().catch(() => null);
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ message: "missing or invalid title/category" }, { status: 400 });
  }
  const { title, category, why, expectedDelta, signalKeys } = parsed.data;

  const appId = await activeAppId(viewer.user);
  if (!appId) {
    return NextResponse.json({ message: "no active app" }, { status: 400 });
  }

  const db = serverDb();

  // Dedupe: an OPEN (status !== "done") action with the same title already
  // exists for this app → return it instead of inserting a duplicate.
  const { data: existingRows, error: findErr } = await db
    .from("actions")
    .select("id, status")
    .eq("app_id", appId)
    .eq("title", title);
  if (findErr) {
    return NextResponse.json({ message: "failed to check for existing action" }, { status: 500 });
  }
  const openMatch = (existingRows ?? []).find((a) => a.status !== "done");
  if (openMatch) {
    return NextResponse.json({ id: openMatch.id as string, existing: true });
  }

  const { data: inserted, error: insErr } = await db
    .from("actions")
    .insert({
      app_id: appId,
      category,
      title,
      why: why ?? null,
      status: "open",
      signal_keys: signalKeys ?? [],
      expected_outcome: (expectedDelta !== undefined ? { delta: expectedDelta } : null) as Json | null,
    })
    .select("id")
    .single();
  if (insErr || !inserted) {
    return NextResponse.json({ message: "failed to create action" }, { status: 500 });
  }

  return NextResponse.json({ id: inserted.id as string });
}

export async function GET() {
  const viewer = await currentUser();
  if (!viewer) {
    return NextResponse.json({ message: "authentication required" }, { status: 401 });
  }

  const appId = await activeAppId(viewer.user);
  if (!appId) {
    return NextResponse.json({ actions: [] });
  }

  const db = serverDb();
  const { data, error } = await db
    .from("actions")
    .select("id, title, category, status")
    .eq("app_id", appId);
  if (error) {
    return NextResponse.json({ message: "failed to load actions" }, { status: 500 });
  }

  return NextResponse.json({
    actions: (data ?? []).map((a) => ({
      id: a.id as string,
      title: a.title as string,
      category: a.category as string,
      status: a.status as string,
    })),
  });
}
