import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, AuthError } from "@/lib/auth/server";
import { assertPaid, EntitlementError } from "@/lib/billing/entitlements";
import { activeAppId } from "@/lib/app/active-app";
import { costedIntelStep } from "@/lib/app/latest-scan";
import { serverDb } from "@/lib/db/client";
import { generateDraft, type Draft, type DraftPlatform } from "@/lib/scan/distribute/draft";
import { upsertDraftAction } from "@/lib/app/draft-action-store";

// Drafting is paid-only and on-demand (only what the user wants to post), so the
// scan never pre-generates drafts it doesn't need.
const Body = z.object({
  platform: z.string().min(1),
  productName: z.string().min(1),
  productDescription: z.string().optional(),
  angle: z.string().min(1),
  url: z.string().url().optional(),
  // Persistence context (owner 2026-07-27: a generated draft must ALWAYS be
  // retained). When a plan `title` is supplied the draft is stored on its
  // `actions` row (shared draft-action-persist path) so it survives a refresh or
  // a dropped mobile connection — exactly like a content draft. Omitted for the
  // daily X-post composer, whose drafts are keyed by date via /api/action.
  title: z.string().trim().min(1).max(300).optional(),
  why: z.string().max(2000).optional(),
  target: z
    .object({
      channel: z.enum(["community", "creator", "directory", "media", "podcast", "newsletter", "partner", "x"]),
      label: z.string().trim().min(1).max(300),
      url: z.string().url().max(2048).optional(),
    })
    .nullish(),
  verifyUrl: z.string().url().max(2048).optional(),
  effortMin: z.number().int().min(1).max(960).optional(),
  regenerate: z.boolean().optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  let userId: string;
  let viewer: Awaited<ReturnType<typeof requireUser>>;
  try {
    viewer = await requireUser();
    userId = viewer.user.id;
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "sign in required" }, { status: 401 });
    return NextResponse.json({ error: "auth error" }, { status: 500 });
  }
  try {
    await assertPaid(userId);
  } catch (e) {
    if (e instanceof EntitlementError) return NextResponse.json({ error: "upgrade required" }, { status: 403 });
    return NextResponse.json({ error: "entitlement error" }, { status: 500 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid request" }, { status: 400 });
  const body = parsed.data;

  const appId = await activeAppId(viewer.user);

  // Invariant #2: the LLM call is a paid step — run it under a cost context so the
  // spend bills the user's latest scan (rolls up to them), instead of writing an
  // unattributable `pipeline_runs.scan_id = NULL` row. Captured here so we can
  // return the generated text even if a later persist blip degrades (never lose it).
  let generated: Draft | undefined;
  const runGenerate = async (): Promise<string> => {
    const gen = () =>
      generateDraft({
        platform: body.platform as DraftPlatform,
        productName: body.productName,
        productDescription: body.productDescription,
        angle: body.angle,
        url: body.url,
      });
    generated = appId ? await costedIntelStep(appId, "distribute-draft", gen) : await gen();
    // The action row stores one string; keep any title (reddit/email) with the body.
    return [generated.title, generated.text].filter(Boolean).join("\n\n");
  };

  try {
    // Persist ONLY when we have both an app to attach to and a plan title to key
    // on — so the draft is retained (survives refresh / a dropped connection) and
    // repeat clicks reuse it for free (shared draft-action-persist path). Without
    // a title (the daily X-post composer) or an app, fall back to generate-only.
    if (appId && body.title) {
      try {
        const { draft, actionId } = await upsertDraftAction(
          serverDb(),
          appId,
          {
            title: body.title,
            category: "outreach",
            why: body.why ?? null,
            target: body.target ?? null,
            verifyUrl: body.verifyUrl ?? null,
            effortMin: body.effortMin ?? null,
            regenerate: body.regenerate,
          },
          runGenerate,
        );
        return NextResponse.json({ draft: generated ?? { text: draft }, actionId });
      } catch (persistErr) {
        // Generation may have succeeded and only the DB write failed — return the
        // draft so the founder still has it (degrade, never lose the content).
        if (generated) {
          console.error("[distribute/draft] persist failed, returning unsaved draft", persistErr);
          return NextResponse.json({ draft: generated });
        }
        throw persistErr;
      }
    }

    await runGenerate();
    return NextResponse.json({ draft: generated });
  } catch (e) {
    console.error("[distribute/draft] generation failed", e);
    return NextResponse.json({ error: "could not generate a draft — try again" }, { status: 500 });
  }
}
