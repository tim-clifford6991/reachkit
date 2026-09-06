// tests/publish/verify/site.test.ts — a condition of the site, recorded
// only from an answer that site gave.
//
// The discriminating rows are the six non-answers. An implementation keyed
// on "could not be reached" passes every happy-path row above them and
// fails only these — and its failure mode is silent and durable: it tells
// the customer something about their site ReachKit never observed, and,
// because the condition is read back for every later page on that
// destination, the check quietly stops being reported for that site while
// every screen stays correct.
//
// The archived plan is WO-262.
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type Row } from "../harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const { conditionFrom, siteConditionFor } = await import("@/lib/publish/verify/site");

const AT = new Date(Date.UTC(2026, 8, 2, 10, 0, 0));
const EARLIER = new Date(Date.UTC(2026, 7, 20, 10, 0, 0));

const PERMITS = { kind: "permits" } as const;
const BLOCKS = { kind: "blocks" } as const;
const ROBOTS_SILENT = { kind: "no_answer" } as const;
const LISTED = { kind: "listed", urls: ["https://example.com/roof"] } as const;
const NO_SITEMAP = { kind: "none" } as const;
const SITEMAP_SILENT = { kind: "no_answer" } as const;

describe("conditionFrom — recorded only from an answer the site gave", () => {
  it("a site that answered that it publishes no sitemap is a condition of that site, named and dated", () => {
    expect(conditionFrom({ sitemap: NO_SITEMAP, robots: PERMITS, at: AT })).toEqual({
      kind: "publishes_no_sitemap",
      foundAt: AT,
    });
  });

  it("a site whose own robots document blocks the permitted readers across the whole site is a condition of that site", () => {
    expect(conditionFrom({ sitemap: LISTED, robots: BLOCKS, at: AT })).toEqual({
      kind: "robots_blocks_site",
      foundAt: AT,
    });
  });

  it("a site that answered and is in neither condition records nothing", () => {
    expect(conditionFrom({ sitemap: LISTED, robots: PERMITS, at: AT })).toBeNull();
  });

  it("where ReachKit could not reach what it went to read, or could not read what came back, no condition is recorded", () => {
    // The six non-answers, as the two readings that carry them: a sitemap
    // that timed out, returned a 5xx or came back unparseable, and the
    // same three for the robots document. Every one of them is
    // `no_answer`, and criterion 6 may not fire on a non-answer at all.
    expect(conditionFrom({ sitemap: SITEMAP_SILENT, robots: PERMITS, at: AT })).toBeNull();
    expect(conditionFrom({ sitemap: LISTED, robots: ROBOTS_SILENT, at: AT })).toBeNull();
    expect(conditionFrom({ sitemap: SITEMAP_SILENT, robots: ROBOTS_SILENT, at: AT })).toBeNull();
  });

  it("a non-answering robots document does not make a no-sitemap answer into a robots condition", () => {
    expect(conditionFrom({ sitemap: NO_SITEMAP, robots: ROBOTS_SILENT, at: AT })).toEqual({
      kind: "publishes_no_sitemap",
      foundAt: AT,
    });
  });

  it("where both conditions hold, the broader stop is the one recorded", () => {
    expect(conditionFrom({ sitemap: NO_SITEMAP, robots: BLOCKS, at: AT })).toEqual({
      kind: "robots_blocks_site",
      foundAt: AT,
    });
  });

  it("there are exactly two kinds — reachability is not one of them", () => {
    const kinds = new Set<string>();
    for (const sitemap of [LISTED, NO_SITEMAP, SITEMAP_SILENT]) {
      for (const robots of [PERMITS, BLOCKS, ROBOTS_SILENT]) {
        const condition = conditionFrom({ sitemap, robots, at: AT });
        if (condition !== null) kinds.add(condition.kind);
      }
    }
    expect([...kinds].sort()).toEqual(["publishes_no_sitemap", "robots_blocks_site"]);
  });
});

function publication(over: Row = {}): Row {
  return {
    id: "p1",
    site_id: "s1",
    destination: "wordpress",
    verify_due_at: AT.toISOString(),
    verify: null,
    ...over,
  };
}

function recorded(kind: string | null, foundAt: Date, at: Date = foundAt): Row {
  return {
    outcome: "could_not_confirm",
    why: "server_error",
    checkedAt: at.toISOString(),
    siteCondition: kind === null ? null : { kind, foundAt: foundAt.toISOString() },
  };
}

beforeEach(() => {
  db.reset();
});

describe("siteConditionFor — read back from the check that learned it", () => {
  it("a condition recorded by one page's check is returned for another page on the same destination", async () => {
    db.seed("publications", [
      publication({ id: "p1", verify: recorded("publishes_no_sitemap", EARLIER) }),
      publication({ id: "p2", verify: null }),
    ]);
    expect(await siteConditionFor({ siteId: "s1", destination: "wordpress" })).toEqual({
      kind: "publishes_no_sitemap",
      foundAt: EARLIER,
    });
  });

  it("the most recent answering check wins", async () => {
    db.seed("publications", [
      publication({ id: "p1", verify: recorded("publishes_no_sitemap", EARLIER) }),
      publication({ id: "p2", verify: recorded("robots_blocks_site", AT) }),
    ]);
    expect(await siteConditionFor({ siteId: "s1", destination: "wordpress" })).toEqual({
      kind: "robots_blocks_site",
      foundAt: AT,
    });
  });

  it("a condition recorded on one destination is never returned for another", async () => {
    db.seed("publications", [
      publication({ id: "p1", destination: "hosted", verify: recorded("robots_blocks_site", AT) }),
    ]);
    expect(await siteConditionFor({ siteId: "s1", destination: "wordpress" })).toBeNull();
  });

  it("a condition recorded on one site is never returned for another", async () => {
    db.seed("publications", [
      publication({ id: "p1", site_id: "s2", verify: recorded("robots_blocks_site", AT) }),
    ]);
    expect(await siteConditionFor({ siteId: "s1", destination: "wordpress" })).toBeNull();
  });

  it("checks that recorded no condition suppress nothing for a later page", async () => {
    db.seed("publications", [
      publication({ id: "p1", verify: recorded(null, AT) }),
      publication({ id: "p2", verify: recorded(null, AT) }),
    ]);
    expect(await siteConditionFor({ siteId: "s1", destination: "wordpress" })).toBeNull();
  });

  it("null where no check has ever had an answer to record one from — which is not 'the site is fine'", async () => {
    db.seed("publications", [publication()]);
    const answer = await siteConditionFor({ siteId: "s1", destination: "wordpress" });
    // There is no `{ ok: true }` shape and no boolean a surface could read
    // as a clean bill of health: the type is `SiteCondition | null`, and
    // `null` says only that nothing was ever recorded.
    expect(answer).toBeNull();
  });
});

describe("the module's own shape", () => {
  it("makes no outbound request of any kind — it reads a stored observation and nothing else", () => {
    // Going back to a site to see whether a recorded condition has been put
    // right is REQ-062's non-goal in terms, and a later page's own check
    // already fetches what this read reports.
    const code = readFileSync(
      path.resolve(import.meta.dirname, "../../../src/lib/publish/verify/site.ts"),
      "utf8"
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/safeFetch|readRobots|@\/lib\/egress|fetch\(/);
  });
});
