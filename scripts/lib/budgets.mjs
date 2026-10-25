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
export function budgetFindings({ budgets, base, files }) {
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
    if (was.has(key) && value > was.get(key)) {
      findings.push(`scripts/budgets.json raises ${key} from ${was.get(key)} to ${value}; a budget only goes down`);
    }
  }
  return findings;
}
