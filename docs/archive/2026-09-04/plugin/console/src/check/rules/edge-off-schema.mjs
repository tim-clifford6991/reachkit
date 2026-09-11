// ---- edge-off-schema (front-matter grammar only) ------------------------
import { REL_VERB } from "./_shared.mjs";

export default {
  id: "edge-off-schema",
  text: "a declared edge whose ends are not the node types the graph contract allows",
  run(ctx) {
    const { graph, cfg, root, add, notices, notRun, byId } = ctx;
    // The graph contract (docs/design/04-p1-backbone.md § "The graph
    // contract"): every declared edge names, in cfg.edges, which node types
    // its two ends may be. This rule is the enforcement — not a parse error
    // (the edge is real, declared, and read correctly) but a modeling
    // question a human should adjudicate: should a blueprint really satisfy a
    // blueprint? Judged only where both ends resolve to a node in this corpus
    // (a dangling id is dangling-id's problem, not this rule's), and only for
    // a `rel` cfg.edges actually names — a project's own extra relations
    // (declared via `relations` for head-block, or simply not in cfg.edges)
    // are its own business.
    if (cfg.grammar === "front-matter") {
      const offSchema = [];
      for (const [from, to, rel] of graph.edges) {
        const allowed = cfg.edges[rel];
        if (!allowed) continue;
        const fromNode = byId.get(from);
        const toNode = byId.get(to);
        if (!fromNode || !toNode) continue;
        const fromOk = allowed.from.includes("*") || allowed.from.includes(fromNode.y);
        const toOk = allowed.to.includes("*") || allowed.to.includes(toNode.y) ||
          (allowed.to.includes("same") && toNode.y === fromNode.y);
        if (fromOk && toOk) continue;
        offSchema.push({ from, to, rel, fromType: fromNode.y, toType: toNode.y, allowed });
      }
      offSchema.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0)));
      for (const v of offSchema) {
        // `validates` and `exercises` are the two derived relations — a human
        // never types them, the parser mints them from a `## TST-###` heading
        // (validates) or a journey step's `exercises:` list (exercises). "fix
        // the edge" makes no sense for either: there is no edge line to edit,
        // only the heading or the step that produced it.
        const fix = v.rel === "validates"
          ? "this edge comes from a `## TST-###` heading in the work order's body — fix the heading"
          : v.rel === "exercises"
            ? "this edge comes from a journey step's `exercises:` list — fix the step"
            : "fix the edge";
        add("edge-off-schema",
          `\`${v.from} -${v.rel}-> ${v.to}\`: a ${v.fromType} may not ${REL_VERB[v.rel] || v.rel} a ${v.toType}`,
          `the contract allows ${v.rel}: ${v.allowed.from.join("/")} → ${v.allowed.to.join("/")} — ` +
          `${fix}, or change the contract in factory.config.json`,
          v.from);
      }
    }
  },
};
