// scripts/panel/run.ts — `npm run panel` (SPEC §0, owner 2026-10-07, issue
// 1304): the customer panel, the acceptance test for every change to market
// understanding, the knowledge base, rivals, terms, measured searches and
// topics.
//
// # What it runs
//
// For each site of `docs/walk/panel/sites.json`, a paying site's first pass
// — the product's own `runDeepPass`, with nothing of it rewritten here: the
// site is read, its market concluded with its terms (D49), the searches
// seeded and asked, the knowledge base built, the rivals concluded with
// their demand (D50) and the topics derived. Two of the pass's steps are not
// run: the first page is not written and no second pass is started for a
// rival change. A first pass asks no tracked prompts, so the 25 are not
// bought.
//
// # Where it runs
//
// The repository's own local database (`scripts/db-substrate/`), rebuilt
// from `supabase/migrations`. The run holds no production key, and a request
// to any host but the local database, the two vendors and the site being
// read is refused: nothing is written to production, no mail is sent and no
// event is recorded.
//
// # What it spends
//
// The vendors and the model are called live, up to `--cap-cents` for the
// whole run. A site is started only while the cap still holds what a site
// has cost so far (`FIRST_SITE_CENTS` before one has run); a site the cap
// does not reach is listed as not run. Past the cap every paid request is
// refused. Each paid call is written to the box's spend log (D57).
//
// What a run buys from the search vendor is kept in
// `scripts/panel/evidence/<domain>.json` and loaded by the next run, so a
// later run buys only what the code under test asks differently, and the
// model's own calls (D34: stored evidence first).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import dns from "node:dns";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseStoredMarket } from "@/lib/market/infer/stored";
import { runDeepPass, type PassStep } from "@/lib/scan/deep/run";
import { parseHealth } from "@/lib/scan/health";
import { readStoredReport } from "@/lib/scan/report";
import { storedKnowledgeOf } from "@/lib/site-profile/knowledge/store";
import { appendSpend } from "../spend-log.mjs";
import { checkSite, defectsByKind, type CheckResult, type PanelSite, type SiteResult, type VendorLocale } from "./checks";

export interface Options {
  root: string;
  /** Empty runs every site of the panel. */
  sites: readonly string[];
  capCents: number;
  /** The run's date, `YYYY-MM-DD`: the name of its two result files. */
  date: string;
  /** Continue that date's run: the sites it holds are kept as they were
   *  run, their spend counts against the cap, and the rest are run. */
  resume: boolean;
  /** Buy nothing and run nothing: judge that date's stored results again
   *  with the checks as they are now. */
  recheck: boolean;
}

type Row = Record<string, unknown>;
type FetchRow = Row & { scan_id: string; source: string; cache_key: string; cost_cents: number | string; created_at: string };

/** The scan the stored evidence is loaded under: no site's own, so it is
 *  found by the cache and never counted as a run's spend. */
const EVIDENCE_SCAN = "00000000-0000-4000-8000-0000000e71de";
/** What a site is assumed to cost before one has run, in cents. */
const FIRST_SITE_CENTS = 30;
/** The hosts a paid call goes to. */
const VENDOR_HOSTS = new Set(["api.dataforseo.com", "api.anthropic.com"]);
/** The search vendor's reads are kept between runs; the model's are not —
 *  the model is what a change is tested through. */
const KEPT_SOURCE_RE = /^(dataforseo_labs|serp|ai_optimization)\//;

const cents = (n: number): string => `${n.toFixed(2)}¢`;

/** A UUID named by the domain, so a site's cache keys are the same in every
 *  run and its stored evidence is found. */
function named(name: string): string {
  const hex = createHash("sha1").update(name).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
const siteIdOf = (domain: string): string => named(`reachkit/panel/${domain}`);
/** An account holds one site, so each panel site has its own. */
const ownerIdOf = (domain: string): string => named(`reachkit/panel/owner/${domain}`);

// ── The local database ─────────────────────────────────────────────────────

function psql(sql: string): string {
  const url = process.env.DATABASE_URL;
  if (url === undefined || !/@(127\.0\.0\.1|localhost)[:/]/.test(url)) {
    throw new Error("scripts/panel/run.ts: DATABASE_URL does not name the local database; nothing was run.");
  }
  return execFileSync("psql", [url, "-q", "-v", "ON_ERROR_STOP=1", "-At", "-f", "-"], {
    input: sql,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, PGOPTIONS: "-c client_min_messages=warning" },
  });
}

const json = <T>(sql: string): T => JSON.parse(psql(sql).trim() || "null") as T;

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

// ── Stored evidence ────────────────────────────────────────────────────────

const evidenceFile = (root: string, domain: string): string => path.join(root, "scripts/panel/evidence", `${domain}.json`);

function loadEvidence(root: string, domain: string): number {
  const file = evidenceFile(root, domain);
  if (!existsSync(file)) return 0;
  const rows = JSON.parse(readFileSync(file, "utf8")) as Row[];
  if (rows.length === 0) return 0;
  // The file holds no `scan_id` (`keepEvidence` drops it), and the cache
  // reads on source, key, policy version and age alone: the rows are put
  // under the evidence scan, and the column is named in the insert.
  const stored = rows.map((row) => ({ ...row, scan_id: EVIDENCE_SCAN }));
  const columns = [...new Set(stored.flatMap((row) => Object.keys(row)))].map((column) => `"${column}"`).join(", ");
  const tag = "$evidence$";
  psql(
    `set session_replication_role = replica; insert into public.fetches (${columns}) select ${columns} from jsonb_populate_recordset(null::public.fetches, ${tag}${JSON.stringify(stored)}${tag}::jsonb);`
  );
  return rows.length;
}

/** The search vendor's paid reads of this site, the ones loaded and the
 *  ones this run bought, as the next run loads them. */
function keepEvidence(root: string, domain: string, loaded: readonly Row[], bought: readonly FetchRow[]): void {
  const fresh = bought.filter((row) => KEPT_SOURCE_RE.test(row.source) && Number(row.cost_cents) > 0);
  if (fresh.length === 0) return;
  const key = (row: Row): string => `${String(row.source)}|${String(row.cache_key)}`;
  const kept = new Map<string, Row>();
  for (const row of loaded) kept.set(key(row), row);
  for (const row of fresh) kept.set(key(row), Object.fromEntries(Object.entries(row).filter(([column]) => column !== "id" && column !== "scan_id")));
  mkdirSync(path.dirname(evidenceFile(root, domain)), { recursive: true });
  writeFileSync(evidenceFile(root, domain), `${JSON.stringify([...kept.values()])}\n`);
}

// ── The network ────────────────────────────────────────────────────────────

interface Watch {
  /** The site being run, whose reads the locales belong to. */
  current: { domain: string; locales: Map<string, VendorLocale> } | null;
  refused: number;
}

/**
 * Every request the process makes with `fetch`. One to the local database
 * goes through. One to a vendor goes through while the cap holds, and its
 * market is noted. One to anywhere else is refused: the run reaches no
 * production service. The site's own pages are read by the product's
 * fetcher, which does not use `fetch`.
 */
function watchNetwork(o: Options, spent: () => number): Watch {
  const watch: Watch = { current: null, refused: 0 };
  const local = process.env.SUPABASE_URL ?? "";
  const real = globalThis.fetch;
  globalThis.fetch = async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.href.startsWith(local)) return real(input, init);
    if (!VENDOR_HOSTS.has(url.host)) throw new Error(`panel: ${url.host} is not contacted`);
    if (spent() >= o.capCents) {
      watch.refused += 1;
      throw new Error(`panel: the ${cents(o.capCents)} cap is spent; ${url.host} is not contacted`);
    }
    if (url.host === "api.dataforseo.com" && watch.current !== null && typeof init?.body === "string") {
      try {
        const task = (JSON.parse(init.body) as Row[])[0] ?? {};
        if (typeof task.location_name === "string" && typeof task.language_code === "string") {
          watch.current.locales.set(`${task.location_name}|${task.language_code}`, { location: task.location_name, language: task.language_code });
        }
      } catch {
        // A body that is not one task names no market.
      }
    }
    return real(input, init);
  };
  return watch;
}

// ── One site ───────────────────────────────────────────────────────────────

/** The pass's own steps, less the two the panel does not run. */
const step: PassStep = async (name, body) => {
  if (name === "first-draft") return "completed" as never;
  if (name === "rivals-remeasure") return null as never;
  return body();
};

interface Stored {
  site: Row | null;
  scan: (Row & { id: string; status: string; stopped_reason: string | null; report: unknown; health: unknown }) | null;
  profile: Row | null;
  topics: Row[];
}

function readSite(siteId: string, domain: string): Stored {
  return json<Stored>(
    `select jsonb_build_object(
       'site', (select to_jsonb(s) from public.sites s where s.id = '${siteId}'),
       'scan', (select to_jsonb(c) from public.scans c where c.site_id = '${siteId}' order by c.created_at desc limit 1),
       'profile', (select to_jsonb(p) - 'logo' from public.site_profiles p where p.domain = '${domain}' limit 1),
       'topics', (select coalesce(jsonb_agg(to_jsonb(o) order by o.created_at, o.id), '[]'::jsonb) from public.opportunities o where o.site_id = '${siteId}'));`
  );
}

interface SiteRun {
  result: SiteResult;
  checks: CheckResult[];
  health: { check: string; pass: boolean; detail: string }[];
  /** The pass's own log lines that say something was not measured or failed. */
  events: Row[];
  seconds: number;
  evidenceLoaded: number;
}

async function runSite(o: Options, site: PanelSite, watch: Watch, quiet: (lines: Row[]) => () => void): Promise<SiteRun> {
  const siteId = siteIdOf(site.domain);
  const startedAt = new Date().toISOString();
  const started = Date.now();
  const loadedRows = existsSync(evidenceFile(o.root, site.domain)) ? (JSON.parse(readFileSync(evidenceFile(o.root, site.domain), "utf8")) as Row[]) : [];
  const evidenceLoaded = loadEvidence(o.root, site.domain);
  psql(
    `insert into public.users (id, email, plan_status) values ('${ownerIdOf(site.domain)}', 'panel+${siteId}@example.com', 'active');
     insert into public.sites (id, user_id, domain) values ('${siteId}', '${ownerIdOf(site.domain)}', '${site.domain}');`
  );

  const locales = new Map<string, VendorLocale>();
  watch.current = { domain: site.domain, locales };
  const lines: Row[] = [];
  const loud = quiet(lines);
  try {
    await runDeepPass({ siteId, domain: site.domain, step });
  } catch (error) {
    lines.push({ event: "panel_pass_threw", because: error instanceof Error ? error.message : String(error) });
  } finally {
    loud();
    watch.current = null;
  }

  const bought = boughtSince(startedAt);
  for (const row of bought) appendSpend({ script: "panel", source: row.source, cents: Number(row.cost_cents) });
  keepEvidence(o.root, site.domain, loadedRows, bought);
  return collect({ site, bought, locales: [...locales.values()], lines, seconds: Math.round((Date.now() - started) / 1000), evidenceLoaded });
}

/** Every call the run has ledgered since an instant, the stored evidence aside. */
function boughtSince(at: string): FetchRow[] {
  return json<FetchRow[]>(
    `select coalesce(jsonb_agg(to_jsonb(f) order by f.created_at), '[]'::jsonb) from public.fetches f where f.created_at >= '${at}' and f.scan_id <> '${EVIDENCE_SCAN}';`
  );
}

/**
 * What a finished pass left in the local database, as the panel's result
 * and its checks. It buys nothing and writes nothing, so a pass whose run
 * stopped after it can be read again from the database it left.
 */
export async function collect(a: { site: PanelSite; bought: readonly FetchRow[]; locales: readonly VendorLocale[]; lines: readonly Row[]; seconds: number; evidenceLoaded: number }): Promise<SiteRun> {
  const { site } = a;
  const stored = readSite(siteIdOf(site.domain), site.domain);
  const costBySource: Record<string, number> = {};
  for (const row of a.bought) {
    const paid = Number(row.cost_cents);
    if (paid > 0) costBySource[row.source] = (costBySource[row.source] ?? 0) + paid;
  }
  const market = parseStoredMarket(stored.site?.market).current;
  const deadRivals: string[] = [];
  for (const rival of market?.rivals ?? []) {
    const resolves = await dns.promises.lookup(rival.domain).then(() => true, () => false);
    if (!resolves) deadRivals.push(rival.domain);
  }
  const report = stored.scan?.report === null || stored.scan?.report === undefined ? null : readStoredReport(stored.scan.report);
  const knowledge = storedKnowledgeOf(stored.profile?.knowledge);
  const result: SiteResult = {
    site,
    siteName: typeof stored.profile?.site_name === "string" ? stored.profile.site_name : null,
    status: stored.scan?.status ?? null,
    stoppedReason: stored.scan?.stopped_reason ?? null,
    market,
    deadRivals,
    locales: [...a.locales],
    searches: report === null || report.questions.kind === "unmeasured" ? [] : report.questions.value.map((question) => question.search.keyword),
    knowledgePages: knowledge.pages.length,
    questions: [...new Set(knowledge.pages.flatMap((page) => page.reading.questions))],
    audience: [...new Set(knowledge.pages.flatMap((page) => page.reading.audience))],
    topics: stored.topics
      .filter((row) => typeof row.target_query === "string" && row.target_query !== "")
      .map((row) => ({
        query: row.target_query as string,
        status: String(row.status),
        type: String(row.type),
        fit: typeof row.business_fit === "number" ? row.business_fit : null,
        volume: typeof row.volume === "number" ? row.volume : null,
      })),
    cents: Object.values(costBySource).reduce((sum, paid) => sum + paid, 0),
    costBySource,
  };
  const health = (parseHealth(stored.scan?.health)?.checks ?? []).map((check) => ({ check: check.check, pass: check.pass, detail: check.detail }));
  const telling = /unmeasured|failed|undeterminable|skipped|threw|too_small|refus/;
  return {
    result,
    checks: checkSite(result),
    health,
    events: a.lines.filter((line) => typeof line.event === "string" && telling.test(JSON.stringify(line))).slice(0, 40),
    seconds: a.seconds,
    evidenceLoaded: a.evidenceLoaded,
  };
}

// ── The readable result ────────────────────────────────────────────────────

const MARK: Record<CheckResult["verdict"], string> = { pass: "pass", fail: "FAIL", review: "review" };

function markdown(a: { o: Options; runs: readonly SiteRun[]; notRun: readonly PanelSite[]; spent: number; commit: string }): string {
  const { runs } = a;
  const out: string[] = [];
  const failed = runs.reduce((sum, run) => sum + run.checks.filter((check) => check.verdict === "fail").length, 0);
  const review = runs.reduce((sum, run) => sum + run.checks.filter((check) => check.verdict === "review").length, 0);
  out.push(`# Customer panel — ${a.o.date}`, "");
  out.push(`\`npm run panel\` on \`${a.commit}\`. ${runs.length} of ${runs.length + a.notRun.length} sites run, ${cents(a.spent)} of the ${cents(a.o.capCents)} cap spent.`);
  out.push(`${failed} checks failed and ${review} are for a person to read.`, "");
  if (a.notRun.length > 0) out.push(`**Not run, the cap did not reach them:** ${a.notRun.map((site) => `${site.domain} (${site.kind})`).join(", ")}.`, "");

  out.push("## Sites", "", "| Site | Kind | Pass | Failed | To read | Cost |", "|---|---|---|---|---|---|");
  for (const run of runs) {
    const fails = run.checks.filter((check) => check.verdict === "fail").length;
    const reads = run.checks.filter((check) => check.verdict === "review").length;
    out.push(`| ${run.result.site.domain} | ${run.result.site.kind} | ${run.result.status ?? "no report"}${run.result.stoppedReason === null || run.result.stoppedReason === "complete" ? "" : ` (${run.result.stoppedReason})`} | ${fails} | ${reads} | ${cents(run.result.cents)} |`);
  }

  out.push("", "## Defects, by kind", "");
  const defects = defectsByKind(runs.map((run) => ({ domain: run.result.site.domain, checks: run.checks })));
  if (defects.length === 0) out.push("None.");
  for (const defect of defects) {
    out.push(`### ${defect.check} — ${defect.sites.length} of ${runs.length} sites`, "");
    for (const site of defect.sites) {
      out.push(`- **${site.domain}**: ${site.detail}`);
      for (const item of site.items) out.push(`  - ${item}`);
    }
    out.push("");
  }

  out.push("## To read by hand", "");
  let anything = false;
  for (const run of runs) {
    const reads = run.checks.filter((check) => check.verdict === "review");
    if (reads.length === 0) continue;
    anything = true;
    out.push(`### ${run.result.site.domain}`, "");
    for (const check of reads) {
      out.push(`- ${check.check}: ${check.detail}`);
      for (const item of check.items) out.push(`  - ${item}`);
    }
    out.push("");
  }
  if (!anything) out.push("Nothing.", "");

  out.push("## Each site", "");
  for (const run of runs) {
    const { result } = run;
    const market = result.market;
    out.push(`### ${result.site.domain} — ${result.site.kind} (${result.site.country}, ${result.site.language})`, "");
    out.push(`- **Category:** ${market?.category ?? "none"}${market === null ? "" : ` — ${market.categoryReason}`}`);
    out.push(`- **Buyer:** ${market?.buyer ?? "none"}`);
    out.push(`- **Job:** ${market?.job ?? "none"}`);
    out.push(`- **Search term:** ${market?.searchTerm ?? "none"}`);
    out.push(`- **Terms:** ${(market?.terms ?? []).map((term) => `${term.term} ${term.volume}${term.polluted === true ? " (polluted)" : ""}`).join(", ") || "none"}`);
    out.push(`- **Read in:** ${result.locales.map((locale) => `${locale.location} / ${locale.language}`).join(", ") || "no vendor read seen"}`);
    out.push(`- **Not its market:** ${(market?.notOurMarket ?? []).join(", ") || "none"}`);
    out.push(`- **Rivals:** ${(market?.rivals ?? []).map((rival) => `${rival.name} (${rival.domain}, ${rival.volume ?? "unread"}/mo, ${rival.basis})`).join("; ") || "none"}`);
    out.push(`- **Measured searches (${result.searches.length}):** ${result.searches.join("; ") || "none"}`);
    out.push(`- **Knowledge base:** ${result.knowledgePages === null ? "pages read not recorded" : `read from ${result.knowledgePages} pages`}`);
    out.push(`- **Knowledge-base audience (${result.audience.length}):** ${result.audience.slice(0, 8).join("; ") || "none"}`);
    out.push(`- **Knowledge-base questions (${result.questions.length}):** ${result.questions.slice(0, 12).join(" · ") || "none"}`);
    const open = result.topics.filter((topic) => topic.status === "open");
    out.push(`- **Topics (${open.length} open of ${result.topics.length}):** ${open.map((topic) => `${topic.query} (${topic.type}, ${topic.volume ?? "no volume"}${topic.fit === null ? "" : `, fit ${topic.fit}`})`).join("; ") || "none"}`);
    out.push(`- **Cost:** ${cents(result.cents)} in ${run.seconds}s — ${Object.entries(result.costBySource).sort((x, y) => y[1] - x[1]).map(([source, paid]) => `${source} ${cents(paid)}`).join(", ") || "nothing bought"}${run.evidenceLoaded === 0 ? "" : `; ${run.evidenceLoaded} stored vendor reads loaded`}`);
    out.push("", "| Check | Result | Detail |", "|---|---|---|");
    for (const check of run.checks) out.push(`| ${check.check} | ${MARK[check.verdict]} | ${check.detail.replace(/\|/g, "/")} |`);
    if (run.health.length > 0) out.push("", `The pass's own health checks (D58): ${run.health.map((check) => `${check.pass ? "pass" : "FAIL"} ${check.check}`).join(", ")}.`);
    out.push("");
  }
  return `${out.join("\n")}\n`;
}

// ── The run ────────────────────────────────────────────────────────────────

interface StoredRun {
  commit: string;
  capCents: number;
  spentCents: number;
  sites: (SiteResult & { health?: SiteRun["health"]; events?: Row[]; seconds?: number; evidenceLoaded?: number })[];
}

/** A date's stored results, each judged again by the checks as they are
 *  now and against the panel as it is now. A site no longer on the panel is
 *  left out. */
function storedRuns(file: string, panel: readonly PanelSite[]): { runs: SiteRun[]; spent: number; commit: string; capCents: number | null } {
  if (!existsSync(file)) return { runs: [], spent: 0, commit: "unknown", capCents: null };
  const stored = JSON.parse(readFileSync(file, "utf8")) as StoredRun;
  const runs: SiteRun[] = [];
  for (const held of stored.sites) {
    const site = panel.find((entry) => entry.domain === held.site.domain);
    if (site === undefined) continue;
    const { health, events, seconds, evidenceLoaded, ...rest } = held;
    const result: SiteResult = {
      site,
      siteName: rest.siteName,
      status: rest.status,
      stoppedReason: rest.stoppedReason,
      market: rest.market,
      deadRivals: rest.deadRivals ?? [],
      locales: rest.locales,
      searches: rest.searches,
      knowledgePages: rest.knowledgePages ?? null,
      questions: rest.questions,
      audience: rest.audience,
      topics: rest.topics,
      cents: rest.cents,
      costBySource: rest.costBySource,
    };
    runs.push({ result, checks: checkSite(result), health: health ?? [], events: events ?? [], seconds: seconds ?? 0, evidenceLoaded: evidenceLoaded ?? 0 });
  }
  return { runs, spent: stored.spentCents, commit: stored.commit, capCents: stored.capCents };
}

function write(a: { o: Options; dir: string; runs: readonly SiteRun[]; notRun: readonly PanelSite[]; spent: number; commit: string; refused: number }): { failed: number; review: number } {
  const { runs, notRun } = a;
  const defects = defectsByKind(runs.map((run) => ({ domain: run.result.site.domain, checks: run.checks })));
  const stem = path.join(a.dir, a.o.date);
  writeFileSync(
    `${stem}.json`,
    `${JSON.stringify({ date: a.o.date, commit: a.commit, capCents: a.o.capCents, spentCents: Math.round(a.spent * 10000) / 10000, refusedAtCap: a.refused, notRun: notRun.map((site) => site.domain), defects, sites: runs.map((run) => ({ ...run.result, checks: run.checks, health: run.health, events: run.events, seconds: run.seconds, evidenceLoaded: run.evidenceLoaded })) }, null, 1)}\n`
  );
  writeFileSync(`${stem}.md`, markdown({ o: a.o, runs, notRun, spent: a.spent, commit: a.commit }));
  return {
    failed: runs.reduce((sum, run) => sum + run.checks.filter((check) => check.verdict === "fail").length, 0),
    review: runs.reduce((sum, run) => sum + run.checks.filter((check) => check.verdict === "review").length, 0),
  };
}

function printChecks(say: (line: string) => void, run: SiteRun): void {
  for (const check of run.checks) {
    say(`  ${MARK[check.verdict].padEnd(6)} ${check.check} — ${check.detail}`);
    for (const item of check.items) say(`           ${item}`);
  }
  say(`  cost   ${cents(run.result.cents)}`);
}

function readPanel(o: Options): { dir: string; panel: PanelSite[]; sites: PanelSite[] } {
  const dir = path.join(o.root, "docs/walk/panel");
  const panel = (JSON.parse(readFileSync(path.join(dir, "sites.json"), "utf8")) as { sites: PanelSite[] }).sites;
  const unknown = o.sites.filter((domain) => !panel.some((site) => site.domain === domain));
  if (unknown.length > 0) throw new Error(`Not on the panel: ${unknown.join(", ")}. The panel is docs/walk/panel/sites.json.`);
  return { dir, panel, sites: o.sites.length === 0 ? panel : panel.filter((site) => o.sites.includes(site.domain)) };
}

/** `--recheck`: a date's stored results under the checks as they are now.
 *  No database, no vendor, 0¢. */
export function recheck(o: Options): number {
  const { dir, panel, sites } = readPanel(o);
  const file = path.join(dir, `${o.date}.json`);
  if (!existsSync(file)) throw new Error(`No stored run at ${file}.`);
  const held = storedRuns(file, panel);
  const runs = held.runs.filter((run) => sites.some((site) => site.domain === run.result.site.domain));
  const notRun = panel.filter((site) => !held.runs.some((run) => run.result.site.domain === site.domain));
  console.log(`Customer panel, ${o.date}: ${runs.length} stored sites judged again. 0¢, nothing is bought.`);
  for (const run of runs) {
    console.log(`\n${run.result.site.domain} — ${run.result.site.kind}`);
    printChecks(console.log, run);
  }
  const { failed, review } = write({ o: { ...o, capCents: held.capCents ?? o.capCents }, dir, runs: held.runs, notRun, spent: held.spent, commit: held.commit, refused: 0 });
  console.log(`\nPanel: ${held.runs.length} of ${panel.length} sites held, ${failed} checks failed, ${review} to read by hand.`);
  return failed === 0 && notRun.length === 0 ? 0 : 1;
}

export async function main(o: Options): Promise<number> {
  const { dir, panel, sites: asked } = readPanel(o);
  const carried = o.resume ? storedRuns(path.join(dir, `${o.date}.json`), panel) : { runs: [], spent: 0, commit: "unknown", capCents: null };
  const sites = asked.filter((site) => !carried.runs.some((run) => run.result.site.domain === site.domain));

  rebuild(o.root);
  await waitForSchema();

  const runStartedAt = new Date().toISOString();
  // What the date's earlier run spent is spent of this cap too.
  const spent = (): number =>
    carried.spent + Number(psql(`select coalesce(sum(cost_cents), 0) from public.fetches where created_at >= '${runStartedAt}' and scan_id <> '${EVIDENCE_SCAN}';`).trim() || "0");
  const watch = watchNetwork(o, spent);

  // The pass's own lines are its log. They are kept, not printed.
  const say = console.log;
  const quiet = (lines: Row[]) => {
    if (process.env.RK_PANEL_VERBOSE !== undefined) return () => undefined;
    const warn = console.warn;
    const error = console.error;
    const keep = (...args: unknown[]): void => {
      try {
        lines.push(JSON.parse(String(args[0])) as Row);
      } catch {
        // Not one of the pass's events.
      }
    };
    console.log = keep;
    console.warn = keep;
    // The job platform's client reports each push the run refused.
    console.error = keep;
    return () => {
      console.log = say;
      console.warn = warn;
      console.error = error;
    };
  };

  let commit = "unknown";
  try {
    commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: o.root, encoding: "utf8" }).trim();
  } catch {
    // Not a checkout.
  }
  say(`Customer panel: ${sites.length} sites, live, up to ${cents(o.capCents)}. Nothing is written to production.`);
  if (carried.runs.length > 0) say(`Continuing ${o.date}: ${carried.runs.length} sites are kept as they ran, and their ${cents(carried.spent)} counts against the cap.`);
  const runs: SiteRun[] = [...carried.runs];
  const notRun: PanelSite[] = [];
  for (const site of sites) {
    const sofar = spent();
    const need = runs.length === 0 ? FIRST_SITE_CENTS : runs.reduce((sum, run) => sum + run.result.cents, 0) / runs.length;
    if (o.capCents - sofar < need) {
      notRun.push(site);
      say(`\n${site.domain} — not run: ${cents(o.capCents - sofar)} is left of the cap and a site has cost ${cents(need)}.`);
      continue;
    }
    say(`\n${site.domain} — ${site.kind}`);
    const run = await runSite(o, site, watch, quiet);
    runs.push(run);
    // Written after every site: a run that stops keeps what it bought.
    write({ o, dir, runs, notRun: panel.filter((entry) => !runs.some((held) => held.result.site.domain === entry.domain)), spent: spent(), commit, refused: watch.refused });
    say(`  pass: ${run.result.status ?? "no report"}${run.result.stoppedReason === null ? "" : ` (${run.result.stoppedReason})`} in ${run.seconds}s`);
    printChecks(say, run);
  }

  const total = spent();
  // A site of the panel this run neither ran nor was asked for is not run either.
  const missing = panel.filter((site) => !runs.some((run) => run.result.site.domain === site.domain));
  const { failed, review } = write({ o, dir, runs, notRun: missing, spent: total, commit, refused: watch.refused });
  const stem = path.join(dir, o.date);
  say(`\nPanel: ${runs.length} of ${panel.length} sites run, ${failed} checks failed, ${review} to read by hand, ${cents(total)} of ${cents(o.capCents)} spent.`);
  if (missing.length > 0) say(`Not run: ${missing.map((site) => site.domain).join(", ")}.`);
  say(`Written to ${path.relative(o.root, stem)}.json and .md, and to the spend log.`);
  return failed === 0 && missing.length === 0 ? 0 : 1;
}
