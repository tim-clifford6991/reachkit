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
  for (const [key, value] of numbers(budgets)) {
    if (key.startsWith("lines.")) {
      if (was.has(key) && value !== was.get(key) && !decided) {
        findings.push(`scripts/budgets.json changes ${key} from ${was.get(key)} to ${value} without a new docs/spec/decisions/ file`);
      }
    } else if (was.has(key) && value > was.get(key)) {
      findings.push(`scripts/budgets.json raises ${key} from ${was.get(key)} to ${value}; a budget only goes down`);
    }
  }
  return findings;
}

const MEASURED = /^(?:src|tests|scripts)\/.*\.(?:ts|tsx|mjs|js|css)$/;

export function isMeasured(rel) {
  return MEASURED.test(rel);
}

export function lineCount(text) {
  return text.split("\n").length - (text === "" || text.endsWith("\n") ? 1 : 0);
}

// Lines come from the pull request's diff against its base: `changes` is `git diff --numstat` per file and `lines` the head's count per file.
export function lineFindings({ budget, changes, lines }) {
  const findings = [];
  if (!budget) return ["scripts/budgets.json has no lines budget"];
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
