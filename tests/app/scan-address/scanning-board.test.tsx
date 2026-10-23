/** @vitest-environment jsdom */
// The scan in progress against board PubScanning: the screen mounted as the
// browser draws it, fed the stage stream a part-way scan records, and read
// with the parity check's own reader.
import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { boardFile, compare, readAllow, segments } from "../../../scripts/design/parity.mjs";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { ScanningView } = await import("@/app/(public)/scan/[domain]/_address/scanning");
const { copy } = await import("@/lib/presentation/copy");
const { BATTERY } = await import("@/lib/config/constants");

class FakeEventSource {
  static opened: FakeEventSource[] = [];
  onmessage: ((message: MessageEvent<string>) => void) | null = null;
  constructor(readonly url: string) {
    FakeEventSource.opened.push(this);
  }
  close(): void {}
  emit(data: unknown): void {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent<string>);
  }
}

const START = new Date("2026-10-23T14:02:00");
const DOMAIN = "harborplumbing.example" as Parameters<typeof ScanningView>[0]["domain"];
const roots: Root[] = [];

beforeEach(() => {
  FakeEventSource.opened = [];
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(START);
  vi.stubGlobal("EventSource", FakeEventSource);
});

afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function mount(): Promise<HTMLElement> {
  const container = document.createElement("div");
  const root = createRoot(container);
  roots.push(root);
  await act(async () => root.render(<ScanningView domain={DOMAIN} scanId="scan-1" />));
  return container;
}

/** Moves the clock to `seconds` after the start, then records `event`. */
async function at(seconds: number, event: { stage: string; done: boolean }): Promise<void> {
  vi.setSystemTime(START.getTime() + seconds * 1000);
  await act(async () => FakeEventSource.opened[0]!.emit(event));
}

/** The board's moment: three stages done in 4, 2 and 6 seconds, the fourth started at 0:12. */
async function partWay(): Promise<HTMLElement> {
  const screen = await mount();
  await at(0, { stage: "reading_your_site", done: false });
  await at(4, { stage: "reading_your_site", done: true });
  await at(4, { stage: "reading_access_rules", done: false });
  await at(6, { stage: "reading_access_rules", done: true });
  await at(6, { stage: "reading_your_market", done: false });
  await at(12, { stage: "reading_your_market", done: true });
  await at(12, { stage: "checking_your_presence", done: false });
  return screen;
}

function boardMain(): string {
  const html = readFileSync(boardFile("PubScanning"), "utf8");
  return html.slice(html.indexOf("<main>"), html.indexOf("</main>") + "</main>".length);
}

/** Each string is on the screen, and in the order given. */
function inOrder(screen: HTMLElement, wanted: string[]): void {
  const text = segments(screen.innerHTML).join("\n");
  let from = 0;
  for (const want of wanted) {
    const found = text.indexOf(want, from);
    expect(found, `"${want}" is not on the screen after "${text.slice(Math.max(0, from - 60), from)}"`).toBeGreaterThanOrEqual(0);
    from = found + want.length;
  }
}

const rows = (screen: HTMLElement): HTMLElement[] => [...screen.querySelectorAll<HTMLElement>(".steps > li")];
const cards = (screen: HTMLElement): HTMLElement[] => [...screen.querySelectorAll<HTMLElement>('[data-testid="scan-section"]')];
const searches = { searches: String(BATTERY.QUESTIONS) };

describe("the scan in progress matches board PubScanning", () => {
  it("nothing the board draws is missing but its allowed sample data, rulings and the cards' pending content", async () => {
    // A line excused only because the registry read cannot compose it must still be on the rendered screen.
    const allow = readAllow("PubScanning").filter((line: { reason: string }) => !line.reason.includes("scanning-board.test.tsx"));
    const result = compare(boardMain(), segments((await partWay()).innerHTML), allow);
    expect(result.missing).toEqual([]);
  });

  it("the head: the eyebrow, Scanning {domain} and the waiting line", async () => {
    inOrder(await partWay(), [copy("scan.eyebrow"), copy("scan.head", { domain: DOMAIN }), copy("scan.waiting.line")]);
  });

  it("Progress: started at the visitor's clock, six stages in plain words with their sub-lines, then the caption", async () => {
    const screen = await partWay();
    const time = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(START);
    inOrder(screen, [
      copy("scan.progress.title"),
      copy("stage.started", { time }),
      `${copy("stage.reading_your_site")} ${copy("stage.reading_your_site.line")} ${copy("stage.status.done")} 4 s`,
      `${copy("stage.reading_access_rules")} ${copy("stage.reading_access_rules.line")} ${copy("stage.status.done")} 2 s`,
      `${copy("stage.reading_your_market")} ${copy("stage.reading_your_market.line")} ${copy("stage.status.done")} 6 s`,
      `${copy("stage.checking_your_presence", searches)} ${copy("stage.checking_your_presence.line")} ${copy("stage.status.working")} started 0:12`,
      `${copy("stage.asking_the_twelve")} ${copy("stage.asking_the_twelve.line")} ${copy("stage.status.next")}`,
      `${copy("stage.scoring")} ${copy("stage.scoring.line")} ${copy("stage.status.next")}`,
      copy("scan.progress.caption"),
    ]);
  });

  it("What you'll get: three steps, four items, and the line to How it works", async () => {
    const screen = await partWay();
    inOrder(screen, [
      copy("scan.get.title"),
      copy("scan.get.step.1"),
      copy("scan.get.step.2"),
      copy("scan.get.step.3"),
      `${copy("scan.get.score")} ${copy("scan.get.score.line")}`,
      `${copy("scan.get.rivals")} ${copy("scan.get.rivals.line")}`,
      `${copy("scan.get.held")} ${copy("scan.get.held.line")}`,
      `${copy("scan.get.first-page")} ${copy("scan.get.first-page.line")}`,
      copy("scan.get.after"),
      copy("chrome.nav.works"),
    ]);
    expect(screen.querySelector('a[href="/how-it-works"]')).not.toBeNull();
  });

  it("Your report, filling in: six cards in the board's order, each saying whether its stage has run", async () => {
    const screen = await partWay();
    inOrder(screen, [
      copy("scan.filling.title"),
      copy("scan.filling.grey"),
      `${copy("report.read.title")} ${copy("scan.filling.found")}`,
      `${copy("scan.filling.readers")} ${copy("scan.filling.found")}`,
      `${copy("scan.filling.competitors")} ${copy("stage.status.next")}`,
      `${copy("scan.get.score")} ${copy("stage.status.next")}`,
      `${copy("scan.filling.searches", searches)} ${copy("stage.status.next")}`,
      `${copy("scan.filling.ai")} ${copy("stage.status.next")}`,
    ]);
  });
});

describe("a stage that is not done shows not done, never 0", () => {
  it("half-finished: the stages ahead say Next with no time, and their cards say Next over a skeleton", async () => {
    const screen = await partWay();
    expect(rows(screen).map((row) => row.dataset.state)).toEqual(["done", "done", "done", "active", "pending", "pending"]);
    for (const row of rows(screen).slice(4)) {
      expect(row.textContent).toContain(copy("stage.status.next"));
      expect(row.textContent).not.toMatch(/\d+ s\b|started/);
    }
    for (const card of cards(screen).filter((c) => c.dataset.state === "pending")) {
      expect(card.textContent).toContain(copy("stage.status.next"));
      expect(card.querySelector(".skeleton")).not.toBeNull();
    }
    expect(screen.textContent).not.toMatch(/\b0 s\b/);
  });

  it("a log replayed at once, as to a visitor who joins late, shows every stage done with no 0-second time", async () => {
    const screen = await mount();
    for (const stage of ["reading_your_site", "reading_access_rules", "reading_your_market"]) {
      await at(0, { stage, done: false });
      await at(0, { stage, done: true });
    }
    expect(rows(screen).slice(0, 3).map((row) => row.dataset.state)).toEqual(["done", "done", "done"]);
    expect(screen.textContent).not.toMatch(/\b0 s\b/);
  });

  it("before the stream has said anything, every stage and card is not reached, and no time is drawn on the server", () => {
    const html = renderToStaticMarkup(<ScanningView domain={DOMAIN} scanId="scan-1" />);
    expect(html.split('data-state="pending"').length - 1).toBe(6 + 6);
    expect(html).not.toContain('data-state="done"');
    expect(html).not.toContain("started");
  });
});
