// A planned page stopped while its draft is written never goes live: the stop
// dismisses only an `open` page, and saving the draft takes the page out of
// `open` first, so whichever lands second sees the other.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../mail/env-fixture";
import { fakeDb, type Row } from "../publish/harness";

applyEnvFixture();

const db = fakeDb();
const client = db.client as { from(table: string): unknown };
let onSiteRead: (() => void) | null = null;
const seen = {
  from(table: string) {
    if (table === "sites") onSiteRead?.();
    return client.from(table);
  },
};
vi.mock("@/lib/db", () => ({ dbAdmin: () => seen, db: () => seen }));

const { stopPlannedPage, plannedStopToken } = await import("@/lib/opportunities/stop");
const { supabaseGenerateStore, PageStopped } = await import("@/lib/generate/store");

const NOW = new Date(Date.UTC(2026, 9, 20, 7, 0, 0));
const DAY = "2026-10-21";
const token = plannedStopToken({ siteId: "site-1", opportunityId: "o1", day: DAY });

function status(): unknown {
  return db.rows("opportunities").find((row) => row.id === "o1")!.status;
}

function draft(): Parameters<ReturnType<typeof supabaseGenerateStore>["insertDraft"]>[0] {
  return {
    site_id: "site-1",
    opportunity_id: "o1",
    state: "generating",
    title: "t",
    body_md: "b",
    grounded_fact: null,
    attribution: null,
    scheduled_for: DAY,
    cost_cents: 0,
  };
}

beforeEach(() => {
  onSiteRead = null;
  db.reset();
  db.seed("sites", [{ id: "site-1", domain: "harbor-plumbing.example" }]);
  const row: Row = { id: "o1", site_id: "site-1", target_query: "drain repair", volume: 90, status: "open", planned_for: DAY };
  db.seed("opportunities", [row]);
  db.seed("drafts", []);
});

describe("the planned stop", () => {
  it("does not stop a page whose draft was saved between the stop's read and its write", async () => {
    // The stop reads the page as open, then its draft is saved before the stop writes.
    onSiteRead = () => {
      db.rows("opportunities")[0]!.status = "queued";
    };
    expect(await stopPlannedPage(token, NOW)).toEqual({ ok: false, reason: "written" });
    expect(status()).toBe("queued");
  });
});

describe("saving the day's draft", () => {
  it("saves no draft for a page stopped while it was written", async () => {
    expect(await stopPlannedPage(token, NOW)).toMatchObject({ ok: true });
    await expect(supabaseGenerateStore().insertDraft(draft())).rejects.toBeInstanceOf(PageStopped);
    expect(db.rows("drafts")).toEqual([]);
    expect(status()).toBe("dismissed");
  });

  it("takes the page out of open as it is saved, so a stop after that is refused", async () => {
    await supabaseGenerateStore().insertDraft(draft());
    expect(db.rows("drafts")).toHaveLength(1);
    expect(status()).toBe("queued");
    expect(await stopPlannedPage(token, NOW)).toEqual({ ok: false, reason: "written" });
    expect(status()).toBe("queued");
  });
});
