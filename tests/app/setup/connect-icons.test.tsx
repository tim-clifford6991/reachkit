/** @vitest-environment jsdom */
// Setup's Connect step, `/setup/connect` and the time-zone screen draw the icons boards Setup and SetupZone draw, each beside the words it marks.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), redirect: vi.fn() }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { SetupForm } = await import("@/app/(account)/setup/SetupForm");
const { ConnectScreen } = await import("@/app/(account)/setup/connect/ConnectScreen");
const { ZoneScreen } = await import("@/app/(account)/setup/zone/ZoneScreen");
const { ZONE_SLOW_MS } = await import("@/app/(account)/setup/zone/ZoneSlow");
const { assembleSetup } = await import("@/app/(account)/setup/_setup/facts");
const { FIXTURE_SETUP_FACTS } = await import("@/app/(account)/setup/_setup/fixture");
const { COPY } = await import("@/lib/presentation/copy");

const RECORD = { type: "CNAME", name: "content.example.com", value: "edge.example.net" } as const;

const roots: Root[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount());
  vi.useRealTimers();
});

async function mount(node: React.ReactNode): Promise<HTMLElement> {
  const container = document.createElement("div");
  const root = createRoot(container);
  roots.push(root);
  await act(async () => root.render(node));
  return container;
}

const publishingStep = (): Promise<HTMLElement> =>
  mount(
    <NuqsTestingAdapter searchParams={{ step: "publishing" }}>
      <SetupForm model={assembleSetup(FIXTURE_SETUP_FACTS)} />
    </NuqsTestingAdapter>,
  );

const connectScreen = (): Promise<HTMLElement> => mount(<ConnectScreen hostname={RECORD.name} record={RECORD} />);

/** The lucide icons inside `el`, by name, in document order. */
const icons = (el: Element | null | undefined): string[] =>
  [...(el?.querySelectorAll("svg.lucide") ?? [])].map((svg) => [...svg.classList].filter((c) => c.startsWith("lucide-")).at(-1)!.slice("lucide-".length));

/** Every icon inside `el` is hidden from assistive tech, itself or by its tile. */
const allHidden = (el: Element): boolean => [...el.querySelectorAll("svg.lucide")].every((svg) => svg.closest('[aria-hidden="true"]') !== null);

describe("Setup's Connect step carries board Setup's icons", () => {
  it("How it connects: monitor, a primary milestone, file-text", async () => {
    const how = (await publishingStep()).querySelector('[data-testid="setup-how"]')!;
    expect(icons(how)).toEqual(["monitor", "milestone", "file-text"]);
    const milestone = how.querySelector("svg.lucide-milestone")!;
    expect(milestone.closest(".text-primary")).not.toBeNull();
    expect(milestone.closest("li")!.textContent).toContain(COPY["setup.connect.how.yours"]);
    expect(allHidden(how)).toBe(true);
  });

  it("the destination options: globe for our address, layers for WordPress", async () => {
    const root = await publishingStep();
    const mark = (kind: string) =>
      icons(root.querySelector(`[data-testid="setup-destination-${kind}"]`)).filter((name) => !name.startsWith("circle"));
    expect(mark("hosted")).toEqual(["globe"]);
    expect(mark("wordpress")).toEqual(["layers"]);
    expect(allHidden(root.querySelector('[data-testid="setup-destination"]')!)).toBe(true);
  });

  it("Where should pages live? carries no icon: a hosting choice is not AI", async () => {
    const heading = [...(await publishingStep()).querySelectorAll("h2")].find((h) => h.textContent === COPY["setup.destination.where"]);
    expect(heading).toBeDefined();
    expect(heading!.querySelector("svg")).toBeNull();
  });

  it("After you add it: check, search, file-text, and no status dot", async () => {
    const what = (await connectScreen()).querySelector('[data-testid="setup-connect-what"]')!;
    const stages = [...what.querySelectorAll('[data-testid="setup-connect-stage"]')];
    expect(stages.map((stage) => icons(stage))).toEqual([["check"], ["search"], ["file-text"]]);
    expect(stages.map((stage) => stage.getAttribute("data-state"))).toEqual(["done", "current", "pending"]);
    expect(what.querySelector(".status")).toBeNull();
  });

  it("After this: a coffee tile, and one file-text on each page day", async () => {
    const week = (await connectScreen()).querySelector('[data-testid="setup-connect-week"]')!;
    const heading = [...week.querySelectorAll("h2")].find((h) => h.textContent === COPY["setup.next.after"])!;
    expect(icons(heading.parentElement)).toEqual(["coffee"]);
    const days = [...week.querySelectorAll("ol > li")];
    expect(days).toHaveLength(7);
    expect(days.map((day) => icons(day))).toEqual(days.map(() => ["file-text"]));
    expect(allHidden(week)).toBe(true);
  });

  it("I've added it, check now: refresh-ccw, and the spinner in its place while it checks", async () => {
    const button = (await connectScreen()).querySelector<HTMLButtonElement>('[data-testid="check-connection-press"]')!;
    expect(button.textContent).toBe(COPY["setup.connect.check"]);
    expect(icons(button)).toEqual(["refresh-ccw"]);

    act(() => button.click());
    expect(button.disabled).toBe(true);
    expect(icons(button)).toEqual([]);
    expect(button.querySelector(".loading-spinner")).not.toBeNull();

    // No session in this suite: the press answers that nothing could be asked, and the icon returns.
    await vi.waitFor(() => expect(icons(button)).toEqual(["refresh-ccw"]));
  });
});

describe("the time-zone screen", () => {
  it("zone draws clock beside the time it explains", async () => {
    const why = (await mount(<ZoneScreen />)).querySelector('[data-testid="setup-zone-why"]')!;
    const clock = why.querySelector("svg.lucide-clock");
    expect(clock).not.toBeNull();
    expect(clock!.getAttribute("aria-hidden")).toBe("true");
    expect(clock!.parentElement!.textContent).toContain(COPY["setup.zone.example"]);
  });

  it("the slow line opens with clock, before its sentence", async () => {
    vi.useFakeTimers();
    const root = await mount(<ZoneScreen />);
    await act(async () => vi.advanceTimersByTime(ZONE_SLOW_MS));
    const slow = root.querySelector('[data-testid="setup-zone-slow"]')!;
    expect(icons(slow)).toEqual(["clock"]);
    const clock = slow.querySelector("svg.lucide-clock")!;
    expect(clock.getAttribute("aria-hidden")).toBe("true");
    expect(clock.compareDocumentPosition(slow.querySelector("p")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(slow.querySelector("p")!.textContent).toContain(COPY["setup.zone.slow"]);
  });
});
