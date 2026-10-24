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
  return { ...actual, requireSetUpAccount: async () => RESERVED_ACCOUNT, requireAppAccount: async () => RESERVED_ACCOUNT };
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

import SettingsBusinessTab from "@/app/(account)/app/settings/page";
import SettingsMarketTab from "@/app/(account)/app/settings/market/page";
import SettingsPublishingTab from "@/app/(account)/app/settings/publishing/page";
import SettingsVoiceTab from "@/app/(account)/app/settings/voice/page";
import SettingsMailTab from "@/app/(account)/app/settings/mail/page";
import SettingsBillingTab from "@/app/(account)/app/settings/billing/page";
import SettingsAccountTab from "@/app/(account)/app/settings/account/page";
import { SETTINGS_TABS, SETTINGS_TAB_HREF, settingsTabOf } from "@/app/(account)/app/settings/tabs";
import { BillingPanel } from "@/app/(account)/app/settings/panels/BillingPanel";
import { PublishingPanel } from "@/app/(account)/app/settings/panels/PublishingPanel";
import { destinationView } from "@/lib/publish/destinations/view";
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

/** Every tab's own Server Component, keyed by the tab it draws — the seven
 *  addresses `tabs.ts` names, so a tab added to that tuple without a screen
 *  here is a hole this file's last test reports rather than a control that
 *  quietly stops being offered. */
const TAB_SCREEN: Readonly<
  Record<(typeof SETTINGS_TABS)[number], () => Promise<React.JSX.Element>>
> = {
  business: SettingsBusinessTab,
  market: SettingsMarketTab,
  publishing: SettingsPublishingTab,
  voice: SettingsVoiceTab,
  mail: SettingsMailTab,
  billing: SettingsBillingTab,
  account: SettingsAccountTab,
};

/**
 * The screen, awaited to a tree (each tab is an async Server Component) and
 * then mounted, so its client panels are live.
 *
 * **All seven tabs at once, and that is what "the screen" now means**
 * (#925). Settings is seven addresses since the redesign, and the promise
 * these tests read is a *closed offer* — exactly the thirteen settings and
 * exactly the seven actions, across the whole of Settings. A suite that
 * mounted one tab would assert that one tab's subset and call the offer
 * closed, which is the opposite of what REQ-070 asks. So the offer is read
 * off the union, exactly as REQ-076 c6's cancel/resume pair is already read
 * off the union of two plan states below.
 *
 * The seven trees share one container, so every assertion about *which*
 * control exists, what it calls and what it says reads unchanged; the tests
 * that care which tab a card is on look for that tab's own panel wrapper.
 */
async function mountScreen(): Promise<HTMLElement> {
  calls.length = 0;
  const trees = await Promise.all(SETTINGS_TABS.map((tab) => TAB_SCREEN[tab]()));
  return mount(
    <>
      {SETTINGS_TABS.map((tab, i) => (
        <React.Fragment key={tab}>{trees[i]}</React.Fragment>
      ))}
    </>
  );
}

/** One tab on its own, for the assertions that are about where a card
 *  lives rather than about the offer as a whole. */
async function mountTab(tab: (typeof SETTINGS_TABS)[number]): Promise<HTMLElement> {
  calls.length = 0;
  return mount(await TAB_SCREEN[tab]());
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
describe("REQ-070 c1 — the rendered control set is exactly the SETTABLE keys", () => {
  it("every settable key has a control, and no control names a key outside the tuple", async () => {
    const root = await mountScreen();
    expect(testIds(root, "setting-")).toEqual([...SETTABLE].sort());
  });

  // SPEC §4 (2026-09-20): "Settings is tabs: Your business, Market and
  // rivals, Publishing, Your voice, Mail, Billing, Account. The danger zone
  // lives in Account." Every one of the nine cards §4.7 names still exists
  // and each is on exactly one tab — which is what "moved as they are"
  // means, and what makes the union above the whole offer rather than most
  // of it.
  it("each of §4.7's nine cards is on exactly one tab, and the danger zone is in Account", async () => {
    const where: Readonly<Record<string, (typeof SETTINGS_TABS)[number]>> = {
      "settings.content.export": "account",
      "settings.market.title": "market",
      "settings.competitors.title": "market",
      "settings.publishing.title": "publishing",
      "settings.voice.title": "voice",
      "settings.notifications.title": "mail",
      "settings.billing.title": "billing",
      "settings.account.title": "account",
      "danger.zone.title": "account",
    };
    const drawn = new Map<(typeof SETTINGS_TABS)[number], string>();
    // A link that names a tab (Mail's "Change it under Account") is a pointer, not the card.
    for (const tab of SETTINGS_TABS) {
      const root = await mountTab(tab);
      root.querySelectorAll("a").forEach((a) => a.remove());
      drawn.set(tab, root.textContent ?? "");
    }

    for (const [title, tab] of Object.entries(where)) {
      expect(drawn.get(tab), `${title} belongs on the ${tab} tab`).toContain(title);
      // And nowhere else: a card drawn twice is two places to change it,
      // and two cards that can disagree about the same setting.
      for (const other of SETTINGS_TABS) {
        if (other === tab) continue;
        expect(drawn.get(other), `${title} must not also be on ${other}`).not.toContain(title);
      }
    }
  });

  it("the danger zone is the foot of Account, below the account card", async () => {
    // #925: "keep the danger zone out of the way": below the two ordinary
    // things a customer came for, and folded shut (board SettingsAccount).
    const text = (await mountTab("account")).textContent ?? "";
    expect(text.indexOf("settings.account.title")).toBeLessThan(text.indexOf("danger.zone.title"));
  });

  it("the bar offers the seven tabs, each its own address, and no tab is its own prefix", async () => {
    expect([...SETTINGS_TABS]).toEqual([
      "business",
      "market",
      "publishing",
      "voice",
      "mail",
      "billing",
      "account",
    ]);
    // Business is `/app/settings` itself, so the menu's own link does not
    // move; every other tab is a sub-path of it, and each address resolves
    // back to exactly the tab that owns it.
    expect(SETTINGS_TAB_HREF.business).toBe("/app/settings");
    for (const tab of SETTINGS_TABS) {
      expect(settingsTabOf(SETTINGS_TAB_HREF[tab])).toBe(tab);
    }
    // The prefix trap `tabOf` and `destinationOf` both name: a prefix match
    // would make every tab read as Business.
    expect(settingsTabOf("/app/settings/nothing-here")).toBeUndefined();
  });

  it("the market card states each consequence §4.7 gives it, and states it once", async () => {
    const root = await mountTab("market");
    for (const key of ["settings.market.consequence.website", "settings.market.consequence.market"]) {
      expect((root.textContent ?? "").split(key).length - 1, key).toBe(1);
    }
  });

  it("destination health renders as a word, never as a tone alone", async () => {
    const settings = assembleSettings({
      ...FIXTURE_SETTINGS_FACTS,
      destinations: [
        destinationView({ id: "dest-wordpress", kind: "wordpress", health: "expired", reason: "credentials_expired", lastCheckedAt: new Date("2026-09-06T07:00:00.000Z"), heldPages: 3 }),
      ],
    });
    const root = await mount(<PublishingPanel settings={settings} />);
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

  it("and none is hidden behind a flag — a folded control is still an offered one", async () => {
    const root = await mountScreen();
    // The boards fold the danger zone, Billing's detail and Your business's
    // three cards, and a closed fold keeps its controls in the document: every
    // control counted above exists, and no `hidden` subtree withholds one.
    expect([...root.querySelectorAll("details")].map((d) => d.getAttribute("data-testid")).sort()).toEqual([
      "billing-month-detail",
      "settings-business-facts",
      "settings-business-knowledge",
      "settings-competitors-detail",
      "settings-danger",
      "settings-known-content",
    ]);
    expect(root.querySelector('details[data-testid="settings-danger"] [data-testid="confirm-delete_account"] button')).not.toBeNull();
    expect(root.querySelectorAll("[hidden]")).toHaveLength(0);
    expect(root.querySelectorAll('[data-testid^="setting-"]')).toHaveLength(SETTABLE.length);
  });
});

describe("E28 — a card title states its subject in words", () => {
  it.each([
    ["business", 5],
    ["voice", 3],
  ] as const)("no settings card title carries an icon (E28): %s", async (tab, least) => {
    const root = await mountTab(tab);
    const titles = [...root.querySelectorAll("h2, summary, legend, .card-title")];
    expect(titles.length).toBeGreaterThanOrEqual(least);
    for (const title of titles) expect(title.querySelector("svg")).toBeNull();
  });
});

// ── REQ-079 criterion 1 ────────────────────────────────────────────────────
describe("REQ-079 c1 — each danger-zone action states its consequence before it runs", () => {
  it("the zone offers exactly two actions, folded shut at rest", async () => {
    const root = await mountScreen();
    expect(testIds(root, "danger-").filter((id) => id === "unpublish_all" || id === "delete_account")).toEqual([
      "delete_account",
      "unpublish_all",
    ]);
    expect((root.querySelector('[data-testid="settings-danger"]') as HTMLDetailsElement).open).toBe(false);
  });

  it("each action states its consequence before its confirming control, which is held until the word is typed", async () => {
    const root = await mountScreen();
    for (const action of ["unpublish_all", "delete_account"]) {
      const step = root.querySelector(`[data-testid="danger-${action}"]`)!;
      const consequence = step.querySelector(`[data-testid="consequence-${action}"]`)!;
      const confirm = step.querySelector(`[data-testid="confirm-${action}"] button`) as HTMLButtonElement;
      expect(consequence.compareDocumentPosition(confirm) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(confirm.disabled).toBe(true);
    }
    expect(calls).toEqual([]);
  });

  it("the step's own export control is what reaches the seam, and the confirming one is held (#259)", async () => {
    const root = await mountScreen();
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
  // **2026-09-09, on the review of #391 (issue #374).** REQ-097 c5
  // reads "no ReachKit surface states any of those values", and the ruling
  // on issue #34 settled §4.7's four things down to the plan, the price and
  // the control. The approved screen set draws the next-invoice row and the
  // card row, and the review — having been shown c5 and that ruling in the
  // PR body — asked for both. So the two rows are drawn, and **c5 needs
  // amending to say so**; that is named in #391 and is the owner's to do.
  //
  // What this file still holds is the half of c5 that no ruling touched:
  // every figure on the card is one ReachKit itself owns. The next-invoice
  // row is not a vendor read at all — the day is `users.paid_through`, this
  // product's own access gate, and the amount is the same `price.amount`
  // key every price surface speaks. The card row is the one exception and
  // it is drawn only where something read one: `users` holds no card, so
  // the live path answers `null` and the row is absent (`billing.ts`).
  it("it states the next invoice and the card, from facts it owns", async () => {
    const root = await mountScreen();
    expect(root.querySelector('[data-testid="billing-next-invoice"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="billing-card"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="billing-price"]')).not.toBeNull();
    // The plan ROW is gone: there is one plan (REQ-022 c3), the pill states
    // whether it is running, and the figure states its price — a row
    // repeating the plan's name said nothing the two had not.
    expect(root.querySelector('[data-testid="billing-plan"]')).toBeNull();
    expect(root.querySelector('[data-testid="billing-state"]')).not.toBeNull();
  });

  it("the next invoice is the access-end day and the price copy, not a second read", async () => {
    // The discriminating property: the row's date is the model's own
    // `accessUntil` — `users.paid_through`, this product's access gate —
    // and not a second date from somewhere else. The cancelling line below
    // it is fed the same value through its `{date}` slot (`BillingPanel`),
    // so the two cannot drift; that slot is not interpolated in this suite,
    // where `copy()` resolves to its key.
    const root = await mountScreen();
    const { accessUntil } = billingCard();
    const row = root.querySelector('[data-testid="billing-next-invoice"]')?.textContent ?? "";
    expect(row).toContain(accessUntil);
    // And the amount beside it is the price copy, not a computed figure.
    // `copy()` resolves to its key in this suite — the shell's convention,
    // so an assertion names which key a value came from rather than the
    // owner's wording — so what stands in the row is the key itself.
    //
    // The AMOUNT only: the interval ("per month, VAT included") is a fact
    // about the plan and sits beside the headline figure, not on a row
    // stating one invoice.
    expect(row).toContain(PRICE_KEYS[0]);
  });

  it("every digit on the card comes from the price copy, the access-end day or the card on file", async () => {
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
    const summary = billingCard();
    text = text.split(summary.accessUntil).join("");
    // The one vendor-held value on the card, and the only one: it is drawn
    // where something read it and nowhere else, so subtracting it here is
    // subtracting a fact rather than excusing a computation.
    if (summary.cardLast4 !== null) text = text.split(summary.cardLast4).join("");

    // Whatever is left is the card's words. If a figure survived this
    // subtraction, ReachKit rendered a billing number of its own.
    expect(text).not.toMatch(/[0-9]/);
  });

  it("one control leads to the one Stripe destination, and the line names the three things it does", async () => {
    // REQ-097 c1: "ReachKit offers no separate control per item … the only
    // thing ReachKit offers for it is a control to that same one
    // destination." Until #925 this card drew three pills onto that one
    // action, which reads as three destinations; there is one now, and the
    // three things behind it are named in writing instead.
    const root = await mountTab("billing");
    const card = root.querySelector('[data-testid="action-invoices"]')?.closest(".card");
    const buttons = Array.from(card?.querySelectorAll("button") ?? []);
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.textContent).toContain("settings.billing.manage");
    expect(card?.querySelector('[data-testid="billing-manage-note"]')?.textContent).toBe(
      "settings.billing.manage.note"
    );

    // And it is the `invoices` interface it calls — the one that opens the
    // portal (`billing-actions.ts`: `openBillingSurface`, `cancelPlan` and
    // Update card were all `openPortal()`).
    calls.length = 0;
    await click(buttons[0] as Element);
    expect(calls).toEqual(["invoices"]);
  });

  it("cancelling is that same control — the offer is not lost by collapsing the pills", async () => {
    // The closed offer of seven actions has to stay complete *on the
    // screen*, not in a list. `cancel` and `invoices` are one affordance
    // now, so the control carries both names and pressing it is how a
    // customer cancels — on Stripe's surface, which is where cancelling has
    // always happened (REQ-097 c1, and this card shows no confirmation step
    // of its own).
    const root = await mountTab("billing");
    const cancel = root.querySelector('[data-testid="action-cancel"] button');
    const invoices = root.querySelector('[data-testid="action-invoices"] button');
    expect(cancel).not.toBeNull();
    expect(cancel).toBe(invoices);
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

describe("Settings › Market against board SettingsMarket", () => {
  it("no settings card title carries an icon (E28): market", async () => {
    const root = await mountTab("market");
    const titles = [...root.querySelectorAll("h2, summary, .card-title")];
    expect(titles.length).toBeGreaterThanOrEqual(3);
    for (const title of titles) expect(title.querySelector("svg")).toBeNull();
  });

  it("the market tab draws no process timeline: board SettingsMarket has none", async () => {
    const root = await mountTab("market");
    expect(root.querySelector('[data-testid="process-timeline"]')).toBeNull();
  });
});

describe("Publishing, Mail, Billing and Account carry their board icons, never in a card title", () => {
  it.each(["publishing", "mail", "billing", "account"] as const)("no settings card title carries an icon (E28): %s", async (tab) => {
    const root = await mountTab(tab);
    const titles = [...root.querySelectorAll("h2, summary, .card-title")];
    expect(titles.length).toBeGreaterThanOrEqual(1);
    for (const title of titles) expect(title.querySelector("svg")).toBeNull();
  });

  it("account's board icons: the sign-in well, Export, Sign out, and the danger list with its line", async () => {
    const root = await mountTab("account");
    const icons = (el: Element | null) => [...(el?.querySelectorAll("svg") ?? [])].map((svg) => [...svg.classList].filter((c) => c.startsWith("lucide-")).at(-1));
    expect(icons(root.querySelector('[data-testid="account-signin"]'))).toEqual([
      "lucide-mail",
      "lucide-arrow-right",
      "lucide-link",
      "lucide-arrow-right",
      "lucide-circle-check",
    ]);
    expect(icons(root.querySelector('[data-testid="action-export"]'))).toEqual(["lucide-download"]);
    expect(icons(root.querySelector('[data-testid="action-sign_out"]'))).toEqual(["lucide-log-out"]);
    expect(icons(root.querySelector('[data-testid="danger-compare"]'))).toEqual(["lucide-pause", "lucide-file-x", "lucide-trash-2"]);
    expect(icons(root.querySelector('[data-testid="danger-pause-line"]'))).toEqual(["lucide-info"]);
    for (const svg of root.querySelectorAll("[data-testid] svg")) expect(svg.getAttribute("aria-hidden")).toBe("true");
  });
});
