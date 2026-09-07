// tests/build/stale-deferrals.test.ts — issue #230
//
// A comment that defers a thing to an issue is true for as long as the
// issue is open and false for ever afterwards, and nothing was watching the
// difference. The gap audit of 2026-09-07 found thirteen such lines in
// `src/`, every one naming an issue that had since closed: a reader was
// told the hosted edge served nothing (#49 built it), that the Overview's
// series was somebody's future work (#41 and #27 landed it), that the setup
// store did not exist on disk (#133 made it live). Each was accurate when
// it was written. That is the whole difficulty — the comment does not
// change when the world does, and there is no moment at which anybody is
// asked to revisit it.
//
// **So the rule is about the vocabulary, not about the issue numbers.**
// Reading GitHub from a test is not available (no network — `tests/setup.ts`
// refuses it), and a pinned list of closed issues is a second thing to keep
// fresh, which is the same defect one level up. What this suite bans is the
// *form of words* that can go stale: a present-tense claim that some part
// of the product belongs to an issue rather than to a module.
//
//   `is #N's` / `are #N's`   — "the rendering is #49's"
//   `until #N lands`         — "the fixture stands until #54 lands"
//   `#N supplies`            — "issue #14 supplies one honest implementation"
//
// **What to write instead.** Name the module that holds the fact: "rendered
// by `src/lib/publish/render/markdown.ts`". A module can be opened and read;
// an issue number cannot, and a reader who follows one arrives at a closed
// tab with no way to tell whether the comment was ever updated. Citing an
// issue for *why* something is the way it is stays welcome and is not this
// rule's business — "the `AiAnswersCard` from issue #27", "REQ-071 c11's
// hold (#204)" — because a citation of a past decision does not expire.
//
// **`(historical)` is the escape hatch**, for a line that quotes a deferral
// in order to say it no longer holds. `_overview/store.ts` carries the one
// use: it quotes the stub's own reasoning before recording that both issues
// landed long ago. Marking a line historical is a claim that the sentence
// around it already says the deferral is over — not a way to keep one.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../..");
const SRC = path.join(ROOT, "src");

/**
 * The deferral vocabulary, one entry per form of words.
 *
 * Deliberately small and literal. A cleverer pattern — every `#N` in a
 * comment, say — would catch the citations this rule is careful to allow,
 * and a rule that fires on good writing is one somebody switches off.
 */
const DEFERRALS: ReadonlyArray<{ readonly pattern: RegExp; readonly says: string }> = [
  { pattern: /\b(?:is|are) #\d+'s/, says: "attributes part of the product to an issue instead of to a module" },
  { pattern: /until #\d+ lands/, says: "promises a state that ends when an issue closes, which nothing checks" },
  { pattern: /#\d+ supplies/, says: "names an issue as the supplier of something a module supplies" },
];

/** The marker that says a line quotes a deferral in order to bury it. */
const HISTORICAL = "(historical)";

/**
 * The lines this rule does not yet cover, each naming whose they are.
 *
 * **Empty, and that is the finished state** (issue #253). It held one row:
 * `src/jobs/engine.ts` said the free scan arm's claimed slot "is #24's to
 * decide", and #24 is the `llm()` seam — an unrelated, closed issue. Issue
 * #229 was open on exactly that line, so rewriting it here would have put
 * two issues in one file. #250 landed #229 and rewrote the line minutes
 * after #249 added this row; the row then stopped offending and the last
 * test below turned `main` red — the row doing exactly what it was written
 * to do. A future entry is added the same way and lives under the same
 * rule: it fails the moment its line is fixed.
 */
const OWNED_ELSEWHERE: ReadonlyArray<{ readonly file: string; readonly whose: string }> = [];

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
}

interface Offence {
  where: string;
  line: string;
  says: string;
}

function sourceFiles(): string[] {
  const files: string[] = [];
  walk(SRC, files);
  return files.sort();
}

function offences(files: string[] = sourceFiles()): Offence[] {
  const exempt = new Set(OWNED_ELSEWHERE.map((entry) => entry.file));
  const found: Offence[] = [];

  for (const file of files) {
    const rel = path.relative(ROOT, file).split(path.sep).join("/");
    if (exempt.has(rel)) continue;

    for (const [index, line] of readFileSync(file, "utf8").split("\n").entries()) {
      if (line.includes(HISTORICAL)) continue;
      for (const { pattern, says } of DEFERRALS) {
        if (pattern.test(line)) found.push({ where: `${rel}:${index + 1}`, line: line.trim(), says });
      }
    }
  }
  return found;
}

describe("no comment in src/ defers a fact to an issue (#230)", () => {
  it("the deferral vocabulary is absent", () => {
    // The message an offender reads is the fix, not the rule: name the
    // module that holds the fact.
    expect(offences()).toEqual([]);
  });

  it("the rule discriminates — it fires on each form and leaves citations alone", () => {
    // Without this, deleting the loop above would leave an empty list
    // passing for ever.
    const deferrals = [
      "// What an adapter is handed to deliver. The rendering is #49's.",
      "//  * the series is #41's and #27's, and neither has landed.",
      "// The fixture stands until #54 lands.",
      "// issue #14 supplies one honest implementation of it.",
    ];
    for (const line of deferrals) {
      expect(
        DEFERRALS.some(({ pattern }) => pattern.test(line)),
        line
      ).toBe(true);
    }

    const citations = [
      "// which is the `AiAnswersCard` from issue #27 plus the three things",
      "// REQ-071 c11's hold (#204). A read that could not answer is not a site",
      "// The reason is the standing ruling in #93 (\"owner-owed copy keys\")",
      "// `rankedCountsFromSizes` is that reader (issue #40), so the member",
    ];
    for (const line of citations) {
      expect(
        DEFERRALS.some(({ pattern }) => pattern.test(line)),
        line
      ).toBe(false);
    }
  });

  it("`(historical)` exempts the line it is on, and only that line", () => {
    const quoted = "// series is #41's and #27's\" (historical). Both landed long ago, so";
    const bare = "// series is #41's and #27's\". Both landed long ago, so";
    expect(quoted.includes(HISTORICAL)).toBe(true);
    expect(bare.includes(HISTORICAL)).toBe(false);
    expect(DEFERRALS.some(({ pattern }) => pattern.test(bare))).toBe(true);
  });

  it("the tree is actually walked — a rule over nothing is not a rule", () => {
    expect(sourceFiles().length).toBeGreaterThan(200);
  });

  it("every line not yet covered names whose it is, and still actually offends", () => {
    // A stale exemption is worse than none: it reads as a rule with a known
    // gap while the gap has already closed. The list is empty today (#253),
    // stated rather than read off a loop that runs zero times in silence.
    expect(OWNED_ELSEWHERE).toEqual([]);
    for (const entry of OWNED_ELSEWHERE) {
      expect(entry.whose.length, entry.file).toBeGreaterThan(0);
      const full = path.join(ROOT, entry.file);
      expect(() => statSync(full), entry.file).not.toThrow();
      const still = readFileSync(full, "utf8")
        .split("\n")
        .some((line) => !line.includes(HISTORICAL) && DEFERRALS.some(({ pattern }) => pattern.test(line)));
      expect(still, `${entry.file} no longer defers to an issue — drop its entry`).toBe(true);
    }
  });
});
