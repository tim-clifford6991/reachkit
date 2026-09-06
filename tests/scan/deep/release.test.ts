// tests/scan/deep/release.test.ts — BUILD §4.3, issue #36
//
// The release latch: four triggers, one monotonic write, no scheduled job.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fakeDb, type FakeDb } from "./fake-db";

let db: FakeDb = fakeDb();

vi.mock("@/lib/db", () => ({
  dbAdmin: () => db.client,
  db: () => db.client,
}));

const { RELEASE_REASONS, deadlineFrom, isReleased, releaseToApp } = await import(
  "../../../src/lib/scan/deep/release"
);
const { TIMING } = await import("../../../src/lib/config/constants");

const SITE = "site-1";
const SUBMITTED = new Date(Date.UTC(2026, 8, 6, 12, 0, 0));

const RELEASE_SOURCE = readFileSync(
  path.resolve(import.meta.dirname, "../../../src/lib/scan/deep/release.ts"),
  "utf8"
);

/** The module's code with its prose stripped. The header explains at
 *  length that this file consults no opportunity count and schedules
 *  nothing; a structural assertion that read the comments would pass on
 *  the explanation rather than on the thing explained. */
const RELEASE_CODE = RELEASE_SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

function site(overrides: Record<string, unknown> = {}) {
  return {
    id: SITE,
    setup_completed_at: SUBMITTED.toISOString(),
    setup_released_at: null,
    setup_released_reason: null,
    ...overrides,
  };
}

beforeEach(() => {
  db = fakeDb({ sites: [site()] });
});

describe("REQ-029 c2 — a completed pass releases the founder with no further action from them", () => {
  it("latches 'completed', and isReleased then reports it with no second write", async () => {
    const written = await releaseToApp({ siteId: SITE, reason: "completed", now: SUBMITTED });
    expect(written.reason).toBe("completed");

    const state = await isReleased(SITE, new Date(SUBMITTED.getTime() + 60_000));
    expect(state).toEqual({ released: true, at: written.releasedAt, reason: "completed" });
    expect(db.tables.sites![0]!.setup_released_at).toBe(SUBMITTED.toISOString());
  });
});

describe("§4.3 — a degraded pass still releases setup", () => {
  it("'degraded' latches on the identical path 'completed' does", async () => {
    const written = await releaseToApp({ siteId: SITE, reason: "degraded", now: SUBMITTED });
    expect(written.reason).toBe("degraded");
    expect((await isReleased(SITE, SUBMITTED)).released).toBe(true);
  });

  it("the release reads no opportunity count — a site with none releases identically", () => {
    // Structural: nothing in this module names an opportunity at all, so
    // there is no count for a future edit to start consulting.
    expect(RELEASE_CODE).not.toMatch(/opportunit/i);
  });
});

describe("REQ-029 c5 — a failure latches immediately, and the deadline latches on the read path", () => {
  it("'failed' is written at once rather than waiting out the ten minutes", async () => {
    const at = new Date(SUBMITTED.getTime() + 5_000);
    const written = await releaseToApp({ siteId: SITE, reason: "failed", now: at });
    expect(written).toEqual({ releasedAt: at, reason: "failed" });
  });

  it("a pass that has not ended latches 'deadline' on the first read past the window, with no scheduled job", async () => {
    const inside = new Date(SUBMITTED.getTime() + (TIMING.deepReleaseMin - 1) * 60_000);
    expect(await isReleased(SITE, inside)).toEqual({
      released: false,
      deadlineAt: deadlineFrom(SUBMITTED),
    });
    expect(db.tables.sites![0]!.setup_released_at).toBeNull();

    // A week later, with nothing having run in between: the read itself
    // is the trigger.
    const muchLater = new Date(SUBMITTED.getTime() + 7 * 24 * 60 * 60_000);
    const state = await isReleased(SITE, muchLater);
    expect(state).toEqual({ released: true, at: muchLater, reason: "deadline" });
  });

  it("this module schedules nothing — no timer, no job, no queue", () => {
    expect(RELEASE_CODE).not.toMatch(/setTimeout|setInterval|schedule|cron|sendJobEvent/i);
  });

  it("a late pass-end cannot overwrite or clear an existing latch", async () => {
    const past = new Date(SUBMITTED.getTime() + TIMING.deepReleaseMin * 60_000);
    await isReleased(SITE, past); // latches 'deadline'

    const late = await releaseToApp({
      siteId: SITE,
      reason: "completed",
      now: new Date(past.getTime() + 60_000),
    });
    expect(late).toEqual({ releasedAt: past, reason: "deadline" });
    expect(db.tables.sites![0]!.setup_released_reason).toBe("deadline");
  });
});

describe("the latch is monotonic and idempotent — the first writer wins", () => {
  it("a second release of any reason reports the first one back", async () => {
    const first = await releaseToApp({ siteId: SITE, reason: "degraded", now: SUBMITTED });
    for (const reason of RELEASE_REASONS) {
      expect(await releaseToApp({ siteId: SITE, reason, now: new Date() })).toEqual(first);
    }
  });

  it("mutation check — an unconditional update would let the second writer win", () => {
    // The conditional is `.is("setup_released_at", null)`. Its presence is
    // the whole of the property; the test above is what fails without it.
    expect(RELEASE_CODE).toContain('.is("setup_released_at", null)');
  });

  it("no caller can clear it: nothing in this module ever writes null to the latch", () => {
    expect(RELEASE_CODE).not.toMatch(/setup_released_at:\s*null/);
  });
});

describe("edges", () => {
  it("a founder who never submitted setup is unreleased, and no deadline has begun to run", async () => {
    db = fakeDb({ sites: [site({ setup_completed_at: null })] });
    const now = new Date(SUBMITTED.getTime() + 7 * 24 * 60 * 60_000);
    expect(await isReleased(SITE, now)).toEqual({ released: false, deadlineAt: deadlineFrom(now) });
    expect(db.tables.sites![0]!.setup_released_at).toBeNull();
  });

  it("a site that does not exist is an error, never a silent release", async () => {
    db = fakeDb({ sites: [] });
    await expect(isReleased(SITE)).rejects.toThrow(/no site/);
    await expect(releaseToApp({ siteId: SITE, reason: "failed" })).rejects.toThrow(/no site/);
  });

  it("the four reasons are exactly the four the migration's check constraint allows", () => {
    const migration = readFileSync(
      path.resolve(
        import.meta.dirname,
        "../../../supabase/migrations/20260906130000_sites_setup.sql"
      ),
      "utf8"
    );
    for (const reason of RELEASE_REASONS) expect(migration).toContain(`'${reason}'`);
    expect(RELEASE_REASONS).toHaveLength(4);
  });
});
