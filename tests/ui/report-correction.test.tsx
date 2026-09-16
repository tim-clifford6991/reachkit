// tests/ui/report-correction.test.tsx — #786.
//
// The report header's "Not your market?", mounted in jsdom inside the real
// verdict strip: it opens a field, posts the market to the correction
// route, and follows the rerun on the report — the stages stream by the id
// the route answered, and its ending re-resolves the address. The route
// and the pass behind it are driven for real in
// `tests/scan/run/correction-route.test.ts`; here `fetch` stands in for
// the network and answers in the route's own response shape.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { VerdictStrip } from "@/app/(public)/scan/[domain]/_address/verdict";
import { FIXTURE_REPORT } from "@/app/(public)/scan/[domain]/_fixture/states";
import { copy } from "@/lib/presentation/copy";
import type { CorrectionOffer } from "@/lib/market/coherence/offer";
import type { CorrectReportResponse } from "@/app/api/report/[domain]/correct/route";

class FakeEventSource {
  static opened: FakeEventSource[] = [];
  onmessage: ((message: MessageEvent<string>) => void) | null = null;
  closed = false;
  constructor(readonly url: string) {
    FakeEventSource.opened.push(this);
  }
  close(): void {
    this.closed = true;
  }
  emit(data: unknown): void {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent<string>);
  }
}

const mounted: { root: Root; host: HTMLElement }[] = [];
const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>();

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  FakeEventSource.opened = [];
  refresh.mockClear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("EventSource", FakeEventSource);
});

afterEach(() => {
  for (const { root, host } of mounted.splice(0)) {
    act(() => root.unmount());
    host.remove();
  }
  vi.unstubAllGlobals();
});

async function mount(offer: CorrectionOffer): Promise<HTMLElement> {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  mounted.push({ root, host });
  await act(async () =>
    root.render(
      <VerdictStrip verdict={FIXTURE_REPORT.verdict} category="user onboarding software" measuredOn="Sep 15, 2026" correction={offer} />
    )
  );
  return host;
}

function button(host: HTMLElement, label: string): HTMLButtonElement {
  const found = [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === label);
  if (!found) throw new Error(`no button labelled ${label}`);
  return found;
}

function answer(body: CorrectReportResponse, status = 200): Promise<Response> {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

async function openAndSubmit(host: HTMLElement, market: string): Promise<void> {
  await act(async () => button(host, copy("verdict.not-your-market")).click());
  const input = host.querySelector<HTMLInputElement>('input[name="category"]');
  if (!input) throw new Error("the control opened no field");
  await act(async () => {
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setValue?.call(input, market);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    input.form?.requestSubmit();
  });
}

describe("'Not your market?' opens the category correction (#786)", () => {
  it("posts the market to the correction route, then follows the rerun's stages and re-resolves on its ending", async () => {
    fetchMock.mockImplementation(() => answer({ ok: true, scanId: "rerun-1" }));
    const host = await mount({ offered: true, as: "first" });

    await openAndSubmit(host, "  employee scheduling software ");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`/api/report/${FIXTURE_REPORT.verdict.domain}/correct`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ category: "employee scheduling software" });

    // The rerun's progress, on the report.
    expect(host.querySelector('[data-testid="correction-running"]')?.textContent).toContain(copy("correction.running"));
    expect(FakeEventSource.opened.map((s) => s.url)).toEqual(["/api/scan/rerun-1/progress"]);
    const source = FakeEventSource.opened[0]!;
    await act(async () => source.emit({ stage: "reading_your_market", done: false }));
    expect(host.querySelector('[data-state="active"]')?.textContent).toContain(copy("stage.reading_your_market"));

    await act(async () => source.emit({ ending: { kind: "report", complete: true, stoppedReason: "complete" } }));
    expect(source.closed).toBe(true);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("a refusal is one written line, and the field stays for another try", async () => {
    fetchMock.mockImplementation(() => answer({ ok: false, refused: "scanning_unavailable" }, 503));
    const host = await mount({ offered: true, as: "first" });

    await openAndSubmit(host, "employee scheduling software");

    expect(host.querySelector('[role="alert"]')?.textContent).toBe(copy("correction.refused.unavailable"));
    expect(host.querySelector('input[name="category"]')).not.toBeNull();
    expect(FakeEventSource.opened).toHaveLength(0);
  });

  it("the one correction already used draws no control; one under way says so", async () => {
    const used = await mount({ offered: false, because: "used" });
    expect(used.textContent).not.toContain(copy("verdict.not-your-market"));
    expect(used.querySelector('[data-testid^="correction-"]')).toBeNull();

    const running = await mount({ offered: false, because: "in_progress" });
    expect(running.querySelector('[data-testid="correction-in-progress"]')?.textContent).toBe(copy("correction.running"));
  });

  it("Cancel closes the field without posting", async () => {
    const host = await mount({ offered: true, as: "first" });
    await act(async () => button(host, copy("verdict.not-your-market")).click());
    await act(async () => button(host, copy("correction.cancel")).click());
    expect(host.querySelector('input[name="category"]')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
