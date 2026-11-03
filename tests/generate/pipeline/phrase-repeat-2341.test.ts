// Issue 2341: a phrase said more often than the prose check allows is repaired in code: the later sentences that
// carry it go, the first ones and the opening stay, and the battery reads the result again. On stored panel pages of a
// local service and a seller, each with its own tagline said three times. 0¢: no model is asked.
import "../env";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ContextPack } from "../../../src/lib/generate/pipeline/pack";
import { batteryBasis, batteryInputs, checkPage } from "../../../src/lib/generate/pipeline/battery";
import { repairMechanical } from "../../../src/lib/generate/pipeline/repair";
import { runHardRules, type BatteryOutcome } from "../../../src/lib/generate/rules";
import { checkProse } from "../../../src/lib/generate/rules/prose";
import { setGenerateStore } from "../../../src/lib/generate/store";
import { SITE_ID, emptyComparison, fakeCost, memoryStore, opportunity } from "../fixtures";

const STORED = new URL("../../../docs/walk/prose-gate/", import.meta.url);
const failedRules = (outcome: BatteryOutcome): string[] => (outcome.passed ? [] : outcome.failed.map((failure) => failure.rule).sort());

beforeEach(() => setGenerateStore(memoryStore()));
afterEach(() => setGenerateStore(null));

describe.each([
  ["local service", "alexander.co.uk", "a leading independent accountancy firm with offices in Manchester and London", ["Alexander & Co is {}.", "Ask {} before October.", "Only {} checks every figure twice."]],
  ["seller", "baeckerei-hinkel.de", "handwerklich gebackenes Brot aus nur Mehl, Wasser und Salz", ["Bei uns gibt es {}.", "Sauerteig hält {} lange frisch.", "Wer probiert, schmeckt {} sofort."]],
] as const)("a %s's tagline said three times", (_kind, domain, tagline, shapes) => {
  it("fails plain_prose as written, passes it after the repair, and every other rule reads the same", async () => {
    const carriers = shapes.map((shape) => shape.replace("{}", tagline));
    const [heading, ...body] = readFileSync(new URL(`${domain}.md`, STORED), "utf8").trimEnd().split("\n");
    const pack = JSON.parse(readFileSync(new URL(`${domain}.pack.json`, STORED), "utf8")) as ContextPack;
    // One carrier at the end of each of the first three body paragraphs.
    const blocks = body.join("\n").trim().split("\n\n");
    let next = 0;
    const paragraph = (block: string, index: number) => blocks.slice(0, index).some((each) => each.startsWith("## ")) && /^\p{L}/u.test(block) && !block.includes("\n");
    const marked = blocks.map((block, index) => (paragraph(block, index) && next < 3 ? `${block} ${carriers[next++]}` : block)).join("\n\n");
    expect(next).toBe(3);
    const title = heading!.replace(/^#\s+/, "");
    const facts = pack.facts.map((fact) => ({ fact: { url: fact.url, readAt: new Date(fact.readAt), passage: fact.passage }, sourceText: fact.passage }));
    const site = { businessName: pack.business.name ?? null, domain, doNotClaim: [...pack.neverClaim], rivals: [] };
    const basis = batteryBasis({ pack, opportunity: opportunity({ type: "keyword_page", targetQuery: pack.target.question }), site, facts, grounding: facts[0]! });
    const page = { title, heading: title, description: "", sections: [], faq: [] };
    const at = { siteId: SITE_ID, draftId: "d1", comparison: emptyComparison(), fit: { state: "passed" as const } };

    const before = await runHardRules(fakeCost(), batteryInputs(basis, page, marked, at.comparison, false, at.fit));
    const prose = before.passed ? undefined : before.failed.find((failure) => failure.rule === "plain_prose");
    const found = prose?.detail?.rule === "plain_prose" ? prose.detail.faults.flatMap((fault) => fault.found) : [];
    expect(found.some((phrase) => phrase.includes(tagline.toLowerCase().replace(/,/g, "")))).toBe(true);
    const checked = await checkPage(fakeCost(), basis, page, marked, at);
    expect(failedRules(checked.outcome)).toEqual(failedRules(before).filter((rule) => rule !== "plain_prose"));
    expect(checked.repairs).toContainEqual({ rule: "plain_prose", cleared: true });
    // The first saying stays and the third goes (the seller's shorter core, said five times already, takes the second).
    expect([checked.markdown.includes(carriers[0]!), checked.markdown.includes(carriers[2]!)]).toEqual([true, false]);
  });
});

it("the repair drops a later saying, never the opening's, and the check then passes", () => {
  const phrase = "Every return is checked by a qualified accountant before it is filed";
  const opening = `${phrase}, so the deadline is never missed.`;
  const markdown = [opening, "## When is it due?", `The deadline is 31 January. ${phrase} here too.`, "## What does it cost?", `Fees start at £150. ${phrase}, whatever the fee.`].join("\n\n");
  const prose = { language: "en" as const };
  expect(checkProse({ markdown, prose })?.detail).toMatchObject({ faults: [{ tell: "repeated_phrase", found: [phrase.toLowerCase()] }] });
  const repaired = repairMechanical(markdown, ["plain_prose"], { brief: { facts: [], queries: [] }, sources: [], prose });
  expect([repaired.startsWith(opening), repaired.includes("here too."), repaired.includes("whatever the fee"), repaired.includes("Fees start at £150.")]).toEqual([true, true, false, true]);
  expect(checkProse({ markdown: repaired, prose })).toBeNull();
});
