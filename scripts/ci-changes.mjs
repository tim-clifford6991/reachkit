#!/usr/bin/env node
// What a pull request changed, for `ci.yml`'s `what changed` job. Reads the
// changed paths on stdin, one per line, prints one line per path and the two
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
// An empty list runs everything.
import { appendFileSync, readFileSync } from "node:fs";

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
];

export function classify(paths) {
  const files = paths.map((p) => p.trim()).filter(Boolean);
  const lines = [];
  let code = files.length === 0;
  let ui = files.length === 0;
  for (const f of files) {
    const isCode = /^(src|tests|supabase|\.github|scripts)\//.test(f) || !(/^docs\//.test(f) || /\.md$/.test(f));
    const isUi = UI.some((re) => re.test(f));
    code ||= isCode;
    ui ||= isUi;
    lines.push(`${isCode ? "code" : "docs"}${isUi ? "  ui" : "    "}  ${f}`);
  }
  return { code, ui, lines };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const { code, ui, lines } = classify(readFileSync(0, "utf8").split("\n"));
  for (const line of lines) console.log(line);
  console.log(`code=${code}`);
  console.log(`ui=${ui}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `code=${code}\nui=${ui}\n`);
}
