// ---- tst-without-regression (front-matter grammar only) ----------------

/**
 * Every `## TST-###` section in the corpus, by id, with the body text that
 * follows it — bounded by the next heading's start, the same bound
 * extract/front-matter.mjs computes for readVerdict.
 *
 * Shared by this rule and `high-risk-without-mutation` (0.13.2): both ask
 * "what does the validation section that covers this order actually say?",
 * and since 0.13.2 that section is often not in the order's own body — one
 * wave-level TST carries a `Validates:` list and the parser turns each
 * entry into a real `validates` edge.
 */
export function tstSections(graph) {
  const RE = /^#{1,3}\s+(TST-\d+(?:-R\d*)?)\s+[—-]\s*(.+?)\s*$/gm;
  const out = new Map();
  for (const n of graph.nodes) {
    if (n.y !== "work-order") continue;
    const body = n.b || "";
    RE.lastIndex = 0;
    const heads = [];
    let m;
    while ((m = RE.exec(body))) heads.push({ id: m[1], start: m.index, end: m.index + m[0].length });
    for (let i = 0; i < heads.length; i++) {
      if (out.has(heads[i].id)) continue; // first declaration wins, as the parser does
      out.set(heads[i].id, body.slice(heads[i].end, i + 1 < heads.length ? heads[i + 1].start : body.length));
    }
  }
  return out;
}

/** The TST ids that validate this node, latest last ("-R" sorts after the
 *  base id, "-R2" after "-R" — the blockers panel's own convention). */
export function validatingTsts(graph, id) {
  return graph.edges.filter((e) => e[2] === "validates" && e[1] === id).map((e) => e[0]).sort();
}

export default {
  id: "tst-without-regression",
  text: "a done work order whose latest validation records no regression",
  run(ctx) {
    const { graph, cfg, add } = ctx;
    // A done work order's latest validation should say what regression sweep
    // backed the verdict, not just describe the new work — rule 3 (the
    // validator's structure-compliance step) extended by /regress.
    //
    // Silent on a done WO nothing validates: that gap belongs to
    // done-without-validation, not this rule.
    //
    // 0.13.2: the section is found through the `validates` edge rather than
    // by re-scanning the order's own body, because a wave-level TST lives in
    // one order and validates several. The gate is per wave now (§3), so the
    // regression line is written once, on that section, and every order the
    // section names is covered by it.
    if (cfg.grammar !== "front-matter") return;

    const sections = tstSections(graph);
    for (const n of graph.nodes) {
      if (n.y !== "work-order" || n.s !== "done") continue;
      const tsts = validatingTsts(graph, n.i);
      if (!tsts.length) continue; // done-without-validation's business
      const latest = tsts[tsts.length - 1];
      const section = sections.get(latest) || "";
      const hasRegression = section.split("\n").some((line) => line.trim().startsWith("Regression:"));
      if (!hasRegression) {
        add("tst-without-regression",
          `${n.i} is done and its latest validation records no regression`,
          `add a "Regression:" line to ${latest} via /regress — rule 3 extended`,
          n.i);
      }
    }
  },
};
