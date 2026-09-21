// SPEC §5 (2026-09-20, #908), #923 — what the rivals panel states, decided
// without a database and without a browser.
//
// The grid is pure over a stored report, so the rules worth holding are
// held here: which columns exist, who is on a row, what a dot means, and
// REQ-004 — nothing measured is nothing drawn, never a grid of empty dots.
import { describe, expect, it } from "vitest";
import { measured, unmeasured } from "@/lib/measure/measured";
import { rivalGridOf } from "@/app/(account)/setup/_setup/panel-rivals";
import type { StoredReport } from "@/lib/scan/report";

const AT = new Date("2026-09-05T09:31:00.000Z");

function serp(rows: readonly (readonly [string, number])[]): unknown {
  return measured(
    { organic: rows.map(([domain, position]) => ({ domain, position, url: "", title: "" })), aiOverview: { present: false } },
    AT
  );
}

function question(keyword: string): unknown {
  return { id: keyword, text: `What about ${keyword}?`, phrasing: "template", search: { keyword } };
}

/** A report with just the members the grid reads. */
function report(over: Record<string, unknown> = {}): StoredReport {
  return {
    domain: "you.example",
    questions: measured([question("alpha"), question("beta")], AT),
    serps: [serp([["you.example", 4]]), serp([["rival.example", 2]])],
    presence: { rivals: [{ domain: "rival.example", top10Count: 1 }] },
    ...over,
  } as unknown as StoredReport;
}

describe("the grid's columns", () => {
  it("is one column per search whose top ten was actually read", () => {
    const grid = rivalGridOf(report());
    expect(grid?.searches).toEqual(["alpha", "beta"]);
    expect(grid?.of).toBe(2);
  });

  it("drops a search the scan could not buy — it is not a search anyone lost", () => {
    const grid = rivalGridOf(
      report({ serps: [serp([["you.example", 4]]), unmeasured("undeterminable", AT)] })
    );
    expect(grid?.searches).toEqual(["alpha"]);
    expect(grid?.of).toBe(1);
    // And the customer's count is over that one, not over the two asked for.
    expect(grid?.yours).toBe(1);
  });
});

describe("the grid's rows", () => {
  it("puts the customer first and marks them, then each rival the scan scored", () => {
    const grid = rivalGridOf(report());
    expect(grid?.rows.map((row) => row.domain)).toEqual(["you.example", "rival.example"]);
    expect(grid?.rows[0]?.you).toBe(true);
    expect(grid?.rows[1]?.you).toBe(false);
  });

  it("a dot is a first-two-pages place, and a deeper one is not", () => {
    const grid = rivalGridOf(
      report({ serps: [serp([["you.example", 20]]), serp([["you.example", 21]])] })
    );
    expect(grid?.rows[0]?.present).toEqual([true, false]);
  });

  it("matches a subdomain to its site, the way the score's own test does", () => {
    const grid = rivalGridOf(report({ serps: [serp([["www.you.example", 3]]), serp([])] }));
    expect(grid?.rows[0]?.present).toEqual([true, false]);
  });

  it("never lists the customer twice, even where the scan scored them as a rival", () => {
    const grid = rivalGridOf(
      report({ presence: { rivals: [{ domain: "you.example" }, { domain: "rival.example" }] } })
    );
    expect(grid?.rows.map((row) => row.domain)).toEqual(["you.example", "rival.example"]);
  });
});

describe("nothing measured is nothing drawn (REQ-004)", () => {
  it("no report at all", () => {
    expect(rivalGridOf(null)).toBeNull();
  });

  it("a report whose questions were never phrased", () => {
    expect(rivalGridOf(report({ questions: unmeasured("not_attempted", AT) }))).toBeNull();
  });

  it("a report none of whose top tens could be read", () => {
    expect(
      rivalGridOf(report({ serps: [unmeasured("undeterminable", AT), unmeasured("undeterminable", AT)] }))
    ).toBeNull();
  });

  it("a report written before these members existed, rather than a thrown screen", () => {
    expect(rivalGridOf({ domain: "you.example" } as unknown as StoredReport)).toBeNull();
  });
});
