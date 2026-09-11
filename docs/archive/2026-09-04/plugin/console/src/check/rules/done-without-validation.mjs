// ---- done-without-validation (front-matter grammar only) ---------------

export default {
  id: "done-without-validation",
  text: "a done work order with no TST section validating it",
  run(ctx) {
    const { graph, cfg, root, add, notices, notRun, byId } = ctx;
    // A work order marked `done` with no `## TST-###` section validating it —
    // the built thing was declared finished and no one checked. Defaults to
    // error: unlike orphan-requirement (a candidate for the next wave),
    // `done` is a completion claim, and an unvalidated one is a defect now,
    // not a future task.
    if (cfg.grammar === "front-matter") {
      const validatedWOs = new Set(graph.edges.filter((e) => e[2] === "validates").map((e) => e[1]));
      for (const n of graph.nodes) {
        if (n.y === "work-order" && n.s === "done" && !validatedWOs.has(n.i)) {
          add("done-without-validation",
            `${n.i} is done and no TST section validates it`,
            "no `## TST-###` heading in this work order's body declares a validates edge to it",
            n.i);
        }
      }
    }
  },
};
