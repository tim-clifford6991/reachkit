/** @vitest-environment jsdom */
// tests/app/setup/screen.test.tsx — BUILD §4.3, REQ-025 criteria 1, 2, 3;
// REQ-021 c6/c7; REQ-026 c1/c3/c9/c10; REQ-028 c1/c2
//
// The screen contract: exactly three decisions plus the address, one
// submit, no engine control, and no duration anywhere but the one footer
// `BUILD.md` §4.3 fixes verbatim.
//
// **Rendering convention.** `tests/app/**` runs under Vitest's "node"
// project, whose environment has no `document`; this file declares `jsdom`
// for itself, the same per-file form `tests/app/shell/frame.test.tsx` uses,
// and renders with `react-dom/server`'s `renderToStaticMarkup`.
//
// **`copy()` is NOT mocked here.** These assertions are about what a reader
// sees — a duration, an engine control, a blank where a value would sit —
// so the real registry has to be what renders, `TODO(copy)` markers
// included.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  redirect: vi.fn(),
}));

import { SetupForm } from "@/app/(account)/setup/SetupForm";
import { assembleSetup, type SetupFacts } from "@/app/(account)/setup/_setup/facts";
import { FIXTURE_SETUP_FACTS } from "@/app/(account)/setup/_setup/fixture";
import { COPY } from "@/lib/presentation/copy";
import { BATTERY } from "@/lib/config/constants";

function render(el: React.ReactElement): Element {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(el);
  return container;
}

function screenFor(over: Partial<SetupFacts> = {}): Element {
  const model = assembleSetup({ ...FIXTURE_SETUP_FACTS, ...over });
  return render(<SetupForm model={model} />);
}

const SCANLESS: Partial<SetupFacts> = { measured: null, suggestedRivals: null };

describe('REQ-025 c1 — "it asks for exactly three decisions ... and for nothing else, save the site address"', () => {
  it("the report arm is §4.3's three cards, because the set merges site and market", () => {
    // UI-SPEC S10 draws one card — "Your site & market" — where both are
    // already known and each needs only a Change. That is §4.3's own
    // "three cards, one submit" literally, where this screen drew four.
    const tree = screenFor();
    for (const id of [
      "setup-site-and-market",
      "setup-market",
      "setup-competitors",
      "setup-publishing",
    ]) {
      expect(tree.querySelector(`[data-testid="${id}"]`), id).not.toBeNull();
    }
    expect(tree.querySelectorAll("form section")).toHaveLength(3);
  });

  it("the no-report arm is four, because the site is asked for before the market is suggested", () => {
    const tree = screenFor(SCANLESS);
    for (const id of ["setup-address", "setup-market", "setup-competitors", "setup-publishing"]) {
      expect(tree.querySelector(`[data-testid="${id}"]`), id).not.toBeNull();
    }
    expect(tree.querySelectorAll("form section")).toHaveLength(4);
  });

  it("REQ-021 c6 — a measured address is shown to confirm or change, not typed into an empty field", () => {
    const tree = screenFor();
    expect(tree.querySelector('[data-testid="setup-address-value"]')?.textContent).toBe(
      "example.com"
    );
    // The set's merged card shows the address and a Change and no line
    // under it: that line explained a field the founder did not type
    // into, and the card no longer has one.
    expect(tree.querySelector('[data-testid="setup-address-measured"]')).toBeNull();
    expect(tree.querySelector('[data-testid="setup-site-and-market"]')).not.toBeNull();
  });

  it("REQ-021 c7 — a scanless purchase gets an empty address field, with nothing pre-filled", () => {
    const tree = screenFor(SCANLESS);
    const field = tree.querySelector('input[name="domain"]');
    expect(field).not.toBeNull();
    expect(field?.getAttribute("value") ?? "").toBe("");
    expect(tree.querySelector('[data-testid="setup-address-value"]')).toBeNull();
  });
});

describe('REQ-025 c2 — "one action starts the product: no multi-page wizard, no second confirmation screen"', () => {
  it("exactly one submit control exists on the screen", () => {
    const tree = screenFor();
    expect(tree.querySelectorAll('button[type="submit"]')).toHaveLength(1);
  });

  it("the submit carries §4.3's footer control, estimate and all", () => {
    // The duration came back on 2026-09-08. The approved set draws
    // "Start — first page in ~3 minutes." and #378 resolved the conflict
    // with REQ-025 c1 as C1: the approved string stands (11a, the newer
    // owner approval) and c1 is amended to allow a stated estimate. BUILD
    // §4.3 carries it, and so does the registry (issue #377).
    const tree = screenFor();
    const submit = tree.querySelector('button[type="submit"]');
    expect(submit?.textContent).toBe(COPY["setup.submit"]);
    expect(COPY["setup.submit"]).toBe("Start — first page in ~3 minutes.");
  });
});

describe('REQ-025 c3 — "when they look for anything that tunes the engine ... then none is present or offered"', () => {
  const ENGINE = /(question|cadence|frequency|cap|budget|spend|depth|model|temperature|token|veto|schedule|interval|weekly|daily|per\s*day)/i;

  it("no control on the screen names an engine parameter", () => {
    const tree = screenFor();
    // The mode controls carry the owner's sentence for what each mode does
    // (#460) — autopilot's names §9's veto window, which is a law the mode
    // obeys, not a parameter the control sets. Those approved sentences are
    // lifted out of the surface before the scan, so the scan still reads
    // every name, id, test id and every other word a control carries.
    const MODE_SENTENCES = [COPY["setup.mode.autopilot"], COPY["setup.mode.copilot"]];
    for (const control of Array.from(tree.querySelectorAll("input, select, textarea, button"))) {
      const said = MODE_SENTENCES.reduce(
        (rest, sentence) => rest.split(sentence).join(" "),
        control.textContent ?? ""
      );
      const surface = [
        control.getAttribute("name") ?? "",
        control.getAttribute("id") ?? "",
        control.getAttribute("data-testid") ?? "",
        said,
      ].join(" ");
      expect(surface, `control offers an engine parameter: ${surface}`).not.toMatch(ENGINE);
    }
  });

  it("the only fields the screen can ever show are the address, the market and one competitor box", () => {
    // Two arms, because a measured address and an inferred market render
    // as values to confirm rather than as fields (REQ-021 c6, REQ-026 c1).
    const measured = Array.from(screenFor().querySelectorAll("input")).map((i) =>
      i.getAttribute("name")
    );
    expect(measured.sort()).toEqual(["competitor"]);

    // The no-report arm asks for the site and a competitor. The market's
    // own field arrives with the site (UI-SPEC S10: "Suggested once your
    // site is given"), so it is not a field this arm can show.
    const scanless = Array.from(screenFor(SCANLESS).querySelectorAll("input")).map((i) =>
      i.getAttribute("name")
    );
    expect(scanless.sort()).toEqual(["competitor", "domain"]);
  });

  it("there is no select, checkbox or radio at all — the two card pairs are buttons", () => {
    const tree = screenFor();
    expect(tree.querySelectorAll("select")).toHaveLength(0);
    expect(tree.querySelectorAll('input[type="checkbox"], input[type="radio"]')).toHaveLength(0);
  });
});

describe("REQ-025 c1 as amended (C1, 2026-09-08) — one estimate, on the control, and nowhere else", () => {
  // c1 read "nothing on the screen states how long the deep pass, or the
  // founder's first page, will take", and the owner's ruling of 2026-09-06
  // made it win over §4.3's footer. The approved set of 2026-09-08 draws
  // the footer control as "Start — first page in ~3 minutes." and #378
  // resolved the two as C1: the approved string stands and c1 is amended to
  // allow a *stated estimate* — on that control.
  //
  // So the rule this file enforces is no weaker, only narrower: the screen
  // still states no duration anywhere except the one control the owner
  // approved one on. A progress percentage, a countdown or an "about 3
  // minutes" in a card body still fails.
  const TIME =
    /(\d+\s*(second|minute|hour|day|week)s?|~\s*\d|about\s+\d|%|remaining|elapsed|eta\b|countdown)/i;

  /** The screen's text with the submit control's own words removed. */
  function textOutsideTheControl(facts: Parameters<typeof screenFor>[0] = {}): string {
    const tree = screenFor(facts);
    const submit = tree.querySelector('button[type="submit"]');
    submit?.remove();
    return tree.textContent ?? "";
  }

  it("no rendered string outside the submit control states a duration or an estimate", () => {
    for (const facts of [{}, SCANLESS, { suggestedRivals: [] }]) {
      expect(textOutsideTheControl(facts)).not.toMatch(TIME);
    }
  });

  it("the submit control states exactly one, and it is the set's own", () => {
    const submit = screenFor().querySelector('button[type="submit"]');
    expect(submit?.textContent ?? "").toMatch(TIME);
    expect(submit?.textContent).toBe("Start — first page in ~3 minutes.");
  });

  it("mutation check: the scan still catches an estimate, so it is discriminating", () => {
    // Without this, a scan that had quietly stopped matching anything would
    // pass on a screen full of estimates.
    expect("Start — first page in ~3 minutes").toMatch(TIME);
    expect("about 3 minutes").toMatch(TIME);
    expect("40% done").toMatch(TIME);
  });

  it("`setup.submit` is the only setup key that states one", () => {
    const spoken = (Object.keys(COPY) as (keyof typeof COPY)[]).filter((key) =>
      key.startsWith("setup.")
    );
    expect(spoken.length).toBeGreaterThan(0);
    const stating = spoken.filter((key) => TIME.test(COPY[key]));
    expect(stating).toEqual(["setup.submit"]);
  });
});

describe('REQ-026 c1 and c3 — the market card in each of its states', () => {
  it("a measured address renders the inferred category as a chip, changeable", () => {
    const tree = screenFor();
    expect(tree.querySelector('[data-testid="setup-market-chip"]')?.textContent).toBe(
      FIXTURE_SETUP_FACTS.measured?.report.category
    );
  });

  it("a scanless purchase dims the market card and says when its suggestion arrives", () => {
    // UI-SPEC S10's no-report arm: the site is asked for first, and the
    // market card is dimmed with one line rather than an empty field for
    // something the product has not sought yet.
    const tree = screenFor(SCANLESS);
    expect(tree.querySelector('[data-testid="setup-market-chip"]')).toBeNull();
    expect(tree.querySelector('[data-testid="setup-market-awaiting-site"]')).not.toBeNull();
    expect(tree.querySelector('[data-testid="setup-market"]')?.getAttribute("data-awaiting")).toBe(
      "site"
    );
    const field = tree.querySelector('input[name="category"]');
    expect(field).toBeNull();
  });
});

describe('REQ-026 c9 and c10 — the competitors card', () => {
  it("suggested rivals are offered one by one, each acceptable or rejectable on its own", () => {
    const tree = screenFor();
    const chips = tree.querySelectorAll('[data-testid="setup-competitors-suggested"] button');
    expect(chips).toHaveLength(FIXTURE_SETUP_FACTS.suggestedRivals?.length ?? 0);
    expect(Array.from(chips).map((c) => c.textContent)).toEqual([
      ...(FIXTURE_SETUP_FACTS.suggestedRivals ?? []),
    ]);
  });

  it("none is selected on arrival — no domain the founder did not choose ever joins the set", () => {
    const tree = screenFor();
    expect(
      tree.querySelectorAll('[data-testid="setup-competitors-selected"] button')
    ).toHaveLength(0);
  });

  it("a rival can be typed: the card carries its own field and action", () => {
    const tree = screenFor();
    expect(tree.querySelector('input[name="competitor"]')).not.toBeNull();
  });

  it("c9 — the limit is stated on screen, in the numeral face, rather than silently enforced", () => {
    const tree = screenFor();
    const limit = tree.querySelector('[data-testid="setup-competitors-limit"]');
    expect(limit).not.toBeNull();
    expect(limit?.className).toContain("num");
    expect(BATTERY.COMPETITORS_MAX).toBe(5);
  });

  it("c10 — with no market stated, the card says it is waiting on the market, never that none were found", () => {
    const tree = screenFor(SCANLESS);
    expect(tree.querySelector('[data-testid="setup-competitors-awaiting"]')).not.toBeNull();
    expect(tree.querySelector('[data-testid="setup-competitors-none-found"]')).toBeNull();
  });

  it("c10 — a known market whose suggestions came back empty says none were found", () => {
    const tree = screenFor({ suggestedRivals: [] });
    expect(tree.querySelector('[data-testid="setup-competitors-none-found"]')).not.toBeNull();
    expect(tree.querySelector('[data-testid="setup-competitors-awaiting"]')).toBeNull();
  });
});

describe('REQ-028 c1 and c2 — mode and destination', () => {
  it("both modes and both destinations render, each with its own written line", () => {
    const tree = screenFor();
    expect(tree.querySelectorAll('[data-testid="setup-mode"] button')).toHaveLength(2);
    expect(tree.querySelectorAll('[data-testid="setup-destination"] button')).toHaveLength(2);
    // UI-SPEC S10 draws each option as a card carrying its own line, so
    // the line is inside the option rather than in a paragraph under the
    // group — which is what lets the hosted destination hold its CNAME
    // record in the option it belongs to.
    for (const id of [
      "setup-mode-autopilot",
      "setup-mode-copilot",
      "setup-destination-hosted",
      "setup-destination-wordpress",
    ]) {
      const option = tree.querySelector(`[data-testid="${id}"]`);
      expect(option, id).not.toBeNull();
      expect(option?.querySelector(".rk-choice-d")?.textContent ?? "", id).not.toBe("");
    }
  });

  it("autopilot and the hosted blog are the selected pair on arrival", () => {
    // Read off `aria-pressed`, not off a fill (issue #288). Selected was the
    // solid accent rank until this screen drew six of them; it is the
    // outline rank on the accent tint now, and the tint is keyed on this
    // attribute — so what the customer sees and what a screen reader hears
    // are the same fact, and this assertion reads the fact rather than one
    // of its two renderings.
    const tree = screenFor();
    const modes = Array.from(tree.querySelectorAll('[data-testid="setup-mode"] button'));
    expect(modes[0]?.getAttribute("aria-pressed")).toBe("true");
    expect(modes[1]?.getAttribute("aria-pressed")).toBe("false");
    const destinations = Array.from(tree.querySelectorAll('[data-testid="setup-destination"] button'));
    expect(destinations[0]?.getAttribute("aria-pressed")).toBe("true");
    expect(destinations[1]?.getAttribute("aria-pressed")).toBe("false");
  });

  it("§9.1 — the screen draws exactly one solid primary, and it is the submit", () => {
    // The defect this issue names, asserted on the screen itself rather
    // than only in the cold-start sweep: four groups spent the solid accent
    // as a *selected* state, so a founder with five rivals met six.
    const tree = screenFor();
    const solids = Array.from(tree.querySelectorAll(".btn-primary"));
    expect(solids).toHaveLength(1);
    expect(solids[0]?.getAttribute("type")).toBe("submit");
  });

  it("c2 — the CNAME record is shown once the address is known, in the numeral face", () => {
    const tree = screenFor();
    const record = tree.querySelector('[data-testid="setup-dns-record"]');
    expect(record).not.toBeNull();
    expect(record?.className).toContain("num");
    expect(record?.textContent).toContain("CNAME");
    expect(record?.textContent).toContain("content.example.com");
    expect(record?.textContent).toContain(FIXTURE_SETUP_FACTS.cnameTarget);
  });

  it("c2 — with no address given, one written line stands where the record will sit; no blank, dash or placeholder", () => {
    const tree = screenFor(SCANLESS);
    const pending = tree.querySelector('[data-testid="setup-dns-pending"]');
    expect(tree.querySelector('[data-testid="setup-dns-record"]')).toBeNull();
    expect(pending).not.toBeNull();
    const text = (pending?.textContent ?? "").trim();
    expect(text.length).toBeGreaterThan(0);
    expect(["—", "-", "n/a", "TBD", ""]).not.toContain(text);
  });
});

describe("no emoji anywhere on the screen", () => {
  it("the rendered text carries no pictographic character", () => {
    const tree = screenFor();
    expect(tree.textContent ?? "").not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
