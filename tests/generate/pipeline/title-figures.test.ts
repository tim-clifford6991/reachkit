// SPEC §7 title specific: an informational page's title carries the page's own
// evidence, never the business's promise; the offering page still may. No model.
import "../env";
import { describe, expect, it } from "vitest";
import { titleBrief, titleRuleFor } from "../../../src/lib/generate/pipeline/title";
import type { ContextPack } from "../../../src/lib/generate/pipeline/pack";
import { pickTitle, titleFaults } from "../../../src/lib/generate/rules/title";
import { pack } from "../fixtures";
import stored from "../fixtures/dogfood-promise-titles-2026-10.json";
import type { ContentType } from "../../../src/lib/opportunities/content-type";

const PROMISE = /7 pages a week/;
const draft = (type: string) => stored.drafts.find((row) => row.pack.type === type)!;
const ruleOf = (row: (typeof stored.drafts)[number], type?: ContentType) =>
  titleRuleFor({ ...(row.pack as unknown as ContextPack), ...(type === undefined ? {} : { type }) }, row);

describe("the stored dogfood drafts that chose a promise title", () => {
  it.each(stored.drafts.map((row) => [row.pack.type, row] as const))("on the %s page, what the title may hold carries no promise", (_, row) => {
    expect(ruleOf(row).holds).not.toMatch(PROMISE);
  });

  it.each(["how_to", "documentation"])("the %s page no longer picks it", (type) => {
    const row = draft(type);
    expect(row.title).toMatch(PROMISE);
    expect(pickTitle(row.titles.map((each) => each.title), ruleOf(row)).chosen).not.toMatch(PROMISE);
  });

  it("on the Q&A page, a title whose figure is the promise has no specific, though a rival claims 7 engines", () => {
    const row = draft("qa");
    expect(row.pack.claims.map((claim) => claim.passage)).toContain("Tracks all 7 major AI search engines.");
    for (const title of ["AI search visibility tool: up to 7 pages a week", "Ai search tracking app: up to 7 pages a week live"]) {
      expect(titleFaults(title, ruleOf(row))).toContain("specific");
    }
  });

  it("the same pack as an offering page still holds the promise as its figure", () => {
    const row = draft("documentation");
    expect(ruleOf(row, "offering").holds).toMatch(PROMISE);
    expect(titleFaults(row.title, ruleOf(row, "offering"))).not.toContain("specific");
  });
});

// A local business: its promise is a figure the brief lists, so the brief itself is held to it.
const PROMISE_24 = "Our plumbers answer 24/7 and reach you in 2 hours.";
const plumber = (type: ContentType) =>
  pack({ type, facts: [{ ...pack().facts[0]!, passage: PROMISE_24 }], profile: { job: null, products: [], audience: [], promises: [PROMISE_24], vocabulary: [] } });

describe("a plumber's title brief", () => {
  it("offers no promise figure on a Q&A page", () => {
    expect((titleBrief(plumber("qa")).figures as string[]).join("\n")).not.toMatch(/24\/7/);
    expect(titleFaults("Boiler noises: why they happen, fixed 24/7 in 2 hours", titleRuleFor(plumber("qa"), { description: "" }))).toContain("specific");
  });

  it("still offers it on the offering page", () => {
    expect((titleBrief(plumber("offering")).figures as string[]).join("\n")).toMatch(/24\/7/);
  });
});
