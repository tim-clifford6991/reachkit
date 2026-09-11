// tests/egress/safe-fetch.test.ts
//
// WO-018 test plan rows for `safeFetch()` itself: DNS pinning (the module's
// whole reason to exist), "never throws", the size cap, the timeout bound
// and clamp, and the observability log record's exact field set. Policy
// refusal and the lint rule live in `tests/egress/policy.test.ts` per the
// WO's own row assignment.
//
// No test here makes a real network call — `tests/setup.ts` already fails
// any test that does. `node:dns` and `node:http`/`node:https` are mocked
// directly (the same technique `tests/scan/free/domain.test.ts` uses for
// `dns.lookup`), so every case below is deterministic and fast.
import { EventEmitter } from "node:events";
import http from "node:http";
import https from "node:https";
import dns from "node:dns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Scenario =
  | { type: "response"; statusCode: number; headers?: Record<string, string>; bodyChunks?: Buffer[] }
  | { type: "error"; error: NodeJS.ErrnoException }
  | { type: "hang" };

/** A fake `http.request`/`https.request` implementation. Each call to
 *  `transport.request(...)` consumes the next queued scenario (FIFO), so a
 *  multi-hop redirect can be scripted one entry per hop. Every call's
 *  `options` is recorded so tests can assert exactly what address, host
 *  header and SNI servername the module tried to connect to. */
function installTransport(scenarios: Scenario[]) {
  const calls: Array<http.RequestOptions & { servername?: string }> = [];
  const requests: http.ClientRequest[] = [];
  let i = 0;

  const impl = (options: http.RequestOptions, cb: (res: http.IncomingMessage) => void) => {
    calls.push(options);
    const scenario = scenarios[i++];
    const req = new EventEmitter() as unknown as http.ClientRequest;
    (req as unknown as { write: (chunk: string) => void; written: string[] }).written = [];
    (req as unknown as { write: (chunk: string) => void; written: string[] }).write = function (chunk) {
      (this as unknown as { written: string[] }).written.push(chunk);
    };
    (req as unknown as { end: () => void }).end = () => {};
    (req as unknown as { destroy: (err?: Error) => void }).destroy = vi.fn();

    requests.push(req);
    if (!scenario) return req;

    if (scenario.type === "error") {
      queueMicrotask(() => req.emit("error", scenario.error));
    } else if (scenario.type === "response") {
      queueMicrotask(() => {
        const res = new EventEmitter() as unknown as http.IncomingMessage;
        (res as unknown as { statusCode: number }).statusCode = scenario.statusCode;
        (res as unknown as { headers: Record<string, string> }).headers = scenario.headers ?? {};
        (res as unknown as { destroy: () => void }).destroy = vi.fn();
        cb(res);
        queueMicrotask(() => {
          for (const chunk of scenario.bodyChunks ?? []) res.emit("data", chunk);
          res.emit("end");
        });
      });
    }
    // "hang": never calls back and never errors — the module's own deadline
    // timer must be what settles the promise.
    return req;
  };

  const httpSpy = vi.spyOn(http, "request").mockImplementation(impl as typeof http.request);
  const httpsSpy = vi.spyOn(https, "request").mockImplementation(impl as typeof https.request);
  return { calls, requests, httpSpy, httpsSpy };
}

function okResponse(body = "hi"): Scenario {
  return { type: "response", statusCode: 200, bodyChunks: [Buffer.from(body)] };
}

beforeEach(async () => {
  vi.restoreAllMocks();
  // This file tests the fetcher, not the robots reader (`robots.test.ts`).
  // The wired reader would itself fetch `/robots.txt` through the mocked
  // transport and consume the scenario scripted for the page, so every case
  // here starts from "could not determine" unless it wires a port itself.
  const { __setRobotsPortForTesting } = await import("../../src/lib/egress/safe-fetch");
  __setRobotsPortForTesting(async () => ({ ok: false, reason: "robots reader stubbed out in safe-fetch.test.ts" }));
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("safeFetch · DNS pinning (BP-006: resolve, check, connect to that resolved address)", () => {
  it("connects to the first-resolved address even when a second lookup would return a private one — a rebind after the check does not reach the connection", async () => {
    const { safeFetch } = await import("../../src/lib/egress/safe-fetch");
    const PUBLIC_IP = "93.184.216.34";
    const PRIVATE_IP = "10.1.2.3";

    const lookupSpy = vi
      .spyOn(dns.promises, "lookup")
      .mockResolvedValueOnce({ address: PUBLIC_IP, family: 4 })
      .mockResolvedValueOnce({ address: PRIVATE_IP, family: 4 })
      .mockImplementation(async () => {
        throw new Error("unexpected extra DNS lookup — the pin should resolve exactly once");
      });

    const { calls } = installTransport([okResponse()]);

    const outcome = await safeFetch("https://example.com/page");

    expect(outcome.ok).toBe(true);
    // The discriminator: exactly one resolution happened, and the address
    // actually connected to is the first one — not a value re-resolved at
    // connect time. A pin-free implementation (fetching by hostname and
    // letting the transport re-resolve) would either call lookup a second
    // time or hand the transport the hostname instead of an address; both
    // are excluded by these two assertions together.
    expect(lookupSpy).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.host).toBe(PUBLIC_IP);
    // Host header and SNI still carry the original name, so vhosting/TLS
    // are unaffected by connecting to the raw address.
    expect((calls[0]?.headers as Record<string, string>)?.Host).toBe("example.com");
    expect((calls[0] as { servername?: string })?.servername).toBe("example.com");
  });

  it("refuses before connecting when the resolved address is private, and opens no socket", async () => {
    const { safeFetch } = await import("../../src/lib/egress/safe-fetch");
    vi.spyOn(dns.promises, "lookup").mockResolvedValue({ address: "10.0.0.5", family: 4 });
    const { calls } = installTransport([]);

    const outcome = await safeFetch("https://internal.example.com/");

    expect(outcome).toMatchObject({ ok: false, reason: "blocked_by_policy" });
    expect(calls).toHaveLength(0);
  });
});

describe("safeFetch · never throws", () => {
  const cases: Array<[string, () => void]> = [
    [
      "a DNS resolution failure",
      () => {
        vi.spyOn(dns.promises, "lookup").mockRejectedValue(Object.assign(new Error("nope"), { code: "ENOTFOUND" }));
      },
    ],
    [
      "a connection refusal",
      () => {
        vi.spyOn(dns.promises, "lookup").mockResolvedValue({ address: "93.184.216.34", family: 4 });
        installTransport([{ type: "error", error: Object.assign(new Error("refused"), { code: "ECONNREFUSED" }) }]);
      },
    ],
    [
      "a policy refusal",
      () => {
        vi.spyOn(dns.promises, "lookup").mockResolvedValue({ address: "127.0.0.1", family: 4 });
      },
    ],
  ];

  it.each(cases)("resolves rather than rejecting for: %s", async (_label, arrange) => {
    const { safeFetch } = await import("../../src/lib/egress/safe-fetch");
    arrange();
    await expect(safeFetch("https://example.com/")).resolves.toMatchObject({ ok: false });
  });

  it("resolves rather than rejecting for a malformed URL", async () => {
    const { safeFetch } = await import("../../src/lib/egress/safe-fetch");
    await expect(safeFetch("not a url at all")).resolves.toMatchObject({ ok: false });
  });
});

describe("safeFetch · size cap (BP-006 NFR: 2 MB, `too_large` not a truncated parse)", () => {
  it("returns too_large for a response over the cap and carries no html", async () => {
    const { safeFetch } = await import("../../src/lib/egress/safe-fetch");
    vi.spyOn(dns.promises, "lookup").mockResolvedValue({ address: "93.184.216.34", family: 4 });
    const oversized = Buffer.alloc(3_000_000, "a");
    // Split into chunks so streaming accumulation, not a single read, is
    // what the cap is enforced against.
    const chunks = [oversized.subarray(0, 1_000_000), oversized.subarray(1_000_000, 2_500_000), oversized.subarray(2_500_000)];
    installTransport([{ type: "response", statusCode: 200, bodyChunks: chunks }]);

    const outcome = await safeFetch("https://example.com/big");

    expect(outcome).toMatchObject({ ok: false, reason: "too_large" });
    expect(outcome).not.toHaveProperty("html");
  });

  it("respects a caller-supplied maxBytes below the default", async () => {
    const { safeFetch } = await import("../../src/lib/egress/safe-fetch");
    vi.spyOn(dns.promises, "lookup").mockResolvedValue({ address: "93.184.216.34", family: 4 });
    installTransport([{ type: "response", statusCode: 200, bodyChunks: [Buffer.alloc(100, "x")] }]);

    const outcome = await safeFetch("https://example.com/small", { maxBytes: 50 });

    expect(outcome).toMatchObject({ ok: false, reason: "too_large" });
  });
});

// Issue #479, master ruling 2026-09-10: the customer's own documents are
// read with their own cap (`OWN_DOCUMENT_MAX_BYTES`, passed by
// `own-fetch.ts`'s `OWN_FETCH_OPTS`); every other read keeps the default.
describe("safeFetch · the own-document cap (issue #479 — one pin, OWN_DOCUMENT_MAX_BYTES)", () => {
  function chunked(size: number): Buffer[] {
    const body = Buffer.alloc(size, "a");
    const chunks: Buffer[] = [];
    for (let at = 0; at < size; at += 1_000_000) chunks.push(body.subarray(at, Math.min(size, at + 1_000_000)));
    return chunks;
  }

  it("an own-document read accepts a 2.5 MB home page — over the fetcher's default, under the own cap", async () => {
    const { safeFetch } = await import("../../src/lib/egress/safe-fetch");
    const { OWN_FETCH_OPTS } = await import("../../src/lib/measure/own-fetch");
    vi.spyOn(dns.promises, "lookup").mockResolvedValue({ address: "93.184.216.34", family: 4 });
    installTransport([{ type: "response", statusCode: 200, bodyChunks: chunked(2_500_000) }]);

    const outcome = await safeFetch("https://example.com/", OWN_FETCH_OPTS);

    expect(outcome).toMatchObject({ ok: true, bytes: 2_500_000 });
  });

  it("an own-document read refuses a 6.5 MB home page as too_large — refused, never truncated", async () => {
    const { safeFetch } = await import("../../src/lib/egress/safe-fetch");
    const { OWN_FETCH_OPTS } = await import("../../src/lib/measure/own-fetch");
    vi.spyOn(dns.promises, "lookup").mockResolvedValue({ address: "93.184.216.34", family: 4 });
    installTransport([{ type: "response", statusCode: 200, bodyChunks: chunked(6_500_000) }]);

    const outcome = await safeFetch("https://example.com/", OWN_FETCH_OPTS);

    expect(outcome).toMatchObject({ ok: false, reason: "too_large" });
    expect(outcome).not.toHaveProperty("html");
  });

  it("the cap it passes is the pin, not a number of its own", async () => {
    const { OWN_FETCH_OPTS } = await import("../../src/lib/measure/own-fetch");
    const { OWN_DOCUMENT_MAX_BYTES } = await import("../../src/lib/config/constants");
    expect(OWN_FETCH_OPTS.maxBytes).toBe(OWN_DOCUMENT_MAX_BYTES);
  });

  it("every other read keeps the default: the same 2.5 MB without the own options is too_large", async () => {
    const { safeFetch } = await import("../../src/lib/egress/safe-fetch");
    vi.spyOn(dns.promises, "lookup").mockResolvedValue({ address: "93.184.216.34", family: 4 });
    installTransport([{ type: "response", statusCode: 200, bodyChunks: chunked(2_500_000) }]);

    const outcome = await safeFetch("https://example.com/");

    expect(outcome).toMatchObject({ ok: false, reason: "too_large" });
  });
});

describe("safeFetch · timeout (BP-006 NFR: default 8000 ms, hard max 15000 ms)", () => {
  it("yields timeout when the server hangs past the configured bound", async () => {
    const { safeFetch } = await import("../../src/lib/egress/safe-fetch");
    vi.spyOn(dns.promises, "lookup").mockResolvedValue({ address: "93.184.216.34", family: 4 });
    installTransport([{ type: "hang" }]);

    const outcome = await safeFetch("https://example.com/slow", { timeoutMs: 25 });

    expect(outcome).toMatchObject({ ok: false, reason: "timeout" });
  });

  // The two argument tests below freeze the clock. The module derives each
  // timer's delay as `deadline - Date.now()`, so with a live clock a
  // millisecond ticking between `start` and the `setTimeout` call reads as
  // 7999 / 14999 under load (#63). Fake timers pin `Date.now()`, so the
  // delay the fetcher applies is exactly the clamped value — no wall-clock
  // resolution in the assertion. `queueMicrotask` is not faked, so the
  // scripted transport still settles the request.
  it("uses the 8000 ms default when timeoutMs is omitted", async () => {
    const { safeFetch } = await import("../../src/lib/egress/safe-fetch");
    vi.spyOn(dns.promises, "lookup").mockResolvedValue({ address: "93.184.216.34", family: 4 });
    installTransport([okResponse()]);
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

    await safeFetch("https://example.com/");

    const usedMs = setTimeoutSpy.mock.calls.map((c) => c[1]).filter((ms) => typeof ms === "number");
    expect(usedMs).toContain(8000);
  });

  it("clamps a timeoutMs above 15000 to the hard max", async () => {
    const { safeFetch } = await import("../../src/lib/egress/safe-fetch");
    vi.spyOn(dns.promises, "lookup").mockResolvedValue({ address: "93.184.216.34", family: 4 });
    installTransport([okResponse()]);
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

    await safeFetch("https://example.com/", { timeoutMs: 999_999 });

    const usedMs = setTimeoutSpy.mock.calls.map((c) => c[1]).filter((ms): ms is number => typeof ms === "number");
    expect(usedMs).toContain(15000);
    // Every timer the fetch armed sits at or under the hard max — the
    // caller's 999_999 never reaches a timer.
    expect(usedMs.every((ms) => ms <= 15000)).toBe(true);
  });
});

describe("safeFetch · observability (BP-006 NFR: host, outcome reason, status, bytes, duration — never a body)", () => {
  it("logs exactly those five fields on a successful fetch", async () => {
    const { safeFetch } = await import("../../src/lib/egress/safe-fetch");
    vi.spyOn(dns.promises, "lookup").mockResolvedValue({ address: "93.184.216.34", family: 4 });
    installTransport([okResponse("hello")]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await safeFetch("https://example.com/");

    expect(logSpy).toHaveBeenCalledTimes(1);
    const record = JSON.parse(logSpy.mock.calls[0]?.[0] as string);
    expect(Object.keys(record).sort()).toEqual(["bytes", "duration", "host", "reason", "status"].sort());
    expect(record.host).toBe("example.com");
    expect(record.status).toBe(200);
    expect(record.bytes).toBe(5);
    expect(typeof record.duration).toBe("number");
    expect(JSON.stringify(record)).not.toContain("hello");
  });

  it("logs the same five fields, with a null status, on a policy refusal — never a body", async () => {
    const { safeFetch } = await import("../../src/lib/egress/safe-fetch");
    vi.spyOn(dns.promises, "lookup").mockResolvedValue({ address: "127.0.0.1", family: 4 });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await safeFetch("https://internal.example.com/");

    const record = JSON.parse(logSpy.mock.calls[0]?.[0] as string);
    expect(Object.keys(record).sort()).toEqual(["bytes", "duration", "host", "reason", "status"].sort());
    expect(record.reason).toBe("blocked_by_policy");
    expect(record.status).toBeNull();
  });
});

describe("safeFetch · robots port (BP-006: on by default, delegated to robots.ts through a narrow port)", () => {
  it("blocks with robots_disallowed when the wired port reports the origin disallows this agent", async () => {
    const { safeFetch, __setRobotsPortForTesting } = await import("../../src/lib/egress/safe-fetch");
    vi.spyOn(dns.promises, "lookup").mockResolvedValue({ address: "93.184.216.34", family: 4 });
    __setRobotsPortForTesting(async () => ({
      ok: true,
      origin: "https://example.com",
      readAt: new Date(),
      disallowsAll: false,
      disallowedAgents: { "reachkit-measure": true },
      sitemaps: [],
      absent: false,
    }));

    const outcome = await safeFetch("https://example.com/");

    expect(outcome).toMatchObject({ ok: false, reason: "robots_disallowed" });
    __setRobotsPortForTesting(null);
  });

  it("does not consult the port when respectRobots is false", async () => {
    const { safeFetch, __setRobotsPortForTesting } = await import("../../src/lib/egress/safe-fetch");
    vi.spyOn(dns.promises, "lookup").mockResolvedValue({ address: "93.184.216.34", family: 4 });
    installTransport([okResponse()]);
    const port = vi.fn(async () => ({
      ok: true as const,
      origin: "https://example.com",
      readAt: new Date(),
      disallowsAll: true,
      disallowedAgents: {},
      sitemaps: [],
      absent: false,
    }));
    __setRobotsPortForTesting(port);

    const outcome = await safeFetch("https://example.com/", { respectRobots: false });

    expect(outcome.ok).toBe(true);
    expect(port).not.toHaveBeenCalled();
    __setRobotsPortForTesting(null);
  });

  it("never blocks when the reader cannot determine — 'could not determine' is not a fabricated disallow", async () => {
    const { safeFetch } = await import("../../src/lib/egress/safe-fetch");
    vi.spyOn(dns.promises, "lookup").mockResolvedValue({ address: "93.184.216.34", family: 4 });
    installTransport([okResponse()]);

    const outcome = await safeFetch("https://example.com/");

    expect(outcome.ok).toBe(true);
  });
});

describe("safeFetch · redirects (BP-006: each hop re-checked)", () => {
  it("follows a redirect to a public host and returns the final response", async () => {
    const { safeFetch } = await import("../../src/lib/egress/safe-fetch");
    vi.spyOn(dns.promises, "lookup").mockImplementation(async (hostname) => {
      if (hostname === "a.example.com") return { address: "93.184.216.34", family: 4 } as never;
      if (hostname === "b.example.com") return { address: "93.184.216.35", family: 4 } as never;
      throw new Error(`unexpected hostname ${String(hostname)}`);
    });
    installTransport([
      { type: "response", statusCode: 301, headers: { location: "https://b.example.com/final" } },
      okResponse("final page"),
    ]);

    const outcome = await safeFetch("https://a.example.com/start");

    expect(outcome).toMatchObject({ ok: true, url: "https://b.example.com/final" });
  });
});

// ── Authenticated requests (issue #54) ─────────────────────────────────
//
// The WordPress destination publishes into a customer's own site over an
// application password, and §9 puts every byte toward a customer URL
// through this module. So the seam carries a verb, headers and a body —
// and the rows below are what keeps that from becoming a hole: the caller
// cannot displace the `Host` header the pin rests on, and a credential
// never travels to a host the caller did not name.
describe("safeFetch · authenticated requests (issue #54)", () => {
  it("defaults are unchanged: no method, no body, and the three headers this module has always sent", async () => {
    const { safeFetch } = await import("../../src/lib/egress/safe-fetch");
    vi.spyOn(dns.promises, "lookup").mockResolvedValue({ address: "93.184.216.34", family: 4 } as never);
    const { calls, requests } = installTransport([okResponse()]);

    await safeFetch("https://example.com/page");

    expect(calls[0]!.method).toBe("GET");
    expect(Object.keys(calls[0]!.headers ?? {}).sort()).toEqual([
      "Accept-Encoding",
      "Host",
      "User-Agent",
    ]);
    expect((requests[0] as unknown as { written: string[] }).written).toEqual([]);
  });

  it("carries the verb, the caller's headers and the body, with an explicit Content-Length", async () => {
    const { safeFetch } = await import("../../src/lib/egress/safe-fetch");
    vi.spyOn(dns.promises, "lookup").mockResolvedValue({ address: "93.184.216.34", family: 4 } as never);
    const { calls, requests } = installTransport([okResponse('{"id":1}')]);

    const body = JSON.stringify({ title: "a page" });
    const outcome = await safeFetch("https://example.com/wp-json/wp/v2/posts", {
      method: "POST",
      headers: { Authorization: "Basic c2VjcmV0", "Content-Type": "application/json" },
      body,
      respectRobots: false,
    });

    expect(outcome).toMatchObject({ ok: true, status: 200 });
    expect(calls[0]!.method).toBe("POST");
    expect(calls[0]!.headers).toMatchObject({
      Authorization: "Basic c2VjcmV0",
      "Content-Type": "application/json",
      "Content-Length": String(Buffer.byteLength(body, "utf8")),
    });
    expect((requests[0] as unknown as { written: string[] }).written).toEqual([body]);
  });

  it("**the caller cannot displace the Host header**: the pin is what names the site the socket was opened for", async () => {
    const { safeFetch } = await import("../../src/lib/egress/safe-fetch");
    vi.spyOn(dns.promises, "lookup").mockResolvedValue({ address: "93.184.216.34", family: 4 } as never);
    const { calls } = installTransport([okResponse()]);

    await safeFetch("https://example.com/page", {
      headers: { Host: "evil.example", "User-Agent": "not-ours" },
    });

    const sent = calls[0]!.headers as Record<string, string>;
    expect(sent.Host).toBe("example.com");
    expect(sent["User-Agent"]).not.toBe("not-ours");
  });

  it("**a credential never follows a redirect off the origin the caller named**", async () => {
    const { safeFetch } = await import("../../src/lib/egress/safe-fetch");
    vi.spyOn(dns.promises, "lookup").mockImplementation(async (hostname) => {
      if (hostname === "blog.example.com") return { address: "93.184.216.34", family: 4 } as never;
      return { address: "93.184.216.35", family: 4 } as never;
    });
    const { calls } = installTransport([
      { type: "response", statusCode: 301, headers: { location: "https://collector.example/posts" } },
      okResponse("somebody else's answer"),
    ]);

    const outcome = await safeFetch("https://blog.example.com/wp-json/wp/v2/posts", {
      method: "POST",
      headers: { Authorization: "Basic c2VjcmV0" },
      body: "{}",
      respectRobots: false,
    });

    expect(outcome).toMatchObject({ ok: false, reason: "blocked_by_policy" });
    // One hop, and the second host was never connected to at all.
    expect(calls).toHaveLength(1);
  });

  it("a same-origin redirect is followed, carrying the verb and the body", async () => {
    const { safeFetch } = await import("../../src/lib/egress/safe-fetch");
    vi.spyOn(dns.promises, "lookup").mockResolvedValue({ address: "93.184.216.34", family: 4 } as never);
    const { calls, requests } = installTransport([
      { type: "response", statusCode: 308, headers: { location: "https://blog.example.com/wp-json/wp/v2/posts/" } },
      okResponse('{"id":1}'),
    ]);

    const outcome = await safeFetch("https://blog.example.com/wp-json/wp/v2/posts", {
      method: "POST",
      headers: { Authorization: "Basic c2VjcmV0" },
      body: "{}",
      respectRobots: false,
    });

    expect(outcome).toMatchObject({ ok: true });
    expect(calls.map((c) => c.method)).toEqual(["POST", "POST"]);
    expect((requests[1] as unknown as { written: string[] }).written).toEqual(["{}"]);
  });

  it("an ordinary GET still follows a redirect to another host — the refusal is about carried state, not about redirects", async () => {
    const { safeFetch } = await import("../../src/lib/egress/safe-fetch");
    vi.spyOn(dns.promises, "lookup").mockResolvedValue({ address: "93.184.216.34", family: 4 } as never);
    installTransport([
      { type: "response", statusCode: 301, headers: { location: "https://b.example.com/final" } },
      okResponse("final page"),
    ]);

    expect(await safeFetch("https://a.example.com/start")).toMatchObject({
      ok: true,
      url: "https://b.example.com/final",
    });
  });

  it("the log line still carries five fields and no header among them", async () => {
    const { safeFetch } = await import("../../src/lib/egress/safe-fetch");
    vi.spyOn(dns.promises, "lookup").mockResolvedValue({ address: "93.184.216.34", family: 4 } as never);
    installTransport([okResponse()]);
    const lines: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((line: unknown) => {
      lines.push(String(line));
    });

    await safeFetch("https://example.com/page", {
      method: "POST",
      headers: { Authorization: "Basic c2VjcmV0" },
      body: "{}",
      respectRobots: false,
    });
    spy.mockRestore();

    expect(lines).toHaveLength(1);
    expect(Object.keys(JSON.parse(lines[0]!)).sort()).toEqual([
      "bytes",
      "duration",
      "host",
      "reason",
      "status",
    ]);
    expect(lines[0]).not.toContain("c2VjcmV0");
  });
});
