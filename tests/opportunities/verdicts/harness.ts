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
import { measured, type Measured } from "../../../src/lib/measure/measured";
import type { Acceptance } from "../../../src/lib/opportunities/types";
import type {
  PublishedPage,
  StoredVerification,
  VerdictInsert,
  VerdictRecord,
  VerdictStore,
} from "../../../src/lib/opportunities/verdicts/store";
import { setVerdictStore } from "../../../src/lib/opportunities/verdicts/store";
import { AT, DOMAIN, SITE_ID, question, reportOf, serp } from "../fixtures";

export { AT, DOMAIN, SITE_ID };

export const WEEK = "2026-08-31";
export const PREVIOUS_WEEK = "2026-08-24";

export function pageOf(over: Partial<PublishedPage> = {}): PublishedPage {
  return {
    publicationId: "pub-1",
    acceptance: { form: "top20", query: "best user onboarding software" },
    publishedAt: new Date("2026-05-01T00:00:00.000Z"),
    unpublishedAt: null,
    domain: DOMAIN,
    liveUrl: "https://content.example.com/best-user-onboarding-software",
    verification: null,
    ...over,
  };
}

export function verification(
  outcome: StoredVerification["outcome"],
  failed: readonly ("reachable" | "indexable" | "sitemap" | "aiReadable")[] = []
): StoredVerification {
  if (outcome === "found") return { outcome: "found", failed, checkedAt: AT };
  if (outcome === "page_not_found") return { outcome: "page_not_found", checkedAt: AT };
  return { outcome: "could_not_confirm", checkedAt: AT };
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

/** A report whose measured SERP puts the customer at `position`, or leaves
 *  them absent from it where `position` is null. The question and the
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
      : [...rivals, { position, domain: DOMAIN, url: `https://${DOMAIN}/p`, title: "Ours" }];
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
    async weekReport() {
      const report = a.report === undefined ? reportWithOwnPlace(3) : a.report;
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
  }
}

export { assembleReport };
