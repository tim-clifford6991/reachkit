/** @vitest-environment jsdom */
// tests/app/settings/screen.test.tsx — BUILD §4.7, REQ-070 c1-c3, REQ-079 c1,
// REQ-097
//
// WO-180 `## Test plan`, all three rows plus its two discriminating tests. The
// screen's promise is a *closed offer*: exactly the fourteen settings, exactly
// the seven actions, and nothing that tunes the engine — so the tests read the
// offer off the rendered document rather than off a list a developer keeps.
// Every control carries `data-testid="setting-<key>"` and every action
// `data-testid="action-<key>"`, and those two sets are compared with `SETTABLE`
// and `ACTIONS`.
//
// **Rendering convention.** `tests/app/**` runs under the "node" project, whose
// environment has no `document`; this file declares `jsdom` for itself with the
// docblock above, the same per-file choice `tests/app/shell/frame.test.tsx`
// makes. Unlike that file it mounts with `react-dom/client` rather than
// rendering to static markup, because two of REQ-079's claims are about what
// happens *between* two presses — a static string cannot be clicked. No test
// library is added for it: React 19 exports `act`, and a bubbling `MouseEvent`
// is what React's own root listener is waiting for.
//
// **`copy()` is mocked to `(key) => key`, and `COPY` is not** — the convention
// the shell's suites set, for the reason they state: the assertions are about
// which key a line resolves from, never about the owner's wording, and keeping
// `COPY` real is what lets `writtenLine`'s owner-owed branch behave here
// exactly as it does in production.
//
// **The action interfaces are wrapped, not replaced.** The module mock below
// records which key was called and then calls the real entry from
// `SETTINGS_ACTIONS` — the map the screen actually calls since issue #136
// wired the three billing controls — so "the control calls its declared
// interface" is asserted against the interface that ships rather than against
// a double that agrees with the test.
import { describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";

/** #228 made `BillingSummary` a union — the card, or the arm that says it
 *  could not be read. The fixture account's is always the card; narrowed
 *  once here so no row below has to. */
function billingCard(): Extract<
  ReturnType<typeof assembleSettings>["billing"],
  { readable: true }
> {
  const { billing } = assembleSettings(FIXTURE_SETTINGS_FACTS);
  if (!billing.readable) throw new Error("the fixture account's billing is always readable");
  return billing;
}

const { calls } = vi.hoisted(() => ({ calls: [] as string[] }));

// #228: the screen now resolves its account through the one `(account)`
// seam and reads every fact live. This suite is about what the cards draw,
// not about which account they draw for, so it signs in as the reserved
// fixture account — the branch whose facts are `FIXTURE_SETTINGS_FACTS`,
// which is what every row below is written against.
vi.mock("@/app/(account)/app/_session/account", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const { RESERVED_ACCOUNT } = await import("../accounts");
  return { ...actual, requireSetUpAccount: async () => RESERVED_ACCOUNT };
});

vi.mock("@/lib/presentation/copy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/presentation/copy")>();
  return { ...actual, copy: (key: string) => key };
});

// The account card's three controls cross the server boundary (#134), and a
// jsdom mount has no server: `account-actions.ts` is a `"use server"` module
// whose functions reach identity, the store and the mail seam. It is doubled
// here — the boundary, not the interface above it — so this file keeps
// asserting what the *screen* offers. What those functions actually do is
// `tests/app/settings/account.test.tsx`'s, against the real seam.
// The danger zone's two Server Functions reach the lifecycle engine and the
// request's own cookie jar (#259), and a jsdom mount has neither. Doubled
// here — the boundary, not the interface above it — so this file keeps
// asserting what the *screen* offers; what they do is
// `tests/app/settings/danger-actions.test.ts`'s, against the real engine.
vi.mock("@/app/(account)/app/settings/danger-actions", () => ({
  handoverState: async () => ({ taken: false }),
  runDangerAction: async () => ({ ran: false, lineKey: "danger.export-failed" }),
}));

vi.mock("@/app/(account)/app/settings/account-actions", () => ({
  signOutAction: async () => ({ done: "elsewhere", href: "/signin" }),
  beginEmailChangeAction: async () => ({ answer: "idle" }),
  cancelEmailChangeAction: async () => undefined,
}));

vi.mock("@/app/(account)/app/settings/actions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/(account)/app/settings/actions")>();
  const recorded = Object.fromEntries(
    Object.entries(actual.SETTINGS_ACTIONS).map(([key, run]) => [
      key,
      () => {
        calls.push(key);
        return run();
      },
    ])
  );
  return { ...actual, SETTINGS_ACTIONS: recorded };
});

// The three billing delegations reach Stripe and the database. This suite is
// about which key a control calls, not about what Stripe answers, so the
// `"use server"` module behind them is replaced wholesale — the same seam
// `billing-actions.test.ts` exercises for real.
vi.mock("@/app/(account)/app/settings/billing-actions", () => ({
  openBillingSurface: () => Promise.resolve({ done: "unreachable" as const }),
  cancelPlan: () => Promise.resolve({ done: "unreachable" as const }),
  resumePlan: () => Promise.resolve({ done: "unreachable" as const }),
}));

import SettingsPage from "@/app/(account)/app/settings/page";
import { BillingPanel } from "@/app/(account)/app/settings/panels/BillingPanel";
import { ACTIONS, SETTABLE } from "@/app/(account)/app/settings/settable";
import { FIXTURE_SETTINGS_FACTS } from "@/app/(account)/app/settings/fixture";
import { PRICE_KEYS, UNREACHABLE_BILLING_KEYS } from "@/app/(account)/app/settings/billing";
import { assembleSettings } from "@/app/(account)/app/settings/model";
import { COPY } from "@/lib/presentation/copy";
import * as constants from "@/lib/config/constants";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// `useAction` navigates on the `elsewhere` arm, which sign-out now takes.
// jsdom implements no navigation, so the real call logs a "Not implemented"
// error and tells this suite nothing; the stub records it instead, and
// `account.test.tsx` is where the destination is asserted.
const navigated: string[] = [];
Object.defineProperty(window, "location", {
  configurable: true,
  value: { ...window.location, assign: (href: string) => navigated.push(href) },
});

async function mount(node: React.ReactNode): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(node);
  });
  return container;
}

/** The screen, awaited to a tree (it is an async Server Component) and then
 *  mounted, so its client panels are live. */
async function mountScreen(): Promise<HTMLElement> {
  calls.length = 0;
  return mount(await SettingsPage());
}

function testIds(root: HTMLElement, prefix: string): string[] {
  return Array.from(root.querySelectorAll(`[data-testid^="${prefix}"]`))
    .map((el) => el.getAttribute("data-testid") ?? "")
    .map((id) => id.slice(prefix.length))
    .sort();
}

async function click(el: Element): Promise<void> {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

// ── REQ-070 criterion 1 ────────────────────────────────────────────────────
describe("REQ-070 c1 — the rendered control set is exactly the fourteen SETTABLE keys", () => {
  it("every settable key has a control, and no control names a key outside the tuple", async () => {
    const root = await mountScreen();
    expect(testIds(root, "setting-")).toEqual([...SETTABLE].sort());
  });

  it("each of the eight cards §4.7 names is on the screen, in its own column", async () => {
    const root = await mountScreen();
    const left = root.querySelector('[data-testid="settings-left"]');
    const right = root.querySelector('[data-testid="settings-right"]');
    expect(left).not.toBeNull();
    expect(right).not.toBeNull();
    // §4.7's left column: Your market · Competitors · Publishing · Notifications.
    expect(left?.textContent).toContain("settings.market.title");
    expect(left?.textContent).toContain("settings.competitors.title");
    expect(left?.textContent).toContain("settings.publishing.title");
    expect(left?.textContent).toContain("settings.notifications.title");
    // §4.7's right column: Billing · Account · Your content · Danger zone.
    expect(right?.textContent).toContain("settings.billing.title");
    expect(right?.textContent).toContain("settings.account.title");
    expect(right?.textContent).toContain("settings.content.title");
    expect(right?.textContent).toContain("danger.zone.title");
  });

  it("the market card states the one line §4.7 gives it, and states it once", async () => {
    const root = await mountScreen();
    const occurrences = (root.textContent ?? "").split("settings.market.effect").length - 1;
    expect(occurrences).toBe(1);
  });

  it("destination health renders as a word, never as a tone alone", async () => {
    const root = await mountScreen();
    const expired = root.querySelector('[data-testid="destination-dest-wordpress"]');
    expect(expired?.textContent).toContain("settings.destination.health.expired");
    // ADR-086: a broken destination carries an action leading somewhere,
    // and one written line saying what is true of the customer's pages.
    expect(expired?.textContent).toContain("settings.publishing.reconnect");
    expect(expired?.textContent).toContain("publish.destination.line.credentials-expired");
  });

  // BUILD §9, #48: the `destinations` migration makes one live destination
  // per site a database invariant, so the screen is drawn against exactly
  // one. A fixture with two would be a specimen of a state the database
  // refuses — and a screen tested against it would be testing a list it
  // can never receive.
  it("one live destination per site — the screen draws exactly one row", async () => {
    const root = await mountScreen();
    expect(root.querySelectorAll('[data-testid^="destination-"]')).toHaveLength(1);
  });
});

// ── REQ-070 criterion 2 ────────────────────────────────────────────────────
describe("REQ-070 c2 — the rendered action set is the seven ACTIONS entries", () => {
  it("every rendered action is one of the seven", async () => {
    const root = await mountScreen();
    for (const id of testIds(root, "action-")) {
      expect(ACTIONS as readonly string[]).toContain(id);
    }
  });

  it("the union over the two plan states is all seven — cancel and resume are one position", async () => {
    // REQ-076 c6: a running plan offers Cancel plan, a cancelled one offers
    // resume. Neither state shows both, so the closed offer is stated across
    // the two rather than inside one render.
    const active = await mountScreen();
    const cancelled = await mount(
      <BillingPanel
        billing={{ ...billingCard(), state: "cancelled" }}
      />
    );
    const offered = new Set([...testIds(active, "action-"), ...testIds(cancelled, "action-")]);
    expect([...offered].sort()).toEqual([...ACTIONS].sort());
    expect(testIds(active, "action-")).toContain("cancel");
    expect(testIds(active, "action-")).not.toContain("resume");
    expect(testIds(cancelled, "action-")).toContain("resume");
    expect(testIds(cancelled, "action-")).not.toContain("cancel");
  });

  it("each action's control calls its declared interface and nothing else", async () => {
    const root = await mountScreen();
    await click(root.querySelector('[data-testid="action-invoices"] button') as Element);
    expect(calls).toEqual(["invoices"]);

    calls.length = 0;
    await click(root.querySelector('[data-testid="action-sign_out"] button') as Element);
    expect(calls).toEqual(["sign_out"]);

    calls.length = 0;
    await click(root.querySelector('[data-testid="action-export"] button') as Element);
    expect(calls).toEqual(["export"]);
  });

  it("sign out is the one of the seven that is wired, and it takes the browser away (#134)", async () => {
    navigated.length = 0;
    const root = await mountScreen();
    await click(root.querySelector('[data-testid="action-sign_out"] button') as Element);
    // The other six still answer `not-yet` and navigate nowhere; this one
    // ends the session and hands the browser to a full request, which is the
    // only thing that re-runs `src/middleware.ts` with the jar as it now is.
    expect(navigated).toEqual(["/signin"]);
  });

  it("export is offered with no condition around it — REQ-078's \"always\"", async () => {
    const root = await mountScreen();
    const button = root.querySelector('[data-testid="action-export"] button') as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.disabled).toBe(false);
  });
});

// ── REQ-070 criterion 3 ────────────────────────────────────────────────────
describe("REQ-070 c3 — no control over an engine or spend parameter renders", () => {
  it("no rendered control names a pinned constant, in any casing", async () => {
    const root = await mountScreen();
    const pinned = new Set(Object.keys(constants).map((k) => k.toLowerCase()));
    expect(pinned.size).toBeGreaterThan(0);
    for (const id of testIds(root, "setting-")) {
      expect(pinned.has(id.toLowerCase())).toBe(false);
    }
  });

  it("and none is hidden behind a flag or a disclosure — a hidden control is still an offered one", async () => {
    const root = await mountScreen();
    // Nothing on the screen is withheld from the count: no collapsed section
    // and no `hidden` subtree, so the fourteen counted above are the fourteen
    // that exist, not the fourteen that happened to be open.
    expect(root.querySelectorAll("details")).toHaveLength(0);
    expect(root.querySelectorAll("[hidden]")).toHaveLength(0);
    expect(root.querySelectorAll('[data-testid^="setting-"]')).toHaveLength(SETTABLE.length);
  });
});

// ── REQ-079 criterion 1 ────────────────────────────────────────────────────
describe("REQ-079 c1 — each danger-zone action states its consequence before it runs", () => {
  it("the zone offers exactly two actions and its standing line", async () => {
    const root = await mountScreen();
    expect(root.querySelectorAll('[data-testid^="danger-"]')).toHaveLength(2);
    expect(root.textContent).toContain("danger.export-first");
  });

  it("at rest there is no control that runs either one", async () => {
    const root = await mountScreen();
    expect(root.querySelectorAll('[data-testid^="confirm-"]')).toHaveLength(0);
  });

  it("the first press opens the consequence step and runs nothing", async () => {
    const root = await mountScreen();
    await click(root.querySelector('[data-testid="action-delete_account"] button') as Element);
    expect(calls).toEqual([]);
    expect(root.querySelector('[data-testid="consequence-delete_account"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="confirm-delete_account"]')).not.toBeNull();
    // Opening one does not open the other.
    expect(root.querySelector('[data-testid="consequence-unpublish_all"]')).toBeNull();
  });

  it("the step's own export control is what reaches the seam, and the confirming one is held (#259)", async () => {
    const root = await mountScreen();
    await click(root.querySelector('[data-testid="action-unpublish_all"] button') as Element);
    expect(calls).toEqual([]);

    // REQ-079 c3's first gate: the archive is handed over before anything
    // is destroyed, and that hand-off is what this action key reaches.
    const gate = root.querySelector('[data-testid="export-unpublish_all"] button') as HTMLButtonElement;
    expect(gate).not.toBeNull();
    await click(gate);
    expect(calls).toEqual(["unpublish_all"]);

    // c2's second gate: the confirming control is disabled until the
    // customer has typed the word, so no press of it can run anything.
    const confirm = root.querySelector('[data-testid="confirm-unpublish_all"] button') as HTMLButtonElement;
    expect(confirm).not.toBeNull();
    expect(confirm.disabled).toBe(true);
  });
});

// ── REQ-097 ────────────────────────────────────────────────────────────────
describe("REQ-097 — the Billing card renders no number ReachKit computed", () => {
  it("it states no next invoice, no card and no invoice history", async () => {
    // REQ-097 c5, and the ruling on issue #34 that settled which of §4.7's
    // four things survive it: the plan, the price and the control.
    const root = await mountScreen();
    expect(root.querySelector('[data-testid="billing-next-invoice"]')).toBeNull();
    expect(root.querySelector('[data-testid="billing-card"]')).toBeNull();
    expect(root.querySelector('[data-testid="billing-plan"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="billing-price"]')).not.toBeNull();
  });

  it("every digit on the card comes from the price copy or the access-end day", async () => {
    const root = await mountScreen();
    const card = root.querySelector('[data-testid="action-invoices"]')?.closest(".card");
    expect(card).not.toBeNull();
    let text = card?.textContent ?? "";

    // The price, as the registry states it — a public product fact, not a
    // value read back from a vendor (REQ-097's own non-goal).
    for (const key of PRICE_KEYS) {
      const value = COPY[key];
      if (value !== "") text = text.split(value).join("");
    }
    // The day access ends — `users.paid_through`, this product's own gate
    // (ADR-050) and the date REQ-076 c3 requires the customer be told.
    const { accessUntil } = billingCard();
    text = text.split(accessUntil).join("");

    // Whatever is left is the card's words. If a figure survived this
    // subtraction, ReachKit rendered a billing number of its own.
    expect(text).not.toMatch(/[0-9]/);
  });

  it("the three billing controls lead to the one Stripe destination", async () => {
    // REQ-097 c1: "ReachKit offers no separate control per item … the only
    // thing ReachKit offers for it is a control to that same one destination."
    // `invoices` and Update card are two affordances onto one action.
    const root = await mountScreen();
    const card = root.querySelector('[data-testid="action-invoices"]')?.closest(".card");
    const buttons = Array.from(card?.querySelectorAll("button") ?? []);
    const labels = buttons.map((b) => b.textContent);
    expect(labels).toContain("settings.billing.invoices");
    expect(labels).toContain("settings.billing.update-card");
    expect(labels).toContain("settings.billing.cancel");

    calls.length = 0;
    const updateCard = buttons.find((b) => b.textContent === "settings.billing.update-card");
    await click(updateCard as Element);
    expect(calls).toEqual(["invoices"]);
  });
});

// ── REQ-097 criterion 6 ────────────────────────────────────────────────────
// The `billing-actions` mock at the top of this file answers `unreachable`
// for all three controls, so every press below is a press against a billing
// surface that could not be produced — the state criterion 6 is about.
describe("REQ-097 c6 — a billing surface that cannot be produced is written on the screen the customer was on", () => {
  it("the three statements the criterion names are rendered, in its order", async () => {
    const root = await mountScreen();
    await click(root.querySelector('[data-testid="action-invoices"] button') as Element);
    const card = root.querySelector('[data-testid="action-invoices"]')?.closest(".card");
    const text = card?.textContent ?? "";
    // That billing cannot be reached, that they may try again, and one way
    // to reach a person. Three keys, so the owner can write each of them.
    for (const key of UNREACHABLE_BILLING_KEYS) expect(text).toContain(key);
    expect(text.indexOf("settings.billing.unreachable")).toBeLessThan(text.indexOf("settings.billing.try-again"));
    expect(text.indexOf("settings.billing.try-again")).toBeLessThan(text.indexOf("settings.billing.reach-a-person"));
  });

  it("cancel and resume are told the same way — the arm does not differ by control", async () => {
    const root = await mountScreen();
    await click(root.querySelector('[data-testid="action-cancel"] button') as Element);
    const active = root.querySelector('[data-testid="action-invoices"]')?.closest(".card")?.textContent ?? "";
    expect(active).toContain("settings.billing.unreachable");

    const cancelled = await mount(
      <BillingPanel
        billing={{ ...billingCard(), state: "cancelled" }}
      />
    );
    await click(cancelled.querySelector('[data-testid="action-resume"] button') as Element);
    expect(cancelled.textContent ?? "").toContain("settings.billing.unreachable");
  });

  it("nothing stands in its place — no ReachKit field, form, payment step or cancellation control appears", async () => {
    const root = await mountScreen();
    const card = root.querySelector('[data-testid="action-invoices"]')?.closest(".card");
    const before = card?.querySelectorAll("input, form, select, textarea").length ?? -1;
    await click(root.querySelector('[data-testid="action-invoices"] button') as Element);
    expect(card?.querySelectorAll("input, form, select, textarea")).toHaveLength(before);
  });

  it("the customer stays on Settings — the failing arm navigates nowhere", async () => {
    // `elsewhere` is the only arm that assigns a location, and this one is
    // not it. A screen that navigated on a refusal would take the customer
    // off the screen the criterion says they must be told on.
    const root = await mountScreen();
    const planBefore = root.querySelector('[data-testid="billing-plan"]')?.textContent;
    await click(root.querySelector('[data-testid="action-invoices"] button') as Element);
    expect(root.querySelector('[data-testid="action-invoices"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="billing-plan"]')?.textContent).toBe(planBefore);
  });
});
