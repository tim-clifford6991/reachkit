// ---- open-assumption-on-done (front-matter grammar only) -----------------
import { helpers } from "./_shared.mjs";

export default {
  id: "open-assumption-on-done",
  text: "a done work order still carrying an open rests-on row",
  run(ctx) {
    const { graph, cfg, root, add, notices, notRun, byId } = ctx;
    const { HB_KIND, kindOf, isApprovedNode, quantile, fmt, plural, openRows, fanout } = helpers(graph, cfg, byId);
    // §3's sixth gate: a done work order carries no open rests-on row — its
    // validator dispositioned every one before the verdict (2.3b). `done` is a
    // completion claim, so the shipped severity is error, the same reasoning
    // as done-without-validation. No done work order yet: notRun, with the
    // carrier count as the notice, so the rule's silence reads as "not yet"
    // and never as "clean".
    if (cfg.grammar === "front-matter") {
      const woAll = graph.nodes.filter((n) => n.y === "work-order");
      const carry = woAll.filter((n) => (n.a || []).length).length;
      const done = woAll.filter((n) => n.s === "done");
      if (!done.length) {
        notices.push(`open-assumption-on-done cannot run — no done work order yet (${carry} of ${woAll.length} work orders carry rests-on).`);
        notRun.push("open-assumption-on-done");
      } else {
        for (const n of done) {
          const open = openRows(n);
          if (!open.length) continue;
          add("open-assumption-on-done",
            `${n.i} is done with ${plural(open.length, "open rests-on row")} — 2.3b`,
            open.map((r) => r.claim.slice(0, 80)).join(" · "),
            n.i);
        }
        notices.push(`open-assumption-on-done: ${plural(done.length, "done work order")} measured · ${carry} of ${woAll.length} work orders carry rests-on`);
      }
    }
  },
};
