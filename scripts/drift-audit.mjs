#!/usr/bin/env node
// Deterministic drift audit: docs/SPEC.md ↔ src ↔ tests. It reads files and
// compares them; it has no opinions and never reads the clock.
// Exit 1 on a hard finding, or on any non-OK row under --strict.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const strict = process.argv.includes("--strict");
const read = (p) => readFileSync(path.join(ROOT, p), "utf8");
const spec = read("docs/SPEC.md");

function walk(dir, pred, out = []) {
  const abs = path.join(ROOT, dir);
  if (!existsSync(abs)) return out;
  for (const e of readdirSync(abs)) {
    const rel = path.join(dir, e);
    const st = statSync(path.join(ROOT, rel));
    if (st.isDirectory()) {
      if (e === "node_modules" || e === ".next") continue;
      walk(rel, pred, out);
    } else if (pred(rel)) out.push(rel);
  }
  return out;
}

const rows = [];
let hard = 0;
const add = (area, status, subject, detail, isHard = false) => {
  rows.push({ area, status, subject, detail });
  if (isHard || (strict && status !== "OK")) hard++;
};

// ---------------------------------------------------------------------- copy
// SPEC quotes owner sentences with straight punctuation where the registry
// holds typographic apostrophes and quotes, so both sides are folded to ASCII
// and to single spaces before they are compared.
const plain = (s) =>
  s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();

// A partition entry is `"the.key": ["the sentence", { ... }]`, and one key's
// sentence sits on the line after its key — the whitespace class spans both.
const ENTRY_RE = /"([\w$.-]+)"\s*:\s*\[\s*"((?:[^"\\]|\\.)*)"/g;
const registry = new Map();
for (const f of walk("src/lib/presentation/copy/keys", (f) => f.endsWith(".ts"))) {
  for (const m of read(f).matchAll(ENTRY_RE)) {
    if (!registry.has(m[1])) registry.set(m[1], { file: f, text: JSON.parse(`"${m[2]}"`) });
  }
}

const SPEC_COPY_RE = /`([\w$-]+(?:\.[\w$-]+)+)`\s*=\s*"([^"]+)"/g;
for (const m of spec.matchAll(SPEC_COPY_RE)) {
  const [key, quoted] = [m[1], m[2]];
  const held = registry.get(key);
  if (!held) add("copy", "MISSING", key, "quoted in docs/SPEC.md, no partition under src/lib/presentation/copy/keys/ declares it");
  else if (plain(held.text) !== plain(quoted)) add("copy", "MISMATCH", key, `SPEC quotes "${quoted}" · ${held.file} holds "${held.text}"`);
  else add("copy", "OK", key, held.file);
}

// -------------------------------------------------------------------- routes
// Route groups drop out; optional catch-alls collapse before catch-alls, and
// catch-alls before plain segments, so `[[...slug]]` never half-rewrites.
const toRoute = (f) =>
  (f
    .replace(/^src\/app/, "")
    .replace(/\/(page|route)\.tsx?$/, "")
    .replace(/\/\([^)]+\)/g, "")
    .replace(/\[\[\.\.\.([^\]]+)\]\]/g, "{...$1}")
    .replace(/\[\.\.\.([^\]]+)\]/g, "{...$1}")
    .replace(/\[([^\]]+)\]/g, "{$1}")) || "/";

const routes = new Set(walk("src/app", (f) => /\/(page|route)\.tsx?$/.test(f)).map(toRoute));
const specRoutes = [...new Set([...spec.matchAll(/`(\/[^`\s]*)`/g)].map((m) => m[1]))].sort();
for (const r of specRoutes) {
  if (routes.has(r)) add("routes", "OK", r, "named in docs/SPEC.md, present in src/app");
  else add("routes", "MISSING", r, "named in docs/SPEC.md, no page or route file in src/app maps to it");
}

// ------------------------------------------------------------------ journeys
// One end-to-end test per arrow in the spec's journeys. Editing that list
// means editing this one (this file is CODEOWNERS-owned, so that is an owner
// change).
const JOURNEYS = [
  ["01-landing-to-report", "/ → /scan/{domain}: scan runs, report renders (JN-001, JN-006)"],
  ["02-report-to-lead", "Email me the page → lead captured → first-page mail (JN-001)"],
  ["03-report-to-paid", "Start → Checkout → webhook → magic link → /setup (JN-002)"],
  ["04-setup-to-first-draft", "three decisions → deep pass → first draft in calendar (JN-002)"],
  ["05-daily-loop", "draft-ready → veto window → publish → +24h verify (JN-003)"],
  ["06-monday", "re-measure → movement mail → verdicts (JN-005)"],
  ["07-account-and-leaving", "settings → billing → export → unpublish/delete (JN-004)"],
];
for (const [name, what] of JOURNEYS) {
  const f = `tests/journeys/${name}.test.ts`;
  if (!existsSync(path.join(ROOT, f))) add("journeys", "MISSING", name, `${what} — no ${f}`);
  else if (/\b(it|test|describe)\.todo\(/.test(read(f))) add("journeys", "TODO", name, `${what} — stub only`);
  else add("journeys", "OK", name, what);
}

// ------------------------------------------------------------------- rulings
// A calendar check, not a clock one: a date is real when the UTC value it
// builds reads back as the same three numbers.
const isRealDate = (y, m, d) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

const markers = [...spec.matchAll(/\((\d{4})-(\d{2})-(\d{2})\)/g)];
const bad = new Set();
for (const m of markers) {
  if (!isRealDate(+m[1], +m[2], +m[3])) bad.add(`${m[1]}-${m[2]}-${m[3]}`);
}
for (const date of [...bad].sort()) add("rulings", "MALFORMED", date, "dated ruling marker in docs/SPEC.md is not a real calendar date", true);
const dates = new Set(markers.map((m) => `${m[1]}-${m[2]}-${m[3]}`));
add("rulings", "OK", "docs/SPEC.md", `${markers.length} dated ruling marker(s), ${dates.size} distinct date(s), ${bad.size} malformed`);

// -------------------------------------------------------------------- output
const order = { MALFORMED: 0, MISSING: 1, MISMATCH: 2, TODO: 3, OK: 9 };
rows.sort((a, b) => (order[a.status] ?? 8) - (order[b.status] ?? 8) || a.area.localeCompare(b.area) || a.subject.localeCompare(b.subject));
const findings = rows.filter((r) => r.status !== "OK");
console.log(`## Drift audit — ${findings.length} finding(s), ${rows.length - findings.length} OK${strict ? " (strict)" : ""}\n`);
console.log("| Area | Status | Subject | Detail |\n|---|---|---|---|");
for (const r of rows) console.log(`| ${r.area} | ${r.status} | ${r.subject.replace(/\|/g, "\\|")} | ${r.detail.replace(/\|/g, "\\|")} |`);
console.log(`\n_Hard failures: ${hard}. A MISMATCH is a sentence docs/SPEC.md quotes that the copy registry no longer holds — change the spec or the key. MISSING is a SPEC-named copy key, route or journey with nothing behind it; TODO is a journey that is a stub; MALFORMED is a dated ruling marker that is not a real date._`);
process.exit(hard > 0 ? 1 : 0);
