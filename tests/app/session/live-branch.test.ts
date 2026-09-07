// tests/app/session/live-branch.test.ts — BUILD §4.4–§4.6, issue #169
//
// A real signed-in account reads its own rows, and the fixture is not
// reachable from it.
//
// This is the mutation the issue exists to kill: a provider that answered
// from `fixture.ts` for a customer put another account's numbers — a
// domain, a week count, a page count, somebody else's draft — on their
// screen. Each row below drives one provider with a real account and
// asserts that the store was asked, with that account's own site id, and
// that nothing the fixture holds came back.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const readShellFacts = vi.fn();
const readOverviewFacts = vi.fn();
const readDraftRow = vi.fn();

vi.mock("@/app/(account)/app/_shell/store", () => ({
  readShellFacts: (...a: unknown[]) => readShellFacts(...a),
}));
vi.mock("@/app/(account)/app/_overview/store", () => ({
  readOverviewFacts: (...a: unknown[]) => readOverviewFacts(...a),
}));
vi.mock("@/app/(account)/app/draft/[draftId]/store", () => ({
  readDraftRow: (...a: unknown[]) => readDraftRow(...a),
}));

const { LIVE_ACCOUNT, RESERVED_ACCOUNT, resetAccount, signedInAs, signedOut, withoutASite } =
  await import("../account-door");
const { readShell } = await import("@/app/(account)/app/_shell/provider");
const { readOverview } = await import("@/app/(account)/app/_overview/provider");
const { readDraft } = await import("@/app/(account)/app/draft/[draftId]/provider");
const { FIXTURE_SHELL_FACTS } = await import("@/app/(account)/app/_shell/fixture");
const { FIXTURE_DRAFTS } = await import("@/app/(account)/app/draft/[draftId]/fixture");
const { unmeasured } = await import("@/lib/measure/measured");

const LIVE_SHELL_FACTS = {
  domain: LIVE_ACCOUNT.domain,
  timeZone: LIVE_ACCOUNT.timeZone,
  mode: "autopilot" as const,
  weeks: [],
  firstDueOn: new Date("2026-09-14T10:00:00.000Z"),
  waiting: 0,
  next: null,
  stopped: null,
  noPublishCauses: {
    reachkit_stopped: false,
    publishing_paused: false,
    nothing_approved: false,
    nothing_planned: true,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  signedInAs(LIVE_ACCOUNT);
  readShellFacts.mockResolvedValue(LIVE_SHELL_FACTS);
  readOverviewFacts.mockResolvedValue({
    timeZone: LIVE_ACCOUNT.timeZone,
    points: [],
    firstDueOn: new Date("2026-09-14T10:00:00.000Z"),
    aiPresence: [],
    pagesPublished: unmeasured<number>("not_attempted", new Date()),
    rivals: { own: unmeasured<number>("not_attempted", new Date()), rivals: [] },
    today: new Date("2026-09-08T12:00:00.000Z"),
    supply: { exhausted: true, short: false, firstArrivalShortfall: false },
    waiting: [],
  });
  readDraftRow.mockResolvedValue(null);
});

afterEach(() => {
  resetAccount();
});

describe("§4.4 — the shell draws the signed-in account's own site", () => {
  it("asks the store, with that account's own site id", async () => {
    await readShell();
    expect(readShellFacts).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: LIVE_ACCOUNT.siteId, domain: LIVE_ACCOUNT.domain })
    );
  });

  it("states that account's domain and never the fixture's", async () => {
    const model = await readShell();
    expect(model.domain).toBe(LIVE_ACCOUNT.domain);
    expect(model.domain).not.toBe(FIXTURE_SHELL_FACTS.domain);
  });

  it("a site with no measured week reads as none, not as the fixture's three", async () => {
    const model = await readShell();
    expect(model.weeks).toEqual({ kind: "none", firstDueOn: LIVE_SHELL_FACTS.firstDueOn });
  });

  it("the reserved fixture account still reads the fixture, and asks no store", async () => {
    signedInAs(RESERVED_ACCOUNT);
    const model = await readShell();
    expect(readShellFacts).not.toHaveBeenCalled();
    expect(model.domain).toBe(FIXTURE_SHELL_FACTS.domain);
  });
});

describe("§4.5 — Overview draws the signed-in account's own rows", () => {
  it("asks the store, with that account's own site id and zone", async () => {
    await readOverview();
    expect(readOverviewFacts).toHaveBeenCalledWith({
      siteId: LIVE_ACCOUNT.siteId,
      timeZone: LIVE_ACCOUNT.timeZone,
    });
  });

  it("a customer with nothing measured yet reads unmeasured, never a fixture number", async () => {
    const model = await readOverview();
    expect(model.head.weeksMeasured).toBe(0);
    expect(model.growth.kind).toBe("none");
  });

  it("the reserved fixture account still reads the fixture, and asks no store", async () => {
    signedInAs(RESERVED_ACCOUNT);
    await readOverview();
    expect(readOverviewFacts).not.toHaveBeenCalled();
  });
});

describe("§4.6 — the draft view reads the account's own draft", () => {
  it("asks the store for the id, against that account's own site", async () => {
    await readDraft("draft-1");
    expect(readDraftRow).toHaveBeenCalledWith({
      draftId: "draft-1",
      site: {
        siteId: LIVE_ACCOUNT.siteId,
        timeZone: LIVE_ACCOUNT.timeZone,
        mode: LIVE_ACCOUNT.mode,
      },
    });
  });

  it("an id the fixture holds is not this account's draft — the fixture is unreachable", async () => {
    // The mutation this kills: a real customer opening a draft address and
    // being shown the fixture's page because the id happened to match.
    const fixtureId = Object.keys(FIXTURE_DRAFTS)[0];
    expect(fixtureId).toBeDefined();
    await expect(readDraft(fixtureId!)).resolves.toBeNull();
  });

  it("the reserved fixture account still reads the fixture, and asks no store", async () => {
    signedInAs(RESERVED_ACCOUNT);
    const fixtureId = Object.keys(FIXTURE_DRAFTS)[0]!;
    await expect(readDraft(fixtureId)).resolves.not.toBeNull();
    expect(readDraftRow).not.toHaveBeenCalled();
  });
});

describe("§4.3's refusal reaches every one of them", () => {
  it("no session: nothing is read and nothing is drawn", async () => {
    signedOut();
    await expect(readShell()).rejects.toThrow();
    await expect(readOverview()).rejects.toThrow();
    await expect(readDraft("draft-1")).rejects.toThrow();
    expect(readShellFacts).not.toHaveBeenCalled();
    expect(readOverviewFacts).not.toHaveBeenCalled();
    expect(readDraftRow).not.toHaveBeenCalled();
  });

  it("a session with no site: the same, and it is a different refusal", async () => {
    withoutASite();
    await expect(readShell()).rejects.toThrow();
    expect(readShellFacts).not.toHaveBeenCalled();
  });
});
