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
  it("renders exactly three decision slots plus the address, and no fourth", () => {
    const tree = screenFor();
    for (const id of ["setup-address", "setup-market", "setup-competitors", "setup-publishing"]) {
      expect(tree.querySelector(`[data-testid="${id}"]`), id).not.toBeNull();
    }
    // Every `<section>` in the form is a slot; four is the whole screen.
    expect(tree.querySelectorAll("form section")).toHaveLength(4);
  });

  it("REQ-021 c6 — a measured address is shown to confirm or change, not typed into an empty field", () => {
    const tree = screenFor();
    expect(tree.querySelector('[data-testid="setup-address-value"]')?.textContent).toBe(
      "example.com"
    );
    expect(tree.querySelector('[data-testid="setup-address-measured"]')).not.toBeNull();
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

  it("the submit carries §4.3's footer verb, without the duration the owner removed", () => {
    const tree = screenFor();
    const submit = tree.querySelector('button[type="submit"]');
    expect(submit?.textContent).toBe(COPY["setup.submit"]);
    expect(COPY["setup.submit"]).toBe("Start");
  });
});

describe('REQ-025 c3 — "when they look for anything that tunes the engine ... then none is present or offered"', () => {
  const ENGINE = /(question|cadence|frequency|cap|budget|spend|depth|model|temperature|token|veto|schedule|interval|weekly|daily|per\s*day)/i;

  it("no control on the screen names an engine parameter", () => {
    const tree = screenFor();
    for (const control of Array.from(tree.querySelectorAll("input, select, textarea, button"))) {
      const surface = [
        control.getAttribute("name") ?? "",
        control.getAttribute("id") ?? "",
        control.getAttribute("data-testid") ?? "",
        control.textContent ?? "",
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

    const scanless = Array.from(screenFor(SCANLESS).querySelectorAll("input")).map((i) =>
      i.getAttribute("name")
    );
    expect(scanless.sort()).toEqual(["category", "competitor", "domain"]);
  });

  it("there is no select, checkbox or radio at all — the two card pairs are buttons", () => {
    const tree = screenFor();
    expect(tree.querySelectorAll("select")).toHaveLength(0);
    expect(tree.querySelectorAll('input[type="checkbox"], input[type="radio"]')).toHaveLength(0);
  });
});

describe('REQ-025 c1 — "nothing on the screen states how long the deep pass, or the founder\'s first page, will take"', () => {
  // The owner ruled on 2026-09-06 that c1 wins over §4.3's footer, which is
  // amended under #2. So the scan covers the *whole* screen, the submit
  // control included — there is no exempt corner.
  const TIME =
    /(\d+\s*(second|minute|hour|day|week)s?|~\s*\d|about\s+\d|%|remaining|elapsed|eta\b|countdown)/i;

  it("no rendered string anywhere on the screen states a duration, an estimate or a time to first page", () => {
    for (const facts of [{}, SCANLESS, { suggestedRivals: [] }]) {
      expect(screenFor(facts).textContent ?? "").not.toMatch(TIME);
    }
  });

  it("the submit control itself states none — it is not exempted, it simply does not say one", () => {
    const submit = screenFor().querySelector('button[type="submit"]');
    expect(submit?.textContent ?? "").not.toMatch(TIME);
    expect(COPY["setup.submit"]).not.toMatch(TIME);
  });

  it("mutation check: the scan does catch the sentence §4.3 used to print, so it is still discriminating", () => {
    // Without this, a scan that had quietly stopped matching anything would
    // pass on a screen full of estimates.
    expect("Start — first page in ~3 minutes").toMatch(TIME);
    expect("about 3 minutes").toMatch(TIME);
    expect("40% done").toMatch(TIME);
  });

  it("no copy key the screen resolves states one either — the absence is in the registry, not only in the render", () => {
    const spoken = (Object.keys(COPY) as (keyof typeof COPY)[]).filter((key) =>
      key.startsWith("setup.")
    );
    expect(spoken.length).toBeGreaterThan(0);
    for (const key of spoken) {
      expect(COPY[key], key).not.toMatch(TIME);
    }
  });
});

describe('REQ-026 c1 and c3 — the market card in each of its states', () => {
  it("a measured address renders the inferred category as a chip, changeable", () => {
    const tree = screenFor();
    expect(tree.querySelector('[data-testid="setup-market-chip"]')?.textContent).toBe(
      FIXTURE_SETUP_FACTS.measured?.report.category
    );
  });

  it("a scanless purchase renders the empty card and asks them to state it, with nothing pre-filled", () => {
    const tree = screenFor(SCANLESS);
    expect(tree.querySelector('[data-testid="setup-market-chip"]')).toBeNull();
    expect(tree.querySelector('[data-testid="setup-market-state-it"]')).not.toBeNull();
    const field = tree.querySelector('input[name="category"]');
    expect(field?.getAttribute("value") ?? "").toBe("");
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
    for (const id of [
      "setup-mode-line-autopilot",
      "setup-mode-line-copilot",
      "setup-destination-line-hosted",
      "setup-destination-line-wordpress",
    ]) {
      expect(tree.querySelector(`[data-testid="${id}"]`), id).not.toBeNull();
    }
  });

  it("autopilot and the hosted blog are the selected pair on arrival", () => {
    const tree = screenFor();
    const modes = Array.from(tree.querySelectorAll('[data-testid="setup-mode"] button'));
    expect(modes[0]?.className).toContain("btn-primary");
    expect(modes[1]?.className).not.toContain("btn-primary");
    const destinations = Array.from(tree.querySelectorAll('[data-testid="setup-destination"] button'));
    expect(destinations[0]?.className).toContain("btn-primary");
    expect(destinations[1]?.className).not.toContain("btn-primary");
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
