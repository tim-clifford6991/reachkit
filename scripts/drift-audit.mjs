#!/usr/bin/env node
// Deterministic drift audit: the spec ↔ src ↔ tests ↔ the rulings.
//
// 2026-09-11: the corpus is five files and the spec is `docs/SPEC.md`, whose
// sections are `§0`–`§12`. Every `// BUILD §x.y` marker in src and tests
// cites the *previous* numbering, and the owner ruled those markers are left
// alone — they resolve through the root pointer into
// `docs/archive/2026-09-11/`. So this audit keeps reading the two frozen
// documents its own rules are written against; re-baselining it onto
// `docs/SPEC.md`'s numbering is its own change, with its own issue.
// Same input, same output. It reads files; it has no opinions.
//
// Exit 1 only on HARD findings (a malformed DECISIONS.md, or anything when run
// with --strict). Everything else is a report row for a human or the nightly
// drift issue. Tighten by moving a section from SOFT to HARD once its baseline
// is clean — that is how the audit ratchets without ever being red on day one.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const strict = process.argv.includes("--strict");
const read = (p) => readFileSync(path.join(ROOT, p), "utf8");

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

// ---------------------------------------------------------------- BUILD.md
const build = read("docs/archive/2026-09-11/BUILD.md");
const sections = [...build.matchAll(/^(#{2,3}) (\d+(?:\.\d+)?[a-z]?)\.? (.+)$/gm)].map((m) => ({
  level: m[1].length,
  id: m[2],
  title: m[3].trim(),
}));

// Sections that are *built* (have code) — screens, engine, jobs, mail, payments,
// guardrails. Design/process/meta sections are excluded on purpose.
const BUILDABLE = /^(4\.[1-7]|5|6\.[4-7]|7|8|9|11|12|13|14)$/;
const srcFiles = walk("src", (f) => /\.(ts|tsx)$/.test(f) && !f.endsWith(".generated.ts") && !f.endsWith(".d.ts"));
const testFiles = walk("tests", (f) => /\.test\.(ts|tsx)$/.test(f));
const markerRe = /BUILD(?:\.md)? §(\d+(?:\.\d+)?[a-z]?)/g;
const markersIn = (files) => {
  const map = new Map();
  for (const f of files) {
    for (const m of read(f).matchAll(markerRe)) {
      const id = m[1];
      if (!map.has(id)) map.set(id, new Set());
      map.get(id).add(f);
    }
  }
  return map;
};
const srcMarkers = markersIn(srcFiles);
const testMarkers = markersIn(testFiles);

for (const s of sections.filter((s) => BUILDABLE.test(s.id))) {
  const inSrc = srcMarkers.get(s.id)?.size ?? 0;
  const inTests = testMarkers.get(s.id)?.size ?? 0;
  const sub = [...srcMarkers.keys()].filter((k) => k.startsWith(s.id + ".")).length;
  if (inSrc + sub === 0) add("spec→code", "GAP", `§${s.id} ${s.title}`, inTests ? `${inTests} test(s) cite it but no src module carries the marker — unbuilt, or built unmarked` : "no `BUILD §" + s.id + "` marker in src or tests — unbuilt, or built unmarked");
  else if (inTests === 0) add("spec→code", "UNTESTED", `§${s.id} ${s.title}`, `${inSrc} src file(s) marked, no test cites it`);
  else add("spec→code", "OK", `§${s.id} ${s.title}`, `${inSrc} src · ${inTests} tests`);
}

// Markers that cite a section BUILD.md does not have.
const known = new Set(sections.map((s) => s.id));
for (const [id, files] of [...srcMarkers, ...testMarkers]) {
  if (!known.has(id)) add("code→spec", "DANGLING", `§${id}`, `cited by ${[...files][0]} but BUILD.md has no such section`);
}

// ------------------------------------------------------------------- routes
const routeFiles = walk("src/app", (f) => /\/(page|route)\.tsx?$/.test(f));
for (const f of routeFiles) {
  let r = f.replace(/^src\/app/, "").replace(/\/(page|route)\.tsx?$/, "") || "/";
  // A catch-all segment is `[[...slug]]` on disk. The single-bracket rewrite
  // below turns that into `{[...slug}]` — a string no document can contain, so
  // the route could never be found however BUILD.md spelled it (issue #378).
  // Optional catch-alls collapse first, then catch-alls, then plain segments.
  r = r
    .replace(/\/\([^)]+\)/g, "")
    .replace(/\[\[\.\.\.([^\]]+)\]\]/g, "{...$1}")
    .replace(/\[\.\.\.([^\]]+)\]/g, "{...$1}")
    .replace(/\[([^\]]+)\]/g, "{$1}") || "/";
  const specced = build.includes("`" + r + "`") || build.includes(r + " ") || build.includes(r + "\n") || build.includes(r + "`");
  add("routes", specced ? "OK" : "UNSPECCED", r, specced ? f : `${f} — route not named anywhere in BUILD.md`);
}

// --------------------------------------------------------------- journeys
// One end-to-end test per arrow in BUILD §3. Editing §3 means editing this list
// (this file is CODEOWNERS-owned, so that is an owner change).
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

// ------------------------------------------------------------- DECISIONS.md
const dec = read("docs/archive/2026-09-11/DECISIONS.md").split("\n");
let lastDate = "";
let n = 0;
for (const [i, line] of dec.entries()) {
  if (!line.trim() || line.startsWith("#") || line.startsWith("Append-only") || line.startsWith("Format") || line.startsWith("reasoning") || !/^\d/.test(line)) {
    if (/^\d/.test(line)) {/* falls through below */} else continue;
  }
  const m = line.match(/^(\d{4}-\d{2}-\d{2})  \S/);
  if (!m) { add("decisions", "MALFORMED", `line ${i + 1}`, "expected `YYYY-MM-DD  ruling`", true); continue; }
  if (m[1] < lastDate) add("decisions", "MALFORMED", `line ${i + 1}`, `date ${m[1]} is before the previous line's ${lastDate} — append-only, newest last`, true);
  lastDate = m[1];
  n++;
}
add("decisions", "OK", "DECISIONS.md", `${n} rulings, dates non-decreasing`);

// ------------------------------------------------------------- constants
const constantsSrc = existsSync(path.join(ROOT, "src/lib/config/constants.ts")) ? read("src/lib/config/constants.ts") : "";
const pins = existsSync(path.join(ROOT, "tests/pins.test.ts"));
add("pins", pins ? "OK" : "MISSING", "tests/pins.test.ts", pins ? "present" : "BUILD §1 and vitest.config.ts name it; it does not exist");
const priceBook = [...build.matchAll(/^\| `([A-Z_ \/]+)` \| ([^|]+) \|$/gm)].map((m) => m[1].split("/").map((s) => s.trim()));
for (const names of priceBook) {
  // The book names a value; `constants.ts` names the *identifier that holds*
  // it, and its convention adds a unit suffix — `_C` for cents — which is
  // information the book's name does not carry. `SERP_LIVE` is pinned as
  // `SERP_LIVE_C`, and the caps live in a `CAPS` object as `FREE_C` rather
  // than `CAP_FREE`. A `\b` match sees neither, so every price row read as
  // UNPINNED while all five were in fact pinned (issue #378).
  //
  // Renaming the constants to the book's spelling would delete the unit from
  // the identifier, so the audit learns the convention instead: a book name
  // matches itself, itself plus a unit suffix, or — for a `CAP_X` row — the
  // `X` the `CAPS` object holds.
  const aliases = (nm) => {
    const bare = nm.replace(/^CAP_/, "");
    return [nm, `${nm}_C`, bare, `${bare}_C`];
  };
  const found = names.some((nm) =>
    aliases(nm).some((alias) => new RegExp(`\\b${alias}\\b`).test(constantsSrc))
  );
  if (!found) add("pins", "UNPINNED", names.join(" / "), "named in BUILD §6.1 price book, no identifier of that name in constants.ts (may be pinned under another name — say which, or rename)");
}

// ------------------------------------------------------------------ output
const order = { MALFORMED: 0, GAP: 1, MISSING: 2, DANGLING: 3, UNSPECCED: 4, UNPINNED: 5, UNTESTED: 6, TODO: 7, OK: 9 };
rows.sort((a, b) => (order[a.status] ?? 8) - (order[b.status] ?? 8) || a.area.localeCompare(b.area) || a.subject.localeCompare(b.subject));
const findings = rows.filter((r) => r.status !== "OK");
console.log(`## Drift audit — ${findings.length} finding(s), ${rows.length - findings.length} OK${strict ? " (strict)" : ""}\n`);
console.log("| Area | Status | Subject | Detail |\n|---|---|---|---|");
for (const r of rows) console.log(`| ${r.area} | ${r.status} | ${r.subject.replace(/\|/g, "\\|")} | ${r.detail.replace(/\|/g, "\\|")} |`);
console.log(`\n_Hard failures: ${hard}. A GAP is a BUILD section with no code marker — open an issue or add \`// BUILD §x.y\` to the module that implements it. UNSPECCED is code BUILD.md never mentions — spec it or delete it._`);
process.exit(hard > 0 ? 1 : 0);
