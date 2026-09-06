// tests/presentation/sweeps/routes.ts — ADR-010 point 2, REQ-091 c2
//
// The route enumerator these two sweeps share. ADR-010: "Conformance suites
// are scoped by path glob over the surface tree, not by call-site lists."
// The scope is the App Router file tree, so REQ-091 criterion 2's "including
// screens added later" is carried by construction: this file holds no route
// names.
//
// It takes a root, so the fixture tree under `__fixtures__/routes/` is
// enumerated by exactly the same code that enumerates `src/app` — a rule
// that discriminates on the fixture tree is the same rule that runs over the
// product.
//
// **Not a second enumerator.** `tests/ui/layout/routes.ts` walks the same
// tree for the browser sweep and returns URLs with the headers to send;
// this one returns the module to import and render in-process, which is a
// different question about the same set. `coldstart.test.tsx` asserts the
// two agree on the set, so a route the layout suite sees and this one does
// not (or the reverse) fails rather than being swept by neither.
import { readdirSync } from "node:fs";
import path from "node:path";

export interface EnumeratedRoute {
  /** The URL path, route groups stripped and dynamic segments left in their
   *  bracket form — filling them is the harness's job, not the walk's. */
  url: string;
  /** Absolute path of the `page.tsx`. */
  file: string;
  /** Path relative to the enumerated root, POSIX separators — the key every
   *  harness row is written against. */
  rel: string;
  /** The route groups this page sits inside, in order (`(public)`,
   *  `(account)`, `(hosted)`). The shell a page renders inside is a property
   *  of its group, not of its name. */
  groups: readonly string[];
}

function isRouteGroup(segment: string): boolean {
  return segment.startsWith("(") && segment.endsWith(")");
}

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && (entry.name === "page.tsx" || entry.name === "page.ts")) out.push(full);
  }
}

/** Every route under `appRoot`, in App Router terms. A directory that does
 *  not exist yet contributes nothing and the count says so (rule 5.5). */
export function enumerateRoutes(appRoot: string): EnumeratedRoute[] {
  const files: string[] = [];
  walk(appRoot, files);
  files.sort();

  return files.map((file) => {
    const rel = path.relative(appRoot, file).split(path.sep).join("/");
    const segments = path.relative(appRoot, path.dirname(file)).split(path.sep).filter(Boolean);
    const groups = segments.filter(isRouteGroup);
    const url = "/" + segments.filter((s) => !isRouteGroup(s)).join("/");
    return { url: url === "/" ? "/" : url.replace(/\/$/, ""), file, rel, groups };
  });
}
