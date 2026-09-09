/** @vitest-environment jsdom */
// tests/app/setup/page.test.tsx — BUILD §4.3
//
// The two routes as they actually render: the screen root each declares,
// and the fact that neither reaches for anything a fixture cannot supply.
// The five-width sweep is `tests/ui/layout/layout.test.ts`'s; this is the
// cheap check that runs on every push.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { applyEnvFixture } from "../../mail/env-fixture.ts";
import { passFactory, reportFactory, resetSetupSession, sessionFactory, storeFactory } from "./session-door";

const redirect = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  redirect: (path: string) => redirect(path),
}));


// #169: the setup screens name their founder through `currentSession()`
// and read the address, the report and the pass live. The factories live in
// `session-door.ts`; the `vi.mock` lines stay here, because vitest hoists a
// `vi.mock` found in an imported module and would install it for every
// suite that imports it.
vi.mock("@/app/(account)/setup/_setup/store", async (importOriginal) =>
  storeFactory(await importOriginal<Record<string, unknown>>())
);
vi.mock("@/lib/scan/report", async (importOriginal) =>
  reportFactory(await importOriginal<Record<string, unknown>>())
);
vi.mock("@/lib/scan/deep/progress", () => passFactory());

// The doubles are module-level mutable state, so a test that changes one
// must not leave it changed for the next.
beforeEach(() => resetSetupSession());
vi.mock("@/lib/account/identity", () => sessionFactory());


beforeAll(() => {
  applyEnvFixture();
});

async function renderPage(loader: () => Promise<{ default: () => Promise<React.JSX.Element> }>) {
  const { default: Page } = await loader();
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(await Page());
  return container;
}

describe("/setup", () => {
  it("declares exactly one screen root, with an arm per band", async () => {
    const tree = await renderPage(() => import("@/app/(account)/setup/page"));
    const surfaces = tree.querySelectorAll("[data-surface]");
    expect(surfaces).toHaveLength(1);
    const root = surfaces[0]!;
    expect(root.getAttribute("data-arm-compact")).toBe("columns:1");
    expect(root.getAttribute("data-arm-medium")).toBe("columns:2");
    expect(root.getAttribute("data-arm-wide")).toBe("same-as-below");
  });

  it("renders the three decisions, the address and one submit", async () => {
    const tree = await renderPage(() => import("@/app/(account)/setup/page"));
    // The fixture's report arm: UI-SPEC S10 merges the site and the market
    // into one card, so the address's slot is that card.
    for (const id of [
      "setup-site-and-market",
      "setup-market",
      "setup-competitors",
      "setup-publishing",
    ]) {
      expect(tree.querySelector(`[data-testid="${id}"]`), id).not.toBeNull();
    }
    expect(tree.querySelectorAll('button[type="submit"]')).toHaveLength(1);
  });

  it("states where the founder is, in the set's three phases (UI-SPEC S10)", async () => {
    const tree = await renderPage(() => import("@/app/(account)/setup/page"));
    const strip = tree.querySelector('[data-testid="setup-progress"]');
    expect(strip).not.toBeNull();
    expect(strip?.getAttribute("data-current")).toBe("setup");
    expect(strip?.querySelectorAll("li")).toHaveLength(3);
  });

  it("REQ-021 c10's own line sits under the one control", async () => {
    const tree = await renderPage(() => import("@/app/(account)/setup/page"));
    expect(tree.querySelector('[data-testid="setup-footer-line"]')?.textContent).toBe(
      "You can reach Settings, cancel or export at any time — finishing setup is not required for that."
    );
  });

  it("sits outside the /app shell — no sidebar, no tab bar, no publishing card", async () => {
    const tree = await renderPage(() => import("@/app/(account)/setup/page"));
    for (const id of ["shell-sidebar", "shell-top", "shell-publishing"]) {
      expect(tree.querySelector(`[data-testid="${id}"]`), id).toBeNull();
    }
  });

  it("the CNAME record points at the deployment's own edge binding, never a literal in a card", async () => {
    const tree = await renderPage(() => import("@/app/(account)/setup/page"));
    const record = tree.querySelector('[data-testid="setup-dns-record"]');
    // The fixture env's `HOSTED_EDGE_CNAME_TARGET`.
    expect(record?.textContent).toContain("content.example.com");
  });
});

describe("/setup/waiting", () => {
  it("declares exactly one screen root and renders the running step, not a redirect", async () => {
    redirect.mockClear();
    const tree = await renderPage(() => import("@/app/(account)/setup/waiting/page"));
    expect(redirect).not.toHaveBeenCalled();
    expect(tree.querySelectorAll("[data-surface]")).toHaveLength(1);
    // `data-stage` names the **drawn row** since #356, not the engine
    // handle: UI-SPEC S11 draws five rows over the engine's six, and the
    // pass's `reading_your_market` is one of the three on the first row.
    expect(tree.querySelector('[data-testid="setup-waiting"]')?.getAttribute("data-stage")).toBe(
      "measuring_your_market"
    );
    // Five rows, one current. This pass recorded no instants, so no
    // finished row states a time — a duration nobody measured is not a
    // duration of none — and the current row states the dash.
    expect(tree.querySelectorAll(".rk-stage")).toHaveLength(5);
    expect(
      Array.from(tree.querySelectorAll(".rk-stage")).map((row) => row.getAttribute("data-state"))
    ).toEqual(["current", "pending", "pending", "pending", "pending"]);
    expect(
      Array.from(tree.querySelectorAll(".rk-stage-t")).map((node) => node.textContent)
    ).toEqual(["–"]);
  });

  it("also sits outside the /app shell", async () => {
    const tree = await renderPage(() => import("@/app/(account)/setup/waiting/page"));
    expect(tree.querySelector('[data-testid="shell-sidebar"]')).toBeNull();
  });
});
