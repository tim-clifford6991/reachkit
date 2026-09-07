// tests/egress/robots-memo.test.ts — BUILD §6.4, issue #73
//
// One robots.txt read per origin per scan. The three `Done when` lines are
// three describes below, and each counts **transport calls** rather than
// trusting a return value: a memo that returned the right answer while
// still fetching would pass every assertion about the answer and none of
// these.
//
// The transport is doubled the way `tests/egress/robots.test.ts` doubles it
// — `node:dns` and `node:http(s)` directly, one scripted response per
// request — so what is counted is what would have left the process.
import { EventEmitter } from "node:events";
import http from "node:http";
import https from "node:https";
import dns from "node:dns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readRobots } from "../../src/lib/egress/robots";
import { safeFetch } from "../../src/lib/egress/safe-fetch";
import { robotsMemoSize, withRobotsMemo } from "../../src/lib/egress/robots-memo";

const PUBLIC_IP = "93.184.216.34";
const ORIGIN = "https://example.com";
const OTHER_ORIGIN = "https://rival.example";

/** Every request the process would have made, in order, with the path each
 *  asked for — so "how many robots.txt reads" is a count and not a guess. */
function installTransport(body = "User-agent: *\nDisallow: /admin\n", statusCode = 200) {
  const paths: string[] = [];
  const impl = (options: http.RequestOptions, cb: (res: http.IncomingMessage) => void) => {
    paths.push(`${String(options.hostname ?? "")}${String(options.path ?? "")}`);
    const req = new EventEmitter() as unknown as http.ClientRequest;
    Object.assign(req, { end: () => undefined, destroy: vi.fn() });
    queueMicrotask(() => {
      const res = new EventEmitter() as unknown as http.IncomingMessage;
      Object.assign(res, { statusCode, headers: {}, destroy: vi.fn() });
      cb(res);
      queueMicrotask(() => {
        res.emit("data", Buffer.from(body));
        res.emit("end");
      });
    });
    return req;
  };
  vi.spyOn(http, "request").mockImplementation(impl as typeof http.request);
  vi.spyOn(https, "request").mockImplementation(impl as typeof https.request);
  return { paths, robotsReads: () => paths.filter((p) => p.endsWith("/robots.txt")).length };
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => undefined); // safeFetch's log line
  vi.spyOn(dns.promises, "lookup").mockResolvedValue({ address: PUBLIC_IP, family: 4 });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("within one scope, an origin's robots.txt is fetched at most once", () => {
  it("three reads of one origin are one request", async () => {
    const transport = installTransport();
    await withRobotsMemo(async () => {
      await readRobots(ORIGIN);
      await readRobots(ORIGIN);
      await readRobots(ORIGIN);
    });
    expect(transport.robotsReads()).toBe(1);
  });

  it("and they all get the same answer, not just the first", async () => {
    installTransport("User-agent: *\nDisallow: /\n");
    const answers = await withRobotsMemo(async () =>
      Promise.all([readRobots(ORIGIN), readRobots(ORIGIN)])
    );
    expect(answers[0]).toEqual(answers[1]);
    expect(answers[1]).toMatchObject({ ok: true, disallowsAll: true });
  });

  it("reads in flight at once share one request — the count is not an artefact of awaiting in turn", async () => {
    // Keying the memo on the settled value rather than the promise would
    // make this two requests while leaving the sequential test above green.
    const transport = installTransport();
    await withRobotsMemo(async () => {
      await Promise.all([readRobots(ORIGIN), readRobots(ORIGIN), readRobots(ORIGIN)]);
    });
    expect(transport.robotsReads()).toBe(1);
  });

  it("two origins are two reads — the memo is per origin, not per scan", async () => {
    const transport = installTransport();
    await withRobotsMemo(async () => {
      await readRobots(ORIGIN);
      await readRobots(OTHER_ORIGIN);
      await readRobots(ORIGIN);
    });
    expect(transport.robotsReads()).toBe(2);
    expect(robotsMemoSize()).toBeNull(); // the scope is closed by now
  });

  it("two spellings of one origin are one entry", async () => {
    const transport = installTransport();
    await withRobotsMemo(async () => {
      await readRobots(`${ORIGIN}/some/page?q=1`);
      await readRobots(ORIGIN);
      expect(robotsMemoSize()).toBe(1);
    });
    expect(transport.robotsReads()).toBe(1);
  });

  it("a page fetched through safeFetch reads robots once, however many pages follow", async () => {
    // The defect as it was reported: `safeFetch` consulted robots on every
    // call, so a deep pass fetching twenty-five pages from one origin read
    // the document twenty-five times.
    const transport = installTransport();
    await withRobotsMemo(async () => {
      for (const page of ["/a", "/b", "/c"]) await safeFetch(`${ORIGIN}${page}`);
    });
    expect(transport.robotsReads()).toBe(1);
    // The pages themselves are still fetched — the memo is robots', not
    // everything's.
    expect(transport.paths.filter((p) => !p.endsWith("/robots.txt"))).toHaveLength(3);
  });

  it("a read that could not be determined is held too — an origin answering 500 is not re-asked per page", async () => {
    const transport = installTransport("", 500);
    const answers = await withRobotsMemo(async () => [await readRobots(ORIGIN), await readRobots(ORIGIN)]);
    expect(transport.robotsReads()).toBe(1);
    expect(answers[0]).toMatchObject({ ok: false });
    // It fails open: `safeFetch` treats "could not determine" as no policy
    // known and never fabricates a disallow, so holding it withholds
    // nothing from the fetch that follows.
    expect(answers[1]).toEqual(answers[0]);
  });
});

describe("the memo does not outlive its scope", () => {
  it("a second scope re-reads — no scan is served the last scan's policy", async () => {
    const transport = installTransport();
    await withRobotsMemo(async () => {
      await readRobots(ORIGIN);
    });
    await withRobotsMemo(async () => {
      await readRobots(ORIGIN);
    });
    expect(transport.robotsReads()).toBe(2);
  });

  it("a scope that threw leaves nothing behind", async () => {
    const transport = installTransport();
    await expect(
      withRobotsMemo(async () => {
        await readRobots(ORIGIN);
        throw new Error("the pass failed");
      })
    ).rejects.toThrow("the pass failed");

    await withRobotsMemo(async () => {
      await readRobots(ORIGIN);
    });
    expect(transport.robotsReads()).toBe(2);
    expect(robotsMemoSize()).toBeNull();
  });
});

describe("readRobots is unchanged when called outside a scope", () => {
  it("no scope, no memo — every call is its own read", async () => {
    const transport = installTransport();
    await readRobots(ORIGIN);
    await readRobots(ORIGIN);
    expect(transport.robotsReads()).toBe(2);
    expect(robotsMemoSize()).toBeNull();
  });

  it("the answer is the same one it always gave", async () => {
    installTransport("User-agent: *\nDisallow: /\nSitemap: https://example.com/sitemap.xml\n");
    const outside = await readRobots(ORIGIN);
    const inside = await withRobotsMemo(() => readRobots(ORIGIN));
    // `readAt` is the moment of *that* read and is rightly different; every
    // other field a caller reads is the same document parsed the same way.
    expect({ ...inside, readAt: undefined }).toEqual({ ...outside, readAt: undefined });
    expect(outside).toMatchObject({ ok: true, absent: false, disallowsAll: true });
    expect(outside).toMatchObject({ sitemaps: ["https://example.com/sitemap.xml"] });
  });

  it("a malformed origin never reaches the memo, inside a scope or out", async () => {
    installTransport();
    const outside = await readRobots("not a url");
    const inside = await withRobotsMemo(async () => {
      const answer = await readRobots("not a url");
      expect(robotsMemoSize()).toBe(0);
      return answer;
    });
    expect(inside).toEqual(outside);
    expect(outside).toMatchObject({ ok: false });
  });
});
