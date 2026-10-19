// Issue 1551 (owner, 2026-10-19): the score's AI presence reads the page
// questions' AI Overviews beside the twelve's, and a stored scan is scored
// again from them at 0¢.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { aiPresenceOf } from "../../../src/lib/measure/drivers";
import { measured } from "../../../src/lib/measure/measured";
import { rescoreRow, type StoredScanRow } from "../../../src/lib/scan/rescore-run";

const AT = new Date("2026-10-19T06:00:00.000Z");

const serp = (referenceDomains: readonly string[]) =>
  measured({ organic: [], aiOverview: { present: true, referenceDomains } }, AT);

describe("AI presence over the twelve and the page questions", () => {
  it("a page cited on its own question counts beside the twelve", () => {
    const twelve = [serp(["example.com"]), serp(["example.org"])];
    const without = aiPresenceOf({ serps: twelve, ownDomain: "acme.test", at: AT });
    const withPage = aiPresenceOf({
      serps: twelve,
      pageCells: [{ kind: "answered", namesCustomer: true, ownUrls: ["https://content.acme.test/how-to"] }, { kind: "no_answer" }, { kind: "unmeasured" }],
      ownDomain: "acme.test",
      at: AT,
    });
    expect(without).toMatchObject({ kind: "zero", value: 1 });
    // One citation over the three AI answers shown: 0.6 × 1/3 × 100.
    expect(withPage.kind).toBe("measured");
    expect(withPage.kind !== "unmeasured" && withPage.value).toBeCloseTo(20, 10);
  });

  it("a page question named but not linked is a mention", () => {
    const m = aiPresenceOf({ serps: [], pageCells: [{ kind: "answered", namesCustomer: false, named: true }], ownDomain: "acme.test", at: AT });
    expect(m.kind !== "unmeasured" && m.value).toBeCloseTo(40, 10);
  });
});

describe("a stored scan is scored again with its page questions, at 0¢", () => {
  const scan = (JSON.parse(readFileSync(new URL("./fixtures/rescore/zapier.com.json", import.meta.url), "utf8")) as {
    scans: { id: string; createdAt: string; status: StoredScanRow["status"]; score: number | null; drivers: unknown; report: Record<string, unknown> }[];
  }).scans[0]!;
  const rowOf = (report: Record<string, unknown>): StoredScanRow => ({
    ...scan,
    report,
    domain: "zapier.com",
    md5: createHash("md5").update(JSON.stringify(report)).digest("hex"),
    siteId: null,
    isCurrent: false,
  });
  const pageQuestions = {
    measuredAt: AT.toISOString(),
    ownDomain: "zapier.com",
    tracked: 5,
    cap: 24,
    retired: [],
    rows: [
      {
        publicationId: "p1",
        liveUrl: "https://zapier.com/blog/how-to-automate",
        question: { n: 5, wording: { kind: "generated", text: "How do I automate it?" }, search: "how to automate" },
        cell: { kind: "answered", citedDomains: ["zapier.com"], namesCustomer: true },
        engines: [],
      },
    ],
  };

  it("moves AI presence and the score from the stored cell, and names nothing as bought", () => {
    const before = rescoreRow(rowOf(structuredClone(scan.report)), []);
    const after = rescoreRow(rowOf({ ...structuredClone(scan.report), pageQuestions }), []);
    if (!("result" in before) || !("result" in after)) throw new Error("not readable");
    expect(before.result.drivers.aiPresence).toMatchObject({ kind: "zero", value: 1 });
    // The twelve's one AI answer names somebody else; the page question's
    // cites the site: one citation over two answers.
    expect(after.result.drivers.aiPresence.kind !== "unmeasured" && after.result.drivers.aiPresence.value).toBeCloseTo(30, 10);
    expect(after.result.score).toBeGreaterThan(before.result.score ?? 0);
    expect(after.result.changes.some((change) => change.path[0] === "verdict")).toBe(true);
  });
});
