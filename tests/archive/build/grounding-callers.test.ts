// tests/build/grounding-callers.test.ts — issue #927
//
// **No module that writes a page quotes a passage the customer refused.**
//
// `readAllFacts` and `readFacts` are the base reads. `allowedFacts` is the
// pure filter that subtracts the passages the customer switched off on
// Settings › Your business (#926).
//
// **A module that reads passages and puts them in front of a model must
// pass them through that filter.** That is a rule about which function a
// file calls, and the kind of rule that holds for a week and then quietly
// stops — so it is a test rather than a comment.
//
// Two kinds of file are exempt and each says why in `ALLOWED`: the screen
// that *offers* the switch, which has to see a refused passage in order to
// offer it back, and a path with no customer who could have refused
// anything.
//
// It is a *structural* assertion and that is the point of the file: the
// behaviour is already asserted by
// `tests/generate/pipeline/grounding-switched-off.test.ts`, but that test
// only proves the filter works. This one proves nothing walked around it.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT, SRC_DIR, walkFiles } from "../ui/design/vocabulary";

/** The two base reads. A module that calls either and does not also call
 *  `allowedFacts` is quoting whatever the crawl found. */
const BASE_READS = ["readAllFacts", "readFacts"] as const;

/** The files that read unfiltered on purpose, each with its reason recorded
 *  beside it rather than in a list somebody has to go and find. */
const ALLOWED: readonly { readonly file: string; readonly why: string }[] = Object.freeze([
  {
    file: "src/app/(account)/app/settings/business-store.ts",
    why:
      "Settings › Your business draws the switch, so it must see a refused " +
      "passage in order to offer it back. It quotes nothing.",
  },
  {
    file: "src/lib/generate/pipeline/grounding.ts",
    why:
      "the module that declares the reads and the filter. Its own " +
      "`readGroundingFact` reads unfiltered on purpose: it answers whether a " +
      "site has any supply at all, not which passage a page will quote, and " +
      "the writer re-derives the refusal at the moment it matters.",
  },
  {
    file: "src/lib/mail/leads/writer.ts",
    why:
      "the lead mail's sample page is written for a visitor with no account, " +
      "so there is nobody who could have switched a passage off — the table " +
      "the refusals live in is keyed by site and a lead has none.",
  },
]);

const ALLOWED_FILES = new Set(ALLOWED.map((entry) => entry.file));

/** Every call to a base read, by file. A call is `name(` — the same shape
 *  an import makes usable, and narrow enough that the word in a comment or
 *  in this file's own prose is not one. */
function callers(): { file: string; read: string }[] {
  const out: { file: string; read: string }[] = [];
  for (const rel of walkFiles(SRC_DIR, (candidate) => /\.tsx?$/.test(candidate))) {
    const text = readFileSync(path.join(REPO_ROOT, rel), "utf8");
    for (const read of BASE_READS) {
      // `readAllowedFacts(` must not count as `readFacts(`: the boundary
      // before the name is what keeps it from doing so.
      if (new RegExp(`(?<![A-Za-z0-9_])${read}\\s*\\(`).test(text)) {
        out.push({ file: rel, read });
      }
    }
  }
  return out;
}

describe("#927 — every path that quotes a passage subtracts the refused ones", () => {
  it("the sweep found the reads — a rule over nothing is not a rule", () => {
    const found = callers();
    expect(found.length).toBeGreaterThan(0);
    expect(found.map((entry) => entry.file)).toContain(
      "src/lib/generate/pipeline/grounding.ts"
    );
  });

  it("every module that reads passages also filters them, except the ones named", () => {
    const offenders = callers()
      .filter((entry) => !ALLOWED_FILES.has(entry.file))
      .filter((entry) => {
        const text = readFileSync(path.join(REPO_ROOT, entry.file), "utf8");
        return !/(?<![A-Za-z0-9_])allowedFacts\s*\(/.test(text);
      })
      .map((entry) => `${entry.file}: ${entry.read}() with no allowedFacts()`);
    expect(
      offenders,
      "these read grounding passages and do not subtract the ones the customer " +
        "switched off (#926, #927). Pass the list through `allowedFacts(all, factsOff)` " +
        "— unless this file draws the switch itself or has no customer who could have " +
        "refused anything, in which case add it to ALLOWED with the reason."
    ).toEqual([]);
  });

  it("the writer and an edit both filter", () => {
    // Stated positively as well, because the assertion above would also
    // pass if these two stopped reading facts at all.
    // The writer's read is the day's run, which builds the context pack from
    // it (SPEC §7, D41); the pipeline is handed the pack and reads nothing.
    for (const file of ["src/lib/generate/index.ts", "src/lib/generate/edit.ts"]) {
      const text = readFileSync(path.join(REPO_ROOT, file), "utf8");
      expect(text, file).toMatch(/(?<![A-Za-z0-9_])allowedFacts\s*\(/);
    }
  });

  it("every allow-list row names a file that exists, so the list cannot outlive its reasons", () => {
    for (const entry of ALLOWED) {
      expect(() => readFileSync(path.join(REPO_ROOT, entry.file), "utf8"), entry.file).not.toThrow();
      expect(entry.why.length, entry.file).toBeGreaterThan(20);
    }
  });
});
