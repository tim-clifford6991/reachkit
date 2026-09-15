// tests/egress/robots.test.ts — BUILD §6.4
//
// `readRobots` (BP-006 `## Public interface`, issue #22): the parser's
// verdicts, the three answers that never collapse (unreadable / absent /
// read), and `safeFetch` respecting what was read. The transport is mocked
// the way `tests/egress/safe-fetch.test.ts` mocks it — `node:dns` and
// `node:http(s)` directly, FIFO scenarios, one per request — so the
// robots.txt fetch and the page fetch that follows it are both scripted.
import { EventEmitter } from "node:events";
import http from "node:http";
import https from "node:https";
import dns from "node:dns";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crawlDelayMs, parseRobotsTxt, readRobots, robotsAllows } from "../../src/lib/egress/robots";
import { safeFetch } from "../../src/lib/egress/safe-fetch";
import { AI_READER_AGENTS } from "../../src/lib/config/constants";

const PUBLIC_IP = "93.184.216.34";
const ORIGIN = "https://example.com";

type Scenario =
  | { type: "response"; statusCode: number; body?: string; headers?: Record<string, string> }
  | { type: "error" }
  | { type: "hang" };

function installTransport(scenarios: Scenario[]) {
  const calls: http.RequestOptions[] = [];
  let i = 0;
  const impl = (options: http.RequestOptions, cb: (res: http.IncomingMessage) => void) => {
    calls.push(options);
    const scenario = scenarios[i++];
    const req = new EventEmitter() as unknown as http.ClientRequest;
    Object.assign(req, { end: () => undefined, destroy: vi.fn() });
    if (!scenario || scenario.type === "hang") return req;
    if (scenario.type === "error") {
      queueMicrotask(() => req.emit("error", Object.assign(new Error("refused"), { code: "ECONNREFUSED" })));
      return req;
    }
    queueMicrotask(() => {
      const res = new EventEmitter() as unknown as http.IncomingMessage;
      Object.assign(res, { statusCode: scenario.statusCode, headers: scenario.headers ?? {}, destroy: vi.fn() });
      cb(res);
      queueMicrotask(() => {
        if (scenario.body !== undefined) res.emit("data", Buffer.from(scenario.body));
        res.emit("end");
      });
    });
    return req;
  };
  vi.spyOn(http, "request").mockImplementation(impl as typeof http.request);
  vi.spyOn(https, "request").mockImplementation(impl as typeof https.request);
  return { calls };
}

function resolvesPublic() {
  vi.spyOn(dns.promises, "lookup").mockResolvedValue({ address: PUBLIC_IP, family: 4 });
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => undefined); // safeFetch's log line
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseRobotsTxt · verdicts at the origin root (RFC 9309)", () => {
  it("`User-agent: *` disallowing `/` → disallowsAll; a path-scoped disallow does not", () => {
    expect(parseRobotsTxt("User-agent: *\nDisallow: /").disallowsAll).toBe(true);
    expect(parseRobotsTxt("User-agent: *\nDisallow: /admin").disallowsAll).toBe(false);
    expect(parseRobotsTxt("User-agent: *\nDisallow:").disallowsAll).toBe(false);
  });

  it("longest match wins and Allow wins a tie", () => {
    expect(parseRobotsTxt("User-agent: *\nDisallow: /\nAllow: /").disallowsAll).toBe(false);
    expect(parseRobotsTxt("User-agent: *\nAllow: /\nDisallow: /$").disallowsAll).toBe(true);
    expect(parseRobotsTxt("User-agent: *\nDisallow: *").disallowsAll).toBe(true);
  });

  it("a token outside AI_READER_AGENTS still gets a key, lowercased whatever the document's casing", () => {
    const v = parseRobotsTxt("User-Agent: SomeOtherCrawler\nDisallow: /\n\nUser-agent: Bingbot\nDisallow: /private");
    expect(v.disallowedAgents).toEqual({ someothercrawler: true, bingbot: false });
  });

  it("a token naming a pinned reader is keyed by the pinned spelling, matched case-insensitively", () => {
    const pinned = AI_READER_AGENTS[0]!;
    const v = parseRobotsTxt(`user-agent: ${pinned.toUpperCase()}\ndisallow: /`);
    expect(v.disallowedAgents[pinned]).toBe(true);
    expect(Object.keys(v.disallowedAgents)).toEqual([pinned]);
  });

  it("a document naming no pinned reader yields no key for any of them — nothing is invented here", () => {
    const v = parseRobotsTxt("User-agent: *\nDisallow: /tmp");
    for (const token of AI_READER_AGENTS) expect(v.disallowedAgents).not.toHaveProperty(token);
  });

  it("groups: consecutive User-agent lines share rules; same token in two groups is merged; comments and BOM ignored", () => {
    const text = "﻿# banner\nUser-agent: GPTBot # trailing\nUser-agent: ClaudeBot\nDisallow: /\n\nUser-agent: gptbot\nAllow: /\n";
    const v = parseRobotsTxt(text);
    expect(v.disallowedAgents["ClaudeBot"]).toBe(true);
    expect(v.disallowedAgents["GPTBot"]).toBe(false); // merged: Disallow / and Allow / tie → allow
  });

  it("rules before any group are ignored; a product token's version suffix is dropped", () => {
    const v = parseRobotsTxt("Disallow: /\nUser-agent: PerplexityBot/1.0\nDisallow: /");
    expect(v.disallowsAll).toBe(false);
    expect(v.disallowedAgents["PerplexityBot"]).toBe(true);
  });

  it("three Sitemap lines yield three entries in document order", () => {
    const v = parseRobotsTxt("Sitemap: https://a/1.xml\nUser-agent: *\nDisallow:\nSitemap: https://a/2.xml\nsitemap: https://a/3.xml");
    expect(v.sitemaps).toEqual(["https://a/1.xml", "https://a/2.xml", "https://a/3.xml"]);
  });
});

describe("robotsAllows · any path, by the same rule (issue 610)", () => {
  const policyOf = (text: string) => ({
    ok: true as const,
    origin: "https://example.com",
    readAt: new Date(),
    absent: false,
    ...parseRobotsTxt(text),
  });
  const US = ["ReachKitMeasure/1.0 (+https://reachkit.app)", "reachkit-measure"];

  it("a Disallow: /cart line refuses /cart and what is under it, and leaves the rest", () => {
    const policy = policyOf("User-agent: *\nDisallow: /cart\n");
    expect(robotsAllows(policy, US, "/cart")).toBe(false);
    expect(robotsAllows(policy, US, "/cart/checkout")).toBe(false);
    expect(robotsAllows(policy, US, "/pricing")).toBe(true);
    expect(robotsAllows(policy, US, "/")).toBe(true);
  });

  it("the group naming us decides, not the wildcard's; longest match and Allow-on-tie hold per path", () => {
    const policy = policyOf("User-agent: *\nDisallow: /\n\nUser-agent: ReachKitMeasure\nDisallow: /private\nAllow: /private/open\n");
    expect(robotsAllows(policy, US, "/blog")).toBe(true);
    expect(robotsAllows(policy, US, "/private/x")).toBe(false);
    expect(robotsAllows(policy, US, "/private/open/y")).toBe(true);
  });

  it("a policy carrying no rules — one stored before them — is decided at the root, as before", () => {
    const base = { ok: true as const, origin: "https://example.com", readAt: new Date(), absent: false, sitemaps: [] };
    expect(robotsAllows({ ...base, disallowsAll: true, disallowedAgents: {} }, US, "/anything")).toBe(false);
    expect(robotsAllows({ ...base, disallowsAll: true, disallowedAgents: { "reachkit-measure": false } }, US, "/x")).toBe(true);
    expect(robotsAllows({ ...base, disallowsAll: false, disallowedAgents: {} }, US, "/x")).toBe(true);
  });

  it("Crawl-delay is read per group, in milliseconds, and a named group without one takes none from the wildcard", () => {
    expect(crawlDelayMs(policyOf("User-agent: *\nCrawl-delay: 5\n"), US)).toBe(5_000);
    expect(crawlDelayMs(policyOf("User-agent: *\nCrawl-delay: 0.5\n"), US)).toBe(500);
    expect(crawlDelayMs(policyOf("User-agent: *\nCrawl-delay: 5\n\nUser-agent: reachkitmeasure\nDisallow: /x\n"), US)).toBe(0);
    expect(crawlDelayMs(policyOf("User-agent: *\nCrawl-delay: soon\n"), US)).toBe(0);
    expect(crawlDelayMs(policyOf(""), US)).toBe(0);
  });
});

describe("readRobots · three answers that never collapse (BP-006 error behaviour)", () => {
  it("a 200 document → a policy with absent: false and its verdicts, at the requested origin", async () => {
    resolvesPublic();
    const { calls } = installTransport([{ type: "response", statusCode: 200, body: "User-agent: *\nDisallow: /" }]);

    const policy = await readRobots(`${ORIGIN}/some/page?q=1`);

    expect(policy).toMatchObject({ ok: true, origin: ORIGIN, absent: false, disallowsAll: true });
    expect(policy.ok && policy.readAt).toBeInstanceOf(Date);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.path).toBe("/robots.txt");
  });

  it("an empty 200 document → read and empty: absent: false, no verdict, no sitemap", async () => {
    resolvesPublic();
    installTransport([{ type: "response", statusCode: 200, body: "" }]);
    await expect(readRobots(ORIGIN)).resolves.toEqual(
      expect.objectContaining({ ok: true, absent: false, disallowsAll: false, disallowedAgents: {}, sitemaps: [] })
    );
  });

  it("a 404 → a policy with absent: true and empty verdicts — never the { ok: false } arm", async () => {
    resolvesPublic();
    installTransport([{ type: "response", statusCode: 404, body: "not found" }]);
    const policy = await readRobots(ORIGIN);
    expect(policy).toMatchObject({ ok: true, absent: true, disallowsAll: false, disallowedAgents: {}, sitemaps: [] });
  });

  it.each([
    ["a DNS failure", () => vi.spyOn(dns.promises, "lookup").mockRejectedValue(new Error("ENOTFOUND"))],
    ["a connection refusal", () => (resolvesPublic(), installTransport([{ type: "error" }]))],
    ["a 5xx answer", () => (resolvesPublic(), installTransport([{ type: "response", statusCode: 503, body: "" }]))],
    ["a 429 answer", () => (resolvesPublic(), installTransport([{ type: "response", statusCode: 429, body: "" }]))],
    ["a policy refusal", () => vi.spyOn(dns.promises, "lookup").mockResolvedValue({ address: "127.0.0.1", family: 4 })],
  ])("%s → { ok: false, reason } — could not determine", async (_label, arrange) => {
    arrange();
    const out = await readRobots(ORIGIN);
    expect(out.ok).toBe(false);
    expect(!out.ok && typeof out.reason).toBe("string");
  });

  it("a malformed origin → { ok: false }, never a throw", async () => {
    await expect(readRobots("not an origin")).resolves.toMatchObject({ ok: false });
  });

  it("fetches the document with respectRobots off — a disallow-all document is still read, not refused", async () => {
    resolvesPublic();
    const { calls } = installTransport([{ type: "response", statusCode: 200, body: "User-agent: *\nDisallow: /" }]);
    const policy = await readRobots(ORIGIN);
    expect(policy.ok).toBe(true);
    expect(calls).toHaveLength(1); // one fetch: the document itself, no recursive robots read
  });
});

describe("safeFetch · robots-respecting client through the wired reader (BP-006 responsibility)", () => {
  it("a document disallowing every reader → robots_disallowed, and the page is never requested", async () => {
    resolvesPublic();
    const { calls } = installTransport([{ type: "response", statusCode: 200, body: "User-agent: *\nDisallow: /" }]);

    const outcome = await safeFetch(`${ORIGIN}/page`);

    expect(outcome).toMatchObject({ ok: false, reason: "robots_disallowed" });
    expect(calls.map((c) => c.path)).toEqual(["/robots.txt"]);
  });

  it("a document disallowing our own product token by name → robots_disallowed", async () => {
    resolvesPublic();
    installTransport([{ type: "response", statusCode: 200, body: "User-agent: ReachKitMeasure\nDisallow: /" }]);
    await expect(safeFetch(`${ORIGIN}/page`)).resolves.toMatchObject({ ok: false, reason: "robots_disallowed" });
  });

  it("a document disallowing only a pinned AI reader, not us → the page is fetched", async () => {
    resolvesPublic();
    const { calls } = installTransport([
      { type: "response", statusCode: 200, body: "User-agent: GPTBot\nDisallow: /" },
      { type: "response", statusCode: 200, body: "<html>page</html>" },
    ]);
    const outcome = await safeFetch(`${ORIGIN}/page`);
    expect(outcome).toMatchObject({ ok: true, status: 200 });
    expect(calls.map((c) => c.path)).toEqual(["/robots.txt", "/page"]);
  });

  it("a document disallowing every reader but allowing ours by name → the page is fetched (RFC 9309 §2.2.1: the named group decides)", async () => {
    resolvesPublic();
    const { calls } = installTransport([
      { type: "response", statusCode: 200, body: "User-agent: *\nDisallow: /\n\nUser-agent: ReachKitMeasure\nAllow: /" },
      { type: "response", statusCode: 200, body: "<html>page</html>" },
    ]);
    const outcome = await safeFetch(`${ORIGIN}/page`);
    expect(outcome).toMatchObject({ ok: true, status: 200 });
    expect(calls.map((c) => c.path)).toEqual(["/robots.txt", "/page"]);
  });

  it("the caller's maxBytes still binds the page — the robots fetch does not reset it", async () => {
    resolvesPublic();
    installTransport([
      { type: "response", statusCode: 200, body: "User-agent: *\nAllow: /" },
      { type: "response", statusCode: 200, body: "x".repeat(64) },
    ]);
    await expect(safeFetch(`${ORIGIN}/page`, { maxBytes: 16 })).resolves.toMatchObject({
      ok: false,
      reason: "too_large",
    });
  });

  it("no robots.txt (404) → the page is fetched", async () => {
    resolvesPublic();
    installTransport([
      { type: "response", statusCode: 404, body: "" },
      { type: "response", statusCode: 200, body: "ok" },
    ]);
    await expect(safeFetch(`${ORIGIN}/page`)).resolves.toMatchObject({ ok: true });
  });

  it("an unreadable robots.txt (5xx) is 'could not determine' — the page is fetched, no disallow is fabricated", async () => {
    resolvesPublic();
    installTransport([
      { type: "response", statusCode: 500, body: "" },
      { type: "response", statusCode: 200, body: "ok" },
    ]);
    await expect(safeFetch(`${ORIGIN}/page`)).resolves.toMatchObject({ ok: true });
  });
});

describe("robots.ts · one closed list, read from constants.ts (ADR-022, ADR-090)", () => {
  it("imports AI_READER_AGENTS and declares no agent list of its own", () => {
    const source = readFileSync(path.resolve(__dirname, "../../src/lib/egress/robots.ts"), "utf8");
    expect(source).toMatch(/import \{ AI_READER_AGENTS \} from "@\/lib\/config\/constants"/);
    const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const token of AI_READER_AGENTS) expect(withoutComments).not.toContain(`"${token}"`);
  });
});
