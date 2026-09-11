// ---- ellipsis-range ----------------------------------------------------

export default {
  id: "ellipsis-range",
  text: "a link line that cannot be expanded",
  run(ctx) {
    const { graph, cfg, root, add, notices, notRun, byId } = ctx;
    // Refused, never expanded. WO-002 alone would fabricate ~140 edges.
    for (const r of graph.health.ranges) {
      add("ellipsis-range",
        `${r.id}: "${r.key}:" uses a range the parser refuses to expand`,
        `${r.line} — enumerate the IDs, or split the work order`,
        r.id);
    }
    // A commit message can carry the same shape of lie — `WO-145..147` in a
    // subject line is exactly as unexpandable as one in a document, and for
    // the same reason: refusing it is cheaper than fabricating the middle ids.
    if (graph.code?.present) {
      for (const r of graph.code.ranges) {
        add("ellipsis-range",
          `commit ${r.h}: the message uses a range the parser refuses to expand`,
          `${r.text} — enumerate the ids in the commit body, or split the commit`,
          r.h);
      }
    }
  },
};
