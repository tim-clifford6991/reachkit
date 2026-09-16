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
import { beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
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
vi.mock("@/lib/egress", () => ({ resolvesInDns: async () => true }));

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

/** What the one submit sent to `POST /api/setup` (issue #783). */
const submitted: Record<string, unknown>[] = [];

/** The browser's requests, handed to the route handlers that serve them. */
vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
  if (url === "/api/setup") {
    submitted.push(JSON.parse(String(init.body)) as Record<string, unknown>);
    return Response.json({ ok: true, siteId: "site-1" });
  }
  const handler = routes[url];
  if (handler === undefined) throw new Error(`no route for ${url}`);
  return handler(new Request(`https://reachkit.example${url}`, init), undefined);
});

async function mount(): Promise<HTMLElement> {
  const model = await readSetupScreen();
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(<SetupForm model={model} />);
  });
  return container;
}

/** Waits for the card's answer: a request the screen made settles it. */
async function until(check: () => boolean): Promise<void> {
  await vi.waitFor(async () => {
    await act(async () => {});
    expect(check()).toBe(true);
  });
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
  it("offers them as chips, and one can be accepted", async () => {
    const root = await mount();
    expect(offered(root)).toEqual(["asana.com", "monday.com", "clickup.com"]);
    expect(shown(root, "setup-competitors-seeking")).toBe(false);

    await act(async () => {
      (root.querySelector('[data-testid="setup-competitors-suggested"] button') as HTMLElement).click();
    });
    expect(root.querySelector('[data-testid="setup-competitors-selected"]')?.textContent).toContain("asana.com");
    expect(competitorsDomain).not.toHaveBeenCalled();
  });
});

describe("issue #783 — the submit carries the browser's zone", () => {
  it("the one submit sends the zone the browser reports, beside the three decisions", async () => {
    const root = await mount();
    await act(async () => {
      (root.querySelector('[data-testid="setup-form"]') as HTMLFormElement).requestSubmit();
    });
    await until(() => submitted.length === 1);
    expect(submitted[0]!.timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    expect(submitted[0]!.domain).toBe("example.com");
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
    const root = await mount();
    expect(shown(root, "setup-competitors-awaiting")).toBe(true);

    await type(root.querySelector('input[name="domain"]'), "founder.io");
    await enter(root.querySelector('input[name="domain"]'));
    // The address is given: the market can now be stated, and the card
    // still waits on it rather than claiming none were found.
    await until(() => root.querySelector('input[name="category"]') !== null);
    expect(shown(root, "setup-competitors-awaiting")).toBe(true);
    await until(() => (db.tables.scans ?? []).length === 1);

    await type(root.querySelector('input[name="category"]'), "bookkeeping for dentists");
    await enter(root.querySelector('input[name="category"]'));
    await until(() => offered(root).length > 0);

    expect(offered(root)).toEqual(["rival-one.com", "rival-two.com"]);
    expect(competitorsDomain).toHaveBeenCalledWith(expect.anything(), { domain: "founder.io" });
    expect(db.tables.scans).toHaveLength(1);
  });

  it("a vendor that finds none says so, and the founder can still type their own", async () => {
    competitorsDomain.mockResolvedValue({ kind: "zero", value: [], at: AT });
    const root = await mount();

    await type(root.querySelector('input[name="domain"]'), "founder.io");
    await enter(root.querySelector('input[name="domain"]'));
    await until(() => root.querySelector('input[name="category"]') !== null);
    await type(root.querySelector('input[name="category"]'), "bookkeeping for dentists");
    await enter(root.querySelector('input[name="category"]'));

    await until(() => shown(root, "setup-competitors-none-found"));
    expect(shown(root, "setup-competitors-seeking")).toBe(false);
    expect(root.querySelector('input[name="competitor"]')).not.toBeNull();
  });
});
