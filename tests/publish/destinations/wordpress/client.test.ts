// tests/publish/destinations/wordpress/client.test.ts — BUILD §9:
// "credentials encrypted at rest, **never logged**, revoked on disconnect",
// and BUILD §6.4's one door out of the process.
//
// The discriminating test here is the seeded-credential sweep: a
// recognisable application password is put through every call and every
// failure path, and every string the module emitted — log lines, thrown
// messages, stacks and returned values — is searched for it. An
// implementation that logged its own request would pass every functional
// row in this file and fail that one.
//
// The archived plan is WO-236.
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const egress = vi.hoisted(() => ({
  calls: [] as { url: string; opts: Record<string, unknown> }[],
  answer: { ok: true, status: 200, url: "", html: "{}", bytes: 2, readAt: new Date(), headers: {} } as unknown,
}));

vi.mock("@/lib/egress", () => ({
  safeFetch: async (url: string, opts: Record<string, unknown>) => {
    egress.calls.push({ url, opts });
    return egress.answer;
  },
}));

import {
  createPost,
  createTag,
  findTag,
  readPost,
  readRestIndex,
  readSelf,
  restRoot,
  searchPosts,
  setPostDraft,
  type WordPressConfig,
} from "@/lib/publish/destinations/wordpress/client";

const PASSWORD = "abcd EFGH ijkl MNOP qrst UVWX";
const CFG: WordPressConfig = {
  baseUrl: "https://blog.example.com/",
  username: "reachkit-bot",
  applicationPassword: PASSWORD,
};

const SOURCE = readFileSync(
  path.resolve(import.meta.dirname, "../../../../src/lib/publish/destinations/wordpress/client.ts"),
  "utf8"
);

beforeEach(() => {
  egress.calls = [];
  egress.answer = {
    ok: true,
    status: 200,
    url: "https://blog.example.com/wp-json/",
    html: JSON.stringify({ namespaces: ["wp/v2"] }),
    bytes: 30,
    readAt: new Date(),
    headers: {},
  };
});

describe("BUILD §6.4 — every byte leaves through the egress seam and no other door", () => {
  it("the module names no fetch of its own", () => {
    // The backtick exclusion is for this module's own header, which names
    // the forbidden call in prose.
    expect(SOURCE).not.toMatch(/[^a-zA-Z`]fetch\s*\(/);
  });

  it("safeFetch is the one thing it imports from the seam", () => {
    const imports = SOURCE.match(/import\s+\{([^}]*)\}\s+from\s+"@\/lib\/egress"/);
    expect(imports?.[1]?.trim()).toBe("safeFetch");
  });

  it.each([
    ["the REST index", () => readRestIndex(CFG)],
    ["the account read", () => readSelf(CFG)],
    ["the marker search", () => searchPosts(CFG, "reachkit-draft:d1")],
    ["one post", () => readPost(CFG, "9")],
    ["the create", () => createPost(CFG, { title: "t" })],
    ["the return to draft", () => setPostDraft(CFG, "9")],
    ["the tag lookup", () => findTag(CFG, "reachkit")],
    ["the tag create", () => createTag(CFG, "reachkit", "ReachKit")],
  ])("%s goes through it", async (_name, call) => {
    await call();
    expect(egress.calls).toHaveLength(1);
    expect(egress.calls[0]!.url.startsWith("https://blog.example.com/wp-json/")).toBe(true);
  });
});

describe("the REST root is derived from baseUrl and stored nowhere twice", () => {
  it("a trailing slash on the site root does not become a double slash", () => {
    expect(restRoot("https://blog.example.com/")).toBe("https://blog.example.com/wp-json");
    expect(restRoot("https://blog.example.com")).toBe("https://blog.example.com/wp-json");
  });
});

describe("robots checking is off — an API the site's own administrator authorised", () => {
  it("every call says so, so a customer's own Disallow cannot stop their publishing", async () => {
    await readRestIndex(CFG);
    await createPost(CFG, { title: "t" });
    for (const call of egress.calls) expect(call.opts.respectRobots).toBe(false);
  });
});

describe("the application password is present for one call and reaches nothing else", () => {
  it("it is composed into one Authorization header and appears nowhere else in the request", async () => {
    await createPost(CFG, { title: "t" });
    const opts = egress.calls[0]!.opts as { headers: Record<string, string>; body?: string };
    const expected = `Basic ${Buffer.from(`reachkit-bot:${PASSWORD}`, "utf8").toString("base64")}`;
    expect(opts.headers.Authorization).toBe(expected);
    expect(egress.calls[0]!.url).not.toContain(PASSWORD);
    expect(opts.body ?? "").not.toContain(PASSWORD);
  });

  it("no returned value, log line, error message or stack carries it — every call, every failure path", async () => {
    const emitted: string[] = [];
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        emitted.push(args.map((a) => String(a)).join(" "));
      })
    );

    const answers: unknown[] = [
      { ok: false, reason: "dns", url: "u", readAt: new Date() },
      { ok: false, reason: "timeout", url: "u", readAt: new Date() },
      { ok: false, reason: "blocked_by_policy", url: "u", readAt: new Date() },
      { ok: true, status: 401, url: "u", html: '{"code":"unauthorized"}', bytes: 3, readAt: new Date(), headers: {} },
      { ok: true, status: 500, url: "u", html: "<html>error</html>", bytes: 3, readAt: new Date(), headers: {} },
      { ok: true, status: 201, url: "u", html: '{"id":9}', bytes: 3, readAt: new Date(), headers: {} },
    ];

    for (const answer of answers) {
      egress.answer = answer;
      for (const call of [
        () => readRestIndex(CFG),
        () => readSelf(CFG),
        () => searchPosts(CFG, "reachkit-draft:d1"),
        () => createPost(CFG, { title: "t", content: "c" }),
        () => setPostDraft(CFG, "9"),
        () => createTag(CFG, "reachkit", "ReachKit"),
      ]) {
        try {
          emitted.push(JSON.stringify(await call()));
        } catch (cause) {
          emitted.push(String(cause), (cause as Error).stack ?? "");
        }
      }
    }

    for (const spy of spies) spy.mockRestore();
    expect(emitted.length).toBeGreaterThan(0);
    expect(emitted.filter((line) => line.includes(PASSWORD))).toEqual([]);
    expect(emitted.filter((line) => line.includes("Basic "))).toEqual([]);
  });
});

describe("an answer is an answer, and a silence is a silence", () => {
  it("a status the site returned — 401, 404, 500 — is ok:true with that status", async () => {
    for (const status of [401, 404, 429, 500]) {
      egress.answer = { ok: true, status, url: "u", html: "{}", bytes: 2, readAt: new Date(), headers: {} };
      expect(await readPost(CFG, "9")).toEqual({ ok: true, status, body: {} });
    }
  });

  it("no answer at all is ok:false with the transport that failed", async () => {
    egress.answer = { ok: false, reason: "dns", url: "u", readAt: new Date() };
    expect(await readPost(CFG, "9")).toEqual({ ok: false, transport: "dns" });
  });

  it("a body that is not JSON is an answer with nothing readable in it, never a throw", async () => {
    egress.answer = { ok: true, status: 200, url: "u", html: "<html>not json</html>", bytes: 3, readAt: new Date(), headers: {} };
    expect(await readRestIndex(CFG)).toEqual({ ok: true, status: 200, body: null });
  });

  it("the vendor's own body never becomes the returned value", async () => {
    egress.answer = { ok: true, status: 500, url: "u", html: "PHP Fatal error at /var/www/wp-load.php", bytes: 3, readAt: new Date(), headers: {} };
    const answer = await readPost(CFG, "9");
    expect(JSON.stringify(answer)).not.toContain("wp-load");
  });
});

describe("there is no call that could publish a draft — ADR-084 Decision 1", () => {
  it("the status write sends `draft` and the module offers no other status", async () => {
    await setPostDraft(CFG, "9");
    const opts = egress.calls[0]!.opts as { body: string; method: string };
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({ status: "draft" });
    expect(SOURCE).not.toMatch(/status:\s*"publish"/);
  });
});
