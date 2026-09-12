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

const provider = await import("@/app/(account)/setup/_setup/provider");

beforeEach(() => {
  redirected.length = 0;
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

  it("suggestions are not sought on a screen read — `null`, not an empty list", async () => {
    // `suggestRivals` is a vendor call through the cost seam, and "sought
    // and none came back" (an empty list, REQ-026 c10) is a different,
    // stronger claim than "none has been sought".
    const model = await provider.readSetupScreen();
    expect(model.state.suggestions.state).not.toBe("none_found");
  });
});

describe("the report projection is the facts the market card needs", () => {
  it("scan id, category, the rivals, the twelve, and the market they re-derive over", async () => {
    await expect(provider.readReportFor("example.com")).resolves.toEqual({
      scanId: "scan-fixture",
      category: "project management software for agencies",
      rivals: ["asana.com", "monday.com", "clickup.com"],
      questions: [
        {
          wording: "What's the best project management software for agencies?",
          search: "best project management software for agencies",
        },
      ],
      derivable: {
        profile: expect.objectContaining({
          category: "project management software for agencies",
        }) as unknown,
        market: expect.any(Array) as unknown,
      },
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
      questions: [],
      suggestions: [],
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
