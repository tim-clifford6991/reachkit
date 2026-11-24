// SPEC §7 *A page for what is new in the market*: on Monday, each event the week's stored market changes hold becomes a
// topic of its best angle, ranked with every other (`timely`, `rank/points.ts`), with no count but the week. Each event
// is claimed before any spend, so a rerun judges nothing twice; the judgements share one room the size of the news read's.
import { EFFORT_BY_TYPE } from "@/lib/config/constants";
import { withCostContext } from "@/lib/costs";
import { DRAFT_POLICY_VERSION } from "@/lib/generate/cost";
import { siteLocale } from "@/lib/locale/site";
import { measuredLocale } from "@/lib/locale/locales";
import { unmeasured } from "@/lib/measure/measured";
import { slugify } from "@/lib/opportunities/derive/candidate";
import { type OpportunityInsert, opportunityStore } from "@/lib/opportunities/store";
import { claimOpsEvent, opsEventHeld, releaseOpsEvent } from "@/lib/ops/events";
import { type HotAngle, angleFor } from "./angle";
import { type HotEvent, type HotReason, readHotEvents } from "./detect";

/** The ops row a pass holds when one of its topics could not be stored, keyed by its scan. */
export const HOT_FAILED = "hot_topic_failed";

/** Whether the pass could not store one of its topics, so it is not reported done. */
export const topicUnstored = async (siteId: string, scanId: string | null): Promise<boolean> => scanId !== null && (await opsEventHeld(HOT_FAILED, siteId, scanId));

/** The topic an event's angle becomes; a write row publishes under its ref, as `insertFor` proposes it. */
export function hotRow(a: { siteId: string; scanId: string; language: string; angle: HotAngle; event: Pick<HotEvent, "claims">; reason: HotReason; now: Date }): OpportunityInsert {
  const { angle } = a, ref = slugify(angle.search, a.language);
  return {
    site_id: a.siteId, scan_id: a.scanId, type: "keyword_page", family: "write", target_query: angle.search, target_ref: ref, proposed_slug: ref, title: angle.title, volume: null,
    evidence: { family: "write", query: angle.search, volume: unmeasured<number>("not_attempted", a.now), rival: null, fitFact: angle.fact, angle: angle.angle, hot: { claims: a.event.claims, reason: a.reason, changes: angle.changes } },
    acceptance: { form: "top20", query: angle.search }, fit_band: "reach", business_fit: angle.fit, source: "category", effort: EFFORT_BY_TYPE.keyword_page,
  };
}

/** Offers the week's events as topics; how many it added. Never throws: the week is judged either way. */
export async function offerHotTopics(a: { siteId: string; scanId: string; now: Date }): Promise<number> {
  try {
    const store = opportunityStore(), day = a.now.toISOString().slice(0, 10);
    const events = await readHotEvents(a.siteId, day);
    if (events.length === 0) return 0;
    const context = () => Promise.all([store.currentReport(a.siteId), store.marketFor(a.siteId), siteLocale(a.siteId)] as const);
    let read: ReturnType<typeof context> | undefined;
    return await withCostContext({ scanId: a.scanId, cap: "WEEK", policyVersion: DRAFT_POLICY_VERSION, rollUp: "none", activity: "weekly" }, async (c) => {
      let added = 0;
      for (const event of events) {
        if (c.capHit() || !(await claimOpsEvent("hot_topic", a.siteId, event.key, JSON.stringify({ day, signal: event.signal, at: a.now.toISOString() })))) continue;
        // Read once, and only for an event this run claimed.
        const [report, held, locale] = await (read ??= context());
        if (report === null) break;
        const profile = report.market.kind === "unmeasured" ? null : report.market.value.profile;
        const judged = await angleFor(c, { event, locale, market: held.market, profile, domain: report.domain, knowledge: held.knowledge ?? null });
        const angle = "miss" in judged ? null : judged;
        const reason = { signal: event.signal, event: event.event, date: event.date, a: event.a, b: event.b, key: event.key, detectedOn: day };
        console.log(JSON.stringify({ event: "hot_topic_judged", siteId: a.siteId, day, signal: event.signal, result: angle === null ? "no_angle" : "angle", fit: angle?.fit ?? null, title: angle?.title ?? null, search: angle?.search ?? null, reason, ...("miss" in judged ? { miss: judged.miss } : {}), angles: judged.angles }));
        if (angle === null) continue;
        try {
          const inserted = await store.insert(hotRow({ siteId: a.siteId, scanId: report.scanId, language: measuredLocale(report).language, angle, event, reason, now: a.now }));
          if (inserted.outcome === "created") added++;
          console.log(JSON.stringify({ event: "hot_topic_offered", siteId: a.siteId, key: event.key, result: inserted.outcome }));
        } catch (error) {
          const because = error instanceof Error ? error.message : String(error);
          console.warn(JSON.stringify({ event: "hot_topic_offered", siteId: a.siteId, key: event.key, result: "failed", because }));
          // Released so a later run judges this news again, and held against the scan so its pass is not reported done.
          await releaseOpsEvent("hot_topic", a.siteId, event.key);
          await claimOpsEvent(HOT_FAILED, a.siteId, a.scanId, JSON.stringify({ key: event.key, because: because.slice(0, 300) }));
        }
      }
      return added;
    });
  } catch (error) {
    console.warn(JSON.stringify({ event: "hot_topic_failed", siteId: a.siteId, because: error instanceof Error ? error.message : String(error) }));
    return 0;
  }
}
