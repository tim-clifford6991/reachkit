// tests/market/rivals/source.ts — BUILD §6.6
//
// The sizing modules carry long headers that quote the very things the
// tests forbid them to *do* — a boundary the pins own, a copy key the
// registry owns, the name of a directory they may not import. A comment
// is prose: it spends nothing, renders nothing and imports nothing, and
// `tests/config/constants.test.ts` makes the same distinction for the same
// reason. So the structural assertions run over the code with comments
// removed, and the assertions that are genuinely about the prose (a
// rendered word must not be transcribed anywhere) run over the whole file.
import { readFileSync } from "node:fs";
import path from "node:path";

export const RIVALS_DIR = path.resolve(import.meta.dirname, "../../../src/lib/market/rivals");

export function sourceOf(file: string): string {
  return readFileSync(path.join(RIVALS_DIR, file), "utf8");
}

/** Block comments, line comments, and nothing else — string literals in
 *  this directory never contain `//` or `/*`. */
export function codeOf(file: string): string {
  return sourceOf(file)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\n)\s*\/\/.*/g, "$1");
}

/** Every module specifier the file imports from, runtime and type alike. */
export function importsOf(file: string): string[] {
  return [...codeOf(file).matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);
}
