// BUILD §4.3: the release notice, one sentence projected from the current report and the newest day's kept reason, never a stored flag.
// Derived each time, so it stops once a later pass makes a complete report current, with nothing to clear.
// It states what could not be measured; a complete report with zero opportunities yields `null`.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CopyKey } from "@/lib/presentation/copy";
import { marketTooSmall, stoppedOnCeiling } from "../market-floor";
import { readCurrentReport } from "../report";
import type { StoredReport } from "../report";

export interface ReleaseNotice {
  key: CopyKey;
  vars: Record<string, string>;
  /** Unmeasured parts as internal handles, carried as data: composing them into a phrase is the copy's job, not this file's. */
  parts: readonly string[];
}

/** The parts a founder is told about by name, in run order: only sections a degraded pass can leave unmeasured.
 *  `kind === "unmeasured"`, never `!== "measured"`: a `zero` section is a measurement whose answer was nothing. */
const NAMED_PARTS: readonly { readonly part: string; readonly missing: (r: StoredReport) => boolean }[] =
  Object.freeze([
    { part: "market", missing: (r) => r.market.kind === "unmeasured" },
    { part: "questions", missing: (r) => r.questions.kind === "unmeasured" },
    { part: "answers", missing: (r) => r.aiAnswers === null },
    { part: "presence", missing: (r) => r.presence === null },
    { part: "rivals", missing: (r) => r.rivals.kind === "unmeasured" },
  ]);

/** Which named parts this report did not measure, as internal handles —
 *  never words a founder reads. The sentence that names them is the
 *  owner's, and it receives them through a slot. */
export function unmeasuredParts(report: StoredReport): readonly string[] {
  return NAMED_PARTS.filter((p) => p.missing(report)).map((p) => p.part);
}

/** The reason the site's newest recorded day kept, or `null`; a read that fails claims nothing. */
async function newestDayReason(siteId: string): Promise<string | null> {
  const { dbAdmin } = await import("@/lib/db");
  const { data, error } = await (dbAdmin() as unknown as SupabaseClient).from("draft_days").select("reason").eq("site_id", siteId).order("publish_date", { ascending: false }).limit(1);
  if (error !== null) console.warn(JSON.stringify({ event: "release_notice_day_unread", error: error.message }));
  return (data?.[0] as { reason?: string | null } | undefined)?.reason ?? null;
}

/** Whether a kept reason shows the site itself short of facts: no passage at all, or a pack with too few. A topic whose
 *  words the site's facts miss is the planner's, and a bare reason from before the path was named proves neither. */
function siteLacksFacts(kept: string | null): boolean {
  // What the update fallback adds after `;` says nothing about the facts.
  const reason = kept?.split(";")[0] ?? null;
  if (reason === "generate:no_own_facts:grounding") return true;
  const needs = reason?.startsWith("generate:no_own_facts:pack:") === true ? reason.slice("generate:no_own_facts:pack:".length).split(",") : [];
  return needs.includes("facts_few");
}

/**
 * The one sentence that travels with the founder into the app, or `null`
 * when there is nothing to say.
 *
 * Three arms:
 *   - no current report at all → the measurement did not complete
 *   - a report that stopped short of complete → what could not be
 *     measured, with the unmeasured parts carried alongside
 *   - a complete report → `null`, however empty its findings are
 */
export async function releaseNotice(a: { domain: string; siteId?: string }): Promise<ReleaseNotice | null> {
  const report = await readCurrentReport(a.domain);

  if (report === null || report.stoppedReason === "failed") {
    return { key: "setup.release.incomplete", vars: {}, parts: [] };
  }

  // A ceiling stopped the pass before it finished reading the market: it is being measured again, never blamed on the category.
  if (stoppedOnCeiling(report.stoppedReason)) {
    return { key: "setup.release.measuring", vars: {}, parts: unmeasuredParts(report) };
  }

  // The market was read and was too small to plan a page from: its own sentence, not a measurement failure.
  if (marketTooSmall(report.questions)) {
    return { key: "setup.release.market-too-small", vars: {}, parts: [] };
  }

  // The newest day could write no page even from the site's own facts, so the founder is told what would let it.
  if (a.siteId !== undefined && siteLacksFacts(await newestDayReason(a.siteId))) {
    return { key: "setup.release.own-facts", vars: {}, parts: [] };
  }

  if (report.complete && report.stoppedReason === "complete") return null;

  return {
    key: "setup.release.unmeasured",
    vars: {},
    parts: unmeasuredParts(report),
  };
}
