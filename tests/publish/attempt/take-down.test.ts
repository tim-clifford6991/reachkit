// tests/publish/attempt/take-down.test.ts — SPEC §7 (issue 1532): the
// customer takes one live page down, and puts it back within 7 days.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, installTransitionRpc, type Row } from "../harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

import { putBack, takeDown } from "@/lib/publish/attempt/take-down";
import type { DestinationAdapter, DestinationKind, RestoreResult, TransitionRecord, UnpublishResult } from "@/lib/publish/types";

const AT = new Date("2026-10-18T12:00:00.000Z");
const DAY = 86_400_000;
const URL_A = "https://blog.c.example/a";

function adapter(kind: DestinationKind, unpublished: UnpublishResult, restored: RestoreResult = { ok: true }) {
  const calls = { unpublish: [] as string[], restore: [] as string[] };
  const a: DestinationAdapter = {
    kind,
    servesPublicly: true,
    hostedByUs: kind === "hosted",
    deliver: async () => ({ ok: true, madeLive: true }),
    unpublish: async (pub) => {
      calls.unpublish.push(pub.id);
      return unpublished;
    },
    restore: async (pub) => {
      calls.restore.push(pub.id);
      return restored;
    },
    health: async () => ({ health: "ok" as const, reason: null }),
  };
  return { adapterFor: () => a, calls };
}

function publication(id: string, draftId: string, over: Row = {}): Row {
  return {
    id,
    draft_id: draftId,
    site_id: "s1",
    destination: "hosted",
    delivery_state: "delivered",
    attempt_no: 1,
    claimed_at: "2026-09-01T09:00:00.000Z",
    published_at: "2026-09-01T09:00:00.000Z",
    unpublished_at: null,
    live_url: URL_A,
    remote_id: null,
    failure_reason: null,
    mode: "autopilot",
    unpublish_outcome: null,
    made_live_by_us: true,
    verify_due_at: null,
    ...over,
  };
}

function draft(id: string, over: Row = {}): Row {
  return { id, site_id: "s1", state: "published", transitions: [], hard_rules_passed: true, opportunity_id: null, ...over };
}

function seed(kind: DestinationKind = "hosted"): void {
  db.reset();
  installTransitionRpc(db);
  db.seed("sites", [{ id: "s1", mode: "autopilot", veto_hours: 24, publishing_enabled: true }]);
  db.seed("destinations", [
    { id: "dest-1", site_id: "s1", kind, health: "ok", config: null, hostname: "blog.c.example", hostname_state: "live", deleted_at: null },
  ]);
  // The page and an older version a refresh replaced, both live at A; a
  // second page at B; and a refresh of A written and not yet out.
  db.seed("drafts", [
    draft("d-new", { opportunity_id: "o-refresh-done" }),
    draft("d-old", { opportunity_id: "o-write" }),
    draft("d-other"),
    draft("d-pending", { state: "in_review", opportunity_id: "o-refresh-open" }),
  ]);
  db.seed("publications", [
    publication("p-new", "d-new", { destination: kind, published_at: "2026-10-01T09:00:00.000Z", remote_id: "77" }),
    publication("p-old", "d-old", { destination: kind, remote_id: "77" }),
    publication("p-other", "d-other", { destination: kind, live_url: "https://blog.c.example/b" }),
  ]);
  db.seed("opportunities", [
    { id: "o-write", site_id: "s1", type: "write_page", family: "write", target_ref: "a", status: "done", rest_until: null },
    { id: "o-refresh-done", site_id: "s1", type: "refresh_page", family: "improve", target_ref: URL_A, status: "queued", rest_until: null },
    { id: "o-refresh-open", site_id: "s1", type: "refresh_page", family: "improve", target_ref: URL_A, status: "queued", rest_until: null },
  ]);
}

const pub = (id: string) => db.rows("publications").find((row) => row.id === id)!;
const draftRow = (id: string) => db.rows("drafts").find((row) => row.id === id)!;
const opportunity = (id: string) => db.rows("opportunities").find((row) => row.id === id)!;
const moves = (id: string) => draftRow(id).transitions as TransitionRecord[];

beforeEach(() => seed());

describe("take down: every live version at the address, through unpublish() as the customer", () => {
  it("hosted: both versions leave the live set, no row is deleted, the address is announced once", async () => {
    const hosted = adapter("hosted", { ok: true, outcome: "removed" });
    const sent: string[] = [];
    const result = await takeDown({
      draftId: "d-new",
      userId: "u1",
      at: AT,
      deps: { adapterFor: hosted.adapterFor, announce: async (url) => (sent.push(url), { ok: true, status: 200 } as never) },
    });

    expect(result).toEqual({ ok: true });
    expect(db.rows("publications")).toHaveLength(3);
    expect(pub("p-new").unpublished_at).toBe(AT.toISOString());
    expect(pub("p-old").unpublished_at).toBe(AT.toISOString());
    expect(pub("p-other").unpublished_at).toBeNull();
    for (const id of ["d-new", "d-old"]) {
      expect(draftRow(id).state).toBe("unpublished");
      expect(moves(id).at(-1)).toMatchObject({ from: "published", to: "unpublished", actor: { kind: "customer", userId: "u1" }, reason: "take_down" });
    }
    expect(sent.filter((url) => url.includes("indexnow"))).toHaveLength(1);
  });

  it("afterwards: its topic rests for 90 days, and a refresh of it that has not gone out is stopped", async () => {
    await takeDown({ draftId: "d-new", userId: "u1", at: AT, deps: { ...adapter("hosted", { ok: true, outcome: "removed" }), announce: async () => ({ ok: true, status: 200 }) as never } });
    for (const id of ["o-write", "o-refresh-done"]) {
      expect(opportunity(id)).toMatchObject({ status: "open", unready_reason: "resting", rest_until: new Date(AT.getTime() + 90 * DAY).toISOString() });
    }
    expect(draftRow("d-pending").state).toBe("skipped");
  });

  it("WordPress: a post that could not be written shows as the destination's health", async () => {
    seed("wordpress");
    const checked: string[] = [];
    const wp = adapter("wordpress", { ok: true, outcome: "unreachable", retryOffered: true });
    await takeDown({ draftId: "d-new", userId: "u1", at: AT, deps: { adapterFor: wp.adapterFor, recheckHealth: async (id) => void checked.push(id) } });
    expect(wp.calls.unpublish).toEqual(["p-new", "p-old"]);
    expect(checked).toEqual(["dest-1"]);
  });

  it("a page that is not live is refused and nothing is written", async () => {
    expect(await takeDown({ draftId: "d-pending", userId: "u1", at: AT })).toEqual({ ok: false, refused: "not_live" });
    expect(db.rows("publications").every((row) => row.unpublished_at === null)).toBe(true);
  });
});

describe("put back: the same versions at the same address, through the state machine, for 7 days", () => {
  async function takenDownAt(at: Date, kind: DestinationKind = "hosted"): Promise<ReturnType<typeof adapter>> {
    seed(kind);
    const destination = adapter(kind, kind === "hosted" ? { ok: true, outcome: "removed" } : { ok: true, outcome: "returned_to_draft" });
    await takeDown({ draftId: "d-new", userId: "u1", at, deps: { adapterFor: destination.adapterFor, announce: async () => ({ ok: true, status: 200 }) as never } });
    return destination;
  }

  it("six days later: both rows are live again and both drafts take unpublished → published", async () => {
    const hosted = await takenDownAt(new Date(AT.getTime() - 6 * DAY));
    const result = await putBack({ draftId: "d-new", userId: "u1", at: AT, deps: { adapterFor: hosted.adapterFor, announce: async () => ({ ok: true, status: 200 }) as never } });

    expect(result).toEqual({ ok: true });
    for (const [p, d] of [["p-new", "d-new"], ["p-old", "d-old"]] as const) {
      expect(pub(p)).toMatchObject({ unpublished_at: null, unpublish_outcome: null, live_url: URL_A });
      expect(draftRow(d).state).toBe("published");
      expect(moves(d).map((move) => move.reason)).toEqual(["take_down", "put_back"]);
    }
    expect(opportunity("o-write").status).toBe("queued");
  });

  it("WordPress: a post returned to draft is not published again (ADR-084 Decision 1, pending the owner)", async () => {
    const wp = await takenDownAt(new Date(AT.getTime() - DAY), "wordpress");
    expect(await putBack({ draftId: "d-new", userId: "u1", at: AT, deps: { adapterFor: wp.adapterFor } })).toEqual({ ok: false, refused: "not_open" });
    expect(wp.calls.restore).toEqual([]);
    expect(draftRow("d-new").state).toBe("unpublished");
  });

  it("eight days later it is refused, and the page stays down", async () => {
    const hosted = await takenDownAt(new Date(AT.getTime() - 8 * DAY));
    expect(await putBack({ draftId: "d-new", userId: "u1", at: AT, deps: { adapterFor: hosted.adapterFor } })).toEqual({ ok: false, refused: "not_open" });
    expect(pub("p-new").unpublished_at).not.toBeNull();
    expect(draftRow("d-new").state).toBe("unpublished");
  });

  it("a destination that refuses leaves the page down", async () => {
    await takenDownAt(new Date(AT.getTime() - DAY));
    const refusing = adapter("hosted", { ok: true, outcome: "removed" }, { ok: false, reason: "destination_unavailable" });
    const result = await putBack({ draftId: "d-new", userId: "u1", at: AT, deps: { adapterFor: refusing.adapterFor } });
    expect(result).toEqual({ ok: false, refused: "failed" });
    expect(refusing.calls.restore).toEqual(["p-new"]);
    expect(pub("p-new").unpublished_at).not.toBeNull();
    expect(draftRow("d-new").state).toBe("unpublished");
  });
});
