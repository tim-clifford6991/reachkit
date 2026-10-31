// A re-scored report whose score moved because the Google half moved says so
// beside its range, and nowhere else. The blob is the customer panel's stored
// report, rewritten as `rescore_scan` writes it and read as the screen reads it.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readStoredReport } from "@/lib/scan/report";
import { PANEL, renderReport } from "./panel-report";

type Blob = Record<string, unknown> & { verdict: Record<string, unknown> };

function storedBlob(which: keyof typeof PANEL): Blob {
  const { walk, domain } = PANEL[which];
  const file = path.resolve(import.meta.dirname, `../../../docs/walk/free/${walk}.json`);
  const sites = (JSON.parse(readFileSync(file, "utf8")) as { sites: { domain: string; stored: { scan: { report: Blob } } | null }[] }).sites;
  return structuredClone(sites.find((s) => s.domain === domain && s.stored !== null)!.stored!.scan.report);
}

const AT = "2026-10-15T12:00:00.000Z";
const half = (value: number) => ({ kind: "measured", value, at: AT });

function withScore(blob: Blob, score: number, google: number): Blob {
  return {
    ...blob,
    verdict: {
      ...blob.verdict,
      scoreAndBand: { kind: "measured", value: { score, band: score < 30 ? "invisible" : "hard-to-find" }, at: AT },
      halves: { google: half(google), ai: half(10) },
    },
  };
}

/** `rescore_scan`'s write: the first original kept under `previous` and its columns under `previousColumns`. */
function rescored(
  which: keyof typeof PANEL,
  o: { before: number; after: number; googleBefore: number; googleAfter: number; rescoredAt?: string | null; previous?: unknown; columnsScore?: number | null }
) {
  const original = withScore(storedBlob(which), o.before, o.googleBefore);
  const blob: Blob = {
    ...withScore(storedBlob(which), o.after, o.googleAfter),
    previous: o.previous === undefined ? original : o.previous,
    previousColumns: {
      score: o.columnsScore === undefined ? o.before : o.columnsScore,
      status: "done",
      drivers: { searchPresence: half(o.googleBefore) },
    },
  };
  if (o.rescoredAt !== null) blob.rescoredAt = o.rescoredAt ?? "2026-10-24T09:00:00.000Z";
  return readStoredReport(blob);
}

const LINE = 'data-testid="verdict-rescored"';

describe.each(["saas", "local"] as const)("the re-scored line on the %s panel report", (which) => {
  it("names the date and the score it read before, beside the score", () => {
    const html = renderReport(rescored(which, { before: 53, after: 14, googleBefore: 100, googleAfter: 20 }));
    const line = html.slice(html.indexOf(LINE));
    expect(line).toContain("Oct 24, 2026");
    expect(line).toMatch(/It was 53\./);
    expect(html.indexOf('data-testid="report-score"')).toBeLessThan(html.indexOf(LINE));
  });

  it("reads the kept score column where the kept report cannot be read", () => {
    const html = renderReport(rescored(which, { before: 53, after: 14, googleBefore: 100, googleAfter: 20, previous: { version: 999 } }));
    expect(html).toContain(LINE);
    expect(html.slice(html.indexOf(LINE))).toMatch(/It was 53\./);
  });

  it.each([
    ["a report never re-scored", { before: 53, after: 14, googleBefore: 100, googleAfter: 20, rescoredAt: null }],
    ["a re-score that left the score where it was", { before: 14, after: 14, googleBefore: 100, googleAfter: 20 }],
    ["a move whose Google half did not change", { before: 53, after: 14, googleBefore: 20, googleAfter: 20 }],
    ["a kept report that cannot be read, with no kept score", { before: 53, after: 14, googleBefore: 100, googleAfter: 20, previous: "unreadable", columnsScore: null }],
  ])("is not said on %s", (_, o) => {
    expect(renderReport(rescored(which, o))).not.toContain(LINE);
  });
});
