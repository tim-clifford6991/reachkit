// `factory-console impact` — what a change lands on, computed from the graph
// the console already parsed, never guessed. Pure: no I/O of its own. The
// caller (bin/factory-console.mjs) is the one that loads config, extracts
// the corpus, and resolves a work-order id against the node list — this
// function only ever sees the graph it is handed.
//
// The chain is one hop each way, same posture as everything else in
// extract/index.mjs's code layer (blast radius, routes): a work order's
// commits name the files it touched; the direct importers of those files
// (one hop, `graph.code.index.imports` — the full server-side pair list,
// never the client's trimmed count) are who else is standing on this code;
// the blueprints anchored to EITHER the touched files OR their importers
// are what governs them — an importer that is itself governed code is
// impacted too, not merely adjacent to it, so its own blueprint belongs in
// the set on the same footing as one anchoring a touched file; and the
// union of every one of those blueprints' own `satisfies` edges names the
// requirements standing behind the whole change. No transitive closure
// anywhere in this chain — a second hop (an importer of an importer, or a
// requirement's own upstream) is a different, larger question this command
// does not answer.

/**
 * @param {object} graph   a graph from extract() — never the client-trimmed
 *                          payload serve.mjs sends a browser, which drops
 *                          `code.index.imports` down to a bare count.
 * @param {{ wo?: string, paths?: string[] }} opts  exactly one of `wo` (a
 *                          work-order id — every commit citing it supplies
 *                          the files) or `paths` (an explicit file list) is
 *                          expected; `wo` wins if both are given.
 * @returns {{ present: false }
 *          | { present: true, files: string[], blueprints: { id: string, files: string[] }[], importers: string[], requirements: string[] }}
 */
export function computeImpact(graph, { wo, paths } = {}) {
  const code = graph && graph.code;
  if (!code || !code.present) return { present: false };

  const fileSet = new Set();
  if (wo) {
    for (const c of code.commits || []) {
      if (c.wo && c.wo.includes(wo)) for (const f of c.files || []) fileSet.add(f);
    }
  } else {
    for (const p of paths || []) fileSet.add(p);
  }
  const files = [...fileSet].sort();

  // Importers: direct importers of any impacted file, one hop, excluding a
  // file that is itself in the impacted set — mirrors the blast-radius rule
  // extract/index.mjs already applies to an anchor's own files. Computed
  // before blueprints, because the blueprint join below needs it.
  const importerSet = new Set();
  for (const [from, to] of (code.index && code.index.imports) || []) {
    if (fileSet.has(to) && !fileSet.has(from)) importerSet.add(from);
  }
  const importers = [...importerSet].sort();

  // Blueprints: any anchor whose governed files intersect EITHER the
  // impacted set or the importer set — an importer that is itself anchored
  // to a blueprint is impacted code, not a bystander, so its blueprint (and,
  // downstream, its requirement) belongs in the set. Each entry's own
  // `files` is that intersection — which of the impacted-or-importing files
  // this blueprint governs — not the anchor's full file list, which may
  // reach well beyond what actually changed.
  const relevant = new Set([...fileSet, ...importerSet]);
  const anchors = code.anchors || {};
  const blueprints = Object.entries(anchors)
    .filter(([, a]) => (a.files || []).some((f) => relevant.has(f)))
    .map(([id, a]) => ({ id, files: (a.files || []).filter((f) => relevant.has(f)).sort() }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  // Requirements: the union of the (now-joined) blueprints' own `satisfies`
  // targets — declared edges only, read straight off graph.edges.
  const bpIds = new Set(blueprints.map((b) => b.id));
  const reqSet = new Set();
  for (const [from, to, rel] of graph.edges || []) {
    if (rel === "satisfies" && bpIds.has(from)) reqSet.add(to);
  }
  const requirements = [...reqSet].sort();

  return { present: true, files, blueprints, importers, requirements };
}
