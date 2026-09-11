// The derived registry generator — the console's own `npm run registry`.
//
// Faithful port of ReachKit v2's scripts/build-registry.mjs, the reference
// implementation this module is graded against byte-for-byte. That script
// hardcodes one project (its own ROOT/DOCS); this module takes a project
// root and its loaded config so the same generator runs against any
// registered corpus. Everything else — banner text, section ordering,
// coverage-line wording (constitution rule 5.5), node field order, JSON
// indentation, trailing newlines — is carried over unchanged, because the
// acceptance bar for this port is identical bytes, not equivalent behaviour.
//
// DIRECTION OF TRUTH, same as the reference: this module reads every
// artifact file under docsRoot/{requirements,blueprints,decisions,
// work-orders,feedback}/ and writes only into docsRoot/registry/generated/.
// It never reads its own prior output — a generator that reads what it last
// wrote is a merge, not a projection, and a merge is exactly the mechanism
// that let a hand-authored registry drift from the artifacts describing it.
//
// Zero-dependency, plain Node ESM — no import of ReachKit v2's tree. The
// front-matter grammar is read with this console's own read-only parser
// (extract/frontmatter.mjs), which is itself a byte-for-byte port of
// ReachKit v2's scripts/lib/frontmatter.mjs.

import { readFileSync, readdirSync, mkdirSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join, relative } from "node:path";
import { splitFrontmatter } from "../extract/frontmatter.mjs";
import { loadConfig } from "../config.mjs";

const DIRS = ["requirements", "blueprints", "decisions", "work-orders", "feedback", "journeys"];
const TST_HEADING_RE = /^#{1,3}\s+(TST-\d+(?:-R\d*)?)\s+[—-]\s*(.+?)\s*$/gm;

/** The forms a validation report in this corpus uses to DECLARE its verdict,
 *  all line-anchored so a table cell (`| # | Criterion | Verdict |`) can never
 *  match one — it begins with `|`.
 *
 *  HEADING form: a Markdown heading whose text contains the word "verdict"
 *  (`## Verdict`, `#### Final verdict`, `#### Verdict — FIRST PASS …`). Its
 *  value is the FIRST NON-BLANK LINE BENEATH IT.
 *  LABEL form: a line that begins, after an optional list bullet and optional
 *  `**`, with `Verdict:` (`- Verdict: **PASS**`, ``**Verdict: `REJECT`.**``).
 *  Its value is the rest of that line.
 *  BARE-LINE form: a heading-form declaration whose first non-blank line is
 *  PROSE, with the verdict word alone on its own line further down the same
 *  block — `### 10. Verdict`, three paragraphs of reasoning, then
 *  `PASS WITH FINDINGS`. See bareVerdictLineIn().
 *
 *  Carried over from the reference implementation by value, same as
 *  TYPE_BY_DIR below — module scope so a `/g` regex's `lastIndex` is reset at
 *  one known place per call. */
const VERDICT_HEADING_RE = /^#{2,5}[ \t]+.*\bverdict\b.*$/gim;
const VERDICT_LABEL_RE = /^[ \t]*(?:[-*+][ \t]+)?(?:\*\*)?[ \t]*verdict(?:\*\*)?[ \t]*:(.*)$/gim;

/** A heading of ANY level — what ends a verdict heading's block. Levels 1–6,
 *  not the 2–5 of VERDICT_HEADING_RE: this bounds a region rather than
 *  recognising a declaration, and a bare-word scan that ran past an `#` or a
 *  `###### ` would read a later author's prose as this section's verdict. */
const BLOCK_END_RE = /^#{1,6}[ \t]+\S/gm;

/** Furniture that quotes or lists, which is never a declaration. Checked
 *  against the RAW line, before normalizeDeclarationValue() runs: that
 *  function strips `*` as emphasis and folds `-` to a space, so by the time it
 *  is done `- REJECT`, `* REJECT` and `> REJECT` have all become bare
 *  `reject`. Non-global on purpose — a `/g` regex used with .test() carries
 *  `lastIndex` between calls and would skip every other line. */
const LIST_OR_QUOTE_RE = /^[ \t]*(?:[>+*-]|\d+[.)])[ \t]/;

/** The verdict vocabulary — the seven words this corpus's validators actually
 *  write, ordered longest-first so `pass with findings` is tried before
 *  `pass`. `approve`, `approve-with-findings` and `blocked` are NOT folded
 *  onto pass/fail: folding a value the corpus distinguishes into one the
 *  schema prefers is how a derived index starts saying something no validator
 *  said. */
const VERDICT_WORDS = [
  ["pass with findings", "pass-with-findings"],
  ["approve with findings", "approve-with-findings"],
  ["pass", "pass"],
  ["fail", "fail"],
  ["reject", "reject"],
  ["approve", "approve"],
  ["blocked", "blocked"],
];

/** Mirrors ReachKit v2's scripts/lib/frontmatter.mjs TYPE_BY_DIR /
 *  UPSTREAM_FIELD_BY_TYPE exactly, byte for byte on the field names — this
 *  module has no cross-repo import of that file, so the two constants are
 *  carried over by value rather than by reference. */
const TYPE_BY_DIR = {
  requirements: "requirement",
  blueprints: "blueprint",
  decisions: "decision",
  "work-orders": "work-order",
  feedback: "feedback",
  journeys: "journey",
};
const UPSTREAM_FIELD_BY_TYPE = {
  requirement: null,
  blueprint: "satisfies",
  decision: "decides-for",
  "work-order": "implements",
  feedback: "about",
  // A journey's edges live inside its `steps` rows (`exercises`), not in a
  // top-level upstream field — walked separately below (0.8.0; the shipped
  // grammar has declared JN since 0.4.0, and this generator omitting it left
  // graph.json silently incomplete in a way generated-drift, which compares
  // only ids present on BOTH sides, could never catch).
  journey: null,
};

/** Every edge-bearing field this schema recognizes, across all node types —
 *  the set findUnresolvedEdges() and graph.json's coverage block both walk.
 *  `covers` (rule 5.4) is deliberately included alongside the four upstream
 *  fields even though it is non-gate-bearing: an edge that doesn't resolve is
 *  equally silent-and-wrong whether or not it happens to gate anything. */
// Kept in lockstep with extract/index.mjs's FM_EDGE_FIELDS — the same nine
// names, so this generator's coverage block and the console's silent-index
// can never disagree about what the corpus is silent on (0.8.0; they used to
// be 7 vs 9). `exercises` is not here because it is nested in journey
// `steps` rows, not a top-level array — walked specially wherever this list
// is walked.
const EDGE_FIELDS = ["satisfies", "covers", "implements", "decides-for", "about", "depends-on", "blocked-by", "cites-retired", "supersedes"];

const VALID_ORIGINS = ["transcribed", "forward"];

/** `origin` defaults to "forward" only here, at the point of use — never in
 *  storage. Silence is never an exemption; it's just not a DECLARED
 *  exemption, which is the distinction graph.json's coverage block needs to
 *  be able to state. */
function originOf(node) {
  return node.origin ?? "forward";
}

function walkArtifactFiles(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    // A project that hasn't yet grown one of the five directories is not an
    // error here — the same "tolerates partial migration" posture as every
    // other reader in this console. The reference script assumes all five
    // exist (true of ReachKit v2, the corpus it was written against); this
    // port is used across arbitrary registered projects, so it degrades to
    // an empty directory instead of throwing.
    return [];
  }
  return entries
    .filter((f) => f.endsWith(".md") && f !== "_TEMPLATE.md" && f !== "_INDEX.md")
    .map((f) => join(dir, f))
    .sort();
}

/** A declaration's value, reduced to the form the vocabulary is matched
 *  against: any strikethrough span removed outright (a struck verdict is a
 *  SUPERSEDED verdict), then Markdown emphasis stripped, then the hyphen
 *  family folded to spaces, then leading punctuation stripped and whitespace
 *  collapsed.
 *
 *  THE HYPHEN FOLD IS THE ONE CLAUSE HERE THAT CHANGES WHAT AN EXISTING INPUT
 *  RETURNS, and it is a widening that closes a widening. `PASS-WITH-FINDINGS`
 *  used to return `pass`: leadingVerdictWord() matched the leading `pass` and
 *  its `!/[a-z]/` guard was satisfied by the hyphen, so the longest-first
 *  ordering never got the chance to prefer `pass with findings`. That is a
 *  silent widening in the DANGEROUS direction — a findings-bearing verdict
 *  read as a clean one — so the fold makes the ordering resolve it instead.
 *  Tightening the guard to reject a following hyphen was the alternative; it
 *  returns `unknown`, which is safe but discards a verdict a validator
 *  plainly wrote.
 *
 *  ORDER IS LOAD-BEARING. After emphasis stripping, or a backticked
 *  `PASS-WITH-FINDINGS` keeps its backticks; before the leading-punctuation
 *  strip, or a leading dash is consumed as punctuation first.
 *
 *  Left alone deliberately: `PASS_WITH_FINDINGS` returns `unknown`, because
 *  `_` is stripped as Markdown emphasis before any of this runs and the words
 *  fuse. Nothing in the corpus writes it, the direction is safe, and widening
 *  emphasis stripping to catch an implausible form is a bigger blast radius
 *  than the defect.
 *  @param {string} value
 *  @returns {string} */
function normalizeDeclarationValue(value) {
  return value
    .replace(/~~[\s\S]*?~~/g, " ")
    .replace(/[*`_]/g, "")
    .replace(/[-\u2010-\u2015]/g, " ")
    .replace(/^[^\p{L}]+/u, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** The verdict word a declaration's value LEADS with, or null. It is never
 *  scanned out of prose: `**PASS** — TST-003's REJECT is **lifted**.` is
 *  `pass`, because PASS leads and REJECT is argument. Position decides;
 *  precedence breaks ties only between words starting at the same offset,
 *  which is the sole reason VERDICT_WORDS is ordered longest-first.
 *  @param {string} value
 *  @returns {string|null} */
function leadingVerdictWord(value) {
  const v = normalizeDeclarationValue(value);
  for (const [word, verdict] of VERDICT_WORDS) {
    if (v.startsWith(word) && !/[a-z]/.test(v.charAt(word.length))) return verdict;
  }
  return null;
}

/** The first non-blank line after the line containing `offset`.
 *  @param {string} section
 *  @param {number} offset
 *  @returns {string} */
function firstNonBlankLineAfter(section, offset) {
  for (const line of section.slice(offset).split("\n").slice(1)) {
    if (line.trim() !== "") return line;
  }
  return "";
}

/** The BARE-LINE declaration inside one verdict heading's block, or null.
 *
 *  The block runs from the heading line to the next heading of any level, or
 *  to the end of the section. Within it, the FIRST paragraph line whose ENTIRE
 *  normalised content equals a VERDICT_WORDS entry is the declaration, and its
 *  own offset is its position for readVerdict()'s last-wins tie-break.
 *
 *  WHOLE-LINE EQUALITY, NEVER CONTAINMENT, and the difference is a real
 *  reversal rather than a nicety. TST-029's `### Why the verdict word is
 *  wrong, and CON-079 should widen to admit this shape` opens *"ADR-043 §B.1
 *  admits two words and neither describes this pass."* Under containment that
 *  block declares `pass`, and because the heading sits AFTER the report's
 *  `- **Verdict: `REJECT`` bullet, last-wins would carry a validator's refusal
 *  to a pass. Measured over the corpus: containment moves four sections and
 *  that is one of them. Prose scanning is what WO-116 removed; this is what
 *  keeps it removed.
 *  @param {string} section
 *  @param {number} headingAt  offset of the verdict heading that owns the block
 *  @returns {{at: number, word: string}|null} */
function bareVerdictLineIn(section, headingAt) {
  BLOCK_END_RE.lastIndex = headingAt + 1;
  const next = BLOCK_END_RE.exec(section);
  const block = section.slice(headingAt, next ? next.index : section.length);
  let at = headingAt;
  let isHeadingLine = true;
  for (const line of block.split("\n")) {
    const lineAt = at;
    at += line.length + 1;
    if (isHeadingLine) {
      isHeadingLine = false;
      continue;
    }
    if (LIST_OR_QUOTE_RE.test(line)) continue;
    const v = normalizeDeclarationValue(line);
    for (const [word, verdict] of VERDICT_WORDS) {
      if (v === word) return { at: lineAt, word: verdict };
    }
  }
  return null;
}

/** The verdict a TST section DECLARES, or `unknown` when it declares none.
 *
 *  Reads only the three declaration forms above, takes the LAST one that
 *  yields a recognised word, and returns `unknown` otherwise. Last-wins
 *  because a section that supersedes its own first pass says so at the end;
 *  the cost is that a header bullet reading PASS WITH FINDINGS is narrowed to
 *  a closing `## Verdict` section's bare PASS, which is a narrowing between
 *  two passing verdicts rather than a reversal.
 *
 *  THE BARE-LINE SCAN IS A FALLBACK, NEVER A REPLACEMENT. The first-non-blank-
 *  line rule keeps priority: `### Verdict` followed by `**PASS.** Every
 *  acceptance criterion met` is still read from that first line. Only when it
 *  yields no word is the heading's block scanned, and only a whole line
 *  equalling a verdict word counts there. That ordering is what stops a
 *  section's reasoning from outvoting its own declaration.
 *
 *  The third form was added because the rule that quoted TST-059's sentence
 *  as its authority could not read TST-059's last line: three reports
 *  (TST-043, TST-059, TST-073) state PASS WITH FINDINGS under a heading whose
 *  first non-blank line is prose, and the index rendered all three `unknown`.
 *
 *  `unknown` is a real answer here, not a residue: a remediation record
 *  appended under a TST heading declares no verdict, and saying so is the
 *  point. traceability.md states how many sections come out that way.
 *  @param {string} section  ONE TST section, heading-end to the next heading
 *  @returns {string} */
export function readVerdict(section) {
  const declarations = [];
  VERDICT_HEADING_RE.lastIndex = 0;
  let m;
  while ((m = VERDICT_HEADING_RE.exec(section))) {
    const word = leadingVerdictWord(firstNonBlankLineAfter(section, m.index));
    if (word) declarations.push({ at: m.index, word });
    else {
      const bare = bareVerdictLineIn(section, m.index);
      if (bare) declarations.push(bare);
    }
  }
  VERDICT_LABEL_RE.lastIndex = 0;
  while ((m = VERDICT_LABEL_RE.exec(section))) {
    const word = leadingVerdictWord(m[1]);
    if (word) declarations.push({ at: m.index, word });
  }
  declarations.sort((a, b) => a.at - b.at);

  let verdict = "unknown";
  for (const d of declarations) verdict = d.word;
  return verdict;
}

/** Parse every artifact file under `root`'s docsRoot into a node. Returns
 *  { nodes: Map<id, node>, errors: string[], warnings: string[] }. `nodes`
 *  includes only files that HAVE a front-matter block — an unmigrated file
 *  is silently absent, not an error.
 *  @param {string} root  project root (paths in `file` are relative to this)
 *  @param {object} config  a validated factory.config.json (docsRoot used) */
export function buildGraph(root, config) {
  const DOCS = resolve(root, config.docsRoot);
  const nodes = new Map();
  const errors = [];

  for (const dirName of DIRS) {
    const expectedType = TYPE_BY_DIR[dirName];
    const dir = resolve(DOCS, dirName);
    for (const filePath of walkArtifactFiles(dir)) {
      const rel = relative(root, filePath);
      const raw = readFileSync(filePath, "utf8");
      let parsed;
      try {
        parsed = splitFrontmatter(raw);
      } catch (e) {
        errors.push(`${rel}: MALFORMED front-matter block — ${e.message}`);
        continue;
      }
      if (parsed.data === null) continue; // not yet migrated — tolerated, not an error

      const data = parsed.data;
      const filename = filePath.split("/").pop();
      const idFromFilename = /^([A-Z]+-[0-9]+[a-z]?)-/.exec(filename)?.[1];

      if (!data.id) {
        errors.push(`${rel}: front-matter has no id`);
        continue;
      }
      if (idFromFilename && data.id !== idFromFilename) {
        errors.push(`${rel}: front-matter id "${data.id}" does not match filename id "${idFromFilename}"`);
      }
      if (data.type !== expectedType) {
        errors.push(`${rel}: front-matter type "${data.type}" does not match its directory (expected "${expectedType}")`);
      }
      const wantUpstream = UPSTREAM_FIELD_BY_TYPE[expectedType];
      if (wantUpstream && !(wantUpstream in data)) {
        errors.push(`${rel}: type "${expectedType}" must carry its upstream edge as "${wantUpstream}" — field is missing`);
      }
      for (const otherField of ["satisfies", "implements", "decides-for", "about"]) {
        if (otherField !== wantUpstream && otherField in data) {
          errors.push(`${rel}: carries "${otherField}" but type "${expectedType}"'s upstream field is "${wantUpstream ?? "(none — requirement is the graph root)"}" — wrong key for this type`);
        }
      }
      if (data.origin !== undefined && !VALID_ORIGINS.includes(data.origin)) {
        errors.push(`${rel}: origin "${data.origin}" is not one of ${JSON.stringify(VALID_ORIGINS)}`);
      }
      if (nodes.has(data.id)) {
        errors.push(`${rel}: duplicate id "${data.id}" — already defined by ${nodes.get(data.id).file}`);
        continue;
      }

      nodes.set(data.id, { ...data, file: rel, _raw: raw });

      // TST nodes: derived structurally from headings inside this WO's body.
      // The headings are pre-scanned so each section can be bounded by the
      // NEXT heading's start rather than running to EOF. That bound is a
      // prerequisite of readVerdict's last-declaration rule, not a tidy-up:
      // an unbounded "body" would let one section read the verdict declared
      // by a later one.
      if (expectedType === "work-order") {
        TST_HEADING_RE.lastIndex = 0;
        const headings = [];
        let m;
        while ((m = TST_HEADING_RE.exec(raw))) headings.push({ id: m[1], title: m[2], start: m.index, end: m.index + m[0].length });
        for (let i = 0; i < headings.length; i++) {
          const h = headings[i];
          if (nodes.has(h.id)) {
            errors.push(`${rel}: duplicate TST id "${h.id}" — already defined by ${nodes.get(h.id).file}`);
            continue;
          }
          const section = raw.slice(h.end, i + 1 < headings.length ? headings[i + 1].start : raw.length);
          nodes.set(h.id, {
            id: h.id,
            type: "validation",
            title: h.title,
            status: readVerdict(section),
            validates: [data.id],
            file: rel,
          });
        }
      }
    }
  }

  const warnings = findUnresolvedEdges(nodes);
  return { nodes, errors, warnings };
}

/** Every unresolved edge in the graph, as structured records rather than
 *  pre-formatted strings.
 *  @param {Map<string, any>} nodes
 *  @returns {{node: any, field: string, target: string}[]} */
function collectUnresolvedEdges(nodes) {
  const out = [];
  for (const n of [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    for (const field of EDGE_FIELDS) {
      const vals = n[field];
      if (!Array.isArray(vals)) continue;
      for (const target of vals) {
        if (!nodes.has(target)) out.push({ node: n, field, target });
      }
    }
    // Journey `exercises` ids live inside `steps` rows — walked here so an
    // unresolved journey edge is as visible as any other (0.8.0).
    for (const row of Array.isArray(n.steps) ? n.steps : []) {
      for (const target of Array.isArray(row?.exercises) ? row.exercises : []) {
        if (!nodes.has(target)) out.push({ node: n, field: "exercises", target });
      }
    }
  }
  return out;
}

/** Flat list of "does not resolve" lines — non-fatal, used only for CLI
 *  reporting (never rendered into a generated file).
 *  @param {Map<string, any>} nodes
 *  @returns {string[]} */
export function findUnresolvedEdges(nodes) {
  return collectUnresolvedEdges(nodes).map(
    ({ node: n, field, target }) => `${n.file ?? n.id}: ${n.id} \`${field}\` -> ${target} does not resolve to any node in the graph`,
  );
}

/** Splits unresolved edges into "cites a retired CON-###/ASM-### id" (rule
 *  2.3 — history, not a defect) vs. everything else (a real target that
 *  should be a node and isn't).
 *  @param {Map<string, any>} nodes
 *  @returns {{ retired: string[], defect: string[] }} */
export function classifyUnresolvedEdges(nodes) {
  const RETIRED_PREFIX_RE = /^(CON|ASM)-/;
  const retired = [];
  const defect = [];
  for (const { node: n, field, target } of collectUnresolvedEdges(nodes)) {
    const line = `${n.file ?? n.id}: ${n.id} \`${field}\` -> ${target} does not resolve to any node in the graph`;
    (RETIRED_PREFIX_RE.test(target) ? retired : defect).push(line);
  }
  return { retired, defect };
}

/** Coverage stat for rule 5.5 — "how many artifacts carry the field it
 *  projects, and how many do not."
 *  @param {any[]} nodeList
 *  @param {string} field
 *  @returns {{carrying: number, total: number}} */
function coverageStat(nodeList, field) {
  const total = nodeList.length;
  const carrying = nodeList.filter((n) => {
    const v = n[field];
    return Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && v !== "";
  }).length;
  return { carrying, total };
}

/** One rule-5.5 sentence: "`field` is projected from N of M `label`." Every
 *  generated file carries at least one of these so omission never reads as
 *  nothing-to-report.
 *  @param {any[]} nodeList
 *  @param {string} field
 *  @param {string} label
 *  @returns {string} */
function coverageLine(nodeList, field, label) {
  const { carrying, total } = coverageStat(nodeList, field);
  return `\`${field}\` is projected from ${carrying} of ${total} ${label} — the rest are silent on it.`;
}

// ── graph.json ───────────────────────────────────────────────────────────
const NODE_FIELD_ORDER = [
  "id",
  "type",
  "title",
  "status",
  "severity",
  "origin",
  "satisfies",
  "covers",
  "implements",
  "decides-for",
  "about",
  "validates",
  "depends-on",
  "blocked-by",
  "cites-retired",
  "rests-on",
  "supersedes",
  "code",
  "persona",
  "steps",
  "file",
];

function orderedNode(node) {
  const out = {};
  for (const k of NODE_FIELD_ORDER) {
    if (k in node) out[k] = Array.isArray(node[k]) && k !== "rests-on" && k !== "steps" ? [...node[k]].sort() : node[k];
  }
  return out;
}

/** Rule 5.5 for the one generated output that isn't Markdown: a `coverage`
 *  object, sibling to `nodes`, stating for every edge field (plus `origin`
 *  and `rests-on`) how many of the nodes that could carry it actually do. */
function computeGraphCoverage(nodes) {
  const all = [...nodes.values()];
  const coverage = {};
  for (const field of [...EDGE_FIELDS, "rests-on", "code"]) {
    const { carrying, total } = coverageStat(all, field);
    coverage[field] = { carrying, total };
  }
  // `exercises` is nested in journey `steps` rows rather than stored as a
  // top-level array — counted specially so this block carries the same key
  // set extract()'s fieldCoverage does (0.8.0 parity).
  coverage["exercises"] = {
    carrying: all.filter((n) => (Array.isArray(n.steps) ? n.steps : []).some(
      (s) => Array.isArray(s?.exercises) && s.exercises.length > 0)).length,
    total: all.length,
  };
  const { carrying, total } = coverageStat(all, "origin");
  coverage["origin"] = { carrying, total }; // "carrying" here = explicitly declared, not defaulted
  return coverage;
}

export function renderGraphJson(nodes) {
  const ids = [...nodes.keys()].sort();
  const out = { coverage: computeGraphCoverage(nodes), nodes: {} };
  for (const id of ids) out.nodes[id] = orderedNode(nodes.get(id));
  return JSON.stringify(out, null, 2) + "\n";
}

// ── banner ───────────────────────────────────────────────────────────────
function banner(title) {
  return (
    `<!-- GENERATED by scripts/build-registry.mjs from front-matter under sdlc-factory/docs/{requirements,blueprints,decisions,work-orders,feedback,journeys}/.\n` +
    `     DO NOT HAND-EDIT — edits here are silently overwritten on the next \`factory-console registry\` and \`factory-console registry --check\` fails on drift.\n` +
    `     To change what this file says, change the front-matter of the artifact it describes and regenerate. -->\n\n` +
    `# ${title}\n\n`
  );
}

// ── traceability.md — REQ → BP → WO → TST ──────────────────────────────────
export function renderTraceability(nodes) {
  const reqs = [...nodes.values()].filter((n) => n.type === "requirement").sort((a, b) => a.id.localeCompare(b.id));
  const bps = [...nodes.values()].filter((n) => n.type === "blueprint");
  const wos = [...nodes.values()].filter((n) => n.type === "work-order");
  const tsts = [...nodes.values()].filter((n) => n.type === "validation");

  const rows = [];
  for (const req of reqs) {
    const childBps = bps.filter((bp) => (bp.satisfies ?? []).includes(req.id)).sort((a, b) => a.id.localeCompare(b.id));
    if (childBps.length === 0) {
      rows.push({ req: req.id, bp: "—", wo: "—", tst: "—" });
      continue;
    }
    for (const bp of childBps) {
      const childWos = wos.filter((wo) => (wo.implements ?? []).includes(bp.id)).sort((a, b) => a.id.localeCompare(b.id));
      if (childWos.length === 0) {
        rows.push({ req: req.id, bp: bp.id, wo: "—", tst: "—" });
        continue;
      }
      for (const wo of childWos) {
        const childTsts = tsts.filter((t) => (t.validates ?? []).includes(wo.id)).sort((a, b) => a.id.localeCompare(b.id));
        if (childTsts.length === 0) {
          rows.push({ req: req.id, bp: bp.id, wo: wo.id, tst: "—" });
          continue;
        }
        for (const t of childTsts) rows.push({ req: req.id, bp: bp.id, wo: wo.id, tst: `${t.id} (${t.status})` });
      }
    }
  }

  let out = banner("Traceability — REQ → BP → WO → TST");
  out += `- ${coverageLine(bps, "satisfies", "blueprints")}\n`;
  out += `- ${coverageLine(wos, "implements", "work orders")}\n`;
  out += `- ${coverageLine(bps, "covers", "blueprints")}\n`;
  // Rule 5.5 for the one projected value that is parsed rather than stored:
  // without this line, a section that declares no verdict renders `unknown`
  // and reads as nothing-to-report. Both numbers are computed.
  out += `- \`verdict\` is projected from ${tsts.filter((t) => t.status !== "unknown").length} of ${tsts.length} validation nodes — the rest declare none and render \`unknown\`.\n\n`;
  out +=
    "One row per chain leg reached from an approved requirement's `satisfies` edges — this is the DERIVATION chain (rule 5.4): `satisfies` means *this node was cut from that requirement* and it is the only gate-bearing edge walked here. `—` means the chain stops there — nothing downstream cites this node (yet, or ever; see orphans.md for which).\n\n";
  out += "| REQ | BP | WO | TST |\n|---|---|---|---|\n";
  for (const r of rows) out += `| ${r.req} | ${r.bp} | ${r.wo} | ${r.tst} |\n`;

  out += "\n## Coverage (`covers` — non-gate-bearing, rule 5.4)\n\n";
  out +=
    "`covers` means *that requirement's behaviour lives in this module* — true and useful, but **not** an authorising ancestor, and never walked into the gate-bearing chain above. A requirement transcribed from running code is `covers`, never `satisfies` (ADR-072): the requirement cannot be its own module's ancestor.\n\n";
  const coverRows = [];
  for (const bp of bps) {
    for (const reqId of bp.covers ?? []) coverRows.push({ req: reqId, bp: bp.id });
  }
  coverRows.sort((a, b) => a.req.localeCompare(b.req) || a.bp.localeCompare(b.bp));
  out += "| REQ | BP (covers, not satisfies) |\n|---|---|\n";
  out += coverRows.length ? coverRows.map((r) => `| ${r.req} | ${r.bp} |\n`).join("") : "None.\n";
  return out;
}

/** Reads the real capabilities index and splits it at the "## Planned
 *  capabilities" heading — everything before is the LIVE table, everything
 *  from that heading to EOF is planned/not yet built.
 *  @param {string} DOCS
 *  @returns {string} */
function readCapabilitiesText(DOCS) {
  try {
    return readFileSync(resolve(DOCS, "registry/capabilities.md"), "utf8");
  } catch {
    return ""; // fail closed: no live text found means no exemption verifies
  }
}

const PLANNED_HEADING = "## Planned capabilities";

/** Rule §1's checkable exemption: a node claiming `origin: transcribed` must
 *  have its capability documented in capabilities.md's LIVE table.
 *  @param {string} id
 *  @param {string} capabilitiesText
 *  @returns {{ live: boolean, plannedOnly: boolean }} */
function verifyTranscribed(id, capabilitiesText) {
  const idx = capabilitiesText.indexOf(PLANNED_HEADING);
  const live = idx === -1 ? capabilitiesText : capabilitiesText.slice(0, idx);
  const planned = idx === -1 ? "" : capabilitiesText.slice(idx);
  const re = new RegExp(`\\b${id}\\b`);
  return { live: re.test(live), plannedOnly: !re.test(live) && re.test(planned) };
}

// ── orphans.md — both directions ────────────────────────────────────────────
export function renderOrphans(nodes, capabilitiesText) {
  const byType = (t) => [...nodes.values()].filter((n) => n.type === t);
  const noDownstream = [];
  const noUpstream = [];
  const transcribed = [];

  for (const req of byType("requirement")) {
    if (req.status !== "approved") continue;
    const has = byType("blueprint").some((bp) => (bp.satisfies ?? []).includes(req.id));
    if (!has) noDownstream.push(`${req.id} (requirement, approved) — no blueprint's \`satisfies\` names it. ${req.file}`);
  }
  for (const bp of byType("blueprint")) {
    if (originOf(bp) === "transcribed") {
      const { live, plannedOnly } = verifyTranscribed(bp.id, capabilitiesText);
      let line = `${bp.id} (blueprint, ${bp.status}) — origin: transcribed. ${bp.file}`;
      if (!live) {
        line += plannedOnly
          ? " — ⚠ UNVERIFIED: found only under capabilities.md's § Planned capabilities, not its live table — the transcribed exemption does not hold yet."
          : " — ⚠ UNVERIFIED: NOT found anywhere in capabilities.md — the transcribed exemption is unverified.";
      }
      transcribed.push(line);
      continue;
    }
    const has = byType("work-order").some((wo) => (wo.implements ?? []).includes(bp.id));
    if (!has) noDownstream.push(`${bp.id} (blueprint, ${bp.status}) — no work order's \`implements\` names it. ${bp.file}`);
  }
  for (const wo of byType("work-order")) {
    if (wo.status !== "done" && wo.status !== "approved") continue;
    const has = [...nodes.values()].some((t) => t.type === "validation" && (t.validates ?? []).includes(wo.id));
    if (!has) noDownstream.push(`${wo.id} (work-order, ${wo.status}) — no TST section validates it. ${wo.file}`);
  }

  for (const bp of byType("blueprint")) {
    if ((bp.satisfies ?? []).length === 0 && (bp.covers ?? []).length === 0) {
      noUpstream.push(`${bp.id} (blueprint) — \`satisfies\` is empty. ${bp.file}`);
    }
  }
  for (const wo of byType("work-order")) {
    if ((wo.implements ?? []).length === 0) noUpstream.push(`${wo.id} (work-order) — \`implements\` is empty. ${wo.file}`);
  }
  for (const adr of byType("decision")) {
    if ((adr["decides-for"] ?? []).length === 0) noUpstream.push(`${adr.id} (decision) — \`decides-for\` is empty. ${adr.file}`);
  }
  for (const fb of byType("feedback")) {
    if ((fb.about ?? []).length === 0) noUpstream.push(`${fb.id} (feedback) — \`about\` is empty. ${fb.file}`);
  }

  noDownstream.sort();
  noUpstream.sort();
  transcribed.sort();

  const blueprints = byType("blueprint");
  const workOrders = byType("work-order");
  const decisions = byType("decision");
  const feedback = byType("feedback");

  let out = banner("Orphans");
  out += "## Coverage (rule 5.5)\n\n";
  out += `- ${coverageLine(blueprints, "satisfies", "blueprints")}\n`;
  out += `- ${coverageLine(blueprints, "covers", "blueprints")}\n`;
  out += `- ${coverageLine(workOrders, "implements", "work orders")}\n`;
  out += `- ${coverageLine(decisions, "decides-for", "decisions")}\n`;
  out += `- ${coverageLine(feedback, "about", "feedback items")}\n`;
  out += `- \`origin\` is explicitly declared by ${coverageStat(blueprints, "origin").carrying} of ${blueprints.length} blueprints — the rest default to \`forward\` (never to an exemption).\n`;
  out += "\n## Approved artifacts with no downstream\n\n";
  out += noDownstream.length ? noDownstream.map((l) => `- ${l}\n`).join("") : "None.\n";
  out += "\n## Derived artifacts with no upstream\n\n";
  out += noUpstream.length ? noUpstream.map((l) => `- ${l}\n`).join("") : "None.\n";
  out += "\n## Transcribed (origin: transcribed — code already exists; no work order owed, verified against capabilities.md)\n\n";
  out += transcribed.length ? transcribed.map((l) => `- ${l}\n`).join("") : "None.\n";
  return out;
}

// ── blocked.md — structure only; the reasoning stays in the artifact body ───
export function renderBlocked(nodes) {
  const blocked = [...nodes.values()]
    .filter((n) => (n["blocked-by"] ?? []).length > 0)
    .sort((a, b) => a.id.localeCompare(b.id));

  let out = banner("Blocked");
  out += `${coverageLine([...nodes.values()], "blocked-by", "nodes")}\n\n`;
  out += "Every open `blocked-by` edge. The reasoning for each is in the blocked artifact's own body — this file links to it rather than restating it (structure vs. judgement; see this generator's header comment).\n\n";
  if (blocked.length === 0) {
    out += "None.\n";
    return out;
  }
  out += "| Blocked | Blocked by | See |\n|---|---|---|\n";
  for (const n of blocked) out += `| ${n.id} (${n.type}) | ${n["blocked-by"].join(", ")} | ${n.file} |\n`;
  return out;
}

// ── assumptions.md — every rests-on entry, by disposition ──────────────────
export function renderAssumptions(nodes) {
  const groups = { open: [], undischargeable: [], refuted: [], confirmed: [], unconfirmed: [] };
  // The schema has FOUR dispositions (constitution rule 2.3): open |
  // confirmed | refuted | undischargeable. `open` leads because rule 2.3a
  // makes it "the default and the majority state". "unconfirmed" is NOT a
  // disposition and is last for that reason: it is the catch-all where a row
  // whose disposition is typo'd or absent lands, so that it is reported
  // rather than dropped.
  for (const n of [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    for (const row of n["rests-on"] ?? []) {
      const bucket = groups[row.disposition] ? row.disposition : "unconfirmed";
      groups[bucket].push({ id: n.id, claim: row.claim, "accepted-by": row["accepted-by"], file: n.file });
    }
  }

  let out = banner("Assumptions");
  out += `${coverageLine([...nodes.values()], "rests-on", "nodes")} This is rule 5.5's own example: a generated file whose source field is empty everywhere looks identical to a healthy one unless it says so.\n\n`;
  out += "Every `rests-on` entry across the graph, grouped by disposition. `claim` and `accepted-by` are projected verbatim from the artifact's own front-matter (stored data, not extracted prose); the argument for the disposition stays in the artifact's body.\n\n";
  // Both literals move together: a disposition present in `groups` but absent
  // from this list is collected and never printed, which is rule 5.5's
  // silent-omission failure introduced by the fix for it.
  for (const disposition of ["open", "undischargeable", "refuted", "confirmed", "unconfirmed"]) {
    out += `## ${disposition}\n\n`;
    const rows = groups[disposition];
    if (rows.length === 0) {
      out += "None.\n\n";
      continue;
    }
    out += "| Artifact | Claim | Accepted by | See |\n|---|---|---|---|\n";
    for (const r of rows) out += `| ${r.id} | ${r.claim} | ${r["accepted-by"]} | ${r.file} |\n`;
    out += "\n";
  }
  return out;
}

/** Build every generated file's content in memory — no filesystem writes.
 *  Returns { files: {filename: content}, errors, warnings }.
 *  @param {string} root  project root
 *  @param {object} config  a validated factory.config.json */
export function generate(root, config) {
  const { nodes, errors, warnings } = buildGraph(root, config);
  if (errors.length > 0) return { files: null, errors, warnings: [] };
  const DOCS = resolve(root, config.docsRoot);
  const capabilitiesText = readCapabilitiesText(DOCS);
  const files = {
    "graph.json": renderGraphJson(nodes),
    "traceability.md": renderTraceability(nodes),
    "orphans.md": renderOrphans(nodes, capabilitiesText),
    "blocked.md": renderBlocked(nodes),
    "assumptions.md": renderAssumptions(nodes),
  };
  return { files, errors: [], warnings };
}

/** Where the five generated files live, for a given project + config —
 *  the one fixed convention (`registry/generated`, under docsRoot) that is
 *  not itself a config choice, mirroring build-registry.mjs's own outDir.
 *  @param {string} root
 *  @param {object} config
 *  @returns {string} */
export function outputDir(root, config) {
  return resolve(root, config.docsRoot, "registry/generated");
}

/**
 * Generate and write the five registry files to disk. This is the ONLY
 * write path in the console — the viewer/serve path never calls this.
 *
 * @param {string} project  project root
 * @param {{config?: object, outDir?: string}} [opts]
 *   `config` — a pre-loaded factory.config.json (loaded from `project` if
 *   omitted). `outDir` — override the write location (tests use this to
 *   avoid touching a fixture's committed generated/ directory).
 * @returns {{files: Record<string,string>|null, errors: string[], warnings: string[], outDir: string, wrote: string[]}}
 */
export function emitRegistry(project, opts = {}) {
  const config = opts.config || loadConfig(project).config;
  const { files, errors, warnings } = generate(project, config);
  if (errors.length > 0) {
    return { files: null, errors, warnings: [], outDir: null, wrote: [] };
  }
  const dir = opts.outDir || outputDir(project, config);
  mkdirSync(dir, { recursive: true });
  const wrote = [];
  for (const [name, content] of Object.entries(files)) {
    const p = join(dir, name);
    writeFileSync(p, content, "utf8");
    wrote.push(p);
  }
  return { files, errors: [], warnings, outDir: dir, wrote };
}

/**
 * Staleness check — mirrors ReachKit v2's scripts/check-registry.mjs
 * semantics: regenerate the five files into a fresh temp directory, diff
 * each one against what's committed on disk, and report file + first
 * differing line on any disagreement. Read-only: never touches the
 * project's own registry/generated/.
 *
 * @param {string} project  project root
 * @param {{config?: object}} [opts]
 * @returns {{ok: boolean, errors: string[], warnings: string[], drifts: {file: string, reason: "missing"|"stale", firstDiffLine?: number, committed?: string, fresh?: string}[], tmpDir: string|null}}
 */
export function checkDrift(project, opts = {}) {
  const config = opts.config || loadConfig(project).config;
  const { files, errors, warnings } = generate(project, config);
  if (errors.length > 0) {
    return { ok: false, errors, warnings: [], drifts: [], tmpDir: null };
  }

  const committedDir = outputDir(project, config);
  const tmp = mkdtempSync(join(tmpdir(), "factory-console-registry-check-"));
  for (const [name, content] of Object.entries(files)) writeFileSync(join(tmp, name), content, "utf8");

  const drifts = [];
  for (const name of Object.keys(files)) {
    const freshContent = readFileSync(join(tmp, name), "utf8");
    let committedContent;
    try {
      committedContent = readFileSync(join(committedDir, name), "utf8");
    } catch {
      drifts.push({ file: name, reason: "missing" });
      continue;
    }
    if (committedContent === freshContent) continue;

    const freshLines = freshContent.split("\n");
    const committedLines = committedContent.split("\n");
    const max = Math.max(freshLines.length, committedLines.length);
    let firstDiffLine = -1;
    for (let i = 0; i < max; i++) {
      if (freshLines[i] !== committedLines[i]) {
        firstDiffLine = i + 1;
        break;
      }
    }
    drifts.push({
      file: name,
      reason: "stale",
      firstDiffLine,
      committed: (committedLines[firstDiffLine - 1] ?? "<end of file>").slice(0, 160),
      fresh: (freshLines[firstDiffLine - 1] ?? "<end of file>").slice(0, 160),
    });
  }

  const ok = drifts.length === 0;
  if (ok) rmSync(tmp, { recursive: true, force: true });
  return { ok, errors: [], warnings, drifts, tmpDir: ok ? null : tmp };
}
