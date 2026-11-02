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
    expect(root.getAttribute("data-arm-medium")).toBe("same-as-below");
    expect(root.getAttribute("data-arm-wide")).toBe("same-as-below");
  });

  it("opens on the first step — the founder's site — with one primary", async () => {
    const tree = await renderPage(() => import("@/app/(account)/setup/page"));
    expect(tree.querySelector('[data-testid="setup-address"]')).not.toBeNull();
    // The later steps are not on this screen: one step at a time.
    for (const id of ["setup-check", "setup-competitors", "setup-publishing", "setup-voice"]) {
      expect(tree.querySelector(`[data-testid="${id}"]`), id).toBeNull();
    }
    expect(tree.querySelectorAll(".btn-primary:not(.btn-soft, .btn-outline, .btn-ghost)")).toHaveLength(1);
  });

  it("an address naming a step opens on that step", async () => {
    const tree = await renderPage(() => import("@/app/(account)/setup/page"), { step: "check" });
    expect(tree.querySelector('[data-testid="setup-form"]')?.getAttribute("data-step")).toBe(
      "check",
    );
    expect(tree.querySelector('[data-testid="setup-competitors"]')).not.toBeNull();
    expect(tree.querySelector('[data-testid="setup-address"]')).toBeNull();
  });

  it("states where the founder is, in the three steps (docs/spec/decisions/2026-10-22-1737.md)", async () => {
    const tree = await renderPage(() => import("@/app/(account)/setup/page"));
    const steps = tree.querySelector('[data-testid="setup-steps"]');
    expect(steps).not.toBeNull();
    expect(steps?.getAttribute("data-current")).toBe("site");
    expect(steps?.querySelectorAll("li")).toHaveLength(3);
  });

  it("a business that sells online leaves the city empty and Continue still carries it on, sending no place", async () => {
    const { createRoot } = await import("react-dom/client");
    const { act } = await import("react");
    const { SetupForm } = await import("@/app/(account)/setup/SetupForm");
    const { assembleSetup } = await import("@/app/(account)/setup/_setup/facts");
    const { FIXTURE_SETUP_FACTS } = await import("@/app/(account)/setup/_setup/fixture");
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    // The fixture is the software kind, and nothing was read for where it serves.
    expect(FIXTURE_SETUP_FACTS.market?.offeringType).toBe("software");
    expect(FIXTURE_SETUP_FACTS.place).toBe("");

    const posted: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      posted.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      return Response.json({ ok: true });
    }));
    const container = document.createElement("div");
    const root = createRoot(container);
    try {
      await act(async () =>
        root.render(
          <NuqsTestingAdapter searchParams={{ step: "site" }}>
            <SetupForm model={assembleSetup(FIXTURE_SETUP_FACTS)} />
          </NuqsTestingAdapter>,
        ),
      );
      expect(container.querySelector<HTMLInputElement>('input[name="place"]')?.value).toBe("");
      const onwards = container.querySelector<HTMLButtonElement>('[data-testid="setup-onwards"]')!;
      expect(onwards.disabled).toBe(false);
      await act(async () => onwards.click());
      await vi.waitFor(() =>
        expect(container.querySelector('[data-testid="setup-form"]')?.getAttribute("data-step")).toBe("check"),
      );
      expect(posted).toEqual([{ step: "site", domain: "example.com", locale: "US/en" }]);
      expect(container.querySelector('[data-testid="setup-submit-refusal"]')).toBeNull();
    } finally {
      act(() => root.unmount());
      vi.unstubAllGlobals();
    }
  });

  it("sits outside the /app shell — no sidebar, no tab bar, no publishing card", async () => {
    const tree = await renderPage(() => import("@/app/(account)/setup/page"));
    for (const id of ["shell-sidebar", "shell-top", "shell-publishing"]) {
      expect(tree.querySelector(`[data-testid="${id}"]`), id).toBeNull();
    }
  });

  it("waits in the step's own regions — header, step bar, question, bar (#1327)", async () => {
    const { SetupSkeleton } = await import("@/app/(account)/setup/SetupSkeleton");
    const waiting = document.createElement("div");
    waiting.innerHTML = renderToStaticMarkup(<SetupSkeleton />);
    const step = await renderPage(() => import("@/app/(account)/setup/page"));

    // The layout of each region, without the step's own entrance motion.
    const layout = (el: Element | null | undefined) =>
      (el?.getAttribute("class") ?? "missing").split(" ").filter((c) => !c.startsWith("motion-safe:")).join(" ");
    const regions = (tree: Element) => {
      const steps = tree.querySelector('[data-frame="setup-steps"]');
      const question = tree.querySelector('[data-frame="setup-columns"]');
      return {
        frame: layout(tree.firstElementChild),
        header: layout(tree.querySelector("header")),
        headerInner: layout(steps?.parentElement),
        steps: `${layout(steps)} × ${steps?.children.length}`,
        body: layout(question?.parentElement),
        question: layout(question),
        bar: layout(tree.querySelector("footer")),
        barInner: layout(tree.querySelector("footer > div")),
      };
    };
    expect(regions(waiting)).toEqual(regions(step));
    expect(waiting.querySelector(".loading")).toBeNull();
    expect(waiting.querySelector('[role="status"][aria-busy="true"]')).not.toBeNull();
  });

  it("the Connect step carries the record, its Value the deployment's own edge binding (#2270)", async () => {
    // The fixture env's target and the fixture customer's host happen to read alike;
    // tests/app/setup/screen.test.tsx holds the two apart with a target unlike the host.
    const tree = await renderPage(() => import("@/app/(account)/setup/page"), {
      step: "publishing",
    });
    const value = [...tree.querySelectorAll('[data-testid="setup-record"] > div')][2];
    expect(value?.querySelector(".num")?.textContent).toBe(process.env.HOSTED_EDGE_CNAME_TARGET);
  });
});
