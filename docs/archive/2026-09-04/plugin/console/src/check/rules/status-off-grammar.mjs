// ---- status-off-grammar -----------------------------------------------
import { vocabularyFor } from "./_shared.mjs";

export default {
  id: "status-off-grammar",
  text: "a status word outside the declared set",
  run(ctx) {
    const { graph, cfg, root, add, notices, notRun, byId } = ctx;
    const offByType = new Map();
    const unsetByType = new Map();
    for (const n of graph.nodes) {
      const declared = vocabularyFor(n.y, cfg);
      if (!n.s) {
        unsetByType.set(n.y, (unsetByType.get(n.y) || 0) + 1);
        continue;
      }
      if (declared.includes(n.s)) continue;
      if (!offByType.has(n.y)) offByType.set(n.y, new Map());
      const m = offByType.get(n.y);
      m.set(n.s, (m.get(n.s) || 0) + 1);
    }
    for (const [type, words] of offByType) {
      const declared = vocabularyFor(type, cfg);
      const rows = [...words.values()].reduce((a, b) => a + b, 0);
      add("status-off-grammar",
        `${type}: ${rows} artifacts carry ${words.size} status words the grammar does not name`,
        [...words].map(([w, c]) => `${w} ×${c}`).join(" · ") + `  (declared: ${declared.join(", ")})`,
        type);
    }
    for (const [type, n] of unsetByType) {
      add("status-off-grammar",
        `${type}: ${n} artifacts carry no status at all`,
        `declared: ${vocabularyFor(type, cfg).join(", ")}`,
        type);
    }
  },
};
