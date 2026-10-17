// tests/generate/live-recheck.test.ts — SPEC §7 (issue 1485): a live page
// written before the rival rules is read again from its own row, at 0¢, and
// withdrawn through `unpublish()` when it fails them.
//
// What a reader would notice if it broke: profound-alternatives still live
// with Profound's free trial as the product and "no free tier" in its FAQ —
// or a true page taken down.
import "./env";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  RIVAL_SCOPE_VERSION,
  recheckLivePage,
  storedLivePage,
  withdrawFailingPages,
  type StoredLivePage,
} from "../../src/lib/generate/live-recheck";

/** The two rows as production stored them on 2026-10-17. */
const STORED = JSON.parse(readFileSync(path.join(__dirname, "live-rival-pages-1485.json"), "utf8")) as {
  pages: { draftId: string; liveUrl: string; markdown: string; meta: Record<string, unknown> }[];
};
const [PROFOUND, AEO] = STORED.pages.map((row) => storedLivePage({ ...row, competitors: [] })!) as [StoredLivePage, StoredLivePage];

describe("the live pages, re-read from their rows", () => {
  it("profound-alternatives fails both: a reviewer's $99 beside Profound's own page, and a denial no source makes", () => {
    const failed = recheckLivePage(PROFOUND);
    expect(failed.map((failure) => failure.rule)).toEqual(["rival_source", "rival_negative"]);
    expect(failed[0]!.detail).toMatchObject({ fault: "third_party" });
    expect(failed[0]!.detail).toHaveProperty("sentence", expect.stringContaining("Profound's entry package starts at $99"));
    // The FAQ alone is enough: "Profound and Otterly do not list a free tier".
    expect(recheckLivePage({ ...PROFOUND, markdown: "" })).toEqual([
      { rule: "rival_negative", detail: { rule: "rival_negative", sentence: expect.stringContaining("do not list a free tier") } },
    ]);
  });

  it("the trial's prompts, stated as the product, fail its plan", () => {
    // Profound's pricing-page line was recorded before plans were: it names
    // no plan, so no sentence can state it truthfully.
    const sentence = "Profound runs [50 prompts run daily for 7 days](https://www.tryprofound.com/pricing).";
    expect(recheckLivePage({ ...PROFOUND, markdown: sentence, faq: [] })[0]?.detail).toMatchObject({ rule: "rival_source", fault: "plan" });
  });

  it("a live page whose rival claims hold stays live", () => {
    expect(recheckLivePage(AEO)).toEqual([]);
  });

  it("a page the customer edited, or one the rules read when it was written, is not read again", () => {
    const row = STORED.pages[0]!;
    expect(storedLivePage({ ...row, meta: { ...row.meta, first_edited_at: "2026-10-15T09:00:00Z" }, competitors: [] })).toBeNull();
    expect(storedLivePage({ ...row, meta: { ...row.meta, rivalScope: RIVAL_SCOPE_VERSION }, competitors: [] })).toBeNull();
  });

  it("each failing address is withdrawn, every live version of it, and a page that holds is left alone", async () => {
    const taken: string[] = [];
    const outcome = await withdrawFailingPages({
      now: new Date("2026-10-17T19:00:00Z"),
      deps: {
        livePages: async () => [{ ...PROFOUND, olderVersions: ["older-version"] }, AEO],
        withdraw: async (draftId) => {
          taken.push(draftId);
          return true;
        },
      },
    });
    expect(taken).toEqual([PROFOUND.draftId, "older-version"]);
    expect(outcome).toEqual({
      checked: 2,
      withdrawn: [{ draftId: PROFOUND.draftId, liveUrl: "https://content.reachkit.app/profound-alternatives", rules: ["rival_source", "rival_negative"] }],
      stillLive: [],
    });
  });

  it("a withdrawal that does not complete leaves the page on the list for the next tick", async () => {
    const outcome = await withdrawFailingPages({
      now: new Date("2026-10-17T19:00:00Z"),
      deps: { livePages: async () => [PROFOUND], withdraw: async () => false },
    });
    expect(outcome.withdrawn).toEqual([]);
    expect(outcome.stillLive).toEqual(["https://content.reachkit.app/profound-alternatives"]);
  });
});
