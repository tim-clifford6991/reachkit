// The code index: imports and routes, layered on top of readRepo's tracked-
// file list (git.mjs). Read-only and regex-based on purpose — no module
// resolution algorithm, no TypeScript parsing, no package.json "exports"
// awareness. A specifier this can't resolve against the tracked set is
// counted in `unresolved`, never guessed at: the same "refuse rather than
// fabricate" posture extract/index.mjs already applies to ellipsis ranges.
//
// Cached per repo root, invalidated only when HEAD moves — the same shape as
// readRepo's own module-level cache, one level up: this module never calls
// git itself beyond `repoHead`, and never re-reads the tracked list — the
// caller (extract/index.mjs, which already called readRepo) owns that.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { repoHead } from "./git.mjs";

const SCAN_EXT = [".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx"];

// Reset `.lastIndex` before every use — these are shared, stateful `g`
// regexes, reused across every scanned file.
const SPECIFIER_RES = [
  /from\s*['"]([^'"]+)['"]/g,
  /require\(\s*['"]([^'"]+)['"]/g,
  /import\(\s*['"]([^'"]+)['"]/g,
];

// Tried in order against the tracked set; first hit wins.
const RESOLVE_SUFFIXES = ["", ".ts", ".tsx", ".js", ".mjs", ".jsx", "/index.ts", "/index.tsx", "/index.js"];

// `(src/)?app/**/page.(tsx|ts|jsx|js)` — group 1 is everything below `app/`,
// undefined for a root `app/page.tsx`.
const APP_PAGE_RE = /^(?:src\/)?app\/(?:(.*)\/)?page\.(?:tsx|ts|jsx|js)$/;
// `(src/)?pages/**/*.(tsx|ts|jsx|js)` — group 1 is the path below `pages/`,
// extension already stripped.
const PAGES_RE = /^(?:src\/)?pages\/(.*)\.(?:tsx|ts|jsx|js)$/;

const cache = new Map(); // root → { head, index }

/** `a/./b` / `a/x/../b` → `a/b`, POSIX-style — specifiers are always POSIX
 * even on Windows, since they come from source text, not the filesystem. */
function normalize(path) {
  const out = [];
  for (const seg of path.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") out.pop();
    else out.push(seg);
  }
  return out.join("/");
}

/**
 * Resolve one specifier found inside `fromFile`.
 *   - `@/x`     → `src/x`, then the suffix list against `tracked`.
 *   - `./x` `../x` → joined against `fromFile`'s own directory, then the
 *     suffix list against `tracked`.
 *   - anything else (a bare package specifier) is not this function's
 *     problem — the caller ignores it entirely.
 */
function resolveSpecifier(spec, fromFile, tracked) {
  let base;
  if (spec.startsWith("@/")) {
    base = `src/${spec.slice(2)}`;
  } else if (spec.startsWith(".")) {
    const slash = fromFile.lastIndexOf("/");
    const dir = slash === -1 ? "" : fromFile.slice(0, slash);
    base = normalize(`${dir}/${spec}`);
  } else {
    return { bare: true };
  }
  for (const suf of RESOLVE_SUFFIXES) {
    const candidate = `${base}${suf}`;
    if (tracked.has(candidate)) return { resolved: candidate };
  }
  return { unresolved: true };
}

/** App router: group segments `(marketing)` are removed, `[param]` kept,
 * an empty result (root page, or a page whose only segments were groups) is
 * `/`. */
function appRoute(dirPart) {
  const segs = (dirPart || "").split("/").filter((s) => s && !/^\(.*\)$/.test(s));
  return segs.length ? `/${segs.join("/")}` : "/";
}

/** Pages router: `index` collapses to its directory's own route; `_app`,
 * `_document` and anything under `api/` are not pages and return `null`. */
function pagesRoute(pathPart) {
  const segs = pathPart.split("/");
  const base = segs[segs.length - 1];
  if (base === "_app" || base === "_document") return null;
  if (segs[0] === "api") return null;
  const kept = base === "index" ? segs.slice(0, -1) : segs;
  return kept.length ? `/${kept.join("/")}` : "/";
}

function computeIndex(repoRoot, tracked) {
  const trackedSet = new Set(tracked);
  const scanFiles = tracked.filter((f) => SCAN_EXT.some((ext) => f.endsWith(ext)));

  const imports = [];
  let unresolved = 0;
  let skipped = 0;

  for (const file of scanFiles) {
    let text;
    try {
      text = readFileSync(join(repoRoot, file), "utf8");
    } catch {
      skipped++;
      continue;
    }
    for (const re of SPECIFIER_RES) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text))) {
        const result = resolveSpecifier(m[1], file, trackedSet);
        if (result.bare) continue;
        if (result.resolved) imports.push([file, result.resolved]);
        else unresolved++;
      }
    }
  }

  const routes = [];
  for (const file of tracked) {
    const appM = file.match(APP_PAGE_RE);
    if (appM) {
      routes.push({ route: appRoute(appM[1]), file });
      continue;
    }
    const pagesM = file.match(PAGES_RE);
    if (pagesM) {
      const route = pagesRoute(pagesM[1]);
      if (route !== null) routes.push({ route, file });
    }
  }
  routes.sort((a, b) => (a.route < b.route ? -1 : a.route > b.route ? 1 : 0));

  return { files: scanFiles.length, imports, unresolved, skipped, routes };
}

/**
 * `scanIndex(repoRoot, tracked) → { files, imports: [[from, to], …],
 * unresolved, skipped, routes: [{ route, file }] }`.
 *
 * Cached per `repoRoot`, recomputed only when `repoHead(repoRoot)` has
 * moved — mirrors readRepo's own cache in git.mjs. The cache key is HEAD's
 * sha, but every file's *content* here is read straight off the working
 * tree (`readFileSync`, above), not out of the commit — so an uncommitted
 * edit to an already-tracked file's imports is invisible to this index
 * until it is committed and HEAD moves. Same design as readRepo's own
 * cache (git.mjs): "the corpus is the checkpoint," not the working tree.
 */
export function scanIndex(repoRoot, tracked) {
  const head = repoHead(repoRoot);
  const cached = cache.get(repoRoot);
  if (cached && cached.head === head) return cached.index;
  const index = computeIndex(repoRoot, tracked);
  cache.set(repoRoot, { head, index });
  return index;
}
