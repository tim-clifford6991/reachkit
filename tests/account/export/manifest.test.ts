// tests/account/export/manifest.test.ts — REQ-078 c1, c4
//
// The manifest half of criterion 4: the four fields exist per page and the
// nulls are explicit. Writing them into each file's front matter is
// `frontmatter.test.ts`.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { buildManifest, ManifestUnreadable, setExportStore } = await import("@/lib/account/export");
const { memoryExportStore, newMemoryExport, page, publication } = await import("./memory-store");

let state = newMemoryExport();

beforeEach(() => {
  state = newMemoryExport();
  setExportStore(memoryExportStore(state));
});

afterEach(() => {
  setExportStore(null);
});

describe("REQ-078 c1 — every state appears", () => {
  it("published, in review, vetoed and failed all carry an entry", async () => {
    state.pages.push(
      page({ id: "a", title: "Live", state: "published", created_at: "2026-09-01T00:00:00.000Z" }),
      page({ id: "b", title: "Waiting", state: "in_review", created_at: "2026-09-02T00:00:00.000Z" }),
      page({ id: "c", title: "Vetoed", state: "skipped", created_at: "2026-09-03T00:00:00.000Z" }),
      page({ id: "d", title: "Failed", state: "needs_attention", created_at: "2026-09-04T00:00:00.000Z" })
    );
    const manifest = await buildManifest("site-1");
    expect(manifest.pages.map((p) => p.state)).toEqual([
      "published",
      "in_review",
      "vetoed",
      "failed",
    ]);
  });
});

describe("REQ-078 c4 — the four fields, and the nulls are explicit", () => {
  it("a published page carries publishedAt and liveUrl", async () => {
    state.pages.push(page({ id: "a", title: "Live", state: "published" }));
    state.publications.push(
      publication({
        draft_id: "a",
        live_url: "https://content.example.com/live",
        published_at: "2026-09-02T09:00:00.000Z",
      })
    );
    const [entry] = (await buildManifest("site-1")).pages;
    expect(entry?.publishedAt).toEqual(new Date("2026-09-02T09:00:00.000Z"));
    expect(entry?.liveUrl).toBe("https://content.example.com/live");
    expect(entry?.unpublishedAt).toBeNull();
  });

  it("a page that is no longer published carries unpublishedAt", async () => {
    state.pages.push(page({ id: "a", title: "Gone", state: "unpublished" }));
    state.publications.push(
      publication({
        draft_id: "a",
        live_url: "https://content.example.com/gone",
        published_at: "2026-09-02T09:00:00.000Z",
        unpublished_at: "2026-09-05T09:00:00.000Z",
      })
    );
    const [entry] = (await buildManifest("site-1")).pages;
    expect(entry?.unpublishedAt).toEqual(new Date("2026-09-05T09:00:00.000Z"));
  });

  it("a never-published page carries three explicit nulls, not absent keys", async () => {
    state.pages.push(page({ id: "a", title: "Waiting", state: "in_review" }));
    const [entry] = (await buildManifest("site-1")).pages;
    for (const key of ["publishedAt", "liveUrl", "unpublishedAt"] as const) {
      expect(Object.hasOwn(entry as object, key), `${key} is an absent key`).toBe(true);
      expect(entry?.[key]).toBeNull();
    }
  });
});

describe("the archive is byte-stable and its names are safe", () => {
  it("the order is created_at ascending and two runs produce an identical manifest", async () => {
    state.pages.push(
      page({ id: "b", title: "Second", created_at: "2026-09-02T00:00:00.000Z" }),
      page({ id: "a", title: "First", created_at: "2026-09-01T00:00:00.000Z" })
    );
    const first = await buildManifest("site-1");
    const second = await buildManifest("site-1");
    expect(first.pages.map((p) => p.title)).toEqual(["First", "Second"]);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("two pages sharing a title get -2, in manifest order", async () => {
    state.pages.push(
      page({ id: "a", title: "Same title", created_at: "2026-09-01T00:00:00.000Z" }),
      page({ id: "b", title: "Same title", created_at: "2026-09-02T00:00:00.000Z" })
    );
    expect((await buildManifest("site-1")).pages.map((p) => p.path)).toEqual([
      "pages/same-title.md",
      "pages/same-title-2.md",
    ]);
  });

  it("a title carrying path separators and dots still yields a safe pages/<slug>.md", async () => {
    state.pages.push(page({ id: "a", title: "../../etc/passwd .. hello" }));
    const [entry] = (await buildManifest("site-1")).pages;
    expect(entry?.path).toBe("pages/etc-passwd-hello.md");
    expect(entry?.title).toBe("../../etc/passwd .. hello");
  });

  it("a title with nothing sluggable in it still gets a file name", async () => {
    state.pages.push(page({ id: "a", title: "—  …  —" }));
    expect((await buildManifest("site-1")).pages[0]?.path).toBe("pages/page.md");
  });

  it("assets are listed as assets/<page-slug>/<file>", async () => {
    state.pages.push(page({ id: "a", title: "With art", meta: { assets: ["one.png", "two.png"] } }));
    expect((await buildManifest("site-1")).pages[0]?.assets).toEqual([
      "assets/with-art/one.png",
      "assets/with-art/two.png",
    ]);
  });

  it("a page declaring no assets carries an empty list, which is every page in this build", async () => {
    state.pages.push(page({ id: "a", title: "Plain" }));
    expect((await buildManifest("site-1")).pages[0]?.assets).toEqual([]);
  });

  it("an unreadable store is refused rather than answered with an empty manifest", async () => {
    state.unreadable = true;
    await expect(buildManifest("site-1")).rejects.toBeInstanceOf(ManifestUnreadable);
  });
});
