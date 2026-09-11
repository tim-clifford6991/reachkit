// ---- done-without-commits (code layer only) -----------------------------

export default {
  id: "done-without-commits",
  text: "a done work order no commit names",
  run(ctx) {
    const { graph, cfg, root, add, notices, notRun, byId } = ctx;
    // done-without-validation asks whether a done work order was ever checked;
    // this asks whether it was ever built. A work order can reach `done` by
    // edit alone — this is the rule that notices when the git history never
    // agreed.
    if (graph.code?.present) {
      const citedWOs = new Set(graph.code.commits.flatMap((c) => c.wo));
      for (const n of graph.nodes) {
        if (n.y === "work-order" && n.s === "done" && !citedWOs.has(n.i)) {
          add("done-without-commits",
            `${n.i} is done and no commit cites it`,
            `no commit message carries \`${n.i}\` — was it merged, or only declared?`,
            n.i);
        }
      }
    }
  },
};
