// A career guide a scan stored as a rival is read again at 0¢ as the
// publisher it is, so its row no longer holds the free report's page.
import "../../opportunities/env";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { rescoreRow, type StoredScanRow } from "../../../src/lib/scan/rescore-run";
import { readStoredReport } from "../../../src/lib/scan/report";
import { writeCandidates } from "../../../src/lib/opportunities/derive/write";

const read = (path: string): unknown => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
type Dated = { at: string };
type Fixture = Omit<StoredScanRow, "domain" | "md5" | "siteId" | "isCurrent"> & { report: { market: object; questions: Dated; rivals: Dated; serps: Dated[]; aiAnswers: object } };

describe("d149c119 (bakersdelight.com.au) stored bakingcareer.com.au as a rival; read again, it is none", () => {
  // The rows of the stored "baker" top ten that resolve, read for the Adelaide market on both of its searches; the overview cites the guide, as the live answers did.
  const stored = read("../../market/rivals/fixtures/au-baker-d149c119.json") as { organic: { domain: string; url: string }[] };
  const organic = stored.organic.filter((row) => row.domain !== "google.com");
  const guide = "https://bakingcareer.com.au/what-does-a-baker-do/";
  const scan = (read("./fixtures/rescore/gusto.com.json") as { scans: Fixture[] }).scans[0]!;
  const at = scan.report.serps[0]!.at;
  const cited = { kind: "answered", citedDomains: ["bakingcareer.com.au"], namesCustomer: false };
  const report = {
    ...structuredClone(scan.report),
    domain: "bakersdelight.com.au",
    market: { ...scan.report.market, value: { profile: { category: "bread and bakery", town: "Adelaide" } } },
    questions: {
      kind: "measured",
      at: scan.report.questions.at,
      value: [
        { id: "q1", text: "Who is a baker near me?", search: { keyword: "baker near me", volume: 40 }, phrasing: "model" },
        { id: "q2", text: "Which baker should I choose?", search: { keyword: "baker", volume: 40 }, phrasing: "model" },
      ],
    },
    serps: [0, 1].map(() => ({ kind: "measured", at, value: { organic, aiOverview: { present: true, referenceDomains: ["bakingcareer.com.au"], referenceUrls: [guide] } } })),
    rivals: { kind: "measured", at: scan.report.rivals.at, value: [{ domain: "bakingcareer.com.au", top10Appearances: 2, aiCitations: 2, score: 6 }] },
    sources: [],
    aiAnswers: {
      ...scan.report.aiAnswers,
      rows: ["baker near me", "baker"].map((search) => ({ cell: cited, engines: [{ cell: cited, engine: "ai_overview" }], question: { search } })),
      rivals: [{ cells: [cited, cited], domain: "bakingcareer.com.au" }],
      answeredSearches: 2,
      measuredSearches: 2,
    },
  };
  const row = { ...scan, report, domain: "bakersdelight.com.au", md5: createHash("md5").update(JSON.stringify(report)).digest("hex"), siteId: null, isCurrent: false };
  const pagesOf = (blob: unknown) =>
    writeCandidates({ siteId: "site", scanId: scan.id, report: readStoredReport(blob), ownRanked: 0, rankedCounts: new Map() }).candidates.map((candidate) => candidate.targetQuery);

  it("as stored, the guide holds page 'Who is a baker near me?'", () => {
    expect(pagesOf(report)).toContain("baker near me");
  });

  it("after the re-score it is not among the rivals, and the page is not proposed", () => {
    const rescored = rescoreRow(row, []);
    if (!("result" in rescored)) throw new Error(rescored.because);
    const rivals = rescored.result.after.rivals;
    expect(rivals.kind === "unmeasured" ? null : rivals.value.map((rival) => rival.domain)).toEqual([]);
    type Node = Record<string | number, unknown>;
    const next = structuredClone(report) as Node;
    for (const change of rescored.result.changes) {
      let at = next;
      for (const key of change.path.slice(0, -1)) at = at[key] as Node;
      at[change.path.at(-1)!] = structuredClone(change.value);
    }
    expect(pagesOf(next)).toEqual([]);
  });
});
