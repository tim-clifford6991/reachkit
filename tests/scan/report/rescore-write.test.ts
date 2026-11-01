// The re-score's write for a stored blob older than this build's version:
// its changes were found on the upgraded copy, so it takes that copy whole.
// The payloads are kept as a golden that `rescore-schema.test.ts` feeds to the
// live `rescore_scan`, so the database suite imports none of this graph.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { REPORT_VERSION } from "../../../src/lib/scan/report";
import { rescoreRow, type Row, type StoredRead, type StoredScanRow } from "../../../src/lib/scan/rescore-run";
import { scanWriteOf } from "../../../src/lib/scan/rescore-write";
import { readsOf } from "./rescore-store";

interface StoredFixture {
  id: string;
  createdAt: string;
  status: StoredScanRow["status"];
  score: number | null;
  drivers: unknown;
  report: Record<string, unknown>;
  home: { created_at: string; payload: unknown } | null;
  rendered: readonly { created_at: string; payload: unknown }[];
}

const GUSTO = (
  JSON.parse(readFileSync(path.join(import.meta.dirname, "fixtures/rescore/gusto.com.json"), "utf8")) as { scans: StoredFixture[] }
).scans[0]!;

const READS: StoredRead[] = readsOf(GUSTO, "gusto.com");

/** gusto.com's stored report as an older build wrote it: a version-6 blob
 *  carries none of the members versions 7 to 12 added. */
function woundBack(version: 6 | 12): Record<string, unknown> {
  const report = structuredClone(GUSTO.report);
  if (version === 6) {
    for (const key of ["siteIssues", "ownRankedRows", "measuredCategory", "pageQuestions", "blockedAgents"]) delete report[key];
    delete (report.aiAnswers as Record<string, unknown>).reusedFrom;
  }
  return { ...report, version };
}

function rescored(report: unknown, score: number | null, status: StoredScanRow["status"], drivers: unknown): Row {
  const scan: StoredScanRow = { id: GUSTO.id, domain: "gusto.com", createdAt: GUSTO.createdAt, status, score, drivers, md5: "read", report, siteId: null, isCurrent: false };
  const row = rescoreRow(scan, READS);
  if (!("result" in row)) throw new Error(row.because);
  return row;
}

const json = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

describe("a re-score of an older blob writes the whole upgraded report", () => {
  const payloads: Record<string, unknown> = {};

  for (const version of [6, 12] as const) {
    it(`a version-${version} blob takes one empty path with this build's report, and a second re-score moves nothing`, () => {
      const raw = woundBack(version);
      const w = scanWriteOf(rescored(raw, GUSTO.score, GUSTO.status, GUSTO.drivers), "2026-11-01T12:00:00.000Z", "abc1234");
      expect(w.changes.map((c) => c.path)).toEqual([[]]);
      const whole = json(w.changes[0]!.value) as Record<string, unknown>;
      expect(whole.version).toBe(REPORT_VERSION);
      const again = rescored(whole, w.score, w.status, json(w.drivers));
      expect(again.result.changes).toEqual([]);
      expect(again.result.score).toBe(w.score);
      payloads[version] = json({ stored: { status: GUSTO.status, score: GUSTO.score, drivers: GUSTO.drivers, report: raw }, write: { changes: w.changes, score: w.score, status: w.status, drivers: w.drivers } });
    });
  }

  it("the payloads the live rescore_scan suite writes", async () => {
    await expect(`${JSON.stringify(payloads, null, 2)}\n`).toMatchFileSnapshot("./fixtures/rescore/old-versions.json");
  });

  it("a blob of this build's version still takes its paths", () => {
    const w = scanWriteOf(rescored(GUSTO.report, GUSTO.score, GUSTO.status, GUSTO.drivers), "2026-11-01T12:00:00.000Z", "abc1234");
    expect(w.changes.every((c) => c.path.length > 0)).toBe(true);
  });
});
