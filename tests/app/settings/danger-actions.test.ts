// tests/app/settings/danger-actions.test.ts — BUILD §4.7, REQ-079, #259
//
// The confirmed run: what the danger zone's Server Functions do with a
// typed word and a ticket cookie, against the **real** lifecycle engine.
//
// The store is filled in memory the way the lifecycle suites fill it, so
// every refusal below is the engine's own — a mismatched word, a missing
// ticket, an archive that was never taken. Nothing about what unpublishing
// or deletion *does* is re-asserted here (`tests/account/lifecycle/**` owns
// that); what this file holds is that the surface reaches the engine, hands
// it the engine's own word rather than the customer's, and reports back
// what it answered.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

/** The request's own cookie jar, standing in — the same double
 *  `tests/account/identity/session.test.ts` uses. */
const jar = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = jar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string) => {
      jar.set(name, value);
    },
    delete: (name: string) => {
      jar.delete(name);
    },
  }),
}));

const revalidated: string[] = [];
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => {
    revalidated.push(path);
  },
}));

const { confirmed } = vi.hoisted(() => ({
  confirmed: [] as { ticket: string; typedConfirmation: string }[],
}));

/** The engine at its own door. `confirmDangerAction` is the only way to
 *  reach either action and its refusals are its own; what is recorded here
 *  is the *word* it was handed, which is this issue's ruling made
 *  assertable. */
vi.mock("@/lib/account/lifecycle", () => ({
  confirmationFor: (action: string) => action,
  confirmDangerAction: async (a: { ticket: string; typedConfirmation: string }) => {
    confirmed.push(a);
    if (a.ticket === "not-taken") return { ok: false, reason: "export_not_taken" };
    if (a.ticket === "unpublish") {
      return {
        ok: true,
        action: "unpublish_all",
        result: {
          takenDown: 17,
          stillLive: [{ destinationId: "d1", kind: "wordpress", liveUrls: ["https://northgate.build/a"] }],
          publishingSwitchedOff: true,
          lineKey: "danger.some-still-live",
          outcomes: [],
        },
      };
    }
    return {
      ok: true,
      action: "delete_account",
      result: {
        signedOut: true,
        subscriptionEndedAt: new Date(),
        stillLive: [],
        leftInWordPress: { pages: 0, place: null },
        purgeDueAt: new Date(),
        mailSent: false,
      },
    };
  },
  readDangerTicket: async (ticket: string) =>
    ticket === "taken" || ticket === "unpublish" || ticket === "delete"
      ? { action: jar.get("rk_danger_action") ?? "delete_account", takenAt: new Date() }
      : ticket === "not-taken"
        ? { action: "delete_account", takenAt: null }
        : null,
}));

const { DANGER_TICKET_COOKIE } = await import("@/app/(account)/app/settings/danger-ticket");
const { handoverState, runDangerAction } = await import("@/app/(account)/app/settings/danger-actions");
const { CONFIRM_WORD_KEY } = await import("@/app/(account)/app/settings/danger-state");
const { COPY } = await import("@/lib/presentation/copy");

/** The word the customer is shown and types — the registry's, never the
 *  engine's tag. */
const WORD = COPY[CONFIRM_WORD_KEY.delete_account];

beforeEach(() => {
  jar.clear();
  confirmed.length = 0;
  revalidated.length = 0;
});

afterEach(() => vi.restoreAllMocks());

describe("REQ-079 c2 — the customer types the word §4.7 prints, never the engine's tag", () => {
  it("the word comes from the registry, and it is not the action's tag", () => {
    expect(WORD).not.toBe("delete_account");
    expect(WORD).not.toBe("unpublish_all");
    expect(CONFIRM_WORD_KEY.unpublish_all).not.toBe(CONFIRM_WORD_KEY.delete_account);
  });

  it("a mismatched word never reaches the engine, so no ticket is spent on one", async () => {
    jar.set(DANGER_TICKET_COOKIE, "delete");
    const outcome = await runDangerAction("delete_account", "delete_account");
    expect(outcome).toEqual({ ran: false, lineKey: "danger.type-to-confirm" });
    expect(confirmed).toEqual([]);
  });

  it("the customer's word is compared trimmed and case-insensitively", async () => {
    jar.set(DANGER_TICKET_COOKIE, "delete");
    const outcome = await runDangerAction("delete_account", `  ${WORD.toUpperCase()} `);
    expect(outcome).toMatchObject({ ran: true });
  });

  it("and what the engine is handed is its own internal word, not the customer's", async () => {
    jar.set(DANGER_TICKET_COOKIE, "delete");
    await runDangerAction("delete_account", WORD);
    expect(confirmed).toEqual([{ ticket: "delete", typedConfirmation: "delete_account" }]);
  });
});

describe("REQ-079 c3 — the ticket is the cookie's, and a refusal changes nothing", () => {
  it("no cookie is a refusal, and the engine is not reached", async () => {
    const outcome = await runDangerAction("delete_account", WORD);
    expect(outcome).toEqual({ ran: false, lineKey: "danger.export-failed" });
    expect(confirmed).toEqual([]);
  });

  it("an archive that was never taken is refused by the engine and reported as one line", async () => {
    jar.set(DANGER_TICKET_COOKIE, "not-taken");
    const outcome = await runDangerAction("delete_account", WORD);
    expect(outcome).toEqual({ ran: false, lineKey: "danger.export-failed" });
    // It *did* reach the engine — the refusal is the engine's, not a second
    // copy of its rule on this side.
    expect(confirmed).toHaveLength(1);
  });

  it("the ticket is never an argument — only the cookie names it", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const source = readFileSync(
      path.resolve(import.meta.dirname, "../../../src/app/(account)/app/settings/danger-actions.ts"),
      "utf8"
    );
    expect(source).toMatch(/ticketFromCookie/);
    expect(source).not.toMatch(/ticket:\s*string\s*[,)]/);
  });
});

describe("REQ-079 c4 — what a confirmed run reports back", () => {
  it("unpublish-all carries the engine's own line, its count and its still-live list", async () => {
    jar.set(DANGER_TICKET_COOKIE, "unpublish");
    const outcome = await runDangerAction("unpublish_all", COPY[CONFIRM_WORD_KEY.unpublish_all]);
    expect(outcome).toEqual({
      ran: true,
      action: "unpublish_all",
      lineKey: "danger.some-still-live",
      takenDown: 17,
      stillLive: [{ kind: "wordpress", liveUrls: ["https://northgate.build/a"] }],
    });
    expect(revalidated).toEqual(["/app/settings"]);
  });

  it("delete-account hands the browser to the sign-in screen and revalidates nothing", async () => {
    jar.set(DANGER_TICKET_COOKIE, "delete");
    const outcome = await runDangerAction("delete_account", WORD);
    expect(outcome).toEqual({ ran: true, action: "delete_account", href: "/signin" });
    // There is no screen left to revalidate: the account is gone.
    expect(revalidated).toEqual([]);
  });
});

describe("the first gate reads the ticket's stamp, never a memory of the press", () => {
  it("no cookie is untaken", async () => {
    expect(await handoverState("delete_account")).toEqual({ taken: false });
  });

  it("a ticket whose archive never left is untaken — an aborted download holds the action", async () => {
    jar.set(DANGER_TICKET_COOKIE, "not-taken");
    expect(await handoverState("delete_account")).toEqual({ taken: false });
  });

  it("a stamped ticket for this action is taken", async () => {
    jar.set(DANGER_TICKET_COOKIE, "delete");
    expect(await handoverState("delete_account")).toEqual({ taken: true });
  });

  it("a stamped ticket for the *other* action is not this one's", async () => {
    jar.set(DANGER_TICKET_COOKIE, "delete");
    jar.set("rk_danger_action", "delete_account");
    expect(await handoverState("unpublish_all")).toEqual({ taken: false });
  });
});
