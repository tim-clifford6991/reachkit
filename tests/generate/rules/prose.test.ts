// tests/generate/rules/prose.test.ts — SPEC §7 (owner, 2026-10-10; issue
// 1390): a page that reads as machine-written is stopped, and told why.
import "../env";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runHardRules } from "../../../src/lib/generate/rules";
import { checkProse, proseFaults, proseNotes, proseScore, type ProseFault } from "../../../src/lib/generate/rules/prose";
import { emptyComparison, fakeCost, siteInputs } from "../fixtures";

// reachkit.app's how-to as it went live on 10 October 2026, the page the
// issue counted.
const LIVE = readFileSync(path.resolve(__dirname, "../../../scripts/eval-content/prose/live/how-to-rank-in-ai-overview.md"), "utf8");

const faultsOf = (markdown: string, more: Partial<Parameters<typeof proseScore>[1]> = {}): ProseFault[] =>
  proseFaults(proseScore(markdown, { language: "en", ...more }));
const tells = (faults: readonly ProseFault[]): string[] => faults.map((fault) => fault.tell);

/** Plain prose in mixed sentence lengths: a page nothing stops. */
const PLAIN = [
  "We opened the bakery on Flinger Strasse in 1890. It was one room. My great-grandfather baked rye at four in the morning and sold out before the trams started running.",
  "Rye is still most of what leaves the oven. Customers ask for the dark loaf by name, and on Saturdays the queue reaches the corner before eight.",
  "Does a loaf keep? Yes. Wrapped in linen it stays good for five days, which is longer than the wheat rolls manage in two.",
  "Ordering ahead takes one phone call. Tell us the day, the number of loaves and whether you want them sliced, and they wait on the shelf behind the counter with your name on the bag.",
  "Prices changed in March. Flour went up, so the large loaf costs forty cents more than it did last winter.",
  "Some people freeze half. That works, provided the bread goes in the day it was bought and thaws slowly on a rack.",
  "A cake for forty guests needs a week of notice. Smaller orders need two days. Nobody has ever been turned away for asking late, though the choice gets narrower.",
].join("\n\n");

describe("plain_prose", () => {
  it("stops the page the issue counted for its dashes, its tagline and its list label, with the page's own words", () => {
    const faults = faultsOf(LIVE);
    expect(tells(faults)).toEqual(["dashes", "repeated_phrase", "list_scaffold"]);
    expect(faults.find((fault) => fault.tell === "dashes")?.count).toBe(19);
    expect(faults.find((fault) => fault.tell === "list_scaffold")).toMatchObject({ count: 9, found: ["result"] });
    expect(faults.find((fault) => fault.tell === "repeated_phrase")?.found[0]).toContain("rivals instead of you");
    // What the one fix call is told: the count, the words and what to do.
    const notes = proseNotes(faults).join("\n");
    expect(notes).toContain("19 dashes");
    expect(notes).toContain('"result"');
  });

  it("passes plain sentences of mixed length, and asks nothing of a page a customer wrote", () => {
    expect(faultsOf(PLAIN)).toEqual([]);
    expect(checkProse({ markdown: LIVE, prose: null })).toBeNull();
  });

  it("leaves what is not the writer's uncounted: a fact stated word for word, a pull quote, the page's own subject", () => {
    const fact = "Every plan includes a weekly re-measure — at no extra cost — for every site — always.";
    const quoting = `${PLAIN}\n\n${fact}\n\n> ${fact}\n\nOur pricing page says it too. ${fact}`;
    expect(tells(faultsOf(quoting))).toContain("dashes");
    expect(faultsOf(quoting, { passages: [fact] })).toEqual([]);

    const topic = Array.from({ length: 6 }, (_, at) => `Step ${at + 1} shows how to rank in ai overview for one more question a buyer brings.`).join("\n\n");
    expect(tells(faultsOf(topic))).toContain("repeated_phrase");
    expect(faultsOf(topic, { subjects: ["how to rank in ai overview"] }).map((fault) => fault.found[0] ?? "")).not.toContain("how to rank in ai overview");
  });

  it("counts a German page's dashes and repeats, and reads no English phrase list on it", () => {
    const seite = Array.from({ length: 8 }, (_, at) => `Unser Brot backen wir jeden Morgen frisch – seit 1890 – in Düsseldorf, Laden ${at + 1}. This matters. This matters.`).join("\n\n");
    const score = proseScore(seite, { language: "de" });
    expect(score.dashes).toBe(16);
    expect(score.tells).toEqual([]);
    expect(tells(proseFaults(score))).toContain("dashes");
  });

  it("is run by the battery with slopless beside it: one construction used three times stops an English page", async () => {
    const reframed = `${PLAIN}\n\nA scan is not a fix. It's a measurement.\n\nThis isn't a ranking gap. It's a naming gap.\n\nThe score is not a grade. It's a baseline.`;
    const outcome = await runHardRules(fakeCost(), {
      markdown: reframed,
      title: "How to read a scan",
      rendered: reframed,
      pageType: null,
      site: siteInputs(),
      comparison: emptyComparison(),
      grounded: null,
      sourceText: "",
      brief: { facts: [], queries: [] },
      prose: { language: "en" },
    });
    const detail = outcome.passed ? undefined : outcome.failed.find((each) => each.rule === "plain_prose")?.detail;
    const faults = detail?.rule === "plain_prose" ? detail.faults : [];
    expect(faults.map((fault) => fault.tell)).toEqual(["tell_phrases"]);
    expect(faults[0]?.count).toBe(3);
  });
});
