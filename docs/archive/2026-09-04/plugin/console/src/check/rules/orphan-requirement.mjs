// ---- orphan-requirement ------------------------------------------------

export default {
  id: "orphan-requirement",
  text: "an approved requirement no blueprint satisfies",
  run(ctx) {
    const { graph, cfg, root, add, notices, notRun, byId } = ctx;
    // The rule is about *approved* requirements: an approved REQ nothing
    // satisfies has been signed off and never expanded. Candidates for the
    // next blueprint wave rather than errors, which is why it defaults to warn.
    const approvedOrphans = graph.health.orphanREQ.filter((id) => byId.get(id)?.s === "approved");
    for (const id of approvedOrphans) {
      add("orphan-requirement",
        `${id} is approved and nothing satisfies it`,
        `no declared edge points at ${id}`,
        id);
    }
    const nonApprovedOrphans = graph.health.orphanREQ.length - approvedOrphans.length;
    if (nonApprovedOrphans > 0) {
      notices.push(`${nonApprovedOrphans} further ${cfg.checks.orphanType} have no incoming edge but are not approved, so orphan-requirement does not fire on them.`);
    }
  },
};
