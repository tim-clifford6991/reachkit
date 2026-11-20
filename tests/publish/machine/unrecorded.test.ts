// A take-down or publish whose row write fails is not reported done, the draft does not move, and a later try finishes it.
import { describe, expect, it, vi } from "vitest";
import { fakeDb, installTransitionRpc } from "../harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

import { publish } from "@/lib/publish/attempt";
import { unpublish } from "@/lib/publish/attempt/unpublish";
import type { GuardDeps } from "@/lib/publish/machine";
import type { Actor, DestinationAdapter } from "@/lib/publish/types";

const BY: Actor = { kind: "system", job: "publish/execute" };
const AT = new Date(Date.UTC(2026, 10, 20, 12, 0, 0));
const URL = "https://blog.c.example/p";
const deps = { claimRecheckOutstanding: async () => false, outstandingMatch: async () => null, reachKitStopped: async () => false, isPublishingOn: async () => true, hasCeilingRoom: async () => true, destinationWorking: async () => true, rule: { becomesPublishable: () => true } } satisfies GuardDeps;
const adapter: DestinationAdapter = {
  kind: "wordpress", servesPublicly: true, hostedByUs: false,
  deliver: async () => ({ ok: true, madeLive: true, liveUrl: URL, remoteId: "42" }),
  unpublish: async () => ({ ok: true, outcome: "returned_to_draft" }),
  health: async () => ({ health: "ok" as const, reason: null }),
};

function seed(state: string, published: boolean): void {
  db.reset();
  installTransitionRpc(db);
  db.seed("sites", [{ id: "s1", mode: "autopilot", veto_hours: 24, publishing_enabled: true }]);
  db.seed("destinations", [{ id: "dest-1", site_id: "s1", kind: "wordpress", health: "ok", config: null, deleted_at: null }]);
  db.seed("opportunities", [{ id: "o1", family: "write", type: "keyword_page", proposed_slug: "p" }]);
  db.seed("drafts", [{ id: "d1", site_id: "s1", opportunity_id: "o1", state, title: "P", body_md: "", meta: {}, transitions: [], hard_rules_passed: true, publishable_since: null, veto_deadline: null, approved_at: null }]);
  // A failed row on another destination sits first, so a take-down that reads "the first one" acts on the wrong page.
  db.seed("publications", [
    { id: "pub-old", draft_id: "d1", site_id: "s1", destination: "hosted", delivery_state: "failed", attempt_no: 3, published_at: null, unpublished_at: null, live_url: null, remote_id: null, mode: "autopilot", made_live_by_us: false },
    ...(published ? [{ id: "pub-1", draft_id: "d1", site_id: "s1", destination: "wordpress", delivery_state: "delivered", attempt_no: 1, published_at: "2026-11-01T12:00:00.000Z", unpublished_at: null, live_url: URL, remote_id: "42", mode: "autopilot", made_live_by_us: true }] : []),
  ]);
}

const live = () => db.rows("publications").find((row) => row.destination === "wordpress");

describe("an outcome that could not be recorded is never reported as done", () => {
  it.each([
    { name: "take-down", state: "published", published: true, run: () => unpublish({ draftId: "d1", by: BY, at: AT, adapterFor: () => adapter, deps }), done: "unpublished", recorded: { unpublished_at: AT.toISOString(), unpublish_outcome: "returned_to_draft" } },
    { name: "publish", state: "approved", published: false, run: () => publish({ draftId: "d1", destination: "wordpress", by: BY, at: AT, adapterFor: () => adapter, deps }), done: "published", recorded: { delivery_state: "delivered", live_url: URL, remote_id: "42" } },
  ])("$name: refused while the row cannot be written, finished by the next try", async ({ state, published, run, done, recorded }) => {
    seed(state, published);
    db.unwritable.add("publications");
    expect((await run()).ok).toBe(false);
    expect(db.rows("drafts")[0]?.state).not.toBe(done);
    expect(live()?.delivery_state ?? null).not.toBe(published ? "failed" : "delivered");

    db.unwritable.clear();
    expect((await run()).ok).toBe(true);
    expect(db.rows("drafts")[0]?.state).toBe(done);
    expect(live()).toMatchObject(recorded);
    expect(db.rows("publications").find((row) => row.id === "pub-old")).toMatchObject({ unpublished_at: null, delivery_state: "failed" });
  });
});
