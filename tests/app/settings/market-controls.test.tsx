/** @vitest-environment jsdom */
// tests/app/settings/market-controls.test.tsx — BUILD §4.7, REQ-071,
// issue #231
//
// Edit and add, from the press to the seam. `change-actions.test.ts` asks
// what the four Server Functions do; this file asks the other half — does
// the card reach them, with what the customer typed, and does it state the
// answer it gets back.
//
// The mutation that survives every static render is a control that *looks*
// wired: an Edit that opens a field the submit never reads, a refusal
// swallowed, a save that leaves the old value on screen. So every row here
// presses something.
//
// **The server boundary is doubled**, as `account-panel.test.tsx` doubles
// it: a jsdom mount has no server. `copy()` resolves to its key, the
// shell's convention — the assertions are about which key a line comes
// from, never the owner's wording.
import { beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

vi.mock("@/lib/presentation/copy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/presentation/copy")>();
  return {
    ...actual,
    copy: (key: string, vars?: Record<string, string | number>) =>
      vars === undefined ? key : `${key}(${Object.values(vars).join("|")})`,
  };
});

type Answer =
  | { answer: "idle" }
  | { answer: "saved"; effectiveOn: string }
  | { answer: "refused"; lineKey: string; value: string };

const { pressed, reply } = vi.hoisted(() => ({
  pressed: [] as { action: string; value: string }[],
  reply: { next: { answer: "idle" } as Answer },
}));

/** The four Server Functions, doubled at the module boundary — the last
 *  line of this screen's own code before the request leaves it. */
vi.mock("@/app/(account)/app/settings/change-actions", () => {
  const record = (action: string, field: string) => async (form: FormData) => {
    pressed.push({ action, value: String(form.get(field) ?? "") });
    return reply.next;
  };
  return {
    saveDomainAction: record("domain", "market_domain"),
    saveCategoryAction: record("category", "market_category"),
    addRivalAction: record("add", "rival_domain"),
    removeRivalAction: record("remove", "rival_domain"),
  };
});

const { assembleSettings } = await import("@/app/(account)/app/settings/model");
type SettingsFacts = import("@/app/(account)/app/settings/model").SettingsFacts;
const { FIXTURE_SETTINGS_FACTS } = await import("@/app/(account)/app/settings/fixture");
const { MarketPanel } = await import("@/app/(account)/app/settings/panels/MarketPanel");
const { CompetitorsPanel } = await import(
  "@/app/(account)/app/settings/panels/CompetitorsPanel"
);
const { formatDate } = await import("@/app/(account)/app/_shell/format");
const { BATTERY } = await import("@/lib/config/constants");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ZONE = "America/New_York";

function settings(over: Partial<SettingsFacts> = {}) {
  return assembleSettings({ ...FIXTURE_SETTINGS_FACTS, timeZone: ZONE, ...over });
}

async function mount(el: React.ReactElement): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(el);
  });
  return container;
}

async function market(over: Partial<SettingsFacts> = {}): Promise<HTMLElement> {
  const model = settings(over);
  return mount(
    <MarketPanel market={model.market} domain={model.domain} timeZone={ZONE} />
  );
}

async function competitors(list: readonly string[]): Promise<HTMLElement> {
  return mount(<CompetitorsPanel competitors={list} />);
}

const text = (root: HTMLElement): string => root.textContent ?? "";

/** A press, the way a person makes one. */
async function press(el: Element | null): Promise<void> {
  await act(async () => {
    (el as HTMLElement).click();
  });
}

/** Typing into a controlled field: React reads the native value, so the
 *  prototype setter is what a keystroke looks like from here. */
async function type(field: Element | null, value: string): Promise<void> {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set;
    setter?.call(field as HTMLInputElement, value);
    (field as HTMLInputElement).dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function submit(form: Element | null): Promise<void> {
  await act(async () => {
    (form as HTMLFormElement).requestSubmit();
  });
}

/** The Edit beside a value, and the Save inside an open field. Found by the
 *  key each speaks, because `copy()` resolves to its key here. */
function button(root: Element, label: string): Element | null {
  return [...root.querySelectorAll("button")].find((el) => el.textContent === label) ?? null;
}

/** One control's own corner of the card. Every lookup here is scoped to it:
 *  the card offers two Edits that speak the same word, and a helper that
 *  took the first would press the market's while claiming to press the
 *  domain's — and would go on passing when the two were wired the wrong way
 *  round. The add field is scoped for the same reason: a chip's remove
 *  carries its domain in a field of the same name. */
function within(root: HTMLElement, testid: string): Element {
  const el = root.querySelector(`[data-testid="${testid}"]`);
  if (el === null) throw new Error(`no [data-testid="${testid}"] on this card`);
  return el;
}

const edit = (root: HTMLElement, control: "setting-domain" | "setting-category"): Element | null =>
  button(within(root, control), "settings.edit");

const line = (root: HTMLElement): string =>
  root.querySelector('[data-testid="market-change-line"]')?.textContent ?? "";

beforeEach(() => {
  document.body.innerHTML = "";
  pressed.length = 0;
  reply.next = { answer: "idle" };
});

describe("Edit opens the field it belongs to", () => {
  it("at rest there is no field open, and the card states its standing effect", async () => {
    const root = await market();
    expect(root.querySelector('[data-testid="edit-domain"]')).toBeNull();
    expect(root.querySelector('[data-testid="edit-category"]')).toBeNull();
    expect(text(root)).toContain("settings.market.effect");
  });

  it("Edit on the domain opens a field holding the domain the site is measured under", async () => {
    const root = await market();
    await press(edit(root, "setting-domain"));
    const field = root.querySelector('[name="market_domain"]') as HTMLInputElement;
    expect(field).not.toBeNull();
    expect(field.value).toBe(settings().domain);
  });

  it("Edit on the market opens a field holding the category", async () => {
    const root = await market();
    await press(edit(root, "setting-category"));
    const field = root.querySelector('[name="market_category"]') as HTMLInputElement;
    expect(field.value).toBe(settings().market.category);
  });

  it("opening the second closes the first — one answer is being typed at a time", async () => {
    const root = await market();
    await press(edit(root, "setting-category"));
    expect(root.querySelector('[name="market_category"]')).not.toBeNull();
    await press(edit(root, "setting-domain"));
    expect(root.querySelector('[name="market_category"]')).toBeNull();
    expect(root.querySelector('[name="market_domain"]')).not.toBeNull();
  });

  it("leaving the field changes nothing and asks nothing of the seam", async () => {
    const root = await market();
    await press(edit(root, "setting-domain"));
    await press(button(root, "settings.cancel-edit"));
    expect(root.querySelector('[data-testid="edit-domain"]')).toBeNull();
    expect(pressed).toEqual([]);
    expect(text(root)).toContain("settings.market.effect");
  });

  it("REQ-070 c1 — the closed offer of controls is the same with a field open", async () => {
    const root = await market();
    const offered = (): string[] =>
      [...root.querySelectorAll("[data-testid]")]
        .map((el) => el.getAttribute("data-testid") ?? "")
        .filter((id) => id.startsWith("setting-"));
    const atRest = offered();
    // The site first and the market second, which is the approved S18's own
    // order and the card's own name — "Your site & market" (issue #374).
    // What this row holds is unchanged: the offer is the same two controls
    // whether a field is open or not.
    expect(atRest).toEqual(["setting-domain", "setting-category"]);
    await press(edit(root, "setting-domain"));
    expect(offered()).toEqual(atRest);
  });
});

describe("REQ-071 c1 — the consequence is stated before the button is pressed", () => {
  it("an open field states the pending line, dated for the change a save now would make", async () => {
    const root = await market();
    await press(edit(root, "setting-domain"));
    expect(line(root)).toBe(
      `settings.market.pending(${settings().market.wouldTakeEffectOn}|settings.market.change.domain)`
    );
  });

  it("the line names the answer being changed — the market, not the domain", async () => {
    const root = await market();
    await press(edit(root, "setting-category"));
    expect(line(root)).toContain("settings.market.change.category");
  });

  it("the standing effect line gives way to it, so the card states one dated sentence", async () => {
    const root = await market();
    await press(edit(root, "setting-domain"));
    expect(text(root)).not.toContain("settings.market.effect(");
    expect(root.querySelectorAll('[data-testid="market-change-line"]')).toHaveLength(1);
  });
});

describe("the press goes to the seam, and the answer comes back to the card", () => {
  it("REQ-071 c6 — submitting hands the typed domain to saveDomain, verbatim", async () => {
    const root = await market();
    await press(edit(root, "setting-domain"));
    await type(root.querySelector('[name="market_domain"]'), "newname.com");
    await submit(root.querySelector('[data-testid="edit-domain"]'));
    expect(pressed).toEqual([{ action: "domain", value: "newname.com" }]);
  });

  it("the market's field goes to saveCategory, not to saveDomain", async () => {
    const root = await market();
    await press(edit(root, "setting-category"));
    await type(root.querySelector('[name="market_category"]'), "agency work");
    await submit(root.querySelector('[data-testid="edit-category"]'));
    expect(pressed).toEqual([{ action: "category", value: "agency work" }]);
  });

  it("a saved change closes the field and states when it takes effect", async () => {
    const effectiveOn = "2026-09-21T10:00:00.000Z";
    reply.next = { answer: "saved", effectiveOn };
    const root = await market();
    await press(edit(root, "setting-domain"));
    await type(root.querySelector('[name="market_domain"]'), "newname.com");
    await submit(root.querySelector('[data-testid="edit-domain"]'));

    expect(root.querySelector('[data-testid="edit-domain"]')).toBeNull();
    // The date the press earned, in the customer's own zone, through the
    // one formatter the rest of the screen uses.
    expect(line(root)).toBe(
      `settings.market.effectiveOn(${formatDate(new Date(effectiveOn), ZONE)})`
    );
  });

  it("a refused save keeps the field open, the value intact, and speaks its line", async () => {
    reply.next = {
      answer: "refused",
      lineKey: "settings.market.refused.unreachable",
      value: "nowhere.invalid",
    };
    const root = await market();
    await press(edit(root, "setting-domain"));
    await type(root.querySelector('[name="market_domain"]'), "nowhere.invalid");
    await submit(root.querySelector('[data-testid="edit-domain"]'));

    const field = root.querySelector('[name="market_domain"]') as HTMLInputElement;
    expect(field).not.toBeNull();
    expect(field.value).toBe("nowhere.invalid");
    expect(text(root)).toContain("settings.market.refused.unreachable");
  });

  it("a refusal is not a save — the card states no effective date for one", async () => {
    reply.next = {
      answer: "refused",
      lineKey: "settings.market.refused.unreachable",
      value: "nowhere.invalid",
    };
    const root = await market();
    await press(edit(root, "setting-domain"));
    await submit(root.querySelector('[data-testid="edit-domain"]'));
    expect(line(root)).not.toContain("settings.market.effectiveOn");
  });

  it("Edit again after a save asks a fresh question, not the last answer over again", async () => {
    reply.next = { answer: "saved", effectiveOn: "2026-09-21T10:00:00.000Z" };
    const root = await market();
    await press(edit(root, "setting-domain"));
    await submit(root.querySelector('[data-testid="edit-domain"]'));
    await press(edit(root, "setting-domain"));
    // The field reopened, and the card is back to stating what a change
    // being typed would do rather than what the last one did.
    expect(root.querySelector('[data-testid="edit-domain"]')).not.toBeNull();
    expect(line(root)).toContain("settings.market.pending");
  });
});

describe("REQ-071 c2 and c4 — the competitors control", () => {
  const TWO = ["rival.com", "asana.com"];

  it("adding hands the typed domain to the seam", async () => {
    const root = await competitors(TWO);
    const add = within(root, "add-competitor");
    await type(add.querySelector('[name="rival_domain"]'), "notion.com");
    await submit(add);
    expect(pressed).toEqual([{ action: "add", value: "notion.com" }]);
  });

  it("a rival that went in leaves the field empty, ready for the next", async () => {
    reply.next = { answer: "saved", effectiveOn: "2026-09-21T10:00:00.000Z" };
    const root = await competitors(TWO);
    const add = within(root, "add-competitor");
    await type(add.querySelector('[name="rival_domain"]'), "notion.com");
    await submit(add);
    expect((add.querySelector('[name="rival_domain"]') as HTMLInputElement).value).toBe("");
  });

  it("a refused rival stays in the field, with the reason beside it", async () => {
    reply.next = {
      answer: "refused",
      lineKey: "settings.competitors.refused.already-present",
      value: "rival.com",
    };
    const root = await competitors(TWO);
    const add = within(root, "add-competitor");
    await type(add.querySelector('[name="rival_domain"]'), "rival.com");
    await submit(add);
    expect((add.querySelector('[name="rival_domain"]') as HTMLInputElement).value).toBe("rival.com");
    expect(text(root)).toContain("settings.competitors.refused.already-present");
  });

  it("each chip removes its own domain, and the press carries which one", async () => {
    const root = await competitors(TWO);
    const chip = root.querySelector('[data-testid="competitor-asana.com"]');
    await submit(chip?.querySelector("form") ?? null);
    expect(pressed).toEqual([{ action: "remove", value: "asana.com" }]);
  });

  // Issue #488: S18 draws a rival as the set's `.tag.on`, the tag `/setup`
  // already renders — so the chip is `RemovableTag`, the form's submit,
  // named by setup's removal key with the domain in it, and the second
  // chip shape (`.rk-chip` + a `Btn`) is gone.
  it("each rival is the registered RemovableTag, submitting its own form", async () => {
    const root = await competitors(TWO);
    const chip = within(root, "competitor-asana.com");
    const tag = chip.querySelector("form > button.rk-tag");
    expect(tag?.getAttribute("type")).toBe("submit");
    expect(tag?.getAttribute("aria-label")).toBe("setup.competitors.remove(asana.com)");
    expect(tag?.querySelector(".num")?.textContent).toBe("asana.com");
    expect(root.querySelector(".rk-chip")).toBeNull();
  });

  it("§6.1 — a full set offers no way to add a sixth", async () => {
    const five = Array.from({ length: BATTERY.COMPETITORS_MAX }, (_, i) => `rival-${i}.com`);
    const root = await competitors(five);
    expect(root.querySelector('[data-testid="add-competitor"]')).toBeNull();
    expect(root.querySelectorAll("form")).toHaveLength(BATTERY.COMPETITORS_MAX);
  });

  // Issue #270. The mutation this catches is the one that was there: the
  // field labelled with the card's heading, so the card said "Competitors"
  // twice and named the field not at all.
  it("the add field is named by its own key, and the heading key is read once", async () => {
    const root = await competitors(TWO);
    const label = root.querySelector('[data-testid="add-competitor"] label');
    expect(label?.textContent).toBe("settings.competitors.add-label");
    // Once in the whole card: the heading, and nowhere in the form.
    expect(text(root).split("settings.competitors.title")).toHaveLength(2);
    expect(within(root, "add-competitor").textContent).not.toContain(
      "settings.competitors.title"
    );
  });

  // ADR-093's rendering half — "one string, once". `Input` omits a
  // placeholder equal to its label, so passing the one key twice draws the
  // word once rather than above and inside the same field.
  it("the label's own word is not repeated as the placeholder", async () => {
    const root = await competitors(TWO);
    const field = within(root, "add-competitor").querySelector('[name="rival_domain"]');
    expect(field?.getAttribute("placeholder")).toBeNull();
  });

  it("REQ-070 c1 — the set is one control, however many chips it holds", async () => {
    const root = await competitors(TWO);
    const offered = [...root.querySelectorAll("[data-testid]")]
      .map((el) => el.getAttribute("data-testid") ?? "")
      .filter((id) => id.startsWith("setting-"));
    expect(offered).toEqual(["setting-competitors"]);
  });
});
