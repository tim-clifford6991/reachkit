// scripts/rescore/run.ts — `npm run rescore` (owner ruling 2026-10-14, issue
// 1426): every stored scan and site rival set, scored again by the current
// code from the export `scripts/rescore/export.sql` takes, and the change
// they would take.
//
// The dry run prints one row per scan — score, band, the three factors, the
// limiting factor, the rivals and the status, before and after — then the
// totals, the scans that could not be fully recomputed and why, the site
// rival sets that move, and the site profiles read off a protection's page.
// `--apply` also writes the statements: each rewrites only the members that
// moved, keeps the report it replaces under `report.previous` and the scan's
// score, status and drivers under `report.previousColumns` (the first
// originals, on a second re-score), and carries `rescoredAt` and
// `rescoredBy` (the commit). A scan whose stored report changed since the export is left
// alone: each statement is guarded by the report's checksum.
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { refuseNetwork } from "@/lib/egress/offline";
import { isProtectionName } from "@/lib/measure/challenge";
import type { Measured } from "@/lib/measure/measured";
import type { Drivers, ScoreFactorName } from "@/lib/measure/score";
import type { RivalConclusion } from "@/lib/market/infer/types";
import { readStoredReport } from "@/lib/scan/report";
import { rehomeSite, rescoreScan, type RehomedSite, type Rescored, type RescoredMembers, type RescoreReport, type RescoreScan } from "@/lib/scan/rescore";
import type { ScanStatus } from "@/lib/scan/store";

export interface Options {
  /** One export, or the batches of one taken in parts. */
  from: readonly string[];
  apply: boolean;
  out: string;
  /** The commit the code that re-scored is at. */
  version: string;
  at: Date;
}

interface ExportedScan {
  id: string;
  createdAt: string;
  status: ScanStatus;
  score: number | null;
  drivers: unknown;
  md5: string;
  report: unknown;
  home: { created_at: string; payload: unknown } | null;
  rendered: readonly { created_at: string; payload: unknown }[];
}

interface ExportedSite {
  id: string;
  domain: string;
  competitors: readonly string[];
  rivals: readonly RivalConclusion[] | null;
  overridden: boolean;
  scanId: string | null;
}

interface Export {
  exportedAt: string;
  scans: readonly ExportedScan[];
  sites: readonly ExportedSite[];
  profiles: readonly { domain: string; siteName: string | null }[];
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

export interface Row {
  scan: ExportedScan;
  report: RescoreReport;
  result: Rescored;
}

/** The lists the export rebuilds, each still a list where it was read: an
 *  export that lost one (issue 1431) is named here, not met deep in
 *  `cardsOf`. */
function valuesKept(report: RescoreReport): void {
  for (const name of ["questions", "rivalSizes"] as const) {
    const m = report[name];
    if (m.kind !== "unmeasured" && !Array.isArray(m.value)) throw new Error(`${name} is ${m.kind} but the export carries no list`);
  }
}

/** Each exported scan read and scored again; a report this build cannot read
 *  is listed, never guessed at. */
export function rescoreExport(doc: Export): { rows: Row[]; unreadable: { id: string; because: string }[] } {
  const rows: Row[] = [];
  const unreadable: { id: string; because: string }[] = [];
  for (const scan of doc.scans) {
    let report: RescoreReport;
    try {
      // The export is the report's own members, narrowed: the reader lifts
      // an older version of them exactly as it lifts the whole report.
      report = readStoredReport(scan.report) as unknown as RescoreReport;
      valuesKept(report);
    } catch (error) {
      unreadable.push({ id: scan.id, because: error instanceof Error ? error.message : String(error) });
      continue;
    }
    const input: RescoreScan = {
      id: scan.id,
      status: scan.status,
      score: scan.score,
      drivers: driversOf(scan.drivers),
      report,
      home: scan.home,
      rendered: scan.rendered,
    };
    rows.push({ scan, report, result: rescoreScan(input) });
  }
  return { rows, unreadable };
}

export function rehomeExport(doc: Export, rows: readonly Row[]): { site: ExportedSite; moved: RehomedSite }[] {
  const out: { site: ExportedSite; moved: RehomedSite }[] = [];
  for (const site of doc.sites) {
    const report = rows.find((row) => row.scan.id === site.scanId)?.report ?? null;
    const moved = rehomeSite({ ...site, report: report === null ? null : { ...report, ownRankedRows: [] } });
    if (moved !== null) out.push({ site, moved });
  }
  return out;
}

// ── The table ───────────────────────────────────────────────────────────

const FACTORS: readonly ScoreFactorName[] = ["foundations", "answerability", "presence"];

function scoreText(m: RescoredMembers): string {
  const s = m.verdict.scoreAndBand;
  return s.kind === "unmeasured" ? "—" : String(s.value.score);
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

export function table(rows: readonly Row[], at: Options["at"]): string[] {
  void at;
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

export function totals(rows: readonly Row[], unreadable: readonly { id: string; because: string }[]): string[] {
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
  const lines = [
    `- Scans read: ${rows.length}; not readable by this build: ${unreadable.length}`,
    `- Scans that change: ${count((row) => row.result.changes.length > 0)}`,
    `- Score moves on ${deltas.length}: ${up.length} up (${up.join(", ") || "none"}), ${down.length} down (${down.join(", ") || "none"})`,
    `- Score becomes unmeasured (no number): ${unscored}; becomes measured: ${scored}`,
    `- Band changes: ${count((row) => bandText(row.result.before) !== bandText(row.result.after))}`,
    `- Rivals change: ${count(touched("rivals"))}; presence card: ${count(touched("presence"))}; AI answers: ${count(touched("aiAnswers"))}; coherence: ${count(touched("coherence"))}`,
    `- Verdict rewritten without a score move (factors, limiting factor or unread inputs): ${count((row) => touched("verdict")(row) && scoreText(row.result.before) === scoreText(row.result.after))}`,
    `- Status changes: ${count((row) => row.scan.status !== row.result.status)}`,
  ];
  return lines;
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

/** Batches of one export as one: every batch carries the same sites and
 *  profiles, and each scan once. */
function merged(docs: readonly Export[]): Export {
  const [first, ...rest] = docs;
  if (first === undefined) throw new Error("--from names no export");
  const scans = new Map(first.scans.map((scan) => [scan.id, scan]));
  for (const doc of rest) for (const scan of doc.scans) scans.set(scan.id, scan);
  const exportedAt = docs.map((d) => d.exportedAt).sort().at(-1) ?? first.exportedAt;
  return { ...first, exportedAt, scans: [...scans.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) };
}

// ── The statements ──────────────────────────────────────────────────────

function text(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function json(value: unknown): string {
  return `${text(JSON.stringify(value))}::jsonb`;
}

function pathOf(p: readonly (string | number)[]): string {
  return text(`{${p.join(",")}}`);
}

export function scanStatement(row: Row, o: Pick<Options, "version" | "at">): string | null {
  const { scan, result } = row;
  const columnsMove = scan.score !== result.score || scan.status !== result.status;
  if (result.changes.length === 0 && !columnsMove) return null;
  let report = "(report - 'previous' - 'previousColumns' - 'rescoredAt' - 'rescoredBy')";
  for (const change of result.changes) report = `jsonb_set(${report}, ${pathOf(change.path)}, ${json(change.value)})`;
  report = [
    `${report} || jsonb_build_object(`,
    "    'previous', coalesce(report->'previous', report),",
    "    'previousColumns', coalesce(report->'previousColumns', jsonb_build_object('score', score, 'status', status, 'drivers', drivers)),",
    `    'rescoredAt', ${text(o.at.toISOString())}, 'rescoredBy', ${text(o.version)})`,
  ].join("\n");
  return [
    "update scans set",
    `  report = ${report},`,
    `  score = ${result.score === null ? "null" : String(result.score)},`,
    `  status = ${text(result.status)},`,
    `  drivers = ${json(result.drivers)}`,
    `where id = ${text(scan.id)} and md5(report::text) = ${text(scan.md5)};`,
  ].join("\n");
}

export function siteStatement(site: ExportedSite, moved: RehomedSite, o: Pick<Options, "version" | "at">): string {
  return [
    "update sites set",
    `  market = jsonb_set(market, '{current,rivals}', ${json(moved.rivals)}) || jsonb_build_object('rescored', jsonb_build_object(`,
    "    'previous', coalesce(market->'rescored'->'previous', jsonb_build_object('rivals', market->'current'->'rivals', 'competitors', competitors)),",
    `    'at', ${text(o.at.toISOString())}, 'by', ${text(o.version)})),`,
    `  competitors = ${json(moved.competitors)}`,
    `where id = ${text(site.id)};`,
  ].join("\n");
}

export function main(o: Options): number {
  refuseNetwork("npm run rescore", "The re-score reads stored data only and buys nothing (issue 1426).");
  const doc = merged(o.from.map((file) => JSON.parse(readFileSync(file, "utf8")) as Export));
  // The pass's own log lines (one per card counted) are not this report.
  const log = console.log;
  console.log = () => undefined;
  const { rows, unreadable } = rescoreExport(doc);
  const sites = rehomeExport(doc, rows);
  console.log = log;
  const protectedProfiles = doc.profiles.filter((p) => p.siteName !== null && isProtectionName(p.siteName, p.domain));

  const out: string[] = [
    `# Re-score of the scans stored up to ${doc.exportedAt}, by ${o.version}`,
    "",
    "Before → after where it moves. F/A/P are Foundations, Answerability and Presence; — is unmeasured.",
    "",
    ...table(rows, o.at),
    "",
    "## Totals",
    "",
    ...totals(rows, unreadable),
    "",
    "## Not fully recomputed",
    "",
    ...keptLines(rows, unreadable),
    "",
    "## Site rival sets",
    "",
    ...(sites.length === 0
      ? [`- ${doc.sites.length} read; none moves.`]
      : sites.map(({ site, moved }) => `- ${site.domain}: ${moved.moved.map((m) => `${m.name} ${m.from} → ${m.to ?? "dropped"}`).join("; ")}`)),
    "",
    "## Site profiles",
    "",
    `- ${doc.profiles.length} read. Products, claims and voice are model answers over the pages read; none is asked again.`,
    ...(protectedProfiles.length === 0
      ? ["- None carries a protection page's name."]
      : [
          `- Read off a protection's page, so their products, claims and voice need a model call and stand as stored; the name is already hidden where it is read: ${protectedProfiles.map((p) => `${p.domain} ("${p.siteName}")`).join(", ")}`,
        ]),
  ];
  console.log(out.join("\n"));

  if (o.apply) {
    const statements = [
      ...rows.map((row) => scanStatement(row, o)).filter((s): s is string => s !== null),
      ...sites.map(({ site, moved }) => siteStatement(site, moved, o)),
    ];
    mkdirSync(path.dirname(o.out), { recursive: true });
    writeFileSync(o.out, `${statements.join("\n\n")}\n`);
    console.error(
      `\n${statements.length} statements written to ${o.out}. Run them through the Supabase connector, then export again: a second run changes nothing.`
    );
  }
  return 0;
}
