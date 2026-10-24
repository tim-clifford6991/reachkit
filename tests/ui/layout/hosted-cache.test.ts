// tests/ui/layout/hosted-cache.test.ts — issue 1242
//
// "A second request for a hosted article is a CDN hit." What a CDN caches
// is what Next says may be cached, so this asks the built, started app the
// two things that decide it: that the article's second answer comes from
// the cache, under a `Cache-Control` a CDN may keep, and that the surfaces
// which must be asked again on every request still are.
//
// It runs in the `layout` project because that is the only project with a
// built, started, seeded app behind it (`browser.ts`). That a page taken
// down, a site whose access ended and a host that moved never reach the
// cached copy is `tests/hosted/container/edge.test.ts`'s: it is decided by
// the middleware, before the cache, and needs no browser to see.
import { describe, expect, it } from "vitest";
import { BAND_MIN } from "@/ui/layout/bands";
import { getBaseURL, withPage } from "./browser";
import { PUBLISHED_HOST_FIXTURES } from "./routes";
import { PUBLISHER_PAGE } from "./seed-rows";

const HOST = Object.values(PUBLISHED_HOST_FIXTURES)[0] as string;

/** Two navigations in two fresh browsers, so the second is not answered by
 *  the first one's own HTTP cache. */
const TWO_VISITS_MS = 120_000;

function addressOf(path: string): string {
  const url = new URL(`${getBaseURL()}${path}`);
  url.hostname = HOST;
  return url.toString();
}

async function visit(path: string): Promise<{ status: number; headers: Record<string, string>; html: string }> {
  return withPage(BAND_MIN.compact, async (page) => {
    const response = await page.goto(addressOf(path));
    if (response === null) throw new Error(`tests/ui/layout/hosted-cache.test.ts: ${path} produced no response`);
    return { status: response.status(), headers: response.headers(), html: await page.content() };
  });
}

describe("issue 1242 — a live hosted article is cached, and nothing else on the host is", () => {
  it(
    "the article's second answer is a cache hit a CDN may keep for a minute",
    async () => {
      const first = await visit(`/${PUBLISHER_PAGE.slug}`);
      const second = await visit(`/${PUBLISHER_PAGE.slug}`);
      for (const answer of [first, second]) {
        expect(answer.status).toBe(200);
        expect(answer.html).toContain(PUBLISHER_PAGE.title);
        expect(answer.headers["cache-control"]).toContain("s-maxage=60");
        // No script runs on a cached page, and none carries a nonce that
        // would be one request's served to every other.
        expect(answer.headers["content-security-policy"]).toContain("script-src 'none'");
        expect(answer.html).not.toMatch(/<script[^>]*\snonce=/);
      }
      expect(second.headers["x-nextjs-cache"]).toBe("HIT");
    },
    TWO_VISITS_MS,
  );

  it(
    "the index and an address with no page are still rendered for each request",
    async () => {
      for (const path of ["/", "/never-published"]) {
        const answer = await visit(path);
        expect(answer.headers["cache-control"], path).toContain("no-store");
        expect(answer.headers["content-security-policy"], path).toMatch(/'nonce-[^']+'/);
      }
    },
    TWO_VISITS_MS,
  );

});

describe("a page served as a string is styled from the customer's own host", () => {
  it(
    "the host serves the hosted sheet, and every face the sheet names, from its own address",
    async () => {
      await withPage(BAND_MIN.compact, async (page) => {
        const response = await page.goto(addressOf("/style.css"));
        if (response === null) throw new Error("tests/ui/layout/hosted-cache.test.ts: /style.css produced no response");
        expect(response.status()).toBe(200);
        expect(response.headers()["content-type"]).toContain("text/css");
        const css = await response.text();
        expect(css).toContain(".navbar");
        expect(css).toContain("@font-face");
        const faces = [...new Set([...css.matchAll(/url\((\/font\/[^)]+)\)/g)].map((match) => match[1] as string))];
        expect(faces.length).toBeGreaterThan(0);
        // Fetched from the page, so the request rides the browser's host mapping to the fixture host.
        const answers = await page.evaluate(
          async (paths) =>
            Promise.all(
              paths.map(async (path) => {
                const answer = await fetch(path);
                return { path, status: answer.status, type: answer.headers.get("content-type") };
              })
            ),
          [...faces, "/font/not-a-face.woff2"]
        );
        for (const answer of answers.slice(0, -1)) {
          expect(answer, answer.path).toMatchObject({ status: 200, type: "font/woff2" });
        }
        expect(answers.at(-1)?.status).toBe(404);
      });
    },
    TWO_VISITS_MS,
  );
});
