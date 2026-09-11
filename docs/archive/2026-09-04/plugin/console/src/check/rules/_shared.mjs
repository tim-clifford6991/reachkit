// Helpers shared by the rules — one module, imported by name, never a second
// copy inside a rule file (proposal 24, S2).

/**
 * Which declared status vocabulary governs a given type.
 *
 * Front-matter nodes carry a semantic type name ("requirement", "validation",
 * …) that never matches an uppercase `cfg.types[].id` — so that lookup is
 * tried first, under `cfg.statuses[typeId]` directly (constitution rule
 * 2.2b's six per-type vocabularies: requirement/blueprint/work-order/
 * decision/validation/feedback). `validation` in particular has no entry in
 * `cfg.types` at all — it is derived structurally, not a directory — so it
 * would fall through to the single legacy `artifact` vocabulary without this
 * branch, which is exactly the "6 errors of pure vocabulary noise" this rule
 * used to produce against a front-matter corpus.
 */
export function vocabularyFor(typeId, cfg) {
  if (cfg.grammar === "front-matter" && cfg.statuses[typeId]) return cfg.statuses[typeId];
  const t = cfg.types.find((x) => x.id === typeId);
  if (!t) return cfg.statuses.artifact;
  if (t.table) return cfg.statuses.registry;
  if (cfg.statuses[typeId]) return cfg.statuses[typeId];
  return cfg.statuses.artifact;
}

// A verb phrase for each edge name, used only to render edge-off-schema's
// summary as an English sentence ("a blueprint may not satisfy a
// blueprint"). Purely cosmetic — the judgment itself is cfg.edges, not this
// map — but a summary that reads as a sentence is what makes the finding a
// question a human can adjudicate rather than a triple to decode.
export const REL_VERB = {
  satisfies: "satisfy",
  covers: "cover",
  implements: "implement",
  "decides-for": "decide for",
  about: "be about",
  "depends-on": "depend on",
  "blocked-by": "be blocked by",
  supersedes: "supersede",
  validates: "validate",
  exercises: "exercise",
};

// The altitude helpers (0.11.0): closed over the graph they measure, so a
// rule asks for them by calling helpers(ctx) once at the top of run().
export function helpers(graph, cfg, byId) {
  const HB_KIND = { REQ: "requirement", BP: "blueprint", WO: "work-order", ADR: "decision", FB: "feedback", JN: "journey" };
  const kindOf = (n) => (cfg.grammar === "front-matter" ? n.y : HB_KIND[n.y] || n.y);
  const isApprovedNode = (n) => n.s === "approved" || (kindOf(n) === "decision" && n.s === "accepted");
  const quantile = (sorted, p) => (sorted.length ? sorted[Math.floor((sorted.length - 1) * p)] : 0);
  const fmt = (n) => n.toLocaleString("en-US");
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const openRows = (n) => (n.a || []).filter((r) => r.disposition === "open");

  const fanout = () => {
    const approvedReq = graph.nodes.filter((n) => kindOf(n) === "requirement" && n.s === "approved");
    const wos = graph.nodes.filter((n) => kindOf(n) === "work-order" && n.s !== "superseded");
    const woIds = new Set(wos.map((n) => n.i));
    const sat = new Map();
    for (const [from, to, rel] of graph.edges) {
      if (rel !== "satisfies") continue;
      if (!sat.has(from)) sat.set(from, new Set());
      sat.get(from).add(to);
    }
    const woOf = new Map();
    for (const [from, to, rel] of graph.edges) {
      if (rel !== "implements" || !woIds.has(from)) continue;
      const t = byId.get(to);
      if (!t) continue;
      const k = kindOf(t);
      const reqs = k === "requirement" ? [t.i] : k === "blueprint" ? [...(sat.get(t.i) || [])] : [];
      for (const r of reqs) {
        if (!woOf.has(r)) woOf.set(r, new Set());
        woOf.get(r).add(from);
      }
    }
    const reached = new Set();
    const counts = approvedReq.map((r) => {
      const set = woOf.get(r.i) || new Set();
      for (const w of set) reached.add(w);
      return { id: r.i, ids: [...set].sort(), n: set.size };
    });
    const sorted = counts.map((c) => c.n).sort((a, b) => a - b);
    return {
      approvedReq, wos, counts,
      unreached: wos.filter((w) => !reached.has(w.i)).length,
      median: quantile(sorted, 0.5), p90: quantile(sorted, 0.9),
      perReq: approvedReq.length ? counts.reduce((s, c) => s + c.n, 0) / approvedReq.length : null,
    };
  };

  return { HB_KIND, kindOf, isApprovedNode, quantile, fmt, plural, openRows, fanout };
}
