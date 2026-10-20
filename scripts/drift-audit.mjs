#!/usr/bin/env node
// Deterministic drift audit: docs/SPEC.md and its dated rulings under
// docs/spec/decisions/ ↔ src ↔ tests. It reads files and compares them; it
// has no opinions and never reads the clock.
// Exit 1 on a hard finding, or on any non-OK row under --strict.
// --root <dir> audits another checkout.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { readDecisions, specSections } from "./spec-decisions.mjs";
import { MEASUREMENT_DOC, measurementDoc } from "./measurement-doc.mjs";
import { PROCESS_DOC, processMap } from "./process-map.mjs";

const rootAt = process.argv.indexOf("--root");
const ROOT = rootAt > 0
  ? path.resolve(process.argv[rootAt + 1])
  : path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const strict = process.argv.includes("--strict");
const read = (p) => (existsSync(path.join(ROOT, p)) ? readFileSync(path.join(ROOT, p), "utf8") : null);
const spec = read("docs/SPEC.md") ?? "";
// Owner 2026-10-18, #1525: a dated ruling is its own file. Every reader of
// the spec reads SPEC.md and those files as one text, each named by its file.
const decisions = readDecisions(ROOT);
const sources = [{ file: "docs/SPEC.md", text: spec }, ...decisions.map((d) => ({ file: d.file, text: d.body }))];

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
for (const { file, text } of sources) {
  for (const m of text.matchAll(SPEC_COPY_RE)) {
    const [key, quoted] = [m[1], m[2]];
    const held = registry.get(key);
    if (!held) add("copy", "MISSING", key, `quoted in ${file}, no partition under src/lib/presentation/copy/keys/ declares it`);
    else if (plain(held.text) !== plain(quoted)) add("copy", "MISMATCH", key, `${file} quotes "${quoted}" · ${held.file} holds "${held.text}"`);
    else add("copy", "OK", key, held.file);
  }
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
const specRoutes = new Map();
for (const { file, text } of sources) {
  for (const m of text.matchAll(/`(\/[^`\s]*)`/g)) if (!specRoutes.has(m[1])) specRoutes.set(m[1], file);
}
for (const [r, file] of [...specRoutes].sort(([a], [b]) => a.localeCompare(b))) {
  if (routes.has(r)) add("routes", "OK", r, `named in ${file}, present in src/app`);
  else add("routes", "MISSING", r, `named in ${file}, no page or route file in src/app maps to it`);
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

const markers = sources.flatMap(({ text }) => [...text.matchAll(/\((\d{4})-(\d{2})-(\d{2})\)/g)]);
const bad = new Set();
for (const m of markers) {
  if (!isRealDate(+m[1], +m[2], +m[3])) bad.add(`${m[1]}-${m[2]}-${m[3]}`);
}
for (const date of [...bad].sort()) add("rulings", "MALFORMED", date, "dated ruling marker in docs/SPEC.md or a decision file is not a real calendar date", true);
const dates = new Set(markers.map((m) => `${m[1]}-${m[2]}-${m[3]}`));
add("rulings", "OK", "docs/SPEC.md", `${markers.length} dated ruling marker(s), ${dates.size} distinct date(s), ${bad.size} malformed`);

// A decision file names a real date, its issue, and a section SPEC.md has.
const sectionIds = new Set(specSections(spec).map((s) => s.id));
for (const d of decisions) {
  if (d.problems.length) add("rulings", "MALFORMED", d.file, d.problems.join("; "), true);
  else if (!sectionIds.has(d.section)) add("rulings", "MISSING", d.file, `section ${d.section} is not a heading of docs/SPEC.md`, true);
  else add("rulings", "OK", d.file, `${d.section}, #${d.issue}`);
}

// ----------------------------------------------------------------- coherence
// Owner 2026-10-15, #1463. The registry lives in docs/PROCESS.md Coherence.
// A named check file must exist. `pending` is allowed only on the three
// parents whose check is not written yet. A pull request body is read only
// when --require-pr-body is set, from the PR_BODY environment variable. A
// heading is followed by a blank line in a real body, so a section runs
// until the next heading or the end of the whole body.
const PENDING_OK = new Set(["1454", "1127", "1457"]);
const REQUIRED_PARENTS = ["1454", "1127", "1457", "1458"];
const registryParents = new Set();

function coherenceSection(doc) {
  const start = doc.indexOf("\n### Coherence\n");
  if (start < 0) return null;
  const rest = doc.slice(start + 1);
  const next = rest.slice("### Coherence\n".length).search(/\n### /);
  return next < 0 ? rest : rest.slice(0, next + "### Coherence\n".length);
}

function sectionBody(text, heading) {
  const normalised = text.replace(/\r\n/g, "\n");
  const re = new RegExp(`(?:^|\\n)## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`);
  const found = normalised.match(re);
  if (!found) return null;
  return found[1].replace(/<!--[\s\S]*?-->/g, "").trim();
}

const processDoc = read("docs/PROCESS.md");
const coherenceText = coherenceSection(processDoc ?? "");
if (!coherenceText) {
  add("coherence", "MISSING", "docs/PROCESS.md", "Current has no ### Coherence section", true);
} else {
  const parsed = [];
  for (const line of coherenceText.split("\n")) {
    if (!line.startsWith("| #")) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length !== 4) {
      add("coherence", "MALFORMED", line, "a registry row needs Parent, Surface, Condition, Check", true);
      continue;
    }
    parsed.push({ parent: cells[0], surface: cells[1], condition: cells[2], check: cells[3] });
  }
  const seenParents = new Set();
  for (const row of parsed) {
    const number = /^#(\d+)$/.exec(row.parent)?.[1];
    if (!number) {
      add("coherence", "MALFORMED", row.parent, "parent is not an issue number", true);
      continue;
    }
    if (seenParents.has(number)) add("coherence", "MALFORMED", row.parent, "parent listed twice", true);
    seenParents.add(number);
    registryParents.add(number);
    if (row.check === "pending") {
      if (!PENDING_OK.has(number)) add("coherence", "MISSING", row.parent, "a new condition needs a check file, not pending", true);
      else add("coherence", "OK", row.parent, `${row.surface}: pending, allowed for this parent`);
    } else if (!/^(tests|scripts)\/[\w./-]+\.(ts|tsx|mjs)$/.test(row.check) || !existsSync(path.join(ROOT, row.check))) {
      add("coherence", "MISSING", row.parent, `check file missing or not a test path: ${row.check}`, true);
    } else {
      add("coherence", "OK", row.parent, row.check);
    }
  }
  for (const number of REQUIRED_PARENTS) {
    if (!seenParents.has(number)) add("coherence", "MISSING", `#${number}`, "required parent is not in the Coherence registry", true);
  }
}

for (const [rel, needles] of [
  [".github/pull_request_template.md", ["## Conditions", "## Overlaps", "## Surfaces"]],
  [".github/ISSUE_TEMPLATE/feature.md", ["## Surfaces", "## Invariants", "## Overlaps"]],
  [".github/ISSUE_TEMPLATE/bug.md", ["## Surfaces", "## Invariants", "## Overlaps"]],
  ["CLAUDE.md", ["Coherence"]],
  ["docs/DESIGN.md", ["tests/ui/design/strategy.test.ts"]],
]) {
  const text = read(rel);
  if (text == null) {
    add("coherence", "MISSING", rel, "file missing", true);
    continue;
  }
  const absent = needles.filter((needle) => !text.includes(needle));
  if (absent.length) add("coherence", "MISSING", rel, `does not name ${absent.join(", ")}`, true);
  else add("coherence", "OK", rel, needles.join(", "));
}

if (!existsSync(path.join(ROOT, "tests/ui/design/strategy.test.ts"))) {
  add("coherence", "MISSING", "tests/ui/design/strategy.test.ts", "the UI strategy check is not in the tree", true);
}

if (process.argv.includes("--require-pr-body")) {
  const body = process.env.PR_BODY ?? "";
  if (!body.trim()) {
    add("coherence", "MISSING", "pull request", "body is empty", true);
  } else {
    for (const heading of ["Conditions", "Overlaps", "Surfaces"]) {
      const filled = sectionBody(body, heading);
      if (filled == null) add("coherence", "MISSING", `## ${heading}`, `no such section in a body of ${body.length} characters`, true);
      else if (!filled) add("coherence", "MISSING", `## ${heading}`, `empty, or still only the template note, in a body of ${body.length} characters`, true);
      else add("coherence", "OK", `## ${heading}`, "filled");
    }
    // Issue 1482: a registry parent stays open while its row stands. GitHub
    // closes an issue the body names after close, fix or resolve in any
    // tense, with or without a colon, as #n, owner/repo#n or the issue URL.
    // A parent is named with Refs.
    const closing = /\b(close[sd]?|fix(?:e[sd])?|resolve[sd]?)\b:?\s+(?:https:\/\/github\.com\/tim-clifford6991\/reachkit\/issues\/|(?:tim-clifford6991\/reachkit)?#)(\d+)\b/gi;
    for (const m of body.matchAll(closing)) {
      if (registryParents.has(m[2])) add("coherence", "MISSING", `#${m[2]}`, `"${m[0]}" would close a registry parent; use Refs #${m[2]}`, true);
    }
  }
}

// ---------------------------------------------------------------- generated
// Each generated document equals what its registry generates now.
for (const [doc, generate, script] of [
  [MEASUREMENT_DOC, measurementDoc, "scripts/measurement-doc.mjs"],
  [PROCESS_DOC, processMap, "scripts/process-map.mjs"],
]) {
  let want;
  try {
    want = generate(ROOT);
  } catch (e) {
    add("generated", "MALFORMED", doc, `node ${script} cannot run: ${String(e.message).replace(/\n/g, "; ")}`, true);
    continue;
  }
  if (read(doc) === want) add("generated", "OK", doc, `matches node ${script}`);
  else add("generated", "MISMATCH", doc, `differs from its registry: run node ${script}`, true);
}

// -------------------------------------------------------------------- output
const order = { MALFORMED: 0, MISSING: 1, MISMATCH: 2, TODO: 3, OK: 9 };
rows.sort((a, b) => (order[a.status] ?? 8) - (order[b.status] ?? 8) || a.area.localeCompare(b.area) || a.subject.localeCompare(b.subject));
const findings = rows.filter((r) => r.status !== "OK");
console.log(`## Drift audit — ${findings.length} finding(s), ${rows.length - findings.length} OK${strict ? " (strict)" : ""}\n`);
console.log("| Area | Status | Subject | Detail |\n|---|---|---|---|");
for (const r of rows) console.log(`| ${r.area} | ${r.status} | ${r.subject.replace(/\|/g, "\\|")} | ${r.detail.replace(/\|/g, "\\|")} |`);
console.log(`\n_Hard failures: ${hard}. A MISMATCH is a sentence docs/SPEC.md quotes that the copy registry no longer holds — change the spec or the key — or a generated document that differs from its registry — run its script. MISSING is a SPEC-named copy key, route or journey with nothing behind it; TODO is a journey that is a stub; MALFORMED is a dated ruling marker that is not a real date._`);
process.exit(hard > 0 ? 1 : 0);
