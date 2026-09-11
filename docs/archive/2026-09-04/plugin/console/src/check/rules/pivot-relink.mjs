// ---- pivot-relink (0.12.0, rule 7.5) --------------------------------------
import { helpers } from "./_shared.mjs";

export default {
  id: "pivot-relink",
  text: "a surviving artifact still names an id a pivot archived",
  run(ctx) {
    const { graph, cfg, root, add, notices, notRun, byId } = ctx;
    const { HB_KIND, kindOf, isApprovedNode, quantile, fmt, plural, openRows, fanout } = helpers(graph, cfg, byId);
    // After `factory-console pivot`, every durable artifact's edges were
    // rewritten from an archived blueprint or work order to the requirements it
    // reached; what could not be rewritten was left, with a REVIEW(gap) line.
    // This is the rule that keeps reporting those. The parser has already
    // sorted archived citations out of dangling-id (an archived file exists —
    // it is not missing), so each one is reported here once, by the artifact
    // that carries it, with the fix named. A corpus with no archive has nothing
    // to relink: that is a true clean, not an inability to judge, so it stays
    // silent — most corpora never pivot, and a notice on every run would be
    // the loud index 2.3b retired.
    {
      const archived = graph.health.archived || {};
      const carriers = new Map();
      for (const [id, refs] of Object.entries(archived)) {
        for (const { from, rel } of refs) {
          if (!carriers.has(from)) carriers.set(from, []);
          carriers.get(from).push({ id, rel });
        }
      }
      for (const [from, refs] of [...carriers].sort(([a], [b]) => a.localeCompare(b))) {
        add("pivot-relink",
          `${from} still names ${refs.map((r) => `${r.id} (${r.rel})`).join(", ")} — archived by a pivot`,
          `relink to the requirement(s) the archived node reached, or record why it cannot be (rule 7.5)`,
          from);
      }
      if (graph.archive?.present) {
        const durableTypes = new Set(cfg.types.filter((t) => t.durability === "durable").map((t) => t.id));
        const durableNodes = graph.nodes.filter((n) => {
          const prefix = n.i.split("-")[0];
          return durableTypes.has(prefix);
        }).length;
        notices.push(
          `pivot-relink: ${plural(graph.archive.sets.length, "archive")} (${graph.archive.sets.join(", ")}) · ` +
          `${graph.archive.ids.length} archived ids · ${durableNodes} durable artifacts measured · ${carriers.size} still cite an archived id`
        );
      }
    }
  },
};
