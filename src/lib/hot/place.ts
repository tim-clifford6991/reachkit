// SPEC §7 *A page for what is new in the market*: on the day a date is written, an event that passes the angle and fit
// gates takes that date. The planned pages from it move a day each, and one pushed out of the week leads the spares.
// Each event is claimed before any spend, so a rerun judges and displaces nothing twice.
import { revalidateTag } from "next/cache";
import { EFFORT_BY_TYPE } from "@/lib/config/constants";
import { dbAdmin } from "@/lib/db";
import { openDayCost } from "@/lib/generate/cost";
import { siteLocale } from "@/lib/locale/site";
import { measuredLocale } from "@/lib/locale/locales";
import { unmeasured } from "@/lib/measure/measured";
import { slugify } from "@/lib/opportunities/derive/candidate";
import { assessReadiness } from "@/lib/opportunities/readiness";
import { POINTS } from "@/lib/opportunities/rank/points";
import { opportunityStore, supplyTag, type OpportunityRow } from "@/lib/opportunities/store";
import type { PlanReason } from "@/lib/opportunities/types";
import { claimOpsEvent } from "@/lib/ops/events";
import { weekStartFor } from "@/lib/scan/weekly/week";
import { angleFor } from "./angle";
import type { HotEvent } from "./detect";

const DAY_MS = 86_400_000;
const dayAfter = (day: string, n = 1): string => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

/** Where each planned page goes when a hot page takes `date`: a later open day, or `null` for the top of the spares. */
export interface Move {
  id: string;
  from: string;
  to: string | null;
}

/** The moves a hot page on `date` makes, or `null` where it may not take `date`: a page is written on it, the customer
 *  stopped it, or a fix holds it. Written and fix-held days are stepped over; a page ends its chain at an open day. Pure. */
export function movesFor(rows: readonly Pick<OpportunityRow, "id" | "planned_for" | "status" | "family">[], a: { date: string; written: ReadonlySet<string> }): Move[] | null {
  const end = dayAfter(weekStartFor({ at: new Date(`${a.date}T00:00:00Z`), zone: "UTC" }), 6);
  const held = new Set([...a.written, ...rows.filter((row) => row.family === "fix" && row.planned_for != null).map((row) => row.planned_for!)]);
  if (held.has(a.date) || rows.some((row) => row.planned_for === a.date && row.status !== "open")) return null;
  const on = new Map(rows.filter((row) => row.status === "open" && row.family !== "fix" && row.planned_for != null).map((row) => [row.planned_for!, row]));
  const moves: Move[] = [];
  let carried = on.get(a.date);
  for (let day = dayAfter(a.date); carried !== undefined && day <= end; day = dayAfter(day)) {
    if (held.has(day)) continue;
    moves.push({ id: carried.id, from: carried.planned_for!, to: day });
    carried = on.get(day);
  }
  if (carried !== undefined) moves.push({ id: carried.id, from: carried.planned_for!, to: null });
  return moves;
}

/** Places the day's hot page on `date` where one passes; `true` where it did. Never throws: the day is written either way. */
export async function placeHotPage(siteId: string, date: string, now: Date): Promise<boolean> {
  try {
    const events = (await opportunityStore().hotEvents?.(siteId, date)) ?? [];
    // One judgement a date at most, claimed first, and never a second of one event.
    if (events.length === 0 || !(await claimOpsEvent("hot_day", siteId, date, now.toISOString()))) return false;
    for (const event of events) {
      if (await claimOpsEvent("hot_topic", siteId, event.key, JSON.stringify({ day: date, signal: event.signal, at: now.toISOString() }))) return await place(siteId, date, now, event);
    }
    return false;
  } catch (error) {
    console.log(JSON.stringify({ event: "hot_page_failed", siteId, date, because: error instanceof Error ? error.message : String(error) }));
    return false;
  }
}

async function place(siteId: string, date: string, now: Date, event: HotEvent): Promise<boolean> {
  const store = opportunityStore();
  const [rows, pages, report, held, locale] = await Promise.all([store.plannedRows(siteId), store.draftedPages(siteId, 14), store.currentReport(siteId), store.marketFor(siteId), siteLocale(siteId)]);
  const moves = movesFor(rows, { date, written: new Set(pages.map((page) => page.date)) });
  if (moves === null || report === null) return outcome(siteId, date, event, "no_date");
  const profile = report.market.kind === "unmeasured" ? null : report.market.value.profile;
  // The day's own cap: this spend is the day's, so the page that follows has the rest.
  const angle = await openDayCost({ scanId: report.scanId, siteId, since: now }, (c) =>
    angleFor(c, { event, locale, market: held.market, profile, domain: report.domain, knowledge: held.knowledge ?? null })
  );
  if (angle === null) return outcome(siteId, date, event, "no_angle");

  const evidence = { family: "write" as const, query: angle.search, volume: unmeasured<number>("not_attempted", now), rival: null, fitFact: angle.fact, angle: angle.angle, hot: { claims: event.claims } };
  const inserted = await store.insert({
    site_id: siteId, scan_id: report.scanId, type: "keyword_page", family: "write", target_query: angle.search, target_ref: slugify(angle.search, measuredLocale(report).language),
    proposed_slug: null, title: angle.title, volume: null, evidence, acceptance: { form: "top20", query: angle.search }, fit_band: "reach", business_fit: 3, source: "category", effort: EFFORT_BY_TYPE.keyword_page,
  });
  if (inserted.outcome !== "created") return outcome(siteId, date, event, "duplicate");
  await assessReadiness(siteId, { at: now, now, only: new Set([inserted.row.id]) });
  if ((await store.byId(inserted.row.id))?.ready !== true) return outcome(siteId, date, event, "not_ready");

  const byId = new Map(rows.map((row) => [row.id, row]));
  const write = (id: string, set: { planned_for: string | null; plan_place: number; plan_reason: PlanReason }) =>
    dbAdmin().from("opportunities").update({ ...set, plan_reason: JSON.parse(JSON.stringify(set.plan_reason)) }).eq("id", id).then(({ error }) => {
      if (error) throw new Error(`hot: could not move a planned page: ${error.message}`);
    });
  const movedOut: { search: string; day: string }[] = [];
  // Last first, so no two pages are ever on one date.
  for (const move of [...moves].reverse()) {
    const row = byId.get(move.id)!, reason = row.plan_reason ?? { points: 0, parts: [], rule: null };
    if (move.to === null) movedOut.push({ search: row.target_query ?? "", day: move.from });
    await write(move.id, move.to === null
      ? { planned_for: null, plan_place: 0, plan_reason: { ...reason, moved: undefined } }
      : { planned_for: move.to, plan_place: row.plan_place ?? 0, plan_reason: { ...reason, moved: { from: reason.moved?.from ?? move.from, search: angle.search } } });
  }
  const hot = { signal: event.signal, event: event.event, date: event.date, a: event.a, b: event.b, detectedOn: date, key: event.key };
  await write(inserted.row.id, {
    planned_for: date,
    plan_place: rows.find((row) => row.planned_for === date)?.plan_place ?? 0,
    plan_reason: { points: 0, parts: [{ part: "rising", n: POINTS.rising }], rule: null, hot, ...(movedOut.length === 0 ? {} : { movedOut }) },
  });
  try {
    revalidateTag(supplyTag(siteId), { expire: 0 });
  } catch {}
  console.log(JSON.stringify({ event: "hot_page_placed", siteId, date, signal: event.signal, moved: moves.length }));
  return outcome(siteId, date, event, "placed", true);
}

function outcome(siteId: string, date: string, event: HotEvent, result: string, placed = false): boolean {
  console.log(JSON.stringify({ event: "hot_page_judged", siteId, date, signal: event.signal, result }));
  return placed;
}
