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
// records which key was called and then calls the real stub, so "the control
// calls its declared interface" is asserted against the interface that ships
// rather than against a double that agrees with the test.
import { describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";

const { calls } = vi.hoisted(() => ({ calls: [] as string[] }));

vi.mock("@/lib/presentation/copy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/presentation/copy")>();
  return { ...actual, copy: (key: string) => key };
});

vi.mock("@/app/(account)/app/settings/actions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/(account)/app/settings/actions")>();
  const recorded = Object.fromEntries(
    Object.entries(actual.FIXTURE_ACTIONS).map(([key, run]) => [
      key,
      () => {
        calls.push(key);
        return run();
      },
    ])
  );
  return { ...actual, FIXTURE_ACTIONS: recorded };
});

import SettingsPage from "@/app/(account)/app/settings/page";
import { BillingPanel } from "@/app/(account)/app/settings/panels/BillingPanel";
import { ACTIONS, SETTABLE } from "@/app/(account)/app/settings/settable";
import { FIXTURE_SETTINGS_FACTS } from "@/app/(account)/app/settings/fixture";
import { billingValues } from "@/app/(account)/app/settings/billing";
import * as constants from "@/lib/config/constants";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
    // ADR-086: a credential that cannot publish carries an action leading
    // somewhere, and the healthy destination does not.
    expect(expired?.textContent).toContain("settings.publishing.reconnect");
    const ok = root.querySelector('[data-testid="destination-dest-hosted"]');
    expect(ok?.textContent).toContain("settings.destination.health.ok");
    expect(ok?.textContent).not.toContain("settings.publishing.reconnect");
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
      <BillingPanel billing={{ ...FIXTURE_SETTINGS_FACTS.billing, state: "cancelled" }} />
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

  it("only the control inside the step calls the interface", async () => {
    const root = await mountScreen();
    await click(root.querySelector('[data-testid="action-unpublish_all"] button') as Element);
    expect(calls).toEqual([]);
    await click(root.querySelector('[data-testid="confirm-unpublish_all"] button') as Element);
    expect(calls).toEqual(["unpublish_all"]);
  });
});

// ── REQ-097 ────────────────────────────────────────────────────────────────
describe("REQ-097 — the Billing card renders no number ReachKit computed", () => {
  it("each value it states is exactly the text Stripe produced", async () => {
    const root = await mountScreen();
    const billing = FIXTURE_SETTINGS_FACTS.billing;
    expect(root.querySelector('[data-testid="billing-plan"]')?.textContent).toBe(billing.plan.text);
    expect(root.querySelector('[data-testid="billing-next-invoice"]')?.textContent).toBe(
      billing.nextInvoice.text
    );
    expect(root.querySelector('[data-testid="billing-card"]')?.textContent).toBe(billing.card.text);
  });

  it("every digit in the card comes from one of those Stripe values", async () => {
    const root = await mountScreen();
    const card = root.querySelector('[data-testid="action-invoices"]')?.closest(".card");
    expect(card).not.toBeNull();
    let text = card?.textContent ?? "";
    for (const value of billingValues(FIXTURE_SETTINGS_FACTS.billing)) {
      text = text.split(value.text).join("");
    }
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
