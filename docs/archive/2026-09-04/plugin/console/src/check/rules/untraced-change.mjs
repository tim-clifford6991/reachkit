// ---- untraced-change (code layer only) ----------------------------------

export default {
  id: "untraced-change",
  text: "a commit under governed paths that names no work order",
  run(ctx) {
    const { graph, cfg, root, add, notices, notRun, byId } = ctx;
    // The commit citation is the same declared link this whole console reads
    // everywhere else — so a commit that touches governed code and names no
    // work order is the git-shaped version of an undeclared edge: what did we
    // merge that nothing in the corpus planned for? A commit already flagged
    // by ellipsis-range gets the benefit of the doubt — its citation was
    // refused, not omitted.
    if (graph.code?.present) {
      const governedFiles = new Set(Object.values(graph.code.anchors).flatMap((a) => a.files));
      const rangedShas = new Set(graph.code.ranges.map((r) => r.h));
      for (const c of graph.code.commits) {
        if (c.wo.length || rangedShas.has(c.h)) continue;
        const touched = c.files.filter((f) => governedFiles.has(f));
        if (!touched.length) continue;
        add("untraced-change",
          `${c.h} touched governed code and cites no work order`,
          `"${c.s}" — ${touched.length} governed file(s): ${touched.slice(0, 3).join(", ")}`,
          c.h);
      }
    }
  },
};
