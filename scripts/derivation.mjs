// scripts/derivation.mjs — issue 1481
//
// The re-score's derivation: one fingerprint of every file under `src/lib`
// that `src/lib/scan/rescore-run.ts` reaches through its static imports —
// the scoring, the drivers, the rivals, the markets and the reading a stored
// scan is given again (issues 1426, 1433, 1470). `next.config.ts` computes it
// at build and the deployment carries it as `RK_DERIVATION`, so the
// `scan/rescore` tick knows when a deploy changed how a scan is read, and
// asks for the dry run and the apply itself.
//
// A dynamic `import()` is not followed: the re-score reaches the database
// that way, and the database is not how a scan is read. Plain JavaScript, so
// the build can import it without TypeScript.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const ENTRY = "src/lib/scan/rescore-run.ts";
const SCOPE = "src/lib/";
const STATIC_IMPORT = /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s*["']([^"']+)["']|(?:^|\n)\s*import\s*["']([^"']+)["']/g;

function resolved(root, from, specifier) {
  const base = specifier.startsWith("@/")
    ? join(root, "src", specifier.slice(2))
    : specifier.startsWith(".")
      ? resolve(dirname(from), specifier)
      : null;
  if (base === null) return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** The files the entry reaches under `src/lib`, repository-relative and sorted. */
export function derivationFiles(root = process.cwd()) {
  const seen = new Set();
  const queue = [join(root, ENTRY)];
  while (queue.length > 0) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(STATIC_IMPORT)) {
      const next = resolved(root, file, match[1] ?? match[2]);
      if (next !== null && relative(root, next).startsWith(SCOPE)) queue.push(next);
    }
  }
  return [...seen].map((file) => relative(root, file)).sort();
}

/** Twelve hex characters: the same files with the same bytes give the same value. */
export function derivation(root = process.cwd()) {
  const hash = createHash("sha256");
  for (const file of derivationFiles(root)) {
    hash.update(file).update("\0").update(readFileSync(join(root, file))).update("\0");
  }
  return hash.digest("hex").slice(0, 12);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = derivationFiles();
  if (process.argv.includes("--files")) for (const file of files) console.log(file);
  console.log(`${derivation()} (${files.length} files)`);
}
