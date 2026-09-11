// ---- assumption-budget (front-matter grammar only) -----------------------
import { helpers } from "./_shared.mjs";

export default {
  id: "assumption-budget",
  text: "open rests-on rows per approved artifact over budget",
  run(ctx) {
    const { graph, cfg, root, add, notices, notRun, byId } = ctx;
    const { HB_KIND, kindOf, isApprovedNode, quantile, fmt, plural, openRows, fanout } = helpers(graph, cfg, byId);
    // Rule 2.3b's ratio: open rests-on rows per approved artifact (approved
    // REQ/BP/WO/JN, accepted ADR). The coverage notice carries the same
    // denominator assumptions.md's own coverage line prints, so the two never
    // disagree; the finding, when the budget is crossed, names the per-type
    // split and the five heaviest carriers so the fix has an address.
    if (cfg.grammar === "front-matter") {
      const carriers = graph.nodes.filter((n) => (n.a || []).length);
      const rows = graph.nodes.flatMap((n) => n.a || []);
      const by = { open: 0, confirmed: 0, refuted: 0, undischargeable: 0 };
      let offGrammar = 0;
      for (const r of rows) {
        if (r.disposition in by) by[r.disposition]++;
        else offGrammar++;
      }
      notices.push(
        `assumption-budget: ${carriers.length} of ${graph.nodes.length} nodes carry rests-on · ${plural(rows.length, "row")} · ` +
        `open ${by.open} / confirmed ${by.confirmed} / refuted ${by.refuted} / undischargeable ${by.undischargeable}` +
        (offGrammar ? ` / off-grammar ${offGrammar}` : "")
      );
      const approved = graph.nodes.filter(isApprovedNode);
      if (!approved.length) {
        notices.push("assumption-budget cannot run — no approved artifact in this corpus yet.");
        notRun.push("assumption-budget");
      } else {
        const budget = cfg.checks.openAssumptionsPerApproved ?? 0.5;
        const openOnApproved = approved.reduce((s, n) => s + openRows(n).length, 0);
        const ratio = openOnApproved / approved.length;
        if (ratio > budget) {
          const perType = {};
          for (const n of approved) perType[kindOf(n)] = (perType[kindOf(n)] || 0) + openRows(n).length;
          const heaviest = approved
            .map((n) => ({ id: n.i, n: openRows(n).length }))
            .filter((x) => x.n)
            .sort((a, b) => b.n - a.n || a.id.localeCompare(b.id))
            .slice(0, 5);
          add("assumption-budget",
            `${openOnApproved} open rests-on rows on ${approved.length} approved artifacts (${ratio.toFixed(2)}; budget ${budget}) — 2.3b`,
            `by type: ${Object.entries(perType).map(([k, v]) => `${k} ${v}`).join(", ")} · heaviest: ${heaviest.map((x) => `${x.id} (${x.n})`).join(", ")}`,
            "rests-on");
        }
      }
    }
  },
};
