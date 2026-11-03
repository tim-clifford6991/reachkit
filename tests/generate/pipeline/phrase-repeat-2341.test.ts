// Issue 2341: a phrase said more often than the prose check allows is
// repaired in code. The later sentences that carry it go, the first ones and
// the opening stay, and the battery reads the result again. Built on stored
// pages of a local service and a seller from the customer panel, each with
// the business's own tagline said three times. 0¢: no model is asked.
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

/** Each business's own line, and three sentences that each carry it. */
const PANEL = [
  {
    kind: "local service",
    domain: "alexander.co.uk",
    tagline: "a leading independent accountancy firm with offices in Manchester and London",
    carriers: [
      "Alexander & Co is a leading independent accountancy firm with offices in Manchester and London.",
      "Ask a leading independent accountancy firm with offices in Manchester and London before October.",
      "Only a leading independent accountancy firm with offices in Manchester and London checks every figure twice.",
    ],
  },
  {
    kind: "seller",
    domain: "baeckerei-hinkel.de",
    tagline: "handwerklich gebackenes Brot aus nur Mehl, Wasser und Salz",
    carriers: [
      "Bei uns gibt es handwerklich gebackenes Brot aus nur Mehl, Wasser und Salz.",
      "Sauerteig hält handwerklich gebackenes Brot aus nur Mehl, Wasser und Salz lange frisch.",
      "Wer probiert, schmeckt handwerklich gebackenes Brot aus nur Mehl, Wasser und Salz sofort.",
    ],
  },
] as const;

const failedRules = (outcome: BatteryOutcome): string[] => (outcome.passed ? [] : outcome.failed.map((failure) => failure.rule).sort());

/** The stored page with one carrier appended to each of its first three body paragraphs. */
function stored(domain: string, carriers: readonly string[]) {
  const [heading, ...body] = readFileSync(new URL(`${domain}.md`, STORED), "utf8").trimEnd().split("\n");
  const pack = JSON.parse(readFileSync(new URL(`${domain}.pack.json`, STORED), "utf8")) as ContextPack;
  const blocks = body.join("\n").trim().split("\n\n");
  let next = 0;
  const marked = blocks
    .map((block, index) => {
      const paragraph = index > 0 && blocks.slice(0, index).some((each) => each.startsWith("## ")) && /^\p{L}/u.test(block) && !block.includes("\n");
      return paragraph && next < carriers.length ? `${block} ${carriers[next++]}` : block;
    })
    .join("\n\n");
  const title = heading!.replace(/^#\s+/, "");
  const site = { businessName: pack.business.name ?? null, domain, doNotClaim: [...pack.neverClaim], rivals: [] };
  const facts = pack.facts.map((fact) => ({ fact: { url: fact.url, readAt: new Date(fact.readAt), passage: fact.passage }, sourceText: fact.passage }));
  const basis = batteryBasis({ pack, opportunity: opportunity({ type: "keyword_page", targetQuery: pack.target.question }), site, facts, grounding: facts[0]! });
  const page = { title, heading: title, description: "", sections: [], faq: [] };
  return { marked, basis, page, inserted: next };
}

beforeEach(() => setGenerateStore(memoryStore()));
afterEach(() => setGenerateStore(null));

describe.each(PANEL)("a $kind's tagline said three times", ({ domain, tagline, carriers }) => {
  it("fails plain_prose as written, passes it after the repair, and every other rule reads the same", async () => {
    const { marked, basis, page, inserted } = stored(domain, carriers);
    expect(inserted).toBe(3);
    const at = { siteId: SITE_ID, draftId: "d1", comparison: emptyComparison(), fit: { state: "passed" as const } };
    const before = await runHardRules(fakeCost(), batteryInputs(basis, page, marked, at.comparison, false, at.fit));
    const prose = before.passed ? undefined : before.failed.find((failure) => failure.rule === "plain_prose");
    const found = prose?.detail?.rule === "plain_prose" ? prose.detail.faults.flatMap((fault) => fault.found) : [];
    expect(found.some((phrase) => phrase.includes(tagline.toLowerCase().replace(/,/g, "")))).toBe(true);

    const checked = await checkPage(fakeCost(), basis, page, marked, at);
    expect(failedRules(checked.outcome)).toEqual(failedRules(before).filter((rule) => rule !== "plain_prose"));
    expect(checked.repairs).toContainEqual({ rule: "plain_prose", cleared: true });
    // The first saying stays and the third goes with its sentence (the
    // seller's shorter core, said five times already, can take the second).
    expect([checked.markdown.includes(carriers[0]), checked.markdown.includes(carriers[2])]).toEqual([true, false]);
  });
});

describe("the repair keeps what the opening says", () => {
  it("drops a later saying, never the opening's, and the check then passes", () => {
    const phrase = "every return is checked by a qualified accountant before it is filed";
    const markdown = [
      `Every return is checked by a qualified accountant before it is filed, so the deadline is never missed.`,
      "## When is it due?",
      `The deadline is 31 January. Every return is checked by a qualified accountant before it is filed here too.`,
      "## What does it cost?",
      `Fees start at £150. Every return is checked by a qualified accountant before it is filed, whatever the fee.`,
      "## What if I am late?",
      "A late return costs £100 at once.",
    ].join("\n\n");
    const prose = { language: "en" as const };
    const failed = checkProse({ markdown, prose });
    expect(failed?.detail).toMatchObject({ faults: [{ tell: "repeated_phrase", found: [phrase] }] });
    const repaired = repairMechanical(markdown, ["plain_prose"], { brief: { facts: [], queries: [] }, sources: [], prose });
    expect(repaired.split("\n\n")[0]).toBe(markdown.split("\n\n")[0]);
    expect(repaired).toContain("before it is filed here too.");
    expect(repaired).not.toContain("whatever the fee");
    expect(repaired).toContain("Fees start at £150.");
    expect(checkProse({ markdown: repaired, prose })).toBeNull();
  });
});
