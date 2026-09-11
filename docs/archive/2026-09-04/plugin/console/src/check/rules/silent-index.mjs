// ---- silent-index (front-matter grammar only) ---------------------------

export default {
  id: "silent-index",
  text: "an edge field whose corpus-wide coverage is below the visibility floor",
  run(ctx) {
    const { graph, cfg, root, add, notices, notRun, byId } = ctx;
    // Rule 5.5 as a check: "an index that is derived cannot lie, but it can be
    // silent." Any edge-shaped field whose corpus-wide carrying fraction sits
    // below the configured floor gets one warning naming the field and its
    // X-of-Y count, the same shape build-registry.mjs's own coverage lines use.
    const silentThreshold = cfg.checks.silentIndexThreshold ?? 0.05;
    // Measured against the nodes that CAN carry the field, not the whole corpus.
    // Only feedback declares `about`, so 8-of-411 is really 8-of-8 — complete,
    // and reporting it as near-silent buries the fields that genuinely are.
    // graph.json's own coverage block keeps the corpus-wide denominator: it is
    // byte-identical to the reference generator and is not this rule's business.
    const eligibleFor = (field) => {
      // Derived from the graph contract (cfg.edges) rather than a second,
      // hand-maintained map: a field's eligible owner is whatever node type is
      // the sole `from` side of its edge — the same fact edge-off-schema
      // already enforces. `code` is the one field with no `cfg.edges` entry
      // (it anchors a blueprint to its implementation, not an edge between two
      // nodes), so it stays a literal special case. A field whose `from` is
      // `["*"]`, spans several types, or names none in `cfg.edges` at all
      // (`rests-on`) has no single eligible owner — `null` falls back to the
      // corpus-wide denominator, same as before.
      const from = cfg.edges?.[field]?.from;
      const owner = field === "code" ? "blueprint" : (Array.isArray(from) && from.length === 1 && from[0] !== "*" ? from[0] : null);
      return owner ? graph.nodes.filter((n) => n.y === owner).length : null;
    };
    for (const [field, { carrying, total: corpusTotal }] of Object.entries(graph.health.fieldCoverage || {})) {
      const scoped = cfg.grammar === "front-matter" ? eligibleFor(field) : null;
      const total = scoped ?? corpusTotal;
      if (total === 0) continue;
      const ratio = carrying / total;
      if (ratio < silentThreshold) {
        add("silent-index",
          `${field}: only ${carrying} of ${total} ${scoped ? "eligible " : ""}nodes carry it (${(ratio * 100).toFixed(1)}%)`,
          `below the ${(silentThreshold * 100).toFixed(0)}% visibility floor (checks.silentIndexThreshold) — rule 5.5`,
          field);
      }
    }
  },
};
