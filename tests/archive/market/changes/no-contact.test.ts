// tests/market/changes/no-contact.test.ts — REQ-071 c17
//
// **No contact ever reaches a rival**, made a build failure rather than a
// review finding.
//
// The criterion: "Given any domain the customer has named as a competitor,
// when it is added, measured against, or removed, then ReachKit sends that
// domain and the people behind it no message and makes no contact of any
// kind, and nothing ReachKit publishes or serves names the customer as
// measuring them."
//
// A promise like that cannot be kept by remembering it. It is kept by the
// module graph: nothing under `src/lib/market/**` may reach
// `src/lib/mail/**` along any import path, at any depth, and no export in
// the change engine may take or return an address.
//
// **The checker is applied to a fixture tree that does contain a forbidden
// import, and must flag it.** A test that only observes today's graph would
// pass trivially — today, and at every later size of the codebase, right up
// until someone adds the import it was written to catch. The violating
// fixture reaches the mail seam *transitively*, through a third file, which
// is the case a one-level check would miss.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../../..");

/** Every `.ts`/`.tsx` file under a root, as repo-relative POSIX paths. */
function filesUnder(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry)) out.push(full);
    }
  };
  walk(root);
  return out;
}

/** The import specifiers a file names. */
function importsOf(file: string): string[] {
  const source = readFileSync(file, "utf8");
  return [
    ...source.matchAll(/^\s*import\s[^;]*?from\s+"([^"]+)";/gm),
    ...source.matchAll(/\bimport\(\s*"([^"]+)"\s*\)/g),
  ].map((m) => m[1] ?? "");
}

/** Resolves an alias or relative specifier to a file on disk, or `null`
 *  for a package. */
function resolveSpecifier(from: string, specifier: string): string | null {
  const base = specifier.startsWith("@/")
    ? path.join(ROOT, "src", specifier.slice(2))
    : specifier.startsWith(".")
      ? path.resolve(path.dirname(from), specifier)
      : null;
  if (base === null) return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // not this one
    }
  }
  // A specifier that resolves to nothing on disk is still worth reporting
  // when it *names* the forbidden area — that is how an unresolvable stub
  // in a fixture tree is caught.
  return base;
}

export interface Reach {
  /** The file under the checked root that starts the path. */
  from: string;
  /** The import path that reaches the forbidden area, in order. */
  via: string[];
}

/**
 * Every path from a file under `root` that reaches `forbidden`, following
 * imports transitively.
 *
 * A reusable checker taking its root as an argument, so the same code that
 * runs over `src/lib/market/**` runs over the fixture trees — a rule proved
 * to discriminate is a rule, and one that has only ever seen a clean tree
 * is a hope.
 */
export function reaches(root: string, forbidden: (file: string) => boolean): Reach[] {
  const found: Reach[] = [];

  for (const start of filesUnder(root)) {
    const seen = new Set<string>([start]);
    const queue: { file: string; via: string[] }[] = [{ file: start, via: [] }];

    while (queue.length > 0) {
      const { file, via } = queue.shift()!;
      for (const specifier of importsOf(file)) {
        const target = resolveSpecifier(file, specifier);
        if (target === null) continue;
        const step = [...via, specifier];
        if (forbidden(target)) {
          found.push({ from: path.relative(ROOT, start).split(path.sep).join("/"), via: step });
          continue;
        }
        if (seen.has(target)) continue;
        seen.add(target);
        try {
          if (statSync(target).isFile()) queue.push({ file: target, via: step });
        } catch {
          // A specifier resolving to nothing is not a path to follow.
        }
      }
    }
  }
  return found;
}

const MAIL = path.join(ROOT, "src/lib/mail");
const reachesMail = (file: string): boolean => file.startsWith(MAIL);

describe("REQ-071 c17 — no import path from the market engine reaches the mail seam", () => {
  it("nothing under src/lib/market/** reaches src/lib/mail/**, at any depth", () => {
    const offenders = reaches(path.join(ROOT, "src/lib/market"), reachesMail);
    expect(offenders).toEqual([]);
  });

  it("the checker discriminates: it flags a fixture tree that does reach it", () => {
    // Without this row the assertion above would pass on an empty graph,
    // on a broken resolver, and on a checker whose body was deleted.
    const offenders = reaches(
      path.join(ROOT, "tests/market/changes/fixtures/no-contact/violating"),
      reachesMail
    );
    // Every file that can reach it is reported, which is what a reviewer
    // needs: the three here are the entry, the middle and the offender.
    expect(offenders.map((o) => path.basename(o.from)).sort()).toEqual([
      "entry.ts",
      "rank.ts",
      "score.ts",
    ]);
    // Transitively — entry → rank → score → mail. A one-level check would
    // have reported only `score.ts` and let the entry point through.
    const fromEntry = offenders.find((o) => o.from.endsWith("violating/entry.ts"));
    expect(fromEntry?.via).toEqual(["./rank", "./score", "@/lib/mail/send"]);
  });

  it("and it clears the same tree with the forbidden import removed", () => {
    const offenders = reaches(
      path.join(ROOT, "tests/market/changes/fixtures/no-contact/clean"),
      reachesMail
    );
    expect(offenders).toEqual([]);
  });

  it("it actually walked the market tree — a rule over nothing is not a rule", () => {
    expect(filesUnder(path.join(ROOT, "src/lib/market")).length).toBeGreaterThan(15);
  });
});

describe("REQ-071 c17 — no export in the change engine takes or returns an address", () => {
  const CHANGES = path.join(ROOT, "src/lib/market/changes");

  it("no signature in the module names an address, a recipient or a message", () => {
    // The other half of the promise: an address cannot leave here even by a
    // caller's mistake, because no export has anywhere to put one.
    const banned = /\b(email|mailto|recipient|sendTo|address|contact|notify|message)\b/i;
    const offenders: string[] = [];
    for (const file of filesUnder(CHANGES)) {
      const source = readFileSync(file, "utf8");
      // Signatures only: a comment may discuss the promise, and this file's
      // own subject is contact.
      const code = source
        .split("\n")
        .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
        .join("\n");
      for (const match of code.matchAll(/^export\s+(?:async\s+)?function\s+[^{]*/gm)) {
        if (banned.test(match[0])) offenders.push(`${path.basename(file)}: ${match[0].trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("a rival is a domain here and never a person", () => {
    for (const file of filesUnder(CHANGES)) {
      const source = readFileSync(file, "utf8");
      expect(source, path.basename(file)).not.toMatch(/@\/lib\/mail/);
    }
  });
});
