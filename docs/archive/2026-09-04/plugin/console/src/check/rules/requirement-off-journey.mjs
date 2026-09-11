// ---- requirement-off-journey (front-matter grammar only) ----------------

export default {
  id: "requirement-off-journey",
  text: "an approved requirement no journey step exercises",
  run(ctx) {
    const { graph, cfg, root, add, notices, notRun, byId } = ctx;
    // Constitution rule 5.7: an approved requirement is exercised by at least
    // one journey step, or states why it cannot be. The rule can only judge
    // that once the corpus has written its first journey — before then, every
    // approved requirement would fire, which is noise, not signal — so a
    // corpus with zero journey nodes gets one notice instead of N findings.
    if (cfg.grammar === "front-matter") {
      const journeyNodes = graph.nodes.filter((n) => n.y === "journey");
      if (journeyNodes.length === 0) {
        notices.push(
          "No journeys yet — requirement-off-journey cannot run; write the first with /require or the journey-writing skill."
        );
        notRun.push("requirement-off-journey");
      } else {
        const exercised = new Set(graph.edges.filter((e) => e[2] === "exercises").map((e) => e[1]));
        for (const n of graph.nodes) {
          if (n.y === "requirement" && n.s === "approved" && !exercised.has(n.i)) {
            add("requirement-off-journey",
              `${n.i} is approved and no journey exercises it`,
              "place it on a journey step, or record in the REQ why it has no user-facing step",
              n.i);
          }
        }
      }
    }
  },
};
