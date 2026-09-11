// `factory-console next` — the state-derived answer to "which verb now?"
//
// The router hook (0.9.0) maps a MESSAGE to a verb; this maps the CORPUS to
// one. The two questions are different — "where does this ask go?" versus
// "what does the pipeline need next?" — and the second was unanswerable
// without re-reading the corpus by hand (first live project, 2026-09-01:
// "it is hard to know what slash command to trigger").
//
// Ordering is finish-what-is-started: an owner signature, then open review
// lines, then the open wave's next work order, then waving approved-but-
// unwaved work, then cutting deeper artifacts, then expanding requirements.
// Derived on read, never stored; read-only like every other mode.

const cap = (ids, n = 8) =>
  ids.length <= n ? ids.join(", ") : ids.slice(0, n).join(", ") + ` … +${ids.length - n}`;

// Rule 7.3's gate, asked where the dispatch happens (0.13.1).
//
// Until this, the gate lived in prose — `/implement`'s preconditions, the
// design-system skill's step order — and in `preview-without-url`, which
// runs after the fact. On ReachKit v3's W2 a stand-in orchestrator read the
// prose, dispatched the implementer for a `ui: yes` work order with no
// signed preview, and only caught it afterwards. A gate that is only prose
// is a gate that a fresh session skips, so this verb refuses to point at
// `/implement` for such a work order and points at `/design` instead.
//
// The signal is the `Signed-off:` bullet carrying a real DATE. An unsigned
// work order cut from the template carries the literal `Signed-off: <date>`
// placeholder (`skills/work-order-writing/SKILL.md`: the planner never
// dates it in advance), so presence of the key proves nothing and only a
// date does — the librarian writes it, and nobody else (rule 7.3).
const SIGNED_OFF = /^\s*[-*]?\s*Signed-off:\s*\d{4}-\d{2}-\d{2}/m;
// The one way past the gate: the owner's own ruling, recorded in the log
// where the next agent resumes (rule 6.1) rather than given in a session
// nobody can read back. Waives, and stays visible in the file forever.
const OWNER_RULING = /^\s*[-*]\s*\d{4}-\d{2}-\d{2}\s+ruled\s+[—-]\s+owner\b/m;

/** @returns {string|null} why rule 7.3 holds this work order, or null if it doesn't. */
export function previewGate(n) {
  if (!n || n.y !== "work-order" || !n.u) return null;
  const body = n.b || "";
  if (SIGNED_OFF.test(body)) return null;
  if (OWNER_RULING.test(body)) return null;
  return `${n.i} is ui: yes and carries no signed preview — rule 7.3 holds it before an implementer opens it`;
}

export function computeNext(graph) {
  const nodes = graph.nodes;
  const byId = new Map(nodes.map((n) => [n.i, n]));
  const stages = [];

  // 1 — owner artifacts sitting in-review: nothing below moves without the
  // owner's own `status: approved` (constitution §3's two owner gates).
  const ownerTypes = new Set(["requirement", "journey"]);
  const inReview = nodes.filter((n) => ownerTypes.has(n.y) && n.s === "in-review").map((n) => n.i);
  if (inReview.length) stages.push({
    key: "owner-signature", verb: "approve or return (owner — set status: approved)",
    ids: inReview,
    why: `${inReview.length} owner artifact(s) sit in-review; only the owner's signature moves them`,
  });

  // 2 — draft owner artifacts still carrying open REVIEW lines (rule 3.4:
  // a draft carrying open lines is not ready to approve).
  const openLines = nodes
    .filter((n) => ownerTypes.has(n.y) && n.s === "draft")
    .map((n) => ({ id: n.i, k: ((n.b || "").match(/REVIEW\(/g) || []).length }))
    .filter((x) => x.k > 0);
  if (openLines.length) stages.push({
    key: "open-reviews", verb: "/require (finish the rounds)",
    ids: openLines.map((x) => `${x.id}(${x.k})`),
    why: `${openLines.reduce((a, b) => a + b.k, 0)} open REVIEW line(s) on draft owner artifacts`,
  });

  // 3 — the open wave: in-flight work beats new expansion (rule 7.4).
  const w = graph.waves || {};
  if (w.current) {
    const row = (w.list || []).find((r) => r.id === w.current);
    const undone = (row?.wos || []).filter((id) => byId.get(id)?.s !== "done");
    const held = undone.length ? previewGate(byId.get(undone[0])) : null;
    if (undone.length && held) stages.push({
      key: "preview-gate", verb: `/design preview ${undone[0]}`,
      ids: undone,
      why: `wave ${w.current} is open and ${undone[0]} is first in its order, but ${held}`,
    });
    else if (undone.length) stages.push({
      key: "wave-open", verb: `/implement ${undone[0]}`,
      ids: undone,
      why: `wave ${w.current} is open — ${undone.length} of ${row.wos.length} work order(s) not done; ${undone[0]} is first in its order`,
    });
    else stages.push({
      key: "wave-close", verb: "/wave close",
      ids: [w.current],
      why: `every work order in ${w.current} is done`,
    });
  }

  // 4 — approved work with no wave, and no wave open: propose one.
  const unwaved = nodes
    .filter((n) => n.y === "work-order" && n.s === "approved" && !(n.m && n.m.Wave))
    .map((n) => n.i);
  if (!w.current && unwaved.length) stages.push({
    key: "wave-propose", verb: "/wave propose",
    ids: unwaved,
    why: `${unwaved.length} approved work order(s) carry no wave and no wave is open`,
  });

  // 5 — approved blueprints nothing implements yet.
  const implemented = new Set(
    graph.edges
      .filter(([f, , r]) => r === "implements" && byId.get(f)?.y === "work-order" && byId.get(f)?.s !== "superseded")
      .map(([, t]) => t)
  );
  const bpNoWo = nodes
    .filter((n) => n.y === "blueprint" && n.s === "approved" && !implemented.has(n.i))
    .map((n) => n.i);
  if (bpNoWo.length) stages.push({
    key: "cut-wos", verb: "/workorder",
    ids: bpNoWo,
    why: `${bpNoWo.length} approved blueprint(s) have no current work order`,
  });

  // 6 — approved requirements no blueprint satisfies (rule 5.4: satisfies,
  // never covers, is the gate-bearing edge).
  const satisfied = new Set(graph.edges.filter(([, , r]) => r === "satisfies").map(([, t]) => t));
  const reqNoBp = nodes
    .filter((n) => n.y === "requirement" && n.s === "approved" && !satisfied.has(n.i))
    .map((n) => n.i);
  if (reqNoBp.length) stages.push({
    key: "expand", verb: "/expand-requirement",
    ids: reqNoBp,
    why: `${reqNoBp.length} approved requirement(s) have no satisfying blueprint`,
  });

  if (!stages.length) stages.push({
    key: "idle", verb: "/require",
    ids: [],
    why: "nothing is gated or in flight — the pipeline is idle; the next ask starts it",
  });

  return { headline: stages[0], stages };
}

export function formatNext(r) {
  const out = [];
  out.push(`➤ ${r.headline.verb}`);
  out.push(`  ${r.headline.why}${r.headline.ids.length ? ` — ${cap(r.headline.ids)}` : ""}`);
  if (r.stages.length > 1) {
    out.push("", "also live:");
    for (const s of r.stages.slice(1)) {
      out.push(`  ${s.verb.padEnd(26)} ${s.why}${s.ids.length ? ` — ${cap(s.ids, 5)}` : ""}`);
    }
  }
  return out.join("\n");
}
