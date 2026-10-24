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

/** The element whose own words are `text`. */
function holding(root: HTMLElement, selector: string, text: string): Element | undefined {
  return [...root.querySelectorAll(selector)].find((el) => el.textContent?.trim() === text);
}

describe("Setup's steps carry their board icons", () => {
  it("step 1 draws clock, coffee, monitor-check and the map-pin band", async () => {
    const root = await mount("site");

    expect(icons(holding(root, ".badge", COPY["setup.step.time"]))).toEqual(["clock"]);

    const after = [...root.querySelectorAll('[data-testid="setup-next"] li')].at(-1)!;
    expect(after.textContent).toContain(COPY["setup.next.after"]);
    expect(icons(after)).toEqual(["coffee"]);
    expect(after.querySelector(".status")).toBeNull();

    const well = root.querySelector('[data-testid="setup-address-value"]')!.parentElement;
    expect(icons(well)).toEqual(["monitor-check"]);

    const preview = root.querySelector('[data-testid="setup-place-preview"]')!;
    const band = preview.querySelector('[aria-hidden="true"].bg-base-200');
    expect(icons(band)).toEqual(["map-pin"]);
    expect(band?.textContent).toBe("");
    expect(preview.textContent).toContain(COPY["setup.place.preview.line"]);
  });

  it("step 2's tiles and flows", async () => {
    const root = await mount("check");

    const tiles = [...root.querySelectorAll('[data-testid^="setup-check-"] > summary')].map((summary) => ({
      title: summary.querySelector("strong")?.textContent,
      icons: icons(summary.querySelector('[aria-hidden="true"]')),
    }));
    expect(tiles).toEqual([
      { title: COPY["setup.check.business"], icons: ["building-2"] },
      { title: COPY["setup.check.market"], icons: ["users"] },
      { title: COPY["setup.check.voice"], icons: ["message-circle"] },
      { title: COPY["setup.business.questions"], icons: ["circle-question-mark"] },
    ]);

    expect(icons(root.querySelector('[data-testid="setup-business-assurance"]'))).toEqual(["shield-check"]);

    const flow = root.querySelector('[data-testid="setup-check-read"] figcaption');
    expect(icons(flow).filter((name) => name !== "arrow-right")).toEqual(["monitor-check", "eye", "file-text"]);
  });
});
