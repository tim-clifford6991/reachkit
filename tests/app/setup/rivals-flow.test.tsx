/** @vitest-environment jsdom */
// tests/app/setup/rivals-flow.test.tsx — issue 750
//
// The rivals card as a founder meets it, on both ways into onboarding: the
// real `SetupForm`, opened on the real screen read, whose requests reach
// the real `POST /api/setup/domain` and `POST /api/setup/rivals` handlers.
// Only what sits below those is doubled — the session, the rows, the
// stored report, DNS, the vendor and the cost seam's ledger.
//
// The mutation this kills is the one that shipped: a card that says it is
// looking for rivals and never offers one.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { applyEnvFixture } from "../../mail/env-fixture";
import { fakeDb, type FakeDb } from "../../scan/deep/fake-db";
import { reportFactory, resetSetupSession, sessionFactory, setupSession, storeFactory } from "./session-door";
import type { CostContext } from "@/lib/costs";

applyEnvFixture();

let db: FakeDb = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), redirect: vi.fn() }));
vi.mock("@/lib/account/identity", () => sessionFactory());
vi.mock("@/app/(account)/setup/_setup/store", async (importOriginal) =>
  storeFactory(await importOriginal<Record<string, unknown>>())
);
vi.mock("@/lib/scan/report", async (importOriginal) =>
  reportFactory(await importOriginal<Record<string, unknown>>())
);
vi.mock("@/lib/site-profile", () => ({ readSiteProfile: async () => null }));
// #970: step two's lists are the confirmed business profile, whose three
// readings are one reader. All three reach Postgres and none is what this
// file is about, so the seam the provider calls is doubled — the same
// choice the profile read above makes.
vi.mock("@/lib/site-profile/business/confirmed", async () => {
  const { NO_EDITS } = await import("@/lib/site-profile/business/types");
  return { readConfirmedBusiness: async () => ({ profile: null, market: null, edits: NO_EDITS }) };
});
vi.mock("@/lib/egress", () => ({ resolvesInDns: async () => true }));

// #971's status line holds a live subscription (`inngest/react`), and its
// token comes from `POST /api/setup/realtime` — a request this file's
// stubbed `fetch` has no route for, so it rejects. The hook cancels itself
// on unmount (`node_modules/inngest/react.js:314`) and its late `setError`
// is guarded by that flag, but a screen this suite mounted and never
// unmounted has never run the cleanup: the refusal then lands after the
// suite is over, and React's `setState` reaches for a `window` jsdom has
// already torn down. Vitest reports that as an unhandled rejection against
// whichever file happens to be running, which is how it failed a PR that
// touched none of this.
//
// Doubled rather than fed: what the line does with a *pushed* step is not
// this file's subject, and the step the server rendered — which is what
// this screen shows — is still the real one.
vi.mock("inngest/react", () => ({
  useRealtime: () => ({ messages: { last: undefined } }),
}));

const { competitorsDomain } = vi.hoisted(() => ({ competitorsDomain: vi.fn() }));
vi.mock("@/lib/vendors/dataforseo", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  competitorsDomain: (...a: unknown[]) => competitorsDomain(...a),
}));
vi.mock("@/lib/costs", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withCostContext: async (ctx: { cap: string }, body: (c: CostContext) => Promise<unknown>) =>
    body({ cap: ctx.cap } as CostContext),
}));

const { SetupForm } = await import("@/app/(account)/setup/SetupForm");
const { readSetupScreen } = await import("@/app/(account)/setup/_setup/provider");
const routes: Record<string, (request: Request, context: unknown) => Promise<Response>> = {
  "/api/setup/domain": (await import("@/app/api/setup/domain/route")).POST,
  "/api/setup/rivals": (await import("@/app/api/setup/rivals/route")).POST,
};

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const AT = new Date("2026-09-16T09:00:00.000Z");
const COLD_ROUTE_MS = 4000;

/** Every body the screen sent to `POST /api/setup` — one per step left,
 *  and the finish (SPEC §5, 2026-09-20). */
const submitted: Record<string, unknown>[] = [];

/** The finish's own body: the one that carries the whole submission. */
const finished = (): Record<string, unknown> | undefined =>
  submitted.find((body) => body.step === "finish");

/** The browser's requests, handed to the route handlers that serve them. */
vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
  if (url === "/api/setup") {
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    submitted.push(body);
    return Response.json(body.step === "finish" ? { ok: true, siteId: "site-1" } : { ok: true });
  }
  const handler = routes[url];
  if (handler === undefined) throw new Error(`no route for ${url}`);
  return handler(new Request(`https://reachkit.example${url}`, init), undefined);
});

/** The screen, opened on one step. `hasMemory` makes the adapter behave
 *  like a real address bar, so pressing Continue moves the screen on — the
 *  behaviour SPEC §5 (2026-09-20) puts in the URL. */
async function mount(step = "site"): Promise<HTMLElement> {
  const model = await readSetupScreen();
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(
      <NuqsTestingAdapter searchParams={{ step }} hasMemory>
        <SetupForm model={model} />
      </NuqsTestingAdapter>,
    );
  });
  return container;
}

/** Every root this file mounted. Unmounted after each test: a screen left
 *  mounted is a screen whose effects are still running when the suite ends,
 *  and an effect that settles after jsdom is gone takes the run down with
 *  it rather than failing its own test. */
const roots: Root[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount());
  document.body.innerHTML = "";
});

/** Leaving the step forward: the step's own save, then the next step. */
async function onwards(root: HTMLElement): Promise<void> {
  const before = submitted.length;
  await act(async () => {
    (root.querySelector('[data-testid="setup-onwards"]') as HTMLElement).click();
  });
  await until(() => submitted.length > before);
  await act(async () => {});
}

/** Which step the screen is on. */
const at = (root: HTMLElement): string | null =>
  root.querySelector('[data-testid="setup-form"]')?.getAttribute("data-step") ?? null;

/** Waits for the card's answer: a request the screen made settles it.
 *  `timeout` is for a request that is the first to load the route's lazy
 *  imports, which a busy machine takes longer than the default over. */
async function until(check: () => boolean, timeout?: number): Promise<void> {
  await vi.waitFor(
    async () => {
      await act(async () => {});
      expect(check()).toBe(true);
    },
    { timeout }
  );
}

async function type(field: Element | null, value: string): Promise<void> {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    setter?.call(field as HTMLInputElement, value);
    (field as HTMLInputElement).dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** Enter commits one field without submitting setup. */
async function enter(field: Element | null): Promise<void> {
  await act(async () => {
    field?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
}

const offered = (root: HTMLElement): string[] =>
  Array.from(root.querySelectorAll('[data-testid="setup-competitors-suggested"] button')).map(
    (chip) => chip.textContent ?? ""
  );
const shown = (root: HTMLElement, id: string): boolean =>
  root.querySelector(`[data-testid="${id}"]`) !== null;

beforeEach(() => {
  document.body.innerHTML = "";
  resetSetupSession();
  submitted.length = 0;
  competitorsDomain.mockReset();
  db = fakeDb({
    sites: [
      { id: "site-1", user_id: "user-1", domain: "example.com", created_at: AT.toISOString(), setup_completed_at: null },
    ],
    scans: [],
  });
});

describe("free upgrade — the report's rivals are on the card when the screen opens", () => {
  it("offers them as chips once the route answers (nothing read of the site to conclude from), and one can be accepted", async () => {
    const root = await mount("rivals");
    await until(() => offered(root).length > 0, COLD_ROUTE_MS);
    expect(offered(root)).toEqual(["asana.com", "monday.com", "clickup.com"]);
    expect(shown(root, "setup-competitors-seeking")).toBe(false);

    await act(async () => {
      (root.querySelector('[data-testid="setup-competitors-suggested"] button') as HTMLElement).click();
    });
    expect(root.querySelector('[data-testid="setup-competitors-selected"]')?.textContent).toContain("asana.com");
    expect(competitorsDomain).not.toHaveBeenCalled();
  });
});

describe("issue 838 — a report that found no rivals: the card asks, and competitors_domain answers", () => {
  it("the screen opens seeking, then offers the founder's own-domain competitors", async () => {
    setupSession.reports.set("example.com", {
      scanId: "scan-fixture",
      category: "SEO content marketing software",
      rivals: [],
    });
    competitorsDomain.mockResolvedValue({
      kind: "measured",
      value: [{ domain: "surferseo.com", overlapKeywords: 2 }],
      at: AT,
    });
    const root = await mount("rivals");

    await until(() => offered(root).length > 0, COLD_ROUTE_MS);
    expect(offered(root)).toEqual(["surferseo.com"]);
    expect(competitorsDomain).toHaveBeenCalledWith(expect.anything(), { domain: "example.com", locale: { country: "US", language: "en" } });
    expect(db.tables.scans).toHaveLength(1);
  });

  it("a vendor that finds none says so rather than seeking on", async () => {
    setupSession.reports.set("example.com", { scanId: "scan-fixture", category: "SEO software", rivals: [] });
    competitorsDomain.mockResolvedValue({ kind: "zero", value: [], at: AT });
    const root = await mount("rivals");

    await until(() => shown(root, "setup-competitors-none-found"));
    expect(shown(root, "setup-competitors-seeking")).toBe(false);
  });
});

describe("issue #783 — the finish carries the browser's zone", () => {
  it("the last step's control sends the zone the browser reports, beside the five answers", async () => {
    const root = await mount("publishing");
    await onwards(root);
    expect(finished()?.timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    expect(finished()?.domain).toBe("example.com");
  });
});

describe("SPEC §5 (2026-09-20) — each step saves as it is left", () => {
  it("leaving the site step writes the site and the market, and reaches the business step", async () => {
    const root = await mount("site");
    await onwards(root);
    expect(submitted).toEqual([
      {
        step: "site",
        domain: "example.com",
        category: "project management software for agencies",
        locale: "US/en",
      },
    ]);
    expect(at(root)).toBe("business");
  });

  it("leaving the rivals step writes the rivals the founder kept — the save the pass then reads", async () => {
    const root = await mount("rivals");
    await until(() => offered(root).length > 0, COLD_ROUTE_MS);
    await act(async () => {
      (root.querySelector('[data-testid="setup-competitors-suggested"] button') as HTMLElement).click();
    });
    await onwards(root);
    expect(submitted).toEqual([{ step: "rivals", competitors: ["asana.com"] }]);
    expect(at(root)).toBe("voice");
  });

  it("Back goes to the step before it and writes nothing", async () => {
    const root = await mount("voice");
    await act(async () => {
      const back = [...root.querySelectorAll("button")].find(
        (b) => (b.textContent ?? "").trim() === "Back",
      );
      (back as HTMLElement).click();
    });
    expect(at(root)).toBe("rivals");
    expect(submitted).toEqual([]);
  });
});

describe("direct purchase — address, then market, then rivals", () => {
  beforeEach(() => {
    setupSession.address = { siteId: "site-1", domain: "" };
    db.tables.sites![0]!.domain = null;
  });

  it("the founder gives their address, states their market, and is offered competitors_domain's rivals", async () => {
    competitorsDomain.mockResolvedValue({
      kind: "measured",
      value: [
        { domain: "rival-one.com", overlapKeywords: 4 },
        { domain: "rival-two.com", overlapKeywords: 2 },
      ],
      at: AT,
    });
    const root = await mount("site");

    await type(root.querySelector('input[name="domain"]'), "founder.io");
    await enter(root.querySelector('input[name="domain"]'));
    // The address is given: the market can now be stated, and the card
    // still waits on it rather than claiming none were found.
    await until(() => root.querySelector('input[name="category"]') !== null);
    await until(() => (db.tables.scans ?? []).length === 1);

    await type(root.querySelector('input[name="category"]'), "bookkeeping for dentists");
    await enter(root.querySelector('input[name="category"]'));

    // Two presses carry them past the business step to the rivals step,
    // each one saving the step it leaves.
    await onwards(root);
    await onwards(root);
    expect(at(root)).toBe("rivals");

    await until(() => offered(root).length > 0);
    expect(offered(root)).toEqual(["rival-one.com", "rival-two.com"]);
    expect(competitorsDomain).toHaveBeenCalledWith(expect.anything(), { domain: "founder.io", locale: { country: "US", language: "en" } });
    expect(db.tables.scans).toHaveLength(1);
  });

  it("a vendor that finds none says so, and the founder can still type their own", async () => {
    competitorsDomain.mockResolvedValue({ kind: "zero", value: [], at: AT });
    const root = await mount("site");

    await type(root.querySelector('input[name="domain"]'), "founder.io");
    await enter(root.querySelector('input[name="domain"]'));
    await until(() => root.querySelector('input[name="category"]') !== null);
    await type(root.querySelector('input[name="category"]'), "bookkeeping for dentists");
    await enter(root.querySelector('input[name="category"]'));
    await onwards(root);
    await onwards(root);

    await until(() => shown(root, "setup-competitors-none-found"));
    expect(shown(root, "setup-competitors-seeking")).toBe(false);
    expect(root.querySelector('input[name="competitor"]')).not.toBeNull();
  });
});
