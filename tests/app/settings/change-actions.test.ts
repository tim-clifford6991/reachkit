// tests/app/settings/change-actions.test.ts — BUILD §4.7, REQ-071
//
// The three answers with teeth, at the press.
//
// The mutation these rows kill is the one a Server Function invites: taking
// what it writes from the caller. A Server Function is an addressable
// endpoint, so a site id in the request would let any signed-in customer
// rewrite another account's domain, market or rivals — and a *rival set* in
// the request is the same hole one step along, because `saveRivals` writes
// whatever set it is handed. No field here names either. The id is the
// session's own and the set is read from the store, and both are asserted
// against a form that tries to supply them.
//
// The engines are real. `addRival` / `removeRival` decide what the set
// becomes and `registrableDomain` decides what a typed value canonicalises
// to; doubling those would leave nothing under test but the shape of a call
// — the question here is whether the adapter hands them the truth.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { appAccount, saveDomain, saveCategory, saveRivals, declaredAnswers, resolvesInDns, redirect, revalidated } =
  vi.hoisted(() => ({
    appAccount: vi.fn(),
    saveDomain: vi.fn(),
    saveCategory: vi.fn(),
    saveRivals: vi.fn(),
    declaredAnswers: vi.fn(),
    resolvesInDns: vi.fn(),
    redirect: vi.fn((to: string) => {
      throw new Error(`NEXT_REDIRECT:${to}`);
    }),
    revalidated: [] as string[],
  }));

vi.mock("@/app/(account)/app/_session/account", () => ({ appAccount }));
vi.mock("@/lib/market/changes", () => ({ saveDomain, saveCategory, saveRivals, declaredAnswers }));
vi.mock("@/lib/egress/dns", () => ({ resolvesInDns }));
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => {
    revalidated.push(path);
  },
}));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  redirect,
}));

const actions = await import("@/app/(account)/app/settings/change-actions");
const state = await import("@/app/(account)/app/settings/market-state");
const { SIGNIN_PATH } = await import("@/lib/account/identity/addresses");
const { DESTINATION_HREF } = await import("@/app/(account)/app/_shell/destinations");

const EFFECTIVE = new Date("2026-09-14T10:00:00.000Z");

/** One field, the way a browser sends it. */
function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) data.append(name, value);
  return data;
}

const domainForm = (domain: string): FormData => form({ [state.MARKET_DOMAIN_FIELD]: domain });
const categoryForm = (category: string): FormData => form({ [state.MARKET_CATEGORY_FIELD]: category });
const rivalForm = (rival: string): FormData => form({ [state.RIVAL_FIELD]: rival });

beforeEach(() => {
  vi.clearAllMocks();
  revalidated.length = 0;
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
  declaredAnswers.mockResolvedValue({ domain: "acme.com", category: "agency work", rivals: [] });
  resolvesInDns.mockResolvedValue(true);
});

describe("the site is the session's own, and no field names one", () => {
  it("saveDomain is handed the signed-in account's site", async () => {
    await actions.saveDomainAction(domainForm("newname.com"));
    expect(saveDomain).toHaveBeenCalledWith({ siteId: "site-1", domain: "newname.com" });
  });

  it("saveCategory is too", async () => {
    await actions.saveCategoryAction(categoryForm("agency work"));
    expect(saveCategory).toHaveBeenCalledWith({ siteId: "site-1", category: "agency work" });
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
    await actions.saveCategoryAction(categoryForm("x"));
    expect(saveCategory).toHaveBeenCalledWith({ siteId: "site-2", category: "x" });
  });

  it("a form carrying a site id is ignored — the id comes from the session", async () => {
    // The mutation: reading an id out of the request. A form can carry any
    // field name at all, so the guarantee has to be that none is read.
    const forged = form({ [state.MARKET_CATEGORY_FIELD]: "x", siteId: "site-2", site_id: "site-2" });
    await actions.saveCategoryAction(forged);
    expect(saveCategory).toHaveBeenCalledWith({ siteId: "site-1", category: "x" });
  });

  it("every exported action takes one argument, and it is the form", () => {
    // Asserted on arity: an action with a second parameter would have
    // somewhere for a browser to put another account's id.
    expect(actions.saveDomainAction).toHaveLength(1);
    expect(actions.saveCategoryAction).toHaveLength(1);
    expect(actions.addRivalAction).toHaveLength(1);
    expect(actions.removeRivalAction).toHaveLength(1);
  });

  it("a missing field is the empty string, never a guess", async () => {
    await actions.saveCategoryAction(new FormData());
    expect(saveCategory).toHaveBeenCalledWith({ siteId: "site-1", category: "" });
  });
});

describe("a session-less press lands on /signin, and writes nothing", () => {
  it.each([
    ["saveDomainAction", () => actions.saveDomainAction(domainForm("newname.com"))],
    ["saveCategoryAction", () => actions.saveCategoryAction(categoryForm("x"))],
    ["addRivalAction", () => actions.addRivalAction(rivalForm("asana.com"))],
    ["removeRivalAction", () => actions.removeRivalAction(rivalForm("asana.com"))],
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
    await expect(actions.saveCategoryAction(categoryForm("agency work"))).resolves.toEqual({
      answer: "saved",
      effectiveOn: EFFECTIVE.toISOString(),
    });
  });

  it("a save revalidates Settings, so the card re-reads rather than believing the browser", async () => {
    await actions.saveCategoryAction(categoryForm("agency work"));
    expect(revalidated).toEqual([DESTINATION_HREF.settings]);
  });

  it("REQ-071 c6 — an unreachable domain is refused, in this screen's own line, and nothing is revalidated", async () => {
    saveDomain.mockResolvedValue({ ok: false, because: "unreachable" });
    await expect(actions.saveDomainAction(domainForm("nowhere.invalid"))).resolves.toEqual({
      answer: "refused",
      lineKey: "settings.market.refused.unreachable",
      value: "nowhere.invalid",
    });
    expect(revalidated).toEqual([]);
  });

  it("a refusal keeps the typed value, so the field it came back to still holds it", async () => {
    saveDomain.mockResolvedValue({ ok: false, because: "unreachable" });
    const answer = await actions.saveDomainAction(domainForm("  Nowhere.INVALID  "));
    expect(answer).toMatchObject({ value: "  Nowhere.INVALID  " });
  });
});

describe("REQ-071 c4 — adding a rival is setup's rules, applied to the stored set", () => {
  it("the set written is the stored one plus the typed domain, canonicalised", async () => {
    declaredAnswers.mockResolvedValue({ domain: "acme.com", category: "x", rivals: ["rival.com"] });
    await actions.addRivalAction(rivalForm("https://www.Asana.com/pricing"));
    expect(saveRivals).toHaveBeenCalledWith({
      siteId: "site-1",
      rivals: [
        { domain: "rival.com", origin: "typed" },
        { domain: "asana.com", origin: "typed" },
      ],
    });
  });

  it("the set is read from the store — a set in the form is not the set that is written", async () => {
    // The mutation this kills: trusting the browser's copy of the set. A
    // stale or forged one is how a sixth rival gets past `set_full`, and how
    // a removal a customer never made gets saved.
    declaredAnswers.mockResolvedValue({ domain: "acme.com", category: "x", rivals: ["rival.com"] });
    await actions.addRivalAction(form({ [state.RIVAL_FIELD]: "asana.com", rivals: "[]" }));
    expect(saveRivals).toHaveBeenCalledWith({
      siteId: "site-1",
      rivals: [
        { domain: "rival.com", origin: "typed" },
        { domain: "asana.com", origin: "typed" },
      ],
    });
  });

  it.each([
    ["not a domain at all", "not a domain at all", "settings.competitors.refused.not-a-domain"],
    ["their own site", "www.acme.com", "settings.competitors.refused.own-domain"],
    ["one already in the set", "https://rival.com/pricing", "settings.competitors.refused.already-present"],
  ])("refuses %s in this screen's own line, and writes nothing", async (_name, typed, key) => {
    declaredAnswers.mockResolvedValue({ domain: "acme.com", category: "x", rivals: ["rival.com"] });
    await expect(actions.addRivalAction(rivalForm(typed))).resolves.toEqual({
      answer: "refused",
      lineKey: key,
      value: typed,
    });
    expect(saveRivals).not.toHaveBeenCalled();
  });

  it("refuses one that does not resolve — an unverified domain is never admitted on trust", async () => {
    resolvesInDns.mockResolvedValue(false);
    await expect(actions.addRivalAction(rivalForm("nowhere.com"))).resolves.toEqual({
      answer: "refused",
      lineKey: "settings.competitors.refused.does-not-resolve",
      value: "nowhere.com",
    });
    expect(saveRivals).not.toHaveBeenCalled();
  });

  it("REQ-071 c3 — refuses a sixth, and the five it holds are untouched", async () => {
    const five = ["a.com", "b.com", "c.com", "d.com", "e.com"];
    declaredAnswers.mockResolvedValue({ domain: "acme.com", category: "x", rivals: five });
    await expect(actions.addRivalAction(rivalForm("f.com"))).resolves.toEqual({
      answer: "refused",
      lineKey: "settings.competitors.refused.set-full",
      value: "f.com",
    });
    expect(saveRivals).not.toHaveBeenCalled();
  });

  it("every refusal `addRival` can give has a line on this screen", () => {
    // Total over the engine's own union: a sixth refusal there is a compile
    // error here, and this row says the five that exist are all spoken.
    expect(Object.keys(state.RIVAL_REFUSAL_KEY).sort()).toEqual([
      "already_present",
      "does_not_resolve",
      "not_a_domain",
      "own_domain",
      "set_full",
    ]);
  });
});

describe("REQ-071 c2 and c16 — removing a rival", () => {
  beforeEach(() => {
    declaredAnswers.mockResolvedValue({
      domain: "acme.com",
      category: "x",
      rivals: ["rival.com", "asana.com"],
    });
  });

  it("writes the stored set without that one", async () => {
    await actions.removeRivalAction(rivalForm("rival.com"));
    expect(saveRivals).toHaveBeenCalledWith({
      siteId: "site-1",
      rivals: [{ domain: "asana.com", origin: "typed" }],
    });
  });

  it("removing one that is not in the set writes the set unchanged, and never refuses", async () => {
    await expect(actions.removeRivalAction(rivalForm("gone.com"))).resolves.toMatchObject({
      answer: "saved",
    });
    expect(saveRivals).toHaveBeenCalledWith({
      siteId: "site-1",
      rivals: [
        { domain: "rival.com", origin: "typed" },
        { domain: "asana.com", origin: "typed" },
      ],
    });
  });

  it("c16 — the last one out leaves an empty set, and that is a save like any other", async () => {
    declaredAnswers.mockResolvedValue({ domain: "acme.com", category: "x", rivals: ["rival.com"] });
    await expect(actions.removeRivalAction(rivalForm("rival.com"))).resolves.toMatchObject({
      answer: "saved",
    });
    expect(saveRivals).toHaveBeenCalledWith({ siteId: "site-1", rivals: [] });
  });
});
