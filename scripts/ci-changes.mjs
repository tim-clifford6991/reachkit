#!/usr/bin/env node
// What a pull request changed, for `ci.yml`'s `what changed` job. Reads the
// changed paths on stdin, one per line, prints one line per path and the
// outputs, and appends the outputs to $GITHUB_OUTPUT when it is set.
//
// `code` (owner, 2026-09-24, #1053): false only when every path is under
// `docs/` or is markdown outside src/, tests/, supabase/, .github/ and
// scripts/. The list is of what may skip, so a path nobody thought of runs.
//
// `ui` (owner, 2026-10-18, #1525): true where a path can change what a screen
// renders or how the sweep measures it. False sends `no overflow · axe` to
// its reason line; the nightly run on `main` sweeps every screen anyway.
//
// `db` (owner C3, 2026-10-19): true where a path can change the migrated
// schema or the suite that asserts it. False skips `schema · RLS` at the job.
//
// `unit` (owner C1, 2026-10-19): `affected` runs the unit tests vitest's module
// graph links to the diff, plus every suite that reads the tree from disk;
// `full` runs every one, because a path below reaches tests through no import.
// The nightly run on `main` runs them all.
//
// `--related` prints what an affected unit run hands `vitest related`: the
// diff's paths, the suites that always run, every design suite, and every walker.
//
// An empty list runs everything.
import { appendFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { LIVE_SCHEMA_TESTS } from "./live-schema-tests.mjs";

const UI = [
  /^src\/app\//,
  /^src\/components\//,
  /^src\/ui\//,
  /^src\/lib\/presentation\//,
  // The src/lib modules whose output a screen puts on the page as it is: the
  // markdown, FAQ, byline and sources renderers, the hosted destination's
  // markup and JSON-LD, the templates that shape a page's body, and the mark.
  /^src\/lib\/publish\/render\//,
  /^src\/lib\/publish\/destinations\/hosted\//,
  /^src\/lib\/generate\/templates\//,
  /^src\/lib\/brand\//,
  /^src\/(middleware|proxy)\.ts$/,
  /\.css$/,
  /^public\//,
  /^next\.config\./,
  /^postcss\.config\./,
  /^vitest\.config\./,
  /^package(-lock)?\.json$/,
  /^tests\/ui\//,
  // The sweep itself: its setup, its data, and the job that runs it.
  /^supabase\/migrations\//,
  /^scripts\/db-substrate\//,
  /^\.github\/actions\/(layout-suite|db-substrate|db-substrate-down)\//,
  /^\.github\/workflows\/ci\.yml$/,
  /^scripts\/ci-changes\.mjs$/,
  // The boards and baselines the parity sweep reads, and the sweep's scripts.
  /^docs\/design\/(boards\/canvas|parity)\//,
  /^scripts\/design\//,
];

const DB = [
  /^supabase\//,
  /^src\/lib\/db\//,
  /^tests\/db\//,
  /^scripts\/db-substrate\//,
  /\.sql$/,
  /^package(-lock)?\.json$/,
  /^vitest\.config\./,
  /^scripts\/live-schema-tests\.mjs$/,
  /^\.github\/workflows\//,
  /^\.github\/actions\/db-substrate/,
  // What the live-schema suites import at run time; the test walks them.
  /^src\/lib\/config\/(env|now|constants)\.ts$/,
  /^src\/lib\/opportunities\/(verdicts\/)?types\.ts$/,
  /^src\/lib\/opportunities\/store\.ts$/,
  /^src\/lib\/costs\/(index|daily)\.ts$/,
  /^src\/lib\/scan\/admission\.ts$/,
  /^src\/lib\/scan\/weekly\/(index|access)\.ts$/,
  /^src\/lib\/account\/billing\/index\.ts$/,
  /^tests\/ui\/layout\/seed-rows\.ts$/,
  /^tests\/(mail\/env-fixture|opportunities\/env)\.ts$/,
];

const FULL_UNIT = [
  /^package(-lock)?\.json$/,
  /^vitest\.config\./,
  /^scripts\/live-schema-tests\.mjs$/,
  /^tsconfig.*\.json$/,
  /^tests\/setup/,
  // Shared by many suites: a side-effect env import, and data read from disk.
  /^tests\/generate\/env\.ts$/,
  /(^|\/)fixtures\//,
  /^\.github\/workflows\/ci\.yml$/,
  /^scripts\/ci-changes\.mjs$/,
];

// Suites that reach what they check through no import and no directory walk.
const ALWAYS = ["tests/config/ci-changes.test.ts"];

// Design suites read one fixed file (theme.css, document.tsx) that no import or WALK links.
function designSuites(root) {
  const dir = path.join(root, "tests/ui/design");
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".test.ts")).sort().map((f) => `tests/ui/design/${f}`) : [];
}

const WALK = /readdirSync|globSync|readdir\(|fs\.glob/;

// Test files and helpers that read the tree from disk, so no import links them
// to the files they check. The layout suite runs in its own gate.
export function walkers(root = process.cwd()) {
  return readdirSync(path.join(root, "tests"), { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && /\.[cm]?[jt]sx?$/.test(e.name))
    .map((e) => path.relative(root, path.join(e.parentPath, e.name)).split(path.sep).join("/"))
    .filter((f) => !f.startsWith("tests/ui/layout/") && WALK.test(readFileSync(path.join(root, f), "utf8")))
    .sort();
}

export function related(paths, root = process.cwd()) {
  const files = paths.map((p) => p.trim()).filter(Boolean);
  return [...new Set([...files, ...ALWAYS, ...designSuites(root), ...walkers(root)])];
}

export function classify(paths) {
  const files = paths.map((p) => p.trim()).filter(Boolean);
  const lines = [];
  let code = files.length === 0;
  let ui = files.length === 0;
  let db = files.length === 0;
  let full = files.length === 0;
  for (const f of files) {
    const isCode = /^(src|tests|supabase|\.github|scripts)\//.test(f) || !(/^docs\//.test(f) || /\.md$/.test(f));
    const isUi = UI.some((re) => re.test(f));
    const isDb = DB.some((re) => re.test(f)) || LIVE_SCHEMA_TESTS.includes(f);
    const isFull = FULL_UNIT.some((re) => re.test(f));
    code ||= isCode;
    ui ||= isUi;
    db ||= isDb;
    full ||= isFull;
    const tags = [isCode ? "code" : "docs", isUi ? "ui" : "  ", isDb ? "db" : "  ", isFull ? "full" : "    "];
    lines.push(`${tags.join("  ")}  ${f}`);
  }
  return { code, ui, db, unit: full ? "full" : "affected", lines };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const paths = readFileSync(0, "utf8").split("\n");
  if (process.argv[2] === "--related") {
    for (const f of related(paths)) console.log(f);
  } else {
    const { lines, ...outputs } = classify(paths);
    for (const line of lines) console.log(line);
    const out = Object.entries(outputs).map(([k, v]) => `${k}=${v}\n`).join("");
    process.stdout.write(out);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, out);
  }
}
