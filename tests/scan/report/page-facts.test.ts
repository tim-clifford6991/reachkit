// A stored scan scored from its reads' facts comes out exactly as it did from
// their payloads: each case in `page-facts.golden.json` is a fixture scan, its
// reads as `fetches` kept them, and what the re-score made of those payloads.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pageFactsOf } from "../../../src/lib/scan/page-facts";
import { rescoreRow } from "../../../src/lib/scan/rescore-run";
import { fixture, readOf } from "./rescore-store";

type Read = { created_at: string; payload: unknown };
const GOLDEN = JSON.parse(readFileSync(new URL("./page-facts.golden.json", import.meta.url), "utf8")) as Record<
  string,
  { input: { fixture: string; tier?: string; home: Read | "stored"; rendered: Read[]; measured?: { pages: string[]; reads: [string, unknown][] } }; expected: unknown }
>;

describe("scoring from a read's facts gives what scoring from its payload gave", () => {
  it.each(Object.keys(GOLDEN))("%s", (name) => {
    const { input, expected } = GOLDEN[name]!;
    const scan = fixture(input.fixture);
    const home = input.home === "stored" ? scan.home! : input.home;
    const reads = [readOf(input.fixture, "egress.safeFetch", home), ...input.rendered.map((r) => readOf(input.fixture, "on_page/instant_pages", r))];
    const measured = input.measured && { pages: input.measured.pages, reads: new Map(input.measured.reads.map(([url, payload]) => [url, pageFactsOf(url, payload)] as const)) };
    const report = { ...structuredClone(scan.report), ...(input.tier === undefined ? {} : { tier: input.tier }) };
    const row = rescoreRow({ ...scan, domain: input.fixture, md5: "m", report, siteId: measured ? "site" : null, isCurrent: false }, reads, { siteName: null, answers: [], ...(measured ? { measured } : {}) });
    if (!("result" in row)) throw new Error(row.because);
    const { changes, score, status, drivers, kept, stale } = row.result;
    expect(JSON.parse(JSON.stringify({ changes, score, status, drivers, kept, stale }))).toEqual(expected);
  });
});
