// tests/account/export/summary.test.ts — REQ-078 c1
//
// "Given a customer on Settings, when they open 'Your content', then they
// see how many pages ReachKit has written for them — published, in review,
// vetoed and failed alike."
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { contentSummary, ContentSummaryUnreadable, setExportStore } = await import(
  "@/lib/account/export"
);
const { memoryExportStore, newMemoryExport, page } = await import("./memory-store");

let state = newMemoryExport();

beforeEach(() => {
  state = newMemoryExport();
  setExportStore(memoryExportStore(state));
});

afterEach(() => {
  setExportStore(null);
});

describe("REQ-078 c1 — the count includes published, in review, vetoed and failed", () => {
  it("counts all four states", async () => {
    state.pages.push(
      page({ title: "Live", state: "published" }),
      page({ title: "Waiting", state: "in_review" }),
      page({ title: "Vetoed", state: "skipped" }),
      page({ title: "Failed", state: "failed" })
    );
    expect(await contentSummary("site-1")).toEqual({ pages: 4 });
  });

  it("counts a page that was published and has since been taken down", async () => {
    state.pages.push(page({ title: "Gone", state: "unpublished" }));
    expect(await contentSummary("site-1")).toEqual({ pages: 1 });
  });

  it("a row with no body is an intention, not a page ReachKit wrote", async () => {
    state.pages.push(
      page({ title: "Planned", state: "planned", body_md: null }),
      page({ title: "Written", state: "in_review" })
    );
    expect(await contentSummary("site-1")).toEqual({ pages: 1 });
  });

  it("a site with no pages counts 0, and 0 is a true count rather than an empty state", async () => {
    const answer = await contentSummary("site-1");
    expect(answer).toEqual({ pages: 0 });
    expect(typeof answer.pages).toBe("number");
  });
});

describe("BP-062 decision 3 — a plain number, never a Measured<T>", () => {
  it("summary.ts names no Measured symbol in code — the prose above it may explain why", () => {
    const source = readFileSync(
      path.resolve(import.meta.dirname, "../../../src/lib/account/export/summary.ts"),
      "utf8"
    );
    // Comments are stripped first: the header states the decision, and a
    // sweep that forbade the word outright would forbid recording why.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/\bMeasured\b/);
  });

  it("an unreadable store is refused rather than answered with a zero — the discriminating case", async () => {
    state.unreadable = true;
    await expect(contentSummary("site-1")).rejects.toBeInstanceOf(ContentSummaryUnreadable);
  });
});
