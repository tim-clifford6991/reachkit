/** @vitest-environment jsdom */
// tests/app/setup/screen.test.tsx — SPEC §5 (2026-09-20, #908, #922);
// REQ-021 c6/c7; REQ-025 c1/c3; REQ-026 c1/c3/c9/c10; REQ-028 c1/c2
//
// The screen contract, now five saved steps: one question each, Back and
// one primary, an equal-column indicator, no engine control anywhere, and
// no duration on any of the five.
//
// **Rendering convention.** `tests/app/**` runs under Vitest's "node"
// project, whose environment has no `document`; this file declares `jsdom`
// for itself and renders with `react-dom/server`'s `renderToStaticMarkup`.
// The step on screen is the URL's, so every render goes through `nuqs`'s
// own testing adapter with that step in the query string — the same fact
// the browser reads, supplied the way the library supplies it.
//
// **`copy()` is NOT mocked here.** These assertions are about what a reader
// sees — a duration, an engine control, a blank where a value would sit —
// so the real registry has to be what renders.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  redirect: vi.fn(),
}));

import { SetupForm } from "@/app/(account)/setup/SetupForm";
import { MarketCard } from "@/app/(account)/setup/MarketCard";
import { onMarketStated } from "@/lib/market/setup/state";
import { RivalsCard } from "@/app/(account)/setup/RivalsCard";
import { assembleSetup, type SetupFacts } from "@/app/(account)/setup/_setup/facts";
import { FIXTURE_SETUP_FACTS } from "@/app/(account)/setup/_setup/fixture";
import { SETUP_STEPS, type SetupStepId } from "@/app/(account)/setup/steps";
import { BUSINESS_GROUPS } from "@/app/(account)/setup/_setup/business";
import { COPY } from "@/lib/presentation/copy";
import { BATTERY } from "@/lib/config/constants";

function render(el: React.ReactElement): Element {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(el);
  return container;
}

/** The screen as the founder meets it on one step. */
function screenFor(step: SetupStepId, over: Partial<SetupFacts> = {}): Element {
  return render(
    <NuqsTestingAdapter searchParams={{ step }}>
      <SetupForm model={assembleSetup({ ...FIXTURE_SETUP_FACTS, ...over })} />
    </NuqsTestingAdapter>,
  );
}

/** The same model the screen was drawn from, for the rows that assert a
 *  value rather than a sentence. */
function model(over: Partial<SetupFacts> = {}) {
  return assembleSetup({ ...FIXTURE_SETUP_FACTS, ...over });
}

// A founder who bought with no report behind them: nothing was measured,
// and nothing was read of their site either.
// A founder nobody has read anything about: no report, no crawl and no
// market. #970: the market reading is one of the three the business step's
// lists are made of, so a scanless fixture has to be without it too — with
// it, "the words you use" would hold the market's vocabulary on a screen
// that is supposed to have read nothing.
const SCANLESS: Partial<SetupFacts> = {
  measured: null,
  concluded: null,
  profile: null,
  market: null,
};

describe("SPEC §5 (2026-09-20) — five saved steps, one question each", () => {
  it("the indicator is five equal columns with one-word labels, and the current one is marked", () => {
    const steps = screenFor("rivals").querySelector('[data-testid="setup-steps"]');
    const columns = [...(steps?.querySelectorAll("li") ?? [])];
    expect(columns).toHaveLength(5);
    expect(columns.map((li) => (li.textContent ?? "").trim())).toEqual([
      "Site",
      "Business",
      "Competitors",
      "Voice",
      "Connect",
    ]);
    // One word each: five columns at 390px hold no more.
    for (const label of columns.map((li) => (li.textContent ?? "").trim())) {
      expect(label.split(/\s+/), label).toHaveLength(1);
    }
    expect(columns[2]?.getAttribute("aria-current")).toBe("step");
    expect(columns.filter((li) => li.hasAttribute("aria-current"))).toHaveLength(1);
  });

  it("the step that connects the site is Connect in the list, the heading and the tab title (owner E11)", () => {
    const tree = screenFor("publishing");
    const current = tree.querySelector('[data-testid="setup-steps"] [aria-current="step"]');
    expect(current?.textContent?.trim()).toBe("Connect");
    expect(tree.querySelector("h1")?.textContent).toMatch(/^Connect\b/);
    expect(COPY["meta.app.setup.connect.title"]).toMatch(/^Connect\b/);
  });

  it("each step asks its own question, and draws only its own decision", () => {
    const only = {
      site: "setup-site-and-market",
      business: "setup-pages-read",
      rivals: "setup-competitors",
      voice: "setup-voice",
      publishing: "setup-publishing",
    } as const satisfies Record<SetupStepId, string>;

    for (const step of SETUP_STEPS) {
      const tree = screenFor(step);
      expect(tree.querySelector("h1")?.textContent, step).toBe(
        COPY[`setup.step.${step}.question`],
      );
      expect(tree.querySelector(`[data-testid="${only[step]}"]`), step).not.toBeNull();
      for (const other of SETUP_STEPS.filter((id) => id !== step)) {
        expect(tree.querySelector(`[data-testid="${only[other]}"]`), `${step}/${other}`).toBeNull();
      }
    }
  });

  it("Back is offered on every step but the first, and never refuses anything", () => {
    for (const step of SETUP_STEPS) {
      const back = [...screenFor(step).querySelectorAll("button")].find(
        (b) => (b.textContent ?? "").trim() === COPY["setup.back"],
      );
      expect(back, step).toBeDefined();
      expect(back?.hasAttribute("disabled"), step).toBe(step === "site");
    }
  });

  it("the one primary reads Continue, then “That’s us”, then Finish on the last step", () => {
    const labels = SETUP_STEPS.map(
      (step) =>
        screenFor(step).querySelector('[data-testid="setup-onwards"]')?.textContent ?? "",
    );
    expect(labels).toEqual(["Continue", "That’s us", "Continue", "Continue", "Finish"]);
  });

  it("§9.1 — every step draws exactly one solid primary, and it is the step's own control", () => {
    for (const step of SETUP_STEPS) {
      const solids = [...screenFor(step).querySelectorAll(".btn-primary:not(.btn-soft, .btn-outline, .btn-ghost)")];
      expect(solids, step).toHaveLength(1);
      expect(solids[0]?.getAttribute("data-testid"), step).toBe("setup-onwards");
    }
  });
});

describe('REQ-025 c3 — "when they look for anything that tunes the engine ... then none is present or offered"', () => {
  const ENGINE =
    /(question|cadence|frequency|cap|budget|spend|depth|model|temperature|token|veto|schedule|interval|weekly|daily|per\s*day)/i;

  it("no control on any step names an engine parameter", () => {
    for (const step of SETUP_STEPS) {
      for (const control of [...screenFor(step).querySelectorAll("input, select, textarea, button")]) {
        const surface = [
          control.getAttribute("name") ?? "",
          control.getAttribute("id") ?? "",
          control.getAttribute("data-testid") ?? "",
          control.textContent ?? "",
        ].join(" ");
        expect(surface, `${step}: control offers an engine parameter: ${surface}`).not.toMatch(
          ENGINE,
        );
      }
    }
  });

  it("the only named fields the five steps can show are the address, the market, one rival box and the subdomain label", () => {
    const named = SETUP_STEPS.flatMap((step) =>
      [...screenFor(step).querySelectorAll("input[name], textarea[name]")].map((i) =>
        i.getAttribute("name"),
      ),
    );
    expect([...new Set(named)].sort()).toEqual(["competitor", "label", "voice_text"]);

    // The no-report arm asks for the site as well; the market's own field
    // arrives with it (UI-SPEC S10: "Suggested once your site is given").
    const scanless = [...screenFor("site", SCANLESS).querySelectorAll("input[name]")].map((i) =>
      i.getAttribute("name"),
    );
    // D67 (issue 1318): and where the business serves, asked with the
    // country — a fact about the business, not a setting of the engine.
    expect(scanless.sort()).toEqual(["domain", "place"]);
  });

  it("there is no select, checkbox or radio at all — the two card pairs are buttons", () => {
    for (const step of SETUP_STEPS) {
      const tree = screenFor(step);
      expect(tree.querySelectorAll("select"), step).toHaveLength(0);
      expect(
        tree.querySelectorAll('input[type="checkbox"], input[type="radio"]'),
        step,
      ).toHaveLength(0);
    }
  });
});

describe("REQ-025 c1 — nothing on any step states how long anything takes", () => {
  // The estimate that lived on the one submit ("Start — first page in ~3
  // minutes.") went with the one submit: the five-step screen has no
  // control to hang it on, so c1 stands unamended again.
  const TIME =
    /(\d+\s*(second|minute|hour|day|week)s?|~\s*\d|about\s+\d|%|remaining|elapsed|eta\b|countdown)/i;

  it("no rendered string on any step states a duration, an estimate or a percentage", () => {
    for (const step of SETUP_STEPS) {
      for (const facts of [{}, SCANLESS, { concluded: null }]) {
        expect(screenFor(step, facts).textContent ?? "", step).not.toMatch(TIME);
      }
    }
  });

  it("mutation check: the scan still catches an estimate, so it is discriminating", () => {
    expect("Start — first page in ~3 minutes").toMatch(TIME);
    expect("about 3 minutes").toMatch(TIME);
    expect("40% done").toMatch(TIME);
  });

  /**
   * The one key that states a duration, and why the rule still holds.
   *
   * REQ-025 c1 is about **ReachKit's own work**: the founder is never told
   * how long the pass, the scan or the first page will take, because the
   * product does not know and a number it invented would be a promise. The
   * connect step's eyebrow estimates something else — how long *the
   * founder's* own visit to their DNS provider takes — which is their work,
   * not ours, and is the drafted sentence the owner wrote for it twice
   * (#924's drafted sentences and the `R4-02` board's own eyebrow).
   *
   * It is listed rather than pattern-excused: a second key that states a
   * duration fails here, which is what this test is for.
   */
  const STATES_THE_FOUNDERS_OWN_TIME = ["setup.connect.eyebrow"];

  it("no setup key states one, but for the founder's own task", () => {
    const spoken = (Object.keys(COPY) as (keyof typeof COPY)[]).filter((key) =>
      key.startsWith("setup."),
    );
    expect(spoken.length).toBeGreaterThan(0);
    expect(spoken.filter((key) => TIME.test(COPY[key]))).toEqual(STATES_THE_FOUNDERS_OWN_TIME);
  });
});

describe("step one — your site and your market (REQ-021 c6/c7, REQ-026 c1/c3)", () => {
  it("REQ-021 c6 — a measured address is shown to confirm or change, not typed into an empty field", () => {
    const tree = screenFor("site");
    expect(tree.querySelector('[data-testid="setup-address-value"]')?.textContent).toBe(
      "example.com",
    );
    expect(tree.querySelector('[data-testid="setup-site-and-market"]')).not.toBeNull();
  });

  it("each Change is a ghost button, not bare text (#521, the calm layer #1091)", () => {
    const changes = [
      ...screenFor("site").querySelectorAll('[data-testid="setup-site-and-market"] button'),
    ];
    expect(changes).toHaveLength(2);
    for (const change of changes) {
      expect(change.classList.contains("btn-ghost"), change.outerHTML).toBe(true);
    }
  });

  it("a measured address renders the inferred category as a chip, changeable", () => {
    expect(screenFor("site").querySelector('[data-testid="setup-market-chip"]')?.textContent).toBe(
      FIXTURE_SETUP_FACTS.measured?.report.category,
    );
  });

  it("REQ-021 c7 — a scanless purchase gets an empty address field, with nothing pre-filled", () => {
    const tree = screenFor("site", SCANLESS);
    const field = tree.querySelector('input[name="domain"]');
    expect(field).not.toBeNull();
    expect(field?.getAttribute("value") ?? "").toBe("");
    expect(tree.querySelector('[data-testid="setup-address-value"]')).toBeNull();
  });

  it("a scanless purchase dims the market card and says when its suggestion arrives", () => {
    const tree = screenFor("site", SCANLESS);
    expect(tree.querySelector('[data-testid="setup-market-chip"]')).toBeNull();
    expect(tree.querySelector('[data-testid="setup-market-awaiting-site"]')).not.toBeNull();
    expect(tree.querySelector('[data-testid="setup-market"]')?.getAttribute("data-awaiting")).toBe(
      "site",
    );
    expect(tree.querySelector('input[name="category"]')).toBeNull();
  });

  it("SPEC §5 — the measured market's questions are shown read-only, and only beside that scan's market", () => {
    const tree = screenFor("site");
    const list = tree.querySelector(
      '[data-testid="setup-site-and-market"] [data-testid="setup-market-questions"]',
    );
    const items = FIXTURE_SETUP_FACTS.questions?.items ?? [];
    expect(list?.querySelectorAll("li")).toHaveLength(items.length);
    expect(list?.textContent).toContain(items[0]?.wording.text);
    expect(list?.textContent).toContain(items[0]?.search);
    expect(list?.querySelectorAll("input, textarea, button")).toHaveLength(0);

    const otherScan = { scanId: "another-scan", items, derivable: null };
    expect(
      screenFor("site", { questions: otherScan }).querySelector(
        '[data-testid="setup-market-questions"]',
      ),
    ).toBeNull();
    expect(
      screenFor("site", SCANLESS).querySelector('[data-testid="setup-market-questions"]'),
    ).toBeNull();
  });

  it("§12 ruling 4 — a corrected category re-derives the twelve from the stored market, still read-only", () => {
    const questions = FIXTURE_SETUP_FACTS.questions!;
    const card = (q: typeof questions, category: string) =>
      render(
        <MarketCard
          state={onMarketStated(model().state, category)}
          setState={() => {}}
          locale="US/en"
          place=""
          setPlace={() => {}}
          setLocale={() => {}}
          questions={q}
          resolveDomain={async () => {
            throw new Error("no address change here");
          }}
        />,
      ).querySelector('[data-testid="setup-market-questions"]');

    const corrected = card(questions, "time tracking software");
    const searches = [...(corrected?.querySelectorAll("li") ?? [])].map((li) => li.textContent ?? "");
    expect(searches.some((text) => text.includes("time tracking software"))).toBe(true);
    expect(questions.items.some((q) => q.search === "time tracking software")).toBe(false);
    expect(corrected?.querySelectorAll("input, textarea, button")).toHaveLength(0);

    expect(card({ ...questions, derivable: null }, "time tracking software")).toBeNull();
    expect(card({ ...questions, scanId: "another-scan" }, "time tracking software")).toBeNull();
  });

  it("SPEC §6 thin markets (#778) — a corrected category re-derives over the stored pool and the volume steps, not the 50/mo cut", () => {
    const questions = FIXTURE_SETUP_FACTS.questions!;
    const thin = {
      ...questions,
      derivable: {
        profile: questions.derivable!.profile,
        ownRanked: questions.derivable!.ownRanked,
        market: [{ keyword: "time tracking software for agencies", volume: 20 }],
        pool: [{ keyword: "harvest alternatives", volume: 10, rival: "harvest.com" }],
      },
    };
    const list = render(
      <MarketCard
        state={onMarketStated(model().state, "time tracking software")}
        setState={() => {}}
        locale="US/en"
        place=""
        setPlace={() => {}}
        setLocale={() => {}}
        questions={thin}
        resolveDomain={async () => {
          throw new Error("no address change here");
        }}
      />,
    ).querySelector('[data-testid="setup-market-questions"]');
    const searches = [...(list?.querySelectorAll("li") ?? [])].map((li) => li.textContent ?? "");
    expect(searches.some((text) => text.includes("time tracking software for agencies"))).toBe(true);
    expect(searches.some((text) => text.includes("harvest alternatives"))).toBe(true);
  });
});

describe("step two — what we learned about your business (SPEC §5, 2026-09-20)", () => {
  it("the pages read are stated by purpose, and the never-invent line sits with them", () => {
    const tree = screenFor("business");
    const chips = tree.querySelector('[data-testid="setup-pages-read"]');
    for (const purpose of ["pricing", "about", "features", "blog"]) {
      expect(chips?.querySelector(`[data-testid="setup-profile-purpose-${purpose}"]`), purpose)
        .not.toBeNull();
    }
    // The fixture site has no contact, legal or product page, and the step
    // states nothing about pages nobody read.
    for (const purpose of ["contact", "legal", "product"]) {
      expect(
        chips?.querySelector(`[data-testid="setup-profile-purpose-${purpose}"]`),
        purpose,
      ).toBeNull();
    }
    expect(chips?.textContent).toContain("2");
    expect(tree.querySelector('[data-testid="setup-business-assurance"]')?.textContent).toBe(
      COPY["setup.business.assurance"],
    );
  });

  it("the line names the number of pages actually read, and says so differently when none were", () => {
    expect(screenFor("business").querySelector('[data-testid="setup-step-line"]')?.textContent)
      .toBe(COPY["setup.step.business.line"].replace("{pages}", "5"));
    expect(
      screenFor("business", SCANLESS).querySelector('[data-testid="setup-step-line"]')?.textContent,
    ).toBe(COPY["setup.step.business.line.unread"]);
  });

  it("every group the profile carries is listed, and every item in it can be removed", () => {
    const panel = screenFor("business").querySelector('[data-testid="setup-business"]');
    for (const group of BUSINESS_GROUPS) {
      expect(panel?.querySelector(`[data-testid="setup-business-${group}"]`), group).not.toBeNull();
    }
    const sells = panel?.querySelector('[data-testid="setup-business-products-items"]');
    const items = [...(sells?.querySelectorAll("li") ?? [])];
    expect(items.map((li) => li.querySelector("span")?.textContent)).toEqual([
      "project management",
      "agency time tracking",
    ]);
    for (const item of items) {
      const remove = item.querySelector("button[aria-label]");
      expect(remove?.getAttribute("aria-label")).toBe(
        COPY["setup.business.remove"].replace("{item}", item.querySelector("span")?.textContent ?? ""),
      );
    }
  });

  it("#1038: the groups are the board's six, in its order, and *What you do* is one sentence to reword", () => {
    const panel = screenFor("business").querySelector('[data-testid="setup-business"]');
    const heads = [...(panel?.querySelectorAll("section h3") ?? [])].map((h) => h.textContent);
    expect(heads).toEqual([
      COPY["setup.business.group.job"],
      COPY["setup.business.group.products"],
      COPY["setup.business.group.audienceTerms"],
      COPY["setup.business.group.claims"],
      COPY["setup.business.group.vocabulary"],
      COPY["setup.business.group.facts"],
      // #1133: the five optional questions close the step, each one field.
      COPY["setup.business.questions"],
    ]);
    expect(panel?.querySelectorAll('[data-testid^="setup-business-ask-"]')).toHaveLength(5);
    const job = panel?.querySelector<HTMLInputElement>('[data-testid="setup-business-job"] input');
    expect(job?.value).toBe(model().business.job?.text);
    expect(job?.getAttribute("aria-label")).toBe(COPY["setup.business.group.job"]);
    expect(model().business.lists.audienceTerms.length).toBeGreaterThan(0);
    const serve = panel?.querySelector('[data-testid="setup-business-audienceTerms-items"]');
    expect([...(serve?.querySelectorAll("li span") ?? [])].map((s) => s.textContent)).toEqual([
      ...(model().business.lists.audienceTerms.map((item) => item.text)),
    ]);
  });

  it("every group carries its own Add, and a group nothing was read for still does", () => {
    const panel = screenFor("business").querySelector('[data-testid="setup-business"]');
    for (const group of BUSINESS_GROUPS) {
      const box = panel?.querySelector(`[data-testid="setup-business-${group}"]`);
      expect(box?.querySelector("input"), group).not.toBeNull();
      const add = [...(box?.querySelectorAll("button") ?? [])].find((b) =>
        (b.textContent ?? "").includes(COPY["setup.business.add"]),
      );
      expect(add, group).toBeDefined();
    }

    const empty = screenFor("business", SCANLESS).querySelector('[data-testid="setup-business"]');
    for (const group of BUSINESS_GROUPS) {
      expect(
        empty?.querySelector(`[data-testid="setup-business-${group}-empty"]`)?.textContent,
        group,
      ).toBe(COPY["setup.business.empty"]);
      expect(
        empty?.querySelector(`[data-testid="setup-business-${group}"] input`),
        group,
      ).not.toBeNull();
    }
  });
});

describe("step three — the rivals (REQ-026 c9, c10)", () => {
  it("D28 — the rivals ReachKit concluded arrive chosen, each with its reason, so leaving the step accepts them", () => {
    const concluded = FIXTURE_SETUP_FACTS.concluded?.rivals ?? [];
    const chosen = screenFor("rivals").querySelector('[data-testid="setup-competitors-selected"]');
    expect(chosen?.querySelectorAll("li")).toHaveLength(concluded.length);
    for (const rival of concluded) {
      expect(chosen?.textContent).toContain(rival.domain);
      expect(chosen?.textContent).toContain(rival.reason);
    }
    expect(screenFor("rivals").querySelector('[data-testid="setup-competitors-concluded"]')?.textContent).toBe(
      COPY["setup.competitors.concluded"],
    );
  });

  it("D28 — each concluded rival can be removed; nothing asks the founder to pick", () => {
    const chosen = screenFor("rivals").querySelector('[data-testid="setup-competitors-selected"]');
    expect(chosen?.querySelectorAll("button[aria-label]")).toHaveLength(FIXTURE_SETUP_FACTS.concluded?.rivals.length ?? 0);
    expect(screenFor("rivals").querySelector('[data-testid="setup-competitors-suggested"]')).toBeNull();
  });

  it("a rival can be typed: the step carries its own field and action", () => {
    expect(screenFor("rivals").querySelector('input[name="competitor"]')).not.toBeNull();
  });

  it("c9 — the limit is stated on screen, in the numeral face, rather than silently enforced", () => {
    const limit = screenFor("rivals").querySelector('[data-testid="setup-competitors-limit"]');
    expect(limit).not.toBeNull();
    expect(limit?.className).toContain("num");
    expect(BATTERY.COMPETITORS_MAX).toBe(5);
    // And in the line under the question, in the founder's own words.
    expect(screenFor("rivals").querySelector('[data-testid="setup-step-line"]')?.textContent).toBe(
      COPY["setup.step.rivals.line"].replace("{max}", "5"),
    );
  });

  it("c10 — with no market stated, the step says it is waiting on the market, never that none were found", () => {
    const tree = screenFor("rivals", SCANLESS);
    expect(tree.querySelector('[data-testid="setup-competitors-awaiting"]')).not.toBeNull();
    expect(tree.querySelector('[data-testid="setup-competitors-none-found"]')).toBeNull();
  });

  it("c10 — a known market whose suggestions came back empty says none were found", () => {
    const tree = render(
      <RivalsCard
        rivals={[]}
        suggestions={{ state: "none_found", candidates: [] }}
        ownDomain="example.com"
        max={BATTERY.COMPETITORS_MAX}
        resolveDomain={vi.fn()}
        onRivals={vi.fn()}
      />,
    );
    expect(tree.querySelector('[data-testid="setup-competitors-none-found"]')).not.toBeNull();
    expect(tree.querySelector('[data-testid="setup-competitors-awaiting"]')).toBeNull();
  });

  it("SPEC §5 — with five chosen, a sixth cannot be added and the limit is named; each chosen rival can be removed", () => {
    const rivals = ["a.com", "b.com", "c.com", "d.com", "e.com"].map((domain) => ({
      domain,
      origin: "typed" as const,
    }));
    const tree = render(
      <RivalsCard
        rivals={rivals}
        suggestions={{ state: "offered", candidates: ["f.com"] }}
        ownDomain="example.com"
        max={BATTERY.COMPETITORS_MAX}
        resolveDomain={vi.fn()}
        onRivals={vi.fn()}
      />,
    );
    expect(tree.querySelector('input[name="competitor"]')?.hasAttribute("disabled")).toBe(true);
    expect(
      tree
        .querySelector('[data-testid="setup-competitors-suggested"] button')
        ?.hasAttribute("disabled"),
    ).toBe(true);
    expect(tree.querySelector('[data-testid="setup-competitors-refusal"]')?.textContent).toBe(
      COPY["setup.competitors.refused.set-full"],
    );
    const removals = tree.querySelectorAll(
      '[data-testid="setup-competitors-selected"] button[aria-label]',
    );
    expect([...removals].map((b) => b.getAttribute("aria-label"))).toEqual(
      rivals.map((r) => COPY["setup.competitors.remove"].replace("{rival}", r.domain)),
    );
  });
});

describe("step four — your voice (SPEC §5, 2026-09-12; issue 839)", () => {
  it("the voice summary is editable, in the field the step saves", () => {
    const voice = screenFor("voice").querySelector('textarea[name="voice_text"]');
    expect(voice).not.toBeNull();
    // What the scan read, in the box, for the founder to keep or type over.
    expect(voice?.textContent).toContain("Plain and direct");
  });

  it("a site nobody has read yet gets an empty box under a line, never a blank section", () => {
    const tree = screenFor("voice", SCANLESS);
    expect(tree.querySelector('[data-testid="setup-profile-voice-unread"]')?.textContent).toBe(
      COPY["setup.profile.voice.unread"],
    );
    expect(tree.querySelector('textarea[name="voice_text"]')?.textContent ?? "").toBe("");
  });

  it("what ReachKit must never say about them is shown as read, with no control to change it", () => {
    const never = screenFor("voice").querySelector('[data-testid="setup-voice-never"]');
    expect(never?.textContent).toContain("world-class");
    expect(never?.querySelectorAll("button, input")).toHaveLength(0);
    // Nothing read, nothing claimed.
    expect(screenFor("voice", SCANLESS).querySelector('[data-testid="setup-voice-never"]')).toBeNull();
  });
});

describe("step five — where the pages go live (REQ-028 c2, SPEC §7 #476)", () => {
  it("no mode is offered and none is named, in either arm", () => {
    for (const facts of [{}, SCANLESS]) {
      const tree = screenFor("publishing", facts);
      expect(tree.querySelector('[data-testid="setup-mode"]')).toBeNull();
      expect(tree.textContent ?? "").not.toMatch(/copilot|autopilot/i);
    }
  });

  it("both destinations render, each with its own written line", () => {
    const tree = screenFor("publishing");
    expect(tree.querySelectorAll('[data-testid="setup-destination"] button')).toHaveLength(2);
    for (const id of ["setup-destination-hosted", "setup-destination-wordpress"]) {
      const option = tree.querySelector(`[data-testid="${id}"]`);
      expect(option, id).not.toBeNull();
      expect(
        option?.querySelector('[data-testid="setup-option-line"]')?.textContent ?? "",
        id,
      ).not.toBe("");
    }
  });

  it("the hosted blog is selected on arrival", () => {
    const destinations = [
      ...screenFor("publishing").querySelectorAll('[data-testid="setup-destination"] button'),
    ];
    expect(destinations[0]?.getAttribute("aria-pressed")).toBe("true");
    expect(destinations[1]?.getAttribute("aria-pressed")).toBe("false");
  });

  it("Canvas: OnboardingPublishing — the chosen destination carries the set's `default`", () => {
    const tree = screenFor("publishing");
    expect(
      tree
        .querySelector('[data-testid="setup-destination-hosted"]')
        ?.querySelector('[data-testid="setup-option-default"]')?.textContent,
    ).toBe(COPY["setup.mode.default"]);
    expect(
      tree
        .querySelector('[data-testid="setup-destination-wordpress"]')
        ?.querySelector('[data-testid="setup-option-default"]'),
    ).toBeNull();
  });

  it("the record is not on this step any more — it is its own step after setup (#924)", () => {
    // Owner, 2026-09-20, reversing #757: the founder finishes setup without
    // touching DNS. What stands here is the line that says the address will
    // be theirs and that connecting it is the next screen;
    // `tests/app/setup/connect.test.tsx` holds the record itself.
    const tree = screenFor("publishing");
    expect(tree.querySelector('[data-testid="dns-record"]')).toBeNull();
    expect(tree.querySelector('[data-testid="setup-dns-next"]')?.textContent).toBe(
      COPY["setup.destination.connect-next"],
    );
  });

  it("c2 — with no address given, one written line stands where the record will sit; no blank, dash or placeholder", () => {
    const tree = screenFor("publishing", SCANLESS);
    const pending = tree.querySelector('[data-testid="setup-dns-pending"]');
    expect(tree.querySelector('[data-testid="dns-record"]')).toBeNull();
    expect(pending).not.toBeNull();
    const text = (pending?.textContent ?? "").trim();
    expect(text.length).toBeGreaterThan(0);
    expect(["—", "-", "n/a", "TBD", ""]).not.toContain(text);
  });

  it("the WordPress card names what connecting will ask for, and asks for none of it here", () => {
    const card = screenFor("publishing").querySelector(
      '[data-testid="setup-destination-wordpress"]',
    );
    expect(card?.querySelector('[data-testid="setup-wordpress-site"]')?.textContent).toBe(
      "example.com",
    );
    expect(card?.querySelector('[data-testid="setup-wordpress-help"]')?.textContent).toBe(
      COPY["settings.destination.app-password.help"],
    );
    expect(card?.querySelectorAll("input")).toHaveLength(0);
  });

  it("SPEC §5 — the subdomain label is a value, so the field is in the numeral face", () => {
    expect(screenFor("publishing").querySelector('input[name="label"]')?.className).toContain("num");
  });
});

describe("the panel beside the question (SPEC §5, 2026-09-20)", () => {
  it("two of the five steps show the customer's own blog address, and nothing pretends to be written yet", () => {
    // #923 gives the rivals step a grid of its own and the voice step a
    // sample paragraph, so the blog mock-up is the site and publishing
    // steps'. The business step's has always been the profile itself.
    for (const step of SETUP_STEPS.filter(
      (id) => id !== "business" && id !== "rivals" && id !== "voice",
    )) {
      const panel = screenFor(step).querySelector('[data-testid="setup-panel"]');
      expect(panel?.getAttribute("data-step"), step).toBe(step);
      expect(
        panel?.querySelector('[data-testid="setup-panel-blog-address"]')?.textContent,
        step,
      ).toBe("content.example.com");
      expect(panel?.querySelectorAll(".skeleton").length, step).toBeGreaterThan(0);
      expect(panel?.querySelector('[data-testid="setup-panel-awaiting"]')?.textContent, step).toBe(
        COPY["setup.panel.awaiting"],
      );
    }
  });

  it("the voice step's panel offers a sample and writes nothing until it is asked (#923)", () => {
    // The first sample costs a model call, so a founder who walks past this
    // step spends nothing: the panel shows what the sample will be and one
    // control, and no paragraph until that control is pressed.
    const panel = screenFor("voice").querySelector('[data-testid="setup-panel"]');
    expect(panel?.querySelector('[data-testid="setup-panel-blog"]')).toBeNull();
    expect(panel?.querySelector('[data-testid="setup-voice-before"]')?.textContent).toBe(
      COPY["setup.panel.voice.before"],
    );
    expect(panel?.querySelector('[data-testid="setup-voice-sample"]')).toBeNull();
    expect(panel?.querySelector('[data-testid="setup-voice-write"]')?.textContent).toBe(
      COPY["setup.panel.voice.write"],
    );
  });

  it("the rivals step's panel is the searches measured, against the customer and each rival (#923)", () => {
    const panel = screenFor("rivals").querySelector('[data-testid="setup-panel"]');
    expect(panel?.querySelector('[data-testid="setup-panel-blog"]')).toBeNull();
    const grid = panel?.querySelector('[data-testid="setup-rivals-grid"]');
    expect(grid).not.toBeNull();
    // One row per site, the customer's first, and one cell per measured
    // search on each.
    const rows = [...(panel?.querySelectorAll('[data-testid="setup-rivals-row"]') ?? [])];
    expect(rows).toHaveLength(4);
    expect(rows[0]?.querySelector('[role="rowheader"]')?.textContent).toBe("example.com");
    for (const row of rows) {
      expect(row.querySelectorAll('[role="cell"]')).toHaveLength(5);
    }
    // Every dot says what it is: never colour alone (§2.4).
    for (const cell of panel?.querySelectorAll('[role="cell"]') ?? []) {
      expect(cell.getAttribute("aria-label")).toMatch(/first two pages/);
    }
    expect(panel?.querySelector('[data-testid="setup-rivals-line"]')?.textContent).toBe(
      COPY["setup.panel.rivals.line"].replace("{n}", "2").replace("{m}", "5"),
    );
  });

  it("the business step's panel is the profile itself, not a mockup", () => {
    const panel = screenFor("business").querySelector('[data-testid="setup-panel"]');
    expect(panel?.querySelector('[data-testid="setup-panel-blog"]')).toBeNull();
    expect(panel?.querySelector('[data-testid="setup-business"]')).not.toBeNull();
    // Headed by the name the scan read off their own pages.
    expect(panel?.querySelector('[data-testid="setup-panel-title"]')?.textContent).toBe(
      COPY["setup.panel.business.title"].replace("{business}", "Example Projects"),
    );
  });

  it("before an address is given there is a line where the blog address sits, never a blank", () => {
    const panel = screenFor("site", SCANLESS).querySelector('[data-testid="setup-panel"]');
    expect(panel?.querySelector('[data-testid="setup-panel-blog-address"]')).toBeNull();
    expect(panel?.textContent).toContain(COPY["setup.panel.address.pending"]);
  });

  it("nothing on the screen asks the founder to wait for the pass", () => {
    for (const step of SETUP_STEPS) {
      expect(
        screenFor(step).querySelector('[data-testid="setup-panel-note"]')?.textContent,
        step,
      ).toBe(COPY["setup.panel.note"]);
    }
  });
});

describe("no emoji anywhere on the screen", () => {
  it("no step's rendered text carries a pictographic character", () => {
    for (const step of SETUP_STEPS) {
      expect(screenFor(step).textContent ?? "", step).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});
