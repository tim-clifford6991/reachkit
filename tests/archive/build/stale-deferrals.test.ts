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
// **Six more forms, and the same rule** (issue #260). The first three caught
// deferrals that name an issue; a second audit found four comments deferring
// in forms that name no issue at all, or name one in a shape the patterns
// above miss — every one of them describing work that had since landed:
//
//   `once #N lands` / `once #N's`  — "the link once #35 lands"
//   `will supply it`               — "each naming the issue that will supply it"
//   `not built yet`                — "the engine behind it is not built yet"
//   `a read that does not exist yet` / `stand-in for a read`
//
// The last two are the important ones, because they carry no issue number
// for a reader to check: a comment saying a read "does not exist yet" is
// unfalsifiable from the outside and stays wrong silently. They are also the
// forms a fixture header reaches for, which is where four of the second
// audit's findings were.
//
// **Two of #260's forms are narrowed to their deferral sense, deliberately,
// and this is a departure from the issue's wording worth reading.** Banning
// `does not exist yet` and `stand-in for` outright fires on five lines of
// correct writing, none of them a deferral: a page "whose publish moment
// does not exist yet" (`calendar/drafts-read.ts`), a cap checked against a
// reservation rather than "a figure that does not exist yet"
// (`lib/costs/index.ts`, twice), "a pass whose row does not exist yet"
// (`lib/scan/run.ts`), and a store that "is not a stand-in for one that
// does" (`setup/_setup/provider.ts`) — which is denying the thing the rule
// is against. Those sentences are about a *value*, a *row* or a *figure*,
// and they will still be true in a year. So the two patterns require the
// subject the deferral form actually takes — a **read** — which is exactly
// the shape all four audited fixture headers used. This file's own header
// says why that matters: "a rule that fires on good writing is one somebody
// switches off." Widening them is the owner's to do, on evidence.
//
// **The scan reads comment lines only**, for the same reason:
// `src/jobs/engine.ts`'s `EngineNotBuilt` message says "is not built yet" in
// a *runtime string*, where it is true every time it is thrown. The rule is
// about comments — it says so in its own title — and a thrown error that
// describes the world accurately is not a stale comment.
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
  // Issue #260's. `once #N` covers both "once #35 lands" and "once #42's
  // rows exist" — the shape is the same and so is the staleness.
  { pattern: /once #\d+(?:'s| lands)/, says: "promises a state that ends when an issue closes, which nothing checks" },
  { pattern: /will supply it/, says: "defers a fact to whatever supplies it later, rather than naming what does" },
  { pattern: /not built yet/, says: "says a thing is unbuilt, in a form carrying no issue a reader could check" },
  {
    pattern: /read that does not exist yet/,
    says: "says a read is missing, in a form carrying no issue a reader could check",
  },
  {
    pattern: /stand-in for a read/,
    says: "calls a value a stand-in without saying what supplies it today",
  },
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

/**
 * Whether this line is a comment.
 *
 * Blunt on purpose, and blunt in the safe direction: `//`, and `*` for a
 * block comment's continuation lines, which is every form this codebase's
 * headers and doc comments take. A deferral written inside a string literal
 * is not what this rule is about — `src/jobs/engine.ts`'s `EngineNotBuilt`
 * message says "is not built yet" and is true every time it is thrown.
 */
function isComment(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*");
}

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
      if (!isComment(line)) continue;
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
      // Issue #260's six forms, one line each.
      "// The 15-minute chase is what carries the link once #35 lands.",
      "// the two lines that make it live once #42's account and site rows exist.",
      "// Every field below stands in for a read that does not exist yet.",
      "// each naming the issue that will supply it:",
      "// The engine behind it is not built yet, so the stub throws.",
      "// Every field below is a stand-in for a read the product will make.",
      "// a stand-in for a read that does not exist yet, each naming the issue",
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
