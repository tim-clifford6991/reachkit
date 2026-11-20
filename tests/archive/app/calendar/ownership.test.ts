// tests/app/calendar/ownership.test.ts — BUILD §4.6, §9, issue #169
//
// The day panel's writes act as the signed-in customer, on that customer's
// own page, and refuse everything else.
//
// A Server Function is an addressable endpoint: the draft id arrives from
// the browser, and being signed in does not make an id the caller's. Until
// this issue these actions carried a fixture user id and asked the machine
// to move whatever id they were handed — so the two mutations this suite
// kills are a move recorded against the wrong account, and a move made on
// another account's page.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const transition = vi.fn();
const siteOwnsDraft = vi.fn();

vi.mock("@/lib/publish/machine", () => ({
  transition: (...a: unknown[]) => transition(...a),
}));

vi.mock("@/app/(account)/app/_session/store", () => ({
  siteOwnsDraft: (...a: unknown[]) => siteOwnsDraft(...a),
}));

// Issue #913: a write that landed asks the two screens that project their
// controls from the page's state to re-read. `revalidatePath` needs Next's
// own request store, which a unit test does not have, so the paths are
// collected here and asserted below.
const revalidated: string[] = [];
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => {
    revalidated.push(path);
  },
}));

const { LIVE_ACCOUNT, resetAccount, signedInAs, signedOut } = await import("../account-door");
const actions = await import("@/app/(account)/app/calendar/publishing-actions");

const COMMANDS = [
  ["skipDraft", "skipped"],
  ["vetoDraft", "skipped"],
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  revalidated.length = 0;
  signedInAs(LIVE_ACCOUNT);
  siteOwnsDraft.mockResolvedValue(true);
  transition.mockResolvedValue({ ok: true });
});

afterEach(() => {
  resetAccount();
});

describe("the actor is the signed-in customer, never a stand-in", () => {
  it.each(COMMANDS)("%s moves as the account that is signed in", async (name, to) => {
    await actions[name]("draft-1");
    expect(transition).toHaveBeenCalledWith("draft-1", to, {
      kind: "customer",
      userId: LIVE_ACCOUNT.userId,
    });
  });

  it("a second account's session moves as that account, not the first", async () => {
    const other = { ...LIVE_ACCOUNT, userId: "user-other", siteId: "site-other" };
    signedInAs(other);
    await actions.skipDraft("draft-1");
    expect(transition).toHaveBeenCalledWith("draft-1", "skipped", {
      kind: "customer",
      userId: "user-other",
    });
  });

  it("a transition is never anonymous: every call carries a customer actor", async () => {
    await actions.vetoDraft("draft-1");
    const actor = transition.mock.calls[0]?.[2] as { kind: string };
    expect(actor.kind).toBe("customer");
  });
});

describe("§9's machine is never asked to move another account's page", () => {
  it.each(COMMANDS)("%s refuses a draft this site does not own", async (name) => {
    siteOwnsDraft.mockResolvedValue(false);
    await expect(actions[name]("someone-elses-draft")).resolves.toBe("not_your_page");
  });

  it("and the machine is not called at all — the refusal is before it, not after", async () => {
    siteOwnsDraft.mockResolvedValue(false);
    await actions.skipDraft("someone-elses-draft");
    expect(transition).not.toHaveBeenCalled();
  });

  it("ownership is asked as the pair, against the signed-in account's own site", async () => {
    await actions.skipDraft("draft-1");
    expect(siteOwnsDraft).toHaveBeenCalledWith(LIVE_ACCOUNT.siteId, "draft-1");
  });

  it("a read that could not be made refuses rather than moving the page", async () => {
    // `siteOwnsDraft` answers `false` on a failed read (see its own header):
    // a write refused on a fact we could not establish costs one retry, and
    // the other direction moves somebody else's page.
    siteOwnsDraft.mockResolvedValue(false);
    await expect(actions.vetoDraft("draft-1")).resolves.toBe("not_your_page");
    expect(transition).not.toHaveBeenCalled();
  });
});

describe("the machine's own refusals still travel unchanged", () => {
  it("a guard's name comes back as the guard's name", async () => {
    transition.mockResolvedValue({ ok: false, refused: "guard", failedGuard: "destination_working" });
    await expect(actions.vetoDraft("draft-1")).resolves.toBe("destination_working");
  });

  it("a move outside the table comes back as `not_a_transition`, not as a guard", async () => {
    transition.mockResolvedValue({ ok: false, refused: "not_a_transition" });
    await expect(actions.skipDraft("draft-1")).resolves.toBe("not_a_transition");
  });

  it("an accepted move resolves as `null` — nothing to report", async () => {
    await expect(actions.skipDraft("draft-1")).resolves.toBeNull();
  });
});

describe("issue #913 — a page that moved is re-read by both screens that draw its state", () => {
  it("a write that landed revalidates the month and that page's own screen", async () => {
    await actions.vetoDraft("draft-1");
    expect(revalidated).toEqual(["/app/calendar", "/app/draft/draft-1"]);
  });

  it("a refused write revalidates nothing — nothing changed, so nothing is stale", async () => {
    transition.mockResolvedValue({ ok: false, refused: "not_a_transition" });
    await actions.skipDraft("draft-1");
    expect(revalidated).toEqual([]);
  });

  it("a draft this account does not own revalidates nothing either", async () => {
    siteOwnsDraft.mockResolvedValue(false);
    await actions.skipDraft("someone-elses-draft");
    expect(revalidated).toEqual([]);
  });
});

describe("a caller with no session moves nothing", () => {
  it("the refusal happens before the ownership read and before the machine", async () => {
    signedOut();
    await expect(actions.skipDraft("draft-1")).rejects.toThrow();
    expect(siteOwnsDraft).not.toHaveBeenCalled();
    expect(transition).not.toHaveBeenCalled();
  });
});
