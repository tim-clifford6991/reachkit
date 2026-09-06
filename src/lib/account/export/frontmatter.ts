// BUILD §4.7, §9 — what each page's file says about itself.
//
// REQ-078 criterion 4: a published page's file carries "the page's title,
// its publish date and the URL it was published at; and where the page is no
// longer published, the file says so and carries the date it was taken
// down." Five fields, written on every page, with **explicit nulls** where
// one does not apply — a file whose `live_url` is missing would read as an
// omission, and a customer cannot tell an omission from a page that was
// never published.
//
// **The body is the stored `body_md`, byte for byte.** Nothing here
// regenerates, re-renders or model-touches a page at export time: a copy
// that differs from what was published is a defect, and the way to keep it
// from happening is for this file to hold no renderer at all.
//
// These are YAML front-matter field names, not sentences — the file is read
// by the customer's own tools, and `title:` is the key those tools expect,
// not something ReachKit says. The one piece of the customer's own text this
// file writes is the title, and it is quoted rather than interpolated raw so
// a title containing a colon or a newline cannot break the block.
import type { ExportManifestPage } from "./manifest";

function quote(value: string): string {
  return JSON.stringify(value);
}

function isoOrNull(at: Date | null): string {
  return at === null ? "null" : quote(at.toISOString());
}

export function frontmatter(page: ExportManifestPage): string {
  return [
    "---",
    `title: ${quote(page.title)}`,
    `state: ${quote(page.state)}`,
    `published_at: ${isoOrNull(page.publishedAt)}`,
    `live_url: ${page.liveUrl === null ? "null" : quote(page.liveUrl)}`,
    `unpublished_at: ${isoOrNull(page.unpublishedAt)}`,
    "---",
    "",
  ].join("\n");
}

/** One page's whole file: its front matter, then its stored body unchanged. */
export function pageFile(page: ExportManifestPage, bodyMd: string): string {
  return `${frontmatter(page)}${bodyMd}`;
}
