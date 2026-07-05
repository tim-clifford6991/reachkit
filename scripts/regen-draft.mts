/**
 * One-off: regenerate a stored content draft that was truncated by the old
 * token caps (pre-b8810de). Reuses the real pipeline — cached synthesis for
 * the app's cohort → the new continuation-aware generateContentDraft → update
 * the action row. Run:
 *   npx tsx --env-file=.env.local scripts/regen-draft.mts <actionId>
 */
import { serverDb } from "../lib/db/client";
import { getSelectedCompetitors } from "../lib/scan/competitor-selection";
import { gatherSynthesis } from "../lib/scan/synthesis/synthesize";
import { generateContentDraft } from "../lib/scan/synthesis/content-draft";

const actionId = process.argv[2];
if (!actionId) throw new Error("usage: regen-draft.mts <actionId>");

const db = serverDb();
const { data: action, error } = await db
  .from("actions")
  .select("id, app_id, title, draft")
  .eq("id", actionId)
  .single();
if (error || !action) throw new Error(`action not found: ${error?.message}`);

const { data: app } = await db.from("apps").select("store_url").eq("id", action.app_id).single();
if (!app?.store_url) throw new Error("app has no store_url");

console.log(`[regen] "${action.title}" for ${app.store_url}`);
console.log(`[regen] old draft: ${action.draft?.length ?? 0} chars, tail: …${(action.draft ?? "").slice(-50)}`);

const competitors = await getSelectedCompetitors(action.app_id);
const synthesis = await gatherSynthesis(app.store_url, { competitorDomains: competitors });
const item = synthesis.contentPlan.find((c) => c.topic === action.title);
if (!item) throw new Error(`topic not in content plan: ${action.title}`);

const { markdown } = await generateContentDraft(item);
console.log(`[regen] new draft: ${markdown.length} chars, tail: …${markdown.slice(-120)}`);

const { error: updErr } = await db
  .from("actions")
  .update({ draft: markdown, draft_requires_edit: true })
  .eq("id", action.id);
if (updErr) throw new Error(`update failed: ${updErr.message}`);
console.log("[regen] stored ✓");
