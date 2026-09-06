// tests/publish/publishable/rule.test.ts — the seam #45 declared and this
// issue fills.
//
// `machine/guards.ts` reads two booleans through `PublishableRule`. These
// are that rule's two answers, and the assertions here are what fails if
// either guard stops consulting the leaf that owns it.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import { fakeDb, installTransitionRpc, type Row } from "../harness";

// The tests below drive `DEFAULT_GUARD_DEPS`, and its `reachKitStopped`
// reads `KILL_SWITCH` through `env` — which parses `process.env` and throws
// on a missing binding. Every other publishing suite injects its deps and
// never reaches it; this one is the seam test, so it pays the fixture. The
// binding is read at call time (a dynamic import inside the dep), so
// setting it here, before any test runs, is early enough.
applyEnvFixture();

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

import { DEFAULT_GUARD_DEPS, transition } from "@/lib/publish/machine";
import { PUBLISHABLE_RULE, customerTold, publishableAndDue } from "@/lib/publish/publishable/rule";
import type { Actor, DraftView, GoverningPair } from "@/lib/publish/types";

const HOUR = 3_600_000;
const ENTERED = new Date("2026-09-01T10:00:00Z");
const DEADLINE = new Date(ENTERED.getTime() + 24 * HOUR);
const SYSTEM: Actor = { kind: "system", job: "publish/execute" };

function pair(over: Partial<GoverningPair> = {}): GoverningPair {
  return { mode: "autopilot", vetoHours: 24, publishTime: "09:00", timezone: "UTC", ...over };
}

function view(over: Partial<DraftView> = {}): DraftView {
  return {
    id: "d1",
    siteId: "s1",
    state: "in_review",
    vetoDeadline: DEADLINE,
    approvedAt: null,
    approvedBy: null,
    hasUnsavedEdit: false,
    claimRecheckOutstanding: false,
    told: null,
    governing: pair(),
    ...over,
  };
}

describe("`publishable_and_due` is publishable AND due", () => {
  it("a page that is publishable but whose publish time has not arrived is not due", () => {
    // The window expires at 10:00 on the 2nd; the next 09:00 is the 3rd.
    expect(publishableAndDue(view(), new Date("2026-09-02T11:00:00Z"))).toBe(false);
    expect(publishableAndDue(view(), new Date("2026-09-03T08:59:00Z"))).toBe(false);
  });

  it("at the publish time it is due, and stays due afterwards", () => {
    expect(publishableAndDue(view(), new Date("2026-09-03T09:00:00Z"))).toBe(true);
    expect(publishableAndDue(view(), new Date("2026-09-10T09:00:00Z"))).toBe(true);
  });

  it("a page that is not publishable is never due, however late the clock", () => {
    const copilot = view({ governing: pair({ mode: "copilot" }) });
    expect(publishableAndDue(copilot, new Date("2027-01-01T00:00:00Z"))).toBe(false);
  });
});

describe("`customer_told` holds a page that was never told and one told on a pair that has changed", () => {
  it("never told is false", () => {
    expect(customerTold(view({ told: null }))).toBe(false);
  });

  it("told on the pair now in force is true", () => {
    expect(
      customerTold(
        view({ told: { pair: pair(), kind: "interval", publishesAt: null, sentAt: "x" } })
      )
    ).toBe(true);
  });

  it("told on a pair that has since changed is false", () => {
    expect(
      customerTold(
        view({
          told: { pair: pair({ vetoHours: 72 }), kind: "interval", publishesAt: null, sentAt: "x" },
        })
      )
    ).toBe(false);
  });
});

describe("the seam is filled — the machine's default deps carry this rule", () => {
  it("`DEFAULT_GUARD_DEPS.rule` is the real rule, not the refusing one", () => {
    expect(DEFAULT_GUARD_DEPS.rule).toBe(PUBLISHABLE_RULE);
    // The refusing default answered `false` unconditionally; this one does
    // not, which is the whole difference this issue makes.
    expect(
      DEFAULT_GUARD_DEPS.rule.becomesPublishable(view(), new Date("2026-09-03T09:00:00Z"))
    ).toBe(true);
  });

  it("with the real rule wired, `approved → publishing` is refused for a page nobody was told about", async () => {
    seedDraft("approved", {
      approved_at: "2026-09-01T09:00:00.000Z",
      told: null,
      publishing_enabled: true,
    });
    const result = await transition("d1", "publishing", SYSTEM, {
      at: new Date("2026-09-03T09:00:00Z"),
    });
    expect(result).toMatchObject({ refused: "guard", failedGuard: "customer_told" });
    expect(db.rows("drafts")[0]?.state).toBe("approved");
  });

  it("and taken once the customer has been told on the pair in force", async () => {
    seedDraft("approved", {
      approved_at: "2026-09-01T09:00:00.000Z",
      told: { pair: pair(), kind: "interval", publishesAt: null, sentAt: "x" },
    });
    const result = await transition("d1", "publishing", SYSTEM, {
      at: new Date("2026-09-03T09:00:00Z"),
    });
    expect(result).toEqual({ ok: true, state: "publishing" });
  });

  it("a page whose site has no stated zone is held at `publishable_and_due` — never published in a zone nobody chose", async () => {
    seedDraft("approved", {
      approved_at: "2026-09-01T09:00:00.000Z",
      told: { pair: pair({ timezone: null }), kind: "interval", publishesAt: null, sentAt: "x" },
      timezone: null,
    });
    const result = await transition("d1", "publishing", SYSTEM, {
      at: new Date("2026-09-03T09:00:00Z"),
    });
    expect(result).toMatchObject({ refused: "guard", failedGuard: "publishable_and_due" });
  });
});

function seedDraft(state: string, over: Row = {}): void {
  const { timezone = "UTC", publishing_enabled = true, ...draft } = over;
  db.reset();
  installTransitionRpc(db);
  db.seed("sites", [
    {
      id: "s1",
      mode: "autopilot",
      veto_hours: 24,
      publish_time: "09:00:00",
      timezone,
      publishing_enabled,
    },
  ]);
  db.seed("destinations", [{ id: "dest-1", site_id: "s1", kind: "hosted", health: "ok", config: {} }]);
  db.seed("publications", []);
  db.seed("drafts", [
    {
      id: "d1",
      site_id: "s1",
      state,
      veto_deadline: DEADLINE.toISOString(),
      approved_at: null,
      approved_by: null,
      told: null,
      transitions: [],
      hard_rules_passed: true,
      publishable_since: null,
      ...draft,
    },
  ]);
}

beforeEach(() => seedDraft("approved"));
