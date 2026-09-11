// ---- field-vocabulary --------------------------------------------------

export default {
  id: "field-vocabulary",
  text: "one field, several spellings or key casings",
  run(ctx) {
    const { graph, cfg, root, add, notices, notRun, byId } = ctx;
    // This one bit the prototype directly: successive passes reported 2, then
    // 7, then the true 16 UI-gated work orders, purely from field spelling.
    for (const [name, field] of Object.entries(cfg.fields)) {
      const seen = graph.fieldVocab?.[name] || {};
      const canonical = new Set([...field.true, ...field.false]);
      const off = Object.entries(seen).filter(([v]) => !canonical.has(v));
      if (off.length) {
        add("field-vocabulary",
          `${name}: ${off.length} value${off.length > 1 ? "s" : ""} outside the declared vocabulary`,
          off.map(([v, c]) => `${v} ×${c}`).join(" · ") +
            `  (declared: ${[...field.true].join("/")} = true, ${[...field.false].join("/")} = false)`,
          name);
      }
      const casings = Object.entries(graph.keyCase || {})
        .filter(([k]) => k.toLowerCase() === name.toLowerCase() && k !== field.key);
      if (casings.length) {
        add("field-vocabulary",
          `${name}: the key is written ${casings.length + 1} different ways`,
          [`${field.key} ×${graph.keyCase[field.key] || 0}`, ...casings.map(([k, c]) => `${k} ×${c}`)].join(" · "),
          name);
      }
    }
  },
};
