// scripts/free-scan/run.ts — `npm run free-scan` (issue 1438): the free scan
// a stranger runs from the landing page, on named sites, off production.
//
// # What it runs
//
// Per site, what `POST /api/scan` does with a domain it admits: the slot is
// claimed (`claimFreeScanSlot`, one network per site), and the product's own
// `runScan({ domain, tier: "free" })` runs, unmodified, under the pass's own
// 50 s ceiling and `CAPS.FREE_C`, raced against the route's request budget
// exactly as `startPipeline` races it. Nothing of the pass is rewritten here.
//
// # Where it runs
//
// The repository's own local database (`scripts/local-run.mjs`). A request
// to any host but the local database and the two vendors is refused and
// counted; the site's own pages are read by the product's fetcher, which
// does not use `fetch`. Nothing is written to production.
//
// # What it keeps
//
// Per site, what the stranger would be shown (the score, its four drivers
// or why each is unmeasured, the questions, the rivals, the local pack) and
// the rows the production re-score reads (`rescoreRow`, issue 1433), so
// `--recheck` scores the stored scan again with later code for 0¢.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CAPS, TIMING } from "@/lib/config/constants";
import { offline } from "@/lib/egress/offline";
import { couldBeChallenge } from "@/lib/measure/challenge";
import { promptSiteName } from "@/lib/market/prompts/generate";
import { isOwnDomain } from "@/lib/market/rivals/domains";
import type { Measured } from "@/lib/measure/measured";
import { claimFreeScanSlot, networkKeyOf } from "@/lib/scan/admission";
import { parseDomain } from "@/lib/scan/domain";
import { readStoredReport, type StoredReport } from "@/lib/scan/report";
import { databaseRescore, moves, rescoreRow, type StoredRead, type StoredScanRow } from "@/lib/scan/rescore-run";
import type { StoredAnswer } from "@/lib/scan/rescore";
import { storedSiteName } from "@/lib/site-profile/site-name";
import { commitOf, psql, rebuild, waitForSchema } from "../local-run.mjs";
import { appendSpend } from "../spend-log.mjs";

export interface Options {
  root: string;
  sites: readonly string[];
  capCents: number;
  /** `YYYY-MM-DD`: the name of the run's files. */
  date: string;
  recheck: boolean;
}

type Row = Record<string, unknown>;

/** What a stranger is shown of one site, as this run read it. */
export interface SiteResult {
  domain: string;
  status: string | null;
  stoppedReason: string | null;
  score: number | null;
  band: string | null;
  limiting: string | null;
  /** Each of the four drivers: its value, or why it was not measured. */
  drivers: Record<string, string>;
  /** The score's missing factors, as the report names them. */
  missing: string[];
  locale: string;
  statedPlace: string | null;
  /** The town the pass measured in, which rule found it, and where Google
   *  was read from (issue 1441). */
  measuredIn: string | null;
  category: string | null;
  marketFrom: string | null;
  /** Why no question was asked, where none was. */
  questionsBecause: string | null;
  questions: { n: number; text: string; search: string; volume: number | null; read: string; ownPosition: number | null; aiAnswer: string; localPack: number }[];
  rivals: string[];
  rivalsBecause: string | null;
  localPack: boolean;
  /** How many searches showed the site in its own local pack. */
  inOwnPack: number;
  cents: number;
  costBySource: Record<string, number>;
  seconds: number;
  /** The route's budget ended before the pass: the row was finished by
   *  `finishScanLeftRunning`, as on production. */
  budgetEnded: boolean;
  refused: string[];
  /** The pass's own lines that say something was not measured or failed. */
  events: Row[];
  /** What `rescoreRow` reads, kept for `--recheck`. */
  stored: { scan: StoredScanRow; reads: StoredRead[]; siteName: string | null; answers: StoredAnswer[] } | null;
}

export interface StoredRun {
  date: string;
  commit: string;
  capCents: number;
  spentCents: number;
  notRun: string[];
  sites: SiteResult[];
}

const VENDOR_HOSTS = new Set(["api.dataforseo.com", "api.anthropic.com"]);
const cents = (n: number): string => `${n.toFixed(2)}¢`;
const json = <T>(sql: string): T => JSON.parse(psql(sql).trim() || "null") as T;
const quote = (s: string): string => s.replace(/'/g, "''");

// ── The network ────────────────────────────────────────────────────────────

/** Every `fetch` of the process: the local database goes through, a vendor
 *  goes through while the cap holds, anything else is refused and named. */
function watchNetwork(capCents: number, spent: () => number): { refused: string[] } {
  const watch = { refused: [] as string[] };
  const local = process.env.SUPABASE_URL ?? "";
  const real = globalThis.fetch;
  globalThis.fetch = async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.href.startsWith(local)) return real(input, init);
    if (!VENDOR_HOSTS.has(url.host)) {
      watch.refused.push(url.host);
      throw new Error(`free-scan: ${url.host} is not contacted`);
    }
    if (spent() >= capCents) {
      watch.refused.push(`${url.host} (cap)`);
      throw new Error(`free-scan: the ${cents(capCents)} cap is spent; ${url.host} is not contacted`);
    }
    return real(input, init);
  };
  return watch;
}

/** The pass's own log lines, kept rather than printed. */
function quiet(lines: Row[]): () => void {
  const { log, warn, error } = console;
  const keep = (...args: unknown[]): void => {
    try {
      lines.push(JSON.parse(String(args[0])) as Row);
    } catch {
      // Not one of the pass's events.
    }
  };
  console.log = keep;
  console.warn = keep;
  console.error = keep;
  return () => {
    console.log = log;
    console.warn = warn;
    console.error = error;
  };
}

// ── One site ───────────────────────────────────────────────────────────────

/** `POST /api/scan` for one admitted domain: the claim, then the pass raced
 *  against the request's budget as `startPipeline` races it. */
async function scanAsTheRouteDoes(domain: string, network: string): Promise<{ scanId: string | null; refusal: string | null; budgetEnded: boolean }> {
  const startedAt = Date.now();
  const parsed = parseDomain(domain);
  if (!parsed.ok) return { scanId: null, refusal: `not a domain: ${parsed.problem}`, budgetEnded: false };
  const claim = await claimFreeScanSlot({ domain: parsed.domain, network: networkKeyOf(network), fromIncompleteRescan: false });
  if (!claim.claimed) return { scanId: null, refusal: JSON.stringify(claim.refusal), budgetEnded: false };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const budgetMs = (TIMING.platformCeilingS - TIMING.requestBudgetMarginS) * 1000 - (Date.now() - startedAt);
  const budgetEnded = new Promise<"budget_ended">((resolve) => {
    timer = setTimeout(() => resolve("budget_ended"), budgetMs);
  });
  const { runScan } = await import("@/lib/scan/run");
  const pass = runScan({ domain: parsed.domain, tier: "free" }).then(
    () => "done" as const,
    (error: unknown) => {
      console.log(JSON.stringify({ event: "free_scan_threw", because: error instanceof Error ? error.message : String(error) }));
      return "threw" as const;
    }
  );
  const outcome = await Promise.race([pass, budgetEnded]);
  clearTimeout(timer);
  if (outcome === "budget_ended") {
    const { finishScanLeftRunning } = await import("@/lib/scan/stuck");
    await finishScanLeftRunning(claim.scanId);
    // On production the invocation is frozen here. This process is not,
    // so the pass is let finish and what it bought is still counted.
    await pass;
  }
  return { scanId: claim.scanId, refusal: null, budgetEnded: outcome === "budget_ended" };
}

function measuredText(m: Measured<number> | undefined): string {
  if (m === undefined) return "not stored";
  if (m.kind === "unmeasured") return `unmeasured (${m.reason}${m.because === undefined ? "" : `: ${m.because}`})`;
  return `${Math.round(m.value * 10) / 10}${m.kind === "zero" ? " (measured none, floored)" : ""}`;
}

function whyUnmeasured(m: Measured<unknown>): string | null {
  return m.kind === "unmeasured" ? `${m.reason}${m.because === undefined ? "" : `: ${m.because}`}` : null;
}

/** What a stranger is shown, read from the stored report. */
function shownOf(domain: string, scan: Row | null): Omit<SiteResult, "cents" | "costBySource" | "seconds" | "budgetEnded" | "refused" | "events" | "stored"> {
  const empty = {
    domain,
    status: typeof scan?.status === "string" ? scan.status : null,
    stoppedReason: typeof scan?.stopped_reason === "string" ? scan.stopped_reason : null,
    score: typeof scan?.score === "number" ? scan.score : null,
    band: null,
    limiting: null,
    drivers: {},
    missing: [],
    locale: "not stored",
    statedPlace: null,
    measuredIn: null,
    category: null,
    marketFrom: null,
    questionsBecause: "no report",
    questions: [],
    rivals: [],
    rivalsBecause: "no report",
    localPack: false,
    inOwnPack: 0,
  };
  if (scan?.report === null || scan?.report === undefined) return empty;
  const report: StoredReport = readStoredReport(scan.report);
  const drivers = (scan.drivers ?? {}) as Record<string, Measured<number>>;
  const ai = report.aiAnswers;
  const questions =
    report.questions.kind === "unmeasured"
      ? []
      : report.questions.value.map((question, i) => {
          const serp = report.serps[i];
          const cell = ai?.rows[i]?.cell;
          const own = serp?.kind === "measured" ? serp.value.organic.find((row) => isOwnDomain(row.domain, report.domain)) : undefined;
          const read = serp === undefined ? "not bought" : serp.kind === "unmeasured" ? `not read (${whyUnmeasured(serp)})` : "read";
          const aiAnswer =
            cell === undefined
              ? "AI answers not read"
              : cell.kind === "answered"
                ? `AI Overview present${cell.namesCustomer ? ", cites the site" : ""}${cell.named === true ? ", names the site" : ""}${!cell.namesCustomer && cell.named !== true ? ", neither names nor cites it" : ""}`
                : cell.kind === "no_answer"
                  ? "no AI Overview"
                  : `unmeasured (${cell.reason})`;
          return {
            n: i + 1,
            text: question.text,
            search: question.search.keyword,
            volume: typeof question.search.volume === "number" ? question.search.volume : null,
            read,
            ownPosition: own?.position ?? null,
            aiAnswer,
            localPack: serp?.kind === "measured" ? (serp.value.localPack?.length ?? 0) : 0,
          };
        });
  const place = report.statedPlace;
  const town = report.locale?.place;
  const inOwnPack = report.serps.filter(
    (serp) => serp.kind === "measured" && (serp.value.localPack ?? []).some((row) => isOwnDomain(row.domain, report.domain))
  ).length;
  return {
    ...empty,
    band: report.verdict.scoreAndBand.kind === "unmeasured" ? null : report.verdict.scoreAndBand.value.band,
    limiting: typeof report.verdict.limiting === "string" ? report.verdict.limiting : JSON.stringify(report.verdict.limiting),
    drivers: Object.fromEntries(["foundations", "answerability", "searchPresence", "aiPresence"].map((name) => [name, measuredText(drivers[name])])),
    missing: report.verdict.missing.map((m) => `${m.factor} (${m.reason})`),
    locale: report.locale === undefined ? "us / en" : `${report.locale.country} / ${report.locale.language}${report.locale.fellBack === undefined ? "" : `, fell back from ${JSON.stringify(report.locale.fellBack)}`}`,
    statedPlace: place === undefined ? null : `${place.name}${place.region === undefined ? "" : `, ${place.region}`}`,
    measuredIn:
      town === undefined ? null : `${town.name}${town.region === undefined ? "" : `, ${town.region}`} (${report.locale?.placeFrom ?? "settled"}; read from ${town.location ?? "the country"})`,
    category: report.market.kind === "unmeasured" ? null : report.market.value.profile.category,
    marketFrom: report.marketFrom ?? null,
    questionsBecause: whyUnmeasured(report.questions),
    questions,
    rivals: report.rivals.kind === "unmeasured" ? [] : report.rivals.value.map((rival) => `${rival.domain} (${rival.top10Appearances} top-ten, ${rival.aiCitations} AI)`),
    rivalsBecause: whyUnmeasured(report.rivals),
    localPack: questions.some((question) => question.localPack > 0),
    inOwnPack,
  };
}

/** A home read as the re-score needs it. Its page is read only where the
 *  response could be a protection's page (`couldBeChallenge`); elsewhere
 *  the page is dropped, so a run's file does not carry every site's HTML. */
function keptRead(read: StoredRead): StoredRead {
  const doc = read.payload as { status?: unknown; bytes?: unknown; headers?: unknown; html?: unknown } | null;
  if (doc === null || typeof doc.status !== "number" || typeof doc.bytes !== "number" || typeof doc.html !== "string") return read;
  const headers = doc.headers !== null && typeof doc.headers === "object" ? (doc.headers as Record<string, string>) : {};
  if (couldBeChallenge({ status: doc.status, bytes: doc.bytes, headers })) return read;
  return { ...read, payload: { ...doc, html: "" } };
}

/** The rows the production re-score reads for this scan, through its own store. */
async function rescoreInputs(domain: string, scanId: string): Promise<SiteResult["stored"]> {
  const store = databaseRescore();
  const scan = (await store.scans()).find((row) => row.id === scanId);
  if (scan === undefined) return null;
  const profile = (await store.profiles()).find((p) => p.domain === domain);
  return {
    scan,
    reads: (await store.homeReads(domain)).map(keptRead),
    siteName: profile === undefined ? null : promptSiteName(storedSiteName(profile, profile.home_title), domain),
    // As the re-score asks: a site's current scan alone carries the battery's
    // answers, and a free scan belongs to no site.
    answers: scan.siteId !== null && scan.isCurrent ? [...(await store.answers(scan.id))] : [],
  };
}

const TELLING = /unmeasured|failed|undeterminable|skipped|threw|too_small|refus|not_stored|afforded|ceiling|market_from_search|produced/;

async function runSite(domain: string, network: string, refused: string[]): Promise<SiteResult> {
  const startedAt = new Date().toISOString();
  const started = Date.now();
  const lines: Row[] = [];
  const loud = quiet(lines);
  const before = refused.length;
  let ran: Awaited<ReturnType<typeof scanAsTheRouteDoes>>;
  try {
    ran = await scanAsTheRouteDoes(domain, network);
  } catch (error) {
    ran = { scanId: null, refusal: `threw: ${error instanceof Error ? error.message : String(error)}`, budgetEnded: false };
  } finally {
    loud();
  }
  const seconds = Math.round((Date.now() - started) / 1000);
  const bought = json<{ source: string; cost_cents: number | string; billed_cents: number | string | null }[]>(
    `select coalesce(jsonb_agg(jsonb_build_object('source', source, 'cost_cents', cost_cents, 'billed_cents', billed_cents) order by created_at), '[]'::jsonb) from public.fetches where created_at >= '${startedAt}';`
  );
  const costBySource: Record<string, number> = {};
  for (const row of bought) {
    const paid = Number(row.cost_cents);
    if (!(paid > 0)) continue;
    costBySource[row.source] = (costBySource[row.source] ?? 0) + paid;
    appendSpend({ script: "free-scan", source: row.source, cents: paid, billed: row.billed_cents === null ? undefined : Number(row.billed_cents) });
  }
  const scan = ran.scanId === null ? null : json<Row | null>(`select to_jsonb(s) from public.scans s where s.id = '${quote(ran.scanId)}';`);
  const events = lines
    .filter((line) => typeof line.event === "string" && line.event !== "vendor_call" && TELLING.test(JSON.stringify(line)))
    .slice(0, 30);
  if (ran.refusal !== null) events.unshift({ event: "free_scan_not_run", because: ran.refusal });
  return {
    ...shownOf(domain, scan),
    cents: Object.values(costBySource).reduce((sum, paid) => sum + paid, 0),
    costBySource,
    seconds,
    budgetEnded: ran.budgetEnded,
    refused: [...new Set(refused.slice(before))],
    events,
    stored: ran.scanId === null ? null : await rescoreInputs(domain, ran.scanId),
  };
}

// ── The readable result ────────────────────────────────────────────────────

export function markdown(run: StoredRun): string {
  const out: string[] = [];
  out.push(`# Free scans — ${run.date}`, "");
  out.push(
    `\`npm run free-scan\` on \`${run.commit}\`, on the local database: ${run.sites.length} sites, ${cents(run.spentCents)} of the ${cents(run.capCents)} cap spent. Nothing was written to production.`,
    ""
  );
  if (run.notRun.length > 0) out.push(`**Not run, the cap did not reach them:** ${run.notRun.join(", ")}.`, "");
  out.push("| Site | Score | Status | Stopped | Questions | AI Overviews | Local pack | Rivals | Cost | Time |", "|---|---|---|---|---|---|---|---|---|---|");
  for (const site of run.sites) {
    const overviews = site.questions.filter((q) => q.aiAnswer.startsWith("AI Overview present")).length;
    out.push(
      `| ${site.domain} | ${site.score ?? "none"}${site.band === null ? "" : ` (${site.band})`} | ${site.status ?? "no row"} | ${site.stoppedReason ?? "—"} | ${site.questions.length} | ${overviews} | ${site.localPack ? "yes" : "no"} | ${site.rivals.length} | ${cents(site.cents)} | ${site.seconds}s |`
    );
  }
  out.push("");
  for (const site of run.sites) {
    out.push(`## ${site.domain}`, "");
    out.push(`- **Score:** ${site.score ?? "none"}${site.band === null ? "" : ` (${site.band})`}; status ${site.status ?? "no row"}, stopped: ${site.stoppedReason ?? "—"}${site.budgetEnded ? "; the route's budget ended first" : ""}`);
    out.push(`- **Drivers:** ${Object.entries(site.drivers).map(([name, value]) => `${name} ${value}`).join("; ") || "none stored"}`);
    if (site.missing.length > 0) out.push(`- **Missing from the score:** ${site.missing.join(", ")}`);
    if (site.limiting !== null) out.push(`- **Limiting:** ${site.limiting}`);
    out.push(`- **Locale:** ${site.locale}; stated place: ${site.statedPlace ?? "none"}; measured in: ${site.measuredIn ?? "the country"}; in its own local pack on ${site.inOwnPack ?? 0} searches`);
    out.push(`- **Category:** ${site.category ?? "none"}${site.marketFrom === null ? "" : ` (read from ${site.marketFrom})`}`);
    out.push(`- **Rivals (${site.rivals.length}):** ${site.rivals.join("; ") || (site.rivalsBecause === null ? "none" : `unmeasured (${site.rivalsBecause})`)}`);
    out.push(`- **Local pack:** ${site.localPack ? `on ${site.questions.filter((q) => q.localPack > 0).length} of ${site.questions.length} searches` : "on no search"}`);
    out.push(`- **Cost:** ${cents(site.cents)} in ${site.seconds}s — ${Object.entries(site.costBySource).sort((x, y) => y[1] - x[1]).map(([source, paid]) => `${source} ${cents(paid)}`).join(", ") || "nothing bought"}`);
    if (site.refused.length > 0) out.push(`- **Refused hosts:** ${site.refused.join(", ")}`);
    out.push("");
    if (site.questions.length === 0) {
      out.push(`No question was asked${site.questionsBecause === null ? "" : `: ${site.questionsBecause}`}.`, "");
    } else {
      out.push("| # | Question | Search | Volume | SERP | Site ranks | AI answer | Local pack |", "|---|---|---|---|---|---|---|---|");
      for (const q of site.questions) {
        out.push(`| ${q.n} | ${q.text.replace(/\|/g, "/")} | ${q.search} | ${q.volume ?? "—"} | ${q.read} | ${q.ownPosition ?? "—"} | ${q.aiAnswer} | ${q.localPack || "—"} |`);
      }
      out.push("");
    }
    if (site.events.length > 0) {
      out.push("<details><summary>The pass said</summary>", "", ...site.events.map((line) => `- \`${JSON.stringify(line).slice(0, 300)}\``), "", "</details>", "");
    }
  }
  return `${out.join("\n")}\n`;
}

function write(dir: string, run: StoredRun): void {
  mkdirSync(dir, { recursive: true });
  const stem = path.join(dir, run.date);
  writeFileSync(`${stem}.json`, `${JSON.stringify(run, null, 1)}\n`);
  writeFileSync(`${stem}.md`, markdown(run));
}

function printSite(site: SiteResult): void {
  console.log(`  score ${site.score ?? "none"} — ${site.status ?? "no row"} (${site.stoppedReason ?? "—"}) in ${site.seconds}s, ${cents(site.cents)}`);
  console.log(`  drivers ${Object.entries(site.drivers).map(([name, value]) => `${name} ${value}`).join("; ") || "none"}`);
  console.log(`  ${site.questions.length} questions, ${site.rivals.length} rivals, local pack ${site.localPack ? "yes" : "no"}, locale ${site.locale}, place ${site.statedPlace ?? "none"}, measured in ${site.measuredIn ?? "the country"}, own pack on ${site.inOwnPack ?? 0}`);
}

// ── The run ────────────────────────────────────────────────────────────────

export async function main(o: Options): Promise<number> {
  const dir = path.join(o.root, "docs/walk/free");
  const file = path.join(dir, `${o.date}.json`);
  // A second run on a date adds to it; a site run again replaces its entry.
  const held: StoredRun | null = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as StoredRun) : null;

  rebuild(o.root);
  await waitForSchema();

  const runStartedAt = new Date().toISOString();
  const spent = (): number => Number(psql(`select coalesce(sum(cost_cents), 0) from public.fetches where created_at >= '${runStartedAt}';`).trim() || "0");
  const watch = watchNetwork(o.capCents, spent);
  const commit = commitOf(o.root);

  console.log(`Free scans: ${o.sites.length} sites, live, up to ${cents(o.capCents)}. Nothing is written to production.`);
  const sites: SiteResult[] = [];
  const notRun: string[] = [];
  const record = (): StoredRun => {
    const ran = new Set(sites.map((site) => site.domain));
    return {
      date: o.date,
      commit,
      capCents: (held?.capCents ?? 0) + o.capCents,
      spentCents: Math.round(((held?.spentCents ?? 0) + spent()) * 10000) / 10000,
      notRun: [...new Set([...(held?.notRun ?? []).filter((domain) => !ran.has(domain)), ...notRun])],
      sites: [...(held?.sites ?? []).filter((site) => !ran.has(site.domain)), ...sites],
    };
  };
  for (const [i, domain] of o.sites.entries()) {
    const left = o.capCents - spent();
    if (left < CAPS.FREE_C) {
      notRun.push(domain);
      console.log(`\n${domain} — not run: ${cents(left)} is left of the cap and a free scan may spend ${cents(CAPS.FREE_C)}.`);
      continue;
    }
    console.log(`\n${domain}`);
    // One network per site, as one stranger per site would be.
    const site = await runSite(domain, `198.51.100.${i + 1}`, watch.refused);
    sites.push(site);
    // Written after every site: a run that stops keeps what it bought.
    write(dir, record());
    printSite(site);
  }
  const total = spent();
  write(dir, record());
  console.log(`\nFree scans: ${sites.length} of ${o.sites.length} run, ${cents(total)} of ${cents(o.capCents)} spent.`);
  if (notRun.length > 0) console.log(`Not run: ${notRun.join(", ")}.`);
  console.log(`Written to ${path.relative(o.root, path.join(dir, o.date))}.json and .md, and to the spend log.`);
  return notRun.length === 0 && sites.every((site) => site.stored !== null) ? 0 : 1;
}

/** `--recheck`: that date's stored scans scored again by the current code,
 *  through the production re-score's own path. No database, no vendor, 0¢. */
/** A stored run with its home reads kept as `keptRead` keeps them. */
export function trimmed(run: StoredRun): StoredRun {
  return { ...run, sites: run.sites.map((site) => (site.stored === null ? site : { ...site, stored: { ...site.stored, reads: site.stored.reads.map(keptRead) } })) };
}

export function recheck(o: Options): number {
  const dir = path.join(o.root, "docs/walk/free");
  const file = path.join(dir, `${o.date}.json`);
  if (!existsSync(file)) throw new Error(`No stored run at ${file}.`);
  const run = JSON.parse(readFileSync(file, "utf8")) as StoredRun;
  const sites = run.sites.filter((site) => o.sites.length === 0 || o.sites.includes(site.domain));
  const commit = commitOf(o.root);
  const out: string[] = [`# Free scans — ${o.date}, scored again on \`${commit}\``, "", `Stored on \`${run.commit}\`; scored again from the stored rows alone, 0¢.`, ""];
  out.push("| Site | Score before | Score after | Status after | Report members moved |", "|---|---|---|---|---|");
  const details: string[] = [];
  console.log(`Free scans, ${o.date}: ${sites.length} stored scans scored again on ${commit}. 0¢, nothing is bought.`);
  for (const site of sites) {
    if (site.stored === null) {
      out.push(`| ${site.domain} | ${site.score ?? "none"} | not stored | — | — |`);
      continue;
    }
    const { scan, reads, siteName, answers } = site.stored;
    const row = offline("free-scan --recheck", "A recheck reads the stored run only.", () => {
      const log = console.log;
      console.log = () => undefined;
      try {
        return rescoreRow(scan, reads, { siteName, answers });
      } finally {
        console.log = log;
      }
    });
    if (!("result" in row)) {
      out.push(`| ${site.domain} | ${scan.score ?? "none"} | unreadable: ${row.because} | — | — |`);
      continue;
    }
    const { result } = row;
    const paths = result.changes.map((change) => change.path.join("."));
    out.push(`| ${site.domain} | ${scan.score ?? "none"} | ${result.score ?? "none"} | ${result.status} | ${paths.join(", ") || "none"} |`);
    details.push(
      `## ${site.domain}`,
      "",
      `- **Drivers after:** ${Object.entries(result.drivers).map(([name, m]) => `${name} ${measuredText(m)}`).join("; ")}`,
      `- **Drivers before:** ${Object.entries(site.drivers).map(([name, value]) => `${name} ${value}`).join("; ")}`,
      `- **Moves:** ${moves(row) ? "yes" : "no"}`,
      ...(result.kept.length === 0 ? [] : [`- **Stands as stored:** ${result.kept.join("; ")}`]),
      ""
    );
    console.log(`  ${site.domain}: ${scan.score ?? "none"} → ${result.score ?? "none"} (${result.status})${paths.length === 0 ? "" : `, moved ${paths.join(", ")}`}`);
  }
  writeFileSync(path.join(dir, `${o.date}.recheck.md`), `${[...out, "", ...details].join("\n")}\n`);
  console.log(`Written to ${path.relative(o.root, path.join(dir, `${o.date}.recheck.md`))}.`);
  return 0;
}
