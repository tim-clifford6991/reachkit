// tests/publish/publishable/telling.test.ts — REQ-057 c1, c7, c8, c9.
//
// The occasion and the payload, never a sentence: every assertion about
// what the customer reads is on a `CopyKey`. No fixture in this file
// contains a sentence.
//
// The archived plan is WO-216.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fakeDb, type Row } from "../harness";
import type { DestinationAdapter, DestinationKind } from "@/lib/publish/types";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

/** The registry, driven by the test: three adapter kinds, including a
 *  hypothetical third that serves publicly and is **not** hosted by us —
 *  the one that makes a `kind === 'wordpress'` check fail. */
const adapters = new Map<string, Pick<DestinationAdapter, "hostedByUs" | "servesPublicly">>();
vi.mock("@/lib/publish/destinations", async () => {
  const actual = await vi.importActual<typeof import("@/lib/publish/destinations")>(
    "@/lib/publish/destinations"
  );
  return {
    ...actual,
    adapterFor: (kind: string) => adapters.get(kind) ?? null,
  };
});

import {
  isUnsuppressible,
  kindOf,
  recordTold,
  tellingFor,
  toldCurrentPair,
  type Telling,
} from "@/lib/publish/publishable/telling";
import type { DraftView, GoverningPair } from "@/lib/publish/types";

const HOUR = 3_600_000;
const ENTERED = new Date("2026-09-01T10:00:00Z");
const DEADLINE = new Date(ENTERED.getTime() + 24 * HOUR);

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

function seedDestination(kind: DestinationKind | "ftp", health: string, over: Row = {}): void {
  db.reset();
  db.seed("destinations", [
    {
      id: "dest-1",
      site_id: "s1",
      kind,
      health,
      config: { siteUrl: "https://example.com" },
      ...over,
    },
  ]);
  db.seed("drafts", [{ id: "d1", site_id: "s1", state: "in_review", told: null }]);
}

beforeEach(() => {
  adapters.clear();
  adapters.set("hosted", { hostedByUs: true, servesPublicly: true });
  adapters.set("wordpress", { hostedByUs: false, servesPublicly: true });
  // The hypothetical third: serves publicly, not hosted by us, not
  // WordPress. A clause decided from `kind === 'wordpress'` gets this wrong.
  adapters.set("ftp", { hostedByUs: false, servesPublicly: true });
  seedDestination("hosted", "ok");
});

describe('REQ-057 c1 / c7 — the three kinds come from the governing pair alone', () => {
  it("autopilot above zero is `interval`, autopilot at zero is `no_interval`, copilot at any window is `approval_only`", () => {
    expect(kindOf(pair({ mode: "autopilot", vetoHours: 24 }))).toBe("interval");
    expect(kindOf(pair({ mode: "autopilot", vetoHours: 0 }))).toBe("no_interval");
    expect(kindOf(pair({ mode: "copilot", vetoHours: 0 }))).toBe("approval_only");
    expect(kindOf(pair({ mode: "copilot", vetoHours: 168 }))).toBe("approval_only");
  });

  it("the interval telling names the publish moment, the stop action and its own key", async () => {
    const t = await tellingFor({
      draft: view(),
      destination: "hosted",
      stopAction: { token: "tok", expiresAt: DEADLINE },
    });
    expect(t.kind).toBe("interval");
    if (t.kind !== "interval") return;
    expect(t.copy).toBe("mail.draftReady.autopilotWindow");
    expect(t.publishesAt.toISOString()).toBe("2026-09-03T09:00:00.000Z");
    expect(t.stopAction.token).toBe("tok");
  });

  it("the copilot telling names no publish moment and no stop action — nothing happens until they approve", async () => {
    const t = await tellingFor({ draft: view({ governing: pair({ mode: "copilot" }) }), destination: "hosted" });
    expect(t).toEqual({ kind: "approval_only", destination: null, copy: "mail.draftReady.copilot" });
  });

  it("switching the draft-ready mail off changes neither the interval nor the draft in review", async () => {
    // The suppression flag lives on the send, not on the draft: nothing in
    // the telling reads it, so the window and the state are untouched.
    const draft = view();
    const t = await tellingFor({ draft, destination: "hosted" });
    expect(draft.vetoDeadline).toEqual(DEADLINE);
    expect(draft.state).toBe("in_review");
    expect(t.kind).toBe("interval");
  });
});

describe('REQ-057 c7 — "no notification setting suppresses it and it carries no unsubscribe link"', () => {
  it("`isUnsuppressible` is true for the zero-window telling and false for every other kind", async () => {
    const zero = await tellingFor({
      draft: view({ vetoDeadline: ENTERED, governing: pair({ vetoHours: 0 }) }),
      destination: "hosted",
    });
    expect(zero.kind).toBe("no_interval");
    expect(isUnsuppressible(zero)).toBe(true);

    const interval = await tellingFor({ draft: view(), destination: "hosted" });
    const copilot = await tellingFor({
      draft: view({ governing: pair({ mode: "copilot" }) }),
      destination: "hosted",
    });
    expect(isUnsuppressible(interval)).toBe(false);
    expect(isUnsuppressible(copilot)).toBe(false);
  });

  it("the zero-window telling offers no stop action, because no interval exists in which one could be used", async () => {
    const zero = await tellingFor({
      draft: view({ vetoDeadline: ENTERED, governing: pair({ vetoHours: 0 }) }),
      destination: "hosted",
    });
    expect(zero).not.toHaveProperty("stopAction");
    expect(zero.kind === "no_interval" && zero.copy).toBe("mail.draftReady.autopilotZero");
  });

  it("each of those holds whether this is the first telling or a further one criterion 8 requires", async () => {
    const alreadyTold = view({
      vetoDeadline: ENTERED,
      governing: pair({ vetoHours: 0 }),
      told: {
        pair: pair({ vetoHours: 24 }),
        kind: "interval",
        publishesAt: null,
        sentAt: ENTERED.toISOString(),
      },
    });
    const t = await tellingFor({ draft: alreadyTold, destination: "hosted" });
    expect(isUnsuppressible(t)).toBe(true);
    expect(t).not.toHaveProperty("stopAction");
  });
});

describe('REQ-057 c8 — "no page publishes on a pair the customer was never told about"', () => {
  it("a draft with no record is `never_told`", () => {
    expect(toldCurrentPair(view({ told: null }))).toEqual({ told: false, because: "never_told" });
  });

  it.each([
    ["mode", pair({ mode: "copilot" })],
    ["vetoHours", pair({ vetoHours: 72 })],
    ["publishTime", pair({ publishTime: "17:00" })],
    ["timezone", pair({ timezone: "Asia/Tokyo" })],
  ])("a change to %s alone re-opens the obligation", (_field, changed) => {
    const draft = view({
      governing: pair(),
      told: { pair: changed, kind: "interval", publishesAt: null, sentAt: ENTERED.toISOString() },
    });
    expect(toldCurrentPair(draft)).toEqual({ told: false, because: "pair_changed" });
  });

  it("a record on the pair now in force closes it", () => {
    const draft = view({
      told: { pair: pair(), kind: "interval", publishesAt: null, sentAt: ENTERED.toISOString() },
    });
    expect(toldCurrentPair(draft)).toEqual({ told: true });
  });

  it("`recordTold` writes the pair, the kind and the moment named — and closes the obligation", async () => {
    const t: Telling = {
      kind: "interval",
      publishesAt: new Date("2026-09-03T09:00:00Z"),
      stopAction: { token: "tok", expiresAt: DEADLINE },
      destination: null,
      copy: "mail.draftReady.autopilotWindow",
    };
    await recordTold("d1", t, pair(), new Date("2026-09-02T08:00:00Z"));
    const written = db.rows("drafts")[0]?.told as Record<string, unknown>;
    expect(written.pair).toEqual(pair());
    expect(written.kind).toBe("interval");
    expect(written.publishesAt).toBe("2026-09-03T09:00:00.000Z");
    expect(written.sentAt).toBe("2026-09-02T08:00:00.000Z");
    expect(toldCurrentPair(view({ told: written as never }))).toEqual({ told: true });
  });

  it("a destination health flap does not re-open the telling — the clause is not in the pair", async () => {
    const told = {
      pair: pair(),
      kind: "interval" as const,
      publishesAt: null,
      sentAt: ENTERED.toISOString(),
    };
    seedDestination("wordpress", "ok");
    expect(toldCurrentPair(view({ told }))).toEqual({ told: true });
    seedDestination("wordpress", "error");
    expect(toldCurrentPair(view({ told }))).toEqual({ told: true });
  });
});

describe('REQ-057 c9 — the destination clause', () => {
  it("a destination ReachKit serves carries no clause", async () => {
    seedDestination("hosted", "ok");
    const t = await tellingFor({ draft: view(), destination: "hosted" });
    expect(t.kind === "interval" && t.destination).toBeNull();
  });

  it("a page bound for the customer's own site carries one — decided from `hostedByUs`, over three adapter kinds", async () => {
    for (const kind of ["wordpress", "ftp"] as const) {
      seedDestination(kind, "ok");
      const t = await tellingFor({ draft: view(), destination: kind as DestinationKind });
      expect(t.kind === "interval" && t.destination?.says, kind).toBe("goes_live_there");
      expect(t.kind === "interval" && t.destination?.site, kind).toBe("https://example.com");
    }
    seedDestination("hosted", "ok");
    const hosted = await tellingFor({ draft: view(), destination: "hosted" });
    expect(hosted.kind === "interval" && hosted.destination).toBeNull();
  });

  it("the module never tests the destination's kind — a kind check would pass every test that exists today", () => {
    // Comments are stripped first: the module's own header explains why a
    // kind check is wrong and quotes the check it must not make. The
    // assertion is about the code.
    const source = readFileSync("src/lib/publish/publishable/telling.ts", "utf8")
      .split("\n")
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join("\n");
    expect(source).not.toMatch(/["']wordpress["']/);
    expect(source).toContain("hostedByUs");
  });

  it("the clause matches the telling's kind", async () => {
    seedDestination("wordpress", "ok");
    const interval = await tellingFor({ draft: view(), destination: "wordpress" });
    expect(interval.kind === "interval" && interval.destination?.copy).toBe(
      "mail.draftReady.dest.goesLiveThen"
    );

    const zero = await tellingFor({
      draft: view({ vetoDeadline: ENTERED, governing: pair({ vetoHours: 0 }) }),
      destination: "wordpress",
    });
    expect(zero.kind === "no_interval" && zero.destination?.copy).toBe(
      "mail.draftReady.dest.goesLiveAtOnce"
    );

    const copilot = await tellingFor({
      draft: view({ governing: pair({ mode: "copilot" }) }),
      destination: "wordpress",
    });
    expect(copilot.kind === "approval_only" && copilot.destination?.copy).toBe(
      "mail.draftReady.dest.goesLiveOnApproval"
    );
  });

  it("where the site cannot be published to at compose time, the clause says so instead", async () => {
    for (const health of ["error", "expired"] as const) {
      seedDestination("wordpress", health);
      const t = await tellingFor({ draft: view(), destination: "wordpress" });
      expect(t.kind === "interval" && t.destination, health).toEqual({
        says: "cannot_go_live_there",
        site: "https://example.com",
        copy: "mail.draftReady.dest.cannotPublish",
      });
    }
  });

  it("and it changes nothing else — the date, the interval, the stop action and the unsuppressibility are byte-identical to the healthy fixture", async () => {
    const stopAction = { token: "tok", expiresAt: DEADLINE };

    seedDestination("wordpress", "ok");
    const healthy = await tellingFor({ draft: view(), destination: "wordpress", stopAction });
    seedDestination("wordpress", "error");
    const broken = await tellingFor({ draft: view(), destination: "wordpress", stopAction });

    expect(healthy.kind).toBe(broken.kind);
    expect(healthy.kind === "interval" && healthy.publishesAt.toISOString()).toBe(
      broken.kind === "interval" && broken.publishesAt.toISOString()
    );
    expect(healthy.kind === "interval" && healthy.stopAction).toEqual(
      broken.kind === "interval" && broken.stopAction
    );
    expect(healthy.kind === "interval" && healthy.copy).toBe(broken.kind === "interval" && broken.copy);

    const zeroDraft = view({ vetoDeadline: ENTERED, governing: pair({ vetoHours: 0 }) });
    seedDestination("wordpress", "ok");
    const zeroHealthy = await tellingFor({ draft: zeroDraft, destination: "wordpress" });
    seedDestination("wordpress", "error");
    const zeroBroken = await tellingFor({ draft: zeroDraft, destination: "wordpress" });
    expect(isUnsuppressible(zeroHealthy)).toBe(true);
    expect(isUnsuppressible(zeroBroken)).toBe(true);
  });

  it("a destination this build has no adapter for carries no clause — nothing is asserted about a site nothing can answer for", async () => {
    adapters.clear();
    seedDestination("wordpress", "ok");
    const t = await tellingFor({ draft: view(), destination: "wordpress" });
    expect(t.kind === "interval" && t.destination).toBeNull();
  });
});

describe("the module writes no sentence", () => {
  it("every copy value it names is a key, and no fixture in this file is a sentence", async () => {
    seedDestination("wordpress", "error");
    const t = await tellingFor({ draft: view(), destination: "wordpress" });
    const keys = [
      t.kind !== "not_yet_tellable" ? t.copy : "",
      t.kind !== "not_yet_tellable" ? (t.destination?.copy ?? "") : "",
    ].filter((key) => key.length > 0);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) expect(key).not.toMatch(/\s/);
  });
});

describe("a site with no stated zone has no moment to name", () => {
  it("the telling is `not_yet_tellable`, so no mail is composed around a date nobody could compute", async () => {
    const t = await tellingFor({
      draft: view({ governing: pair({ timezone: null }) }),
      destination: "hosted",
    });
    expect(t).toEqual({ kind: "not_yet_tellable", because: "zone_not_set" });
    expect(isUnsuppressible(t)).toBe(false);
  });

  it("`recordTold` writes nothing for it — an obligation cannot be closed by a telling that was never composable", async () => {
    await recordTold("d1", { kind: "not_yet_tellable", because: "zone_not_set" }, pair());
    expect(db.rows("drafts")[0]?.told).toBeNull();
  });
});
