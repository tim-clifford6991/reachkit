// ---- high-risk-without-mutation (front-matter grammar only) -------------

import { tstSections, validatingTsts } from "./tst-without-regression.mjs";

const VOCAB = new Set(["high", "normal"]);

export default {
  id: "high-risk-without-mutation",
  text: "a done high-risk work order whose validation records no mutation test",
  run(ctx) {
    const { graph, cfg, add } = ctx;
    // 0.13.2: mutation testing is scoped by risk rather than run on
    // everything. §8's "a test that survives deletion of its feature is
    // vacuous" has not moved — what moved is where the doctrine spends the
    // pass. A `risk: high` order sits on one of the project's named seams
    // (money, access control, data leaving the system, third-party
    // callbacks, publishing state machines) where a vacuous test is
    // expensive and silent; everywhere else, plain criterion tests.
    //
    // So the gate is narrow and hard: a high-risk order cannot be `done`
    // without a `Mutation:` line in the validation section that covers it.
    // Error, not warn, for the same reason done-without-validation is one —
    // `done` is a completion claim, and an unmutated high-risk one is a
    // defect now, not a future task.
    //
    // Second shape, same claim: a `risk:` value the grammar does not name is
    // reported here rather than silently read as `normal`. A typo would
    // otherwise disable this gate on exactly the orders it exists for, and
    // a gate that fails open on a typo is worse than none.
    if (cfg.grammar !== "front-matter") return;

    const sections = tstSections(graph);
    for (const n of graph.nodes) {
      if (n.y !== "work-order") continue;
      const risk = n.m?.Risk;
      if (risk && !VOCAB.has(risk)) {
        add("high-risk-without-mutation",
          `${n.i} declares risk: ${risk}, which the grammar does not name`,
          "the field takes exactly `high` or `normal` (absent means normal) — until it does, this order's mutation gate cannot run",
          n.i);
        continue;
      }
      if (risk !== "high" || n.s !== "done") continue;
      const tsts = validatingTsts(graph, n.i);
      if (!tsts.length) continue; // done-without-validation's business
      const latest = tsts[tsts.length - 1];
      const section = sections.get(latest) || "";
      const mutated = section.split("\n").some((line) => line.trim().startsWith("Mutation:"));
      if (!mutated) {
        add("high-risk-without-mutation",
          `${n.i} is a done high-risk order and ${latest} records no mutation test`,
          "add a `Mutation:` line to that section — a high-risk order's tests must be shown to discriminate (§8)",
          n.i);
      }
    }
  },
};
