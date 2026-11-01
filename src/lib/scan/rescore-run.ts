// src/lib/scan/rescore-run.ts — the production re-score (issue 1433): every
// stored scan and site rival set, read straight from the database, scored
// again by the deployed code with `rescoreScan` and `rehomeSite`, and the
// before and after written back where the master session reads it.
//
// The owner's ruling of 2026-10-14 (SPEC §2, issue 1426) fits every scoring,
// rival or market change to every stored scan at 0¢. Only the stored rows a
// score is read from are downloaded, never through a connector; each
// computation runs inside `offline`, so no vendor, model or site can be
// reached while a scan is scored. The database reads and writes are the only
// network this does, and they happen outside it.
//
// Each stored read is scored from its facts (`fetch-facts.ts`), which are
// a cache outside these writes.
//
// A dry run, or an apply its guard holds, writes the summary only. An apply
// writes each scan that moves through `rescore_scan`: only the moved paths,
// the replaced report under `report.previous`, the stamps, and the report's
// checksum as the guard, so a scan written since it was read is left alone and
// a second apply changes nothing. The function raises on a change that did not
// land, so only a scan left alone is read again.
import { offline } from "@/lib/egress/offline";
import type { Measured } from "@/lib/measure/measured";
import type { Drivers, ScoreFactorName } from "@/lib/measure/score";
import type { RivalConclusion } from "@/lib/market/infer/types";
import { promptSiteName } from "@/lib/market/prompts/generate";
import { rewrittenSiteName, storedSiteName } from "@/lib/site-profile/site-name";
import { AI_ANSWER_SOURCES, AI_OVERVIEW_TEXT_MAX_CHARS } from "@/lib/vendors/dataforseo/types";
import { OWN_FETCH_SOURCE } from "@/lib/measure/own-fetch";
import { checked, factsLoader, type MinimalClient, type MinimalResult } from "./fetch-facts";
import { readStoredReport } from "./report";
import { scanWriteOf } from "./rescore-write";
import { homeOf, homeReadsFor, type HomeReadRow, type StoredRead } from "./home-reads";
import { livePagesAt, measuredOf, oursPicked, type OwnReadRow, type OwnReads, type StoredPublication } from "./own-reads";
import {
  rehomeSite,
  rescoreScan,
  type RehomedSite,
  type ReportChange,
  type Rescored,
  type RescoredMembers,
  type RescoreReport,
  type RescoreScan,
  type StoredAnswer,
} from "./rescore";
import type { ScanStatus } from "./store";
import { asksByItself, deployedFactsVersion, heldBecause, nextStep, type RunRecord, type ScoreMove } from "./derivation";

export type { StoredRead };
export { livePagesAt, measuredOf, type OwnRead, type OwnReads, type StoredPublication } from "./own-reads";

/** A `scans` row as stored, with its report's checksum. */
export interface StoredScanRow {
  id: string;
  domain: string;
  createdAt: string;
  status: ScanStatus;
  score: number | null;
  drivers: unknown;
  /** `md5(report::text)`, the guard an apply writes under. */
  md5: string;
  report: unknown;
  siteId: string | null;
  isCurrent: boolean;
}

export interface StoredSiteRow {
  id: string;
  domain: string;
  competitors: readonly string[];
  market: Record<string, unknown> | null;
}

export interface ScanWrite {
  id: string;
  md5: string;
  changes: readonly ReportChange[];
  score: number | null;
  status: ScanStatus;
  drivers: Drivers;
  at: string;
  by: string;
}

/** A stored profile's name as the column holds it, with its stored home
 *  title, which says how the site cases its name. Read only through
 *  `storedSiteName` (issue 1479). */
export interface StoredProfileName {
  domain: string;
  site_name: string | null;
  home_title: string | null;
}

/** A stored name the re-score writes again, guarded by the one it read. */
export interface ProfileNameWrite {
  domain: string;
  from: string;
  to: string | null;
}

export interface SiteWrite {
  id: string;
  market: Record<string, unknown>;
  competitors: readonly string[];
}

export interface RescoreStore {
  scans(): Promise<readonly StoredScanRow[]>;
  /** The home page reads stored for `https://<domain>/`: the ones reports
   *  measured at `onPageAt` are scored with, or every one where it is absent. */
  homeReads(domain: string, onPageAt?: readonly number[]): Promise<readonly StoredRead[]>;
  sites(): Promise<readonly StoredSiteRow[]>;
  profiles(): Promise<readonly StoredProfileName[]>;
  /** Issue 1551: a paying site's scan's own-document reads (`fetches` under
   *  its id, in the order it read them), and the stored reads of the pages
   *  ReachKit had live for the site when it ran (`livePagesAt`). */
  ownReads(scan: Pick<StoredScanRow, "id" | "siteId" | "createdAt">): Promise<OwnReads>;
  /** The AI Mode and ChatGPT answers a scan bought, as `fetches` keeps them
   *  under it (issue 1420). Asked only for a site's current scan, the one
   *  whose report carries those engines' cells. */
  answers(scanId: string): Promise<readonly StoredAnswer[]>;
  /** False where the report's checksum is no longer `md5`: nothing written. */
  writeScan(write: ScanWrite): Promise<boolean>;
  writeSite(write: SiteWrite): Promise<void>;
  /** False where the stored name is no longer `from`: nothing written. */
  writeProfileName(write: ProfileNameWrite): Promise<boolean>;
  /** The JSON length of every row downloaded so far, an estimate of egress,
   *  and the part of it that was payloads read to refresh their facts. */
  readBytes?(): { read: number; refresh: number };
}

export interface RescoreOptions {
  apply: boolean;
  /** Where set, the guard (issue 1481) is decided before any write. */
  guard?: { unreadableBefore: number | null };
  /** The deployed commit. */
  version: string;
  /** The deployed derivation (issue 1481); `null` where the build carried none. */
  derivation?: string | null;
  at: Date;
}

export interface RescoreAnswer {
  scansRead: number;
  scansChanged: number;
  /** Site-level rows that move: a paying site's rival set, and a stored
   *  profile's name (issue 1479). */
  sitesMoved: number;
  /** Apply only; 0 on a dry run. */
  scansWritten: number;
  /** Apply only: scans whose report changed after it was read. */
  scansLeft: number;
  /** Stored scans this build could not read. */
  scansUnreadable: number;
  /** The scans that still read differently from the deployed code after
   *  this run: every one a dry run would move, the ones an apply left. */
  stale: readonly string[];
  /** Every score the run moves, for the guard (issue 1481). */
  scoreMoves: readonly ScoreMove[];
  /** Why the guard stopped the run, or the apply still lags; `null` otherwise. */
  held: string | null;
  summary: string;
}

export interface Row {
  scan: StoredScanRow;
  report: RescoreReport;
  result: Rescored;
}

const OFFLINE_ADVICE = "The re-score reads stored data only and buys nothing (issues 1426, 1433).";

/** `body` with the network refused and the pass's own log lines (one per
 *  card counted) kept out of the job's one line. */
function quietly<T>(body: () => T): T {
  return offline("scan/rescore", OFFLINE_ADVICE, () => {
    const log = console.log;
    console.log = () => undefined;
    try {
      return body();
    } finally {
      console.log = log;
    }
  });
}

/** `scans.drivers` as stored: each quantity's date an ISO string. */
function driversOf(value: unknown): Drivers | null {
  if (value === null || typeof value !== "object") return null;
  const out: Record<string, Measured<number>> = {};
  for (const [name, m] of Object.entries(value as Record<string, Measured<number> & { at: string }>)) {
    out[name] = { ...m, at: new Date(m.at) };
  }
  return out as unknown as Drivers;
}

/** The report a re-score reads: the stored one, without what an earlier
 *  re-score kept beside it. */
function reportOf(stored: unknown): RescoreReport {
  if (stored === null || typeof stored !== "object") return readStoredReport(stored) as unknown as RescoreReport;
  const report = { ...(stored as Record<string, unknown>) };
  for (const key of ["previous", "previousColumns", "rescoredAt", "rescoredBy"]) delete report[key];
  const read = readStoredReport(report) as unknown as RescoreReport;
  valuesKept(read);
  return read;
}

/** The lists the re-score reads, each still a list where it was measured: a
 *  report that lost one (issue 1431) is named here, not met deep in
 *  `cardsOf`. */
function valuesKept(report: RescoreReport): void {
  for (const name of ["questions", "rivalSizes"] as const) {
    const m = report[name];
    if (m.kind !== "unmeasured" && !Array.isArray(m.value)) throw new Error(`${name} is ${m.kind} but the stored report carries no list`);
  }
}

/** When the report's on-page facts were read; `null` where they were not, or
 *  the report cannot be read. */
function onPageAtOf(stored: unknown): number | null {
  try {
    const report = reportOf(stored);
    return report.onPage.kind === "unmeasured" ? null : new Date(report.onPage.at).getTime();
  } catch {
    return null;
  }
}

/** One stored scan scored again; a report this build cannot read is listed,
 *  never guessed at. */
export function rescoreRow(
  scan: StoredScanRow,
  reads: readonly StoredRead[],
  said: { siteName: string | null; answers: readonly StoredAnswer[]; market?: RescoreScan["market"]; measured?: RescoreScan["measured"] } = { siteName: null, answers: [] }
): Row | { id: string; because: string } {
  let report: RescoreReport;
  try {
    report = reportOf(scan.report);
  } catch (error) {
    return { id: scan.id, because: error instanceof Error ? error.message : String(error) };
  }
  const result = rescoreScan({
    id: scan.id,
    status: scan.status,
    score: scan.score,
    drivers: driversOf(scan.drivers),
    report,
    home: report.onPage.kind === "unmeasured" ? null : homeOf(new Date(report.onPage.at).getTime(), reads),
    rendered: reads.filter((r) => r.source === "on_page/instant_pages").map((r) => ({ created_at: r.created_at, facts: r.facts })),
    siteName: said.siteName,
    answers: said.answers,
    startedAt: scan.createdAt,
    ...(said.market === undefined ? {} : { market: said.market }),
    ...(said.measured === undefined ? {} : { measured: said.measured }),
  });
  return { scan, report, result };
}

/** Whether a scan's row is rewritten: a member of its report moved, or its
 *  score or status did. */
export function moves(row: Row): boolean {
  return row.result.changes.length > 0 || row.scan.score !== row.result.score || row.scan.status !== row.result.status;
}

/** What the reading reads of `sites.market`: the concluded kind and place
 *  and the founder's place. */
function marketOfSite(market: Record<string, unknown> | null): NonNullable<RescoreScan["market"]> | null {
  if (market === null) return null;
  const current = (market.current ?? null) as { kind?: unknown; serves?: unknown } | null;
  const area = market.area as { place?: unknown } | undefined;
  // Issue 1539: the rivals a tracked-prompt answer's lines are read against.
  const rivals = rivalsOf(market)?.map((rival) => ({ name: rival.name, domain: rival.domain }));
  return {
    ...(current?.kind === undefined ? {} : { kind: current.kind }),
    ...(current?.serves === undefined ? {} : { serves: current.serves }),
    ...(rivals === undefined ? {} : { rivals }),
    ...(area === undefined || area === null ? {} : { area }),
  };
}

function rivalsOf(market: Record<string, unknown> | null): readonly RivalConclusion[] | null {
  const current = market?.current as { rivals?: unknown } | undefined;
  return Array.isArray(current?.rivals) ? (current.rivals as RivalConclusion[]) : null;
}

function rehome(sites: readonly StoredSiteRow[], rows: readonly Row[]): { site: StoredSiteRow; moved: RehomedSite }[] {
  const out: { site: StoredSiteRow; moved: RehomedSite }[] = [];
  for (const site of sites) {
    const report = rows.find((row) => row.scan.siteId === site.id && row.scan.isCurrent)?.report ?? null;
    const moved = rehomeSite({
      id: site.id,
      domain: site.domain,
      competitors: site.competitors,
      rivals: rivalsOf(site.market),
      overridden: site.market?.rivalsOverridden === true,
      report: report === null ? null : { ...report, ownRankedRows: [] },
    });
    if (moved !== null) out.push({ site, moved });
  }
  return out;
}

/** A moved rival set as `sites` stores it, the first rivals kept under
 *  `market.rescored`. */
export function siteWrite(site: StoredSiteRow, moved: RehomedSite, o: Pick<RescoreOptions, "version" | "at">): SiteWrite {
  const market = site.market ?? {};
  const current = (market.current ?? {}) as Record<string, unknown>;
  const rescored = market.rescored as { previous?: unknown } | undefined;
  return {
    id: site.id,
    market: {
      ...market,
      current: { ...current, rivals: moved.rivals },
      rescored: {
        previous: rescored?.previous ?? { rivals: current.rivals ?? null, competitors: site.competitors },
        at: o.at.toISOString(),
        by: o.version,
      },
    },
    competitors: moved.competitors,
  };
}

// ── The summary ─────────────────────────────────────────────────────────

const FACTORS: readonly ScoreFactorName[] = ["foundations", "answerability", "presence"];

function scoreText(m: RescoredMembers): string {
  const s = m.verdict.scoreAndBand;
  if (s.kind === "unmeasured") return "—";
  const e = m.verdict.estimate;
  return e === undefined ? String(s.value.score) : `${s.value.score} (${e.low}–${e.high}, ${e.confidence})`;
}

function bandText(m: RescoredMembers): string {
  const s = m.verdict.scoreAndBand;
  return s.kind === "unmeasured" ? "—" : s.value.band;
}

function factorsText(m: RescoredMembers): string {
  return FACTORS.map((f) => {
    const v = m.verdict.factors[f];
    return v.kind === "unmeasured" ? "—" : String(Math.round(v.value));
  }).join("/");
}

function limitingText(m: RescoredMembers): string {
  const l = m.verdict.limiting;
  return l.kind === "factor" ? l.factor : l.because;
}

function rivalsText(m: RescoredMembers): string {
  return m.rivals.kind === "unmeasured" ? "—" : m.rivals.value.map((r) => r.domain).join(", ") || "none";
}

function moved(before: string, after: string): string {
  return before === after ? before : `**${before} → ${after}**`;
}

function cell(text: string): string {
  return text.replace(/\|/g, "\\|");
}

function table(rows: readonly Row[]): string[] {
  const lines = [
    "| Scan | Domain | Tier | Date | Score | Band | F/A/P | Limiting | Rivals | Status | Moves |",
    "|---|---|---|---|---|---|---|---|---|---|---|",
  ];
  for (const { scan, report, result } of rows) {
    const b = result.before;
    const a = result.after;
    lines.push(
      `| ${scan.id.slice(0, 8)} | ${report.domain} | ${report.tier} | ${scan.createdAt.slice(0, 10)} | ${moved(scoreText(b), scoreText(a))} | ${moved(bandText(b), bandText(a))} | ${moved(factorsText(b), factorsText(a))} | ${moved(limitingText(b), limitingText(a))} | ${cell(moved(rivalsText(b), rivalsText(a)))} | ${moved(scan.status, result.status)} | ${result.changes.map((c) => c.path.join(".")).join(", ") || "nothing"} |`
    );
  }
  return lines;
}

function totals(rows: readonly Row[], unreadable: readonly { id: string; because: string }[]): string[] {
  const deltas: number[] = [];
  let unscored = 0;
  let scored = 0;
  for (const { result } of rows) {
    const b = result.before.verdict.scoreAndBand;
    const a = result.after.verdict.scoreAndBand;
    if (b.kind !== "unmeasured" && a.kind === "unmeasured") unscored += 1;
    else if (b.kind === "unmeasured" && a.kind !== "unmeasured") scored += 1;
    else if (b.kind !== "unmeasured" && a.kind !== "unmeasured" && b.value.score !== a.value.score) deltas.push(a.value.score - b.value.score);
  }
  const count = (pred: (row: Row) => boolean): number => rows.filter(pred).length;
  const touched = (prefix: string) => (row: Row) => row.result.changes.some((c) => c.path[0] === prefix);
  const up = deltas.filter((d) => d > 0);
  const down = deltas.filter((d) => d < 0);
  return [
    `- Scans read: ${rows.length}; not readable by this build: ${unreadable.length}`,
    `- Scans that change: ${count(moves)}`,
    `- Score moves on ${deltas.length}: ${up.length} up (${up.join(", ") || "none"}), ${down.length} down (${down.join(", ") || "none"})`,
    `- Score becomes unmeasured (no number): ${unscored}; becomes measured: ${scored}`,
    `- Band changes: ${count((row) => bandText(row.result.before) !== bandText(row.result.after))}`,
    `- Rivals change: ${count(touched("rivals"))}; presence card: ${count(touched("presence"))}; AI answers: ${count(touched("aiAnswers"))}; coherence: ${count(touched("coherence"))}; free page re-picked: ${count(touched("freePage"))}`,
    `- Verdict rewritten without a score move (factors, limiting factor or unread inputs): ${count((row) => touched("verdict")(row) && scoreText(row.result.before) === scoreText(row.result.after))}`,
    `- Status changes: ${count((row) => row.scan.status !== row.result.status)}`,
  ];
}

/** Issue 1470: how many stored profiles gain each part of the business's
 *  reading, what they gain, and which stay unread. */
export function readingLines(rows: readonly Row[]): string[] {
  const profiled = rows.filter(({ report }) => report.market.kind !== "unmeasured" && typeof report.market.value.profile === "object" && report.market.value.profile !== null);
  const gain = (key: "offerings" | "kind" | "reach") => profiled.filter((row) => row.result.reading[key] !== undefined);
  const tally = (values: readonly string[]): string =>
    [...values.reduce((m, v) => m.set(v, (m.get(v) ?? 0) + 1), new Map<string, number>())]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([v, n]) => `${v} ${n}`)
      .join(", ") || "none";
  // A profile that holds neither the field nor gains it: what the card says
  // is not read yet.
  const unread = (key: "kind" | "reach"): string[] => [
    ...new Set(
      profiled
        .filter(({ report, result }) => report.market.kind !== "unmeasured" && report.market.value.profile[key] === undefined && result.reading[key] === undefined)
        .map(({ report }) => report.domain)
    ),
  ];
  const lines = gain("offerings").map((row) => row.result.reading.offerings!.length);
  const several = [...new Set(gain("offerings").filter((row) => row.result.reading.offerings!.length > 1).map(({ report, result }) => `${report.domain} (${result.reading.offerings!.map((o) => o.category).join(" · ")})`))];
  const kindUnread = unread("kind");
  const reachUnread = unread("reach");
  return [
    `- Scans with a stored profile: ${profiled.length} of ${rows.length}`,
    `- Gain their lines: ${lines.length} (one line ${lines.filter((n) => n === 1).length}, several ${lines.filter((n) => n > 1).length})${several.length === 0 ? "" : ` — ${several.join(", ")}`}`,
    `- Gain a kind: ${gain("kind").length} (${tally(gain("kind").map((row) => row.result.reading.kind!))})`,
    `- Gain a reach: ${gain("reach").length} (${tally(gain("reach").map((row) => row.result.reading.reach!))})`,
    `- Kind left unread, as nothing stored decides it: ${kindUnread.length === 0 ? "none" : kindUnread.join(", ")}`,
    `- Reach left unread, as nothing stored decides it: ${reachUnread.length === 0 ? "none" : reachUnread.join(", ")}`,
  ];
}

function keptLines(rows: readonly Row[], unreadable: readonly { id: string; because: string }[]): string[] {
  const byReason = new Map<string, string[]>();
  for (const { scan, report, result } of rows) {
    for (const reason of result.kept) byReason.set(reason, [...(byReason.get(reason) ?? []), `${report.domain} (${scan.id.slice(0, 8)})`]);
  }
  const lines = [
    "- Answerability on a free scan, and on a paid scan that ledgered no read of its own: its stored value stands.",
  ];
  for (const [reason, scans] of byReason) lines.push(`- ${reason}: ${scans.length} — ${scans.join(", ")}`);
  for (const u of unreadable) lines.push(`- ${u.id.slice(0, 8)}: not readable by this build — ${u.because}`);
  return lines;
}

function summaryOf(a: {
  o: RescoreOptions;
  rows: readonly Row[];
  unreadable: readonly { id: string; because: string }[];
  sites: readonly StoredSiteRow[];
  movedSites: readonly { site: StoredSiteRow; moved: RehomedSite }[];
  profiles: readonly StoredProfileName[];
  renamed: readonly ProfileNameWrite[];
  written: { scans: number; left: readonly string[]; names: number } | null;
  read: { read: number; refresh: number } | undefined;
}): string {
  return [
    `# Re-score of ${a.rows.length + a.unreadable.length} stored scans, by ${a.o.version}, ${a.o.apply ? "applied" : "dry run"} at ${a.o.at.toISOString()}`,
    "",
    "Before → after where it moves. F/A/P are Foundations, Answerability and Presence; — is unmeasured.",
    "",
    ...table(a.rows),
    "",
    "## Totals",
    "",
    ...totals(a.rows, a.unreadable),
    ...(a.read === undefined
      ? []
      : [`- read ≈ ${(a.read.read / 1e6).toFixed(2)} MB (facts refresh ≈ ${(a.read.refresh / 1e6).toFixed(2)} MB), est.: the JSON length of the rows this run downloaded`]),
    ...(a.written === null
      ? ["- Written: nothing (a dry run)"]
      : [
          `- Written: ${a.written.scans} scans and ${a.movedSites.length} site rival sets; left alone because the report changed after it was read: ${a.written.left.length}${a.written.left.length === 0 ? "" : ` — ${a.written.left.map((id) => id.slice(0, 8)).join(", ")}`}`,
        ]),
    "",
    "## Not fully recomputed",
    "",
    ...keptLines(a.rows, a.unreadable),
    "",
    "## The business's reading (issue 1470)",
    "",
    ...readingLines(a.rows),
    "",
    "## Site rival sets",
    "",
    ...(a.movedSites.length === 0
      ? [`- ${a.sites.length} read; none moves.`]
      : a.movedSites.map(({ site, moved }) => `- ${site.domain}: ${moved.moved.map((m) => `${m.name} ${m.from} → ${m.to ?? "dropped"}`).join("; ")}`)),
    "",
    "## Site profiles",
    "",
    `- ${a.profiles.length} read. Products, claims and voice are model answers over the pages read; none is asked again. A business's lines, kind and reach are its scan's profile's, above.`,
    ...(a.renamed.length === 0
      ? ["- Every stored name already reads as itself."]
      : [
          `- Names read again by the name rule (issue 1479), ${a.written === null ? "not written (a dry run)" : `${a.written.names} written`}: ${a.renamed.map((n) => `${n.domain} "${n.from}" → ${n.to === null ? "none" : `"${n.to}"`}`).join(", ")}`,
        ]),
  ].join("\n");
}

// ── The run ─────────────────────────────────────────────────────────────

/** Every stored scan, site rival set and stored name read again by the
 *  deployed code, nothing written. */
async function readAll(store: RescoreStore) {
  const scans = await store.scans();
  const profiles = await store.profiles();
  const sites = await store.sites();
  // A paying site's market, read beside each of its scans' profiles (issue 1470).
  const markets = new Map(sites.map((site) => [site.id, marketOfSite(site.market)] as const));
  // The name an AI answer is read for (issue 1420), as the pass reads it:
  // by the name rule, never the column as stored (issue 1479).
  const names = new Map(profiles.map((p) => [p.domain, promptSiteName(storedSiteName(p, p.home_title), p.domain)] as const));
  const renamed = profiles.flatMap((p) => {
    const name = rewrittenSiteName(p, p.home_title);
    return name === null ? [] : [{ domain: p.domain, ...name }];
  });
  const rows: Row[] = [];
  const unreadable: { id: string; because: string }[] = [];
  const byDomain = new Map<string, StoredScanRow[]>();
  for (const scan of scans) byDomain.set(scan.domain, [...(byDomain.get(scan.domain) ?? []), scan]);
  for (const [domain, ofDomain] of byDomain) {
    // A domain's home reads are held only while its own scans are scored.
    const reads = await store.homeReads(domain, ofDomain.flatMap((scan) => onPageAtOf(scan.report) ?? []));
    for (const scan of ofDomain) {
      const answers = scan.siteId !== null && scan.isCurrent ? await store.answers(scan.id) : [];
      const market = scan.siteId === null ? undefined : markets.get(scan.siteId);
      const measured = scan.siteId === null ? undefined : measuredOf(await store.ownReads(scan));
      const said = { siteName: names.get(domain) ?? null, answers, ...(market === undefined ? {} : { market }), ...(measured === undefined ? {} : { measured }) };
      const row = quietly(() => rescoreRow(scan, reads, said));
      if ("result" in row) rows.push(row);
      else unreadable.push(row);
    }
  }
  rows.sort((a, b) => a.scan.createdAt.localeCompare(b.scan.createdAt) || a.scan.id.localeCompare(b.scan.id));
  const scoreOf = (m: RescoredMembers) => (m.verdict.scoreAndBand.kind === "unmeasured" ? null : m.verdict.scoreAndBand.value.score);
  const scoreMoves = rows.map((row) => ({ domain: row.scan.domain, before: scoreOf(row.result.before), after: scoreOf(row.result.after) })).filter((m) => m.before !== m.after);
  const ids = (pick: (row: Row) => boolean) => rows.filter(pick).map((row) => row.scan.id);
  // A scan that stands as stored though the code reads it differently (issue 1504) stays stale once written.
  const [moving, standing] = [ids(moves), ids((row) => row.result.stale)];
  return { profiles, sites, renamed, rows, unreadable, scoreMoves, moving, standing, stale: [...new Set([...moving, ...standing])], movedSites: quietly(() => rehome(sites, rows)) };
}

/** Every stored scan and site rival set scored again; on apply, each one
 *  that moves written back unless the guard holds. */
export async function rescoreStored(store: RescoreStore, o: RescoreOptions): Promise<RescoreAnswer> {
  const { profiles, sites, renamed, rows, unreadable, scoreMoves, moving, standing, movedSites, ...read } = await readAll(store);
  let held = o.guard === undefined ? null : heldBecause({ moves: scoreMoves, unreadable: unreadable.length, unreadableBefore: o.guard.unreadableBefore, afterApply: false, changed: 0 });
  let stale = read.stale;
  let written: { scans: number; left: string[]; names: number } | null = null;
  if (o.apply && held === null) {
    written = { scans: 0, left: [], names: 0 };
    const at = o.at.toISOString();
    for (const row of rows.filter(moves)) {
      if (await store.writeScan(scanWriteOf(row, at, o.version))) written.scans += 1;
      else written.left.push(row.scan.id);
    }
    for (const { site, moved } of movedSites) await store.writeSite(siteWrite(site, moved, o));
    for (const name of renamed) if (await store.writeProfileName(name)) written.names += 1;
    stale = standing;
    if (written.left.length > 0) {
      // A scan written since it was read may now read as the code does, or not.
      const again = await readAll(store);
      held = heldBecause({ moves: again.scoreMoves, unreadable: again.unreadable.length, unreadableBefore: unreadable.length, afterApply: true, changed: again.moving.length });
      stale = again.stale;
    }
  }
  return {
    scansRead: rows.length + unreadable.length,
    scansChanged: moving.length,
    sitesMoved: movedSites.length + renamed.length,
    scansWritten: written?.scans ?? 0,
    scansLeft: written?.left.length ?? 0,
    scansUnreadable: unreadable.length,
    stale,
    scoreMoves,
    held,
    summary: quietly(() => summaryOf({ o, rows, unreadable, sites, movedSites, profiles, renamed, written, read: store.readBytes?.() })),
  };
}

// ── The request ─────────────────────────────────────────────────────────

/** A `rescore_runs` row the master session inserted, or the tick asked for
 *  itself (issue 1481), claimed by this run. */
export interface RescoreRequest {
  id: string;
  mode: "dry" | "apply";
  /** True where the tick asked it: its apply is guarded. */
  auto?: boolean;
}

export interface RescoreQueue {
  /** The oldest request not yet started, marked started; `null` where none
   *  waits or another tick claimed it first. */
  claim(at: Date): Promise<RescoreRequest | null>;
  /** Every run so far, oldest first. */
  runs(): Promise<readonly RunRecord[]>;
  /** A request the tick asks for itself (`auto`). */
  ask(mode: RescoreRequest["mode"], at: Date): Promise<void>;
  answer(id: string, answer: RescoreAnswer, o: RescoreOptions): Promise<void>;
  failed(id: string, error: string, o: Pick<RescoreOptions, "at" | "derivation">): Promise<void>;
}

/** Answers one claimed request. A failure is written to its row, then
 *  rethrown for the job's own retry. */
export async function answerRequest(
  request: RescoreRequest,
  o: Omit<RescoreOptions, "apply">,
  db: RescoreQueue & RescoreStore = databaseRescore()
): Promise<Pick<RescoreAnswer, "scansRead" | "scansChanged" | "sitesMoved" | "scansWritten" | "scansLeft">> {
  try {
    const before = (await db.runs()).filter((r) => r.finishedAt !== null && r.error === null && r.unreadable !== null).at(-1);
    // A person's apply is how a held guard is moved on, so only the tick's is guarded.
    const guarded = request.mode === "dry" || request.auto === true;
    const options: RescoreOptions = { ...o, apply: request.mode === "apply", ...(guarded ? { guard: { unreadableBefore: before?.unreadable ?? null } } : {}) };
    const answer = await rescoreStored(db, options);
    await db.answer(request.id, answer, options);
    // The step's answer is stored between invocations: the counts, not the table.
    return { scansRead: answer.scansRead, scansChanged: answer.scansChanged, sitesMoved: answer.sitesMoved, scansWritten: answer.scansWritten, scansLeft: answer.scansLeft };
  } catch (error) {
    await db.failed(request.id, error instanceof Error ? error.message : String(error), o).catch(() => undefined);
    throw error;
  }
}

/** The request this tick answers: the oldest one waiting, or, where none
 *  waits and production's deployed derivation has no run, the guarded apply
 *  the tick asks for itself (issue 1481). `held` where the guard or a failure
 *  stopped it: nothing is asked, and the tick says so. */
export async function claimRequest(
  at: Date,
  derivation: string | null,
  db: RescoreQueue = databaseRescore(),
  byItself: boolean = asksByItself()
): Promise<RescoreRequest | { held: string } | null> {
  const waiting = await db.claim(at);
  if (waiting !== null || derivation === null || !byItself) return waiting;
  const next = nextStep(await db.runs(), derivation);
  if ("held" in next) return next;
  if (!("ask" in next)) return null;
  await db.ask(next.ask, at);
  return db.claim(at);
}

// ── The database ────────────────────────────────────────────────────────

const PAGE = 25;

interface ScanRecord {
  id: string;
  domain: string;
  created_at: string;
  status: ScanStatus;
  score: number | null;
  drivers: unknown;
  report: unknown;
  report_md5: string;
  site_id: string | null;
  is_current: boolean | null;
}

async function adminClient(): Promise<MinimalClient> {
  const { dbAdmin } = await import("@/lib/db");
  return dbAdmin() as unknown as MinimalClient;
}

/** The database, through `dbAdmin()` imported at the call: a static import
 *  would put a database client on every graph this module is on. `facts`
 *  is the version the stored facts are trusted at; with none, every read's
 *  facts are derived from its payload and none is kept. */
export function databaseRescore(client: () => Promise<MinimalClient> = adminClient, facts: string | null = deployedFactsVersion()): RescoreQueue & RescoreStore {
  const bytes = { read: 0, refresh: 0 };
  const got = <T>(result: MinimalResult<T>, refresh = false): T => {
    const data = checked(result);
    const n = JSON.stringify(data ?? null).length;
    bytes.read += n;
    if (refresh) bytes.refresh += n;
    return data;
  };
  const ownFetches = <T>(db: MinimalClient, columns: string) => db.from<T>("fetches").select(columns).eq("source", OWN_FETCH_SOURCE);
  // One loader for the run: the home and own-page lookups share it, so no row is asked for twice.
  const factsById = factsLoader(client, facts, got);
  return {
    readBytes: () => ({ ...bytes }),
    async scans() {
      const db = await client();
      const out: StoredScanRow[] = [];
      for (let after: ScanRecord | undefined; ; ) {
        const page =
          got(await db.rpc<ScanRecord[]>("rescore_reports", { p_after_created_at: after?.created_at ?? null, p_after_id: after?.id ?? null, p_limit: PAGE })) ?? [];
        for (const s of page) {
          out.push({
            id: s.id,
            domain: s.domain,
            createdAt: s.created_at,
            status: s.status,
            score: s.score,
            drivers: s.drivers,
            md5: s.report_md5,
            report: s.report,
            siteId: s.site_id,
            isCurrent: s.is_current === true,
          });
        }
        if (page.length < PAGE) return out;
        after = page.at(-1);
      }
    },
    async homeReads(domain, onPageAt) {
      const db = await client();
      const rows = got(await db.from<HomeReadRow>("fetches").select("id, source, created_at, read_at:payload->readAt").in("source", ["egress.safeFetch", "on_page/instant_pages"]).eq("cache_key", `https://${domain}/`)) ?? [];
      const byId = new Map(rows.map((r) => [r.id, r] as const));
      const load = async (ids: readonly string[]): Promise<StoredRead[]> => {
        const found = await factsById(ids);
        return ids.flatMap((id) => {
          const row = byId.get(id)!;
          const f = found.get(id);
          return f === undefined ? [] : [{ source: row.source, created_at: row.created_at, facts: f }];
        });
      };
      return onPageAt === undefined ? load(rows.map((r) => r.id)) : homeReadsFor(rows, onPageAt, load);
    },
    async sites() {
      const rows = got(await (await client()).from<StoredSiteRow>("sites").select("id, domain, competitors, market"));
      return (rows ?? []).map((s) => ({ ...s, competitors: s.competitors ?? [] }));
    },
    async profiles() {
      const rows = got(
        await (await client()).from<StoredProfileName>("site_profiles").select("domain, site_name, home_title:inventory->0->>title")
      );
      return rows ?? [];
    },
    async ownReads(scan) {
      const own = got(await ownFetches<OwnReadRow>(await client(), "id, cache_key, created_at").eq("scan_id", scan.id).order("created_at", { ascending: true })) ?? [];
      if (scan.siteId === null || own.length === 0) return { own: [], ours: [], oursReads: [] };
      const publications = got(
        await (await client())
          .from<StoredPublication>("publications")
          .select("live_url, published_at, unpublished_at")
          .eq("site_id", scan.siteId)
          .not("live_url", "is", null)
      );
      const ours = livePagesAt(publications ?? [], scan.createdAt);
      const rows = ours.length === 0 ? [] : (got(await ownFetches<OwnReadRow>(await client(), "id, cache_key, created_at").in("cache_key", ours)) ?? []);
      const picked = new Set(oursPicked(rows, own));
      const found = await factsById([...own.map((r) => r.id), ...picked]);
      const asRead = (r: OwnReadRow) => {
        const f = found.get(r.id);
        return f === undefined ? [] : [{ url: r.cache_key, created_at: r.created_at, facts: f }];
      };
      return { own: own.flatMap(asRead), ours, oursReads: rows.filter((r) => picked.has(r.id)).flatMap(asRead) } satisfies OwnReads;
    },
    async answers(scanId) {
      const rows = got(
        await (await client())
          .from<{ source: string; cache_key: string; payload: unknown }>("fetches")
          .select("source, cache_key, payload")
          .eq("scan_id", scanId)
          .in("source", Object.values(AI_ANSWER_SOURCES))
      );
      return (rows ?? []).map((r) => {
        const answer = (Array.isArray(r.payload) ? r.payload[0] : null) as { text?: unknown; citedUrls?: unknown } | null;
        return {
          source: r.source,
          key: r.cache_key,
          text: typeof answer?.text === "string" ? answer.text.slice(0, AI_OVERVIEW_TEXT_MAX_CHARS) : null,
          whole: typeof answer?.text === "string" ? answer.text : null,
          citedUrls: Array.isArray(answer?.citedUrls) ? (answer.citedUrls as string[]) : null,
        };
      });
    },
    async writeScan(w) {
      const ok = checked(
        await (await client()).rpc<boolean>("rescore_scan", {
          p_id: w.id,
          p_md5: w.md5,
          p_changes: w.changes.map((c) => ({ path: c.path.map(String), value: c.value })),
          p_score: w.score,
          p_status: w.status,
          p_drivers: w.drivers,
          p_at: w.at,
          p_by: w.by,
        })
      );
      return ok === true;
    },
    async writeSite(w) {
      checked(await (await client()).from("sites").update({ market: w.market, competitors: w.competitors }).eq("id", w.id));
    },
    async writeProfileName(w) {
      const rows = checked(
        await (await client())
          .from<{ domain: string }>("site_profiles")
          .update({ site_name: w.to })
          .eq("domain", w.domain)
          .eq("site_name", w.from)
          .select("domain")
      );
      return (rows ?? []).length === 1;
    },
    async claim(at) {
      const db = await client();
      const waiting = checked(
        await db
          .from<{ id: string }>("rescore_runs")
          .select("id")
          .is("started_at", null)
          .order("requested_at", { ascending: true })
          .limit(1)
      );
      const next = waiting?.[0];
      if (next === undefined) return null;
      const claimed = checked(
        await db
          .from<RescoreRequest>("rescore_runs")
          .update({ started_at: at.toISOString() })
          .eq("id", next.id)
          .is("started_at", null)
          .select("id, mode, auto")
      );
      return claimed?.[0] ?? null;
    },
    async runs() {
      const rows = checked(
        await (await client())
          .from<{
            mode: RescoreRequest["mode"];
            derivation: string | null;
            requested_at: string;
            finished_at: string | null;
            error: string | null;
            held: string | null;
            scans_unreadable: number | null;
          }>("rescore_runs")
          .select("mode, derivation, requested_at, finished_at, error, held, scans_unreadable")
          .order("requested_at", { ascending: true })
      );
      return (rows ?? []).map((r) => ({
        mode: r.mode,
        derivation: r.derivation,
        requestedAt: r.requested_at,
        finishedAt: r.finished_at,
        error: r.error,
        held: r.held,
        unreadable: r.scans_unreadable,
      }));
    },
    async ask(mode, at) {
      checked(await (await client()).from("rescore_runs").insert({ mode, auto: true, requested_at: at.toISOString() }));
    },
    async answer(id, answer, o) {
      checked(
        await (await client())
          .from("rescore_runs")
          .update({
            finished_at: new Date().toISOString(),
            rescored_by: o.version,
            scans_read: answer.scansRead,
            scans_changed: answer.scansChanged,
            sites_moved: answer.sitesMoved,
            scans_written: answer.scansWritten,
            scans_left: answer.scansLeft,
            scans_unreadable: answer.scansUnreadable,
            stale_scans: answer.stale,
            derivation: o.derivation ?? null,
            held: answer.held,
            summary: answer.held === null ? answer.summary : `**Held:** ${answer.held}. Nothing is asked after it.\n\n${answer.summary}`,
            error: null,
          })
          .eq("id", id)
      );
    },
    async failed(id, error, o) {
      checked(
        await (await client())
          .from("rescore_runs")
          .update({ finished_at: o.at.toISOString(), error, derivation: o.derivation ?? null })
          .eq("id", id)
      );
    },
  };
}
