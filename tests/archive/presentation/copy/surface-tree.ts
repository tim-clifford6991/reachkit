// tests/presentation/copy/surface-tree.ts — ADR-010, WO-279 (supersedes WO-044)
//
// The one file enumerator in the corpus (WO-047's route enumerator is a
// different thing and lives in BP-021's tree — it walks `page.tsx` files
// for routing, this walks every `.ts`/`.tsx` file for voice). Walks the
// four governed globs ADR-010's decision names — `src/app/**`,
// `src/app/(hosted)/**`, `src/lib/mail/**` and `src/ui/**` — from a
// supplied root, using `node:fs`'s recursive directory read, and returns
// every `.ts`/`.tsx` path found plus the count it walked per glob.
//
// `root` is a parameter (never hardcoded) so the fixture tree under
// `__fixtures__/surfaces/` can be swept with the same code the real tree
// is swept with (WO-279 rests-on row 3) — the detection logic is proven
// against known violations before it is ever pointed at whatever the app
// happens to contain that day.
//
// Skip nothing silently (constitution rule 5.5): a governed directory that
// does not exist yet on the swept root contributes `0` and is reported as
// `0` in `perGlob`, never omitted. `src/lib/mail/` does not exist on this
// repository at cut time (WO-279 rests-on row 1) — this is exactly the
// case that rule exists for.
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/** The four glob roots ADR-010's decision names, repo-relative to whatever
 *  root is supplied. `src/app/(hosted)` is a literal path segment (a
 *  Next.js route group), not a wildcard pattern, and it sits inside
 *  `src/app` — a file under it is walked by both entries, and counted in
 *  both `perGlob` entries, because each entry reports what that glob alone
 *  reaches, not a partition of the surface tree. */
export const GOVERNED_GLOBS = ["src/app", "src/app/(hosted)", "src/lib/mail", "src/ui"] as const;

export interface SurfaceTree {
  /** Every `.ts`/`.tsx` path found, deduplicated across overlapping globs. */
  files: string[];
  /** How many `.ts`/`.tsx` files each governed glob reached, on its own. */
  perGlob: Record<string, number>;
}

const SWEPT_EXTENSIONS = new Set([".ts", ".tsx"]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.isFile() && SWEPT_EXTENSIONS.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

/** Walks the four governed globs under `root` and returns every `.ts`/
 *  `.tsx` path found. */
export function surfaceTree(root: string): SurfaceTree {
  const perGlob: Record<string, number> = {};
  const seen = new Set<string>();
  const files: string[] = [];

  for (const glob of GOVERNED_GLOBS) {
    const dir = path.join(root, glob);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) {
      perGlob[glob] = 0;
      continue;
    }
    const found = walk(dir);
    perGlob[glob] = found.length;
    for (const file of found) {
      if (!seen.has(file)) {
        seen.add(file);
        files.push(file);
      }
    }
  }

  return { files, perGlob };
}
