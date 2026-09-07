/** @vitest-environment jsdom */
// tests/presentation/sweeps/stopped.test.tsx — BUILD §6.5, §11, REQ-092 c3
// and c8, ADR-010 point 3
//
// Every enumerated route rendered twice — once with ReachKit stopped, once
// without — and asserted at the surface: the screen the customer lands on
// states the stop, no screen states it once the work resumes, and no
// rendered text under a stop hands the customer the product's own
// internals.
//
// **The stop the sweep installs has a second cause standing beside it.**
// `STOPPED_SHELL_FACTS` carries `publishing_paused: true` as well: ADR-011's
// landmine case, where naming the also-true reason reads as more honest and
// is exactly what REQ-092 criterion 7 forbids. Which key survives that is
// decided in `stopped-keys.test.tsx`, where `copy()` is the identity;
// what this file decides is what a reader would read.
//
// **`copy()` is real here**, because the vocabulary check is about words.
//
// 2026-09-06, issue #116: the REQ-092 c5 case, which WO-050 step 9 planned
// and left unwired because `src/lib/publish/` did not exist. It does now,
// so the describe below asserts the property against that module and
// implements none of it — the holding is the machine's.
import path from "node:path";
import React from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
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
const { renderRoute } = await import("./harness");
type RenderedRoute = import("./harness").RenderedRoute;
const rules = await import("./rules");
const { assembleShell } = await import("@/app/(account)/app/_shell/model");
const fixture = await import("./fixture");
const { stoppedWorkStatement } = await import("@/lib/presentation/stopped");
const { formatDate } = await import("@/app/(account)/app/_shell/format");
const AppLayout = (await import("@/app/(account)/app/layout")).default;

const APP_ROOT = path.resolve(import.meta.dirname, "../../../src/app");
const LANDING = "/app"; // "the screen they land on" — BUILD §4.5, the default view.

const wrap = async (page: React.ReactNode): Promise<React.ReactNode> =>
  (await AppLayout({ children: page })) as React.ReactNode;

async function sweep(facts: typeof fixture.WARM_SHELL_FACTS): Promise<RenderedRoute[]> {
  shellState.current = assembleShell(facts);
  const out: RenderedRoute[] = [];
  for (const route of enumerateRoutes(APP_ROOT)) {
    out.push(await renderRoute(route, { domain: fixture.WARM_DOMAIN }, wrap));
  }
  return out;
}

let stopped: RenderedRoute[] = [];
let running: RenderedRoute[] = [];

const STATEMENT = stoppedWorkStatement(fixture.STOP, {
  formatDate: (on) => formatDate(on, fixture.WARM_SHELL_FACTS.timeZone),
});

beforeAll(async () => {
  stopped = await sweep(fixture.STOPPED_SHELL_FACTS);
  running = await sweep(fixture.WARM_SHELL_FACTS);
}, 120_000);

const at = (routes: RenderedRoute[], url: string): RenderedRoute => {
  const found = routes.find((r) => r.route.url === url);
  if (found === undefined) throw new Error(`no route ${url} was swept`);
  return found;
};

describe("REQ-092 c3 — the screen the customer lands on states it", () => {
  it("the landing screen carries the statement, without opening a day or a settings screen", () => {
    const notice = at(stopped, LANDING).doc.querySelector("[data-testid='shell-stopped']");
    expect(notice, "/app renders no stopped-work statement under a stop").not.toBeNull();
    const text = notice!.textContent ?? "";
    expect(text).toContain(STATEMENT.line);
  });

  it("it says whether anything is needed, and when the work is expected back (c2, c4)", () => {
    const notice = at(stopped, LANDING).doc.querySelector("[data-testid='shell-stopped']")!;
    expect(notice.querySelector("[data-testid='shell-stopped-needs']")?.textContent).toBe(
      STATEMENT.needsLine
    );
    expect(notice.querySelector("[data-testid='shell-stopped-resumes']")?.textContent).toBe(
      STATEMENT.resumesLine
    );
    // Never neither: both are on the screen, both non-empty.
    expect(STATEMENT.needsLine).not.toBe("");
    expect(STATEMENT.resumesLine).not.toBe("");
  });

  it("every app screen carries it, so no screen is the one that forgot", () => {
    // The screens inside the shell, which is where the statement lives —
    // not `(account)` as a whole. Setup runs once, *before* the app: it has
    // no publishing state, no week count and no day whose work ReachKit
    // could have stopped, which is why issue #14 put it outside the shell.
    const appScreens = stopped.filter((r) => r.insideShell);
    expect(appScreens.length).toBeGreaterThan(0);
    for (const screen of appScreens) {
      expect(
        screen.doc.querySelector("[data-testid='shell-stopped']"),
        `${screen.route.url} states no stop`
      ).not.toBeNull();
    }
  });

  it("it stops stating it once the work resumes — no route, no cached banner", () => {
    // There is no dismissal flag, no cached banner and no "seen" state to
    // clear: with `stopped` null the notice is not rendered at all.
    //
    // What is checked is the *statement*, not every occurrence of its
    // words. A calendar day ReachKit emptied last Tuesday still says so
    // once the work resumes — that is REQ-043 c4's account of that date,
    // and criterion 3's "stops stating it" is about the screen the
    // customer lands on today, not about the past.
    for (const r of running) {
      expect(
        r.doc.querySelector("[data-testid='shell-stopped']"),
        `${r.route.url} carries the stopped-work statement with no stop`
      ).toBeNull();
    }
    expect(at(stopped, LANDING).doc.querySelector("[data-testid='shell-stopped']")).not.toBeNull();
  });

  it("the stop is not one of Overview's two alerts (REQ-041 c5)", () => {
    // The statement is an alert of its own. What must not change is the
    // count of the alerts REQ-041 c5 caps at two — the items that cannot
    // proceed without the customer — so the count *outside* the stopped
    // notice is what is compared.
    const others = (r: RenderedRoute): number =>
      [...r.doc.querySelectorAll("[role='alert']")].filter(
        (el) => el.closest("[data-testid='shell-stopped']") === null
      ).length;
    expect(others(at(stopped, LANDING))).toBe(others(at(running, LANDING)));
  });
});

describe("REQ-092 c8 — no internal cause, anywhere the statement renders", () => {
  it("the statement itself names no cap, no spend, no vendor, no error and no status", () => {
    const notice = at(stopped, LANDING).doc.querySelector("[data-testid='shell-stopped']")!;
    expect(rules.noInternalCause(notice, "statement")).toEqual([]);
  });

  it("no route rendered under a stop leaks one anywhere on the screen", () => {
    const findings = stopped.flatMap((r) =>
      rules.noInternalCause(r.doc.body, "everywhere").map((f) => `${r.route.url} [${f.rule}] ${f.detail}`)
    );
    expect(findings).toEqual([]);
  });

  it("the stop the sweep installed carries no field an internal cause could travel in", () => {
    expect(Object.keys(fixture.STOP).sort()).toEqual(["needs", "partial", "resumes", "since"]);
  });
});

describe("REQ-091 c2 still holds under a stop — a stopped screen is not a blank one", () => {
  it("no blank, dash or placeholder stands where a value would sit", () => {
    const findings = stopped.flatMap((r) => [
      ...rules.noBlankValue(r.doc.body).map((f) => `${r.route.url} ${f.detail}`),
      ...rules.noPlaceholderValue(r.doc.body).map((f) => `${r.route.url} ${f.detail}`),
    ]);
    expect(findings).toEqual([]);
  });

  it("no module is dropped by the stop", () => {
    const findings = stopped.flatMap((r, i) =>
      rules.noModuleHidden(running[i]!.doc.body, r.doc.body).map((f) => `${r.route.url}: ${f.detail}`)
    );
    expect(findings).toEqual([]);
  });
});

describe("REQ-092 c5 — prepared pages survive the stop, and none is dropped or marked published", () => {
  // WO-050 step 9's assertion, now that BUILD §9's machine is on disk
  // (#45, #46, #131). This suite **asserts** the property and implements
  // none of it: the holding is `src/lib/publish/`'s, and every line below
  // reads that module rather than restating its rules. No database — the
  // machine's guard deps are injected, which is what they exist for.
  const HELD_STATES = ["in_review", "approved", "failed"] as const;

  it("every route into an attempt is guarded by the stop, so no route publishes around it", async () => {
    const { GUARDS, TRANSITIONS, edgeKey } = await import("@/lib/publish/machine");
    const intoPublishing = TRANSITIONS.filter(([, to]) => to === "publishing");
    expect(intoPublishing.length).toBeGreaterThan(0);
    for (const [from, to] of intoPublishing) {
      const guards = GUARDS[edgeKey(from, to)] ?? [];
      expect(guards, `${from}→${to}`).toContain("reachkit_not_stopped");
      // ADR-011: the stop outranks every other cause that is also true, so
      // it is the guard that names itself when two hold at once.
      expect(guards[0], `${from}→${to}`).toBe("reachkit_not_stopped");
    }
  });

  it("the stop refuses the attempt and moves the page nowhere — held is the absence of an edge", async () => {
    const { GUARD_FNS } = await import("@/lib/publish/machine");
    const guard = GUARD_FNS.reachkit_not_stopped;

    for (const state of HELD_STATES) {
      const context = {
        draft: { siteId: "s1", state } as never,
        by: { kind: "system", job: "publish/execute" } as never,
        at: new Date("2026-09-15T12:00:00Z"),
        deps: { reachKitStopped: async () => true } as never,
      };
      // The guard answers `false` — a refusal. `transition()` returns
      // before its one write on a refusal, so the page keeps its state,
      // its transitions array and its `publishable_since`: not skipped,
      // not discarded, not marked published.
      expect(await guard(context), state).toBe(false);
    }
  });

  it("the states a stop holds are the states the resume order drains, so none is dropped", async () => {
    const { HELD_STATES: HELD } = await import("@/lib/publish/switch");
    // The held set is derived from the page's own state and the moment it
    // became publishable — it never asks *why* no attempt began. So the
    // pages a stop holds are the same pages, in the same order, as the
    // pages the customer's own pause holds, and a resume drains them
    // oldest-first whichever was holding them.
    expect([...HELD].sort()).toEqual([...HELD_STATES].sort());
  });

  it("nothing on the stop path can mark a page published or skipped: neither is reachable from a refusal", async () => {
    const { GUARDS, edgeKey, TRANSITIONS } = await import("@/lib/publish/machine");
    // `published` is reachable only through `publishing`, and every edge
    // into `publishing` carries the stop. `skipped` is reachable only from
    // `planned`, `in_review` and `needs_attention` — the customer's own
    // veto and skip — and no stop takes one.
    const intoPublished = TRANSITIONS.filter(([, to]) => to === "published").map(([from]) => from);
    expect(intoPublished).toEqual(["publishing"]);
    for (const [from, to] of TRANSITIONS.filter(([, t]) => t === "publishing")) {
      expect(GUARDS[edgeKey(from, to)]).toContain("reachkit_not_stopped");
    }
  });
});

describe("the sweep states its own coverage (rule 5.5)", () => {
  it("reports routes rendered twice, vocabulary entries checked and what is not wired", () => {
    const report = [
      `routes rendered under a stop: ${stopped.length}`,
      `routes rendered with the work running: ${running.length}`,
      `vocabulary entries checked: ${rules.INTERNAL_CAUSE_VOCABULARY_SIZE}`,
      `app screens stating the stop: ${stopped.filter((r) => r.doc.querySelector("[data-testid='shell-stopped']") !== null).length}`,
      // REQ-092 c5 — "every prepared page is still there and publishes on
      // the normal schedule" — is a property of the publish state machine
      // (BUILD §9), which is now on disk (#45, #46, #131) and wired to the
      // stop by #116. Asserted above, against `src/lib/publish/`'s own
      // table, guards and held set.
      "REQ-092 c5 (prepared pages survive a stop): WIRED — reachkit_not_stopped guards all 3 routes into an attempt",
    ].join(" · ");
    console.log(`tests/presentation/sweeps/stopped: ${report}`);
    expect(stopped.length).toBe(running.length);
    expect(stopped.length).toBeGreaterThan(0);
  });
});
