// tests/costs/spend-log.test.ts — SPEC §6 (owner, D57, issue 1286).
//
// Test spend made from the box is one log; `npm run costs` reads it against
// D34's €2 a day. Driven on a fixture log and a scratch file: nothing is
// bought and the box's own log is not touched.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { appendSpend, readSpend, report, summarize } from "../../scripts/spend-log.mjs";

const FIXTURE = path.join(import.meta.dirname, "fixtures/spend.jsonl");
const NOW = new Date("2026-10-06T12:00:00.000Z");

afterEach(() => {
  delete process.env.RK_SPEND_LOG;
});

describe("npm run costs — the box's test spend against €2 a day", () => {
  it("prints today and the last seven days by issue, skipping lines that are not spend", () => {
    const summary = summarize(readSpend(FIXTURE), NOW);

    expect(summary.today.cents).toBeCloseTo(69.9);
    expect(summary.today.byIssue).toEqual([
      { issue: "1282", cents: 61.5 },
      { issue: "main", cents: 8.4 },
    ]);
    expect(summary.today.state).toBe("ok");
    // 30 September is the first of the seven days; 29 September is not one.
    expect(summary.week.from).toBe("2026-09-30");
    expect(summary.week.cents).toBeCloseTo(94.65);
    expect(summary.week.byIssue.map((row) => row.issue)).toEqual(["1282", "1251", "main", "1271"]);

    const text = report(summary);
    expect(text).toContain("69.90¢");
    expect(text).not.toContain("WARNING");
  });

  it("warns at €1.50 and says stop at €2", () => {
    const rows = readSpend(FIXTURE);
    const more = (cents: number) => [...rows, { at: "2026-10-06T11:30:00.000Z", issue: "1286", script: "page", source: "llm:writer", cents }];

    expect(summarize(more(81), NOW).today.state).toBe("warn");
    expect(report(summarize(more(81), NOW))).toContain("WARNING");
    expect(summarize(more(131), NOW).today.state).toBe("over");
    expect(report(summarize(more(131), NOW))).toContain("ask the owner");
  });

  it("a paid call appends one line that the report reads back; an unpaid one appends none", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "rk-spend-"));
    try {
      process.env.RK_SPEND_LOG = path.join(dir, "spend.jsonl");
      appendSpend({ script: "page", source: "llm:writer", cents: 4.2, at: NOW });
      appendSpend({ script: "page", source: "fetch:refused", cents: 0, at: NOW });

      expect(readFileSync(process.env.RK_SPEND_LOG, "utf8").trim().split("\n")).toHaveLength(1);
      const [row] = readSpend(process.env.RK_SPEND_LOG);
      expect(row).toMatchObject({ at: NOW.toISOString(), script: "page", source: "llm:writer", cents: 4.2 });
      expect(row!.issue).not.toBe("");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
