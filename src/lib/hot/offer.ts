// SPEC §7 *A page for what is new in the market*: on Monday, each event the week's stored market changes hold becomes a
// topic of its best angle, ranked with every other (`timely`, `rank/points.ts`), with no count but the week. Each event
// is claimed before any spend, so a rerun judges nothing twice; the judgements share one room the size of the news read's.
import { EFFORT_BY_TYPE } from "@/lib/config/constants";
import { withCostContext } from "@/lib/costs";
import { dbAdmin } from "@/lib/db";
import { DRAFT_POLICY_VERSION } from "@/lib/generate/cost";
import { siteLocale } from "@/lib/locale/site";
import { type Language, measuredLocale } from "@/lib/locale/locales";
import { unmeasured } from "@/lib/measure/measured";
import { slugify } from "@/lib/opportunities/derive/candidate";
import { type OpportunityInsert, opportunityStore } from "@/lib/opportunities/store";
import { claimOpsEvent, opsEventHeld, opsEventRead, opsEventsOf, releaseOpsEvent, replaceOpsEvent } from "@/lib/ops/events";
import { MARKET_PASS, type StoryOutcome } from "@/lib/scan/weekly/market-changes";
import { type AngleRead, type HotAngle, angleFor } from "./angle";
import { type HotEvent, type HotReason, readHotEvents } from "./detect";

/** The ops row a pass holds when one of its topics could not be stored, keyed by its scan. */
export const HOT_FAILED = "hot_topic_failed";

/** Whether the pass could not store one of its topics, so it is not reported done. */
export const topicUnstored = async (siteId: string, scanId: string | null): Promise<boolean> => scanId !== null && (await opsEventHeld(HOT_FAILED, siteId, scanId));

/** The topic an event's angle becomes; a write row publishes under its ref, as `insertFor` proposes it. */
export function hotRow(a: { siteId: string; scanId: string; language: Language; angle: HotAngle; event: Pick<HotEvent, "claims" | "weak">; reason: HotReason; now: Date }): OpportunityInsert {
  const { angle } = a, ref = slugify(angle.search, a.language);
  return {
    site_id: a.siteId, scan_id: a.scanId, type: "keyword_page", family: "write", target_query: angle.search, target_ref: ref, proposed_slug: ref, title: angle.title, volume: null,
    evidence: { family: "write", query: angle.search, volume: unmeasured<number>("not_attempted", a.now), rival: null, fitFact: angle.fact, angle: angle.angle, hot: { claims: a.event.claims, reason: a.reason, changes: angle.changes, ...(a.event.weak === undefined ? {} : { weak: a.event.weak }) } },
    acceptance: { form: "top20", query: angle.search }, fit_band: "reach", business_fit: angle.fit, source: "category", effort: EFFORT_BY_TYPE.keyword_page,
  };
}

type Claim = { day?: string; at?: string; outcome?: string };
const claimOf = (read: string): Claim => { try { return JSON.parse(read) as Claim; } catch { return {}; } };

/** Releases each claim an earlier pass made that neither stored its topic nor recorded what became of it, so its news is
 *  judged again; the claims still held, by key. */
export async function releaseUnlanded(siteId: string, now: Date): Promise<Map<string, Claim>> {
  const held = new Map((await opsEventsOf("hot_topic", siteId)).map((row) => [row.code, claimOf(row.read)]));
  const open = [...held].filter(([, claim]) => claim.outcome === undefined && typeof claim.at === "string" && claim.at < now.toISOString()).map(([key]) => key);
  if (open.length === 0) return held;
  const rows = await dbAdmin().from("opportunities").select("key:evidence->hot->reason->>key").eq("site_id", siteId).in("evidence->hot->reason->>key", open);
  if (rows.error !== null) throw new Error(`hot: could not read the stored topics: ${rows.error.message}`);
  const landed = new Set(((rows.data ?? []) as unknown as { key: string }[]).map((row) => row.key));
  for (const key of open.filter((key) => !landed.has(key))) {
    await releaseOpsEvent("hot_topic", siteId, key);
    held.delete(key);
    console.log(JSON.stringify({ event: "hot_topic_released", siteId, key }));
  }
  return held;
}

/** What became of one event, and for one it judged, the angle and title it got and every angle read. */
type HotOutcome = { key: string; outcome: string; on?: string; search?: string | null; title?: string | null; angles?: AngleRead[] };

/** Offers the week's events as topics; how many it added. Never throws: the week is judged either way. */
export async function offerHotTopics(a: { siteId: string; scanId: string; now: Date }): Promise<number> {
  const outcomes: HotOutcome[] = [];
  let added = 0, broke = false;
  try {
    const store = opportunityStore(), day = a.now.toISOString().slice(0, 10);
    const held = await releaseUnlanded(a.siteId, a.now);
    const events = await readHotEvents(a.siteId, day);
    const context = () => Promise.all([store.currentReport(a.siteId), store.marketFor(a.siteId, { quoted: true }), siteLocale(a.siteId)] as const);
    let read: ReturnType<typeof context> | undefined;
    if (events.length > 0) await withCostContext({ scanId: a.scanId, cap: "WEEK", policyVersion: DRAFT_POLICY_VERSION, rollUp: "none", activity: "weekly" }, async (c) => {
      for (const event of events) {
        const claim = { day, signal: event.signal, at: a.now.toISOString() }, told = (outcome: string, on?: string, judged?: Pick<HotOutcome, "search" | "title" | "angles">) => outcomes.push({ key: event.key, outcome, ...(on === undefined ? {} : { on }), ...judged });
        if (c.capHit()) { told("cap"); continue; }
        if (!(await claimOpsEvent("hot_topic", a.siteId, event.key, JSON.stringify(claim)))) { told("claimed", held.get(event.key)?.day); continue; }
        // Read once, and only for an event this run claimed.
        const [report, quoted, locale] = await (read ??= context());
        if (report === null) { told("no_report"); break; }
        const profile = report.market.kind === "unmeasured" ? null : report.market.value.profile;
        const judged = await angleFor(c, { event, locale, market: quoted.market, profile, domain: report.domain, knowledge: quoted.knowledge ?? null });
        const angle = "miss" in judged ? null : judged;
        const reason = { signal: event.signal, event: event.event, date: event.date, a: event.a, b: event.b, key: event.key, detectedOn: day };
        console.log(JSON.stringify({ event: "hot_topic_judged", siteId: a.siteId, day, signal: event.signal, result: angle === null ? "no_angle" : "angle", fit: angle?.fit ?? null, title: angle?.title ?? null, search: angle?.search ?? null, reason, ...("miss" in judged ? { miss: judged.miss } : {}), angles: judged.angles }));
        let outcome = "miss" in judged ? `no_angle:${judged.miss}` : "offered";
        const audit = { search: angle?.search ?? null, title: angle?.title ?? null, angles: judged.angles };
        if (angle !== null) {
          try {
            const inserted = await store.insert(hotRow({ siteId: a.siteId, scanId: report.scanId, language: measuredLocale(report).language, angle, event, reason, now: a.now }));
            if (inserted.outcome === "created") added++;
            else outcome = "duplicate";
            console.log(JSON.stringify({ event: "hot_topic_offered", siteId: a.siteId, key: event.key, result: inserted.outcome }));
          } catch (error) {
            const because = error instanceof Error ? error.message : String(error);
            console.warn(JSON.stringify({ event: "hot_topic_offered", siteId: a.siteId, key: event.key, result: "failed", because }));
            // Released so a later run judges this news again, and held against the scan so its pass is not reported done.
            await releaseOpsEvent("hot_topic", a.siteId, event.key);
            await claimOpsEvent(HOT_FAILED, a.siteId, a.scanId, JSON.stringify({ key: event.key, because: because.slice(0, 300) }));
            told("failed", undefined, audit);
            continue;
          }
        }
        told(outcome, undefined, audit);
        // The claim says what became of it, so no later pass takes it for one whose row never landed.
        await replaceOpsEvent("hot_topic", a.siteId, event.key, JSON.stringify({ ...claim, outcome }));
      }
    });
  } catch (error) {
    broke = true;
    console.warn(JSON.stringify({ event: "hot_topic_failed", siteId: a.siteId, because: error instanceof Error ? error.message : String(error) }));
  }
  await tellHot(a, outcomes, broke);
  return added;
}

/** The pass's row gains each event's outcome, and the owner's digest one line: what was offered, or why nothing was. Never throws. */
async function tellHot(a: { siteId: string; scanId: string }, outcomes: readonly HotOutcome[], broke: boolean): Promise<void> {
  try {
    const pass = JSON.parse((await opsEventRead(MARKET_PASS, a.siteId, a.scanId)) ?? "{}") as { stories?: StoryOutcome[] };
    await replaceOpsEvent(MARKET_PASS, a.siteId, a.scanId, JSON.stringify({ ...pass, events: outcomes }));
    const offered = outcomes.flatMap((o) => (o.outcome === "offered" ? [o.title ?? o.search ?? o.key] : [])), tally = new Map<string, number>();
    for (const outcome of [...(pass.stories ?? []).filter((s) => s.outcome !== "change"), ...outcomes].map((o) => o.outcome)) tally.set(outcome, (tally.get(outcome) ?? 0) + 1);
    const because = broke ? "the hot step failed" : offered.length > 0 ? null : pass.stories === undefined ? "no news read this pass" : [...tally].map(([outcome, n]) => `${n} ${outcome}`).join(", ") || "no story in the news";
    await (await import("@/lib/mail/ops/incident")).reportIncident({ occasion: "hot", stories: pass.stories?.length ?? null, events: outcomes.length, offered, because });
  } catch (error) {
    console.warn(JSON.stringify({ event: "hot_told_failed", siteId: a.siteId, because: error instanceof Error ? error.message : String(error) }));
  }
}
