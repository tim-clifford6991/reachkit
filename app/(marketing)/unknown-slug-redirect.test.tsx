/**
 * Class guard — a dynamic marketing [slug] page must handle an unknown slug with
 * redirect(), NEVER notFound().
 *
 * Under Next 16 Cache Components, notFound() on the on-demand-params render path
 * throws "Invalid revalidate configuration provided: 0 < 1" (a 500) BEFORE the
 * not-found boundary can render a 404 — live-hit on /teardowns/notion (#86) and
 * again on /compare/null (bot probe, 2026-07-27). `dynamicParams = false` is not
 * an option (segment-config exports are rejected under cacheComponents), so the
 * fix for the whole class is redirect() to the section hub.
 *
 * This test drives the REAL page components with an unknown slug and asserts they
 * redirect (not notFound, not render). Mutation-proof: revert either page to
 * notFound() and the redirect assertion fails. New dynamic marketing [slug] route
 * → add it here.
 */

import { describe, it, expect, vi } from "vitest";

// Distinguish the two aborts the way Next does: redirect() and notFound() both
// throw. Tag each so we can assert WHICH one fired.
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    const e = new Error(`NEXT_REDIRECT:${path}`) as Error & { __redirect: string };
    e.__redirect = path;
    throw e;
  },
  notFound: () => {
    const e = new Error("NEXT_NOT_FOUND") as Error & { __notFound: true };
    e.__notFound = true;
    throw e;
  },
}));

import ComparePage from "./compare/[slug]/page";
import { COMPARE_SLUGS } from "./compare/compare-content";
import TeardownPage from "./teardowns/[slug]/page";
import { teardownSlugs } from "@/content/teardowns";

const call = (Page: (p: { params: Promise<{ slug: string }> }) => Promise<unknown>, slug: string) =>
  Page({ params: Promise.resolve({ slug }) });

describe("dynamic marketing [slug] — unknown slug redirects, never 500s", () => {
  it("/compare/<unknown> redirects to the /compare hub (not notFound, not render)", async () => {
    await expect(call(ComparePage, "null")).rejects.toMatchObject({ __redirect: "/compare" });
  });

  it("/compare/<known> renders (guard isn't just always-redirect)", async () => {
    const known = COMPARE_SLUGS[0];
    expect(known).toBeTruthy();
    const el = await call(ComparePage, known as string);
    expect(el).toBeTruthy();
  });

  it("/teardowns/<unknown> redirects (not notFound, not render)", async () => {
    await expect(call(TeardownPage, "null")).rejects.toMatchObject({ __redirect: "/" });
  });

  it("/teardowns/<known> renders (guard isn't just always-redirect)", async () => {
    const known = teardownSlugs[0];
    expect(known).toBeTruthy();
    const el = await call(TeardownPage, known as string);
    expect(el).toBeTruthy();
  });
});
