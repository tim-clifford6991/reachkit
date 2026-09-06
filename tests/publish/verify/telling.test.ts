// tests/publish/verify/telling.test.ts — the occasion and the payload of
// the `published` mail (REQ-062 c5).
//
// The discriminating rows:
//
//   - **one occasion, four fixtures.** The telling is produced under
//     `found` with nothing failed, under `found` with everything failed,
//     under `page_not_found` and under `could_not_confirm`. An
//     implementation that returns nothing when a check failed or when no
//     page was found fails the first of them.
//   - **the two criterion-4 arms select different copy keys.** They render
//     as nearly the same grey line and a reviewer will propose one key;
//     nothing else in this module would notice, because both arms carry
//     the same fields except the discriminant.
//   - **the recorded outcome goes in place of the four outcomes.** Under
//     those two arms the payload carries no `checks` field, so no template
//     can render both.
//
// The archived plan is WO-235.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type Row } from "../harness";
import { COPY } from "@/lib/presentation/copy";
import { OWNER_OWED } from "@/lib/presentation/copy/registry";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const { tellingFor, TELLING_COPY } = await import("@/lib/publish/verify/telling");

const LIVE_URL = "https://example.com/how-long-does-a-roof-last";
const AT = new Date(Date.UTC(2026, 8, 2, 10, 0, 0));

function check(kind: "measured" | "unmeasured", value: boolean): Row {
  return kind === "measured"
    ? { kind: "measured", value, at: AT.toISOString() }
    : { kind: "unmeasured", reason: "undeterminable", at: AT.toISOString() };
}

function found(over: Partial<Record<string, Row>> = {}): Row {
  return {
    outcome: "found",
    checkedAt: AT.toISOString(),
    siteCondition: null,
    checks: {
      reachable: check("measured", true),
      indexable: check("measured", true),
      sitemap: check("measured", true),
      aiReadable: check("measured", true),
      ...over,
    },
  };
}

const NOT_FOUND: Row = {
  outcome: "page_not_found",
  status: 404,
  checkedAt: AT.toISOString(),
  siteCondition: null,
};

const NOT_CONFIRMED: Row = {
  outcome: "could_not_confirm",
  why: "server_error",
  checkedAt: AT.toISOString(),
  siteCondition: null,
};

function seed(verify: Row | null, over: Row = {}): void {
  db.reset();
  db.seed("publications", [
    { id: "p1", site_id: "s1", live_url: LIVE_URL, verify, ...over },
  ]);
}

beforeEach(() => db.reset());

describe("tellingFor — one message on the same occasion (REQ-062 c5)", () => {
  it("one message carries the live address together with the outcome of all four checks", async () => {
    seed(found());
    const telling = await tellingFor("p1");
    expect(telling?.liveUrl).toBe(LIVE_URL);
    expect(telling?.result.outcome).toBe("found");
    if (telling?.result.outcome !== "found") throw new Error("unreachable");
    expect(Object.keys(telling.result.checks).sort()).toEqual([
      "aiReadable",
      "indexable",
      "reachable",
      "sitemap",
    ]);
  });

  it("it is produced on the same occasion whether every check passed or any failed", async () => {
    const fixtures: Row[] = [
      found(),
      found({
        indexable: check("measured", false),
        sitemap: check("measured", false),
        aiReadable: check("measured", false),
      }),
      NOT_FOUND,
      NOT_CONFIRMED,
    ];
    for (const verify of fixtures) {
      seed(verify);
      const telling = await tellingFor("p1");
      expect(telling, JSON.stringify(verify.outcome)).not.toBeNull();
      expect(telling?.publicationId).toBe("p1");
      expect(telling?.liveUrl).toBe(LIVE_URL);
    }
  });

  it("it names which failed where any did, and never names one that was not observed", async () => {
    seed(
      found({
        indexable: check("measured", false),
        sitemap: check("unmeasured", false),
      })
    );
    const telling = await tellingFor("p1");
    expect(telling?.failed).toEqual(["indexable"]);
  });

  it("nothing failed is an empty list, not an absent telling", async () => {
    seed(found());
    const telling = await tellingFor("p1");
    expect(telling?.failed).toEqual([]);
    expect(telling).not.toBeNull();
  });

  it("where a condition of the site was recorded it is a value of its own, never merged into the failed list", async () => {
    seed({
      ...found({ sitemap: check("unmeasured", false) }),
      siteCondition: { kind: "publishes_no_sitemap", foundAt: AT.toISOString() },
    });
    const telling = await tellingFor("p1");
    expect(telling?.siteCondition).toEqual({ kind: "publishes_no_sitemap", foundAt: AT });
    expect(telling?.failed).toEqual([]);
  });

  it("no condition is null, and null is never a value a template could read as 'the site is fine'", async () => {
    seed(found());
    expect((await tellingFor("p1"))?.siteCondition).toBeNull();
  });
});

describe("tellingFor — the three keys, and the two that must stay two (ADR-085)", () => {
  it("each arm selects its own key", async () => {
    seed(found());
    expect((await tellingFor("p1"))?.copy).toBe("mail.published.verified");
    seed(NOT_FOUND);
    expect((await tellingFor("p1"))?.copy).toBe("mail.published.not_found");
    seed(NOT_CONFIRMED);
    expect((await tellingFor("p1"))?.copy).toBe("mail.published.not_confirmed");
  });

  it("page_not_found and could_not_confirm select DIFFERENT keys", async () => {
    // The row that fails the moment the two are given one key — which is
    // how the merge ADR-085 forbids would first show up on a surface. One
    // retires the page from weekly judgement for ever; the other leaves it
    // fully judged and shown as it was.
    seed(NOT_FOUND);
    const notFound = await tellingFor("p1");
    seed(NOT_CONFIRMED);
    const notConfirmed = await tellingFor("p1");
    expect(notFound?.copy).not.toBe(notConfirmed?.copy);
    expect(new Set(Object.values(TELLING_COPY)).size).toBe(3);
  });

  it("where criterion 4 governed, the recorded outcome and its date go in place of the four outcomes", async () => {
    for (const verify of [NOT_FOUND, NOT_CONFIRMED]) {
      seed(verify);
      const telling = await tellingFor("p1");
      expect(telling?.result).not.toHaveProperty("checks");
      expect(telling?.result.checkedAt).toEqual(AT);
      expect(telling?.failed).toEqual([]);
      // No `checks` field anywhere on the payload, so a template cannot
      // render both the outcome and four rows of check verdicts.
      expect(telling).not.toHaveProperty("checks");
    }
  });

  it("the payload carries copy keys and contains no sentence", async () => {
    seed(found());
    const telling = await tellingFor("p1");
    expect(telling?.copy).toMatch(/^mail\.published\./);
    // Every key it names is owner-owed: a mail never ships a placeholder.
    for (const key of Object.values(TELLING_COPY)) {
      expect(COPY[key]).toBe("");
      expect(OWNER_OWED).toContain(key);
    }
  });
});

describe("tellingFor — when there is nothing to tell", () => {
  it("no check recorded yet is null — the absence of the occasion, not a suppression", async () => {
    seed(null);
    expect(await tellingFor("p1")).toBeNull();
  });

  it("a page with no address is null", async () => {
    seed(found(), { live_url: null });
    expect(await tellingFor("p1")).toBeNull();
  });

  it("a publication that does not exist is null", async () => {
    db.reset();
    expect(await tellingFor("nope")).toBeNull();
  });
});
