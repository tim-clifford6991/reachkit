// ---- satisfies-superseded (front-matter grammar only) -------------------

export default {
  id: "satisfies-superseded",
  text: "a live blueprint satisfies a requirement that has since been superseded",
  run(ctx) {
    const { graph, cfg, root, add, notices, notRun, byId } = ctx;
    // `/requirement-cleanup` retires a duplicate requirement in place (`status:
    // superseded`) and its survivor gains `supersedes:` — but nothing
    // repoints a blueprint's own `satisfies` automatically. A live blueprint
    // whose `satisfies` still names a superseded requirement is exactly
    // that dangling edge: `/relink` is the fix this rule points at.
    // Silent on a blueprint that is itself `status: superseded` — a retired
    // twin's own edges are history, not a live claim needing a repoint.
    if (cfg.grammar === "front-matter") {
      for (const [from, to, rel] of graph.edges) {
        if (rel !== "satisfies") continue;
        const bp = byId.get(from);
        if (!bp || bp.y !== "blueprint" || bp.s === "superseded") continue;
        const req = byId.get(to);
        if (!req || req.y !== "requirement" || req.s !== "superseded") continue;
        add("satisfies-superseded",
          `${bp.i} satisfies a superseded requirement`,
          "repoint to the survivor or retire the blueprint — /relink after requirement-cleanup",
          bp.i);
      }
    }
  },
};
