// tests/app/settings/change-actions.test.ts — BUILD §4.7, REQ-071
//
// The three answers with teeth, at the press.
//
// The mutation these rows kill is the one a Server Function invites: taking
// the site id from the caller. A Server Function is an addressable
// endpoint, so a site id in the request would let any signed-in customer
// rewrite another account's domain, market or rivals. No argument here
// names one, and these rows assert that the id the engine is handed is the
// session's own.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { appAccount, saveDomain, saveCategory, saveRivals, redirect } = vi.hoisted(() => ({
  appAccount: vi.fn(),
  saveDomain: vi.fn(),
  saveCategory: vi.fn(),
  saveRivals: vi.fn(),
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  }),
}));

vi.mock("@/app/(account)/app/_session/account", () => ({ appAccount }));
vi.mock("@/lib/market/changes", () => ({ saveDomain, saveCategory, saveRivals }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  redirect,
}));

const actions = await import("@/app/(account)/app/settings/change-actions");
const { SIGNIN_PATH } = await import("@/lib/account/identity/addresses");

const EFFECTIVE = new Date("2026-09-14T10:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  appAccount.mockResolvedValue({
    ok: true,
    account: {
      userId: "user-1",
      siteId: "site-1",
      domain: "acme.com",
      createdAt: new Date("2026-08-24T06:00:00.000Z"),
      timeZone: "America/New_York",
      mode: "autopilot",
    },
  });
  saveDomain.mockResolvedValue({ ok: true, effectiveOn: EFFECTIVE });
  saveCategory.mockResolvedValue({ ok: true, effectiveOn: EFFECTIVE });
  saveRivals.mockResolvedValue({ ok: true, effectiveOn: EFFECTIVE });
});

describe("the site is the session's own, and no argument names one", () => {
  it("saveDomain is handed the signed-in account's site", async () => {
    await actions.saveDomainAction("newname.com");
    expect(saveDomain).toHaveBeenCalledWith({ siteId: "site-1", domain: "newname.com" });
  });

  it("saveCategory and saveRivals are too", async () => {
    await actions.saveCategoryAction("agency work");
    expect(saveCategory).toHaveBeenCalledWith({ siteId: "site-1", category: "agency work" });
    await actions.saveRivalsAction([{ domain: "asana.com", origin: "typed" }]);
    expect(saveRivals).toHaveBeenCalledWith({
      siteId: "site-1",
      rivals: [{ domain: "asana.com", origin: "typed" }],
    });
  });

  it("a second account's session writes that account's site, not the first's", async () => {
    appAccount.mockResolvedValue({
      ok: true,
      account: {
        userId: "user-2",
        siteId: "site-2",
        domain: "other.com",
        createdAt: new Date(),
        timeZone: "America/New_York",
        mode: "autopilot",
      },
    });
    await actions.saveCategoryAction("x");
    expect(saveCategory).toHaveBeenCalledWith({ siteId: "site-2", category: "x" });
  });

  it("no exported action takes a site id — the signature is the guarantee", () => {
    // Asserted on arity: an action that accepted one would have somewhere
    // for a browser to put another account's id.
    expect(actions.saveDomainAction).toHaveLength(1);
    expect(actions.saveCategoryAction).toHaveLength(1);
    expect(actions.saveRivalsAction).toHaveLength(1);
  });
});

describe("a session-less press lands on /signin, and writes nothing", () => {
  it.each([
    ["saveDomainAction", () => actions.saveDomainAction("newname.com")],
    ["saveCategoryAction", () => actions.saveCategoryAction("x")],
    ["saveRivalsAction", () => actions.saveRivalsAction([])],
  ])("%s", async (_name, press) => {
    appAccount.mockResolvedValue({ ok: false, because: "no_session" });
    await expect(press()).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirect).toHaveBeenCalledWith(SIGNIN_PATH);
    expect(saveDomain).not.toHaveBeenCalled();
    expect(saveCategory).not.toHaveBeenCalled();
    expect(saveRivals).not.toHaveBeenCalled();
  });
});

describe("what the press answers", () => {
  it("a saved change carries the date it becomes effective, as an instant the screen formats", async () => {
    // A `Date` would cross to the browser as whatever the boundary made of
    // it; the screen states the day in the customer's own zone with the one
    // formatter the rest of Settings uses.
    await expect(actions.saveCategoryAction("agency work")).resolves.toEqual({
      saved: true,
      effectiveOn: EFFECTIVE.toISOString(),
    });
  });

  it("REQ-071 c6 — an unreachable domain is refused, and the refusal is the engine's own word", async () => {
    saveDomain.mockResolvedValue({ ok: false, because: "unreachable" });
    await expect(actions.saveDomainAction("nowhere.invalid")).resolves.toEqual({
      saved: false,
      because: "unreachable",
    });
  });

  it("REQ-071 c16 — an empty rival set is a save like any other", async () => {
    await expect(actions.saveRivalsAction([])).resolves.toMatchObject({ saved: true });
    expect(saveRivals).toHaveBeenCalledWith({ siteId: "site-1", rivals: [] });
  });
});
