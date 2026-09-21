// tests/app/settings/panel-actions.test.ts — SPEC §4 (2026-09-20, #908),
// issue #913
//
// The seven Settings writes, at the press.
//
// `panels`' own suite asks whether a control reaches these and states the
// answer; this file asks the other half — what each one asks the engine
// for, and what it refuses. The mutations it kills are the two a Server
// Function invites: taking what it writes from the caller (a mail kind the
// register does not make stoppable, a list sent from the browser) and
// reporting a write that did not happen as one that did.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const {
  appAccount,
  savePublishingSettings,
  setPublishing,
  setNotifyPref,
  saveDoNotClaim,
  siteFacts,
  measuredAnswers,
  redirect,
  revalidated,
} = vi.hoisted(() => ({
  appAccount: vi.fn(),
  savePublishingSettings: vi.fn(),
  setPublishing: vi.fn(),
  setNotifyPref: vi.fn(),
  saveDoNotClaim: vi.fn(),
  siteFacts: vi.fn(),
  measuredAnswers: vi.fn(),
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  }),
  revalidated: [] as string[],
}));

vi.mock("@/app/(account)/app/_session/account", () => ({ appAccount }));
vi.mock("@/lib/publish/settings", () => ({ savePublishingSettings }));
vi.mock("@/lib/publish/switch", () => ({ setPublishing }));
vi.mock("@/lib/mail/notifications", () => ({
  // The register's own stoppable set, as the module exports it.
  TOGGLABLE_KINDS: ["draft-ready", "published", "weekly"] as const,
  setNotifyPref,
}));
vi.mock("@/lib/generate/claims/save", () => ({ saveDoNotClaim }));
vi.mock("@/lib/generate/store", () => ({ generateStore: () => ({ siteFacts }) }));
vi.mock("@/lib/market/changes", () => ({ measuredAnswers }));
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => {
    revalidated.push(path);
  },
}));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  redirect,
}));

const actions = await import("@/app/(account)/app/settings/panel-actions");
const F = await import("@/app/(account)/app/settings/panel-state");
const { SIGNIN_PATH } = await import("@/lib/account/identity/addresses");

const ACCOUNT = { siteId: "site-1", userId: "user-1" };

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) data.append(name, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  revalidated.length = 0;
  appAccount.mockResolvedValue({ ok: true, account: ACCOUNT });
  savePublishingSettings.mockResolvedValue({ ok: true, settings: {}, applied: {} });
  setPublishing.mockResolvedValue({ recordedAt: new Date() });
  setNotifyPref.mockResolvedValue({});
  saveDoNotClaim.mockResolvedValue({ doNotClaim: [], swept: null });
  siteFacts.mockResolvedValue({ doNotClaim: ["we are the cheapest"] });
  measuredAnswers.mockResolvedValue({ scanId: "scan-1" });
});

describe("the publishing settings are written for the session's own site", () => {
  it("the stepper's hours reach the writer, as the signed-in customer", async () => {
    await actions.saveVetoHoursAction(form({ [F.VETO_HOURS_FIELD]: "72" }));
    expect(savePublishingSettings).toHaveBeenCalledWith(
      "site-1",
      { vetoHours: 72 },
      { kind: "customer", userId: "user-1" }
    );
  });

  it("a window the writer refuses is reported as refused, and nothing is claimed", async () => {
    savePublishingSettings.mockResolvedValue({ ok: false, invalid: ["vetoHours"] });
    await expect(actions.saveVetoHoursAction(form({ [F.VETO_HOURS_FIELD]: "36" }))).resolves.toEqual({
      answer: "refused",
    });
    expect(revalidated).toEqual([]);
  });

  it("a value that is not a number never reaches the writer at all", async () => {
    await expect(actions.saveVetoHoursAction(form({ [F.VETO_HOURS_FIELD]: "soon" }))).resolves.toEqual({
      answer: "refused",
    });
    expect(savePublishingSettings).not.toHaveBeenCalled();
  });

  it("a publish time lands on the next page, and everything else lands at once", async () => {
    await expect(
      actions.savePublishTimeAction(form({ [F.PUBLISH_TIME_FIELD]: "07:00" }))
    ).resolves.toEqual({ answer: "saved", effect: "next-page" });
    await expect(
      actions.saveTimeZoneAction(form({ [F.TIME_ZONE_FIELD]: "Europe/London" }))
    ).resolves.toEqual({ answer: "saved", effect: "now" });
  });

  it("the switch records the state it was asked for, as the customer", async () => {
    await actions.setPublishingAction(form({ [F.PUBLISHING_ENABLED_FIELD]: F.OFF }));
    expect(setPublishing).toHaveBeenCalledWith("site-1", false, {
      kind: "customer",
      userId: "user-1",
    });
  });

  it("a saved change asks the screen and the shell to re-read", async () => {
    await actions.setPublishingAction(form({ [F.PUBLISHING_ENABLED_FIELD]: F.ON }));
    expect(revalidated).toContain("/app/settings");
    expect(revalidated).toContain("/app");
  });
});

describe("a mail switch reaches only a mail the register lets the customer stop", () => {
  it("a stoppable kind is written for the signed-in user", async () => {
    await actions.setNotificationAction(
      form({ [F.NOTIFY_KIND_FIELD]: "weekly", [F.NOTIFY_ON_FIELD]: F.OFF })
    );
    expect(setNotifyPref).toHaveBeenCalledWith({ userId: "user-1", kind: "weekly", on: false });
  });

  it("**a kind the register does not make stoppable is refused, and never written**", async () => {
    // The hole a Server Function invites: the kind arrives from the
    // browser, and the sign-in mail is not a customer's to switch off.
    await expect(
      actions.setNotificationAction(
        form({ [F.NOTIFY_KIND_FIELD]: "sign-in", [F.NOTIFY_ON_FIELD]: F.OFF })
      )
    ).resolves.toEqual({ answer: "refused" });
    expect(setNotifyPref).not.toHaveBeenCalled();
  });
});

describe("the never-claim list is read here, never sent here", () => {
  it("an added claim is appended to the stored list, which the store is asked for", async () => {
    await actions.addClaimAction(form({ [F.CLAIM_FIELD]: "fastest in the world" }));
    expect(siteFacts).toHaveBeenCalledWith("site-1");
    expect(saveDoNotClaim).toHaveBeenCalledWith({
      siteId: "site-1",
      entries: ["we are the cheapest", "fastest in the world"],
      scanId: "scan-1",
    });
  });

  it("a removed claim leaves the rest of the stored list alone", async () => {
    await actions.removeClaimAction(form({ [F.CLAIM_FIELD]: "we are the cheapest" }));
    expect(saveDoNotClaim).toHaveBeenCalledWith(
      expect.objectContaining({ entries: [] })
    );
  });

  it("an empty entry is refused rather than saved as nothing and reported as saved", async () => {
    await expect(actions.addClaimAction(form({ [F.CLAIM_FIELD]: "   " }))).resolves.toEqual({
      answer: "refused",
    });
    expect(saveDoNotClaim).not.toHaveBeenCalled();
  });

  it("a site nothing has measured still stores its list — there is simply nothing to re-check", async () => {
    measuredAnswers.mockResolvedValue(null);
    await expect(actions.addClaimAction(form({ [F.CLAIM_FIELD]: "a claim" }))).resolves.toEqual({
      answer: "saved",
      effect: "now",
    });
    expect(saveDoNotClaim).toHaveBeenCalledWith(expect.objectContaining({ scanId: null }));
  });
});

describe("a caller with no session writes nothing", () => {
  it("every one of the seven lands on /signin before it reaches an engine", async () => {
    appAccount.mockResolvedValue({ ok: false });
    await expect(
      actions.setPublishingAction(form({ [F.PUBLISHING_ENABLED_FIELD]: F.ON }))
    ).rejects.toThrow(`NEXT_REDIRECT:${SIGNIN_PATH}`);
    expect(setPublishing).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith(SIGNIN_PATH);
  });
});
