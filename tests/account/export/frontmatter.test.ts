// tests/account/export/frontmatter.test.ts — REQ-078 c3, c4
//
// The written-file half of criterion 4, and criterion 3's "readable without
// ReachKit": the five fields per file, explicit nulls where they do not
// apply, and a body that is the stored `body_md` and nothing else.
import { describe, expect, it } from "vitest";
import { frontmatter, pageFile } from "@/lib/account/export/frontmatter";
import type { ExportManifestPage } from "@/lib/account/export";

function entry(a: Partial<ExportManifestPage> = {}): ExportManifestPage {
  return {
    path: "pages/a-page.md",
    draftId: "draft-1",
    title: "A page",
    state: "published",
    publishedAt: new Date("2026-09-02T09:00:00.000Z"),
    liveUrl: "https://content.example.com/a-page",
    unpublishedAt: null,
    assets: [],
    ...a,
  };
}

describe("REQ-078 c4 — each file carries title, state, publish date, live URL and take-down date", () => {
  it("all five fields are present on a published page", () => {
    const block = frontmatter(entry());
    expect(block).toContain('title: "A page"');
    expect(block).toContain('state: "published"');
    expect(block).toContain('published_at: "2026-09-02T09:00:00.000Z"');
    expect(block).toContain('live_url: "https://content.example.com/a-page"');
    expect(block).toContain("unpublished_at: null");
  });

  it("where the page is no longer published, the file carries the date it was taken down", () => {
    expect(frontmatter(entry({ unpublishedAt: new Date("2026-09-05T09:00:00.000Z") }))).toContain(
      'unpublished_at: "2026-09-05T09:00:00.000Z"'
    );
  });

  it("a never-published page carries explicit nulls, not absent fields", () => {
    const block = frontmatter(
      entry({ state: "in_review", publishedAt: null, liveUrl: null, unpublishedAt: null })
    );
    expect(block).toContain("published_at: null");
    expect(block).toContain("live_url: null");
    expect(block).toContain("unpublished_at: null");
  });

  it("a title carrying a colon, a quote or a newline cannot break the block", () => {
    const block = frontmatter(entry({ title: 'Why: "this" works\nreally' }));
    const lines = block.split("\n");
    expect(lines.filter((line) => line === "---")).toHaveLength(2);
    expect(block).toContain(JSON.stringify('Why: "this" works\nreally'));
  });
});

describe("REQ-078 c3 — nothing in a file body was re-rendered", () => {
  it("the body is the stored body_md, byte for byte, after the block", () => {
    const body = "# Heading\n\nSome *stored* markdown, with {braces} and <html>.\n";
    const file = pageFile(entry(), body);
    expect(file.endsWith(body)).toBe(true);
    expect(file.slice(0, file.length - body.length)).toBe(frontmatter(entry()));
  });
});
