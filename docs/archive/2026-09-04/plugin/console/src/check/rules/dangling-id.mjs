// ---- dangling-id ------------------------------------------------------

export default {
  id: "dangling-id",
  text: "a cited ID with no artifact behind it",
  run(ctx) {
    const { graph, cfg, root, add, notices, notRun, byId } = ctx;
    // Rule 2 of the constitution — every downstream artifact cites upstream
    // IDs — is broken whenever this fires.
    for (const [id, citedBy] of Object.entries(graph.health.dangling)) {
      add("dangling-id",
        `${id} is cited but no artifact exists`,
        `cited by ${[...new Set(citedBy)].join(", ")}`,
        id);
    }
  },
};
