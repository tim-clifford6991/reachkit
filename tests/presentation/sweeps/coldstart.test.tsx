/** @vitest-environment jsdom */
// tests/presentation/sweeps/coldstart.test.tsx — BUILD §6.6, REQ-091 c2 and
// c3, ADR-010 point 2
//
// The cold-start law, swept: every route the App Router tree holds, rendered
// for a domain that ranks for nothing, and asserted per rendered document.
// The scope is the file tree, not a list — so a screen added later is in
// scope the day its `page.tsx` lands (REQ-091 criterion 2's "including
// screens added later"), and a route with no harness row fails naming the
// file rather than being skipped.
//
// **Two describes throughout.** One over the synthetic tree under
// `__fixtures__/routes/`, where each rule must flag its own planted
// violation and nothing else; one over `src/app`, where every rule must flag
// nothing. Without the first, deleting a rule would leave the second
// passing.
//
// **`copy()` is real here.** The assertions are about what stands on the
// screen — a blank, a dash, another customer's rival — so the sentences have
// to be the ones a reader would read. Which *key* a line resolves from is
// `coldstart-keys.test.tsx`'s question and is asked there.
import path from "node:path";
import React from "react";
import { describe, expect, it, vi, beforeAll } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { applyEnvFixture } from "../../mail/env-fixture";
import { shellState } from "./shell-state";

applyEnvFixture();

vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, usePathname: () => "/app", useRouter: () => ({ push: vi.fn() }) };
});

vi.mock("@/app/(account)/app/_shell/provider", async () => {
  const { shellState: state } = await import("./shell-state");
  return {
    readShell: async () => {
      if (state.current === null) throw new Error("sweeps: shellState was not set before rendering");
      return state.current;
    },
  };
});

const { enumerateRoutes } = await import("./routes");
const { renderRoute, ROUTE_HARNESS } = await import("./harness");
type RenderedRoute = import("./harness").RenderedRoute;
const rules = await import("./rules");
const { assembleShell } = await import("@/app/(account)/app/_shell/model");
const fixture = await import("./fixture");
const { PLACES } = await import("@/lib/presentation/place");
const AppLayout = (await import("@/app/(account)/app/layout")).default;

const APP_ROOT = path.resolve(import.meta.dirname, "../../../src/app");
const FIXTURE_ROOT = path.resolve(import.meta.dirname, "__fixtures__/routes");

const wrap = async (page: React.ReactNode): Promise<React.ReactNode> =>
  (await AppLayout({ children: page })) as React.ReactNode;

async function sweep(domain: string, facts: typeof fixture.COLD_START_SHELL_FACTS): Promise<RenderedRoute[]> {
  shellState.current = assembleShell(facts);
  const out: RenderedRoute[] = [];
  for (const route of enumerateRoutes(APP_ROOT)) {
    out.push(await renderRoute(route, { domain }, wrap));
  }
  return out;
}

/** Every finding a rule produces across the swept routes, each carrying the
 *  route it was found on — so a failure names the screen and the element,
 *  not just a count. */
function sweepFindings(
  rendered: RenderedRoute[],
  rule: (doc: ParentNode) => { rule: string; detail: string }[]
): string[] {
  return rendered.flatMap((r) => rule(r.doc.body).map((f) => `${r.route.url} [${f.rule}] ${f.detail}`));
}

let cold: RenderedRoute[] = [];
let warm: RenderedRoute[] = [];

beforeAll(async () => {
  cold = await sweep(fixture.COLD_START_DOMAIN, fixture.COLD_START_SHELL_FACTS);
  warm = await sweep(fixture.WARM_DOMAIN, fixture.WARM_SHELL_FACTS);
}, 120_000);

// ── the fixture tree: every rule flags its own planted violation ─────────

describe("the rules discriminate — the synthetic tree, and what each rule catches", () => {
  const fixtureRoutes = enumerateRoutes(FIXTURE_ROOT);

  async function renderFixture(rel: string): Promise<Document> {
    const route = fixtureRoutes.find((r) => r.rel === rel);
    if (route === undefined) throw new Error(`no fixture route ${rel}`);
    const loaded = (await import(/* @vite-ignore */ route.file)) as {
      default: () => React.JSX.Element;
    };
    const doc = document.implementation.createHTMLDocument("fixture");
    doc.body.innerHTML = renderToStaticMarkup(loaded.default());
    return doc;
  }

  it("the clean route is flagged by nothing", async () => {
    const doc = await renderFixture("clean/page.tsx");
    expect(rules.noBlankValue(doc.body)).toEqual([]);
    expect(rules.noPlaceholderValue(doc.body)).toEqual([]);
    expect(rules.exactlyOneLinePerPlace(doc.body)).toEqual([]);
    expect(rules.everyPlaceRegistered(doc.body)).toEqual([]);
    expect(rules.noInternalCause(doc.body, "statement")).toEqual([]);
  });

  it("a value position standing empty is flagged", async () => {
    const findings = rules.noBlankValue((await renderFixture("blank-value/page.tsx")).body);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.detail).toContain("<dd>");
  });

  it("a bare dash standing where a value would sit is flagged", async () => {
    const findings = rules.noPlaceholderValue((await renderFixture("dash-value/page.tsx")).body);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.rule).toBe("no-placeholder-value");
  });

  it("REQ-004's own dash, marked as itself, is not flagged", async () => {
    const doc = await renderFixture("honest-dash/page.tsx");
    expect(rules.noPlaceholderValue(doc.body)).toEqual([]);
    expect(rules.noBlankValue(doc.body)).toEqual([]);
  });

  it("a place carrying two lines is flagged — two accounts of one place", async () => {
    const findings = rules.exactlyOneLinePerPlace((await renderFixture("two-lines/page.tsx")).body);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.detail).toContain("calendar.date.page");
    expect(findings[0]!.detail).toContain("2 line(s)");
  });

  it("a place absent from PLACES is flagged by name", async () => {
    const findings = rules.everyPlaceRegistered(
      (await renderFixture("unregistered-place/page.tsx")).body
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]!.detail).toContain("overview.rival-gaps.table");
  });

  it("another customer's rival standing in an empty list is flagged", async () => {
    const findings = rules.nothingBorrowed(
      (await renderFixture("borrowed-rival/page.tsx")).body,
      fixture.BORROWABLE,
      [fixture.COLD_START_DOMAIN]
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]!.detail).toContain("rival-one.example.net");
  });

  it("a stopped statement naming a cap, a vendor and a status code is flagged three times", async () => {
    const findings = rules.noInternalCause(
      (await renderFixture("internal-cause/page.tsx")).body,
      "statement"
    );
    const names = findings.map((f) => f.detail);
    expect(names.some((d) => d.includes("spend cap"))).toBe(true);
    expect(names.some((d) => d.includes("vendor or model name"))).toBe(true);
    expect(names.some((d) => d.includes("HTTP status"))).toBe(true);
    expect(findings.length).toBeGreaterThanOrEqual(3);
  });

  it("a module dropped for holding nothing is flagged, and one that stays is not", () => {
    // The pair rule takes two documents rather than one, so its fixture is a
    // pair: the same screen for a customer with presence and for one
    // without. A card that renders only when its list has entries
    // disappears from the second.
    const make = (cards: number): ParentNode => {
      const doc = document.implementation.createHTMLDocument("pair");
      doc.body.innerHTML = Array.from({ length: cards }, () => '<div class="card"><p>x</p></div>').join("");
      return doc.body;
    };
    expect(rules.noModuleHidden(make(3), make(2))).toHaveLength(1);
    expect(rules.noModuleHidden(make(3), make(3))).toEqual([]);
  });
});

// ── the real tree: every rule flags nothing ─────────────────────────────

describe("REQ-091 c2 — every route renders for a domain that ranks for nothing", () => {
  it("every page.tsx under src/app has a harness row, so none is skipped", () => {
    const missing = enumerateRoutes(APP_ROOT)
      .map((r) => r.rel)
      .filter((rel) => !(rel in ROUTE_HARNESS));
    expect(missing, `routes with no ROUTE_HARNESS row: ${missing.join(", ")}`).toEqual([]);
  });

  it("this walk finds the same routes as the layout sweep's, so none is swept by neither", async () => {
    // The two enumerators answer different questions about one set — the
    // layout suite returns URLs with the headers to send a browser, this one
    // returns modules to import — so what is compared is the set's size and
    // the shape of each URL, not the filled dynamic segments the other one
    // substitutes. A route either walk misses fails here.
    const layout = await import("../../ui/layout/routes");
    const mine = enumerateRoutes(APP_ROOT);
    const theirs = layout.enumerateRoutes(APP_ROOT);
    expect(mine.length).toBe(theirs.length);
    expect(mine.map((r) => r.url.split("/").length).sort()).toEqual(
      theirs.map((r) => r.path.split("/").length).sort()
    );
  });

  it("every route renders — none fails, blocks or is skipped for want of prior presence", () => {
    expect(cold.length).toBe(Object.keys(ROUTE_HARNESS).length);
    for (const rendered of cold) {
      expect(rendered.html.trim(), `${rendered.route.url} rendered nothing`).not.toBe("");
    }
  });

  it("no blank value stands anywhere a value would sit", () => {
    expect(sweepFindings(cold, rules.noBlankValue)).toEqual([]);
  });

  it("no dash or placeholder stands anywhere a value would sit", () => {
    expect(sweepFindings(cold, rules.noPlaceholderValue)).toEqual([]);
  });

  it("every place rendered is a registered place — an unknown one fails by name", () => {
    expect(sweepFindings(cold, rules.everyPlaceRegistered)).toEqual([]);
  });

  it("every place holding nothing carries exactly one line", () => {
    expect(sweepFindings(cold, rules.exactlyOneLinePerPlace)).toEqual([]);
  });

  it("no module is hidden, dropped or collapsed for holding nothing", () => {
    const findings = cold.flatMap((rendered, i) => {
      const pair = warm[i]!;
      return rules
        .noModuleHidden(pair.doc.body, rendered.doc.body)
        .map((f) => `${rendered.route.url}: ${f.detail}`);
    });
    expect(findings).toEqual([]);

    // The comparison is only worth making where there are modules to drop.
    // Asserted rather than assumed: a render that produced no card at all
    // would satisfy the rule above and mean nothing.
    const modules = warm.reduce((sum, r) => sum + r.doc.querySelectorAll(".card").length, 0);
    expect(modules, "the warm sweep rendered no module at all — the comparison is vacuous").toBeGreaterThan(4);
  });
});

describe("REQ-091 c3 — nothing stands in the place of what the customer does not have", () => {
  it("no rival, search or measurement belonging to another customer appears", () => {
    expect(
      sweepFindings(cold, (doc) =>
        rules.nothingBorrowed(doc, fixture.BORROWABLE, [fixture.COLD_START_DOMAIN])
      )
    ).toEqual([]);
  });

  it("and the rule bites on the real tree: the warm screens do state those rivals", () => {
    // Non-vacuity, on the product rather than on a fixture. The same rule,
    // the same route, the same list — the only thing changed is which
    // customer's report the address resolves to. If this came back empty,
    // the assertion above would be measuring nothing.
    const warmFindings = sweepFindings(warm, (doc) =>
      rules.nothingBorrowed(doc, fixture.BORROWABLE, [fixture.COLD_START_DOMAIN])
    );
    expect(warmFindings.length).toBeGreaterThan(0);
    expect(warmFindings.some((f) => f.includes("rival-one.example.net"))).toBe(true);
  });
});

describe("the sweep states its own coverage (rule 5.5)", () => {
  it("reports routes swept, places exercised and lines still owed", () => {
    const placesRendered = new Set(
      cold.flatMap((r) => [...r.doc.querySelectorAll("[data-place]")].map((el) => el.getAttribute("data-place")))
    );
    const awaiting = cold.reduce((sum, r) => sum + rules.awaitingCopy(r.doc.body), 0);
    const report = [
      `routes enumerated under src/app: ${cold.length}`,
      `places seeded in PLACES: ${Object.keys(PLACES).length}`,
      `places rendered on the cold-start sweep: ${placesRendered.size}`,
      `TODO(copy) markers on the cold-start screens: ${awaiting}`,
      `modules (.card) on the cold-start screens: ${cold.reduce((n, r) => n + r.doc.querySelectorAll(".card").length, 0)}`,
      `modules (.card) on the warm screens: ${warm.reduce((n, r) => n + r.doc.querySelectorAll(".card").length, 0)}`,
    ].join(" · ");
    console.log(`tests/presentation/sweeps/coldstart: ${report}`);

    // Stated, not asserted away: no seeded place renders on today's tree.
    // Overview's chart is #15's, the calendar grid is #16's, and the free
    // page card's rival row is not reached at cold start because the
    // cold-start fixture proposes no page. The rules above are decided on
    // the synthetic tree, and become live on the product the day one of
    // those screens lands.
    expect(cold.length).toBeGreaterThan(0);
    expect(Object.keys(PLACES).length).toBe(5);
  });
});
