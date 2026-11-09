/** @vitest-environment jsdom */
// `/setup`'s Site and Check steps draw the icons their boards Setup1 and Setup2 draw, each beside the words it marks.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), redirect: vi.fn() }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { SetupForm } = await import("@/app/(account)/setup/SetupForm");
const { assembleSetup } = await import("@/app/(account)/setup/_setup/facts");
const { FIXTURE_SETUP_FACTS } = await import("@/app/(account)/setup/_setup/fixture");
const { COPY } = await import("@/lib/presentation/copy");

const roots: Root[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount());
});

async function mount(step: "site" | "check"): Promise<HTMLElement> {
  const container = document.createElement("div");
  const root = createRoot(container);
  roots.push(root);
  await act(async () =>
    root.render(
      <NuqsTestingAdapter searchParams={{ step }}>
        <SetupForm model={assembleSetup(FIXTURE_SETUP_FACTS)} />
      </NuqsTestingAdapter>,
    ),
  );
  return container;
}

/** The lucide icons inside `el`, by name, in document order. */
const icons = (el: Element | null | undefined): string[] =>
  [...(el?.querySelectorAll("svg.lucide") ?? [])].map((svg) => [...svg.classList].filter((c) => c.startsWith("lucide-")).at(-1)!.slice("lucide-".length));

describe("Setup's steps carry their board icons", () => {
  it("step 1 draws clock-4 beside the time, and the site's own mark, not an icon, beside its domain", async () => {
    const root = await mount("site");

    expect(icons(root.querySelector('[data-testid="setup-step-time"]'))).toEqual(["clock-4"]);

    const well = root.querySelector('[data-testid="setup-address-value"]')!.parentElement;
    expect(icons(well)).toEqual([]);
    expect(well?.querySelector('[aria-hidden="true"]')?.textContent).toBe("E");
  });

  it("step 2's tiles", async () => {
    const root = await mount("check");

    const tiles = [...root.querySelectorAll('[data-testid^="setup-check-"] > summary')].map((summary) => ({
      title: summary.querySelector("strong")?.textContent,
      icons: icons(summary.querySelector('[aria-hidden="true"]')),
    }));
    expect(tiles).toEqual([
      { title: COPY["setup.check.business"], icons: ["building"] },
      { title: COPY["setup.check.market"], icons: ["users"] },
      { title: COPY["setup.check.voice"], icons: ["message-circle"] },
      { title: COPY["setup.business.questions"], icons: ["circle-question-mark"] },
    ]);

    expect(icons(root.querySelector('[data-testid="setup-business-assurance"]'))).toEqual(["shield-check"]);
  });
});
