// Issue 1426 — a stored scan and a stored rival set, read again by the
// current code from what was stored, with no network: `tests/setup.ts`
// refuses every call, so a step that tried one would throw here.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { rehomeSite } from "../../../src/lib/scan/rescore";
import type { RivalConclusion } from "../../../src/lib/market/infer/types";
import { rescoreExport, scanStatement, type Row } from "../../../scripts/rescore/run";

const read = (path: string): unknown => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));

describe("streaksapp.com's rivals of 13 October (issue 1417), read again from what the pass stored", () => {
  const run = read("../../../docs/walk/panel/2026-10-13-1414.json") as {
    sites: { site: { domain: string }; market: { rivals: RivalConclusion[] } }[];
  };
  const stored = run.sites.find((s) => s.site.domain === "streaksapp.com")!.market.rivals;
  const evidence = read("../../../scripts/panel/evidence/streaksapp.com.json") as {
    source: string;
    cache_key: string;
    payload: { text: string; citedDomains?: string[] }[];
  }[];
  // The AI Mode answers the pass read, as a report keeps its buyer prompts.
  const marketPrompts = evidence
    .filter((e) => e.source === "serp/google/ai_mode")
    .map((e) => ({ prompt: e.cache_key, citedDomains: e.payload[0]?.citedDomains ?? [], namesSite: false, excerpt: e.payload[0]?.text ?? "" }));

  const moved = rehomeSite({
    id: "site",
    domain: "streaksapp.com",
    competitors: stored.map((r) => r.domain),
    rivals: stored,
    overridden: false,
    report: {
      marketPrompts,
      aiAnswers: null,
      serps: [],
      measuredCategory: null,
      market: { kind: "unmeasured", reason: "not_attempted", at: new Date() },
      ownRankedRows: [],
    },
  });

  it("moves HabitNow from Google Play's domain to the site the answers link its name to, and keeps the other four", () => {
    expect(stored.find((r) => r.name === "HabitNow")?.domain).toBe("google.com");
    expect(moved?.moved).toEqual([{ name: "HabitNow", from: "google.com", to: "habitnow.net" }]);
    expect(moved?.rivals.map((r) => r.domain)).toEqual(["jamesclear.com", "habi.app", "habitify.me", "loophabits.org", "habitnow.net"]);
    expect(moved?.competitors).toEqual(["jamesclear.com", "habi.app", "habitify.me", "loophabits.org", "habitnow.net"]);
  });

  it("leaves a founder's own rivals as they chose them", () => {
    expect(rehomeSite({ id: "site", domain: "streaksapp.com", competitors: [], rivals: stored, overridden: true, report: null })).toBeNull();
  });
});

type Export = Parameters<typeof rescoreExport>[0];
const exported = (domain: string): Export => read(`./fixtures/rescore/${domain}.json`) as Export;

/** A statement's rewrites, applied to the exported report as `jsonb_set`
 *  applies them to the stored one. */
function applied(row: Row): Export["scans"][number] {
  const report = structuredClone(row.scan.report) as Record<string, unknown>;
  for (const change of row.result.changes) {
    let at: Record<string | number, unknown> = report;
    for (const key of change.path.slice(0, -1)) at = at[key] as Record<string | number, unknown>;
    at[change.path[change.path.length - 1]!] = JSON.parse(JSON.stringify(change.value));
  }
  return { ...row.scan, report, score: row.result.score, status: row.result.status, drivers: JSON.parse(JSON.stringify(row.result.drivers)) };
}

describe("gusto.com's scan of 8 October (issue 1418): measured off Cloudflare's page, read again", () => {
  const doc = exported("gusto.com");
  const [row] = rescoreExport(doc).rows;

  it("stored a measured 0, invisible", () => {
    expect(row!.scan.score).toBe(0);
    expect(row!.result.before.verdict.scoreAndBand).toMatchObject({ kind: "measured", value: { score: 0, band: "invisible" } });
  });

  it("now shows what a new scan would: no score, the home page unread because of the protection, the scan degraded", () => {
    const after = row!.result.after;
    expect(after.verdict.scoreAndBand.kind).toBe("unmeasured");
    expect(after.verdict.factors.foundations).toMatchObject({ kind: "unmeasured", because: "bot_protection" });
    expect(after.verdict.factors.answerability).toMatchObject({ kind: "unmeasured", because: "bot_protection" });
    expect(after.onPage.kind).toBe("unmeasured");
    expect(after.complete).toBe(false);
    expect(row!.result.score).toBeNull();
    expect(row!.result.status).toBe("degraded");
  });

  it("writes it guarded by the stored report's checksum, keeping the original", () => {
    const sql = scanStatement(row!, { version: "abc1234", at: new Date("2026-10-14T12:00:00Z") })!;
    expect(sql).toContain(`md5(report::text) = '${row!.scan.md5}'`);
    expect(sql).toContain("'previous', coalesce(report->'previous', report)");
    expect(sql).toContain("score = null");
  });

  it("changes nothing the second time", () => {
    const again = rescoreExport({ ...doc, scans: [applied(row!)] }).rows[0]!;
    expect(again.result.changes).toEqual([]);
    expect(scanStatement(again, { version: "abc1234", at: new Date() })).toBeNull();
  });
});

describe("zapier.com's scan of 6 October (issue 1419): AI presence set by the one Google result read", () => {
  const doc = exported("zapier.com");
  const row = rescoreExport(doc).rows.find((r) => r.scan.score !== null)!;

  it("stored 27, hard to find", () => {
    expect(row.scan.score).toBe(27);
  });

  it("now shows what a new scan would: AI presence is no rate over one read result, so no number", () => {
    expect(row.result.after.verdict.factors.presence.kind).toBe("unmeasured");
    expect(row.result.after.verdict.scoreAndBand.kind).toBe("unmeasured");
    expect(row.result.score).toBeNull();
    expect(row.result.status).toBe("degraded");
  });
});
