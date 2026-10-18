// tests/opportunities/verdicts/harness.ts — the fake store the §9 suites
// judge against.
//
// Not a suite. `VerdictStore` is the one door between the judgement and
// Postgres, so a double here is the whole database: the suites run in the
// `node` project, which has no substrate, and every rule under test is
// application logic rather than a constraint (the constraints are asserted
// against the migration's own text in `migration.test.ts`).
//
// The double enforces the two things the schema enforces and the code
// relies on: the unique `(publication_id, week_start)` key, and that a row
// is only ever inserted — there is no update and no delete on it here
// either, so a test cannot demonstrate a behaviour the grants forbid.
// The bindings `env.ts` parses at module load, before anything that
// reaches `@/lib/db` is evaluated.
import "../env";
import { assembleReport } from "../../../src/lib/scan/store";
import type { ReportSections } from "../../../src/lib/scan/store";
import type { StoredReport } from "../../../src/lib/scan/report";
import { measured, measuredZero, type Measured } from "../../../src/lib/measure/measured";
import type { Acceptance } from "../../../src/lib/opportunities/types";
import type {
  PublishedPage,
  VerdictInsert,
  VerdictRecord,
  VerdictStore,
} from "../../../src/lib/opportunities/verdicts/store";
import type { VerifyChecks, VerifyOutcome } from "../../../src/lib/publish/types";
import { setVerdictStore } from "../../../src/lib/opportunities/verdicts/store";
import { AT, DOMAIN, SITE_ID, question, reportOf, serp } from "../fixtures";

export { AT, DOMAIN, SITE_ID };

export const WEEK = "2026-08-31";
export const PREVIOUS_WEEK = "2026-08-24";

/** The address the fixture page answers at, and the row the fixture SERP
 *  places it with (issue 1518: a page's place is its own address's). */
export const PAGE_URL = "https://content.example.com/best-user-onboarding-software";

export function pageOf(over: Partial<PublishedPage> = {}): PublishedPage {
  return {
    publicationId: "pub-1",
    acceptance: { form: "top20", query: "best user onboarding software" },
    publishedAt: new Date("2026-05-01T00:00:00.000Z"),
    unpublishedAt: null,
    domain: DOMAIN,
    liveUrl: PAGE_URL,
    verification: null,
    ...over,
  };
}

/** The stored outcome of the one check at 24 hours, as #45's own shape.
 *  `failed` names the checks that came back false; every other check is a
 *  measured pass, so a fixture cannot accidentally assert a note composed
 *  from a check that said nothing. */
export function verification(
  outcome: VerifyOutcome["outcome"],
  failed: readonly (keyof VerifyChecks)[] = []
): VerifyOutcome {
  if (outcome === "page_not_found") return { outcome: "page_not_found", status: 404, checkedAt: AT };
  if (outcome === "could_not_confirm") {
    return { outcome: "could_not_confirm", why: "unreachable", checkedAt: AT };
  }
  const ids: (keyof VerifyChecks)[] = ["reachable", "indexable", "sitemap", "aiReadable"];
  const checks = {} as VerifyChecks;
  for (const id of ids) {
    checks[id] = failed.includes(id) ? measuredZero(false, AT) : measured(true, AT);
  }
  return { outcome: "found", checks, checkedAt: AT };
}

/** A row as `page_verdicts` would have stored it. */
export function record(over: Partial<VerdictRecord> = {}): VerdictRecord {
  return {
    publicationId: "pub-1",
    week: PREVIOUS_WEEK,
    verdict: "working",
    cause: null,
    measuredAt: AT,
    measured: measured(3, AT),
    movement: null,
    ...over,
  };
}

/** A report whose measured SERP puts the fixture page at `position`, or
 *  leaves it absent where `position` is null. The question and the
 *  search are the fixture's own, so the acceptance tests above key on
 *  them. */
export function reportWithOwnPlace(
  position: number | null,
  over: Partial<ReportSections> = {}
): StoredReport {
  const rivals = [
    { position: 1, domain: "appcues.com", url: "https://appcues.com/a", title: "Appcues" },
    { position: 2, domain: "userpilot.com", url: "https://userpilot.com/b", title: "Userpilot" },
  ];
  const organic =
    position === null
      ? rivals
      : [...rivals, { position, domain: "content.example.com", url: PAGE_URL, title: "Ours" }];
  return reportOf({ questions: [question()], serps: [serp({ organic })] }, over);
}

/** A report with no measurable question at all — the shape a week that
 *  reached nothing stores. Distinct from *no report*, which is `no_week`. */
export function emptyReport(over: Partial<ReportSections> = {}): StoredReport {
  return reportOf({ questions: [], serps: [] }, over);
}

export interface Fake extends VerdictStore {
  readonly inserted: VerdictInsert[];
  /** Everything on disk, in the order it was written. */
  readonly rows: VerdictInsert[];
}

export function fakeStore(a: {
  pages?: readonly PublishedPage[];
  report?: StoredReport | null;
  scanId?: string;
  history?: readonly VerdictRecord[];
  thisWeek?: readonly VerdictRecord[];
  /** Another week's stored report, by week (issue 1518: a movement reads
   *  the previous week's place from its own report). A week not named
   *  here reads `report`. */
  reports?: Readonly<Record<string, StoredReport | null>>;
}): Fake {
  const inserted: VerdictInsert[] = [];
  const rows: VerdictInsert[] = [];
  const held = new Set<string>();
  const scanId = a.scanId ?? "scan-1";

  const store: Fake = {
    inserted,
    rows,
    async publishedPages() {
      return a.pages ?? [pageOf()];
    },
    async weekReport(q) {
      const named = a.reports !== undefined && q.week in a.reports ? a.reports[q.week] : undefined;
      const report = named !== undefined ? named : a.report === undefined ? reportWithOwnPlace(3) : a.report;
      if (report === null) return null;
      return { scanId, report };
    },
    async verdictsForWeek(q) {
      const written = rows
        .filter((row) => row.week === q.week)
        .map(
          (row): VerdictRecord => ({
            publicationId: row.publicationId,
            week: row.week,
            verdict: row.verdict,
            cause: row.cause,
            measuredAt: row.measuredAt,
            measured: row.measured,
            movement: row.movement,
          })
        );
      return [...(a.thisWeek ?? []).filter((row) => row.week === q.week), ...written];
    },
    async historyBefore(q) {
      return (a.history ?? []).filter((row) => row.week < q.week);
    },
    async insert(next) {
      for (const row of next) {
        inserted.push(row);
        const key = `${row.publicationId}:${row.week}`;
        // The unique key, not a guard: a second insert for a week already
        // judged is refused here exactly as the index refuses it.
        if (held.has(key)) continue;
        held.add(key);
        rows.push(row);
      }
    },
  };
  setVerdictStore(store);
  return store;
}

export function releaseStore(): void {
  setVerdictStore(null);
}

export function measure(value: number): Measured<number> {
  return measured(value, AT);
}

export function acceptance(form: Acceptance["form"]): Acceptance {
  switch (form) {
    case "top20":
      return { form: "top20", query: "best user onboarding software" };
    case "named_on":
      return { form: "named_on", question: question().text };
    case "gate_cleared":
      return { form: "gate_cleared", gate: "noindex" };
    case "issues_cleared":
      return { form: "issues_cleared", issues: ["page_titles"], pageUrl: "https://example.com/pricing" };
  }
}

export { assembleReport };
