// tests/publish/reads/classify.test.ts — SPEC §6 (2026-09-20, #908) measure
// (d) · SPEC §7 of the same date, issue #921.
//
// The whole decision behind the hosted blog's counts, with no database, no
// browser and no request: three strings in, one `{ engine, kind }` or
// nothing out.
//
// The two rules this file exists to hold:
//
//   · **A training crawler is never counted.** §6(d): "training crawlers are
//     not progress and are not shown." It is excluded by name, before
//     anything else is asked, so a list that later grew a token containing
//     `GPTBot` cannot quietly turn a training crawl into a customer's
//     progress.
//   · **Nothing identifying survives.** The value handed to the store is two
//     enumerations wide; there is no member on it an address, an agent
//     string or a host could be written into. §7: "no cookie, no visitor
//     identity … nothing else about a visit is kept."
import { describe, expect, it } from "vitest";
import {
  AI_ANSWER_FETCHERS,
  AI_BLOG_ENGINES,
  AI_REFERRER_HOSTS,
  AI_SEARCH_INDEXERS,
  AI_TRAINING_CRAWLERS,
} from "@/lib/config/constants";
import { BLOG_READ_KINDS, classifyBlogRead } from "@/lib/publish/reads/classify";

function read(over: Partial<Parameters<typeof classifyBlogRead>[0]> = {}) {
  return classifyBlogRead({ userAgent: null, referer: null, utmSource: null, ...over });
}

describe("§6(d) — a user-triggered fetcher is a page fetched to answer someone's question", () => {
  it.each(Object.entries(AI_ANSWER_FETCHERS))(
    "%s is counted as an answer fetch for %s",
    (token, engine) => {
      expect(read({ userAgent: `Mozilla/5.0 (compatible; ${token}/1.0; +https://example.org/bot)` }))
        .toEqual({ engine, kind: "answer_fetch" });
    }
  );

  it("the bare token on its own is enough — a vendor may send no browser prelude", () => {
    expect(read({ userAgent: "ChatGPT-User" })).toEqual({
      engine: "chatgpt",
      kind: "answer_fetch",
    });
  });
});

describe("§6(d) — a search indexer is counted, and counted apart", () => {
  it.each(Object.entries(AI_SEARCH_INDEXERS))(
    "%s is counted as an index fetch for %s",
    (token, engine) => {
      expect(read({ userAgent: `Mozilla/5.0 (compatible; ${token}/1.0)` })).toEqual({
        engine,
        kind: "index_fetch",
      });
    }
  );

  it("an indexer is never an answer fetch — the two reasons never collapse", () => {
    for (const token of Object.keys(AI_SEARCH_INDEXERS)) {
      expect(read({ userAgent: token })?.kind).toBe("index_fetch");
    }
  });
});

describe('§6(d) — "training crawlers are not progress and are not shown"', () => {
  it.each([...AI_TRAINING_CRAWLERS])("%s is not counted at all", (token) => {
    expect(read({ userAgent: `Mozilla/5.0 (compatible; ${token}/1.0)` })).toBeNull();
  });

  it("a training crawler carrying an AI referrer is still not counted", () => {
    // The exclusion is first and it ends the decision. Without that order a
    // crawl with a crafted `Referer` would be filed as a visitor.
    expect(
      read({ userAgent: "GPTBot/1.2", referer: "https://chatgpt.com/c/abc" })
    ).toBeNull();
  });

  it("ClaudeBot is excluded although Claude-User and Claude-SearchBot are counted", () => {
    expect(read({ userAgent: "ClaudeBot/1.0" })).toBeNull();
    expect(read({ userAgent: "Claude-User/1.0" })?.kind).toBe("answer_fetch");
    expect(read({ userAgent: "Claude-SearchBot/1.0" })?.kind).toBe("index_fetch");
  });
});

describe("§6(d) — visitors arriving from an AI answer", () => {
  it.each(Object.entries(AI_REFERRER_HOSTS))("a referrer at %s is a referral from %s", (host, engine) => {
    expect(read({ referer: `https://${host}/some/path` })).toEqual({ engine, kind: "referral" });
  });

  it("a subdomain of a known host counts; a host that merely ends in one does not", () => {
    expect(read({ referer: "https://www.perplexity.ai/search" })).toEqual({
      engine: "perplexity",
      kind: "referral",
    });
    expect(read({ referer: "https://perplexity.ai.example.com/" })).toBeNull();
  });

  it("the referrer is parsed, not searched — a path naming an engine is not a referral", () => {
    expect(read({ referer: "https://example.com/blog/chatgpt.com/review" })).toBeNull();
  });

  it("a referrer that is not an absolute address is nothing", () => {
    expect(read({ referer: "chatgpt.com" })).toBeNull();
    expect(read({ referer: "" })).toBeNull();
  });

  it("utm_source is the other half, for the apps that strip the referrer", () => {
    expect(read({ utmSource: "chatgpt" })).toEqual({ engine: "chatgpt", kind: "referral" });
    expect(read({ utmSource: "  ChatGPT " })).toEqual({ engine: "chatgpt", kind: "referral" });
    expect(read({ utmSource: "newsletter" })).toBeNull();
  });

  it("an engine's own fetch outranks a referrer it also carried", () => {
    // A robot's fetch must never be filed as a person's visit, whatever
    // `Referer` it sends.
    expect(read({ userAgent: "ChatGPT-User/1.0", referer: "https://perplexity.ai/" })).toEqual({
      engine: "chatgpt",
      kind: "answer_fetch",
    });
  });
});

describe("D6 — visitors arriving from Google or Bing search", () => {
  const browser = "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/140 Safari/537.36";

  it.each([
    ["a country Google", "https://www.google.de/", "google"],
    ["a bare Google with a query", "https://google.co.uk/search?q=plumber+leeds", "google"],
    ["an image search", "https://www.google.com/imgres?imgurl=x", "google"],
    ["Bing", "https://www.bing.com/", "bing"],
  ])("%s is a referral", (_name, referer, engine) => {
    expect(read({ userAgent: browser, referer })).toEqual({ engine, kind: "referral" });
  });

  it.each([
    ["a host that only starts with google", "https://google.evil.example/"],
    ["a Google host that is not search", "https://docs.google.com/document/d/1"],
    ["a subdomain of Bing", "https://cn.bing.com.evil.example/"],
    ["a prototype key", "https://constructor/"],
  ])("%s is not", (_name, referer) => {
    expect(read({ userAgent: browser, referer })).toBeNull();
  });

  it("the value names the engine and nothing of the address", () => {
    const serialised = JSON.stringify(read({ referer: "https://www.google.fr/search?q=secret-term" }));
    expect(serialised).toBe(JSON.stringify({ engine: "google", kind: "referral" }));
  });
});

describe("ordinary traffic is nothing, and that is not an error", () => {
  it.each([
    ["a browser", { userAgent: "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/140 Safari/537.36" }],
    // Googlebot is no longer here: since issue 1553 it is a crawl claim,
    // counted only from Google's own addresses (`crawler.test.ts`).
    ["a non-search Google host", { referer: "https://mail.google.com/mail/u/0/" }],
    ["nothing at all", {}],
  ])("%s counts nothing", (_name, facts) => {
    expect(read(facts)).toBeNull();
  });
});

describe("§7 — nothing about the visitor crosses this seam", () => {
  it("the value carries exactly two members, both of them closed sets", () => {
    const value = read({ userAgent: "ChatGPT-User/1.0 (+https://openai.com/bot; 203.0.113.9)" });
    expect(value).not.toBeNull();
    expect(Object.keys(value ?? {}).sort()).toEqual(["engine", "kind"]);
    expect(AI_BLOG_ENGINES as readonly string[]).toContain(value?.engine);
    expect(BLOG_READ_KINDS as readonly string[]).toContain(value?.kind);
  });

  it("a whole agent string, referrer and query yield no substring of themselves", () => {
    const value = read({
      userAgent: "Perplexity-User/1.0 (+https://perplexity.ai/bot)",
      referer: "https://chatgpt.com/c/0000-1111-2222",
      utmSource: "chatgpt",
    });
    const serialised = JSON.stringify(value);
    expect(serialised).not.toContain("0000-1111-2222");
    expect(serialised).not.toContain("Mozilla");
    expect(serialised).not.toContain("https://");
  });
});
