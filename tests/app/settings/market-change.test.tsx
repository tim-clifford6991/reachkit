/** @vitest-environment jsdom */
// tests/app/settings/market-change.test.tsx — BUILD §4.7, REQ-071 c1, c6,
// c16, issue #204
//
// The three market-card lines, and the one thing they all turn on: every
// value comes from `src/lib/market/changes/`, and the screen computes none
// of it. The discriminating case is the pair — the same card, one change
// being typed and one already saved — because an implementation that
// rendered both, or picked the wrong one, passes every single-state row.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { applyEnvFixture } from "../../mail/env-fixture";

// The change engine reaches `@/lib/db`, which parses every binding the
// moment it is evaluated — so the fixture is applied before the modules
// under test are imported, exactly as `change-actions.test.ts` does it.
applyEnvFixture();

vi.mock("@/lib/presentation/copy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/presentation/copy")>();
  return {
    ...actual,
    copy: (key: string, vars?: Record<string, string | number>) =>
      vars === undefined ? key : `${key}(${Object.values(vars).join("|")})`,
  };
});

const { AWAITING_COPY, COPY, TODO_COPY_MARKER } = await import(
  "@/lib/presentation/copy/registry"
);
const { effectiveOn } = await import("@/lib/market/changes");
const { assembleSettings } = await import("@/app/(account)/app/settings/model");
type SettingsFacts = import("@/app/(account)/app/settings/model").SettingsFacts;
const { FIXTURE_SETTINGS_FACTS } = await import("@/app/(account)/app/settings/fixture");
const { MarketPanel } = await import("@/app/(account)/app/settings/panels/MarketPanel");
const { CompetitorsPanel } = await import(
  "@/app/(account)/app/settings/panels/CompetitorsPanel"
);
const { CHANGE_COPY_KEY } = await import("@/app/(account)/app/calendar/change-line");
const { formatDate } = await import("@/app/(account)/app/_shell/format");

function render(el: React.ReactElement): Element {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(el);
  return container;
}

const ZONE = "America/New_York";
const ADOPTED_ON = new Date(Date.UTC(2026, 8, 21, 10, 0, 0));

function facts(over: Partial<SettingsFacts> = {}): SettingsFacts {
  return { ...FIXTURE_SETTINGS_FACTS, timeZone: ZONE, ...over };
}

function market(over: Partial<SettingsFacts> = {}): Element {
  const model = assembleSettings(facts(over));
  // The card's own slice, since #231: a client panel takes what it renders.
  return render(
    <MarketPanel market={model.market} domain={model.domain} timeZone={ZONE} />
  );
}

describe("REQ-071 c1 — the pending change, before the save", () => {
  it("names the date the change takes effect and which answer is changing", () => {
    const root = market({ editing: "domain", pendingChange: null });
    const line = root.querySelector('[data-testid="market-change-line"]')?.textContent ?? "";
    expect(line).toContain("settings.market.pending");
    // `{change}` is the owner's word for the answer, read from its own key
    // — never the engine's `domain` handle.
    expect(line).toContain(CHANGE_COPY_KEY.domain);
    expect(line).not.toMatch(/\|domain\b/);
  });

  it("takes its date from effectiveOn() and does no arithmetic of its own", () => {
    const root = market({ editing: "category", pendingChange: null });
    const line = root.querySelector('[data-testid="market-change-line"]')?.textContent ?? "";
    // The date a change saved now would take: the engine's answer, in the
    // customer's own zone, written by the shell's one formatter. Compared
    // against the engine's own value rather than a date typed here, so a
    // screen that computed its own Monday fails.
    //
    // `savedAt` is the facts' own instant, not `new Date()` (issue #304).
    // The model used to read the clock itself and this row read it a second
    // time, so both moved together and the row could not tell a screen that
    // took its moment from its facts from one that took it from the wall —
    // which is the distinction the fixture's fixed `now` now makes.
    expect(line).toContain(
      formatDate(effectiveOn({ savedAt: facts().now, timezone: ZONE }), ZONE)
    );
  });

  it("replaces the card's standing effect line rather than sitting beneath it", () => {
    // §4.7 gives this card one written line. Two dated sentences on it
    // would be the same fact pretending to be two.
    const root = market({ editing: "domain", pendingChange: null });
    expect(root.textContent).not.toContain("settings.market.effect");
  });
});

describe("REQ-071 c6 — the effective-on line, after the save", () => {
  it("names the stored date and no change word, and is not the warn ground", () => {
    const root = market({ editing: null, pendingChange: { kind: "category", effectiveOn: ADOPTED_ON } });
    const cell = root.querySelector('[data-testid="market-change-line"]');
    expect(cell?.textContent).toContain("settings.market.effectiveOn");
    // Saved is not an error: nothing is wrong, and a warning ground would
    // say something is.
    expect(cell?.getAttribute("class") ?? "").not.toContain("warning");
  });

  it("the unsaved change outranks the saved one — one line, and it is the one being acted on", () => {
    const root = market({
      editing: "domain",
      pendingChange: { kind: "category", effectiveOn: ADOPTED_ON },
    });
    const line = root.querySelector('[data-testid="market-change-line"]')?.textContent ?? "";
    expect(line).toContain("settings.market.pending");
    expect(line).not.toContain("settings.market.effectiveOn");
  });

  it("with nothing pending and nothing being typed the card states its standing line", () => {
    const root = market({ editing: null, pendingChange: null });
    expect(root.querySelector('[data-testid="market-change-line"]')).toBeNull();
    expect(root.textContent).toContain("settings.market.effect");
  });
});

describe("REQ-071 c16 — no rival comparison until one is added", () => {
  it("states the line where the chips would be, and only where the set is empty", () => {
    const empty = render(<CompetitorsPanel competitors={[]} />);
    expect(empty.querySelector('[data-testid="competitors-none-yet-line"]')).not.toBeNull();

    const some = render(
      <CompetitorsPanel competitors={["rival.example"]} />
    );
    expect(some.querySelector('[data-testid="competitors-none-yet-line"]')).toBeNull();
  });
});

describe("no copy invented — the four lines are the owner's, approved and written", () => {
  it("every key this issue added carries the owner's approved sentence (#460), neither the marker nor the empty value", () => {
    // DECISIONS 2026-09-05: a screen key left empty takes the card down
    // with it through `copy()`'s throw, which hides the finished controls
    // the owner has to review to write the sentence. The marker renders
    // and is listed, so what is unwritten stays one question.
    for (const key of [
      "settings.market.pending",
      "settings.market.effectiveOn",
      "settings.market.change.domain",
      "settings.market.change.category",
      "settings.competitors.none-yet",
      "calendar.empty.change-holds-pages",
    ] as const) {
      expect(COPY[key], key).not.toBe(TODO_COPY_MARKER);
      expect(COPY[key], key).not.toBe("");
      expect(AWAITING_COPY, key).not.toContain(key);
    }
  });

  it("the change word has one key per kind, and no screen names the kind itself", () => {
    expect(Object.keys(CHANGE_COPY_KEY).sort()).toEqual(["category", "domain"]);
    expect(CHANGE_COPY_KEY.domain).toBe("settings.market.change.domain");
    expect(CHANGE_COPY_KEY.category).toBe("settings.market.change.category");
  });
});
