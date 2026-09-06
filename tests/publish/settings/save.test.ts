// tests/publish/settings/save.test.ts — REQ-073 c4, c5, c6 and REQ-057 c8.
//
// The one writer of the four settings: refused whole when invalid, applied
// in one statement across every draft not yet published, and clearing the
// telling for every draft whose governing pair changed — while sending no
// mail at all.
//
// The archived plan is WO-220.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type FakeDb, type Row } from "../harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

import { enteredReviewAt, savePublishingSettings } from "@/lib/publish/settings/save";
import { samePair } from "@/lib/publish/settings/pair";
import { readPublishingSettings } from "@/lib/publish/settings/settings";
import { nextPublishTimeAtOrAfter } from "@/lib/publish/settings/clock";
import type { Actor, GoverningPair } from "@/lib/publish/types";

const BY: Actor = { kind: "customer", userId: "u1" };
const AT = new Date("2026-09-02T12:00:00Z");
const HOUR = 3_600_000;

/** `save_publishing_settings`, as the migration writes it: the site's four
 *  values and every listed draft's deadline and telling, in one call. */
function installSaveRpc(target: FakeDb): void {
  target.rpcs.set("save_publishing_settings", (args: Row) => {
    const site = target.rows("sites").find((row) => row.id === args.p_site_id);
    if (site !== undefined) {
      site.mode = args.p_mode;
      site.veto_hours = args.p_veto_hours;
      site.publish_time = args.p_publish_time;
      site.timezone = args.p_timezone;
    }
    const entries = (args.p_drafts ?? []) as {
      draft_id: string;
      veto_deadline: string;
      clear_told: boolean;
    }[];
    for (const entry of entries) {
      const draft = target
        .rows("drafts")
        .find((row) => row.id === entry.draft_id && row.site_id === args.p_site_id);
      if (draft === undefined) continue;
      draft.veto_deadline = entry.veto_deadline;
      if (entry.clear_told) draft.told = null;
    }
    return entries.length;
  });
}

function pair(over: Partial<GoverningPair> = {}): GoverningPair {
  return { mode: "autopilot", vetoHours: 24, publishTime: "09:00", timezone: "UTC", ...over };
}

function seed(drafts: Row[] = []): void {
  db.reset();
  installSaveRpc(db);
  db.seed("sites", [
    { id: "s1", mode: "autopilot", veto_hours: 24, publish_time: "09:00:00", timezone: "UTC" },
  ]);
  db.seed("drafts", drafts);
}

function draft(over: Row = {}): Row {
  return {
    id: "d1",
    site_id: "s1",
    state: "in_review",
    veto_deadline: "2026-09-02T10:00:00.000Z",
    created_at: "2026-09-01T10:00:00.000Z",
    transitions: [{ from: "generating", to: "in_review", at: "2026-09-01T10:00:00.000Z" }],
    told: { pair: pair(), kind: "interval", publishesAt: null, sentAt: "2026-09-01T10:00:00.000Z" },
    ...over,
  };
}

beforeEach(() => seed([draft()]));

describe("an invalid patch is refused whole and writes nothing", () => {
  it("names every field that failed and leaves the site untouched", async () => {
    const result = await savePublishingSettings("s1", { vetoHours: 36, timezone: "Mars/X" }, BY, AT);
    expect(result).toEqual({ ok: false, invalid: ["vetoHours", "timezone"] });
    expect(db.rows("sites")[0]?.veto_hours).toBe(24);
    expect(db.rpcCalls).toHaveLength(0);
  });
});

describe('REQ-073 c4 — "it applies to every draft not yet published, including drafts already in review"', () => {
  it("every in-scope draft is re-deadlined in one call, and a published one is not touched", async () => {
    seed([
      draft({ id: "d1", state: "in_review" }),
      draft({ id: "d2", state: "approved" }),
      draft({ id: "d3", state: "published" }),
    ]);
    const result = await savePublishingSettings("s1", { vetoHours: 72 }, BY, AT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.applied.draftIds.sort()).toEqual(["d1", "d2"]);
    expect(db.rpcCalls).toHaveLength(1);
  });

  it("the save is one statement — the four values and every draft go in the same call", async () => {
    await savePublishingSettings("s1", { mode: "copilot", vetoHours: 72 }, BY, AT);
    expect(db.rpcCalls).toHaveLength(1);
    const [call] = db.rpcCalls;
    expect(call?.fn).toBe("save_publishing_settings");
    expect(call?.args.p_mode).toBe("copilot");
    expect(call?.args.p_veto_hours).toBe(72);
    expect((call?.args.p_drafts as unknown[]).length).toBe(1);
  });

  it("a lengthened window moves the draft's deadline out, through newVetoDeadline's rule", async () => {
    await savePublishingSettings("s1", { vetoHours: 72 }, BY, AT);
    const entered = new Date("2026-09-01T10:00:00.000Z").getTime();
    expect(db.rows("drafts")[0]?.veto_deadline).toBe(new Date(entered + 72 * HOUR).toISOString());
  });
});

describe('REQ-073 c5 — "the publishing mode … is the same single setting this screen shows"', () => {
  it("changing the mode from anywhere runs the same writer and the same re-deadline pass", async () => {
    const result = await savePublishingSettings("s1", { mode: "copilot" }, BY, AT);
    expect(result.ok).toBe(true);
    expect(db.rows("sites")[0]?.mode).toBe("copilot");
    expect(db.rpcCalls[0]?.args.p_drafts).toHaveLength(1);
  });
});

describe('REQ-073 c6 — "the next publication\'s date and time reflect the new settings"', () => {
  it("after a save, the settings read back compose a different next publish time", async () => {
    const before = nextPublishTimeAtOrAfter(AT, await readPublishingSettings("s1"));
    await savePublishingSettings("s1", { publishTime: "17:30", timezone: "Asia/Tokyo" }, BY, AT);
    const after = nextPublishTimeAtOrAfter(AT, await readPublishingSettings("s1"));
    expect(after.getTime()).not.toBe(before.getTime());
    expect(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Tokyo",
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      }).format(after)
    ).toBe("17:30");
  });
});

describe('REQ-057 c8 — a changed pair clears the telling and returns the draft as retell-owed', () => {
  it.each([
    ["mode", { mode: "copilot" as const }],
    ["vetoHours", { vetoHours: 72 }],
    ["publishTime", { publishTime: "17:00" }],
    ["timezone", { timezone: "Asia/Tokyo" }],
  ])("changing %s alone re-opens the obligation", async (_field, patch) => {
    seed([draft()]);
    const result = await savePublishingSettings("s1", patch, BY, AT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.applied.retellOwed).toEqual(["d1"]);
    expect(db.rows("drafts")[0]?.told).toBeNull();
  });

  it("a save that changes none of the four clears no telling", async () => {
    const result = await savePublishingSettings("s1", { vetoHours: 24 }, BY, AT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.applied.retellOwed).toEqual([]);
    expect(db.rows("drafts")[0]?.told).not.toBeNull();
  });

  it("a draft nobody has been told about is not listed as retell-owed — the telling is already owed", async () => {
    seed([draft({ told: null })]);
    const result = await savePublishingSettings("s1", { vetoHours: 72 }, BY, AT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.applied.retellOwed).toEqual([]);
  });

  it("the save sends no mail — clearing the record is the whole of it", async () => {
    // Nothing in this module can reach the mail seam: the assertion is on
    // the module graph, which is what makes it hold for every future save.
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync("src/lib/publish/settings/save.ts", "utf8")
    );
    expect(source).not.toContain("@/lib/mail");
    expect(source).not.toContain("sendEmail");
  });
});

describe("samePair and enteredReviewAt", () => {
  it("two pairs agreeing on all four members are the same pair", () => {
    expect(samePair(pair(), pair())).toBe(true);
    expect(samePair(pair(), pair({ publishTime: "10:00" }))).toBe(false);
    expect(samePair(pair(), pair({ timezone: "Asia/Tokyo" }))).toBe(false);
  });

  it("the moment a draft entered review is read from its own transition record", () => {
    expect(
      enteredReviewAt(
        [
          { to: "in_review", at: "2026-09-01T10:00:00.000Z" },
          { to: "skipped", at: "2026-09-03T10:00:00.000Z" },
        ],
        null
      ).toISOString()
    ).toBe("2026-09-01T10:00:00.000Z");
  });

  it("a draft that never entered review falls back to its own creation, which rule 3's max can only ignore", () => {
    expect(enteredReviewAt([], "2026-08-30T00:00:00.000Z").toISOString()).toBe(
      "2026-08-30T00:00:00.000Z"
    );
  });
});

describe("a patch member that is present but undefined never overwrites a stated value", () => {
  it("`{ timezone: undefined }` leaves the customer's zone standing", async () => {
    seed([draft()]);
    const result = await savePublishingSettings("s1", { timezone: undefined }, BY, AT);
    expect(result.ok).toBe(true);
    expect(db.rpcCalls[0]?.args.p_timezone).toBe("UTC");
    expect(db.rows("sites")[0]?.timezone).toBe("UTC");
  });
});
