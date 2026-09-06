// REQ-063's non-goal, in the requirement's own words: "Any look at a
// published page's address. The weekly re-measurement measures the
// customer's market and visits no page; the only look there has ever been
// is REQ-062's, at 24 hours."
//
// That non-goal is what makes the terminality of `page_not_found` safe
// rather than merely stated: this node reads what the one check recorded
// and cannot take a second look, so it cannot retire a page on a fetch of
// its own — and a `could_not_confirm` cannot be "resolved" by retrying,
// which would record a different day's fact under the check's own date.
import "../env";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { judgeWeek } from "../../../src/lib/opportunities/verdicts/judge";
import { readWeek, weeklyDigest } from "../../../src/lib/opportunities/verdicts/read";
import { WEEK, fakeStore, pageOf, releaseStore, reportWithOwnPlace, verification } from "./harness";
import { SITE_ID } from "../fixtures";

afterEach(() => {
  releaseStore();
  vi.restoreAllMocks();
});

const DIR = "src/lib/opportunities/verdicts";
const SOURCES = readdirSync(DIR).map((name) => ({
  name,
  code: readFileSync(join(DIR, name), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, ""),
}));

describe("nothing under verdicts/ reaches the network", () => {
  it("no module calls fetch, safeFetch, or imports anything under src/lib/egress", () => {
    for (const { name, code } of SOURCES) {
      expect(code, `${name} calls fetch`).not.toMatch(/\bfetch\s*\(/);
      expect(code, `${name} calls safeFetch`).not.toMatch(/safeFetch/);
      expect(code, `${name} imports egress`).not.toMatch(/lib\/egress/);
      expect(code, `${name} imports the vendor clients`).not.toMatch(/lib\/vendors/);
    }
  });

  it("no module retries the check at 24 hours, or re-derives what it recorded", () => {
    for (const { name, code } of SOURCES) {
      expect(code, `${name} retries a verification`).not.toMatch(/retry|reVerif|verifyLive/i);
    }
  });
});

describe("judgeWeek completes with the network stubbed to throw on any call", () => {
  it("a whole week is judged without one request", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("REQ-063 non-goal: the weekly judgement visits no page's address.");
    });
    fakeStore({
      pages: [
        pageOf({ publicationId: "a" }),
        pageOf({ publicationId: "b", verification: verification("could_not_confirm") }),
        pageOf({ publicationId: "c", verification: verification("page_not_found") }),
      ],
      report: reportWithOwnPlace(3),
    });

    const { standings } = await judgeWeek({ siteId: SITE_ID, week: WEEK });
    await readWeek({ siteId: SITE_ID, week: WEEK });
    await weeklyDigest({ siteId: SITE_ID, week: WEEK });

    expect(standings).toHaveLength(3);
    expect(spy).not.toHaveBeenCalled();
  });
});
