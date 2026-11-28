// SPEC §7 *Every day has new or updated content* (owner, 2026-11-05, 2026-11-17 and 2026-11-18) — a day whose topics
// and spares ended without a page takes, in the same run, the writer's update of the live page furthest below the
// standard, kept only where it adds real substance. A short pack writes its own planned page, so no topic is written
// anyway here.
import { z } from "zod";
import { RESEARCH, SITE_PROFILE, TITLE } from "@/lib/config/constants";
import { googleRead, readingOf } from "@/lib/measure/page-reading";
import { siteLocale } from "@/lib/locale/site";
import { opportunityById, type Opportunity } from "@/lib/opportunities";
import { pastRefreshFloor } from "@/lib/opportunities/derive/known";
import { addressKey, persistAssessed, refreshOfPage, stoppedRefreshes, type OwnLivePage } from "@/lib/opportunities/refresh";
import { opportunityStore, readOpportunity } from "@/lib/opportunities/store";
import { isResting } from "@/lib/opportunities/types";
import { serpOrganic } from "@/lib/vendors/dataforseo/serp";
import type { CostContext } from "@/lib/costs";
import type { StoredReport } from "@/lib/scan/report";
import type { DayPageOutcome } from ".";
import { openDayCost, roomForFix } from "./cost";
import { targetSearches } from "./pipeline";
import { siteRulesOf } from "./pipeline/battery";
import { fold, rivalsOnlyVersus, type ContextPack } from "./pipeline/pack";
import { fetchBody, researchSerps } from "./pipeline/research";
import { writingMarket } from "./voice/market";
import { checkStoredAt0, siteSets, type RecheckOutcome } from "./recheck";
import { readRecordedRules, stops } from "./record";
import { mendedInCode, repairStructure } from "./rules/structure";
import type { PartMark } from "./standard";
import { DraftDateTaken, PageStopped, generateStore, type DraftRow, type SiteFacts } from "./store";

export interface MendInput {
  siteId: string;
  site: SiteFacts;
  report: StoredReport;
  opportunity: Opportunity;
  publishDate: string | null;
  draftId?: string;
}

/** SPEC §7 (issue 1507): a refresh planned for the consistency rules alone, each of whose defects code repairs. */
export function mendable(opportunity: Opportunity): boolean {
  const shortfall = (opportunity.evidence as { shortfall?: { cause?: unknown; defects?: unknown } } | undefined)?.shortfall;
  return (
    opportunity.type === "refresh_page" &&
    shortfall?.cause === "structure" &&
    Array.isArray(shortfall.defects) &&
    mendedInCode(shortfall.defects.filter((defect): defect is string => typeof defect === "string"))
  );
}

/** A refresh made at 0¢ or one small call, not by the writer: a mend is checked with its live version's pack, so a page live with none is the writer's. */
export async function refreshedInCode(siteId: string, o: Opportunity, say = true): Promise<boolean> {
  if (!mendable(o)) return snippetOnly(o);
  const live = await generateStore().liveVersionAt(siteId, o.targetRef);
  const packed = live === null || metaOf(live.draft.meta).pack !== undefined;
  if (!packed && say) notMended(siteId, o, "no_pack");
  return packed;
}
const notMended = (siteId: string, o: Opportunity, why: "no_live" | "unchanged" | "no_pack" | "held"): null => (console.log(JSON.stringify({ event: "page_not_mended", siteId, opportunityId: o.id, why })), null);
type Mended = { version: DraftRow; body: string; checked: Extract<RecheckOutcome, { kind: "checked" }> };
type Meta = Record<string, unknown>;
const metaOf = (meta: unknown): Meta => (typeof meta === "object" && meta !== null ? (meta as Meta) : {});

/** The live page's mended new version under today's battery, written nowhere. `null` where nothing changed or there
 *  is nothing the battery may check. */
async function mendedVersion(a: MendInput): Promise<Mended | null> {
  const store = generateStore();
  const url = a.opportunity.targetRef;
  const live = await store.liveVersionAt(a.siteId, url);
  if (live === null) return notMended(a.siteId, a.opportunity, "no_live");
  const meta = metaOf(live.draft.meta);
  const body = repairStructure(live.draft.body_md ?? "", { title: live.draft.title ?? "" });
  if (body === (live.draft.body_md ?? "")) return notMended(a.siteId, a.opportunity, "unchanged");
  const version = { ...live.draft, meta: { ...meta, datedAs: typeof meta.datedAs === "string" ? meta.datedAs : live.publishedAt.toISOString(), mendOf: live.draft.id } };
  // The live text passed the rules of its own day; its new version enters review only on today's.
  const sets = await siteSets(a.siteId, a.site, a.report);
  const checked = await checkStoredAt0(version, body, { ...sets, opportunity: a.opportunity, now: new Date(), versionsAt: { url, draftIds: await store.versionsAt(a.siteId, url) } });
  return checked.kind === "checked" ? { version, body, checked } : notMended(a.siteId, a.opportunity, checked.kind === "held" ? "held" : "no_pack");
}

async function insertMended(a: MendInput, { version, body, checked }: Mended, cents = 0): Promise<string> {
  const store = generateStore();
  const { title, grounded_fact, attribution } = version;
  const draftId = await store.insertDraft({ site_id: a.siteId, opportunity_id: a.opportunity.id, state: "generating", title, body_md: body, grounded_fact, attribution, scheduled_for: a.publishDate, cost_cents: cents, meta: version.meta });
  await store.patchDraft(draftId, { ...checked.patch, cost_cents: cents });
  console.log(JSON.stringify({ event: "page_mended", siteId: a.siteId, draftId, mendOf: version.id, passed: checked.passed, failed: checked.failed.map((failure) => failure.rule).join(",") }));
  return draftId;
}

/** The live page mended (SPEC §7, issue 1507): a new version of its own text with what code repairs repaired and nothing
 *  written, at 0¢, through the refresh path, never an edit of the live row (ADR-080). It is dated as the version it mends
 *  (`datedAs`), since a renumbered list does not change what the page says, and enters review only on today's battery. A
 *  `snippet` refresh takes the same path with one small call (`snippetPage`). */
export async function mendPage(a: MendInput, cost: CostContext): Promise<DayPageOutcome> {
  if (snippetOnly(a.opportunity)) return snippetPage(a, cost);
  const mended = await mendedVersion(a);
  if (mended === null) return { ok: false, because: "step_failed", draftId: a.draftId ?? null, step: "mend" };
  const draftId = await insertMended(a, mended);
  return mended.checked.passed ? { ok: true, draftId } : { ok: false, because: "rules", draftId, attempts: 1 };
}

/** A refresh planned for the page's title and description alone (owner ruling 75). */
export function snippetOnly(opportunity: Opportunity): boolean {
  return opportunity.type === "refresh_page" && (opportunity.evidence as { shortfall?: { cause?: unknown } } | undefined)?.shortfall?.cause === "snippet";
}

/** The live page with a new title and description and every word of its body kept: one small call, a new version
 *  through the refresh path (ADR-080), dated as the version it rewrites, entering review only on today's battery. */
export async function snippetPage(a: MendInput, cost: CostContext): Promise<DayPageOutcome> {
  const failed = { ok: false, because: "step_failed", draftId: a.draftId ?? null, step: "snippet" } as const;
  const store = generateStore();
  const live = await store.liveVersionAt(a.siteId, a.opportunity.targetRef);
  if (live === null || cost.capHit()) return failed;
  const meta = metaOf(live.draft.meta);
  const body = live.draft.body_md ?? "";
  const current = { title: live.draft.title ?? "", description: typeof meta.description === "string" ? meta.description : "" };
  const { llm } = await import("@/lib/llm");
  const written = await llm(cost, {
    site: "generate.page_fix",
    tier: "nano",
    schema: z.strictObject({ title: z.string(), description: z.string() }),
    instructions: ["task", "locale"],
    locale: await siteLocale(a.siteId),
    input: {
      task: `Google shows this page for the searches in shownFor, and nobody clicks it. Rewrite its HTML title (${TITLE.chars.min} to ${TITLE.chars.max} characters, leading with the search) and its meta description (${TITLE.description.min} to ${TITLE.description.max} characters, whole sentences) so a searcher sees the page answers them. Use only what the page text states.`,
      search: a.opportunity.targetQuery,
      shownFor: (googleRead(readingOf(live.reading)?.google)?.queries ?? []).slice(0, 5).map((q) => q.query),
      current,
      text: body.slice(0, SITE_PROFILE.VOICE_INPUT_MAX_CHARS),
    },
  });
  if (written.kind === "unmeasured" || written.value.title.trim() === "" || written.value.description.trim() === "") return failed;
  // The H1 stays the page's own: only what Google shows changes.
  const heading = typeof meta.heading === "string" && meta.heading !== "" ? meta.heading : current.title;
  const datedAs = typeof meta.datedAs === "string" ? meta.datedAs : live.publishedAt.toISOString();
  const version = { ...live.draft, title: written.value.title.trim(), meta: { ...meta, heading, description: written.value.description.trim(), datedAs, snippetOf: live.draft.id } };
  const sets = await siteSets(a.siteId, a.site, a.report);
  const checked = await checkStoredAt0(version, body, { ...sets, opportunity: a.opportunity, now: new Date(), versionsAt: { url: a.opportunity.targetRef, draftIds: await store.versionsAt(a.siteId, a.opportunity.targetRef) } });
  if (checked.kind !== "checked") return failed;
  const draftId = await insertMended(a, { version, body, checked }, cost.spentCents());
  await cost.forDraft?.(draftId);
  return checked.passed ? { ok: true, draftId } : { ok: false, because: "rules", draftId, attempts: 1 };
}

/** SPEC §7, reason 1, a duplicate of a live page (owner, 2026-11-17 ~23:45): whether a written update adds anything over
 *  its live version. A committed 0¢ `structure` mend or a `link`/`unseen` refresh never does. The day's fallback `update`
 *  does where it passed with three new sourced facts or one new question answered, and two cited pages, one read since
 *  `since`, and then keeps its `marks`. One that adds nothing gives up its date, keeps its live version's, and never enters
 *  review, which would date it again. */
export async function addsOverLive(draftId: string, update?: { ok: boolean; since: Date; marks: Meta }): Promise<boolean> {
  const store = generateStore();
  const row = await store.draftById(draftId);
  const meta = metaOf(row?.meta), pack = meta.pack as ContextPack | undefined;
  const o = update !== undefined || row === null ? null : await opportunityById(row.opportunity_id);
  const cause = (o?.evidence as { shortfall?: { cause?: unknown } } | undefined)?.shortfall?.cause;
  const live = pack?.live?.markdown ?? "", body = row?.body_md ?? "";
  const cited = pack?.claims.filter((claim) => body.includes(claim.url)) ?? [];
  const asked = (markdown: string): string[] => (markdown.match(/^#{2,3} .*\?\s*$/gm) ?? []).map(fold);
  const substance = (cited.filter((claim) => !fold(live).includes(fold(claim.passage))).length >= 3 || asked(body).some((heading) => !asked(live).includes(heading))) && new Set(cited.map((claim) => claim.url)).size >= 2 && cited.some((claim) => Date.parse(claim.readAt) >= (update?.since.getTime() ?? 0));
  const adds = update === undefined ? typeof meta.mendOf !== "string" && (o === null || !(o.type === "refresh_page" && (cause === "link" || cause === "unseen"))) : update.ok && substance;
  if (adds) {
    if (update !== undefined) await store.patchDraft(draftId, { meta: { ...meta, ...update.marks } });
    return true;
  }
  const datedAs = pack?.live?.datedAs;
  await store.patchDraft(draftId, { scheduled_for: null, meta: typeof meta.datedAs === "string" || datedAs === undefined ? meta : { ...meta, datedAs } });
  // A stopped update already rests; a passing one is set aside.
  if (update?.ok === false) return false;
  const { transition } = await import("@/lib/publish/machine");
  await transition(draftId, "needs_attention", { kind: "system", job: "draft/generate" }, { reason: "step_failed:adds" });
  return false;
}

/** A site none of whose live pages of ours has stood the refresh floor (owner, 2026-11-18): its pages are short by
 *  nature, and its shortfall is not shown. A read that fails reads as an established site, which shows it. */
export async function newSite(siteId: string, at: Date): Promise<boolean> {
  const pages = await opportunityStore().refreshPages(siteId).catch(() => null);
  return pages !== null && !pages.some((page) => page.takenDown !== true && pastRefreshFloor(page.publishedAt, at));
}

/** R31's rivals of a `vs` topic, as its pack names them: the domains a page on it must read first-hand. */
export function versusRivals(site: SiteFacts, report: StoredReport, o: Pick<Opportunity, "targetQuery" | "absorbedQueries" | "title">): string[] {
  const market = site.market === undefined ? null : writingMarket({ site: { category: site.category, competitors: site.rivals, stored: site.market }, reportCategory: "" }).market;
  const business = { name: siteRulesOf(site, report).businessName, domain: site.domain, category: "", byline: null, voice: null, market, rivals: site.rivals };
  return rivalsOnlyVersus({ target: { searches: targetSearches(o), question: o.title ?? "" }, business }).map((rival) => rival.domain);
}

/** The pack's `rival_evidence` stop at 0¢, before a topic's research is bought: each rival a `vs` topic names answers. */
export async function rivalsAnswer(day: { site: SiteFacts; report: StoredReport }, topic: Opportunity): Promise<boolean> {
  return !(await Promise.all(versusRivals(day.site, day.report, topic).map((domain) => fetchBody(`https://${domain}/`)))).includes(null);
}

/** A day the fallback kept no page for: each update candidate's gate. */
type Passed = { ok: false; because: "passed"; why: string };

type Day = { siteId: string; site: SiteFacts; report: StoredReport; publishDate: string };
type Candidate = { page: OwnLivePage; standard: { parts: PartMark[]; met: boolean } | null; early: boolean };

/**
 * The live pages a day may update, the one furthest below the standard first (SPEC §7, owner 2026-11-17 ~23:45): the
 * fewest parts its stored `meta.standard` meets, ties to the oldest, and a page with none recorded after every page
 * measured. Each is past the refresh floor, but a page published below the standard, which may take one completing
 * update before it (ruling 14). A page its customer edited, took down or stopped a refresh of is theirs. 0¢.
 */
async function updateCandidates(siteId: string, at: Date, passed: string[] = []): Promise<Candidate[]> {
  const pages = (await opportunityStore().refreshPages(siteId)).filter((page) => page.takenDown !== true);
  const stopped = await stoppedRefreshes(siteId);
  const found: Candidate[] = [];
  for (const page of pages) {
    if (stopped.has(addressKey(page.url))) continue;
    if (page.edited === true || page.row.targetQuery === null) {
      passed.push(page.edited === true ? "edited" : "no_query");
      continue;
    }
    const meta = metaOf((await generateStore().liveVersionAt(siteId, page.url))?.draft.meta);
    const standard = Array.isArray(metaOf(meta.standard).parts) ? (meta.standard as Candidate["standard"]) : null;
    // Its one early update is the live version, so it is not picked again until it is past the floor.
    const early = !pastRefreshFloor(page.publishedAt, at) && standard?.met === false && meta.early !== true;
    if (early || pastRefreshFloor(page.publishedAt, at)) found.push({ page, standard, early });
    else passed.push("floor");
  }
  const met = (each: Candidate): number => each.standard?.parts.filter((part) => part.state === "met").length ?? Number.POSITIVE_INFINITY;
  return found.sort((x, y) => met(x) - met(y) || x.page.publishedAt.getTime() - y.page.publishedAt.getTime());
}

/** The search of the day's first update candidate, whose one SERP the day's research step asks with its own. */
export async function updateSearch(siteId: string, at: Date): Promise<string | null> {
  return (await updateCandidates(siteId, at).catch(() => []))[0]?.page.row.targetQuery ?? null;
}

/** The candidate's open refresh that is not resting, where it has one, else an `aged` one planned and assessed as
 *  Monday's are, beside any resting row at the address (a retarget); else why none is. */
async function refreshRow(siteId: string, page: OwnLivePage, at: Date, plan = true): Promise<Opportunity | "row_resting" | "row_unready"> {
  const store = opportunityStore();
  const openAt = async () => (await store.openRankable(siteId)).map(readOpportunity).filter((o) => o.type === "refresh_page" && addressKey(o.targetRef ?? "") === addressKey(page.url));
  // Only a harm or customer stop (`resting`) holds a row back from its page's update; a gate on a new topic does not.
  const usable = (rows: Opportunity[]) => rows.find((o) => o.unreadyReason !== "resting" && !isResting(o, at));
  let open = await openAt();
  // Titled as the page is, so the writer finds its live text even before the known-content copy lists it.
  const planned = { ...refreshOfPage(page, "aged", at), title: page.title || null };
  if (plan && usable(open) === undefined && (await persistAssessed(siteId, [planned], at)) > 0) open = await openAt();
  return usable(open) ?? (open.some((o) => isResting(o, at)) ? "row_resting" : "row_unready");
}

/** The writer's update of one candidate, from its research: the day's page where it passes and adds over its live page. */
async function writtenUpdate(page: Day & { opportunity: Opportunity }, marks: Meta, now: Date, cost: CostContext): Promise<{ ok: true; draftId: string } | null> {
  const { writeFallback } = await import(".");
  const outcome = await writeFallback(page, now, cost);
  const draftId = outcome.ok ? outcome.draftId : "draftId" in outcome ? outcome.draftId : null;
  return draftId !== null && (await addsOverLive(draftId, { ok: outcome.ok, since: now, marks })) ? { ok: true, draftId } : null;
}

/** The day's update (SPEC §7): each candidate's one target SERP read on the normal queue, cached or bought inside the
 *  date's cap, and the first whose research reads is written. A page published short is passed over where its research
 *  holds no more questions than it has sections. `null` where none kept the day. */
async function dayUpdate(day: Day, trigger: string, now: Date, cost: CostContext, giveUp: () => Promise<void>, passed: string[]): Promise<{ ok: true; draftId: string } | null> {
  const locale = await siteLocale(day.siteId);
  for (const { page, standard, early } of await updateCandidates(day.siteId, now, passed)) {
    if (cost.capHit() || !roomForFix(cost)) return (passed.push("cap"), null);
    const [read] = researchSerps({ siteId: day.siteId, locale, target: page.row.targetQuery!, study: false }, RESEARCH.queueWaitS * 1000);
    const serp = await serpOrganic(cost, read!);
    if (serp.kind === "unmeasured") {
      passed.push("serp_unmeasured");
      continue;
    }
    const sections = standard?.parts.find((part) => part.part === "sections")?.have ?? 0;
    // The questions its research answers, where the commit checked its update, else the SERP's own count.
    const known = standard?.met === false ? await refreshRow(day.siteId, page, now, false) : null;
    const asked = standard?.met === false ? ((typeof known === "string" ? undefined : known?.planReason?.research?.Q) ?? serp.value.peopleAlsoAsk?.length ?? 0) : Infinity;
    const opportunity = asked <= sections ? "asked<=sections" : await refreshRow(day.siteId, page, now);
    if (typeof opportunity === "string") {
      passed.push(opportunity);
      continue;
    }
    await giveUp();
    const research = serp.value.reusedFrom === undefined ? "bought" : "cached";
    // One update is written for a day, whether or not it kept it.
    const written = await writtenUpdate({ ...day, opportunity }, { fallbackFor: trigger, research, ...(early ? { early: true } : {}) }, now, cost);
    if (written === null) passed.push("thin");
    return written;
  }
  return null;
}

/** The candidates' gates as the day's reason keeps them, `floor×2` for two; `no_candidate` where the site had none. */
function tally(passed: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const why of passed) counts.set(why, (counts.get(why) ?? 0) + 1);
  return counts.size === 0 ? "no_candidate" : `update:${[...counts].map(([why, n]) => (n > 1 ? `${why}×${n}` : why)).join(",")}`;
}

/** The day's page, where its own and its spares did not pass: the writer's update of the live page furthest below the
 *  standard. Where none kept it, `passed` names each update candidate's gate, a recommit's failure and `harm_stop` behind
 *  a harm stop. `stopped` is the row that holds the date, which gives it up only to a page written for it. */
export async function refreshForDay(a: {
  siteId: string;
  publishDate: string;
  trigger: string;
  /** Whether the day's run ended before any page was written, so it has spent nothing. */
  from: "select" | "write";
  stopped: string | null;
  /** The run's due hour, which a topic's rest is read against and the day's spend so far is read since unless `since` says otherwise. */
  now?: Date; since?: Date;
}): Promise<{ ok: true; draftId: string } | { ok: false; because: "already_drafted" } | Passed | null> {
  const store = generateStore();
  const [site, report] = await Promise.all([store.siteFacts(a.siteId), store.latestReport(a.siteId)]);
  if (site === null || report === null) return null;
  // A replay after the insert finds the date its own row took.
  const holds = a.stopped !== null && (await store.draftById(a.stopped))?.scheduled_for === a.publishDate;
  if (!holds && (await store.draftOnDate(a.siteId, a.publishDate))) return { ok: false, because: "already_drafted" };
  const now = a.now ?? new Date();
  const day = { siteId: a.siteId, site, report, publishDate: a.publishDate };
  // The row the rules stopped gives up its date to the page written next, as a stopped topic does to its spare.
  const giveUp = async () => void (holds ? await store.patchDraft(a.stopped!, { scheduled_for: null }) : undefined);
  const inDay = <T>(body: (cost: CostContext) => Promise<T>): Promise<T | { ok: false; because: "already_drafted" } | null> =>
    // Opened at what the date has already spent, so the day keeps its one CAP_DRAFT.
    openDayCost({ scanId: report.scanId, siteId: a.siteId, since: a.since ?? now }, body).catch((error: unknown) => {
      if (error instanceof DraftDateTaken) return { ok: false, because: "already_drafted" } as const;
      // The customer stopped this page as it was saved: the day ends as its own did.
      if (error instanceof PageStopped) return null;
      throw error;
    });
  const passed: string[] = [];
  const ended = (outcome: DayPageOutcome | null) => {
    if (outcome !== null && (outcome.ok || outcome.because === "already_drafted")) return outcome;
    const last = outcome === null ? "" : `;last:${outcome.because}${"step" in outcome ? `:${outcome.step}` : ""}`;
    return { ok: false, because: "passed", why: `${tally(passed)}${last}` } as const;
  };
  const updated = await inDay((cost) => dayUpdate(day, a.trigger, now, cost, giveUp, passed));
  if (updated !== null) return updated;
  // A day whose select found no topic has spent nothing, so it recommits once.
  if (a.trigger === "generate:no_opportunity" && a.from === "select") {
    const { generateDayPage } = await import(".");
    const page = await generateDayPage({ siteId: a.siteId, publishDate: a.publishDate, updatesTried: true, now, since: a.since });
    if (page.ok || page.because !== "no_opportunity") return ended(page);
  }
  // A day a harm rule ended is marked so, and is never re-sent.
  const harm = holds && (readRecordedRules((await store.draftById(a.stopped!))?.rule_failures) ?? []).some(stops);
  return harm ? { ok: false, because: "passed", why: `${tally(passed)};harm_stop` } : ended(null);
}
