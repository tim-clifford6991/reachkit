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

// Issue #144: `(public)/veto/[token]` redeems its token on arrival, which
// reaches the admin database — and these sweeps render in jsdom, where
// `dbAdmin()` refuses by design. The unknown-link answer is the one the
// route's own layout fixture uses (`tests/ui/layout/routes.ts`) and the one
// a token that verifies against nothing produces in the product: no page
// leaves review, no token is marked used. It is the arm, not the read, that
// these sweeps are about.
vi.mock("@/lib/publish/publishable", () => ({
  redeemVetoLink: async () => ({ ok: false, reason: "unknown" }),
}));

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

// BUILD §9, issue #49 — the hosted edge is a route, so it is in this
// sweep's scope by construction (ADR-010). Its whole input is a Host header
// and a `publications` row; both are supplied by `hosted-fixture.ts`, and
// the render the sweep then measures is the real template's.
vi.mock("next/headers", async () => {
  const { HOSTED_SWEEP_HOST } = await import("./hosted-fixture");
  return { headers: async () => new Headers({ host: HOSTED_SWEEP_HOST }) };
});

vi.mock("@/lib/account/billing", () => ({
  hostedServingState: async () => ({ serve: true }),
}));

vi.mock("@/lib/publish/destinations/hosted", async (importOriginal) => {
  const { hostedModuleMock } = await import("./hosted-fixture");
  return hostedModuleMock(await importOriginal<Record<string, unknown>>());
});

// BUILD §4.4–§4.6, issue #169 — the `(account)/app` routes now resolve who
// is asking through `_session/account.ts`, which reads a signed cookie and
// a `sites` row. This sweep has neither, so it signs in as the reserved
// fixture account: every one of those routes then takes the same fixture
// branch it always took, and the sweep goes on measuring the screens rather
// than a redirect to the sign-in prompt.
// BUILD §4.3, issue #169 — the setup screens name their founder through
// `currentSession()` and read the address, the report and the pass live.
// This sweep has none of those; the factories are `tests/app/setup`'s, so
// the screen it measures is the one a provisioned founder sees.
vi.mock("@/lib/account/identity", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const { sessionFactory } = await import("../../app/setup/session-door");
  return { ...actual, ...sessionFactory() };
});

vi.mock("@/app/(account)/setup/_setup/store", async (importOriginal) => {
  const { storeFactory } = await import("../../app/setup/session-door");
  return storeFactory(await importOriginal<Record<string, unknown>>());
});

vi.mock("@/lib/scan/report", async (importOriginal) => {
  const { reportFactory } = await import("../../app/setup/session-door");
  return reportFactory(await importOriginal<Record<string, unknown>>());
});

vi.mock("@/lib/scan/deep/progress", async () => {
  const { passFactory } = await import("../../app/setup/session-door");
  return passFactory();
});

vi.mock("@/app/(account)/app/_session/account", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const { RESERVED_ACCOUNT } = await import("../../app/accounts");
  return {
    ...actual,
    appAccount: async () => ({ ok: true, account: RESERVED_ACCOUNT }),
    requireAppAccount: async () => RESERVED_ACCOUNT,
    requireSetUpAccount: async () => RESERVED_ACCOUNT,
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
  /** The public landing (issue #266).
   *
   *  Criterion 3 is about a **customer's** screen on their first day: what
   *  may not stand in the place of what *they* do not have. The landing has
   *  no customer — it is the page a stranger meets before there is an
   *  account — and since #266 its hero carries the product's own specimen:
   *  the reserved fixture account's AI-answers module, rendered by the same
   *  component the report renders, and named as a specimen by
   *  `landing.hero.specimen.caption`.
   *
   *  Those rows carry the fixture's rival domains, which are on
   *  `BORROWABLE` because they are the *warm* fixture's — so the rule fires
   *  on a screen it was not written about. The route is excluded here and
   *  nowhere else: every account screen, and every other public one, is
   *  still swept, and the non-vacuity test below still proves the rule
   *  bites on the real tree.
   *
   *  **Flagged rather than settled** (#266): `design/tokens.md` §9.4 raised
   *  "where does the specimen score come from?" and answered neither
   *  surface; the master answered it for this build — the reserved
   *  fixture's, stated as such. If the owner would rather the landing show
   *  no other domain at all, the specimen loses its rival rows and this
   *  exclusion goes with them. */
  const LANDING = "/";

  it("no rival, search or measurement belonging to another customer appears", () => {
    expect(
      sweepFindings(
        cold.filter((r) => r.route.url !== LANDING),
        (doc) => rules.nothingBorrowed(doc, fixture.BORROWABLE, [fixture.COLD_START_DOMAIN])
      )
    ).toEqual([]);
  });

  it("the landing is excluded on purpose, and it is the only one", () => {
    // Rule 5.5: the exclusion is stated and counted, never read off a
    // silent green. One route, and the sweep still covers the rest.
    const excluded = cold.filter((r) => r.route.url === LANDING);
    expect(excluded).toHaveLength(1);
    expect(cold.length).toBeGreaterThan(1);
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

// ── §9.1's ranks: one solid primary per account screen ──────────────────

// tokens.md §9.1, the owner-approved idiom #266 ported: "one solid accent
// primary, an outline secondary, a quiet tertiary". The rank is a *screen's*
// property, not a component's — two filled accent buttons on one screen are
// two calls to action of equal weight, which is what the account audit found
// on the draft view (issue #271: Approve and Veto both filled, for opposite
// consequences).
//
// Asserted on the rendered document rather than over the source, because
// what the rule is about is what the customer sees standing on one screen:
// a screen composes panels from several files, and a source count could not
// tell one screen's two panels from two screens' one each.
//
// The scope is `src/app/(account)/**`, by group and not by name, so a
// screen added there later is in scope the day its `page.tsx` lands.

/** The one class `Btn` gives the solid accent rank. The two quiet arms carry
 *  `rk-btn-outline`/`rk-btn-tertiary` on a `btn-ghost` base, and the
 *  inverted arm is `rk-btn-inverse` — none of them a second solid fill. */
const SOLID_PRIMARY = ".btn-primary";

/** The screens that draw more than one today, each with the reason and the
 *  issue that settles it. Fail-closed: the test below also asserts every
 *  entry is still over the limit, so a route that gets fixed fails here as a
 *  stale exemption rather than sitting on the list forever. */
/** The account screens that draw more than one today, each with the reason
 *  and the issue that settles it. Fail-closed: the test below also asserts
 *  every entry is still over the limit, so a route that gets fixed fails
 *  here as a stale exemption rather than sitting on the list forever.
 *
 *  **Empty since issue #288.** It held `/setup`, which spent the solid
 *  accent as a *selected* state across four groups — the chosen rivals, the
 *  suggested rivals, the publishing mode and the destination — so a founder
 *  with five rivals met six solid primaries and could not tell which one
 *  submitted the form. Selected is the outline rank on the accent tint now,
 *  and the one solid on that screen is the submit. A future entry is added
 *  the same way and lives under the same rule. */
const MORE_THAN_ONE_PRIMARY: Readonly<Record<string, string>> = Object.freeze({});

/** The public screens the owner has ruled may draw more than one, each with
 *  the reason and the ruling that settles it. Same fail-closed rule — an
 *  entry that stops drawing two fails below as a stale exemption rather
 *  than sitting here.
 *
 *  **Both entries are rulings, not debts.** #290/#291 had settled each
 *  screen down to one — the report's Start solid with the giveaway outline,
 *  the landing's hero control alone — and ruling 2b of 2026-09-08 reverses
 *  both: "two solid primaries per screen are allowed **where the artifact
 *  draws them** (landing: header CTA + hero CTA; report: Email me +
 *  Start)". Each screen's ceiling is held by its own test —
 *  `tests/app/scan-address/report-view.test.tsx` for the report,
 *  `tests/app/chrome/header.test.tsx` and `landing-s1.test.tsx` for the
 *  landing. */
const MORE_THAN_ONE_PRIMARY_PUBLIC: Readonly<Record<string, string>> = Object.freeze({
  "/scan/[domain]":
    "ruling 2b (2026-09-08): the giveaway's Email me and the pricing card's Start are both solid, as the approved set draws them; supersedes #291.",
  "/":
    "ruling 2b (2026-09-08), UI-SPEC S1. The landing's solids are one action " +
    "stated three times: the header's CTA, the hero's own submit, and the " +
    "closing CTA under the three Step cards — the set draws all three solid, " +
    "and the two that are not the submit focus that same field (REQ-099 c3) " +
    "rather than offering a second action. This sweep sees two of them: the " +
    "header is the group layout's and does not render here.",
});

function primariesPerScreen(rendered: RenderedRoute[], group: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rendered) {
    if (!r.route.groups.includes(group)) continue;
    out.set(r.route.url, r.doc.querySelectorAll(SOLID_PRIMARY).length);
  }
  return out;
}

function primariesPerAccountScreen(rendered: RenderedRoute[]): Map<string, number> {
  return primariesPerScreen(rendered, "(account)");
}

describe("§9.1 idiom — one solid primary per screen, across src/app/(account)/**", () => {
  it("no account screen draws a second solid accent button", () => {
    for (const sweep of [cold, warm]) {
      const over = [...primariesPerAccountScreen(sweep)]
        .filter(([url, n]) => n > 1 && !(url in MORE_THAN_ONE_PRIMARY))
        .map(([url, n]) => `${url}: ${n}`);
      expect(over, `screens with more than one ${SOLID_PRIMARY}: ${over.join(", ")}`).toEqual([]);
    }
  });

  it("the draft view draws exactly one, and it is Approve", () => {
    const draft = cold.find((r) => r.route.url.startsWith("/app/draft"));
    const actions = draft?.doc.querySelector('[data-testid="draft-actions"]');
    expect(actions?.querySelectorAll(SOLID_PRIMARY)).toHaveLength(1);
    // The other two are the idiom's quiet ranks, and the veto carries the
    // one tone a rank may take.
    expect(actions?.querySelectorAll(".rk-btn-outline[data-tone='warn']")).toHaveLength(1);
    expect(actions?.querySelectorAll(".rk-btn-tertiary")).toHaveLength(1);
  });

  // The same rule over `src/app/(public)/**` (issue #290), as ruling 2b of
  // 2026-09-08 leaves it: one solid per public screen, except where the
  // owner's approved set draws more and `MORE_THAN_ONE_PRIMARY_PUBLIC` says
  // which screen and why. The rule itself is unchanged and still fails
  // closed — what changed is that the landing has a named exemption.
  //
  // The header does not appear in this sweep at all: the harness renders a
  // route's own `page.tsx` without its group layout, which is what makes
  // the counts below a *screen's* own. The header's rank is asserted where
  // it renders, in `tests/app/chrome/header.test.tsx`.
  it("no public screen draws a second solid accent button", () => {
    for (const sweep of [cold, warm]) {
      const over = [...primariesPerScreen(sweep, "(public)")]
        .filter(([url, n]) => n > 1 && !(url in MORE_THAN_ONE_PRIMARY_PUBLIC))
        .map(([url, n]) => `${url}: ${n}`);
      expect(over, `public screens with more than one ${SOLID_PRIMARY}: ${over.join(", ")}`).toEqual(
        []
      );
    }
  });

  it("every exempt public screen is still over the limit — a fixed one fails here", () => {
    const counts = primariesPerScreen(warm, "(public)");
    for (const [url, why] of Object.entries(MORE_THAN_ONE_PRIMARY_PUBLIC)) {
      expect(counts.has(url), `${url} is exempt but is not a public route`).toBe(true);
      expect(counts.get(url), `${url} no longer draws two — drop the exemption. ${why}`).toBeGreaterThan(1);
    }
  });

  it("every exempt screen is still over the limit — a fixed one fails here", () => {
    const counts = primariesPerAccountScreen(warm);
    for (const [url, why] of Object.entries(MORE_THAN_ONE_PRIMARY)) {
      expect(counts.has(url), `${url} is exempt but is not an account route`).toBe(true);
      expect(counts.get(url), `${url} no longer draws two — drop the exemption. ${why}`).toBeGreaterThan(1);
    }
  });
});
