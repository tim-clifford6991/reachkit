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
