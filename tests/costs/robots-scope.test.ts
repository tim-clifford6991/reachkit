// tests/costs/robots-scope.test.ts — BUILD §6.4, issue #73
//
// The wiring: a cost context is what opens the robots memo, so "once per
// scan" is true of the thing that *is* a scan rather than of a scope
// somebody remembered to open.
//
// `rollUp: "none"` throughout — that arm writes nothing at all, so this
// suite needs no database beyond the module-load double below, and what it
// asserts is the scope and not the roll-up (`tests/costs/context.test.ts`
// owns that, against a live schema).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import http from "node:http";
import https from "node:https";
import dns from "node:dns";

vi.mock("@/lib/db", () => ({
  dbAdmin: () => {
    throw new Error("the roll-up must not be reached on the `none` arm");
  },
}));

const { withCostContext } = await import("@/lib/costs");
const { readRobots } = await import("@/lib/egress/robots");
const { robotsMemoSize } = await import("@/lib/egress/robots-memo");

const PUBLIC_IP = "93.184.216.34";
const ORIGIN = "https://example.com";

function installTransport() {
  const paths: string[] = [];
  const impl = (options: http.RequestOptions, cb: (res: http.IncomingMessage) => void) => {
    paths.push(String(options.path ?? ""));
    const req = new EventEmitter() as unknown as http.ClientRequest;
    Object.assign(req, { end: () => undefined, destroy: vi.fn() });
    queueMicrotask(() => {
      const res = new EventEmitter() as unknown as http.IncomingMessage;
      Object.assign(res, { statusCode: 200, headers: {}, destroy: vi.fn() });
      cb(res);
      queueMicrotask(() => {
        res.emit("data", Buffer.from("User-agent: *\nDisallow: /admin\n"));
        res.emit("end");
      });
    });
    return req;
  };
  vi.spyOn(http, "request").mockImplementation(impl as typeof http.request);
  vi.spyOn(https, "request").mockImplementation(impl as typeof https.request);
  return { robotsReads: () => paths.filter((p) => p.endsWith("/robots.txt")).length };
}

/** A context on the arm that writes nothing. */
function pass<T>(body: () => Promise<T>): Promise<T> {
  return withCostContext(
    { scanId: "scan-1", cap: "FREE", policyVersion: 1, rollUp: "none" },
    async () => body()
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(dns.promises, "lookup").mockResolvedValue({ address: PUBLIC_IP, family: 4 });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("a cost context is what scopes the robots memo", () => {
  it("inside one, an origin is read once however many times it is asked for", async () => {
    const transport = installTransport();
    await pass(async () => {
      await readRobots(ORIGIN);
      await readRobots(ORIGIN);
    });
    expect(transport.robotsReads()).toBe(1);
  });

  it("the memo is open for the whole body, and closed after it", async () => {
    installTransport();
    let sizeInside: number | null = null;
    await pass(async () => {
      await readRobots(ORIGIN);
      sizeInside = robotsMemoSize();
    });
    expect(sizeInside).toBe(1);
    expect(robotsMemoSize()).toBeNull();
  });

  it("two passes do not share one — the second scan reads for itself", async () => {
    const transport = installTransport();
    await pass(() => readRobots(ORIGIN));
    await pass(() => readRobots(ORIGIN));
    expect(transport.robotsReads()).toBe(2);
  });

  it("a pass that threw takes its memo with it, and the exception is untouched", async () => {
    const transport = installTransport();
    await expect(
      pass(async () => {
        await readRobots(ORIGIN);
        throw new Error("the pass failed");
      })
    ).rejects.toThrow("the pass failed");

    expect(robotsMemoSize()).toBeNull();
    await pass(() => readRobots(ORIGIN));
    expect(transport.robotsReads()).toBe(2);
  });

  it("outside any context nothing is memoised — the seam adds no cache of its own", async () => {
    const transport = installTransport();
    await readRobots(ORIGIN);
    await readRobots(ORIGIN);
    expect(transport.robotsReads()).toBe(2);
  });
});
