#!/usr/bin/env node
// scripts/orphans.mjs — issue #561: lists every tracked file nothing refers to.
//
// A file is *referenced* when another tracked file names it: its repo path,
// its path without the extension, or — for a module — an import specifier
// ending in its basename (`./Card`, `@/ui/charts`, `../bands.ts`). A file is
// an *entry* when a tool finds it by convention rather than by name: a Next
// route file, a test (vitest's globs), a migration (applied in order), a
// workflow, a root config file, a layout baseline (named by the sweep at
// run time), or one of the five corpus files. Anything under
// `docs/archive/` is frozen and never listed.
//
// Usage: `npm run orphans` (issue #561) — prints one path per line and exits 1 when any
// file is listed.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const files = execSync("git ls-files", { cwd: ROOT, encoding: "utf8" }).trim().split("\n");

const ENTRY = [
  /^docs\/archive\//,
  /^(README|CLAUDE)\.md$/,
  /^docs\/(SPEC|DESIGN|PROCESS|RUNBOOK)\.md$/,
  /^\.github\//,
  /^\.claude\//,
  /^[^/]+\.(json|ts|mjs|js)$/, // root config: package.json, next.config.ts, …
  /^\.(gitignore|env\.example)$/,
  /^supabase\/(config\.toml|migrations\/)/,
  /^src\/app\/.*\/?(page|layout|route|error|not-found|loading|global-error|template|default)\.(ts|tsx)$/,
  /^src\/(instrumentation|middleware|proxy)\.ts$/,
  /\.test\.(ts|tsx)$/,
  /^tests\/setup\.ts$/,
  /^tests\/ui\/layout\/__screenshots__\//,
  /^docs\/design\/canvas\//, // the canvas sources, re-seeded as a directory (DESIGN.md)
];

const TEXT = /\.(ts|tsx|mjs|js|json|md|css|sh|sql|yml|yaml|toml|html|txt)$/;
const bodies = new Map(files.filter((f) => TEXT.test(f)).map((f) => [f, readFileSync(path.join(ROOT, f), "utf8")]));

const GENERIC = new Set(["README.md", "index.ts", "index.tsx", "types.ts", "action.yml"]);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function needles(f) {
  const ext = path.extname(f);
  const noExt = f.slice(0, -ext.length);
  const base = path.basename(noExt);
  const out = [new RegExp(esc(f)), new RegExp(esc(noExt) + "(?![\\w-])")];
  // An index module is named by its directory.
  const name = base === "index" ? path.basename(path.dirname(f)) : base;
  // A README is named by the directory it documents (its last two segments,
  // the way a test names `__fixtures__/routes`).
  if (base === "README") {
    out.push(new RegExp(esc(path.dirname(f).split("/").slice(-2).join("/")) + "(?![\\w.-])"));
    return out;
  }
  out.push(new RegExp(`[/'"\`]${esc(name)}(${esc(ext)})?['"\`]`));
  // A stylesheet, script or fixture named by its file name alone — never a
  // generic one (`README.md`, `index.ts`), which only its path can name.
  if (!GENERIC.has(path.basename(f))) {
    out.push(new RegExp(`(^|[^\\w.-])${esc(path.basename(f))}(?![\\w-])`));
  }
  return out;
}

const orphans = [];
for (const f of files) {
  if (ENTRY.some((re) => re.test(f))) continue;
  const res = needles(f);
  let hit = false;
  for (const [other, body] of bodies) {
    if (other === f) continue;
    if (res.some((re) => re.test(body))) { hit = true; break; }
  }
  if (!hit) orphans.push(f);
}
for (const f of orphans) console.log(f);
console.error(`orphans: ${orphans.length} of ${files.length} tracked files are referenced by nothing`);
process.exit(orphans.length > 0 ? 1 : 0);
