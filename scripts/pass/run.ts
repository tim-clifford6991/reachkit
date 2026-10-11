// scripts/pass/run.ts — `npm run pass -- --replay <scanId>` (SPEC §6, D64,
// issue 1301): a stored pass, run again through the pass's own steps.
//
// # What it reads
//
// `scripts/pass/snapshot/<first 8 of the scan id>.json` is one pass as
// production stored it (`scripts/pass/export.sql` says what it holds and
// `scripts/pass/assemble.mjs` how it is taken through the Supabase
// connector). Beside it, where a `--live` run has bought anything,
// `<first 8>.live.json` holds the calls the stored pass never made, as the
// box bought them; a replay serves those too, and counts their cost.
//
// # The state it starts from
//
// A snapshot is taken after the pass, so three things are put back as the
// pass found them, from what the pass itself stored:
//
//   * the rivals' order — the one whose comparison prompts the pass asked;
//   * the brand volumes — without the keywords this pass bought;
//   * the topics — without the ones this pass created, and open again where
//     this pass (or anything after it) changed them — and the tracked
//     prompts as the pass asked them.
//
// What cannot be put back is said in the output, never guessed.
//
// # What it runs
//
//   0. **The measured searches** (D65, issue 1303): the seeds the market in
//      force yields, their suggestions through the product's
//      `deriveMarketSet`, the selection over them and the stored pool, and
//      the judgement of the searches the market holds no verdict for. The
//      stored pass's own questions stand as its report; this step says what
//      the pass would measure now.
//   1. **Sizing**: the tracked rivals, then `serpDomainsToSize` over the
//      report's own top tens, each through the product's `sizeRivals`.
//   2. **After the report**: the deep pass's own `afterDeepReport` — the
//      rival conclusion and its brand volumes, the prompts that follow the
//      rivals, the topics and their prune, and the health checks.
//
// The other stages before the report (reading the site, asking the searches
// and the prompts) are not run: the stored report is their result, and
// their cost is carried as the pass recorded it.
//
// # How a call is answered
//
// Every vendor and model call goes through the product's cost seam, which
// looks in `fetches` first. So a call the stored pass made is found there,
// by its own key, and costs nothing here. A rival or market conclusion whose
// evidence is the same report is answered with the pass's stored answer
// even where its key moved. A keyword read is answered from stored reads
// where every keyword it asks was read before. Anything else is a call the
// stored pass did not make: `--replay` refuses it and lists it; `--live`
// buys it, inside the cap, and keeps it in `<first 8>.live.json`.
import { DEFAULT_LOCALE, localeOf } from "@/lib/locale/locales";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { BATTERY, PRICE_BOOK, SELECTION, SERP_RIVAL_SIZING, WEEKLY_RIVAL_RESIZES } from "@/lib/config/constants";
import { brandKeywords, ownKeywords } from "@/lib/market/infer/demand";
import { parseStoredMarket } from "@/lib/market/infer/stored";
import { spokenMarket } from "@/lib/market/infer/terms";
import type { MarketConclusion } from "@/lib/market/infer/types";
import { generatePrompts, promptSiteName } from "@/lib/market/prompts/generate";
import { parsePromptSet } from "@/lib/market/prompts/set";
import { deriveMarketSet, type SuggestionRow } from "@/lib/market/questions/market-set";
import { marketSeeds, measuredMarketOf, neverMeasured, searchKey, unjudged } from "@/lib/market/questions/measured";
import type { SelectedSearch } from "@/lib/market/questions/select";
import { isShort, seedLadder, selectWidened } from "@/lib/market/questions/widen";
import { serpDomainsToSize } from "@/lib/market/rivals/candidates";
import { sizeRivals } from "@/lib/market/rivals/size";
import { trackedRivals } from "@/lib/market/rivals/tracked";
import type { MarketSerp } from "@/lib/market/views";
import { withStoredPassSpend } from "@/lib/scan/ceilings";
import { afterDeepReport } from "@/lib/scan/deep/run";
import { judgeSearchesForPass } from "@/lib/scan/market-conclusion";
import { parseHealth } from "@/lib/scan/health";
import { readStoredReport } from "@/lib/scan/report";
import { appendSpend } from "../spend-log.mjs";

export interface Options {
  root: string;
  site: string;
  scan: string;
  live: boolean;
  capCents: number;
}

type Row = Record<string, unknown>;

type FetchRow = {
  scan_id: string;
  source: string;
  cache_key: string;
  policy_version: number;
  cost_cents: number;
  reserved_cents: number;
  created_at: string;
  duration_ms: number | null;
  /** Issue 1408: the vendor's own charge. Absent on a row kept before it. */
  billed_cents?: number | string | null;
  payload: unknown;
};

interface Snapshot {
  scan: Row & { id: string; site_id: string; domain: string; tier: string; created_at: string; finished_at: string; cost_cents: number; report: unknown };
  site: Row & { id: string; domain: string; category: string | null; market: unknown; tracked_prompts: unknown };
  siteProfile: (Row & { site_name?: string | null }) | null;
  siteProfileEdits: Row[];
  opportunities: (Row & { id: string; created_at: string; status: string; status_changed_at: string; target_query: string | null })[];
  drafts: Row[];
  destinations: Row[];
  otherScans: Row[];
  fetches: FetchRow[];
  ledger: { source: string; n: number; cents: number }[];
}

const RANKED = "dataforseo_labs/google/ranked_keywords";
const KEYWORDS = "dataforseo_labs/google/keyword_overview";
/** A conclusion whose evidence is the stored report itself: the pass's own
 *  answer stands where only the key around it moved. */
const SAME_QUESTION = new Set(["rival-inference", "market-inference", "market-terms"]);
const SUGGESTIONS = "dataforseo_labs/google/keyword_suggestions";
const OWNER = "00000000-0000-4000-8000-000000001301";

const cents = (n: number): string => `${n.toFixed(2)}¢`;
const without = (row: Row, ...columns: string[]): Row => Object.fromEntries(Object.entries(row).filter(([column]) => !columns.includes(column)));
const short = (id: string): string => id.slice(0, 8);

// ── The local database ─────────────────────────────────────────────────────

function psql(sql: string): string {
  const url = process.env.DATABASE_URL;
  if (url === undefined || !/@(127\.0\.0\.1|localhost)[:/]/.test(url)) {
    throw new Error("scripts/pass/run.ts: DATABASE_URL does not name the local database; nothing was run.");
  }
  return execFileSync("psql", [url, "-q", "-v", "ON_ERROR_STOP=1", "-At", "-f", "-"], {
    input: sql,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, PGOPTIONS: "-c client_min_messages=warning" },
  });
}

/** `public`, rebuilt from the migrations — the loop the layout seed runs. */
function rebuild(root: string): void {
  psql("drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role;");
  const dir = path.join(root, "supabase/migrations");
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".sql")).sort()) psql(readFileSync(path.join(dir, file), "utf8"));
  psql("notify pgrst, 'reload schema';");
}

async function waitForSchema(): Promise<void> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const url = `${process.env.SUPABASE_URL}/rest/v1/scans?select=health&limit=1`;
  const deadline = Date.now() + 30_000;
  for (;;) {
    const ok = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } }).then((r) => r.ok, () => false);
    if (ok) return;
    if (Date.now() > deadline) throw new Error("The local database never served the migrated schema.");
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

/** Rows into a table, by the columns the rows carry; every other column
 *  takes its default. */
function load(table: string, rows: readonly Row[]): void {
  if (rows.length === 0) return;
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))].map((column) => `"${column}"`).join(", ");
  const tag = "$snapshot$";
  // A snapshot is one site's rows, not the rows they point at.
  psql(`set session_replication_role = replica; insert into public.${table} (${columns}) select ${columns} from jsonb_populate_recordset(null::public.${table}, ${tag}${JSON.stringify(rows)}${tag}::jsonb);`);
}

// ── The snapshot, and the state the pass started from ──────────────────────

function readSnapshot(o: Options): { snapshot: Snapshot; bought: FetchRow[]; boughtFile: string } {
  const dir = path.join(o.root, "scripts/pass/snapshot");
  const file = path.join(dir, `${short(o.scan)}.json`);
  if (!existsSync(file)) {
    throw new Error(`No snapshot at ${file}. Export the pass first: scripts/pass/export.sql, then scripts/pass/assemble.mjs.`);
  }
  const snapshot = JSON.parse(readFileSync(file, "utf8")) as Snapshot;
  if (snapshot.site.domain !== o.site) throw new Error(`${file} is a pass of ${snapshot.site.domain}, not of ${o.site}.`);
  if (snapshot.scan.tier !== "deep") throw new Error(`${file} is a ${snapshot.scan.tier} pass; the replay runs a deep pass's steps only.`);
  const boughtFile = path.join(dir, `${short(o.scan)}.live.json`);
  const bought = existsSync(boughtFile) ? (JSON.parse(readFileSync(boughtFile, "utf8")) as FetchRow[]) : [];
  return { snapshot, bought, boughtFile };
}

/**
 * The rivals as they stood before this pass's own change (D65): the ones it
 * added taken out, the ones it dropped put back. A dropped rival's record is
 * the newest earlier rival conclusion's, with the volume the market holds
 * for it. `null` where this pass changed nothing or a record is not held.
 */
function beforeOwnChange(snapshot: Snapshot, market: MarketConclusion): { rivals: MarketConclusion["rivals"]; note: string } | null {
  const change = (snapshot.site.market as { lastChange?: { scanId?: string; added?: { domain: string }[]; dropped?: string[] } } | null)?.lastChange;
  if (change === undefined || change === null || change.scanId !== snapshot.scan.id) return null;
  const added = new Set((change.added ?? []).map((r) => r.domain));
  const rivals = market.rivals.filter((r) => !added.has(r.domain));
  const earlier = snapshot.fetches
    .filter((f) => f.source === "rival-inference" && f.scan_id !== snapshot.scan.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  type Candidate = { name: string; basis: string; domain: string; reason: string; searchName?: string | null };
  for (const domain of change.dropped ?? []) {
    let found: Candidate | undefined;
    for (const row of earlier) {
      const candidates = ((row.payload as { value?: { candidates?: Candidate[] } } | null)?.value?.candidates ?? []) as Candidate[];
      found = candidates.find((c) => c.domain.toLowerCase().replace(/^www\./, "") === domain);
      if (found !== undefined) break;
    }
    if (found === undefined) return null;
    const basis = found.basis === "ai_answer" || found.basis === "ranks" ? found.basis : "same_job";
    const searchNames = [found.name.toLowerCase(), ...(found.searchName ? [found.searchName.toLowerCase()] : [])];
    const record = { domain, name: found.name, basis, reason: found.reason, searchNames: [...new Set(searchNames)] } as MarketConclusion["rivals"][number];
    const volume = Math.max(0, ...brandKeywords(record).map((keyword) => market.demand?.brands[keyword] ?? 0));
    rivals.push({ ...record, volume });
  }
  rivals.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
  const dropped = change.dropped ?? [];
  return { rivals, note: dropped.length === 0 ? "" : `; ${dropped.join(", ")} put back from the last conclusion that named it` };
}

const keywordsOf = (row: Pick<FetchRow, "cache_key">): string[] => (row.cache_key.split("|")[0] ?? "").split(",").filter(Boolean);

function startingState(snapshot: Snapshot): { site: Row; opportunities: Row[]; notes: string[] } {
  const notes: string[] = [];
  const { scan, site } = snapshot;
  const report = readStoredReport(scan.report);
  const stored = parseStoredMarket(site.market);
  const market = stored.current;
  const raw = (site.market ?? {}) as { current?: Row; lastChange?: { added?: unknown[] } };
  let current: Row | undefined = raw.current;
  let competitors: string[] | null = null;

  if (market !== null && current !== undefined) {
    // The rivals' order: the one that yields the comparison prompts this pass asked.
    const asked = new Set((report.prompts?.asked ?? []).filter((p) => p.kind === "comparison").map((p) => p.text));
    const siteName = promptSiteName(snapshot.siteProfile?.site_name ?? null, site.domain);
    const buyers = (snapshot.siteProfileEdits[0]?.answers as { buyers?: string } | undefined)?.buyers ?? null;
    const yields = (rivals: MarketConclusion["rivals"]): boolean => {
      const comparisons = generatePrompts(spokenMarket({ ...market, rivals }, buyers), siteName).filter((p) => p.kind === "comparison");
      return comparisons.length > 0 && comparisons.every((p) => asked.has(p.text));
    };
    const before = parseStoredMarket({ ...raw, current: { ...current, rivals: raw.lastChange?.added ?? [] } }).current?.rivals ?? [];
    const undone = beforeOwnChange(snapshot, market);
    if (undone !== null && yields(undone.rivals)) {
      current = { ...current, rivals: undone.rivals };
      competitors = undone.rivals.map((rival) => rival.domain);
      notes.push(`the rivals start as they stood before this pass changed them (${undone.rivals.map((r) => r.name).join(", ")}): that set yields the prompts the pass asked${undone.note}`);
    } else if (asked.size === 0) notes.push("the pass asked no comparison prompts, so the rivals start in the order they are stored in now");
    else if (yields(market.rivals)) notes.push("the rivals start in the order they are stored in now: it yields the prompts the pass asked");
    else if (before.length > 0 && yields(before)) {
      current = { ...current, rivals: raw.lastChange?.added };
      notes.push(`the rivals start as the last rival change stored them (${before.map((r) => r.name).join(", ")}): that order yields the prompts the pass asked`);
    } else notes.push("no stored order of the rivals yields the prompts the pass asked; they start in the order they are stored in now");

    // The brand volumes: without what this pass bought.
    const boughtHere = new Set(snapshot.fetches.filter((f) => f.scan_id === scan.id && f.source === KEYWORDS).flatMap(keywordsOf));
    const demand = current.demand as { brands?: Record<string, number>; searches?: unknown } | undefined;
    if (demand?.brands !== undefined && boughtHere.size > 0) {
      const brands = Object.fromEntries(Object.entries(demand.brands).filter(([keyword]) => !boughtHere.has(keyword)));
      current = { ...current, demand: { ...without(demand, "searches"), brands } };
      notes.push(`the brand volumes start without the ${boughtHere.size} keywords this pass bought`);
    }
  }

  // The tracked prompts: as the pass asked them.
  const set = parsePromptSet(site.tracked_prompts);
  const held = new Map(set.prompts.map((p) => [p.id, p]));
  const askedSet = report.prompts?.asked ?? [];
  const prompts = askedSet.length === 0 ? set.prompts : askedSet.map((p) => held.get(p.id) ?? { ...p, addedAt: set.rebuiltAt ?? "" });
  if (askedSet.length > 0) notes.push(`the tracked prompts start as the ${askedSet.length} this pass asked`);

  // The topics: without this pass's own, and open again where it changed them.
  const startedAt = Date.parse(scan.created_at);
  const opportunities = snapshot.opportunities
    .filter((row) => Date.parse(row.created_at) < startedAt)
    .map((row) => (Date.parse(row.status_changed_at) >= startedAt ? { ...row, status: "open", status_changed_at: row.created_at } : row));
  const reopened = snapshot.opportunities.filter((row) => Date.parse(row.created_at) < startedAt && Date.parse(row.status_changed_at) >= startedAt);
  notes.push(
    `the topics start as the ${opportunities.length} held before the pass` +
      (reopened.length === 0 ? "" : `, with ${reopened.map((row) => `"${row.target_query ?? row.id}"`).join(", ")} open again`)
  );

  return {
    site: { ...site, ...(competitors === null ? {} : { competitors }), user_id: OWNER, market: { ...raw, current }, tracked_prompts: { ...(site.tracked_prompts as Row), prompts } },
    opportunities,
    notes,
  };
}

// ── The clock and the network ──────────────────────────────────────────────

/** The process's clock, moved to the pass's own time: a cache window and a
 *  thirty-day refresh are read as they were then. */
function moveClock(to: Date): void {
  const Real = Date;
  const offset = to.getTime() - Real.now();
  class Then extends Real {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(Real.now() + offset);
      else super(...(args as [number]));
    }
    static override now(): number {
      return Real.now() + offset;
    }
  }
  globalThis.Date = Then as DateConstructor;
}

type Served = "stored" | "bought on the box" | "stored answer, same evidence" | "assembled from stored reads" | "earlier pass" | "refused" | "bought now";

interface Lookup {
  source: string;
  key: string;
  served: Served;
  cents: number;
}

/**
 * Every request the process makes. One to the local database goes through;
 * a cache lookup among them is noted, and answered from the snapshot where
 * the rules above allow. One to anywhere else is a vendor or a model: a
 * replay refuses it, a live run lets it through while the cap holds.
 */
function watchNetwork(a: { o: Options; snapshot: Snapshot; bought: readonly FetchRow[]; spentLive: () => number }): Lookup[] {
  const lookups: Lookup[] = [];
  const local = process.env.SUPABASE_URL ?? "";
  const real = globalThis.fetch;
  const own = a.snapshot.fetches.filter((f) => f.scan_id === a.snapshot.scan.id);
  const known = new Map<string, number>();
  for (const row of [...a.snapshot.fetches, ...a.bought]) {
    if (row.source !== KEYWORDS || !Array.isArray(row.payload)) continue;
    for (const keyword of keywordsOf(row)) known.set(keyword, 0);
    for (const entry of row.payload as { keyword: string; searchVolume: number }[]) known.set(entry.keyword, entry.searchVolume);
  }
  const answer = (rows: unknown): Response => new Response(JSON.stringify(rows), { status: 200, headers: { "content-type": "application/json" } });

  globalThis.fetch = async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const method = (init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET")).toUpperCase();
    if (!url.href.startsWith(local)) {
      const pending = [...lookups].reverse().find((lookup) => lookup.served === "refused" || lookup.served === "bought now");
      if (!a.o.live) throw new Error(`replay: ${url.host} is not contacted (${pending?.source ?? "a call"} the stored pass did not make)`);
      if (a.spentLive() >= a.o.capCents) throw new Error(`live: the ${cents(a.o.capCents)} cap is spent; ${url.host} is not contacted`);
      if (pending !== undefined) pending.served = "bought now";
      return real(input, init);
    }
    const source = url.searchParams.get("source")?.replace(/^eq\./, "");
    const key = url.searchParams.get("cache_key")?.replace(/^eq\./, "");
    if (method !== "GET" || !url.pathname.endsWith("/fetches") || source === undefined || key === undefined) return real(input, init);

    const response = await real(input, init);
    const rows = (await response.clone().json().catch(() => null)) as { payload: unknown }[] | null;
    if (rows !== null && rows.length > 0) {
      const mine = own.find((f) => f.source === source && f.cache_key === key);
      const later = a.bought.find((f) => f.source === source && f.cache_key === key);
      if (mine !== undefined) lookups.push({ source, key, served: "stored", cents: Number(mine.cost_cents) });
      else if (later !== undefined) lookups.push({ source, key, served: "bought on the box", cents: Number(later.cost_cents) });
      else lookups.push({ source, key, served: "earlier pass", cents: 0 });
      return response;
    }
    const sameQuestion = own.filter((f) => f.source === source);
    if (SAME_QUESTION.has(source) && sameQuestion.length === 1) {
      lookups.push({ source, key, served: "stored answer, same evidence", cents: Number(sameQuestion[0]!.cost_cents) });
      return answer([{ payload: sameQuestion[0]!.payload, created_at: sameQuestion[0]!.created_at }]);
    }
    const asked = key.split("|")[0]!.split(",").filter(Boolean);
    const payload = asked.filter((keyword) => (known.get(keyword) ?? 0) > 0).map((keyword) => ({ keyword, searchVolume: known.get(keyword)! }));
    if (source === KEYWORDS && !a.o.live && payload.length > 0 && asked.every((keyword) => known.has(keyword))) {
      const price = PRICE_BOOK.KEYWORD_OVERVIEW_REQUEST_C + asked.length * PRICE_BOOK.KEYWORD_OVERVIEW_KEYWORD_C;
      lookups.push({ source, key, served: "assembled from stored reads", cents: price });
      return answer([{ payload, created_at: a.snapshot.scan.finished_at }]);
    }
    lookups.push({ source, key, served: "refused", cents: Number.NaN });
    return response;
  };
  return lookups;
}

// ── The run ────────────────────────────────────────────────────────────────

export async function main(o: Options): Promise<number> {
  const { snapshot, bought, boughtFile } = readSnapshot(o);
  const { scan } = snapshot;
  const siteId = snapshot.site.id;
  // D66: the replay measures in the country and language the site holds.
  const stored = snapshot.site as { country?: unknown; language?: unknown };
  const locale = localeOf(stored.country, stored.language) ?? DEFAULT_LOCALE;
  const start = startingState(snapshot);

  console.log(`Pass ${short(scan.id)} of ${o.site} (${scan.tier}, ${scan.created_at.slice(0, 16).replace("T", " ")} UTC, stored cost ${cents(Number(scan.cost_cents))})`);
  console.log(o.live ? `Live: calls the stored pass did not make are bought, up to ${cents(o.capCents)}.` : "Replay: 0¢, nothing is bought and nothing leaves this box.");
  console.log("\nThe state it starts from");
  for (const note of start.notes) console.log(`  · ${note}`);

  rebuild(o.root);
  psql(`insert into public.users (id, email, plan_status) values ('${OWNER}', 'replay@example.com', 'active');`);
  const loadedAt = new Date().toISOString();
  load("sites", [start.site]);
  if (snapshot.siteProfile !== null) {
    // The export leaves the logo's image out, so its other two parts go too.
    load("site_profiles", [without(snapshot.siteProfile, "logo_type", "logo_source")]);
  }
  load("site_profile_edits", snapshot.siteProfileEdits);
  load("scans", snapshot.otherScans.map((row) => ({ ...row, is_current: false })));
  load("scans", [{ ...scan, health: null }]);
  load("opportunities", start.opportunities);
  load("destinations", snapshot.destinations);
  const draftable = new Set(start.opportunities.map((row) => row.id));
  load("drafts", snapshot.drafts.filter((row) => draftable.has(row.opportunity_id)));
  const cacheRows = [...snapshot.fetches, ...bought.map((row) => ({ ...row, scan_id: scan.id }))];
  load("fetches", cacheRows.map((row) => (row.source === RANKED ? { ...row, payload: { total: (row.payload as Row).total, rows: (row.payload as Row).rows } } : row)));
  await waitForSchema();

  const boughtNow = (): (FetchRow & { id: string })[] =>
    JSON.parse(psql(`select coalesce(jsonb_agg(to_jsonb(f) order by f.created_at), '[]'::jsonb) from public.fetches f where f.created_at >= '${loadedAt}';`).trim() || "[]") as (FetchRow & { id: string })[];
  const lookups = watchNetwork({ o, snapshot, bought, spentLive: () => boughtNow().reduce((sum, row) => sum + Number(row.cost_cents), 0) });
  moveClock(new Date(scan.finished_at));

  // The pass's own lines are its log; the replay prints its findings below.
  const say = console.log;
  if (process.env.RK_PASS_VERBOSE === undefined) console.log = () => undefined;

  const report = readStoredReport(scan.report);
  const marketBefore = parseStoredMarket(start.site.market).current;
  const ownRankedNow = report.ownRanked.kind === "unmeasured" ? 0 : report.ownRanked.value;

  // 0. The measured searches (D65): what the pass would measure now.
  let measured: SelectedSearch[] = [];
  let measuredMarket = measuredMarketOf(marketBefore);
  let suggestions: SuggestionRow[] = [];
  const set0 = report.market.kind === "unmeasured" ? null : report.market.value;
  if (set0 !== null && marketBefore !== null && measuredMarket !== undefined) {
    const searched = marketSeeds(marketBefore);
    const synonyms = marketBefore.synonyms;
    const seeds = seedLadder(set0.profile, snapshot.site.category ?? marketBefore.category, synonyms, searched);
    const withFirst = searched.length > 0 ? searched : synonyms;
    const leading = seeds.slice(1).findIndex((seed) => !withFirst.some((x) => x.trim().toLowerCase() === seed.toLowerCase()));
    const upfront = Math.min(leading === -1 ? seeds.length - 1 : leading, SELECTION.maxExtraSeeds);
    const select = (limit?: number): SelectedSearch[] =>
      selectWidened({
        profile: set0.profile,
        suggestions,
        pool: set0.pool ?? [],
        ownRanked: ownRankedNow,
        category: snapshot.site.category ?? marketBefore.category,
        synonyms: [...synonyms, ...searched],
        ...(measuredMarket === undefined ? {} : { measured: measuredMarket }),
        ...(limit === undefined ? {} : { limit }),
      });
    await withStoredPassSpend({ scanId: scan.id, cap: "DEEP" }, async (cost) => {
      const first = await deriveMarketSet(cost, { seeds: seeds.slice(0, 1 + upfront), ownRanked: ownRankedNow, locale });
      if (first.kind !== "unmeasured") suggestions = [...first.value];
      measured = select();
      for (const seed of seeds.slice(1 + upfront, 1 + SELECTION.maxExtraSeeds)) {
        if (!isShort(measured)) break;
        const more = await deriveMarketSet(cost, { seeds: [seed], ownRanked: ownRankedNow, locale });
        if (more.kind !== "unmeasured") suggestions = [...suggestions, ...more.value.filter((row) => !suggestions.some((held) => held.keyword === row.keyword))];
        measured = select();
      }
      if (measuredMarket !== undefined && unjudged(measured, measuredMarket).length > 0) {
        const judged = await judgeSearchesForPass({ siteId, cost, market: marketBefore, searches: unjudged(select(BATTERY.QUESTIONS * 2), measuredMarket) });
        if (judged !== null) {
          measuredMarket = measuredMarketOf(judged);
          measured = select();
        }
      }
    });
  }

  // 1. Sizing.
  const serps: MarketSerp[] = [];
  for (const serp of report.serps) if (serp.kind !== "unmeasured") serps.push(serp.value as MarketSerp);
  const tracked = (await trackedRivals(siteId)) ?? [];
  const at = report.verdict.measuredAt;
  const ownRanked = ownRankedNow;
  let topTens = { inTopTens: 0, domains: [] as string[] };
  await withStoredPassSpend({ scanId: scan.id, cap: "DEEP" }, async (cost) => {
    const sized = await sizeRivals(cost, { rivals: tracked, ownRanked, at, locale });
    const alreadySized = new Set(sized.kind === "unmeasured" ? [] : sized.value.flatMap((size) => (size.state === "sized" && size.current ? [size.domain] : [])));
    topTens = serpDomainsToSize({ serps, ownDomain: o.site, market: marketBefore, answers: report.marketPrompts ?? [], alreadySized, max: SERP_RIVAL_SIZING.candidatesMax });
    await sizeRivals(cost, { rivals: topTens.domains, ownRanked, at, neverSizedBecause: "budget_reached", locale });
  });

  // 2. After the report: rivals, prompts, topics and prune, health.
  await afterDeepReport({ scanId: scan.id, siteId, domain: o.site, remeasure: true });
  console.log = say;

  // ── What it found ────────────────────────────────────────────────────────
  const after = JSON.parse(
    psql(
      `select jsonb_build_object('site', (select to_jsonb(s) from public.sites s where s.id = '${siteId}'), 'health', (select health from public.scans where id = '${scan.id}'), 'topics', (select coalesce(jsonb_agg(to_jsonb(o) order by o.created_at, o.id), '[]'::jsonb) from public.opportunities o where o.site_id = '${siteId}'));`
    )
  ) as { site: Row; health: unknown; topics: (Row & { id: string; target_query: string | null; status: string; volume: number | null; type: string; unready_reason: string | null; business_fit: number | null })[] };
  const market = parseStoredMarket(after.site.market).current;
  const rivals = market?.rivals ?? [];

  say("\nMarket");
  say(`  ${market?.category ?? "none"} · searched as "${market?.searchTerm ?? "—"}" (${(market?.terms ?? []).filter((t) => t.volume > 0).map((t) => `${t.term} ${t.volume}`).join(", ")})`);
  // D65: the searches the pass would measure now, beside the ones it did.
  const terms = measuredMarket?.terms ?? [];
  const wasMeasured = report.questions.kind === "unmeasured" ? [] : report.questions.value.map((q) => q.search);
  say(`\nMeasured searches: ${measured.length} now (the stored pass measured ${wasMeasured.length})`);
  for (const search of measured) {
    const verdict = search.term === true ? "a searched term of the market" : measuredMarket?.judged[searchKey(search.keyword)] === true ? "judged on the market" : "not judged";
    say(`  ${String(search.volume).padStart(6)}/mo  ${search.keyword} — ${verdict}`);
  }
  const reasons = { not_our_market: "uses a term from notOurMarket", brand: "only a rival's or another product's name", judged: "judged off the market", malformed: "not a search as it stands", elsewhere: "not asked of the place the business serves" } as const;
  for (const search of wasMeasured) {
    if (measured.some((now) => searchKey(now.keyword) === searchKey(search.keyword))) continue;
    const why = measuredMarket === undefined ? null : neverMeasured(search.keyword, measuredMarket);
    say(`  no longer measured: ${search.keyword} (${search.volume}/mo) — ${why === null ? "outranked by the searches above" : reasons[why]}`);
  }

  const rivalsBefore = marketBefore?.rivals ?? [];
  const stateAfter = parseStoredMarket(after.site.market);
  say("\nRivals, in the order the pass leaves them");
  for (const rival of rivals) say(`  ${rival.name} (${rival.volume ?? "unread"}) — ${rival.domain}`);
  say(`  before the pass: ${rivalsBefore.map((rival) => rival.name).join(", ") || "none"}`);
  if ((stateAfter.rivalsLeftOut ?? []).length > 0) say(`  left out by this pass, kept until a second pass leaves them out: ${stateAfter.rivalsLeftOut!.join(", ")}`);
  if ((stateAfter.rivalsWaiting ?? []).length > 0) say(`  waiting one pass: ${stateAfter.rivalsWaiting!.join(", ")}`);

  const pure = (lookup: Lookup): boolean => lookup.served !== "earlier pass";
  const sizing = lookups.filter((lookup) => lookup.source === RANKED);
  const reads = sizing.filter(pure);
  const storedReads = snapshot.fetches.filter((f) => f.scan_id === scan.id && f.source === RANKED && !f.cache_key.startsWith(`${o.site}|`));
  say(`\nSizing: ${reads.length} ranked_keywords reads (the stored pass made ${storedReads.length})`);
  say(`  ${tracked.length} rivals; ${topTens.inTopTens} other domains in the top tens, ${topTens.domains.length} on-market${topTens.domains.length === 0 ? "" : `: ${topTens.domains.join(", ")}`}`);
  for (const lookup of sizing) say(`  ${lookup.key.split("|")[0]} — ${lookup.served}${lookup.cents > 0 ? `, ${cents(lookup.cents)}` : ""}`);
  const dropped = storedReads.filter((row) => !sizing.some((lookup) => lookup.key === row.cache_key));
  if (dropped.length > 0) say(`  no longer sized: ${dropped.map((row) => row.cache_key.split("|")[0]).join(", ")}`);

  // The cost: the stored pass, less its calls this run did not make again,
  // plus the calls it never made.
  const replayed = new Set([RANKED, KEYWORDS, SUGGESTIONS, "market-searches", "rival-inference", "opportunity-typing", "topic-buyer-searches", "topic-typed", "topic-fit", "topic-same-question"]);
  const again = (row: FetchRow): boolean =>
    lookups.some((lookup) => lookup.source === row.source && (lookup.key === row.cache_key || lookup.served === "stored answer, same evidence"));
  const notAgain = snapshot.fetches.filter((f) => f.scan_id === scan.id && replayed.has(f.source) && !f.cache_key.startsWith(`${o.site}|`) && !again(f));
  const fresh = lookups.filter((lookup) => lookup.served === "bought on the box" || lookup.served === "assembled from stored reads");
  const refused = lookups.filter((lookup) => lookup.served === "refused");
  const now = boughtNow();
  const saved = notAgain.reduce((sum, row) => sum + Number(row.cost_cents), 0);
  // A refused call leaves a row that reserved its price: what it would cost,
  // never part of a replay's cost. A live run's rows are what it paid.
  const paid = o.live ? now : [];
  const wouldCost = o.live ? 0 : now.reduce((sum, row) => sum + Number(row.reserved_cents), 0);
  const added = fresh.reduce((sum, lookup) => sum + lookup.cents, 0) + paid.reduce((sum, row) => sum + Number(row.cost_cents), 0);
  const cost = Number(scan.cost_cents) - saved + added;
  say(`\nCost: ${cents(cost)} (stored pass ${cents(Number(scan.cost_cents))}, less ${cents(saved)} it no longer spends, plus ${cents(added)} it did not spend)`);
  const bySource = (rows: readonly { source: string; cents: number }[]): string =>
    [...rows.reduce((map, row) => map.set(row.source, (map.get(row.source) ?? 0) + row.cents), new Map<string, number>())].map(([source, sum]) => `${source} ${cents(sum)}`).join(", ");
  if (notAgain.length > 0) say(`  no longer spent: ${bySource(notAgain.map((row) => ({ source: row.source, cents: Number(row.cost_cents) })))}`);
  if (fresh.length + paid.length > 0) say(`  not spent by the stored pass: ${bySource([...fresh, ...paid.map((row) => ({ source: row.source, cents: Number(row.cost_cents) }))])}`);
  if (refused.length > 0) {
    const counted = [...refused.reduce((map, lookup) => map.set(lookup.source, (map.get(lookup.source) ?? 0) + 1), new Map<string, number>())];
    say(`  refused, so left unmeasured and not in the cost: ${counted.map(([source, n]) => `${source} ×${n}`).join(", ")} — about ${cents(wouldCost)} with --live`);
  }
  const weeklyFile = path.join(o.root, "scripts/pass/snapshot", `${o.site}.weekly.json`);
  let weeklyEstimate: number | null = null;
  if (existsSync(weeklyFile)) {
    const weekly = JSON.parse(readFileSync(weeklyFile, "utf8")) as { scan: string; cents: number; sizingCents: number };
    const afterReport = lookups.filter((lookup) => pure(lookup) && ["rival-inference", KEYWORDS].includes(lookup.source) && Number.isFinite(lookup.cents)).reduce((sum, lookup) => sum + lookup.cents, 0);
    const resize = PRICE_BOOK.RANKED_RIVAL_COST_C * (WEEKLY_RIVAL_RESIZES + topTens.domains.length);
    weeklyEstimate = weekly.cents - weekly.sizingCents + afterReport + resize;
    say(
      `  weekly-tier estimate: ${cents(weeklyEstimate)} — the last weekly pass (${weekly.scan}, ${cents(weekly.cents)}, ${cents(weekly.sizingCents)} of it sizing), plus this pass's rival conclusion and keyword read (${cents(afterReport)}), plus ${WEEKLY_RIVAL_RESIZES + topTens.domains.length} sizing read${WEEKLY_RIVAL_RESIZES + topTens.domains.length === 1 ? "" : "s"} in a week one falls due (${cents(resize)})`
    );
  }

  const health = parseHealth(after.health);
  say("\nHealth");
  for (const check of health?.checks ?? []) {
    say(`  ${check.pass ? "pass" : "FAIL"}  ${check.check} — ${check.detail}`);
    for (const item of check.items) say(`        ${item}`);
  }
  if (health === null) say("  none recorded");

  const before = new Map(start.opportunities.map((row) => [row.id as string, row]));
  const topics = after.topics.filter((row) => row.target_query !== null);
  say("\nTopics");
  for (const row of topics) {
    const was = before.get(row.id);
    const change = was === undefined ? "new" : was.status !== row.status ? `${String(was.status)} → ${row.status}` : row.status;
    const volume = row.volume === null ? "no volume" : `${row.volume}/mo`;
    if (was !== undefined && was.status === row.status && was.volume === row.volume && row.status !== "open") continue;
    say(`  ${change.padEnd(18)} ${row.target_query} — ${row.type}, ${volume}${row.unready_reason === "no_intent" || row.unready_reason === "low_fit" ? `, ${row.unready_reason}` : ""}${was !== undefined && was.volume !== row.volume ? " (volume read by this pass)" : ""}`);
  }

  const set = parsePromptSet(after.site.tracked_prompts);
  const names = rivals.map((rival) => rival.name);
  const ownNames = new Set(ownKeywords({ domain: o.site, siteName: snapshot.siteProfile?.site_name ?? null }));
  const everNamed = [...new Set([...names, ...Object.keys(market?.demand?.brands ?? {})])].filter((name) => !ownNames.has(name.toLowerCase()));
  const old = [snapshot.site.category ?? "", market?.job ?? ""].filter((phrase) => phrase.length > 8);
  const naming = set.prompts.filter((prompt) => prompt.kind === "comparison" || prompt.kind === "branded");
  const usesOld = set.prompts.filter((prompt) => old.some((phrase) => prompt.text.toLowerCase().includes(phrase.toLowerCase())));
  say(`\nPrompts: ${set.prompts.length} in force, ${naming.length} name rivals`);
  for (const prompt of naming) say(`  ${prompt.text}`);
  if (usesOld.length > 0) for (const prompt of usesOld) say(`  uses the category or the job: ${prompt.text}`);

  // ── The acceptance list (issue 1301) ─────────────────────────────────────
  const padded = (text: string): string => ` ${text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ")} `;
  const current = new Set(names.map((name) => name.toLowerCase()));
  const strangers = naming.filter((prompt) => everNamed.some((name) => !current.has(name.toLowerCase()) && name.length > 2 && padded(prompt.text).includes(padded(name))));
  const inOrder = rivals.every((rival, i) => i === 0 || (rivals[i - 1]!.volume ?? 0) >= (rival.volume ?? 0));
  const open = (query: string): boolean => topics.some((row) => row.target_query === query && row.status === "open");
  const comparisons = topics.filter((row) => row.status === "open" && row.type === "comparison_page");
  const withVolume = comparisons.filter((row) => row.volume !== null && row.volume > 0);
  const brandOnly = topics.filter((row) => row.status !== "dismissed" && everNamed.some((name) => padded(name) === padded(row.target_query ?? "")));
  const measuredTerms = terms.slice(0, SELECTION.maxMarketTerms);
  const offMarket = measured.filter((search) => search.term !== true && measuredMarket !== undefined && neverMeasured(search.keyword, measuredMarket) !== null);
  const notJudged = measuredMarket === undefined ? [] : unjudged(measured, measuredMarket);
  const leftOutBefore = parseStoredMarket(start.site.market).rivalsLeftOut ?? [];
  const droppedNow = rivalsBefore.map((rival) => rival.domain).filter((domain) => !rivals.some((rival) => rival.domain === domain));
  const enteredNow = rivals.map((rival) => rival.domain).filter((domain) => !rivalsBefore.some((rival) => rival.domain === domain));
  const checks: [boolean, string][] = [
    [rivals.length > 0 && inOrder, `rivals in demand order: ${rivals.map((rival) => `${rival.name}(${rival.volume ?? "?"})`).join(", ")}`],
    [reads.length <= 6, `ranked_keywords reads ≤ 6: ${reads.length}`],
    [cost <= 45, `pass cost ≤ 45¢: ${cents(cost)}`],
    [weeklyEstimate !== null && weeklyEstimate < 40, `weekly-tier estimate under 40¢: ${weeklyEstimate === null ? "no stored weekly pass to estimate from" : cents(weeklyEstimate)}`],
    [health !== null && health.checks.length === 5 && health.checks.every((check) => check.pass), `all 5 health checks pass: ${health?.checks.filter((check) => check.pass).length ?? 0} of ${health?.checks.length ?? 0}`],
    [!before.has(topics.find((row) => row.target_query === "otterly alternatives")?.id ?? "") || open("otterly alternatives"), `"otterly alternatives" is kept: ${topics.find((row) => row.target_query === "otterly alternatives")?.status ?? "not held"}`],
    [brandOnly.length === 0, `no topic is only a rival's brand name${brandOnly.length === 0 ? "" : `: ${brandOnly.map((row) => row.target_query).join(", ")}`}`],
    [comparisons.length > 0 && withVolume.length > 0, `comparison topics carry volumes: ${withVolume.length} of ${comparisons.length} open (${comparisons.map((row) => `${row.target_query} ${row.volume ?? "none"}`).join(", ")})`],
    [set.prompts.length === 25 && strangers.length === 0 && usesOld.length === 0, `the ${set.prompts.length} prompts name only current rivals and none uses the old category or job`],
    [refused.length === 0, `every call was answered: ${refused.length} refused`],
    // ── Issue 1303 (D65) ──
    [
      measuredTerms.length > 0 && measuredTerms.every((term) => measured.some((search) => search.term === true && searchKey(search.keyword) === searchKey(term.term))),
      `the measured searches hold the market's searched terms: ${measuredTerms.map((term) => `${term.term} ${term.volume}`).join(", ") || "the market holds none"}`,
    ],
    [offMarket.length === 0, `no measured search is off the market or only a brand${offMarket.length === 0 ? "" : `: ${offMarket.map((search) => search.keyword).join(", ")}`}`],
    [notJudged.length === 0, `every other measured search was judged on the market${notJudged.length === 0 ? "" : `; not judged: ${notJudged.join(", ")}`}`],
    [
      droppedNow.every((domain) => leftOutBefore.includes(domain)) && rivals.length <= 5,
      `the rivals are stable: ${droppedNow.length === 0 && enteredNow.length === 0 ? "the same set as before the pass" : `dropped ${droppedNow.join(", ") || "none"}, entered ${enteredNow.join(", ") || "none"}`}`,
    ],
  ];
  say("\nAcceptance");
  for (const [ok, line] of checks) say(`  ${ok ? "✓" : "✗"} ${line}`);

  if (paid.length > 0) {
    for (const row of now) appendSpend({ script: "pass", source: row.source, cents: Number(row.cost_cents), billed: row.billed_cents === null || row.billed_cents === undefined ? undefined : Number(row.billed_cents) });
    const kept = [...bought, ...now.filter((row) => Number(row.cost_cents) > 0).map((row) => ({ ...without(row, "id"), scan_id: `issue-box:${short(scan.id)}` }) as FetchRow)];
    writeFileSync(boughtFile, `${JSON.stringify(kept, null, 1)}\n`);
    say(`\nBought now: ${cents(now.reduce((sum, row) => sum + Number(row.cost_cents), 0))} in ${now.length} calls, kept in ${path.relative(o.root, boughtFile)} and written to the spend log.`);
  }
  return checks.every(([ok]) => ok) ? 0 : 1;
}
