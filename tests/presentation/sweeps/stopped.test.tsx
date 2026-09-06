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
import path from "node:path";
import React from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
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
    const appScreens = stopped.filter((r) => r.route.groups.includes("(account)"));
    expect(appScreens.length).toBeGreaterThan(0);
    for (const screen of appScreens) {
      expect(
        screen.doc.querySelector("[data-testid='shell-stopped']"),
        `${screen.route.url} states no stop`
      ).not.toBeNull();
    }
  });

  it("it stops stating it once the work resumes — no route, no cached banner", () => {
    const leaks = running
      .filter((r) => r.text.includes(STATEMENT.line))
      .map((r) => r.route.url);
    expect(leaks, "a route states the stop with no stop to state").toEqual([]);
    for (const r of running) {
      expect(r.doc.querySelector("[data-testid='shell-stopped']"), r.route.url).toBeNull();
    }
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

describe("the sweep states its own coverage (rule 5.5)", () => {
  it("reports routes rendered twice, vocabulary entries checked and what is not wired", () => {
    const report = [
      `routes rendered under a stop: ${stopped.length}`,
      `routes rendered with the work running: ${running.length}`,
      `vocabulary entries checked: ${rules.INTERNAL_CAUSE_VOCABULARY_SIZE}`,
      `app screens stating the stop: ${stopped.filter((r) => r.doc.querySelector("[data-testid='shell-stopped']") !== null).length}`,
      // REQ-092 c5 — "every prepared page is still there and publishes on
      // the normal schedule" — is a property of the publish state machine
      // (BUILD §9), and `src/lib/publish/` does not exist yet. Reported as
      // unwired rather than asserted vacuously.
      "REQ-092 c5 (prepared pages survive a stop): UNWIRED — no publish state machine on disk",
    ].join(" · ");
    console.log(`tests/presentation/sweeps/stopped: ${report}`);
    expect(stopped.length).toBe(running.length);
    expect(stopped.length).toBeGreaterThan(0);
  });
});
