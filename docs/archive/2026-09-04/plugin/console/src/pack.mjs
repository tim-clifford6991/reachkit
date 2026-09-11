// `factory-console pack` — the reading list for one dispatch, computed from
// the graph rather than assembled by judgement (0.13.2, constitution rule
// 4.5).
//
// Measured 2026-09-02: one work order's build loop read 41M cache tokens,
// because every dispatch re-read whatever the agent thought might matter.
// The fix is not "read less" as advice; it is handing the agent a list and
// saying read nothing else. This computes the list.
//
// Three parts, and nothing else is in a pack:
//
//   1. the work order itself;
//   2. the artifacts its front-matter edges name — `implements` and
//      `depends-on` one hop, plus the requirements those blueprints
//      `satisfies` — because an order's own edges are the corpus it was cut
//      from and the rest of the corpus is not;
//   3. the files its `## File plan` table names, which is the code the
//      order says it will touch.
//
// Pure of judgement, not of I/O: it stats the project's files to size the
// pack, because "how big is this dispatch" is the number rule 4.5 asks to
// be recorded and a list without it is not an answer.

import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

/** `| path | New/Modify | … |` rows under a `## File plan` heading. */
function filePlanPaths(body) {
  const lines = (body || "").split("\n");
  const at = lines.findIndex((l) => /^#{1,3}\s+File plan\b/i.test(l));
  if (at === -1) return [];
  const out = [];
  for (let i = at + 1; i < lines.length; i++) {
    const l = lines[i];
    if (/^#{1,3}\s/.test(l)) break;
    const t = l.trim();
    if (!t.startsWith("|") || !t.endsWith("|")) continue;
    const cells = t.slice(1, -1).split("|").map((c) => c.trim());
    const first = (cells[0] || "").replace(/`/g, "").trim();
    if (!first || /^-{1,}$/.test(first) || /^file$/i.test(first)) continue;
    // A path, not prose: it has a separator or an extension and no spaces.
    if (/\s/.test(first) || !/[./]/.test(first)) continue;
    out.push(first);
  }
  return [...new Set(out)];
}

/**
 * @param {object} graph  output of extract()
 * @param {object} cfg    the validated config
 * @param {string} root   project root — files are sized against it
 * @param {string} id     the work order's id
 * @returns {{id: string, artifacts: {id: string, file: string, bytes: number}[],
 *            files: {path: string, bytes: number, missing: boolean}[],
 *            bytes: number, count: number}}
 */
export function computePack(graph, cfg, root, id) {
  const byId = new Map(graph.nodes.map((n) => [n.i, n]));
  const wo = byId.get(id);
  if (!wo || wo.y !== "work-order") return null;

  const wanted = [id];
  const push = (x) => { if (x && !wanted.includes(x)) wanted.push(x); };
  const out = (from, rel) => graph.edges.filter((e) => e[0] === from && e[2] === rel).map((e) => e[1]);

  const upstream = [...out(id, "implements"), ...out(id, "depends-on")];
  for (const u of upstream) push(u);
  // One more hop, and only this one: a blueprint's own requirements. The
  // order was cut from them and its criteria are inherited verbatim from
  // them, so an implementer that cannot read them is reading a paraphrase.
  for (const u of upstream) for (const r of out(u, "satisfies")) push(r);

  const artifacts = wanted
    .map((x) => byId.get(x))
    .filter(Boolean)
    .filter((n) => n.f)
    .map((n) => ({ id: n.i, file: `${cfg.docsRoot}/${n.f}`, bytes: n.z || 0 }));

  const files = filePlanPaths(wo.b).map((p) => {
    const abs = join(root, p);
    let bytes = 0, missing = true;
    try { const st = statSync(abs); bytes = st.size; missing = false; } catch { /* new file, or a glob */ }
    if (missing && !existsSync(abs)) missing = true;
    return { path: p, bytes, missing };
  });

  const bytes = artifacts.reduce((a, x) => a + x.bytes, 0) + files.reduce((a, x) => a + x.bytes, 0);
  return { id, artifacts, files, bytes, count: artifacts.length + files.length };
}

/** The one line rule 4.5 asks to be written on the order's own `## Log`. */
export function packLogLine(pack, date = new Date().toISOString().slice(0, 10)) {
  const kb = Math.round(pack.bytes / 1024);
  return `- ${date} pack — ${pack.count} items · ${pack.artifacts.length} artifacts · ${pack.files.length} files · ${kb} KB`;
}

export function formatPack(pack) {
  const out = [];
  out.push(`pack ${pack.id}`);
  out.push(`\nArtifacts (${pack.artifacts.length})`);
  out.push(pack.artifacts.length ? pack.artifacts.map((a) => `  ${a.id.padEnd(10)} ${a.file}`).join("\n") : "  (none)");
  out.push(`\nFiles from the file plan (${pack.files.length})`);
  out.push(pack.files.length
    ? pack.files.map((f) => `  ${f.missing ? "new " : "    "} ${f.path}`).join("\n")
    : "  (none — a work order with no file plan is a work order with no plan)");
  out.push(`\n${packLogLine(pack)}`);
  return out.join("\n");
}
