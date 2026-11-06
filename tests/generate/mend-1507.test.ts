// tests/generate/mend-1507.test.ts — SPEC §7 (issue 1507): a live page whose
// every defect code repairs is mended through the refresh path at 0¢, as a
// new version that keeps its dates (`dateModified`, `lastmod`). The mend
// itself, under today's battery, is `mend-battery.test.ts`.
import "./env";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { SITE_ID } from "./fixtures";

const { publications } = vi.hoisted(() => ({ publications: [] as unknown[] }));
// The hosted store's one read, answered from `publications` as Postgres
// would: newest first.
vi.mock("@/lib/publish/db", () => {
  const chain: Record<string, unknown> = { then: (resolve: (value: unknown) => unknown) => resolve({ data: publications, error: null }) };
  for (const step of ["from", "select", "eq", "not", "is", "order", "limit"]) chain[step] = () => chain;
  return { publishDb: () => chain };
});

const STORED = JSON.parse(readFileSync(path.join(__dirname, "live-structure-pages-1507.json"), "utf8")) as {
  pages: { draftId: string; liveUrl: string; description: string; markdown: string }[];
};
const B = STORED.pages.find((page) => page.liveUrl.endsWith("/reachkit-vs-aeo-engine"))!;
const WENT_LIVE = new Date("2026-10-05T07:00:04.910Z");

describe("a live page mended through the refresh path", () => {
  it("keeps the version's published and updated dates, so dateModified and lastmod stay", async () => {
    const row = (id: string, publishedAt: string, meta: Record<string, unknown>) => ({
      id,
      site_id: SITE_ID,
      live_url: B.liveUrl,
      published_at: publishedAt,
      mode: "autopilot",
      sites: { domain: "reachkit.app", category: null, timezone: null },
      drafts: { title: "t", body_md: id, attribution: null, meta, dated_as: meta.datedAs ?? null, grounded_fact: null, opportunity_id: "o", opportunities: { id: "o", target_query: "q", scans: null } },
    });
    publications.splice(0, publications.length, row("mended", "2026-11-11T07:00:00.000Z", { datedAs: WENT_LIVE.toISOString() }), row("written", WENT_LIVE.toISOString(), {}));
    const { livePageBySlug, livePagesForSite } = await import("../../src/lib/publish/destinations/hosted/store");
    const [page] = await livePagesForSite(SITE_ID, "content.reachkit.app");
    expect((await livePageBySlug(SITE_ID, B.liveUrl.split("/").pop()!, "content.reachkit.app"))?.page.bodyMd).toBe("mended");
    expect(page?.publishedAt.toISOString()).toBe(WENT_LIVE.toISOString());
    expect(page?.firstPublishedAt.toISOString()).toBe(WENT_LIVE.toISOString());
    // A version the writer changed is dated when it went live, as before.
    publications.splice(0, publications.length, row("refreshed", "2026-11-11T07:00:00.000Z", {}), row("written", WENT_LIVE.toISOString(), {}));
    const [refreshed] = await livePagesForSite(SITE_ID, "content.reachkit.app");
    expect(refreshed?.publishedAt.toISOString()).toBe("2026-11-11T07:00:00.000Z");
  });
});
