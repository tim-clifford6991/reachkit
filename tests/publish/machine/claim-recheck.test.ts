// tests/publish/machine/claim-recheck.test.ts — BUILD §8 hard rule 4 ·
// REQ-053 c5, at the hand-off gate.
//
// REQ-053 criterion 5, verbatim: "no approval, schedule or retry can put a
// page carrying a forbidden claim on the customer's site."
//
// `src/lib/generate/claims/outstanding.ts` says in its own header that it
// "cannot compel its own call" — the promise is kept at the publishing
// engine's one gate, and "removing that call passes every test in that
// directory". This file is the test that does not pass when it is removed.
//
// **The predicate is the real one.** `claimRecheckOutstanding` and
// `outstandingMatch` are taken from `DEFAULT_GUARD_DEPS` and run against a
// seeded database, so what is asserted is the comparison of two hashes and
// not a stub agreeing with the test. Every other guard is opened, because
// a page held by something else would prove nothing about this one.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fakeDb, installTransitionRpc, type Row } from "../harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

import { DEFAULT_GUARD_DEPS, transition, type GuardDeps } from "@/lib/publish/machine";
import { claim } from "@/lib/publish/attempt/claim";
import { listHash } from "@/lib/generate/claims/hash";
import type { Actor, State } from "@/lib/publish/types";

const CUSTOMER: Actor = { kind: "customer", userId: "u1" };
const SYSTEM: Actor = { kind: "system", job: "publish/execute" };
const AT = new Date(Date.UTC(2026, 8, 15, 12, 0, 0));

/** The customer's own words. Never model output — that is the whole point
 *  of `outstandingMatch` returning the stored entry rather than a reason. */
const ENTRY = "HIPAA compliant";
const LIST = [ENTRY];

/** Every guard open **except** the claim re-check, which is the real
 *  predicate reading the seeded rows. */
function deps(over: Partial<GuardDeps> = {}): GuardDeps {
  return {
    claimRecheckOutstanding: DEFAULT_GUARD_DEPS.claimRecheckOutstanding,
    outstandingMatch: DEFAULT_GUARD_DEPS.outstandingMatch,
    reachKitStopped: async () => false,
    isPublishingOn: async () => true,
    hasCeilingRoom: async () => true,
    destinationWorking: async () => true,
    rule: { becomesPublishable: () => true, toldCurrentPair: () => true },
    ...over,
  };
}

function seed(state: State, claimCheck: unknown, over: Row = {}): void {
  db.reset();
  installTransitionRpc(db);
  db.seed("sites", [
    {
      id: "s1",
      mode: "autopilot",
      veto_hours: 24,
      publish_time: "09:00:00",
      timezone: "UTC",
      publishing_enabled: true,
      do_not_claim: LIST,
    },
  ]);
  db.seed("destinations", [{ id: "dest-1", site_id: "s1", kind: "hosted", health: "ok", config: {} }]);
  db.seed("drafts", [
    {
      id: "d1",
      site_id: "s1",
      state,
      transitions: [],
      hard_rules_passed: true,
      publishable_since: null,
      veto_deadline: null,
      approved_at: null,
      opportunity_id: "o1",
      claim_check: claimCheck,
      ...over,
    },
  ]);
  db.seed("publications", []);
}

/** A check that passed against a list the site no longer holds — the state
 *  REQ-053 c5 calls outstanding, reached the instant the customer saved a
 *  change to their list. */
const STALE = { state: "passed", listHash: listHash(["something else entirely"]), at: AT.toISOString() };
/** A check that passed against the list in force. */
const CURRENT = { state: "passed", listHash: listHash(LIST), at: AT.toISOString() };
/** A check that failed, naming the entry it matched. */
const FAILED = {
  state: "failed",
  listHash: listHash(LIST),
  at: AT.toISOString(),
  matchedEntry: ENTRY,
};

/**
 * REQ-053 c5's own list of occasions — "no approval, schedule or retry" —
 * as the five presses that reach a hand-off, with the edge each takes.
 *
 * Three edges and five occasions: `approved → publishing` is reached three
 * different ways, and a test that drove the edge once would not have shown
 * that the veto expiring, the customer approving and the publish time
 * arriving are all held.
 */
const OCCASIONS: readonly { occasion: string; from: State; by: Actor; over?: Row }[] = [
  {
    occasion: "the veto window expires under autopilot",
    from: "approved",
    by: SYSTEM,
    over: { veto_deadline: "2026-09-14T09:00:00.000Z" },
  },
  {
    occasion: "the customer approves the page explicitly",
    from: "approved",
    by: CUSTOMER,
    over: { approved_at: "2026-09-14T09:00:00.000Z" },
  },
  { occasion: "the publish time arrives", from: "approved", by: SYSTEM },
  { occasion: "an automatic retry of a failed attempt", from: "failed", by: SYSTEM },
  { occasion: "the customer restarts a page that needs attention", from: "needs_attention", by: CUSTOMER },
];

beforeEach(() => {
  seed("approved", STALE);
});

describe("REQ-053 c5 — a page with a stale list hash is not handed over, on any of the five occasions", () => {
  it.each(OCCASIONS)("$occasion", async ({ from, by, over }) => {
    seed(from, STALE, over ?? {});
    const result = await transition("d1", "publishing", by, { at: AT, deps: deps() });
    expect(result).toMatchObject({
      ok: false,
      refused: "guard",
      failedGuard: "no_outstanding_claim_recheck",
      state: from,
    });
    // A hold, not a move: the page keeps the state it had and nothing was
    // appended, because `transition()` returns before the RPC.
    expect(db.rows("drafts")[0]?.state).toBe(from);
    expect(db.rows("drafts")[0]?.transitions).toEqual([]);
    expect(db.rpcCalls).toHaveLength(0);
  });

  it("the same five occasions hand the page over once a check has passed against the list in force", async () => {
    for (const { occasion, from, by, over } of OCCASIONS) {
      seed(from, CURRENT, over ?? {});
      const result = await transition("d1", "publishing", by, { at: AT, deps: deps() });
      expect(result, occasion).toEqual({ ok: true, state: "publishing" });
    }
  });
});

describe("the guard is the real predicate, not a literal", () => {
  it("a draft that never recorded a check is outstanding — the safe direction", async () => {
    seed("approved", null);
    const result = await transition("d1", "publishing", SYSTEM, { at: AT, deps: deps() });
    expect(result).toMatchObject({ failedGuard: "no_outstanding_claim_recheck" });
  });

  it("a check whose stored shape this build does not recognise is outstanding too", async () => {
    seed("approved", { state: "passed" });
    const result = await transition("d1", "publishing", SYSTEM, { at: AT, deps: deps() });
    expect(result).toMatchObject({ failedGuard: "no_outstanding_claim_recheck" });
  });

  it("re-ordering and re-casing the customer's list does not hold a page — the hash is normalised", async () => {
    seed("approved", CURRENT);
    db.rows("sites")[0]!.do_not_claim = ["  hipaa   COMPLIANT  "];
    const result = await transition("d1", "publishing", SYSTEM, { at: AT, deps: deps() });
    expect(result).toEqual({ ok: true, state: "publishing" });
  });

  it("adding an entry holds every page waiting, with no job run and nothing written", async () => {
    seed("approved", CURRENT);
    db.rows("sites")[0]!.do_not_claim = [ENTRY, "FDA approved"];
    const result = await transition("d1", "publishing", SYSTEM, { at: AT, deps: deps() });
    expect(result).toMatchObject({ failedGuard: "no_outstanding_claim_recheck" });
    expect(db.rpcCalls).toHaveLength(0);
  });
});

describe("a held page names the entry it matched, in the customer's own words", () => {
  it("a failed check names its entry on the refusal", async () => {
    seed("approved", FAILED);
    const result = await transition("d1", "publishing", SYSTEM, { at: AT, deps: deps() });
    expect(result).toMatchObject({
      failedGuard: "no_outstanding_claim_recheck",
      matchedEntry: ENTRY,
    });
    // The customer's own words, not a reason code and not model output.
    expect(db.rows("sites")[0]?.do_not_claim).toContain(ENTRY);
  });

  it("a stale hash names nothing — no entry has been matched yet", async () => {
    seed("approved", STALE);
    const result = await transition("d1", "publishing", SYSTEM, { at: AT, deps: deps() });
    expect(result).toMatchObject({ failedGuard: "no_outstanding_claim_recheck" });
    expect(result).not.toHaveProperty("matchedEntry");
  });

  it("the entry never reaches the log line, which carries ids and closed-union names only", async () => {
    seed("approved", FAILED);
    const lines: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((line: unknown) => {
      lines.push(String(line));
    });
    await transition("d1", "publishing", SYSTEM, { at: AT, deps: deps() });
    spy.mockRestore();
    expect(lines.join("\n")).toContain("no_outstanding_claim_recheck");
    expect(lines.join("\n")).not.toContain(ENTRY);
  });
});

describe("the attempt path reports the hold as its own word", () => {
  it("`claim()` holds at `claim_recheck` and writes no publication", async () => {
    seed("approved", FAILED);
    const result = await claim({ draftId: "d1", destination: "hosted", by: SYSTEM, at: AT, deps: deps() });
    expect(result).toEqual({
      ok: false,
      reason: "held",
      heldBy: "claim_recheck",
      matchedEntry: ENTRY,
    });
    // ADR-080's row is written *before* the destination call, so a hold
    // that let one be written would be a post this page must never get.
    expect(db.rows("publications")).toHaveLength(0);
    expect(db.rows("drafts")[0]?.state).toBe("approved");
  });

  it("a stale hash holds at the same word and names nothing", async () => {
    seed("approved", STALE);
    const result = await claim({ draftId: "d1", destination: "hosted", by: SYSTEM, at: AT, deps: deps() });
    expect(result).toEqual({ ok: false, reason: "held", heldBy: "claim_recheck" });
  });

  it("a passing check lets the claim through — the hold is the guard's, not the claim's", async () => {
    seed("approved", CURRENT);
    const result = await claim({ draftId: "d1", destination: "hosted", by: SYSTEM, at: AT, deps: deps() });
    expect(result).toMatchObject({ ok: true, attemptNo: 1 });
  });
});

// ── REQ-053 c5's timeliness half ───────────────────────────────────────────
describe("a settings write that changes `sites.do_not_claim` calls `sweepOutstandingRechecks`", () => {
  /** Every `.ts`/`.tsx` under `src/`, as text. */
  function sources(): { file: string; text: string }[] {
    const root = path.resolve(import.meta.dirname, "../../../");
    const out: { file: string; text: string }[] = [];
    (function walk(dir: string): void {
      for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry)) {
          out.push({
            file: path.relative(root, full).split(path.sep).join("/"),
            text: readFileSync(full, "utf8"),
          });
        }
      }
    })(path.join(root, "src"));
    return out;
  }

  it("no file under `src/` writes the list, so there is no write that could skip the sweep", () => {
    // The obligation is discharged by there being no writer: `applySettings`
    // and `POST /api/settings` are issue #42's and are not on disk, and
    // `savePublishingSettings` writes the four publishing settings and
    // nothing else. This is the assertion that fails the day one appears —
    // which is the day the sweep call has to be added beside it.
    const writers = sources().filter(({ text }) =>
      /(update|upsert|insert)[\s\S]{0,400}?do_not_claim/.test(text)
    );
    expect(writers.map((w) => w.file)).toEqual([]);
  });

  it("`savePublishingSettings` — the one `sites` writer that exists — names no claim list", () => {
    const save = sources().find((s) => s.file === "src/lib/publish/settings/save.ts");
    expect(save).toBeDefined();
    expect(save?.text).not.toContain("do_not_claim");
  });

  it("the sweep is exported and ready for that writer", async () => {
    // Timeliness only: the guard already holds every page from the instant
    // the list changes, because outstanding-ness is derived from the two
    // hashes rather than from anything the sweep writes. The sweep clears
    // the hold sooner; it is not what creates it.
    const generate = await import("@/lib/generate");
    expect(typeof generate.sweepOutstandingRechecks).toBe("function");
  });
});
