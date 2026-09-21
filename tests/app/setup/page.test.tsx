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
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
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

// SPEC §5 (2026-09-20): which step is on screen is the URL's, and `nuqs`
// reads it through an adapter the root layout supplies. A route rendered
// on its own has no layout above it, so the suite supplies the library's
// own testing adapter and the step it is asking about.
async function renderPage(
  loader: () => Promise<{ default: () => Promise<React.JSX.Element> }>,
  searchParams: Record<string, string> = {},
) {
  const { default: Page } = await loader();
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(
    <NuqsTestingAdapter searchParams={searchParams}>{await Page()}</NuqsTestingAdapter>,
  );
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

  it("opens on the first step — the founder's site and market — with one primary", async () => {
    const tree = await renderPage(() => import("@/app/(account)/setup/page"));
    expect(tree.querySelector('[data-testid="setup-site-and-market"]')).not.toBeNull();
    // The later steps' decisions are not on this screen: one question at a
    // time is what SPEC §5 (2026-09-20) asks for.
    for (const id of ["setup-competitors", "setup-publishing", "setup-voice"]) {
      expect(tree.querySelector(`[data-testid="${id}"]`), id).toBeNull();
    }
    expect(tree.querySelectorAll(".btn-primary")).toHaveLength(1);
  });

  it("an address naming a step opens on that step", async () => {
    const tree = await renderPage(() => import("@/app/(account)/setup/page"), { step: "rivals" });
    expect(tree.querySelector('[data-testid="setup-form"]')?.getAttribute("data-step")).toBe(
      "rivals",
    );
    expect(tree.querySelector('[data-testid="setup-competitors"]')).not.toBeNull();
    expect(tree.querySelector('[data-testid="setup-site-and-market"]')).toBeNull();
  });

  it("states where the founder is, in the five steps (SPEC §5, 2026-09-20)", async () => {
    const tree = await renderPage(() => import("@/app/(account)/setup/page"));
    const steps = tree.querySelector('[data-testid="setup-steps"]');
    expect(steps).not.toBeNull();
    expect(steps?.getAttribute("data-current")).toBe("site");
    expect(steps?.querySelectorAll("li")).toHaveLength(5);
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

  it("the publishing step shows no record — it is its own step after setup (#924)", async () => {
    // Owner, 2026-09-20, reversing #757. The record's own screen, and the
    // property that its target is the deployment's binding rather than a
    // literal in a card, are `tests/app/setup/connect.test.tsx`'s.
    const tree = await renderPage(() => import("@/app/(account)/setup/page"), {
      step: "publishing",
    });
    expect(tree.querySelector('[data-testid="dns-record"]')).toBeNull();
    expect(tree.querySelector('[data-testid="setup-dns-next"]')).not.toBeNull();
  });
});
