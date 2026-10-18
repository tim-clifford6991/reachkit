// scripts/costs/report.ts — what `npm run costs` works out and prints
// (SPEC §6, owner 2026-10-11, issue 1408; D57, issue 1286).
//
// Two sides, for today and each of the seven days before it (UTC days):
//
//   * **billed** — what the vendor says. DataForSEO: the drop in the
//     account's balance between the hourly readings at each end of the day,
//     with any deposit added back; where no reading stands at the day's
//     opening, the vendor's own total for its day. AI: Anthropic's cost
//     report for the day, where an admin key let the snapshot read it.
//   * **recorded** — what we wrote down from our own price list: the
//     production `fetches` ledger and the box's test spend log.
//
// They are warned about when they differ by more than 10% or by more than
// 10¢. The testing budget's €2 a day is judged on billed spend where it is
// known and on recorded spend where it is not.
//
// Pure: it reads no file and calls nothing. `scripts/costs.mjs` hands it the
// rows.
import { TEST_DAY_EUR, USD_PER_EUR } from "@/lib/config/constants";

/** D34: €2 a day across all live testing, and where the warning starts —
 *  the pin the owner's cost page reads too (issue 1478). */
export const DAY_CAP_EUR = TEST_DAY_EUR.cap;
export const DAY_WARN_EUR = TEST_DAY_EUR.warn;
/** Billed and recorded are warned about past either of these (issue 1408). */
const GAP_SHARE = 0.1;
const GAP_CENTS = 10;

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
/** A reading counts as the one at a day's boundary when it was taken from
 *  ninety minutes before midnight to ten minutes after: the timer fires on
 *  the hour, and one missed run still leaves the hour before. */
const BOUNDARY_BEFORE_MS = 1.5 * HOUR_MS;
const BOUNDARY_AFTER_MS = 10 * 60 * 1000;

export type Vendor = "dataforseo" | "ai";

/** One line of the box's spend log (`scripts/spend-log.mjs`). */
export interface SpendRow {
  at: string;
  issue: string;
  script: string;
  source: string;
  cents: number;
  billed: number | null;
}

/** Production spend from `fetches`, one row a call or a day's sum. */
export interface LedgerRow {
  day: string;
  source: string;
  cents: number;
  billed: number | null;
}

/** One line of `scripts/vendor-snapshot.mjs`. */
export interface Snapshot {
  at: string;
  dataforseo?: { balanceCents: number; depositedCents: number; dayCents?: number; day?: string; timezone?: string };
  anthropic?: { days: Record<string, number> };
}

export interface VendorDay {
  /** The box's test spend, and production's; `null` where the production
   *  ledger could not be read. Both are the price book's figures. */
  tests: number;
  production: number | null;
  recorded: number;
  billed: number | null;
  /** How `billed` was read: `null` where it is not known. */
  billedFrom: "balance" | "vendor day" | "cost report" | null;
  /** Set where billed and recorded differ by more than 10% or 10¢. */
  gap: { cents: number; share: number } | null;
  /** Calls whose own row carries the vendor's charge: that charge, and the
   *  estimate recorded for the same calls. */
  calls: { billed: number; estimated: number; count: number };
}

export interface DayLine {
  day: string;
  dataforseo: VendorDay;
  ai: VendorDay;
  /** The day's spend as the cap sees it: billed where known, else recorded. */
  judgedCents: number;
  state: "ok" | "warn" | "over";
}

export interface CostsReport {
  /** Oldest first; the last is today. */
  days: DayLine[];
  today: DayLine;
  /** Today's test spend from the box, by issue. */
  byIssue: { issue: string; cents: number }[];
  capCents: number;
  warnCents: number;
  ledgerRead: boolean;
  /** Whether the box holds an Anthropic admin key at all. */
  adminKey: boolean;
  /** The account's timezone, where the vendor's own day total was used. */
  vendorDayZone: string | null;
}

const DATAFORSEO_SOURCE = /^(?:\/v3\/)?(?:serp|dataforseo_labs|ai_optimization|on_page|keywords_data)\/|^dataforseo[:_]/;

/** Whose bill a ledger `source` is on. DataForSEO's are its endpoint paths;
 *  every other paid source is a model call site. */
export function vendorOf(source: string): Vendor {
  return DATAFORSEO_SOURCE.test(source) ? "dataforseo" : "ai";
}

const dayOf = (at: string): string => new Date(at).toISOString().slice(0, 10);
const startOf = (day: string): number => Date.parse(`${day}T00:00:00.000Z`);

/** The latest reading taken at a day boundary, if one was. */
function atBoundary(readings: readonly Snapshot[], instant: number): Snapshot | undefined {
  let found: Snapshot | undefined;
  for (const reading of readings) {
    const at = Date.parse(reading.at);
    if (at >= instant - BOUNDARY_BEFORE_MS && at <= instant + BOUNDARY_AFTER_MS) found = reading;
  }
  return found;
}

function dataForSeoBilled(snapshots: readonly Snapshot[], day: string, today: string): Pick<VendorDay, "billed" | "billedFrom"> {
  const readings = snapshots.filter((s) => s.dataforseo !== undefined);
  const open = atBoundary(readings, startOf(day));
  const close = day === today ? readings.at(-1) : atBoundary(readings, startOf(day) + DAY_MS);
  if (open?.dataforseo && close?.dataforseo && Date.parse(close.at) > Date.parse(open.at)) {
    const spent = open.dataforseo.balanceCents - close.dataforseo.balanceCents + (close.dataforseo.depositedCents - open.dataforseo.depositedCents);
    return { billed: Math.max(0, spent), billedFrom: "balance" };
  }
  // No reading at the day's opening: the vendor's own total for its day,
  // from the last reading that names this date.
  const named = readings.filter((s) => s.dataforseo?.day === day && s.dataforseo.dayCents !== undefined).at(-1);
  if (named?.dataforseo?.dayCents !== undefined) return { billed: named.dataforseo.dayCents, billedFrom: "vendor day" };
  return { billed: null, billedFrom: null };
}

function aiBilled(snapshots: readonly Snapshot[], day: string): Pick<VendorDay, "billed" | "billedFrom"> {
  const reading = snapshots.filter((s) => s.anthropic?.days[day] !== undefined).at(-1);
  const cents = reading?.anthropic?.days[day];
  return cents === undefined ? { billed: null, billedFrom: null } : { billed: cents, billedFrom: "cost report" };
}

function gapOf(billed: number | null, recorded: number): VendorDay["gap"] {
  if (billed === null) return null;
  const cents = Math.abs(billed - recorded);
  const base = billed > 0 ? billed : recorded;
  const share = base > 0 ? cents / base : 0;
  return cents > GAP_CENTS || share > GAP_SHARE ? { cents, share } : null;
}

export function reconcile(a: { spend: readonly SpendRow[]; ledger: readonly LedgerRow[] | null; snapshots: readonly Snapshot[]; adminKey: boolean; now?: Date }): CostsReport {
  const today = (a.now ?? new Date()).toISOString().slice(0, 10);
  const capCents = DAY_CAP_EUR * USD_PER_EUR.rate * 100;
  const warnCents = DAY_WARN_EUR * USD_PER_EUR.rate * 100;
  const snapshots = [...a.snapshots].sort((x, y) => Date.parse(x.at) - Date.parse(y.at));

  const days: DayLine[] = [];
  for (let back = 7; back >= 0; back -= 1) {
    const day = new Date(startOf(today) - back * DAY_MS).toISOString().slice(0, 10);
    const tests = a.spend.filter((row) => dayOf(row.at) === day);
    const production = a.ledger?.filter((row) => row.day === day) ?? null;
    const line = (vendor: Vendor): VendorDay => {
      const mine = <T extends { source: string }>(rows: readonly T[]): T[] => rows.filter((row) => vendorOf(row.source) === vendor);
      const sum = (rows: readonly { cents: number }[]): number => rows.reduce((total, row) => total + row.cents, 0);
      const testCents = sum(mine(tests));
      const productionCents = production === null ? null : sum(mine(production));
      const recorded = testCents + (productionCents ?? 0);
      const charged = [...mine(tests), ...mine(production ?? [])].filter((row) => row.billed !== null);
      const billed = vendor === "dataforseo" ? dataForSeoBilled(snapshots, day, today) : aiBilled(snapshots, day);
      return {
        tests: testCents,
        production: productionCents,
        recorded,
        ...billed,
        gap: gapOf(billed.billed, recorded),
        calls: { billed: charged.reduce((total, row) => total + (row.billed ?? 0), 0), estimated: sum(charged), count: charged.length },
      };
    };
    const dataforseo = line("dataforseo");
    const ai = line("ai");
    const judgedCents = (dataforseo.billed ?? dataforseo.recorded) + (ai.billed ?? ai.recorded);
    days.push({ day, dataforseo, ai, judgedCents, state: judgedCents >= capCents ? "over" : judgedCents >= warnCents ? "warn" : "ok" });
  }

  const issues = new Map<string, number>();
  for (const row of a.spend) if (dayOf(row.at) === today) issues.set(row.issue, (issues.get(row.issue) ?? 0) + row.cents);

  return {
    days,
    today: days.at(-1)!,
    byIssue: [...issues].map(([issue, cents]) => ({ issue, cents })).sort((x, y) => y.cents - x.cents || x.issue.localeCompare(y.issue)),
    capCents,
    warnCents,
    ledgerRead: a.ledger !== null,
    adminKey: a.adminKey,
    vendorDayZone: snapshots.filter((s) => s.dataforseo?.timezone !== undefined).at(-1)?.dataforseo?.timezone ?? null,
  };
}

const money = (cents: number): string => `${cents.toFixed(2)}¢`;
const both = (cents: number): string => `$${(cents / 100).toFixed(2)} (€${(cents / 100 / USD_PER_EUR.rate).toFixed(2)})`;
const NAMES: Record<Vendor, string> = { dataforseo: "DataForSEO", ai: "AI" };

function billedWords(line: VendorDay, zone: string | null): string {
  if (line.billed === null) return "billed not known";
  const how =
    line.billedFrom === "balance" ? "balance drop" : line.billedFrom === "vendor day" ? `the vendor's day total${zone === null ? "" : `, ${zone}`}` : "Anthropic's cost report";
  return `billed ${money(line.billed)} (${how})`;
}

function recordedWords(line: VendorDay): string {
  return `recorded ${money(line.recorded)} (tests ${money(line.tests)} + production ${line.production === null ? "unread" : money(line.production)})`;
}

function gapWords(line: VendorDay): string {
  return line.gap === null ? "" : `differ by ${money(line.gap.cents)} (${Math.round(line.gap.share * 100)}%)`;
}

/** What `npm run costs` prints. */
export function render(report: CostsReport): string {
  const { today } = report;
  const lines = [
    `Costs, UTC days. Figures are US cents; €1 = $${USD_PER_EUR.rate} (${USD_PER_EUR.source}, ${USD_PER_EUR.asOf}).`,
    "",
    `Today (${today.day})`,
  ];
  for (const vendor of ["dataforseo", "ai"] as const) {
    const line = today[vendor];
    lines.push(`  ${NAMES[vendor].padEnd(11)} ${billedWords(line, report.vendorDayZone)}; ${recordedWords(line)}`);
    if (line.gap !== null) lines.push(`  WARNING: ${NAMES[vendor]} billed and recorded ${gapWords(line)}.`);
    if (line.calls.count > 0) lines.push(`              Calls that carry the vendor's own charge: ${line.calls.count}, ${money(line.calls.billed)} billed against ${money(line.calls.estimated)} estimated`);
  }
  if (!report.adminKey) lines.push("  AI spend: estimated from tokens; no admin key");
  if (!report.ledgerRead) lines.push("  Production ledger: not read (no database key on the box, and no --ledger file). Recorded is test spend only.");

  const on = (line: VendorDay): string => (line.billed === null ? "recorded" : "billed");
  lines.push(
    "",
    `  Against the €${DAY_CAP_EUR} a day D34 allows (${money(report.capCents)}): ${both(today.judgedCents)}, on DataForSEO ${on(today.dataforseo)} and AI ${on(today.ai)}`
  );
  if (today.state === "over") lines.push(`  OVER: today's spend has reached €${DAY_CAP_EUR}. Stop and ask the owner before another live call (D34).`);
  if (today.state === "warn") lines.push(`  WARNING: today's spend is past €${DAY_WARN_EUR.toFixed(2)} of the €${DAY_CAP_EUR} a day D34 allows.`);

  if (report.byIssue.length > 0) {
    lines.push("", "  Test spend from the box today, by issue (recorded):");
    for (const row of report.byIssue) lines.push(`    ${row.issue.padEnd(14)} ${money(row.cents)}`);
  }

  const cell = (line: VendorDay): string => `${line.billed === null ? "—" : money(line.billed)} / ${money(line.recorded)}`.padEnd(22);
  lines.push("", "Today and the last 7 days: billed / recorded", `  ${"day".padEnd(11)} ${"DataForSEO".padEnd(22)} ${"AI".padEnd(22)} against the cap`);
  for (const day of [...report.days].reverse()) {
    const notes = [
      ...(["dataforseo", "ai"] as const).filter((vendor) => day[vendor].gap !== null).map((vendor) => `WARNING ${NAMES[vendor]} ${gapWords(day[vendor])}`),
      ...(day.state === "over" ? [`over €${DAY_CAP_EUR}`] : []),
    ];
    lines.push(`  ${day.day.padEnd(11)} ${cell(day.dataforseo)} ${cell(day.ai)} ${both(day.judgedCents)}${notes.length === 0 ? "" : `  ${notes.join("; ")}`}`);
  }
  return lines.join("\n");
}
