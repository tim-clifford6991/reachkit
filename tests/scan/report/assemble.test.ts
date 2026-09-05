// tests/scan/report/assemble.test.ts — issue #25.
//
// `assembleReport` composes and derives two fields; everything else it is
// handed it passes through untouched. The three promises under test:
//   1. a section is never omitted — not even when nothing was measured;
//   2. the composition computes nothing and re-derives no figure;
//   3. the report carries exactly one date, and it is the caller's.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import "../run/harness";
import { assembleReport, statusOf, type ReportSections } from "../../../src/lib/scan/store";
import { REPORT_VERSION } from "../../../src/lib/scan/report";
import { AT, fullSections, unreachedSections } from "./fixtures";

const STORE_SOURCE = readFileSync(
  path.resolve(import.meta.dirname, "../../../src/lib/scan/store.ts"),
  "utf8"
);

/** Every key `StoredReport` declares. A blob that carries fewer has
 *  omitted a section; one that carries more has invented one. */
const REPORT_KEYS = [
  "version",
  "scanId",
  "domain",
  "measuredAt",
  "tier",
  "complete",
  "stoppedReason",
  "fromIncompleteRescan",
  "verdict",
  "market",
  "questions",
  "answers",
  "presence",
  "serps",
  "rivals",
  "sources",
  "onPage",
  "robots",
  "coherence",
  "correctionState",
] as const;

describe("a section is never omitted", () => {
  it("carries every key when every section was measured", () => {
    expect(Object.keys(assembleReport(fullSections())).sort()).toEqual([...REPORT_KEYS].sort());
  });

  it("carries every key when the pass reached nothing — the arms say why, the keys are all there", () => {
    const report = assembleReport(unreachedSections());
    expect(Object.keys(report).sort()).toEqual([...REPORT_KEYS].sort());
    // The distinction the promise rests on: an absent key and a
    // `not_attempted` value must not read the same, so the value is there.
    expect(report.market).toEqual({ kind: "unmeasured", reason: "not_attempted", at: AT });
    expect(report.questions.kind).toBe("unmeasured");
    expect(report.onPage.kind).toBe("unmeasured");
  });

  it("never writes a 0 for a section that was not reached", () => {
    const report = assembleReport(unreachedSections());
    expect(report.serps).toEqual([]);
    expect(report.verdict.scoreAndBand.kind).toBe("unmeasured");
    // A score of 0 would be a measurement about the customer's site.
    expect(JSON.stringify(report.verdict.scoreAndBand)).not.toMatch(/"score":\s*0/);
  });

  it("every member of ReportSections is required — the compile-time half", () => {
    // `Required<ReportSections>` is assignable back to `ReportSections`
    // only when no member is optional; if one were made optional this
    // line would still compile, so the check is the other direction: an
    // object literal missing a member is rejected. Expressed as a type
    // predicate the compiler evaluates, kept here beside the behavioural
    // rows it protects.
    type NoOptionalMembers = ReportSections extends Required<ReportSections> ? true : false;
    const totality: NoOptionalMembers = true;
    expect(totality).toBe(true);
  });
});

describe("the composition computes nothing", () => {
  it("hands back the very values it was given", () => {
    const sections = fullSections();
    const report = assembleReport(sections);
    expect(report.verdict).toBe(sections.verdict);
    expect(report.market).toBe(sections.market);
    expect(report.questions).toBe(sections.questions);
    expect(report.answers).toBe(sections.answers);
    expect(report.presence).toBe(sections.presence);
    expect(report.serps).toBe(sections.serps);
    expect(report.rivals).toBe(sections.rivals);
    expect(report.onPage).toBe(sections.onPage);
    expect(report.robots).toBe(sections.robots);
    expect(report.coherence).toBe(sections.coherence);
  });

  it("imports no scoring module and applies no arithmetic to a section", () => {
    // A type-only import carries no code and cannot compute; a value
    // import from either module could.
    expect(STORE_SOURCE).not.toMatch(/import \{[^}]*\} from "@\/lib\/measure\/(score|drivers)"/);
    expect(STORE_SOURCE).not.toMatch(/\bMath\.(?!ceil\b)/);
    expect(STORE_SOURCE).not.toMatch(/\breduce\(/);
  });

  it("derives `complete` from the stop reason, not from the verdict", () => {
    expect(assembleReport(fullSections({ stoppedReason: "complete" })).complete).toBe(true);
    for (const stoppedReason of ["time_ceiling", "spend_ceiling", "failed"] as const) {
      expect(assembleReport(fullSections({ stoppedReason })).complete).toBe(false);
    }
    // A report that measured everything but was stopped is still
    // incomplete; a report whose score is `unmeasured` but that ran to the
    // end is still complete.
    expect(assembleReport(unreachedSections({ stoppedReason: "complete" })).complete).toBe(true);
  });

  it("writes the one blob version this build reads", () => {
    expect(assembleReport(fullSections()).version).toBe(REPORT_VERSION);
  });
});

describe("the report carries exactly one date and it is the caller's", () => {
  it("takes `measuredAt` from the sections, never from a clock", () => {
    const measuredAt = new Date("2020-01-02T03:04:05.000Z");
    expect(assembleReport(fullSections({ measuredAt })).measuredAt).toBe(measuredAt);
  });

  it("reads no clock at assembly", () => {
    // `storeCurrentReport` stamps nothing either; the row's `finished_at`
    // is the database's `now()`, inside the one transaction.
    expect(STORE_SOURCE).not.toMatch(/Date\.now\(\)/);
    expect(STORE_SOURCE).not.toMatch(/new Date\(\)/);
  });
});

describe("the three statuses are total and exclusive", () => {
  const table: { stoppedReason: ReportSections["stoppedReason"]; degraded: boolean; status: string }[] = [
    { stoppedReason: "complete", degraded: false, status: "done" },
    { stoppedReason: "complete", degraded: true, status: "degraded" },
    { stoppedReason: "time_ceiling", degraded: false, status: "degraded" },
    { stoppedReason: "time_ceiling", degraded: true, status: "degraded" },
    { stoppedReason: "spend_ceiling", degraded: false, status: "degraded" },
    { stoppedReason: "spend_ceiling", degraded: true, status: "degraded" },
    { stoppedReason: "failed", degraded: false, status: "failed" },
    { stoppedReason: "failed", degraded: true, status: "failed" },
  ];

  it.each(table)("$stoppedReason · degraded=$degraded → $status", ({ stoppedReason, degraded, status }) => {
    expect(statusOf({ stoppedReason, degraded })).toBe(status);
  });

  it("covers every combination of the four reasons and the two flags", () => {
    expect(table).toHaveLength(8);
    expect(new Set(table.map((row) => row.status))).toEqual(new Set(["done", "degraded", "failed"]));
  });
});
