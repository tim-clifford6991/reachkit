// tests/app/setup/provider.test.ts — BUILD §4.3, issue #169
//
// The three reads the setup screens make, now that each names the founder
// through the session.
//
// #133 made the *writes* live; a screen drawn from a fixture in front of a
// store that writes real rows is the half-wired state this finishes, and
// the mutation these rows kill is a founder shown somebody else's measured
// market on the one screen where they name their own.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

import {
  passFactory,
  reportFactory,
  resetSetupSession,
  sessionFactory,
  setupSession,
  storeFactory,
} from "./session-door";

const redirected: string[] = [];
vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    redirect: (to: string) => {
      redirected.push(to);
      throw new Error(`NEXT_REDIRECT:${to}`);
    },
  };
});

vi.mock("@/lib/account/identity", () => sessionFactory());
vi.mock("@/app/(account)/setup/_setup/store", async (importOriginal) =>
  storeFactory(await importOriginal<Record<string, unknown>>())
);
vi.mock("@/lib/scan/report", async (importOriginal) =>
  reportFactory(await importOriginal<Record<string, unknown>>())
);
vi.mock("@/lib/scan/deep/progress", () => passFactory());
// SPEC.md §5 (2026-09-12): the screen read now asks the site-profile leaf
// what was read of this founder's site. The leaf reaches Postgres, and
// these rows are about which account the screen is drawn for — so it is
// doubled here, exactly as the report and pass reads above are. A screen
// whose profile read is doubled still proves the thing this file proves.
vi.mock("@/lib/site-profile", () => ({
  readSiteProfile: async () => null,
  saveVoiceText: async () => undefined,
}));
// SPEC §5 and §7 (2026-09-20, #970): step two's lists are the confirmed
// business profile, whose three readings are one reader — the crawl's row,
// the newest deep report and the customer's own decisions. All three reach
// Postgres, and none of them is what this file proves: it proves which
// account the screen is drawn for. Doubled at the seam the provider calls,
// the way the report and pass reads above are.
vi.mock("@/lib/site-profile/business/confirmed", async () => {
  const { NO_EDITS } = await import("@/lib/site-profile/business/types");
  return { readConfirmedBusiness: async () => ({ profile: null, market: null, edits: NO_EDITS }) };
});

// D28 (#1185): what ReachKit concluded for the site is a read of
// `sites.market`, doubled here like every other read this screen makes.
let stored: unknown = null;
vi.mock("@/lib/market/infer/stored", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/market/infer/stored")>();
  return {
    ...actual,
    readSiteMarket: async () =>
      stored === null ? null : { domain: "example.com", category: null, competitors: [], stored: actual.parseStoredMarket(stored) },
  };
});

const provider = await import("@/app/(account)/setup/_setup/provider");

beforeEach(() => {
  redirected.length = 0;
  stored = null;
  resetSetupSession();
});

describe("§4.3's screen is drawn for the founder who is signed in", () => {
  it("the market card is inferred from the report for that account's own address", async () => {
    const model = await provider.readSetupScreen();
    expect(model.state.siteDomain).toBe("example.com");
    expect(model.state.market.state).toBe("inferred");
  });

  it("an account whose address nobody has measured opens with an empty market (REQ-026 c3)", async () => {
    setupSession.address = { siteId: "site-1", domain: "unmeasured.test" };
    const model = await provider.readSetupScreen();
    expect(model.state.market.state).toBe("empty");
  });

  it("a founder whose provisioning has not run gets the empty-address arm, not a thrown screen", async () => {
    // REQ-021 c7: an empty field with nothing pre-filled — never an error
    // page on the one screen a founder cannot get past.
    setupSession.address = null;
    const model = await provider.readSetupScreen();
    expect(model.state.siteDomain).toBeNull();
  });

  it("the CNAME record is the deployment's own binding, never a literal", async () => {
    const model = await provider.readSetupScreen();
    expect(JSON.stringify(model.cards)).toContain(process.env.HOSTED_EDGE_CNAME_TARGET);
  });

  it("D28 — with nothing concluded yet, a measured address opens seeking, so the route concludes (#1185)", async () => {
    const model = await provider.readSetupScreen();
    expect(model.state.suggestions.state).toBe("seeking");
    expect(model.state.rivals).toEqual([]);
  });

  it("D28 — what ReachKit already concluded opens chosen, with its reasons, and nothing is bought again", async () => {
    stored = {
      current: {
        category: "client project management",
        categoryReason: "The site sells client project planning.",
        synonyms: [],
        rivals: [{ domain: "asana.com", name: "Asana", basis: "same_job", reason: "Work management for agencies." }],
      },
    };
    const model = await provider.readSetupScreen();
    expect(model.state.market).toMatchObject({ state: "inferred", category: "client project management", reason: "The site sells client project planning." });
    expect(model.state.rivals).toEqual([{ domain: "asana.com", origin: "suggested" }]);
    expect(model.state.suggestions.reasons).toEqual({ "asana.com": "Work management for agencies." });
  });

  it("an address nobody measured opens waiting on the market, never on none found (REQ-026 c10)", async () => {
    setupSession.address = { siteId: "site-1", domain: "unmeasured.test" };
    const model = await provider.readSetupScreen();
    expect(model.state.suggestions.state).toBe("awaiting_market");
  });
});

describe("the report projection is four facts and no more", () => {
  it("scan id, category, the rival names off the presence card, and the rivals the profile read (issue 838)", async () => {
    await expect(provider.readReportFor("example.com")).resolves.toEqual({
      scanId: "scan-fixture",
      category: "project management software for agencies",
      rivals: ["asana.com", "monday.com", "clickup.com"],
      namedRivals: [],
    });
  });

  it("a domain nobody measured is `null` (REQ-021 c11)", async () => {
    await expect(provider.readReportFor("nobody-measured-this.test")).resolves.toBeNull();
  });

  it("a report with no category is `null` — never a card claiming a market nobody derived", async () => {
    setupSession.reports.set("uncategorised.test", {
      scanId: "scan-2",
      category: null,
      rivals: [],
    });
    await expect(provider.readReportFor("uncategorised.test")).resolves.toBeNull();
  });

  it("REQ-026 c6 — the address decides the card, so changing it changes the market", async () => {
    const measured = await provider.readReportFor("example.com");
    const other = await provider.readReportFor("somewhere-else.test");
    expect(measured).not.toBeNull();
    expect(other).toBeNull();
  });
});

describe("the deep pass is the signed-in founder's own", () => {
  it("answers the pass for that account's site", async () => {
    setupSession.pass = { running: true, stage: "reading_your_market", enteredAt: {} };
    await expect(provider.readPassProgress()).resolves.toEqual({
      running: true,
      stage: "reading_your_market",
      enteredAt: {},
    });
  });

  it("a founder with no site has no pass to latch a deadline against", async () => {
    // The read itself is what latches the ten-minute deadline, so it must
    // not be made for a site that does not exist.
    setupSession.address = null;
    await expect(provider.readPassProgress()).resolves.toEqual({
      running: false,
      degraded: false,
    });
  });
});

describe("§4.3's refusal", () => {
  it("no session at all goes to the sign-in prompt", async () => {
    setupSession.session = null;
    await expect(provider.readSetupScreen()).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirected).toEqual(["/signin"]);
  });

  it("a session with no site is *not* refused — setup is where that founder belongs", async () => {
    // `requireAppAccount()` sends a siteless session to `/setup`; using it
    // here would loop the setup screen onto itself.
    setupSession.session = { userId: "user-1", siteId: null as unknown as string };
    setupSession.address = null;
    await expect(provider.readSetupScreen()).resolves.toBeDefined();
    expect(redirected).toEqual([]);
  });
});
