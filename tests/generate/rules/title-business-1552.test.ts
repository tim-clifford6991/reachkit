// tests/generate/rules/title-business-1552.test.ts — SPEC §7 (issue 1552,
// condition 1; the owner: "some of the scheduled pages are competitor vs
// competitor and do not, at least in the title, talk about reachkit"): a
// page whose search compares products names the business in its title.
// The titles are reachkit.app's scheduled drafts of 18–19 October, and the
// same shape on a local and a shop site of the customer panel.
import "../env";
import { describe, expect, it } from "vitest";
import { titleBrief, titleRuleFor } from "../../../src/lib/generate/pipeline/title";
import { checkTitle, pickTitle, titleFaults } from "../../../src/lib/generate/rules/title";
import type { ContextPack } from "../../../src/lib/generate/pipeline/pack";
import { pack } from "../fixtures";

const DESCRIPTION =
  "Peec AI and Otterly compared on price, engines covered and who each suits, with ReachKit beside them and the pages each was read from.";

function comparing(a: { name: string; domain: string; rivals: string[]; search: string; type?: ContextPack["type"]; language?: "de" }): ContextPack {
  const base = pack();
  return pack({
    type: a.type ?? "listicle",
    target: { question: a.search, searches: [a.search] },
    business: { ...base.business, name: a.name, domain: a.domain, market: { rivals: a.rivals.map((name) => ({ name })) } },
    ...(a.language === undefined ? {} : { locale: { country: "DE", language: a.language } as ContextPack["locale"] }),
  });
}

const reachkit = (search: string, type?: ContextPack["type"]) =>
  titleRuleFor(comparing({ name: "ReachKit", domain: "reachkit.app", rivals: ["Profound", "Peec AI", "Otterly"], search, ...(type === undefined ? {} : { type }) }), {
    description: DESCRIPTION,
  });

describe("a comparison's title names the business (issue 1552)", () => {
  it("SaaS: reachkit.app's \"Peec AI vs Otterly\" draft fails; the same with ReachKit as the third name passes", () => {
    const rule = reachkit("peec ai vs otterly");
    expect(titleFaults("Peec AI vs Otterly (2026): $29 a month separates them", rule)).toContain("business");
    expect(titleFaults("Peec AI vs Otterly vs ReachKit (2026): which fits founders", rule)).not.toContain("business");
    expect(checkTitle({ title: "Peec AI vs Otterly (2026): $29 a month separates them", rule })).toMatchObject({
      detail: { faults: expect.arrayContaining(["business"]) },
    });
  });

  it("whatever the page's type, where the search names a rival: never on the business's own search or a category's", () => {
    expect(titleFaults("Profound vs Otterly: what each tracks in AI answers", reachkit("profound vs otterly", "qa"))).toContain("business");
    expect(titleFaults("Profound vs Otterly, and how ReachKit compares", reachkit("profound vs otterly", "qa"))).not.toContain("business");
    expect(titleFaults("Peec AI alternatives: which get you named in AI answers", reachkit("peec ai alternatives", "qa"))).toContain("business");
    // The business's own search names it already, and a comparison of
    // category terms, or no comparison, names no product.
    expect(titleFaults("ReachKit vs Profound: what $29 a month buys", reachkit("reachkit vs profound"))).not.toContain("business");
    expect(titleFaults("GEO vs SEO: what changes when AI answers", reachkit("geo vs seo", "qa"))).not.toContain("business");
    expect(titleFaults("Generative engine optimization tools compared", reachkit("generative engine optimization tools"))).not.toContain("business");
  });

  it("local and shop sites, in English and German, are held to it the same way", () => {
    const plumber = titleRuleFor(
      comparing({ name: "Austin Plumbery", domain: "austinplumbery.com", rivals: ["Radiant Plumbing", "Reliant Plumbing"], search: "radiant plumbing vs reliant plumbing" }),
      { description: DESCRIPTION }
    );
    expect(titleFaults("Radiant Plumbing vs Reliant Plumbing in Austin", plumber)).toContain("business");
    expect(titleFaults("Radiant Plumbing vs Reliant Plumbing vs Austin Plumbery", plumber)).not.toContain("business");
    const tattoos = titleRuleFor(comparing({ name: "Tattly", domain: "tattly.com", rivals: ["Inkbox", "EasyTatt"], search: "inkbox alternatives" }), {
      description: DESCRIPTION,
    });
    expect(titleFaults("Inkbox alternatives: temporary tattoos that last", tattoos)).toContain("business");
    expect(titleFaults("Inkbox alternatives: Tattly and 4 other temporary tattoos", tattoos)).not.toContain("business");
    const bakery = titleRuleFor(
      comparing({ name: "Bäckerei Hinkel", domain: "baeckerei-hinkel.de", rivals: ["Zeit für Brot", "Bäckerei Bulle"], search: "zeit für brot alternative", language: "de" }),
      { description: DESCRIPTION }
    );
    expect(titleFaults("Zeit für Brot Alternative in Düsseldorf", bakery)).toContain("business");
    expect(titleFaults("Zeit für Brot Alternative: Bäckerei Hinkel in Düsseldorf", bakery)).not.toContain("business");
  });

  it("code picks the title that names the business, and the writer is told to", () => {
    const rule = reachkit("peec ai vs otterly");
    const picked = pickTitle(["Peec AI vs Otterly (2026): $29 a month separates them", "Peec AI vs Otterly vs ReachKit (2026): which fits founders"], rule);
    expect(picked.chosen).toBe("Peec AI vs Otterly vs ReachKit (2026): which fits founders");
    const brief = titleBrief(comparing({ name: "ReachKit", domain: "reachkit.app", rivals: ["Peec AI", "Otterly"], search: "peec ai vs otterly" }));
    expect((brief.rules as string[]).join(" ")).toContain('"ReachKit"');
  });

  it("a pack with no domain names the business by its name, and with neither the rule does not apply, never a throw", () => {
    const base = comparing({ name: "ReachKit", domain: "reachkit.app", rivals: ["Peec AI", "Otterly"], search: "peec ai vs otterly" });
    const nameOnly = { ...base, business: { ...base.business, domain: undefined } } as unknown as ContextPack;
    expect(titleFaults("Peec AI vs Otterly (2026): $29 a month separates them", titleRuleFor(nameOnly, { description: DESCRIPTION }))).toContain("business");
    expect((titleBrief(nameOnly).rules as string[]).join(" ")).toContain('"ReachKit"');
    const unnamed = { ...base, business: { ...base.business, name: undefined, domain: undefined } } as unknown as ContextPack;
    expect(titleRuleFor(unnamed, { description: DESCRIPTION }).business).toBeUndefined();
    expect(() => titleBrief(unnamed)).not.toThrow();
  });
});
