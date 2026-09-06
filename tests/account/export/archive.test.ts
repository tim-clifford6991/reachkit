// tests/account/export/archive.test.ts — REQ-078 c3, c5
//
// c3: "it contains every page ReachKit wrote for them — published, in
// review, vetoed and failed alike — as Markdown files with their assets,
// readable without ReachKit."
// c5: "they are told so in one written line and are not given a partial
// archive presented as complete."
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { exportEverything, setAssetSource, setExportStore } = await import("@/lib/account/export");
const { memoryExportStore, newMemoryExport, page, publication } = await import("./memory-store");
const { drain, unzip } = await import("./unzip");

let state = newMemoryExport();

beforeEach(() => {
  state = newMemoryExport();
  setExportStore(memoryExportStore(state));
});

afterEach(() => {
  setExportStore(null);
  setAssetSource(null);
  vi.useRealTimers();
});

async function archiveOf(siteId = "site-1"): Promise<Map<string, string>> {
  const result = await exportEverything(siteId);
  if (!result.ok) throw new Error(`expected an archive, got ${result.reason}`);
  const decoder = new TextDecoder();
  return new Map(
    unzip(await drain(result.archive)).map((entry) => [entry.path, decoder.decode(entry.bytes)])
  );
}

describe("REQ-078 c3 — every page, in every state, as Markdown", () => {
  it("all four states appear as Markdown files, readable without ReachKit", async () => {
    state.pages.push(
      page({ id: "a", title: "Live", state: "published", created_at: "2026-09-01T00:00:00.000Z" }),
      page({ id: "b", title: "Waiting", state: "in_review", created_at: "2026-09-02T00:00:00.000Z" }),
      page({ id: "c", title: "Vetoed", state: "skipped", created_at: "2026-09-03T00:00:00.000Z" }),
      page({ id: "d", title: "Failed", state: "failed", created_at: "2026-09-04T00:00:00.000Z" })
    );
    const files = await archiveOf();
    expect([...files.keys()].sort()).toEqual([
      "manifest.json",
      "pages/failed.md",
      "pages/live.md",
      "pages/vetoed.md",
      "pages/waiting.md",
    ]);
  });

  it("bodies are byte-identical to the stored body_md", async () => {
    const body = "# Kept\n\nExactly *these* bytes, {braces} and all.\n";
    state.pages.push(page({ id: "a", title: "Kept", body_md: body }));
    expect((await archiveOf()).get("pages/kept.md")?.endsWith(body)).toBe(true);
  });

  it("a published page's file carries its publish date and live URL", async () => {
    state.pages.push(page({ id: "a", title: "Live", state: "published" }));
    state.publications.push(
      publication({
        draft_id: "a",
        live_url: "https://content.example.com/live",
        published_at: "2026-09-02T09:00:00.000Z",
      })
    );
    const file = (await archiveOf()).get("pages/live.md") ?? "";
    expect(file).toContain('published_at: "2026-09-02T09:00:00.000Z"');
    expect(file).toContain('live_url: "https://content.example.com/live"');
  });

  it("a site with no pages yields an archive containing the manifest and no page files", async () => {
    const files = await archiveOf();
    expect([...files.keys()]).toEqual(["manifest.json"]);
    expect(JSON.parse(files.get("manifest.json") ?? "")).toEqual({ pages: [] });
  });

  it("a page's assets are carried at assets/<page-slug>/<file>", async () => {
    state.pages.push(page({ id: "a", title: "With art", meta: { assets: ["one.png"] } }));
    setAssetSource({ async read() { return new Uint8Array([1, 2, 3]); } });
    const result = await exportEverything("site-1");
    if (!result.ok) throw new Error("expected an archive");
    const entry = unzip(await drain(result.archive)).find(
      (row) => row.path === "assets/with-art/one.png"
    );
    expect([...(entry?.bytes ?? [])]).toEqual([1, 2, 3]);
  });

  it("the archive is byte-stable: two runs of the same content produce the same bytes", async () => {
    state.pages.push(page({ id: "a", title: "Stable" }));
    const first = await exportEverything("site-1");
    const second = await exportEverything("site-1");
    if (!first.ok || !second.ok) throw new Error("expected two archives");
    expect([...(await drain(first.archive))]).toEqual([...(await drain(second.archive))]);
  });

  it("the filename and the page count come back with the archive", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-06T12:00:00.000Z"));
    state.pages.push(page({ id: "a", title: "One" }), page({ id: "b", title: "Two" }));
    const result = await exportEverything("site-1");
    expect(result.ok && result.filename).toBe("reachkit-export-2026-09-06.zip");
    expect(result.ok && result.pages).toBe(2);
  });
});

describe("REQ-078 c5 — complete or nothing", () => {
  it("an unreadable asset fails the whole export with export.failed, and the retry fails again", async () => {
    state.pages.push(
      page({ id: "a", title: "Fine" }),
      page({ id: "b", title: "With art", meta: { assets: ["missing.png"] } })
    );
    // Twice: a failure is not a state the second request recovers from.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = await exportEverything("site-1");
      expect(result).toEqual({
        ok: false,
        reason: "asset_unreadable",
        lineKey: "export.failed",
      });
    }
  });

  it("an unreadable record fails the export rather than shipping the pages it could read", async () => {
    state.unreadable = true;
    const result = await exportEverything("site-1");
    expect(result).toEqual({ ok: false, reason: "record_unreadable", lineKey: "export.failed" });
  });

  it("a store that throws is an internal failure, never a half-archive", async () => {
    setExportStore({
      async pages() { throw new Error("boom"); },
      async publications() { throw new Error("boom"); },
    });
    const result = await exportEverything("site-1");
    expect(result).toEqual({ ok: false, reason: "internal", lineKey: "export.failed" });
  });

  it("past the deadline the export fails with timeout and no archive", async () => {
    vi.useFakeTimers();
    setExportStore({
      pages: () => new Promise(() => {}),
      publications: () => new Promise(() => {}),
    });
    const pending = exportEverything("site-1");
    await vi.advanceTimersByTimeAsync(120_000);
    expect(await pending).toEqual({ ok: false, reason: "timeout", lineKey: "export.failed" });
  });

  it("no failure arm carries an archive at all — there is nothing to mistake for a short zip", async () => {
    state.unreadable = true;
    const result = await exportEverything("site-1");
    expect(Object.hasOwn(result, "archive")).toBe(false);
  });
});
