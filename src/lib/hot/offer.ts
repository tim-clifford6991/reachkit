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
import { opportunityStore } from "@/lib/opportunities/store";
import { claimOpsEvent } from "@/lib/ops/events";
import { angleFor } from "./angle";
import { readHotEvents } from "./detect";

/** Offers the week's events as topics; how many it added. Never throws: the week is judged either way. */
export async function offerHotTopics(a: { siteId: string; scanId: string; now: Date }): Promise<number> {
  try {
    const store = opportunityStore(), day = a.now.toISOString().slice(0, 10);
    const events = await readHotEvents(a.siteId, day);
    if (events.length === 0) return 0;
    const [report, held, locale] = await Promise.all([store.currentReport(a.siteId), store.marketFor(a.siteId), siteLocale(a.siteId)]);
    if (report === null) return 0;
    const profile = report.market.kind === "unmeasured" ? null : report.market.value.profile;
    return await withCostContext({ scanId: a.scanId, cap: "WEEK_NEWS", policyVersion: DRAFT_POLICY_VERSION, rollUp: "none", activity: "weekly" }, async (c) => {
      let added = 0;
      for (const event of events) {
        if (c.capHit() || !(await claimOpsEvent("hot_topic", a.siteId, event.key, JSON.stringify({ day, signal: event.signal, at: a.now.toISOString() })))) continue;
        const angle = await angleFor(c, { event, locale, market: held.market, profile, domain: report.domain, knowledge: held.knowledge ?? null });
        const reason = { signal: event.signal, event: event.event, date: event.date, a: event.a, b: event.b, key: event.key, detectedOn: day };
        const inserted = angle === null ? null : await store.insert({
          site_id: a.siteId, scan_id: report.scanId, type: "keyword_page", family: "write", target_query: angle.search, target_ref: slugify(angle.search, measuredLocale(report).language), proposed_slug: null, title: angle.title, volume: null,
          evidence: { family: "write", query: angle.search, volume: unmeasured<number>("not_attempted", a.now), rival: null, fitFact: angle.fact, angle: angle.angle, hot: { claims: event.claims, reason, changes: angle.changes } },
          acceptance: { form: "top20", query: angle.search }, fit_band: "reach", business_fit: angle.fit, source: "category", effort: EFFORT_BY_TYPE.keyword_page,
        });
        if (inserted?.outcome === "created") added++;
        console.log(JSON.stringify({ event: "hot_topic_judged", siteId: a.siteId, day, signal: event.signal, result: angle === null ? "no_angle" : (inserted?.outcome ?? "none"), fit: angle?.fit ?? null }));
      }
      return added;
    });
  } catch (error) {
    console.log(JSON.stringify({ event: "hot_topic_failed", siteId: a.siteId, because: error instanceof Error ? error.message : String(error) }));
    return 0;
  }
}
