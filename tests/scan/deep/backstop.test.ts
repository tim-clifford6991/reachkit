// tests/scan/deep/backstop.test.ts — SPEC §5, issue #782
//
// Which finished setups `account/maintenance` re-sends the onboarding pass
// for. The tick and the send are driven in `tests/jobs/setup-wiring.test.ts`;
// this is the query over a PostgREST-shaped double of `sites` and `scans`.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "../../publish/harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client }));

const { sitesWithoutDeepPass, deepPassDomain, deepPassCutShort } = await import("@/lib/scan/deep/backstop");
const { TIMING } = await import("@/lib/config/constants");

const NOW = new Date("2026-09-16T12:00:00.000Z");
const minutesAgo = (m: number): string => new Date(NOW.getTime() - m * 60_000).toISOString();

beforeEach(() => {
  db.reset();
  db.seed("sites", [
    // Setup finished 20 minutes ago; the send never reached the queue, and
    // setup's own claim is all there is.
    { id: "dropped", domain: "dropped.test", setup_completed_at: minutesAgo(20) },
    // Finished 20 minutes ago, and its pass ended.
    { id: "ran", domain: "ran.test", setup_completed_at: minutesAgo(20) },
    // Finished five minutes ago: its pass has not had its window.
    { id: "fresh", domain: "fresh.test", setup_completed_at: minutesAgo(5) },
    // Finished two days ago: past the queue's idempotency window.
    { id: "old", domain: "old.test", setup_completed_at: minutesAgo(48 * 60) },
    // Never finished setup.
    { id: "unfinished", domain: "unfinished.test", setup_completed_at: null },
  ]);
  db.seed("scans", [
    { id: "claim-dropped", site_id: "dropped", tier: "deep", status: "running" },
    { id: "claim-ran", site_id: "ran", tier: "deep", status: "done" },
  ]);
});

describe("sitesWithoutDeepPass", () => {
  it("names a finished setup past the backstop window whose only deep row is setup's running claim", async () => {
    expect(TIMING.deepPassBackstopMin).toBeGreaterThan(TIMING.deepReleaseMin);
    expect(await sitesWithoutDeepPass(NOW)).toEqual(["dropped"]);
  });

  it("a site whose only ended pass is a weekly one is still owed its onboarding pass", async () => {
    db.rows("scans")[0]!.tier = "weekly";
    db.rows("scans")[0]!.status = "done";
    expect(await sitesWithoutDeepPass(NOW)).toEqual(["dropped"]);
  });

  it("reads no scans at all when no setup is due", async () => {
    db.seed("sites", []);
    expect(await sitesWithoutDeepPass(NOW)).toEqual([]);
    expect(db.queries.filter((q) => q.table === "scans")).toHaveLength(0);
  });

  it("issue 855: a finished setup whose newest deep pass stopped on a ceiling is owed the pass again; a finished or running one is not", async () => {
    const ran = db.rows("scans")[1]!;
    Object.assign(ran, { stopped_reason: "time_ceiling", status: "degraded", created_at: minutesAgo(18) });
    expect(await sitesWithoutDeepPass(NOW)).toEqual(["dropped", "ran"]);
    // Issue 886: the answer is the cut-short pass's own id — the key the
    // re-measure it starts is unique on.
    expect(await deepPassCutShort("ran")).toBe("claim-ran");
    expect(await deepPassCutShort("dropped")).toBeNull();

    ran.stopped_reason = "spend_ceiling";
    expect(await sitesWithoutDeepPass(NOW)).toEqual(["dropped", "ran"]);

    // Measured again and still under way: nothing more is owed.
    db.rows("scans").push({ id: "again", site_id: "ran", tier: "deep", status: "running", created_at: minutesAgo(2) });
    expect(await sitesWithoutDeepPass(NOW)).toEqual(["dropped"]);

    // That pass finished: the site is measured.
    Object.assign(db.rows("scans").at(-1)!, { status: "done", stopped_reason: "complete" });
    expect(await sitesWithoutDeepPass(NOW)).toEqual(["dropped"]);
    expect(await deepPassCutShort("ran")).toBeNull();
  });

  it("the address a re-send carries is the site's own, and a site gone since is null", async () => {
    expect(await deepPassDomain("dropped")).toBe("dropped.test");
    expect(await deepPassDomain("nobody")).toBeNull();
  });
});
