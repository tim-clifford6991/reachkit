// `factory-console pivot` — a restart is a decision, not a directory.
//
// Constitution rule 7.5 (0.12.0). The first product restarted three times
// and the second corpus carried nothing from the first: 164,811 lines
// discarded, the product re-transcribed from BUILD.md by hand. The doctrine
// had no concept of a redesign — no artifact type declared whether it was
// the promise (durable) or the current shape (derived), so a pivot threw
// away both.
//
// This is the console's third write path, beside `registry` and `upgrade`
// (ADR-004 in this repository's docs/decisions/). What it does, in order:
//
//   1. refuses — dirty tree; no decision, or one not `accepted`, or one whose
//      `decides-for` does not name the charter; any file-shaped type with no
//      `durability`; an archive set that already exists;
//   2. snapshots the graph, because the archived blueprints' `satisfies` and
//      the archived work orders' `implements` are what step 4 needs;
//   3. archives every `derived` type directory, `registry/` (except
//      `evidence/` and `generated/`) and `design/` under
//      `<docsRoot>/<archive>/<date>-<slug>/`, keeping the relative layout,
//      and writes each moved directory's fresh skeleton from the plugin's
//      own templates;
//   4. relinks: every surviving (durable) artifact's edge field that names an
//      archived id is rewritten to the requirement(s) that node reached — an
//      archived BP → its `satisfies`; an archived WO → its `implements`,
//      through a BP's `satisfies` where needed; `covers` is never walked
//      (rule 5.4). An id that reaches no requirement is left in place with a
//      `- [ ] REVIEW(gap): …` line under the artifact's `## Open questions`,
//      and pivot-relink keeps reporting it;
//   5. regenerates `registry/generated/`, writes the archive set's README
//      with the counts and the decision, and commits.
//
// The rewrite is textual and minimal: only the one edge field's extent
// inside the front-matter fence changes, to an inline list; every other
// byte of the file — keys this serializer does not know, body, trailing
// newline — is untouched. A pivot that reformatted every durable artifact
// would be the no-value restructuring rule 2.2a forbids.

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync, cpSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import { loadConfig } from "./config.mjs";
import { extract } from "./extract/index.mjs";
import { splitFrontmatter } from "./extract/frontmatter.mjs";
import { emitRegistry } from "./registry/index.mjs";
import { check, formatReport } from "./check/index.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

export class PivotError extends Error {}

function pluginRoot() {
  const p = resolve(HERE, "../../plugins/sdlc-factory");
  if (!existsSync(p)) throw new PivotError("cannot find plugins/sdlc-factory beside this console — is it detached from the marketplace?");
  return p;
}

function git(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

/** `a b — c` → `a-b-c`, lowercase, ascii, bounded. */
export function slugify(s) {
  return String(s).toLowerCase().normalize("NFKD").replace(/[^\x00-\x7f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "pivot";
}

/**
 * Rewrite one list-valued front-matter field to `key: [a, b]`, touching
 * nothing else. Handles the inline form (`key: [..]`) and the block form
 * (`key:` followed by `  - item` lines). Returns the new text, or null when
 * the field is not in the fence.
 */
export function rewriteListField(text, key, ids) {
  if (!text.startsWith("---\n")) return null;
  const end = text.indexOf("\n---\n", 3);
  if (end === -1) return null;
  const fence = text.slice(0, end + 1); // up to and including the newline before the closing ---
  const lines = fence.split("\n");
  const at = lines.findIndex((l, i) => i > 0 && new RegExp(`^${key.replace(/[-]/g, "\\-")}\\s*:`).test(l));
  if (at === -1) return null;
  let stop = at + 1;
  if (/^[^:]+:\s*$/.test(lines[at])) {
    // block list: consume the `  - ` items
    while (stop < lines.length && /^\s+-\s/.test(lines[stop])) stop++;
  }
  const replaced = [...lines.slice(0, at), `${key}: [${ids.join(", ")}]`, ...lines.slice(stop)];
  return replaced.join("\n") + text.slice(end + 1);
}

/** Append a REVIEW(gap) line under `## Open questions`, adding the heading
 *  at the end if absent (the reviewer's own convention). */
export function appendOpenQuestion(text, line) {
  const heading = /^## Open questions\s*$/m;
  const m = text.match(heading);
  if (!m) {
    const sep = text.endsWith("\n") ? "" : "\n";
    return `${text}${sep}\n## Open questions\n${line}\n`;
  }
  // insert after the heading's block: find the next heading after it, or EOF
  const start = m.index + m[0].length;
  const rest = text.slice(start);
  const next = rest.search(/^## /m);
  const blockEnd = next === -1 ? text.length : start + next;
  let block = text.slice(start, blockEnd);
  if (!block.endsWith("\n")) block += "\n";
  const trimmed = block.replace(/\n+$/, "\n");
  return `${text.slice(0, start)}${trimmed}${line}\n${block.slice(trimmed.length)}${text.slice(blockEnd)}`;
}

/**
 * Pivot one project.
 * @param {string} root
 * @param {{decision: string, slug?: string, dryRun?: boolean, commit?: boolean, today?: string}} opts
 */
export async function pivotProject(root, opts = {}) {
  const log = [];
  const say = (m) => log.push(m);
  const { config } = loadConfig(root);
  const DOCS = join(root, config.docsRoot);
  const result = { root, log, archived: {}, relinked: 0, review: 0, kept: 0, commit: null, archiveDir: null, dryRun: !!opts.dryRun };

  // ---- 1. refusals -------------------------------------------------------
  if (config.grammar !== "front-matter") throw new PivotError("pivot rewrites front-matter edges; a head-block corpus is cited and left (rule 2.2a)");
  if (!config.archive) throw new PivotError("factory.config.json sets archive: null — nowhere to archive to");
  const fileTypes = config.types.filter((t) => t.dir);
  const undeclared = fileTypes.filter((t) => !t.durability).map((t) => t.id);
  if (undeclared.length) {
    throw new PivotError(`every file-shaped type needs a durability class (rule 5.8) — missing on ${undeclared.join(", ")}: declare "durable" or "derived" in factory.config.json's types; this never guesses`);
  }
  let g;
  try { git(root, ["rev-parse", "--git-dir"]); g = true; } catch { g = false; }
  if (!g) throw new PivotError("not a git repository — refusing to archive a corpus that cannot be reverted");
  if (git(root, ["status", "--porcelain"])) throw new PivotError("working tree is dirty — commit or stash first, so the pivot is the only thing in the diff");

  if (!opts.decision || !/^ADR-\d{3}[a-z]?$/.test(opts.decision)) {
    throw new PivotError("pivot needs --decision ADR-###: an accepted decision whose decides-for names the charter (rule 7.5) — record it with /sdlc-factory:decide first");
  }
  const adrType = config.types.find((t) => t.id === "ADR" && t.dir);
  if (!adrType) throw new PivotError("no file-shaped ADR type in this config");
  let adrFile = null;
  try { adrFile = readdirSync(join(DOCS, adrType.dir)).find((f) => f.startsWith(opts.decision) && f.endsWith(".md")); } catch { /* fallthrough */ }
  if (!adrFile) throw new PivotError(`${opts.decision} is not in ${adrType.dir}/`);
  const adr = splitFrontmatter(readFileSync(join(DOCS, adrType.dir, adrFile), "utf8"));
  if (!adr.data) throw new PivotError(`${opts.decision} has no front-matter`);
  if (adr.data.status !== "accepted") throw new PivotError(`${opts.decision} is ${adr.data.status || "unset"}, not accepted — a pivot runs only on an accepted decision (rule 7.5)`);
  let charterId = "PROJECT";
  try {
    const ch = splitFrontmatter(readFileSync(join(DOCS, config.charter), "utf8"));
    if (ch.data?.id) charterId = String(ch.data.id);
  } catch { /* no charter file — the default id stands */ }
  const decidesFor = Array.isArray(adr.data["decides-for"]) ? adr.data["decides-for"].map(String) : [];
  if (!decidesFor.includes(charterId)) {
    throw new PivotError(`${opts.decision} decides-for [${decidesFor.join(", ")}] — a pivot decision names the charter (${charterId}) so the reason the shape is discarded outlives the shape (rule 7.5)`);
  }

  const today = opts.today || new Date().toISOString().slice(0, 10);
  const slug = slugify(opts.slug || adr.data.title || opts.decision);
  const setName = `${today}-${slug}`;
  const archiveRoot = join(DOCS, config.archive);
  const archiveDir = join(archiveRoot, setName);
  result.archiveDir = archiveDir;
  if (existsSync(archiveDir)) throw new PivotError(`${config.archive}/${setName} already exists — pick another --slug`);

  // ---- 2. snapshot -------------------------------------------------------
  const before = extract(root, config);
  const byId = new Map(before.nodes.map((n) => [n.i, n]));
  const sat = new Map();
  for (const [from, to, rel] of before.edges) {
    if (rel !== "satisfies") continue;
    if (!sat.has(from)) sat.set(from, new Set());
    sat.get(from).add(to);
  }
  const impl = new Map();
  for (const [from, to, rel] of before.edges) {
    if (rel !== "implements") continue;
    if (!impl.has(from)) impl.set(from, new Set());
    impl.get(from).add(to);
  }
  const derived = fileTypes.filter((t) => t.durability === "derived");
  const durable = fileTypes.filter((t) => t.durability === "durable");
  const derivedIds = new Set(before.nodes.filter((n) => derived.some((t) => n.i.startsWith(`${t.id}-`))).map((n) => n.i));
  const reqOf = (id) => {
    const n = byId.get(id);
    if (!n) return [];
    if (n.y === "requirement") return [id];
    if (n.y === "blueprint") return [...(sat.get(id) || [])].filter((r) => byId.get(r)?.y === "requirement");
    if (n.y === "work-order") {
      const out = new Set();
      for (const t of impl.get(id) || []) for (const r of reqOf(t)) out.add(r);
      return [...out];
    }
    return [];
  };

  say(`pivot ${setName} — ${opts.decision} "${adr.data.title || ""}"`);
  say(`  durable: ${durable.map((t) => t.dir).join(", ")} · derived: ${derived.map((t) => t.dir).join(", ")} · plus registry/ (except evidence/, generated/) and design/`);

  // ---- 3. archive --------------------------------------------------------
  const skeleton = join(pluginRoot(), "templates", "docs-skeleton");
  const moves = [];
  for (const t of derived) moves.push({ rel: t.dir, count: before.nodes.filter((n) => n.i.startsWith(`${t.id}-`)).length });
  const registryDir = join(DOCS, "registry");
  const registryMoves = [];
  if (existsSync(registryDir)) {
    for (const e of readdirSync(registryDir, { withFileTypes: true })) {
      if (e.name === "evidence" || e.name === "generated") continue;
      registryMoves.push(e.name);
    }
  }
  if (existsSync(join(DOCS, "design"))) moves.push({ rel: "design", count: null });

  for (const m of moves) result.archived[m.rel] = m.count;
  say(`  archiving: ${moves.map((m) => `${m.rel}/${m.count !== null ? ` (${m.count})` : ""}`).join(", ")}${registryMoves.length ? `, registry/{${registryMoves.join(", ")}}` : ""}`);

  if (!opts.dryRun) {
    mkdirSync(archiveDir, { recursive: true });
    for (const m of moves) {
      const src = join(DOCS, m.rel);
      if (!existsSync(src)) continue;
      renameSync(src, join(archiveDir, m.rel));
      const skel = join(skeleton, m.rel);
      if (existsSync(skel)) cpSync(skel, src, { recursive: true });
      else mkdirSync(src, { recursive: true });
    }
    if (registryMoves.length) {
      mkdirSync(join(archiveDir, "registry"), { recursive: true });
      for (const name of registryMoves) renameSync(join(registryDir, name), join(archiveDir, "registry", name));
      const skelReg = join(skeleton, "registry");
      for (const e of readdirSync(skelReg, { withFileTypes: true })) {
        if (e.name === "evidence" || e.name === "generated") continue;
        const dst = join(registryDir, e.name);
        if (!existsSync(dst)) cpSync(join(skelReg, e.name), dst, { recursive: true });
      }
    }
  }

  // ---- 4. relink ---------------------------------------------------------
  const EDGE_FIELDS = ["decides-for", "depends-on", "blocked-by", "supersedes", "about", "implements", "satisfies", "covers"];
  for (const t of durable) {
    let files = [];
    try { files = readdirSync(join(DOCS, t.dir)).filter((f) => f.endsWith(".md") && !f.startsWith("_")).sort(); } catch { continue; }
    for (const f of files) {
      const abs = join(DOCS, t.dir, f);
      let text = readFileSync(abs, "utf8");
      const { data } = splitFrontmatter(text);
      if (!data) continue;
      let changed = false;
      const gaps = [];
      for (const field of EDGE_FIELDS) {
        const vals = data[field];
        if (!Array.isArray(vals) || !vals.length) continue;
        const ids = vals.map(String);
        if (!ids.some((id) => derivedIds.has(id))) continue;
        const out = [];
        for (const id of ids) {
          if (!derivedIds.has(id)) { out.push(id); continue; }
          const reqs = reqOf(id);
          if (reqs.length) {
            for (const r of reqs) if (!out.includes(r)) out.push(r);
            result.relinked++;
            say(`  ${data.id}: ${field} ${id} → ${reqs.join(", ")}`);
          } else {
            out.push(id);
            gaps.push(`- [ ] REVIEW(gap): ${field} ${id} archived by ${setName}; no requirement reachable — relink by hand or record why it cannot be (rule 7.5)`);
            result.review++;
            say(`  ${data.id}: ${field} ${id} reaches no requirement — left, REVIEW(gap) added`);
          }
        }
        if (JSON.stringify(out) !== JSON.stringify(ids)) {
          const next = rewriteListField(text, field, out);
          if (next) { text = next; changed = true; }
        }
      }
      for (const line of gaps) { text = appendOpenQuestion(text, line); changed = true; }
      if (changed && !opts.dryRun) writeFileSync(abs, text, "utf8");
      if (!changed) result.kept++;
    }
  }

  // ---- 5. record, regenerate, commit ---------------------------------------
  const readme = [
    `# Archived by pivot — ${setName}`,
    "",
    `Decision: ${opts.decision} — ${adr.data.title || ""}`,
    `Date: ${today}`,
    "",
    "Every file here was a **derived** artifact (constitution rule 5.8) at the",
    "moment the decision above was accepted: the shape the product had, not",
    "the promise it made. Durable artifacts stayed in place and were relinked",
    "to the requirements these files reached (rule 7.5). Nothing under this",
    "directory is parsed as a node; the ids are read so a surviving citation",
    "is reported by `pivot-relink`, never by `dangling-id`.",
    "",
    "| Archived | Count |",
    "|---|---|",
    ...moves.map((m) => `| \`${m.rel}/\` | ${m.count !== null ? m.count : "—"} |`),
    ...(registryMoves.length ? [`| \`registry/{${registryMoves.join(", ")}}\` | — |`] : []),
    "",
    `Relinked edges: ${result.relinked} · left for review: ${result.review}`,
    "",
  ].join("\n");
  if (!opts.dryRun) {
    writeFileSync(join(archiveDir, "README.md"), readme, "utf8");
    const reg = emitRegistry(root, { config: loadConfig(root).config });
    if (reg.errors.length) say(`  registry regeneration reported ${reg.errors.length} error(s) — see --check`);
    else say(`  registry/generated regenerated (${reg.wrote.length} files)`);
  }

  const after = opts.dryRun ? before : extract(root, loadConfig(root).config);
  const verdict = check(after, loadConfig(root).config, root);
  result.check = verdict;
  result.report = formatReport(verdict, loadConfig(root).config, { root: opts.dryRun ? `${root}  [BEFORE — dry run wrote nothing]` : root });

  if (!opts.dryRun && opts.commit !== false) {
    git(root, ["add", "-A", config.docsRoot]);
    if (git(root, ["diff", "--cached", "--name-only"])) {
      git(root, ["commit", "-q", "-m",
        `chore(pivot): ${slug} — ${opts.decision}\n\n` +
        `Archived to ${config.archive}/${setName}: ${moves.map((m) => `${m.rel}/${m.count !== null ? ` (${m.count})` : ""}`).join(", ")}` +
        `${registryMoves.length ? `, registry/{${registryMoves.join(", ")}}` : ""}. ` +
        `Relinked ${result.relinked} edge(s); ${result.review} left for review (REVIEW(gap)). ` +
        `Conformance after: ${verdict.bySeverity.error} error, ${verdict.bySeverity.warn} warn.`]);
      result.commit = git(root, ["rev-parse", "--short", "HEAD"]);
    }
  }
  return result;
}
