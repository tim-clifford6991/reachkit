// SPEC §7 (D53, issue 1268) — the one line a hosted blog says about its
// business is what the business does, never an answer to a setup question.
//
// Found on content.reachkit.app: the index was described by the founder's
// answer to "what sets you apart", typo included.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "../../harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

import { hostedIdentity } from "@/lib/publish/destinations/hosted";

const SITE = { siteId: "site-1", domain: "reachkit.app" };
const ANSWERS = {
  edge: "Automation, Competitor Analysis, Correct Sizing for your business, Intelligent Daily Posts, Business Knowledge Bade",
  byline: "Tim, Reachkit Founder based in Berlin, Germany",
};
const JOB = "Understand where AI and search send buyers, then write pages to rank in those results";

function seed(a: { job: string | null; reworded: string | null }): void {
  db.seed("site_profiles", [
    { domain: SITE.domain, site_name: "ReachKit", logo_type: null, claims: ["A free scan shows where buyers go."] },
  ]);
  db.seed("sites", [{ id: SITE.siteId, market: a.job === null ? null : { current: { category: "AI SEO", job: a.job } } }]);
  db.seed("site_profile_edits", [
    { site_id: SITE.siteId, removed: {}, added: {}, job: a.reworded, seen: {}, facts_off: [], answers: ANSWERS },
  ]);
}

beforeEach(() => db.reset());

describe("D53 — the hosted blog's line is written from the business", () => {
  it("is the job the market was concluded with, not the founder's setup answer", async () => {
    seed({ job: JOB, reworded: null });
    expect(await hostedIdentity(SITE)).toEqual({ name: "ReachKit", logoType: null, line: JOB });
  });

  it("is the founder's own wording of what the business does where they reworded it", async () => {
    seed({ job: JOB, reworded: "We get small businesses recommended by AI search." });
    expect((await hostedIdentity(SITE)).line).toBe("We get small businesses recommended by AI search.");
  });

  it("falls back to the site's own first claim, and still never to a setup answer", async () => {
    seed({ job: null, reworded: null });
    expect((await hostedIdentity(SITE)).line).toBe("A free scan shows where buyers go.");
  });
});

describe("issue 1479 — the hosted blog's name is read by the name rule", () => {
  it("never prints a protection page's name or a placeholder as the business's", async () => {
    for (const stored of ["Just a moment...", "<UNKNOWN>"]) {
      db.reset();
      seed({ job: JOB, reworded: null });
      db.seed("site_profiles", [{ domain: SITE.domain, site_name: stored, logo_type: null, claims: [] }]);
      expect((await hostedIdentity(SITE)).name).toBe("reachkit.app");
    }
  });
});
