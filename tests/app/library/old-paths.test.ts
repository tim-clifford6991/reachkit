// Issue 1458 — every address an earlier ReachKit published answers what
// `old-paths.json` says: a page (200), a permanent move to a page (301), or
// gone (410). The list is the fixture; the tree, the middleware and the
// library are what is held to it, so a page or a redirect that goes missing
// fails here by its address.
import "../../generate/env";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { middleware } from "@/middleware";
import { movedAnswer } from "@/app/(public)/_seo/moved";
import { sitemapPaths } from "@/app/(public)/_seo/routes";
import { ANSWERS, COMPARISONS, TEARDOWNS } from "@/app/(public)/_library";
import fixture from "./old-paths.json";

type Expected = { status: 200 } | { status: 301; location: string } | { status: 410 };
const PATHS = fixture.paths as Record<string, Expected>;

const ROOT = path.resolve(import.meta.dirname, "../../..");
const APP = path.join(ROOT, "src/app");

/** The route tree as patterns: groups dropped, `_private` skipped. */
function patterns(dir: string, prefix: string[] = []): string[][] {
  const found: string[][] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && /^(page|route)\.tsx?$/.test(entry.name)) found.push(prefix);
    if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
    const next = entry.name.startsWith("(") ? prefix : [...prefix, entry.name];
    found.push(...patterns(path.join(dir, entry.name), next));
  }
  return found;
}

const TREE = patterns(APP);

/** The slugs a static-params route serves; any other is its 404. */
const KNOWN: Readonly<Record<string, readonly string[]>> = {
  "[tool]": COMPARISONS.map((c) => c.slug),
  "[site]": TEARDOWNS.map((t) => t.slug),
  "[question]": ANSWERS.map((a) => a.slug),
};

/** A page or route in the tree answers this path, or a file in `public/`. */
function served(pathname: string): boolean {
  if (pathname !== "/" && existsSync(path.join(ROOT, "public", pathname))) return true;
  const parts = pathname.split("/").filter((p) => p !== "");
  return TREE.some(
    (pattern) =>
      pattern.length === parts.length &&
      pattern.every((segment, i) => {
        const part = parts[i]!;
        if (!segment.startsWith("[")) return segment === part;
        return KNOWN[segment]?.includes(part) ?? true;
      })
  );
}

/** The sitemap's paths the list does not hold as a page. */
function unlisted(sitemap: readonly string[]): string[] {
  return sitemap.filter((pathname) => PATHS[pathname]?.status !== 200);
}

describe("every old address answers what the list says (issue 1458)", () => {
  it("every page the sitemap names is on the list, so dropping one needs a 301 or 410", () => {
    expect(unlisted(sitemapPaths())).toEqual([]);
    expect(unlisted([...sitemapPaths(), "/compare/a-later-tool"])).toEqual(["/compare/a-later-tool"]);
  });

  it("the list holds the issue's addresses, the eight old reports and their cards", () => {
    expect(Object.keys(PATHS).length).toBeGreaterThanOrEqual(103);
    expect(Object.keys(PATHS).filter((p) => p.startsWith("/r/"))).toHaveLength(17);
  });

  for (const [pathname, expected] of Object.entries(PATHS)) {
    if (expected.status === 200) {
      it(`${pathname} → 200`, () => {
        // Served where it is, or from another of our addresses at this one.
        const moved = movedAnswer(pathname);
        const target = moved !== null && moved.status === 200 ? moved.rewrite : pathname;
        expect(moved === null || moved.status === 200, `${pathname} is moved`).toBe(true);
        expect(served(target), `no page, route or file serves ${pathname}`).toBe(true);
      });
    } else if (expected.status === 301) {
      it(`${pathname} → 301 ${expected.location}`, async () => {
        const res = await middleware(new NextRequest(new URL(pathname, "http://localhost")));
        expect(res.status).toBe(301);
        expect(new URL(res.headers.get("location") ?? "").pathname).toBe(expected.location);
        // A move lands on an address that is served, never on a 404.
        expect(served(expected.location), `${expected.location} is not served`).toBe(true);
      });
    } else {
      it(`${pathname} → 410`, async () => {
        const res = await middleware(new NextRequest(new URL(pathname, "http://localhost")));
        if (pathname !== "/gone") {
          expect(new URL(res.headers.get("x-middleware-rewrite") ?? "").pathname).toBe("/gone");
        }
        const { GET } = await import("@/app/(public)/gone/route");
        expect(GET().status).toBe(410);
      });
    }
  }

  it("an old address on a customer's own domain is theirs, and is not moved", async () => {
    // `/contact` moves on ReachKit's host only: the hosted edge decides a
    // customer's host before the list is read.
    const res = await middleware(
      new NextRequest(new URL("/contact", "http://localhost"), { headers: { host: "blog.customer.test" } })
    );
    expect(res.status).not.toBe(301);
  });
});
