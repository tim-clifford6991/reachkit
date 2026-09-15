// tests/egress/policy.test.ts
//
// WO-018 test plan rows assigned to this file: the refusal policy (one case
// per address class, scheme, port, and a redirect chain whose second hop is
// private), the lint rule that audits `fetch(` calls outside this module,
// and the `RobotsPolicy` type-level suite (`src/lib/egress/types.ts`).
import { EventEmitter } from "node:events";
import http from "node:http";
import https from "node:https";
import dns from "node:dns";
import path from "node:path";
import { ESLint } from "eslint";
import { afterEach, beforeAll, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { checkAddress, checkSchemeAndPort, classifyAddress } from "../../src/lib/egress/policy";
import type { RobotsPolicy } from "../../src/lib/egress/types";

// ── Address classification — one case per class BP-006 names ───────────

describe("policy/classifyAddress · one case per named class", () => {
  const cases: Array<[string, string, ReturnType<typeof classifyAddress>]> = [
    ["10.1.2.3", "private (RFC 1918)", "private"],
    ["172.16.0.1", "private (RFC 1918)", "private"],
    ["192.168.1.1", "private (RFC 1918)", "private"],
    ["fc00::1", "private (RFC 4193 unique-local)", "private"],
    ["127.0.0.1", "loopback", "loopback"],
    ["::1", "loopback", "loopback"],
    ["169.254.1.1", "link-local", "link_local"],
    ["fe80::1", "link-local", "link_local"],
    ["224.0.0.1", "multicast", "multicast"],
    ["ff02::1", "multicast", "multicast"],
    ["0.0.0.0", "reserved", "reserved"],
    ["100.64.0.1", "reserved (CGNAT)", "reserved"],
    ["192.0.2.1", "reserved (TEST-NET-1)", "reserved"],
    ["255.255.255.255", "reserved (broadcast)", "reserved"],
    ["2001:db8::1", "reserved (documentation)", "reserved"],
  ];

  it.each(cases)("%s (%s) classifies as %s", (ip, _label, expected) => {
    expect(classifyAddress(ip)).toBe(expected);
  });

  it("a normal public address classifies as public and is not blocked", () => {
    expect(classifyAddress("93.184.216.34")).toBe("public");
    expect(checkAddress("93.184.216.34")).toEqual({ ok: true });
  });

  it("an IPv4-mapped IPv6 literal is still refused when its embedded IPv4 address is blocked (TST-027)", () => {
    // Not a hand-rolled unwrap in this module — `RANGES` adds both
    // families' subnets into one `BlockList` per class, and
    // `BlockList.check(ip, "ipv6")` resolves an IPv4-mapped literal
    // against the IPv4 subnets in that same list on its own. This test
    // locks the *outcome*, not a mechanism this file owns: if a later
    // refactor ever splits the IPv4 and IPv6 subnets of one class into two
    // separate `BlockList`s, the mapped form silently stops being caught,
    // and this is the test that would catch that.
    expect(classifyAddress("::ffff:127.0.0.1")).toBe("loopback");
    expect(classifyAddress("::ffff:10.0.0.5")).toBe("private");
  });

  it("every named class is refused by checkAddress", () => {
    for (const [ip] of cases) {
      expect(checkAddress(ip)).toMatchObject({ ok: false });
    }
  });

  it("garbage that is not a valid IP literal is refused, never silently allowed", () => {
    expect(classifyAddress("not-an-ip")).toBe("reserved");
    expect(checkAddress("not-an-ip")).toMatchObject({ ok: false });
  });
});

// ── Scheme and port — decided before any DNS lookup ─────────────────────

describe("policy/checkSchemeAndPort", () => {
  it.each(["ftp://example.com/", "file:///etc/passwd", "gopher://example.com/"])(
    "refuses a non-http(s) scheme: %s",
    (url) => {
      expect(checkSchemeAndPort(new URL(url))).toMatchObject({ ok: false });
    }
  );

  it.each(["http://example.com/", "https://example.com/", "https://example.com:443/", "http://example.com:80/"])(
    "allows http/https on their default ports: %s",
    (url) => {
      expect(checkSchemeAndPort(new URL(url))).toEqual({ ok: true });
    }
  );

  it.each(["https://example.com:8443/", "http://example.com:8080/", "https://example.com:22/"])(
    "refuses a port other than 80/443: %s",
    (url) => {
      expect(checkSchemeAndPort(new URL(url))).toMatchObject({ ok: false });
    }
  );
});

// ── Integration: every refusal reaches safeFetch as blocked_by_policy,
// and no socket is ever opened ───────────────────────────────────────────

type Scenario =
  | { type: "response"; statusCode: number; headers?: Record<string, string>; bodyChunks?: Buffer[] }
  | { type: "hang" };

function installTransport(scenarios: Scenario[]) {
  const calls: http.RequestOptions[] = [];
  let i = 0;
  const impl = (options: http.RequestOptions, cb: (res: http.IncomingMessage) => void) => {
    calls.push(options);
    const scenario = scenarios[i++];
    const req = new EventEmitter() as unknown as http.ClientRequest;
    (req as unknown as { end: () => void }).end = () => {};
    (req as unknown as { destroy: () => void }).destroy = vi.fn();
    if (scenario?.type === "response") {
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
    return req;
  };
  vi.spyOn(http, "request").mockImplementation(impl as typeof http.request);
  vi.spyOn(https, "request").mockImplementation(impl as typeof https.request);
  return { calls };
}

describe("safeFetch · policy refusal opens no socket", () => {
  // These cases are about the address policy, not robots. The wired reader
  // would fetch `/robots.txt` through the same mocked transport and consume
  // the scenario scripted for the page, so it is stubbed out to "could not
  // determine" here — the arm that refuses nothing (`robots.test.ts` owns
  // the reader's own behaviour).
  beforeEach(async () => {
    const { __setRobotsPortForTesting } = await import("../../src/lib/egress/safe-fetch");
    __setRobotsPortForTesting(async () => ({ ok: false, reason: "robots reader stubbed out in policy.test.ts" }));
  });
  afterEach(async () => {
    const { __setRobotsPortForTesting } = await import("../../src/lib/egress/safe-fetch");
    __setRobotsPortForTesting(null);
  });

  it.each([
    ["private", "10.1.2.3"],
    ["loopback", "127.0.0.1"],
    ["link-local", "169.254.1.1"],
    ["multicast", "224.0.0.1"],
    ["reserved", "0.0.0.0"],
  ])("refuses a resolved %s address (%s) before connecting", async (_label, ip) => {
    vi.restoreAllMocks();
    const { safeFetch } = await import("../../src/lib/egress/safe-fetch");
    vi.spyOn(dns.promises, "lookup").mockResolvedValue({ address: ip, family: ip.includes(":") ? 6 : 4 });
    const { calls } = installTransport([]);

    const outcome = await safeFetch("https://blocked.example.com/");

    expect(outcome).toMatchObject({ ok: false, reason: "blocked_by_policy" });
    expect(calls).toHaveLength(0);
  });

  it("refuses a non-http(s) scheme before any DNS lookup", async () => {
    vi.restoreAllMocks();
    const { safeFetch } = await import("../../src/lib/egress/safe-fetch");
    const lookupSpy = vi.spyOn(dns.promises, "lookup");
    const { calls } = installTransport([]);

    const outcome = await safeFetch("ftp://example.com/file");

    expect(outcome).toMatchObject({ ok: false, reason: "blocked_by_policy" });
    expect(lookupSpy).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });

  it("refuses a disallowed port before connecting", async () => {
    vi.restoreAllMocks();
    const { safeFetch } = await import("../../src/lib/egress/safe-fetch");
    const { calls } = installTransport([]);

    const outcome = await safeFetch("https://example.com:8443/");

    expect(outcome).toMatchObject({ ok: false, reason: "blocked_by_policy" });
    expect(calls).toHaveLength(0);
  });

  it("refuses a redirect chain whose second hop resolves to a private address, and never opens a socket to that second hop", async () => {
    vi.restoreAllMocks();
    const { safeFetch } = await import("../../src/lib/egress/safe-fetch");
    vi.spyOn(dns.promises, "lookup").mockImplementation(async (hostname) => {
      if (hostname === "a.example.com") return { address: "93.184.216.34", family: 4 } as never;
      if (hostname === "b.internal.example.com") return { address: "10.9.9.9", family: 4 } as never;
      throw new Error(`unexpected hostname ${String(hostname)}`);
    });
    const { calls } = installTransport([
      { type: "response", statusCode: 302, headers: { location: "https://b.internal.example.com/x" } },
    ]);

    const outcome = await safeFetch("https://a.example.com/start");

    expect(outcome).toMatchObject({ ok: false, reason: "blocked_by_policy" });
    // Exactly one socket: the first hop, to fetch the redirect itself. The
    // second hop's private address is refused before a second connection.
    expect(calls).toHaveLength(1);
  });
});

// ── The lint rule (BP-006 NFR: "a `fetch(` call anywhere else under
// src/lib/ that is not BP-008's vendor client is a lint error") ─────────

const ROOT = path.resolve(__dirname, "../..");

/** Each `it` below constructs its own `ESLint`, which loads and resolves the
 *  repo's real `eslint.config.mjs` — `next/core-web-vitals` and
 *  `typescript-eslint` included — before it lints one string. That cold boot
 *  is seconds, it grows with the config's plugin set, and under a full
 *  parallel run it crossed Vitest's 5 s default the week `src/app` gained the
 *  app shell's routes (issue #9). The bound below is on the toolchain's
 *  startup, not on the assertion, and it is per-`it` so nothing else in this
 *  file loses its deadline. Same value, same reason, as
 *  `tests/app/lint-rules.test.ts`'s. */
const ESLINT_BOOT_MS = 30_000;

async function lint(source: string, filePath: string): Promise<ESLint.LintResult> {
  const eslint = new ESLint({ cwd: ROOT });
  const [result] = await eslint.lintText(source, { filePath: path.join(ROOT, filePath) });
  if (!result) throw new Error("eslint returned no result");
  return result;
}

// The first ESLint run in a worker pays the whole flat-config bootstrap —
// `eslint-config-next` resolves a TypeScript program over the repo, so that
// one-off cost grows with the source tree and has outgrown Vitest's 5 s
// per-test default (adding `src/jobs/**` in #39 was what pushed it over).
// It is paid once here, under its own timeout; every assertion below then
// runs in tens of milliseconds and keeps the default, so a rule that
// actually breaks still fails fast.
beforeAll(async () => {
  await lint("export const warmUp = true;\n", "src/lib/measure/eslint-warm-up.ts");
}, 60_000);

describe("BP-006 NFR — fetch( is confined to src/lib/egress/** and src/lib/vendors/**", () => {
  it("reports a fetch( call under src/lib/measure/", async () => {
    const result = await lint("export async function f() {\n  return fetch('https://x');\n}\n", "src/lib/measure/uses-fetch.ts");
    expect(result.messages.length).toBeGreaterThan(0);
  }, ESLINT_BOOT_MS);

  it("does not report a fetch( call inside src/lib/egress/", async () => {
    const result = await lint(
      "export async function f() {\n  return fetch('https://x');\n}\n",
      "src/lib/egress/some-internal.ts"
    );
    expect(result.messages).toEqual([]);
  }, ESLINT_BOOT_MS);

  it("does not report a fetch( call inside src/lib/vendors/", async () => {
    const result = await lint(
      "export async function f() {\n  return fetch('https://x');\n}\n",
      "src/lib/vendors/dataforseo.ts"
    );
    expect(result.messages).toEqual([]);
  }, ESLINT_BOOT_MS);
});

// ── RobotsPolicy — the type-level suite row 8's test names ─────────────

describe("RobotsPolicy · the verdict fields required, the per-path directives optional, no null policy", () => {
  it("structurally equals the exact shape BP-006 declares — deleting `absent` or widening any field to `| null` is a type error `tsc --noEmit` catches", () => {
    // `rules` and `crawlDelaySeconds` (issue 610) are optional because a
    // policy measured before them is stored without them; `robotsAllows`
    // decides such a policy at the root, as it always was.
    expectTypeOf<RobotsPolicy>().toEqualTypeOf<{
      ok: true;
      origin: string;
      readAt: Date;
      disallowsAll: boolean;
      disallowedAgents: Readonly<Record<string, boolean>>;
      sitemaps: readonly string[];
      rules?: Readonly<Record<string, readonly { allow: boolean; pattern: string }[]>>;
      crawlDelaySeconds?: Readonly<Record<string, number>>;
      absent: boolean;
    }>();
  });

  it("a value with only the verdict fields is a whole policy: these seven keys", () => {
    const value: RobotsPolicy = {
      ok: true,
      origin: "https://example.com",
      readAt: new Date(),
      disallowsAll: false,
      disallowedAgents: {},
      sitemaps: [],
      absent: false,
    };
    expect(Object.keys(value).sort()).toEqual(
      ["absent", "disallowedAgents", "disallowsAll", "ok", "origin", "readAt", "sitemaps"].sort()
    );
  });
});
