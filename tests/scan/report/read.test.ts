// tests/scan/report/read.test.ts — issue #25.
//
// One indexed read off the partial unique index, a `null` that means "this
// domain has no report", and a version guard that fails loudly rather than
// handing back a blob this build cannot read.
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../run/harness";

interface Recorded {
  table: string;
  columns: string;
  filters: [string, unknown][];
  limit: number | null;
}

const recorded: Recorded[] = [];
let answer: { data: unknown[] | null; error: { message: string } | null } = { data: [], error: null };

function builder(table: string) {
  const row: Recorded = { table, columns: "", filters: [], limit: null };
  recorded.push(row);
  const self = {
    select(columns: string) {
      row.columns = columns;
      return self;
    },
    eq(column: string, value: unknown) {
      row.filters.push([column, value]);
      return self;
    },
    is(column: string, value: unknown) {
      row.filters.push([column, value]);
      return self;
    },
    limit(n: number) {
      row.limit = n;
      return self;
    },
    then(resolve: (v: typeof answer) => unknown) {
      return Promise.resolve(answer).then(resolve);
    },
  };
  return self;
}

vi.mock("@/lib/db", () => ({
  dbAdmin: () => ({ from: builder }),
  db: () => ({ from: builder }),
}));

const { readCurrentReport, readStoredReport, REPORT_VERSION } = await import("../../../src/lib/scan/report");
const { assembleReport } = await import("../../../src/lib/scan/store");
const { fullSections, AT } = await import("./fixtures");

/** What the row actually holds: the blob after a round trip through
 *  `jsonb`, where every `Date` is an ISO string. */
function asStoredJson(): unknown {
  return JSON.parse(JSON.stringify(assembleReport(fullSections())));
}

beforeEach(() => {
  recorded.length = 0;
  answer = { data: [], error: null };
});

describe("the read", () => {
  it("is one indexed read of the domain's current row, and asks for the blob alone", async () => {
    answer = { data: [{ report: asStoredJson() }], error: null };
    await readCurrentReport("example.com");
    expect(recorded).toHaveLength(1);
    const [read] = recorded;
    expect(read?.table).toBe("scans");
    expect(read?.columns).toBe("report");
    expect(read?.filters).toEqual([
      ["domain", "example.com"],
      ["is_current", true],
    ]);
    expect(read?.limit).toBe(1);
  });

  it("never falls back to a latest-scan query — a failed re-scan is not the report", async () => {
    answer = { data: [], error: null };
    expect(await readCurrentReport("example.com")).toBeNull();
    expect(recorded).toHaveLength(1);
    expect(recorded[0]?.filters.map(([column]) => column)).toContain("is_current");
    expect(JSON.stringify(recorded)).not.toMatch(/created_at|order/);
  });

  it("returns null for a domain with no current row, and for a row whose blob is null", async () => {
    expect(await readCurrentReport("example.com")).toBeNull();
    answer = { data: [{ report: null }], error: null };
    expect(await readCurrentReport("example.com")).toBeNull();
  });

  it("raises when the read itself failed — never null, which reads as 'no report'", async () => {
    answer = { data: null, error: { message: "connection reset" } };
    await expect(readCurrentReport("example.com")).rejects.toThrow(/connection reset/);
  });
});

describe("dates survive the round trip through jsonb", () => {
  it("revives every instant the blob carries", async () => {
    answer = { data: [{ report: asStoredJson() }], error: null };
    const report = await readCurrentReport("example.com");
    expect(report?.verdict.measuredAt).toBeInstanceOf(Date);
    expect(report?.verdict.measuredAt.getTime()).toBe(AT.getTime());
    expect(report?.aiAnswers?.measuredAt).toBeInstanceOf(Date);
    expect(report?.market.at).toBeInstanceOf(Date);
    expect(report?.serps[0]?.at).toBeInstanceOf(Date);
    expect(report !== null && report.robots.kind !== "unmeasured" && report.robots.value.readAt).toBeInstanceOf(Date);
  });

  it("leaves a string that is not an instant exactly as written", async () => {
    answer = { data: [{ report: asStoredJson() }], error: null };
    const report = await readCurrentReport("example.com");
    expect(report?.domain).toBe("example.com");
    expect(report !== null && report.questions.kind !== "unmeasured" && report.questions.value[0]?.text).toBe(
      "What's the best user onboarding software?"
    );
  });
});

// ── The one upgrade beside the guard (issue #128) ────────────────────────
//
// `REPORT_VERSION` went 3 → 4 when every AI-answers row gained §6.2's
// three engine columns. A bare bump would have made every report already
// on disk unreadable — and `readStoredReport` throws rather than returning
// `null`, so that is a customer's report off its own address at deploy.
// The upgrade is the migration path the issue asks to be stated, and it is
// stated here, in the reader, because a stored blob has exactly one reader.

/** The same blob as `asStoredJson`, wound back to what version 3 wrote:
 *  no `engines` on any row. */
function asVersion3Json(): Record<string, unknown> {
  const blob = asStoredJson() as Record<string, unknown>;
  const answers = blob.aiAnswers as { rows: Record<string, unknown>[] };
  return {
    ...blob,
    version: 3,
    aiAnswers: {
      ...answers,
      rows: answers.rows.map((row) => {
        const { engines, ...rest } = row;
        void engines;
        return rest;
      }),
    },
  };
}

describe("a report written at version 3 is lifted, not refused", () => {
  it("gains the three engine columns, with the two nobody asked saying so", () => {
    const before = asVersion3Json();
    expect(JSON.stringify(before)).not.toContain("engines");

    const report = readStoredReport(before);
    expect(report.version).toBe(REPORT_VERSION);
    const rows = report.aiAnswers?.rows ?? [];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.engines.map((engine) => engine.engine)).toEqual(["ai_overview", "ai_mode", "chatgpt"]);
      // The AI-Overview column is the row's own measurement, carried
      // forward; the battery columns say nobody asked, which is exactly
      // true of a report written before anything did.
      expect(row.engines[0]?.cell).toEqual(row.cell);
      expect(row.engines[1]?.cell).toEqual({ kind: "unmeasured", reason: "not_attempted" });
      expect(row.engines[2]?.cell).toEqual({ kind: "unmeasured", reason: "not_attempted" });
    }
  });

  it("changes nothing else about the blob", () => {
    const before = asVersion3Json();
    const lifted = readStoredReport(before) as unknown as Record<string, unknown>;
    for (const key of Object.keys(before)) {
      if (key === "version" || key === "aiAnswers") continue;
      expect(JSON.stringify(lifted[key])).toBe(JSON.stringify(before[key]));
    }
    const answersBefore = before.aiAnswers as Record<string, unknown>;
    const answersAfter = lifted.aiAnswers as Record<string, unknown>;
    for (const key of Object.keys(answersBefore)) {
      if (key === "rows") continue;
      expect(JSON.stringify(answersAfter[key])).toBe(JSON.stringify(answersBefore[key]));
    }
  });

  it("lifts a version-3 report whose AI-answers section is absent", () => {
    const before = { ...asVersion3Json(), aiAnswers: null };
    const report = readStoredReport(before);
    expect(report.version).toBe(REPORT_VERSION);
    expect(report.aiAnswers).toBeNull();
  });

  it("still revives dates after the lift", () => {
    const report = readStoredReport(asVersion3Json());
    expect(report.verdict.measuredAt).toBeInstanceOf(Date);
    expect(report.aiAnswers?.measuredAt).toBeInstanceOf(Date);
  });

  it("lifts version 3 and no other — version 2 is still refused", () => {
    const blob = { ...asVersion3Json(), version: 2 };
    expect(() => readStoredReport(blob)).toThrow(/version 2 is not readable by this build/);
  });
});

describe("the version guard", () => {
  it("throws on a blob this build does not know how to read", () => {
    const blob = { ...(asStoredJson() as Record<string, unknown>), version: REPORT_VERSION + 1 };
    expect(() => readStoredReport(blob)).toThrow(/not readable by this build/);
  });

  it("throws rather than returning null — null is indistinguishable from 'no report'", async () => {
    answer = { data: [{ report: { version: 99 } }], error: null };
    await expect(readCurrentReport("example.com")).rejects.toThrow(/not readable/);
  });

  it("throws on a blob that is not an object at all", () => {
    expect(() => readStoredReport("not a report")).toThrow(/not an object/);
  });
});
