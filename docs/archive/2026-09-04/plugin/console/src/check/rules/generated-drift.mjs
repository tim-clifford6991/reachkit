// ---- generated-drift (front-matter grammar only) -----------------------

export default {
  id: "generated-drift",
  text: "the console's parse disagrees with docs/registry/generated/graph.json",
  run(ctx) {
    const { graph, cfg, root, add, notices, notRun, byId } = ctx;
    // Cross-checks this parse against docs/registry/generated/graph.json — the
    // DERIVED registry, projected by scripts/build-registry.mjs from the same
    // front-matter this console reads. registry-contradiction (above) is the
    // legacy-grammar check against the hand-authored registry/traceability.md;
    // this is its front-matter replacement, named separately per the work
    // order rather than repointed in place, so a fleet mid-migration can see
    // both checks' history distinctly.
    for (const m of graph.health.generatedDrift?.mismatches || []) {
      add("generated-drift",
        `${m.id}: the console's parse says "${m.parsed}", graph.json says "${m.generated}"`,
        "one of the two is stale — regenerate with `factory-console registry`, or fix the artifact's own status",
        m.id);
    }
  },
};
