// tests/generate/rules/title-figure-owner.test.ts — SPEC §7 (seo-master, 2026-10-31): a title that names a rival
// states a figure only where that rival's own pages hold it, or the business's own where the title names the business
// too. Read on the stored dogfood packs, in English and German, at 0¢.
import "../env";
import { describe, expect, it } from "vitest";
import type { ContextPack } from "../../../src/lib/generate/pipeline/pack";
import { titleRuleFor } from "../../../src/lib/generate/pipeline/title";
import { checkTitle, pickTitle, titleFaults } from "../../../src/lib/generate/rules/title";
import stored from "../fixtures/dogfood-drafts-2026-10.min.json";

const packOf = (id: string): ContextPack => (stored.drafts.find((each) => each.id.startsWith(id))!.meta as unknown as { pack: ContextPack }).pack;
const ruleOf = (pack: ContextPack) => titleRuleFor(pack, { description: "" });
const german = (pack: ContextPack): ContextPack => ({ ...pack, locale: { country: "DE", language: "de" } as ContextPack["locale"] });

describe("a figure beside a rival's name is that rival's own (figure_owner)", () => {
  it.each([
    ["English", packOf("a71279ff"), "Profound answer engine optimization: 12 Google searches weekly"],
    ["German", german(packOf("a71279ff")), "Profound Antwortmaschinen-Optimierung: 12 Google-Suchen pro Woche"],
  ])("%s: the business's own figure given to a rival stops the page, settled or not", (_, pack, title) => {
    expect(titleFaults(title, ruleOf(pack))).toContain("figure_owner");
    expect(checkTitle({ title, rule: { ...ruleOf(pack), settled: true } })).toMatchObject({ detail: { faults: expect.arrayContaining(["figure_owner"]) } });
  });

  it.each([
    ["a rival's own figure beside its name", "a71279ff", "Profound answer engine optimization: up to 9 answer engines"],
    ["each figure beside the owner the title names", "b8c28f61", "Otterly vs ReachKit (2026): $29 a month vs €49 a month"],
    ["a title that names no rival", "a71279ff", "Answer engine optimization: 12 Google searches weekly"],
  ])("%s passes", (_, id, title) => {
    expect(titleFaults(title, ruleOf(packOf(id)))).not.toContain("figure_owner");
  });

  it("at generation, the picker takes a title without the misplaced figure over one with it", () => {
    const owned = "Profound answer engine optimization: up to 9 answer engines";
    expect(pickTitle(["Profound answer engine optimization: 12 Google searches weekly", owned], ruleOf(packOf("a71279ff"))).chosen).toBe(owned);
  });
});
