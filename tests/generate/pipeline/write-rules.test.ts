// Issue 2378 conditions 3, 4 and 6: the writer and the fix call are told the hard rules the battery will ask of the
// page, each once, from `RULE_BRIEF`, and no rule the battery leaves off. 0¢: the model is doubled.
import "../env";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { ContextPack } from "@/lib/generate/pipeline/pack";
import type { WriteInputs } from "@/lib/generate/pipeline/write";
import { TEMPLATES } from "@/lib/generate/templates";
import { pageTypeOf } from "@/lib/opportunities/page-type";
import { AT, fakeCost, opportunity, pack, pageParts } from "../fixtures";

const { llmMock } = vi.hoisted(() => ({ llmMock: vi.fn() }));
vi.mock("@/lib/llm", () => ({ llm: llmMock }));
const { fixPage, writePage } = await import("@/lib/generate/pipeline/write");
const { batteryBasis, batteryInputs } = await import("@/lib/generate/pipeline/battery");
const { rulesAsked } = await import("@/lib/generate/rules");
const { briefLinesOf, writerAsked } = await import("@/lib/generate/rules/brief-lines");

type Told = { rules: string[]; titleRules: { rules: string[] } };
llmMock.mockResolvedValue({ kind: "measured", value: pageParts(), at: AT });
const told = async (a: WriteInputs): Promise<Told> => {
  await writePage(fakeCost(), a);
  return llmMock.mock.calls.at(-1)![1].input as Told;
};
const writing = (p: ContextPack, over: Partial<WriteInputs> = {}): WriteInputs => ({ template: TEMPLATES[p.type], pack: p, pageType: "answer", length: { floor: 0, ceiling: 1200 }, ...over });
const panel = (domain: string): ContextPack => JSON.parse(readFileSync(`docs/walk/prose-gate/${domain}.pack.json`, "utf8")) as ContextPack;

describe("the writer is told exactly the rules the battery asks", () => {
  it("states each asked rule's lines once, the title's in `titleRules` alone, and no switched-off rule", async () => {
    const a = writing(pack({ type: "qa", neverClaim: ["the cheapest in town"] }));
    const input = await told(a);
    const asked = writerAsked(a);
    for (const rule of asked.filter((each) => each !== "title")) {
      for (const each of briefLinesOf(rule, a)) expect(input.rules.filter((said) => said === each), rule).toHaveLength(1);
    }
    for (const each of input.titleRules.rules) expect(input.rules).not.toContain(each);
    expect(asked).toEqual(expect.arrayContaining(["distinct_headings", "do_not_claim"]));
    // A switched-off rule has no line: no honest row off a comparison, no demo text with no phrases, no fit check off a listicle.
    expect(asked).not.toContain("honest_row");
    expect(input.rules.join("\n")).not.toMatch(/demo, example and menu lines|An unsupported claim|`honesty` holds/);
  });

  it("names the site's demo phrases to the writer, and gives a site with none no line", async () => {
    const phrases = ["Demo data · An example business", "Try the sample report for free"];
    const input = await told(writing(pack(), { demoPhrases: phrases }));
    for (const phrase of phrases) expect(input.rules.join("\n")).toContain(phrase);
    expect((await told(writing(pack(), { demoPhrases: [] }))).rules.join("\n")).not.toContain("demo, example and menu lines");
  });

  it("asks the same rules the battery asks of the page as written", () => {
    for (const domain of ["baeckerei-hinkel.de", "wesbos.com"]) {
      const p = panel(domain);
      const site = { businessName: p.business.name ?? null, domain, doNotClaim: [...p.neverClaim], rivals: [] };
      const grounding = { fact: { ...p.facts[0]!, readAt: new Date(p.facts[0]!.readAt) }, sourceText: p.facts[0]!.passage };
      const b = batteryBasis({ pack: p, opportunity: opportunity({ type: "keyword_page", targetQuery: p.target.question, pageType: null }), site, facts: [grounding], grounding });
      const inputs = batteryInputs(b, { title: "", heading: "", description: "", sections: [], faq: [] }, "", { published: [], measured: [], queued: [] });
      expect(writerAsked(writing(p, { pageType: b.pageType })), domain).toEqual(rulesAsked(inputs, { fit: { state: "passed" }, fitAsked: inputs.knowledge !== undefined }));
    }
  });

  it("tells the fix call every rule it tells the write", async () => {
    const a = writing(pack({ type: "listicle" }), { pageType: "market_comparison", demoPhrases: ["Demo data · An example business"] });
    const written = (await told(a)).rules;
    await fixPage(fakeCost(), { ...a, parts: pageParts(), fix: [] });
    expect((llmMock.mock.calls.at(-1)![1].input as Told).rules).toEqual(written);
    expect(llmMock.mock.calls.slice(-2).map((call) => call[1].site)).toEqual(["generate.write", "generate.fix"]);
  });
});

describe("the writer's prompt over the panel packs", () => {
  for (const domain of ["baeckerei-hinkel.de", "wesbos.com"]) {
    it(domain, async () => {
      const p = panel(domain);
      const a = writing(p, { pageType: pageTypeOf({ type: "keyword_page", targetQuery: p.target.question }) });
      const input = await told(a);
      const out = [`# ${domain}: ${p.type}, "${p.target.question}": each rule asked, as the writer is told it`, ""];
      for (const rule of writerAsked(a)) out.push(`- ${rule}: ${rule === "title" ? "in `titleRules`" : briefLinesOf(rule, a).join(" ")}`);
      out.push("", "## titleRules", ...input.titleRules.rules.map((each) => `- ${each}`), "");
      await expect(out.join("\n")).toMatchFileSnapshot(`../../golden/writer/${domain}.prompt.md`);
    });
  }
});
