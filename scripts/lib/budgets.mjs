// A count in scripts/budgets.json is a ceiling that only falls, so a pull request may lower it and never raise it.
const CITATION = /\b(?:ADR|BP|WO)-\d+\b|\bBUILD §\d+(?:\.\d+)*/g;

function isDoc(rel) {
  return rel.startsWith("docs/") && rel.endsWith(".md");
}

// A citation resolves when a heading of a markdown page under docs/ names it.
export function unresolvedCitations(files) {
  const defined = new Set();
  for (const { rel, text } of files) {
    if (!isDoc(rel)) continue;
    for (const line of text.split("\n")) {
      if (/^#{1,6}\s/.test(line)) for (const m of line.match(CITATION) ?? []) defined.add(m);
    }
  }
  let count = 0;
  const byFile = new Map();
  for (const { rel, text } of files) {
    for (const m of text.match(CITATION) ?? []) {
      if (defined.has(m)) continue;
      count++;
      byFile.set(rel, (byFile.get(rel) ?? 0) + 1);
    }
  }
  return { count, byFile };
}

function numbers(value, at = "", out = new Map()) {
  if (typeof value === "number") out.set(at, value);
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) numbers(v, at ? `${at}.${k}` : k, out);
  }
  return out;
}

// `base` is budgets.json as the base commit holds it, or null where that commit has none.
// A lines number changes only beside a dated decision file the same pull request adds.
export function budgetFindings({ budgets, base, files, decided = false }) {
  const findings = [];
  if (typeof budgets?.citations !== "number") {
    findings.push("scripts/budgets.json has no citations count");
  } else {
    const { count, byFile } = unresolvedCitations(files);
    if (count > budgets.citations) {
      const top = [...byFile].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([f, n]) => `${f} ${n}`).join(", ");
      findings.push(
        `${count} unresolved ADR-/BUILD §/BP-/WO- citations, over the budget of ${budgets.citations} in scripts/budgets.json (most in ${top})`,
      );
    }
  }
  const was = numbers(base);
  const now = numbers(budgets);
  for (const key of was.keys()) {
    if (key.startsWith("lines.") && !now.has(key) && !decided) {
      findings.push(`scripts/budgets.json removes ${key} without a new docs/spec/decisions/ file`);
    }
  }
  for (const [key, value] of now) {
    if (key.startsWith("lines.")) {
      if (was.has(key) && value !== was.get(key) && !decided) {
        findings.push(`scripts/budgets.json changes ${key} from ${was.get(key)} to ${value} without a new docs/spec/decisions/ file`);
      }
    } else if (!key.startsWith("blockRules.") && was.has(key) && value > was.get(key)) {
      findings.push(`scripts/budgets.json raises ${key} from ${was.get(key)} to ${value}; a budget only goes down`);
    } else if (key.startsWith("oneCheck.") && base?.oneCheck && !was.has(key)) {
      findings.push(`scripts/budgets.json adds ${key}: a reason's one check is called, never copied into another file`);
    }
  }
  return findings;
}

// The names of the `block` rows, or with `kind` every row, of each section's `name | block/warn | outcome protected | ruling` table.
export function blockRules(spec, kind = /^block$/) {
  const out = new Map();
  let at = null;
  for (const line of spec.split("\n")) {
    if (line.startsWith("## ")) {
      at = /^## (§\d+)\b/.exec(line)?.[1] ?? null;
      if (at) out.set(at, []);
      continue;
    }
    const cells = line.startsWith("|") ? line.split("|").slice(1, -1).map((c) => c.trim()) : [];
    if (at && cells.length === 4 && kind.test(cells[1].replace(/`/g, ""))) out.get(at).push(cells[0]);
  }
  return out;
}

// SPEC's rows only fall: the count equals `specRows`, so a pull request that removes a row lowers the budget with it.
export function specRowFindings({ budget, spec }) {
  const rows = [...blockRules(spec, /^(?:block|warn)$/).values()].flat().length;
  if (typeof budget !== "number") return ["scripts/budgets.json has no specRows count"];
  if (rows === budget) return [];
  return [rows > budget ? `docs/SPEC.md has ${rows} rule rows, over specRows ${budget} in scripts/budgets.json; the count only goes down` : `docs/SPEC.md has ${rows} rule rows; lower specRows in scripts/budgets.json from ${budget} to ${rows}`];
}

// Live test files and layout gate files only go down: each count equals its budget, so a deletion lowers it in the same change.
export function testFileFindings({ budget, files }) {
  const live = files.filter((rel) => /\.test\.(?:ts|tsx|mjs|js)$/.test(rel) && !rel.startsWith("tests/archive/"));
  const counts = { live: live.length, layout: live.filter((rel) => rel.startsWith("tests/ui/layout/")).length };
  return Object.entries(counts).flatMap(([name, n]) => {
    if (typeof budget?.[name] !== "number") return [`scripts/budgets.json has no testFiles.${name} count`];
    if (n === budget[name]) return [];
    return [n > budget[name] ? `${n} ${name} test files, over testFiles.${name} ${budget[name]} in scripts/budgets.json; the count only goes down` : `${n} ${name} test files; lower testFiles.${name} in scripts/budgets.json from ${budget[name]} to ${n}`];
  });
}

// Only the owner makes a rule block: a section's count equals its budget, and rises only beside a new decision file that names each new row.
// `base` and `head` map §n to its block row names, `base` null where no pull request base exists; `named` is the added decision files' text.
export function blockRuleFindings({ budget, base, head, named }) {
  const findings = [];
  const isNamed = (n) => new RegExp(`(?:^|[^\\w-])${n.replace(/`/g, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[^\\w-]|$)`).test(named);
  for (const [id, names] of head) {
    if (budget?.[id] !== names.length) findings.push(`docs/SPEC.md ${id} has ${names.length} block rule(s); blockRules.${id} in scripts/budgets.json is ${budget?.[id] ?? "missing"}`);
    const was = base?.get(id) ?? [];
    if (!base || names.length <= was.length) continue;
    for (const name of names.filter((n) => !was.includes(n) && !isNamed(n))) {
      findings.push(`docs/SPEC.md ${id} adds the block rule ${name}; only an owner ruling in a new docs/spec/decisions/ file that names it may`);
    }
  }
  return findings;
}

// Plain-words counts per key file or board, measured at the base and at the head: a count may fall and never rise.
// A name the base does not have is new and has no ceiling yet.
export function plainWordsFindings({ base, head }) {
  return Object.entries(head)
    .filter(([name, n]) => name in base && n > base[name])
    .map(([name, n]) => `plain words: ${name} rises from ${base[name]} to ${n} findings; the count only goes down (docs/DESIGN.md › Screen rules, Plain words)`);
}

// Patterns the codebase is shedding: the count of src files holding each may fall and never rise.
export const RATCHETS = { dbAdminCasts: "dbAdmin() as", minimalClients: "interface MinimalClient", fixtureBranches: "isReservedFixtureAccount", timeoutCopies: "setTimeout(() => reject" };

// `baseFiles` maps a ratchet to the src files holding it at the base, or is null where no base exists.
export function ratchetFindings({ budget, files, baseFiles }) {
  return Object.entries(RATCHETS).flatMap(([name, token]) => {
    if (typeof budget?.[name] !== "number") return [`scripts/budgets.json has no ratchets.${name} count`];
    const head = files.filter((f) => f.rel.startsWith("src/") && f.text.includes(token)).map((f) => f.rel);
    const was = baseFiles?.[name];
    if (head.length <= Math.min(budget[name], was?.length ?? Infinity)) return [];
    const added = was ? `; new in ${head.filter((rel) => !was.includes(rel)).join(", ")}` : "";
    return [`${head.length} src files hold "${token}", over ratchets.${name} ${budget[name]} in scripts/budgets.json or the base's ${was?.length ?? "count"}; it only goes down${added}`];
  });
}

// The archive is kept for reference only, so a move into it is not new code.
const MEASURED = /^(?:src|tests(?!\/archive\/)|scripts)\/.*\.(?:ts|tsx|mjs|js|css)$/;

// The generator writes the whole schema in one file, so it cannot be split by concept.
export const GENERATED_DB_TYPES = "src/lib/db/types.generated.ts";

export function isMeasured(rel) {
  return MEASURED.test(rel) && rel !== GENERATED_DB_TYPES;
}

export function lineCount(text) {
  return text.split("\n").length - (text === "" || text.endsWith("\n") ? 1 : 0);
}

// Lines come from the pull request's diff against its base: `changes` is `git diff --numstat` per file and `lines` the head's count per file.
export function lineFindings({ budget, changes, lines }) {
  const findings = [];
  if (!budget) return ["scripts/budgets.json has no lines budget"];
  const missing = ["fileMax", "tests.floor", "tests.share"].filter((k) => !numbers(budget).has(k));
  if (missing.length) return [`scripts/budgets.json has no lines.${missing.join(", lines.")}`];
  const measured = changes.filter((c) => isMeasured(c.rel));
  for (const { rel, added, deleted } of measured) {
    const now = lines.get(rel) ?? 0;
    const was = now - added + deleted;
    if (now <= budget.fileMax || (was > budget.fileMax && now <= was)) continue;
    findings.push(
      was > budget.fileMax
        ? `${rel} grows from ${was} to ${now} lines; a file over ${budget.fileMax} may only shrink`
        : `${rel} has ${now} lines, over the ${budget.fileMax}-line file cap; split it by concept`,
    );
  }
  const net = (prefix) =>
    measured.filter((c) => c.rel.startsWith(prefix)).reduce((sum, c) => sum + c.added - c.deleted, 0);
  for (const [area, cap] of Object.entries(budget.areas ?? {})) {
    const grew = net(`${area}/`);
    const total = [...lines].filter(([rel]) => rel.startsWith(`${area}/`)).reduce((sum, [, n]) => sum + n, 0);
    if (grew > 0 && total > cap) {
      findings.push(`${area} grows by ${grew} to ${total} lines; it may not grow while over ${cap}`);
    }
  }
  const tests = net("tests/");
  const allowed = Math.max(budget.tests.floor, Math.floor(budget.tests.share * Math.max(0, net("src/"))));
  if (tests > allowed) {
    findings.push(`tests grow by ${tests} net lines, over the ${allowed} this pull request's src allows`);
  }
  return findings;
}

// The writer's closed lists, read from their source: each entry count may fall and never rise.
export const LISTS = {
  hardRules: ["src/lib/generate/rules/types.ts", "export const HARD_RULES"],
  warningRules: ["src/lib/generate/rules/types.ts", "export const WARNING_RULES"],
  mechanicalRules: ["src/lib/generate/pipeline/repair.ts", "export const MECHANICAL_RULES"],
  pipelineSteps: ["src/lib/generate/pipeline/index.ts", "export type PipelineStep"],
};

// The quoted entries from a declaration's start to its close, comments aside; null where the declaration is gone.
function entriesOf(text, start) {
  const at = text?.indexOf(start) ?? -1;
  if (at < 0) return null;
  const from = text.indexOf("=", at);
  const body = text.slice(from, start.startsWith("export type") ? text.indexOf(";", from) : text.indexOf("]", text.indexOf("[", from))).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  return [...body.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

// The literals that can stop a topic or a page before it is written: readiness, the commit, the top-up and a live topic.
export const PLAN_STOPS = [
  ["src/lib/opportunities/types.ts", "export type UnreadyReason", ";"],
  ["src/lib/opportunities/rank/open.ts", "export type Rejection", ";"],
  ["src/lib/opportunities/choose.ts", "reason: Rejection", ";"],
  ["src/lib/opportunities/derive/top-up.ts", "const REASONS", "]"],
  ["src/lib/opportunities/live-topics.ts", "export type LiveTopicFailure", ";"],
];

// The quoted literals from `start` to the first `close` after it, comments aside; null where `start` is gone.
function literalsOf(text, start, close) {
  const at = text?.indexOf(start) ?? -1;
  return at < 0 ? null : [...text.slice(at, text.indexOf(close, at + start.length)).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "").matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

// `read` returns a repo file's text. A stop turned into a warning is a reduction, so WARNING_RULES has no ceiling of its own.
export function listFindings({ budget, read }) {
  if (!budget) return [];
  const got = Object.fromEntries(Object.entries(LISTS).map(([name, [rel, start]]) => [name, entriesOf(read(rel), start)]));
  const stops = PLAN_STOPS.map(([rel, start, close]) => literalsOf(read(rel), start, close));
  const counts = { hardRules: got.hardRules, mechanicalRules: got.mechanicalRules, pipelineSteps: got.pipelineSteps, stoppingRules: got.hardRules && got.warningRules && got.hardRules.filter((r) => !got.warningRules.includes(r)), planStops: stops.includes(null) ? null : stops.flat() };
  return Object.entries(budget).flatMap(([name, cap]) => {
    if (!(name in counts)) return [`scripts/budgets.json lists.${name} counts nothing`];
    if (counts[name] === null) return [`lists.${name}: ${LISTS[name]?.[1] ?? (name === "planStops" ? "a PLAN_STOPS declaration" : "HARD_RULES or WARNING_RULES")} is not found; remove lists.${name} from scripts/budgets.json with it`];
    return counts[name].length <= cap ? [] : [`lists.${name} has ${counts[name].length} entries, over ${cap} in scripts/budgets.json; it only goes down`];
  });
}
