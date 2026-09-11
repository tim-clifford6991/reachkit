// ---- registry-contradiction -------------------------------------------

export default {
  id: "registry-contradiction",
  text: "the traceability registry disagrees with the artifact file",
  run(ctx) {
    const { graph, cfg, root, add, notices, notRun, byId } = ctx;
    // Rule 1 settles it: the file wins, the registry is the copy. So the
    // registry is reported as the thing to fix.
    for (const r of graph.health.registry) {
      add("registry-contradiction",
        `${r.id}: the registry says "${r.registry}", the file says "${r.file}"`,
        `rule 1 — the file wins; correct ${cfg.traceability.file}`,
        r.id);
    }
  },
};
