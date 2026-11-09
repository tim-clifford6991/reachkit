// tests/app/scan-address/progress-route.test.ts
//
// WO-281 `## Test plan` (criteria quoted verbatim from `requirements/
// REQ-003.md`, carried from WO-063) — the transport, heartbeat,
// termination and unknown-id suites for `GET
// /api/scan/{scanId}/progress`.
//
// `src/app/api/scan/[scanId]/progress/route.ts` is a thin adapter
// (`structure.md` rule 1) over `@/lib/scan/stages`'s `progress`, mocked
// here wholesale — exactly as `tests/app/scan-address/api-scan.test.ts`
// mocks `@/lib/scan/admission` one layer down. No `@/lib/db` mock and no
// env fixture is needed here for the same reason: mocking
// `@/lib/scan/stages` replaces the module wholesale, so its own
// `dbAdmin`/`env` imports never load.
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/scan/stages", () => ({ progress: vi.fn() }));

import { progress } from "@/lib/scan/stages";
import type { StageEvent } from "@/lib/scan/stages";
import type { Ending } from "@/lib/scan/ceilings";
import { TIMING } from "@/lib/config/constants";
import * as route from "@/app/api/scan/[scanId]/progress/route";
import { GET } from "@/app/api/scan/[scanId]/progress/route";

const ROUTE_PATH = path.resolve(
  import.meta.dirname,
  "../../../src/app/api/scan/[scanId]/progress/route.ts"
);
const ROUTE_SOURCE = readFileSync(ROUTE_PATH, "utf8");

/** A cancellable async iterable a test can drive event-by-event and spy
 *  on `.return()` for — the shape `progress()` itself returns. */
function fakeIterable(events: StageEvent[]): {
  iterable: AsyncIterable<StageEvent>;
  returnSpy: ReturnType<typeof vi.fn>;
} {
  const returnSpy = vi.fn(async () => ({ done: true as const, value: undefined }));
  let index = 0;
  const iterable: AsyncIterable<StageEvent> = {
    [Symbol.asyncIterator]() {
      return {
        async next() {
          if (index >= events.length) return { done: true, value: undefined };
          const value = events[index]!;
          index += 1;
          return { done: false, value };
        },
        return: returnSpy,
      };
    },
  };
  return { iterable, returnSpy };
}

function requestFor(scanId: string): { request: Request; params: Promise<{ scanId: string }> } {
  return {
    request: new Request(`http://localhost/api/scan/${scanId}/progress`),
    params: Promise.resolve({ scanId }),
  };
}

async function readSseFrames(response: Response): Promise<StageEvent[]> {
  const body = response.body;
  if (!body) return [];
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  return text
    .split("\n\n")
    .filter((frame) => frame.startsWith("data: "))
    .map((frame) => JSON.parse(frame.slice("data: ".length)) as StageEvent);
}

beforeEach(() => {
  vi.mocked(progress).mockReset();
});

afterEach(() => {
  vi.mocked(progress).mockReset();
});

// ── REQ-003 c1 — every stage event reaches the client, in order ────────

describe(
  'REQ-003 c1 — "Given a scan is running … when the visitor watches the page, then it shows named stages that advance as work completes, never an unlabelled spinner or an indeterminate bar alone."',
  () => {
    it("progress-route/stream · every stage event reaches the client, in order, with none added or dropped", async () => {
      const ending: Ending = { kind: "report", complete: true, stoppedReason: "complete" };
      const events: StageEvent[] = [
        { stage: "reading_your_site", done: false },
        { stage: "reading_your_site", done: true },
        { stage: "reading_access_rules", done: false },
        { stage: "reading_access_rules", done: true },
        { stage: "reading_your_market", done: false },
        { stage: "reading_your_market", done: true },
        { stage: "checking_your_presence", done: false },
        { stage: "checking_your_presence", done: true },
        { stage: "asking_the_twelve", done: false },
        { stage: "asking_the_twelve", done: true },
        { stage: "scoring", done: false },
        { stage: "scoring", done: true },
        { ending },
      ];
      const { iterable } = fakeIterable(events);
      vi.mocked(progress).mockReturnValue(iterable);

      const { request, params } = requestFor("scan-1");
      const res = await GET(request, { params });
      expect(res.status).toBe(200);
      const frames = await readSseFrames(res);
      expect(frames).toEqual(events);
    });
  }
);

describe('REQ-003 c1, "never an unlabelled spinner"', () => {
  it("progress-route/stream · heartbeats pass through unaltered, carrying no stage field, connection stays open across them", async () => {
    const ending: Ending = { kind: "report", complete: true, stoppedReason: "complete" };
    const events: StageEvent[] = [
      { stage: "reading_your_site", done: false },
      { heartbeat: true },
      { heartbeat: true },
      { heartbeat: true },
      { stage: "reading_your_site", done: true },
      { ending },
    ];
    const { iterable } = fakeIterable(events);
    vi.mocked(progress).mockReturnValue(iterable);

    const { request, params } = requestFor("scan-2");
    const res = await GET(request, { params });
    const frames = await readSseFrames(res);
    const heartbeats = frames.filter((f): f is { heartbeat: true } => "heartbeat" in f);
    expect(heartbeats).toHaveLength(3);
    for (const hb of heartbeats) {
      expect(hb).not.toHaveProperty("stage");
    }
    expect(frames).toEqual(events);
  });
});

// ── REQ-003 c4 — the ending is the last event, the stream closes ───────

describe(
  'REQ-003 c4 — "Given a scan that cannot complete at all, when it ends, then the visitor is told in one written line that the measurement failed and is offered a manual retry (the retry window is REQ-001\'s)."',
  () => {
    it.each<Ending>([
      { kind: "report", complete: true, stoppedReason: "complete" },
      { kind: "report", complete: false, stoppedReason: "time_ceiling" },
      { kind: "report", complete: false, stoppedReason: "spend_ceiling" },
      { kind: "no_report", stoppedReason: "failed" },
    ])("progress-route/stream · the ending is serialised once, is last, and the stream ends — %j", async (ending) => {
      const events: StageEvent[] = [{ stage: "scoring", done: false }, { ending }];
      const { iterable } = fakeIterable(events);
      vi.mocked(progress).mockReturnValue(iterable);

      const { request, params } = requestFor("scan-3");
      const res = await GET(request, { params });
      const frames = await readSseFrames(res);
      expect(frames.at(-1)).toEqual({ ending });
      expect(frames.filter((f) => "ending" in f)).toHaveLength(1);
      // `readSseFrames` above reads to completion — end-of-stream, not a
      // hang — which it can only do because the response body closed.
    });
  }
);

// ── REQ-003 c5 — the response ends inside the ceiling ───────────────────

describe('REQ-003 c5 — "… No visitor waits on a running scan beyond 90 seconds."', () => {
  it("progress-route/stream · the response ends as soon as the underlying iterable's ending is reached", async () => {
    vi.useFakeTimers();
    const ending: Ending = { kind: "report", complete: false, stoppedReason: "time_ceiling" };

    const returnSpy = vi.fn(async () => ({ done: true as const, value: undefined }));
    const iterable: AsyncIterable<StageEvent> = {
      [Symbol.asyncIterator]() {
        let stage = true;
        return {
          async next() {
            if (stage) {
              stage = false;
              return { done: false, value: { stage: "asking_the_twelve", done: false } as StageEvent };
            }
            await new Promise((resolve) => setTimeout(resolve, 90_000));
            return { done: false, value: { ending } as StageEvent };
          },
          return: returnSpy,
        };
      },
    };
    vi.mocked(progress).mockReturnValue(iterable);

    const { request, params } = requestFor("scan-4");
    const resPromise = GET(request, { params });
    await vi.advanceTimersByTimeAsync(90_000);
    const res = await resPromise;
    const frames = await readSseFrames(res);
    expect(frames.at(-1)).toEqual({ ending });
    vi.useRealTimers();
  });
});

// ── REQ-003's non-goal — a disconnect cancels the iterator ─────────────

describe('REQ-003\'s non-goal — "No background continuation for a visitor who closes the page mid-scan."', () => {
  it("progress-route/stream · a disconnect cancels the iterator, without leaking it running forever", async () => {
    let released: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      released = resolve;
    });
    const returnSpy = vi.fn(async () => {
      released();
      return { done: true as const, value: undefined };
    });
    const iterable: AsyncIterable<StageEvent> = {
      [Symbol.asyncIterator]() {
        let first = true;
        return {
          async next() {
            if (first) {
              first = false;
              return { done: false, value: { stage: "reading_your_site", done: false } as StageEvent };
            }
            return new Promise(() => {}); // hangs — a still-running scan
          },
          return: returnSpy,
        };
      },
    };
    vi.mocked(progress).mockReturnValue(iterable);

    const { request, params } = requestFor("scan-5");
    const res = await GET(request, { params });
    const reader = res.body!.getReader();
    await reader.read(); // consume the one stage event

    await reader.cancel(); // the disconnect
    await held;
    expect(returnSpy).toHaveBeenCalled();
  });
});

// ── REQ-003's non-goal — nothing added on the wire ──────────────────────

describe('REQ-003\'s non-goal — "No spend, cost or cap figure shown to a visitor."', () => {
  it("progress-route/stream · every serialised event equals the event the iterable produced, verbatim", async () => {
    const ending: Ending = { kind: "report", complete: true, stoppedReason: "complete" };
    const events: StageEvent[] = [{ stage: "scoring", done: false }, { stage: "scoring", done: true }, { ending }];
    const { iterable } = fakeIterable(events);
    vi.mocked(progress).mockReturnValue(iterable);

    const { request, params } = requestFor("scan-6");
    const res = await GET(request, { params });
    const frames = await readSseFrames(res);
    expect(frames).toEqual(events);

    for (const forbidden of ["percent", "eta", "cents", "cap"]) {
      expect(
        new RegExp(`\\b${forbidden}\\b`, "i").test(ROUTE_SOURCE),
        `route.ts must not name "${forbidden}"`
      ).toBe(false);
    }
  });
});

// ── Unknown scanId ────────────────────────────────────────────────────

describe("WO-281 `## Steps` step 19 — an unknown or malformed scanId responds 404 on this transport", () => {
  it("progress-route/unknown · an immediately exhausted iterable is 404", async () => {
    const { iterable } = fakeIterable([]);
    vi.mocked(progress).mockReturnValue(iterable);

    const { request, params } = requestFor("no-such-scan");
    const res = await GET(request, { params });
    expect(res.status).toBe(404);
  });
});

// ── Headers ──────────────────────────────────────────────────────────

describe("Transport headers", () => {
  it("progress-route/headers · Cache-Control: no-store and X-Robots-Tag: noindex on both the 200 and the 404", async () => {
    const ending: Ending = { kind: "report", complete: true, stoppedReason: "complete" };
    const { iterable } = fakeIterable([{ ending }]);
    vi.mocked(progress).mockReturnValue(iterable);
    const okRequest = requestFor("scan-7");
    const ok = await GET(okRequest.request, { params: okRequest.params });
    expect(ok.headers.get("Cache-Control")).toBe("no-store");
    expect(ok.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(ok.headers.get("Content-Type")).toMatch(/text\/event-stream/);

    const { iterable: empty } = fakeIterable([]);
    vi.mocked(progress).mockReturnValue(empty);
    const notFoundRequest = requestFor("scan-8");
    const notFound = await GET(notFoundRequest.request, { params: notFoundRequest.params });
    expect(notFound.headers.get("Cache-Control")).toBe("no-store");
    expect(notFound.headers.get("X-Robots-Tag")).toBe("noindex");
  });
});

// ── Issue #540 — what the stream needs from the platform, stated ────────

describe("issue #540 — the route's streaming and runtime requirements are explicit in the file", () => {
  it("progress-route/config · never cached: `dynamic = force-dynamic` and `revalidate = 0`", () => {
    expect(route.dynamic).toBe("force-dynamic");
    expect(route.revalidate).toBe(0);
  });

  it("progress-route/config · the invocation outlives the pass it watches: `maxDuration` is the platform ceiling, as a literal", () => {
    expect(route.maxDuration).toBe(TIMING.platformCeilingS);
    expect(route.maxDuration).toBeGreaterThan(TIMING.reportCeilingS);
    // Next reads route segment config out of the source at build time.
    expect(ROUTE_SOURCE).toMatch(/^export const maxDuration = \d+;$/m);
  });

  it("progress-route/config · no `runtime` export: the default is `nodejs` and `edge` is deprecated in this version", () => {
    expect("runtime" in route).toBe(false);
    expect(ROUTE_SOURCE).toMatch(/The Edge\s+\/\/\s+Runtime is deprecated|Edge Runtime is deprecated/);
  });

  it("progress-route/headers · `X-Accel-Buffering: no` on the stream, so no proxy holds the frames back", async () => {
    const ending: Ending = { kind: "report", complete: true, stoppedReason: "complete" };
    const { iterable } = fakeIterable([{ ending }]);
    vi.mocked(progress).mockReturnValue(iterable);
    const { request, params } = requestFor("scan-9");
    const res = await GET(request, { params });
    expect(res.headers.get("X-Accel-Buffering")).toBe("no");
    expect(res.headers.get("Content-Type")).toMatch(/text\/event-stream/);
  });

  it("progress-route/stream · the first chunk opens past every byte-counted buffer with an SSE comment, and carries the first event with it", async () => {
    const heartbeat: StageEvent = { heartbeat: true };
    const { iterable } = fakeIterable([heartbeat, { stage: "reading_your_site", done: false }]);
    vi.mocked(progress).mockReturnValue(iterable);
    const { request, params } = requestFor("scan-10");
    const res = await GET(request, { params });
    const reader = res.body!.getReader();
    const { value } = await reader.read();
    const firstChunk = new TextDecoder().decode(value);
    const [preamble, frame] = firstChunk.split("\n\n");
    // A comment line: every EventSource ignores it, so it is no event.
    expect(preamble?.startsWith(":")).toBe(true);
    expect(preamble).not.toMatch(/^data:/m);
    // WebKit holds a stream's first 1024 bytes back.
    expect(new TextEncoder().encode(preamble).length).toBeGreaterThanOrEqual(1024);
    expect(frame).toBe(`data: ${JSON.stringify(heartbeat)}`);
    await reader.cancel();
  });
});
