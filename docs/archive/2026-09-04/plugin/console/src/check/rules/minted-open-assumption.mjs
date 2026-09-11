// ---- minted-open-assumption (0.12.0, front-matter grammar only) ----------
import { helpers } from "./_shared.mjs";

export default {
  id: "minted-open-assumption",
  text: "a consolidated work order carries an open rests-on row it minted at merge",
  run(ctx) {
    const { graph, cfg, root, add, notices, notRun, byId } = ctx;
    const { HB_KIND, kindOf, isApprovedNode, quantile, fmt, plural, openRows, fanout } = helpers(graph, cfg, byId);
    // The 0.11.0 live test missed P6c by five rows: consolidation minted
    // rests-on rows on the merged orders, and only a done audit discharges a
    // work order's rows, so the count went up before the first build could
    // bring it down. Rule 1.1 already says what the planner does with a
    // parameter it chooses — it chooses it and records the derivation. A row
    // the planner mints at merge is such a parameter: dispositioned by the
    // planner, then and there (confirmed, refuted, undischargeable), never
    // left open for a validator that has not run yet. A row CARRIED from a
    // replaced order keeps whatever it had — it was raised by another stage
    // and is that stage's to discharge — so this rule reads the difference:
    // an open row on a consolidated order (non-empty `supersedes:` naming
    // work orders) whose claim appears on none of the orders it supersedes
    // was minted at merge and should not be open.
    if (cfg.grammar === "front-matter") {
      const supersedesOf = new Map();
      for (const [from, to, rel] of graph.edges) {
        if (rel !== "supersedes") continue;
        if (!supersedesOf.has(from)) supersedesOf.set(from, new Set());
        supersedesOf.get(from).add(to);
      }
      const consolidated = graph.nodes.filter((n) => n.y === "work-order" && n.s !== "superseded" && [...(supersedesOf.get(n.i) || [])].some((t) => byId.get(t)?.y === "work-order"));
      let carried = 0, minted = 0, mintedOpen = 0;
      for (const n of consolidated) {
        const replaced = [...(supersedesOf.get(n.i) || [])].map((t) => byId.get(t)).filter((t) => t?.y === "work-order");
        const carriedClaims = new Set(replaced.flatMap((t) => (t.a || []).map((r) => r.claim.trim())));
        const open = [];
        for (const r of n.a || []) {
          if (carriedClaims.has(r.claim.trim())) { carried++; continue; }
          minted++;
          if (r.disposition === "open") { mintedOpen++; open.push(r.claim); }
        }
        if (open.length) {
          add("minted-open-assumption",
            `${n.i} supersedes ${replaced.map((t) => t.i).join(", ")} and carries ${plural(open.length, "open rests-on row")} minted at merge — rule 1.1`,
            `the planner dispositions what it mints (confirmed · refuted · undischargeable): ${open.map((c) => c.slice(0, 70)).join(" · ")}`,
            n.i);
        }
      }
      if (consolidated.length) {
        notices.push(`minted-open-assumption: ${plural(consolidated.length, "consolidated work order")} measured · ${carried} rows carried · ${minted} minted at merge · ${mintedOpen} minted still open`);
      }
    }
  },
};
