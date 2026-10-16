// tests/market/rivals/stored-markets.test.ts — issue 1465
//
// The rivals of real stored markets, both ways. `stored-rivals-1465.json`
// holds the searches of the production scans the dry re-score of
// 2026-10-16 moved (rescore_runs f7d5d3d4); `local-rivals-1449.json` holds
// the local free scans of 2026-10-15 that issue 1449 was fixed on. A
// software maker keeps the businesses it competes with, the noise that
// issue 1449's rule let in never enters, and what that rule rightly took
// out stays out.
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deriveRivals } from "../../../src/lib/market/rivals/derive.ts";
import type { MarketSerp } from "../../../src/lib/market/views.ts";

interface StoredScan {
  id: string;
  domain: string;
  local: boolean;
  serps: MarketSerp[];
}

const read = (file: string): StoredScan[] =>
  (JSON.parse(readFileSync(path.resolve(import.meta.dirname, "fixtures", file), "utf8")) as { scans: StoredScan[] }).scans;
const STORED = read("stored-rivals-1465.json");
const LOCAL = read("local-rivals-1449.json");

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

const derived = (scan: StoredScan) => deriveRivals({ serps: scan.serps, ownDomain: scan.domain, local: scan.local });
const scan = (id: string): StoredScan => {
  const found = [...STORED, ...LOCAL].find((s) => s.id === id);
  if (found === undefined) throw new Error(`no stored scan ${id}`);
  return found;
};
const rivalsOf = (id: string): string[] => derived(scan(id)).rivals.map((r) => r.domain);

describe("issue 1465 — a software maker keeps the businesses it competes with", () => {
  it.each([
    ["618524da", "mailchimp.com", ["klaviyo.com", "activecampaign.com"]],
    ["b1565f9c", "crisp.chat", ["ada.cx", "botpress.com", "forethought.ai"]],
    ["6c23826e", "buttondown.com", ["brevo.com", "mailerlite.com", "ghost.io"]],
    ["c87d682f", "deel.com", ["remote.com", "oysterhr.com"]],
    ["954bc017", "freshbooks.com", ["sage.com"]],
    ["3950e4a1", "ghost.org", ["mailerlite.com"]],
    ["9a5cd108", "zendesk.com", ["manageengine.com"]],
    ["9a566627", "helpscout.com", ["liveagent.com"]],
    ["7ae27137", "asana.com", ["atlassian.com", "microsoft.com", "monday.com"]],
    ["0fae76ad", "monday.com", ["salesforce.com", "hubspot.com"]],
    ["98430f79", "basecamp.com", ["asana.com", "atlassian.com"]],
  ])("%s %s keeps %j", (id, _domain, kept) => {
    expect(rivalsOf(id)).toEqual(expect.arrayContaining(kept));
  });

  it("a rival found once, at a lower place than five others, is outranked, not made a publisher", () => {
    expect(derived(scan("618524da")).sources).not.toContain("brevo.com");
    expect(derived(scan("f290ca40")).sources).not.toContain("forethought.ai");
    expect(derived(scan("9a5cd108")).sources).not.toContain("eesel.ai");
  });

  it("no software market is left with no rival", () => {
    for (const s of STORED.filter((x) => !/^(example|gusto)\.com$/.test(x.domain))) expect(rivalsOf(s.id), s.id).not.toEqual([]);
  });
});

describe("issue 1465 — what never enters, and what stays out", () => {
  const all = [...STORED, ...LOCAL].map((s) => ({ id: s.id, rivals: derived(s).rivals.map((r) => r.domain) }));

  it.each([
    "stackexchange.com",
    "study.com",
    "investopedia.com",
    "01net.com",
    "wizna.github.io",
    "superbestaudiofriends.org",
    "pcmag.com",
    "cnet.com",
    "imdb.com",
    "merriam-webster.com",
    "collinsdictionary.com",
    "cambridge.org",
    "indeed.com",
    "ziprecruiter.com",
    "huffpost.com",
    "mapquest.com",
  ])("%s is no stored market's rival", (domain) => {
    for (const { id, rivals } of all) expect(rivals, id).not.toContain(domain);
  });

  it("no university, and no Amazon listing or search page, is a rival", () => {
    for (const { id, rivals } of all) expect(rivals.filter((r) => /\.edu$|\.ac\.[a-z]{2}$/.test(r)), id).toEqual([]);
    expect(rivalsOf("46d4aa13")).not.toContain("amazon.com");
    expect(rivalsOf("0fae76ad")).not.toContain("amazon.com");
    expect(rivalsOf("ee251330")).toEqual([]);
    expect(rivalsOf("cb5fd746")).toEqual([]);
  });

  it("a review site's roundup stays a source; a software maker's own blog roundup does not", () => {
    const beehiiv = derived(scan("98d44b30"));
    expect(beehiiv.sources).toEqual(expect.arrayContaining(["emailvendorselection.com", "ghost.io"]));
    expect(rivalsOf("9a566627")).not.toContain("thecxlead.com");
    expect(derived(scan("618524da")).sources).toEqual(expect.arrayContaining(["emailvendorselection.com"]));
  });
});

describe("issue 1465 — the local gains of issue 1449 hold", () => {
  it("the local scans name the businesses on their map", () => {
    expect(rivalsOf("2026-10-15 (#1449 live) peanutplumbingtx.com")).toEqual(["austinplumbery.com", "plumbersthatcare.com", "weplumbatx.com"]);
    expect(rivalsOf("2026-10-15 (#1449 live) laynescafe.co.uk")).toEqual(["holdingpatternslds.co.uk", "bruncho.co.uk", "rawcoffeeroasters.co.uk"]);
    expect(rivalsOf("2026-10-15 (#1449 live) ifleeds.com")).toEqual(["bruncho.co.uk", "farmhouse.biz", "moosecoffee.co"]);
    expect(rivalsOf("2026-10-15 (#1449 live) zunicafe.com")).toEqual(["garydanko.com", "sonsanddaughterssf.com", "sprucesf.com", "chezmamanrestos.com", "lardoisesf.com"]);
  });

  it("a local business's report stored before D67 is read as local by its map: no 'aaa' plumbers, recipe sites or marketplaces", () => {
    for (const s of LOCAL) {
      const rivals = derived(s).rivals.map((r) => r.domain);
      expect(rivals.filter((r) => /^aaa/.test(r)), s.id).toEqual([]);
      expect(rivals.filter((r) => /recipe|freshfarm|seasonalfoodguide|amazon\./.test(r)), s.id).toEqual([]);
    }
    expect(rivalsOf("2026-10-15 (#1438) peanutplumbingtx.com")).toEqual([]);
    expect(rivalsOf("2026-10-15 (#1438) zunicafe.com")).toEqual([]);
  });
});
