// The doctrine's linter.
//
// Not a separate implementation: the same parse, with assertions. The viewer
// and the checker can never disagree about what the corpus says, because
// there is only one thing that reads it.
//
// Severity is configurable per rule so a project can adopt the checker before
// it is clean and ratchet rules from `warn` to `error` as it fixes them. A
// corpus with a real history will never be green on day one, and a checker
// that must be green immediately is a checker that gets disabled.

import { readdirSync } from "node:fs";
import { join } from "node:path";

import { RULES, RULE_TEXT, RULE_MODULES } from "./rules/index.mjs";

export { RULES, RULE_TEXT };

/**
 * @param {object} graph  output of extract()
 * @param {object} cfg    the validated config
 * @param {string} [root] the project root — optional; a caller exercising
 *   `check()` against a hand-built graph with no real project on disk (most
 *   unit tests) simply gets the directory-scan rule skipped rather than a
 *   crash. Every real caller (the CLI, the server) has a root and passes it.
 * @returns {{findings: object[], bySeverity: object, exitCode: number, notices: string[], notRun: string[]}}
 */
export function check(graph, cfg, root) {
  const sev = (rule) => cfg.checks.severity[rule] ?? "warn";
  const findings = [];
  const notices = [];
  // Rules that could not run at all this pass — distinct from a rule that
  // ran and found nothing. A rule with no findings and a rule that never
  // executed both look silent in `findings`; `notRun` is what tells
  // `formatReport` and the Health view apart from a false "clean".
  const notRun = [];
  const add = (rule, summary, detail, where) => {
    const s = sev(rule);
    if (s === "off") return;
    findings.push({ rule, severity: s, summary, detail, where, text: RULE_TEXT[rule] });
  };
  const byId = new Map(graph.nodes.map((n) => [n.i, n]));
  const ctx = { graph, cfg, root, add, notices, notRun, byId };

  for (const rule of RULE_MODULES) rule.run(ctx);

  // ---- undeclared artifact directories -------------------------------------
// A directory under docsRoot that already holds artifact-shaped files —
// filenames opening with an uppercase prefix and three digits — but that
// no `cfg.types[].dir` names is invisible to this console: never scanned,
// never counted, never checked. `journeys/` sat exactly this way for one
// commit before the JN type was declared. Skipped deliberately:
// `registry` (generated plus hand-authored files, not artifacts),
// `design`, `_archive`, `history` (none of these are artifact
// directories by convention) and anything `_`-prefixed (a project's own
// scratch or draft area). `root` is optional — see the doc comment above.
if (root) {
  const declaredDirs = new Set(cfg.types.filter((t) => t.dir).map((t) => t.dir));
  const SKIP_DIRS = new Set(["registry", "design", "_archive", "history", ...(cfg.archive ? [cfg.archive] : [])]);
  const docsRoot = join(root, cfg.docsRoot);
  let entries = [];
  try {
    entries = readdirSync(docsRoot, { withFileTypes: true });
  } catch { /* no docs root yet — nothing to scan */ }
  for (const ent of entries) {
    if (!ent.isDirectory() || declaredDirs.has(ent.name) || SKIP_DIRS.has(ent.name) || ent.name.startsWith("_")) continue;
    let files;
    try {
      files = readdirSync(join(docsRoot, ent.name));
    } catch {
      continue;
    }
    const shaped = files.filter((f) => f.endsWith(".md") && /^[A-Z]+-\d{3}/.test(f));
    if (!shaped.length) continue;
    const ids = shaped.map((f) => `${f.match(/^[A-Z]+-\d{3}/)[0]}-…`);
    notices.push(
      `\`${ent.name}/\` holds ${shaped.length} artifact-shaped file${shaped.length > 1 ? "s" : ""} ` +
      `(${ids.join(", ")}) but no declared type covers it — add the type to factory.config.json's ` +
      "`types`, or the console will never read it."
    );
  }
}

  // ---- notices -----------------------------------------------------------
  // Not rules: things worth saying that the doctrine has not made rules.
  if (cfg.grammar === "front-matter" && !graph.health.generatedDrift?.present) {
    notices.push(
      `No ${cfg.docsRoot}/registry/generated/graph.json — generated-drift cannot run. ` +
      "Run `factory-console registry` in the target project to derive it, or this notice will keep recurring."
    );
    notRun.push("generated-drift");
  }
  const usedRels = new Set(graph.edges.map((e) => e[2]));
  const unused = Object.entries(cfg.relations).filter(([, rel]) => !usedRels.has(rel));
  // Only worth saying once the corpus declares *some* edges. On a corpus with
  // none, every relation is unused and the notice is pure noise. Head-block
  // only: `relations` maps head-line KEYS, which the front-matter grammar
  // never reads — six of the ten shipped relations structurally cannot be
  // minted there, so under front-matter this notice would fire forever on a
  // perfectly clean corpus.
  if (cfg.grammar !== "front-matter" && unused.length && graph.edges.length) {
    notices.push(
      `${unused.length} declared relation${unused.length > 1 ? "s match" : " matches"} nothing in this corpus: ` +
      unused.map(([k, v]) => `"${k}" → ${v}`).join(", ") +
      ". Harmless if the project genuinely does not use them — a typo in factory.config.json otherwise."
    );
  }
  if (graph.schemaNote) notices.push(graph.schemaNote);
  if (!graph.charter) notices.push(`No charter at ${cfg.docsRoot}/${cfg.charter} — the strategy view will be thin.`);


  const bySeverity = { error: 0, warn: 0 };
  for (const f of findings) bySeverity[f.severity]++;

  return { findings, bySeverity, notices, notRun, exitCode: bySeverity.error > 0 ? 1 : 0 };
}

/** Human-readable report for the terminal. */
export function formatReport(result, cfg, { projectName, root } = {}) {
  const out = [];
  const byRule = new Map();
  for (const f of result.findings) {
    if (!byRule.has(f.rule)) byRule.set(f.rule, []);
    byRule.get(f.rule).push(f);
  }

  out.push(`\nconformance — ${projectName || root}`);
  out.push("─".repeat(72));

  for (const rule of RULES) {
    const fs = byRule.get(rule) || [];
    const configured = cfg.checks.severity[rule];
    if (configured === "off") {
      out.push(`  ${"off".padEnd(5)}  ${rule.padEnd(24)}  disabled in factory.config.json`);
      continue;
    }
    // A rule that never ran is not "clean" — it just has nothing to report
    // because it was never asked. `notRun` (e.g. requirement-off-journey on
    // a corpus with no journeys yet, generated-drift with no graph.json)
    // says so explicitly rather than looking indistinguishable from a rule
    // that ran and found zero problems.
    if (result.notRun?.includes(rule)) {
      out.push(`  ${"n/a".padEnd(5)}  ${rule.padEnd(24)}  could not run — see notices`);
      continue;
    }
    if (!fs.length) {
      out.push(`  ${"ok".padEnd(5)}  ${rule.padEnd(24)}  clean`);
      continue;
    }
    out.push(`  ${fs[0].severity.toUpperCase().padEnd(5)}  ${rule.padEnd(24)}  ${fs.length} finding${fs.length > 1 ? "s" : ""} — ${RULE_TEXT[rule]}`);
    for (const f of fs) {
      out.push(`         ${f.summary}`);
      if (f.detail) out.push(`           ${f.detail}`);
    }
  }

  if (result.notices.length) {
    out.push("");
    out.push("  notices (not rules)");
    for (const n of result.notices) out.push(`    · ${n}`);
  }

  out.push("─".repeat(72));
  out.push(
    result.bySeverity.error
      ? `  ${result.bySeverity.error} error · ${result.bySeverity.warn} warn — exit 1`
      : `  0 errors · ${result.bySeverity.warn} warn — exit 0`
  );
  return out.join("\n");
}
