// src/lib/scan/rescore-run.ts — the production re-score (issue 1433): every
// stored scan and site rival set, read straight from the database, scored
// again by the deployed code with `rescoreScan` and `rehomeSite`, and the
// before and after written back where the master session reads it.
//
// The owner's ruling of 2026-10-14 (SPEC §2, issue 1426) fits every scoring,
// rival or market change to every stored scan at 0¢. The rows are read in
// full, so nothing is narrowed or carried through a connector; each
// computation runs inside `offline`, so no vendor, model or site can be
// reached while a scan is scored. The database reads and writes are the only
// network this does, and they happen outside it.
//
// A dry run writes the summary only. An apply also writes each scan that
// moves through `rescore_scan` (`supabase/migrations/20261014130000_scans_rescore.sql`):
// only the moved paths, the replaced report under `report.previous`, the
// stamps, and the report's checksum as the guard, so a scan written since it
// was read is left alone and a second apply changes nothing.
import { offline } from "@/lib/egress/offline";
import type { Measured } from "@/lib/measure/measured";
import type { Drivers, ScoreFactorName } from "@/lib/measure/score";
import type { RivalConclusion } from "@/lib/market/infer/types";
import { promptSiteName } from "@/lib/market/prompts/generate";
import { rewrittenSiteName, storedSiteName } from "@/lib/site-profile/site-name";
import { AI_ANSWER_SOURCES, AI_OVERVIEW_TEXT_MAX_CHARS } from "@/lib/vendors/dataforseo/types";
import { readStoredReport } from "./report";
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

/** A stored read of a site's home page (`fetches`). */
export interface StoredRead {
  source: "egress.safeFetch" | "on_page/instant_pages";
  created_at: string;
  payload: unknown;
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
  /** The home page reads stored for `https://<domain>/`. */
  homeReads(domain: string): Promise<readonly StoredRead[]>;
  sites(): Promise<readonly StoredSiteRow[]>;
  profiles(): Promise<readonly StoredProfileName[]>;
  /** The AI Mode and ChatGPT answers a scan bought, as `fetches` keeps them
   *  under it (issue 1420). Asked only for a site's current scan, the one
   *  whose report carries those engines' cells. */
  answers(scanId: string): Promise<readonly StoredAnswer[]>;
  /** False where the report's checksum is no longer `md5`: nothing written. */
  writeScan(write: ScanWrite): Promise<boolean>;
  writeSite(write: SiteWrite): Promise<void>;
  /** False where the stored name is no longer `from`: nothing written. */
  writeProfileName(write: ProfileNameWrite): Promise<boolean>;
}

export interface RescoreOptions {
  apply: boolean;
  /** The deployed commit. */
  version: string;
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

function readAt(read: StoredRead): number {
  const at = (read.payload as { readAt?: unknown } | null)?.readAt;
  return typeof at === "string" ? Date.parse(at) : Number.NaN;
}

/** The home read the report's on-page facts came from: the newest read at
 *  or before them. */
function homeOf(report: RescoreReport, reads: readonly StoredRead[]): { created_at: string; payload: unknown } | null {
  if (report.onPage.kind === "unmeasured") return null;
  const before = new Date(report.onPage.at).getTime();
  let best: StoredRead | null = null;
  for (const read of reads) {
    if (read.source !== "egress.safeFetch" || !(readAt(read) <= before)) continue;
    if (best === null || readAt(read) > readAt(best)) best = read;
  }
  return best === null ? null : { created_at: best.created_at, payload: best.payload };
}

/** One stored scan scored again; a report this build cannot read is listed,
 *  never guessed at. */
export function rescoreRow(
  scan: StoredScanRow,
  reads: readonly StoredRead[],
  said: { siteName: string | null; answers: readonly StoredAnswer[]; market?: RescoreScan["market"] } = { siteName: null, answers: [] }
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
    home: homeOf(report, reads),
    rendered: reads.filter((r) => r.source === "on_page/instant_pages").map((r) => ({ created_at: r.created_at, payload: r.payload })),
    siteName: said.siteName,
    answers: said.answers,
    startedAt: scan.createdAt,
    ...(said.market === undefined ? {} : { market: said.market }),
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
  return {
    ...(current?.kind === undefined ? {} : { kind: current.kind }),
    ...(current?.serves === undefined ? {} : { serves: current.serves }),
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
    `- Rivals change: ${count(touched("rivals"))}; presence card: ${count(touched("presence"))}; AI answers: ${count(touched("aiAnswers"))}; coherence: ${count(touched("coherence"))}`,
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
    "- Answerability, on every scan: it is read from the home page and the pages beyond it, and a report keeps only the home page's facts. Its stored value stands.",
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

/** Every stored scan and site rival set scored again; on apply, each one
 *  that moves written back. */
export async function rescoreStored(store: RescoreStore, o: RescoreOptions): Promise<RescoreAnswer> {
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
    const reads = await store.homeReads(domain);
    for (const scan of ofDomain) {
      const answers = scan.siteId !== null && scan.isCurrent ? await store.answers(scan.id) : [];
      const market = scan.siteId === null ? undefined : markets.get(scan.siteId);
      const said = { siteName: names.get(domain) ?? null, answers, ...(market === undefined ? {} : { market }) };
      const row = quietly(() => rescoreRow(scan, reads, said));
      if ("result" in row) rows.push(row);
      else unreadable.push(row);
    }
  }
  rows.sort((a, b) => a.scan.createdAt.localeCompare(b.scan.createdAt) || a.scan.id.localeCompare(b.scan.id));

  const movedSites = quietly(() => rehome(sites, rows));

  let written: { scans: number; left: string[]; names: number } | null = null;
  if (o.apply) {
    written = { scans: 0, left: [], names: 0 };
    const at = o.at.toISOString();
    for (const row of rows.filter(moves)) {
      const { result } = row;
      const ok = await store.writeScan({
        id: row.scan.id,
        md5: row.scan.md5,
        changes: result.changes,
        score: result.score,
        status: result.status,
        drivers: result.drivers,
        at,
        by: o.version,
      });
      if (ok) written.scans += 1;
      else written.left.push(row.scan.id);
    }
    for (const { site, moved } of movedSites) await store.writeSite(siteWrite(site, moved, o));
    for (const name of renamed) if (await store.writeProfileName(name)) written.names += 1;
  }

  return {
    scansRead: rows.length + unreadable.length,
    scansChanged: rows.filter(moves).length,
    sitesMoved: movedSites.length + renamed.length,
    scansWritten: written?.scans ?? 0,
    scansLeft: written?.left.length ?? 0,
    summary: quietly(() => summaryOf({ o, rows, unreadable, sites, movedSites, profiles, renamed, written })),
  };
}

// ── The request ─────────────────────────────────────────────────────────

/** A `rescore_runs` row the master session inserted, claimed by this run. */
export interface RescoreRequest {
  id: string;
  mode: "dry" | "apply";
}

export interface RescoreQueue {
  /** The oldest request not yet started, marked started; `null` where none
   *  waits or another tick claimed it first. */
  claim(at: Date): Promise<RescoreRequest | null>;
  answer(id: string, answer: RescoreAnswer, o: RescoreOptions): Promise<void>;
  failed(id: string, error: string, at: Date): Promise<void>;
}

/** Answers one claimed request. A failure is written to its row, then
 *  rethrown for the job's own retry. */
export async function answerRequest(
  request: RescoreRequest,
  o: Omit<RescoreOptions, "apply">,
  db: RescoreQueue & RescoreStore = databaseRescore()
): Promise<Omit<RescoreAnswer, "summary">> {
  const options: RescoreOptions = { ...o, apply: request.mode === "apply" };
  try {
    const answer = await rescoreStored(db, options);
    await db.answer(request.id, answer, options);
    // The step's answer is stored between invocations: the counts, not the table.
    return { scansRead: answer.scansRead, scansChanged: answer.scansChanged, sitesMoved: answer.sitesMoved, scansWritten: answer.scansWritten, scansLeft: answer.scansLeft };
  } catch (error) {
    await db.failed(request.id, error instanceof Error ? error.message : String(error), o.at).catch(() => undefined);
    throw error;
  }
}

export async function claimRequest(at: Date, db: RescoreQueue = databaseRescore()): Promise<RescoreRequest | null> {
  return db.claim(at);
}

// ── The database ────────────────────────────────────────────────────────

/** `rescore_runs`, `report_md5` and `rescore_scan` are not in the generated
 *  `Database` type — the same narrow cast `src/jobs/heartbeat.ts` documents. */
interface MinimalResult<T> {
  data: T | null;
  error: { message: string } | null;
}
interface MinimalQuery<T> extends PromiseLike<MinimalResult<T[]>> {
  select(columns: string): MinimalQuery<T>;
  update(values: Record<string, unknown>): MinimalQuery<T>;
  eq(column: string, value: unknown): MinimalQuery<T>;
  in(column: string, values: readonly unknown[]): MinimalQuery<T>;
  is(column: string, value: null): MinimalQuery<T>;
  not(column: string, operator: string, value: unknown): MinimalQuery<T>;
  order(column: string, options: { ascending: boolean }): MinimalQuery<T>;
  range(from: number, to: number): MinimalQuery<T>;
  limit(n: number): MinimalQuery<T>;
}
interface MinimalClient {
  from<T>(table: string): MinimalQuery<T>;
  rpc<T>(fn: string, args: Record<string, unknown>): PromiseLike<MinimalResult<T>>;
}

const PAGE = 25;

function checked<T>(result: MinimalResult<T>): T {
  if (result.error !== null) throw new Error(result.error.message);
  return result.data as T;
}

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

/** The database, through `dbAdmin()` imported at the call: a static import
 *  would put a database client on every graph this module is on. */
export function databaseRescore(): RescoreQueue & RescoreStore {
  async function client(): Promise<MinimalClient> {
    const { dbAdmin } = await import("@/lib/db");
    return dbAdmin() as unknown as MinimalClient;
  }
  return {
    async scans() {
      const db = await client();
      const out: StoredScanRow[] = [];
      for (let from = 0; ; from += PAGE) {
        const page = checked(
          await db
            .from<ScanRecord>("scans")
            .select("id, domain, created_at, status, score, drivers, report, report_md5, site_id, is_current")
            .not("report", "is", null)
            .order("created_at", { ascending: true })
            .order("id", { ascending: true })
            .range(from, from + PAGE - 1)
        );
        for (const s of page ?? []) {
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
        if ((page ?? []).length < PAGE) return out;
      }
    },
    async homeReads(domain) {
      const rows = checked(
        await (await client())
          .from<StoredRead>("fetches")
          .select("source, created_at, payload")
          .in("source", ["egress.safeFetch", "on_page/instant_pages"])
          .eq("cache_key", `https://${domain}/`)
      );
      return rows ?? [];
    },
    async sites() {
      const rows = checked(await (await client()).from<StoredSiteRow>("sites").select("id, domain, competitors, market"));
      return (rows ?? []).map((s) => ({ ...s, competitors: s.competitors ?? [] }));
    },
    async profiles() {
      const rows = checked(
        await (await client()).from<StoredProfileName>("site_profiles").select("domain, site_name, home_title:inventory->0->>title")
      );
      return rows ?? [];
    },
    async answers(scanId) {
      const rows = checked(
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
          .from<{ id: string; mode: RescoreRequest["mode"] }>("rescore_runs")
          .select("id, mode")
          .is("started_at", null)
          .order("requested_at", { ascending: true })
          .limit(1)
      );
      const next = waiting?.[0];
      if (next === undefined) return null;
      const claimed = checked(
        await db
          .from<{ id: string; mode: RescoreRequest["mode"] }>("rescore_runs")
          .update({ started_at: at.toISOString() })
          .eq("id", next.id)
          .is("started_at", null)
          .select("id, mode")
      );
      return claimed?.[0] ?? null;
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
            summary: answer.summary,
            error: null,
          })
          .eq("id", id)
      );
    },
    async failed(id, error, at) {
      checked(await (await client()).from("rescore_runs").update({ finished_at: at.toISOString(), error }).eq("id", id));
    },
  };
}
