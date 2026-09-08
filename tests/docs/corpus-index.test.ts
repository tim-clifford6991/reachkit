// Every file under docs/ is named in docs/README.md (issue #378).
// tests/docs/corpus-index.test.ts
//
// `docs/README.md` is the authority map: it says which document governs what,
// and in what order they win. A corpus file the map does not name is a
// document nobody was told to read — which is how a second, unread source of
// truth starts. This walks `docs/` and holds the map total.
//
// The screen renders are excluded: `design/approved/**/screens/*.png` is
// forty-odd images that the map names collectively, and listing each one
// would make the map unreadable to buy nothing.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DOCS = path.resolve(import.meta.dirname, "../../docs");
const README = path.join(DOCS, "README.md");

/** Every file under `docs/`, repo-relative, excluding the screen renders. */
function corpusFiles(dir: string = DOCS, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      corpusFiles(full, out);
      continue;
    }
    const rel = path.relative(DOCS, full).split(path.sep).join("/");
    if (/(^|\/)screens\/.+\.png$/.test(rel)) continue;
    out.push(rel);
  }
  return out;
}

describe("issue #378 — docs/README.md names every file in the corpus", () => {
  const readme = readFileSync(README, "utf8");
  const files = corpusFiles();

  it("every corpus file is named in the map", () => {
    // A file is named if the map mentions its path or its basename — the map
    // writes some paths in full and some as a filename inside a sentence
    // about its directory, and both are a reader being told it exists.
    const missing = files.filter((rel) => {
      if (rel === "README.md") return false;
      return !readme.includes(rel) && !readme.includes(path.basename(rel));
    });
    expect(missing, `named nowhere in docs/README.md: ${missing.join(", ")}`).toEqual([]);
  });

  it("the walk reaches the corpus — a rule over nothing is not a rule", () => {
    expect(files.length).toBeGreaterThan(4);
    expect(files).toContain("README.md");
    expect(files).toContain("PROCESS.md");
    expect(files).toContain("DEPLOYMENT.md");
  });

  it("the screen renders are excluded, and there are some to exclude", () => {
    // Stated rather than assumed: if the renders ever move, this test starts
    // demanding forty filenames in the map and the reason is visible here.
    const all = (function walk(dir: string, out: string[] = []): string[] {
      for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) walk(full, out);
        else out.push(path.relative(DOCS, full).split(path.sep).join("/"));
      }
      return out;
    })(DOCS);
    const renders = all.filter((rel) => /(^|\/)screens\/.+\.png$/.test(rel));
    expect(renders.length).toBeGreaterThan(10);
    expect(files.some((rel) => renders.includes(rel))).toBe(false);
  });
});
