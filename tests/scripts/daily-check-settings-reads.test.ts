// The daily check's Settings section: counts per read, red at the threshold, and "not measured" where the source gave nothing.
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { parseRows, settingsReadsSection } from "../../scripts/daily-check/settings-reads.mjs";

const SCRIPT = path.resolve(import.meta.dirname, "../../scripts/daily-check/settings-reads.mjs");

/** What `execute_sql` answers for two reads: one past the threshold, one under it. Counts arrive as text from Postgres. */
const TWO_READS = [
  { read: "pages", last_24h: "3", last_7d: "5" },
  { read: "billing", last_24h: "2", last_7d: "9" },
];

describe("settingsReadsSection", () => {
  it("states each read's 24 h and 7 d counts, and marks red only the read at three in 24 h", () => {
    const rows = settingsReadsSection(TWO_READS).split("\n").filter((line) => line.startsWith("| pages") || line.startsWith("| billing"));
    expect(rows).toEqual(["| pages | 3 | 5 | **RED** (≥ 3 in 24 h) |", "| billing | 2 | 9 | ok |"]);
  });

  it("says none when the query answered with no rows", () => {
    const section = settingsReadsSection([]);
    expect(section).toMatch(/none in the last 7 d/);
    expect(section).not.toMatch(/\| 0 \|/);
  });

  it("says not measured, never 0, when the source could not be read", () => {
    for (const unread of ["", "relation \"ops_events\" does not exist", "{}"]) {
      const section = settingsReadsSection(parseRows(unread));
      expect(section).toMatch(/not measured/);
      expect(section).not.toMatch(/\b0\b|none/);
    }
  });

  it("runs as the daily check calls it: rows on stdin, the section on stdout", async () => {
    const child = promisify(execFile)(process.execPath, [SCRIPT]);
    child.child.stdin?.end(JSON.stringify(TWO_READS));
    const { stdout } = await child;
    expect(stdout).toContain("| pages | 3 | 5 | **RED**");
  });
});
