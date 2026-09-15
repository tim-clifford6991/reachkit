// tests/publish/attempt/window.test.ts — SPEC §7 (issue 709)
//
// The veto window, opened after a passing generation and closed by the
// hourly publish tick. Each test is written so that dropping one condition
// the module names — the battery's record, the destination, the telling,
// the window, the rule's due moment — fails it.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, installTransitionRpc, type Row } from "../harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

/** The draft-ready mail, doubled at its module: the telling's own record is
 *  what the send writes, so the double writes it on the pair in force when
 *  it "sends", and writes nothing when it is told to fail. */
const mail = { sends: [] as { draftId: string; destination: string; at: Date }[], fail: false };
vi.mock("@/lib/mail/draft-ready", () => ({
  sendDraftReadyMail: async (a: { draftId: string; destination: string; at: Date }) => {
    mail.sends.push(a);
    if (mail.fail) return { sent: false, reason: "mail" };
    const { machineDraftFor } = await import("@/lib/publish/machine");
    const draft = await machineDraftFor(a.draftId);
    const row = db.rows("drafts").find((d) => d.id === a.draftId);
    if (draft === null || row === undefined) return { sent: false, reason: "no-draft" };
    row.told = { pair: draft.governing, kind: "interval", publishesAt: null, sentAt: a.at.toISOString() };
    return { sent: true, id: "mail-1" };
  },
}));

const { enterReview, dueApprovals } = await import("@/lib/publish/attempt/window");
const { VETO } = await import("@/lib/config/constants");

/** 22:00 UTC is the site's evening in New York in September. */
const EVENING = new Date("2026-09-01T22:00:00.000Z");
const HOUR = 3_600_000;

function seed(over: { draft?: Row; site?: Row; destination?: Row | null } = {}): void {
  db.reset();
  installTransitionRpc(db);
  db.seed("sites", [
    {
      id: "s1",
      mode: "autopilot",
      veto_hours: VETO.defaultHours,
      publish_time: "09:00",
      timezone: "America/New_York",
      publishing_enabled: true,
      ...over.site,
    },
  ]);
  db.seed(
    "destinations",
    over.destination === null ? [] : [{ id: "dest-1", site_id: "s1", kind: "hosted", deleted_at: null, ...over.destination }]
  );
  db.seed("drafts", [
    {
      id: "d1",
      site_id: "s1",
      state: "generating",
      hard_rules_passed: true,
      veto_deadline: null,
      approved_at: null,
      approved_by: null,
      told: null,
      transitions: [],
      publishable_since: null,
      ...over.draft,
    },
  ]);
}

function draft(): Row {
  const row = db.rows("drafts")[0];
  if (row === undefined) throw new Error("no draft");
  return row;
}

beforeEach(() => {
  mail.sends.length = 0;
  mail.fail = false;
  seed();
});

describe("a passing page enters review, with its window and its telling", () => {
  it("stamps the deadline at entry plus the site's veto hours, moves the page, and tells the customer", async () => {
    expect(await enterReview({ draftId: "d1", at: EVENING })).toEqual({ kind: "told" });
    expect(draft().state).toBe("in_review");
    expect(draft().veto_deadline).toBe(new Date(EVENING.getTime() + VETO.defaultHours * HOUR).toISOString());
    expect(mail.sends).toEqual([{ draftId: "d1", destination: "hosted", at: EVENING }]);
  });

  it("the window is the site's own, not the default", async () => {
    seed({ site: { veto_hours: 72 } });
    await enterReview({ draftId: "d1", at: EVENING });
    expect(draft().veto_deadline).toBe(new Date(EVENING.getTime() + 72 * HOUR).toISOString());
  });

  it("a mail that did not leave leaves the page in review, untold, and says so", async () => {
    mail.fail = true;
    expect(await enterReview({ draftId: "d1", at: EVENING })).toEqual({ kind: "untold", reason: "mail" });
    expect(draft().state).toBe("in_review");
    expect(draft().told).toBeNull();
  });

  it("a page the battery did not pass never enters review", async () => {
    seed({ draft: { hard_rules_passed: false } });
    expect(await enterReview({ draftId: "d1", at: EVENING })).toEqual({ kind: "not_entered", reason: "hard_rules" });
    expect(draft().state).toBe("generating");
    expect(mail.sends).toEqual([]);
  });

  it("a site with no live destination has nothing true to be told", async () => {
    seed({ destination: null });
    expect(await enterReview({ draftId: "d1", at: EVENING })).toEqual({ kind: "not_entered", reason: "no_destination" });
    expect(draft().state).toBe("generating");
  });

  it("a page already past generating is left where it is, and told nothing twice", async () => {
    await enterReview({ draftId: "d1", at: EVENING });
    const deadline = draft().veto_deadline;
    expect(await enterReview({ draftId: "d1", at: new Date(EVENING.getTime() + HOUR) })).toEqual({
      kind: "not_entered",
      reason: "not_generating",
    });
    expect(draft().veto_deadline).toBe(deadline);
    expect(mail.sends).toHaveLength(1);
  });
});

describe("the hourly tick closes a window that has run out", () => {
  /** The first publish time at or after the 24-hour window: 09:00 New York
   *  on 3 September, which is 13:00 UTC. */
  const DUE = new Date("2026-09-03T13:00:00.000Z");

  it("approves a told page whose window ran out and offers it, addressed by destination id", async () => {
    await enterReview({ draftId: "d1", at: EVENING });
    expect(await dueApprovals(DUE)).toEqual([{ draftId: "d1", destinationId: "dest-1" }]);
    expect(draft().state).toBe("approved");
    const last = (draft().transitions as { to: string; actor: unknown }[]).at(-1);
    expect(last).toMatchObject({ to: "approved", actor: { kind: "system", job: "publish/execute" } });
  });

  it("offers nothing while the window is open", async () => {
    await enterReview({ draftId: "d1", at: EVENING });
    expect(await dueApprovals(new Date(EVENING.getTime() + 23 * HOUR))).toEqual([]);
    expect(draft().state).toBe("in_review");
  });

  it("offers nothing between the window's end and the site's publish time", async () => {
    await enterReview({ draftId: "d1", at: EVENING });
    // 22:00 UTC on 2 September: the window has run out, 09:00 has not come.
    expect(await dueApprovals(new Date(EVENING.getTime() + 24 * HOUR))).toEqual([]);
    expect(draft().state).toBe("in_review");
  });

  it("never approves a page the customer was not told about", async () => {
    mail.fail = true;
    await enterReview({ draftId: "d1", at: EVENING });
    expect(await dueApprovals(DUE)).toEqual([]);
    expect(draft().state).toBe("in_review");
  });

  it("a page the customer stopped is not waiting on anything", async () => {
    await enterReview({ draftId: "d1", at: EVENING });
    draft().state = "skipped";
    expect(await dueApprovals(DUE)).toEqual([]);
  });

  it("an approved page that is due is offered again next hour — the claim, not this read, holds it", async () => {
    await enterReview({ draftId: "d1", at: EVENING });
    await dueApprovals(DUE);
    expect(await dueApprovals(new Date(DUE.getTime() + HOUR))).toEqual([{ draftId: "d1", destinationId: "dest-1" }]);
  });

  it("a page whose destination was disconnected is not offered, and stays in review", async () => {
    await enterReview({ draftId: "d1", at: EVENING });
    db.seed("destinations", []);
    expect(await dueApprovals(DUE)).toEqual([]);
    expect(draft().state).toBe("in_review");
  });
});
