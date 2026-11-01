// The Rivals tab's readings of a stored top ten: a row Google hides behind
// its redirect is its own site or nobody's, never google.com or a blank name.
import "../../opportunities/env";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { SerpResult } from "@/lib/vendors/dataforseo/types";
import { measured } from "@/lib/measure/measured";
import { firstPlacesOf, holdersOf, onFirstPage, positionsOf } from "@/app/(account)/app/_overview/rivals-store";
import { AT, question, reportOf, search, serp } from "../../opportunities/fixtures";

const stored = JSON.parse(readFileSync(path.resolve(import.meta.dirname, "../../market/rivals/fixtures/au-baker-d149c119.json"), "utf8")) as { organic: SerpResult["organic"] };
const OWN = "bakersdelight.com.au";
const plain = [{ position: 1, domain: "www.brumbys.com.au", url: "https://www.brumbys.com.au/", title: "Brumby's Bakeries" }, stored.organic[3]!];
// The stored shape of a redirect that does carry its site's own address.
const behindGoogle = { position: 1, domain: "google.com", url: "https://google.com/goto?url=https://www.brumbys.com.au/", title: "Brumby's Bakeries" };
const reportOn = (...tops: SerpResult["organic"][]) =>
  reportOf({
    questions: tops.map((_, i) => question({ id: `q${i}`, search: search({ keyword: i === 0 ? "baker" : `bread ${i}` }) })),
    serps: tops.map((organic) => serp({ organic })),
  });

describe("the first-place holder is never google.com or a blank name", () => {
  it("stored AU baker top ten (d149c119): the search has no holder and leaves the count, a plain one keeps its holder", () => {
    const { holders, searches } = firstPlacesOf(reportOn(stored.organic, plain), [OWN]);
    expect([...holders]).toEqual([["brumbys.com.au", 1]]);
    expect(searches).toEqual(["bread 1"]);
  });

  it("a redirect that carries its site's address is held by that site", () => {
    expect([...firstPlacesOf(reportOn([behindGoogle, ...plain.slice(1)]), [OWN]).holders]).toEqual([["brumbys.com.au", 1]]);
  });
});

describe("rival rows and counts read the resolved site", () => {
  const tracked = ["brumbys.com.au"];
  const unresolved = stored.organic.filter((row) => row.domain === "google.com");

  it("a redirect resolving to a tracked rival counts for it, on the first page and in its place", () => {
    const report = reportOn([behindGoogle, ...plain.slice(1)]);
    expect(onFirstPage({ organic: [behindGoogle], aiOverview: serp().aiOverview }, "brumbys.com.au")).toBe(true);
    expect(positionsOf(report, tracked).get("brumbys.com.au\u0000baker")).toEqual(measured(1, AT));
  });

  it("stored AU baker top ten (d149c119): an unresolved row counts for nobody and names no first-page holder", () => {
    const top = { ...serp(), organic: stored.organic };
    expect([onFirstPage(top, "google.com"), onFirstPage({ ...serp(), organic: unresolved }, OWN)]).toEqual([false, false]);
    expect(holdersOf([measured(top, AT)], [])).toEqual([]);
    expect(positionsOf(reportOn(stored.organic), ["google.com"]).size).toBe(0);
  });
});
