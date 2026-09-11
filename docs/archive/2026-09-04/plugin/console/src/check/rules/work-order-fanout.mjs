// ---- work-order-fanout (front-matter grammar only) -----------------------
import { helpers } from "./_shared.mjs";

export default {
  id: "work-order-fanout",
  text: "an approved requirement with more work orders than the floor allows",
  run(ctx) {
    const { graph, cfg, root, add, notices, notRun, byId } = ctx;
    const { HB_KIND, kindOf, isApprovedNode, quantile, fmt, plural, openRows, fanout } = helpers(graph, cfg, byId);
    // Rule 2.6's floor, read. One finding per approved requirement over
    // `checks.workOrdersPerRequirement`; the coverage notice names how many
    // requirements were measured, how many reach no work order at all (that is
    // `next`'s and /expand-requirement's business, not this rule's), and how
    // many work orders reach no approved requirement through implements/
    // satisfies — outside this measure, and said so.
    if (cfg.grammar === "front-matter") {
      const fo = fanout();
      if (!fo.approvedReq.length || !fo.wos.length) {
        notices.push(`work-order-fanout cannot run — ${!fo.approvedReq.length ? "no approved requirement" : "no work order"} in this corpus yet.`);
        notRun.push("work-order-fanout");
      } else {
        const floor = cfg.checks.workOrdersPerRequirement ?? 6;
        for (const c of fo.counts) {
          if (c.n > floor) {
            add("work-order-fanout",
              `${c.id} has ${c.n} work orders (floor: ${floor}) — rule 2.6`,
              c.ids.join(", "),
              c.id);
          }
        }
        notices.push(
          `work-order-fanout: ${plural(fo.approvedReq.length, "approved requirement")} measured · ` +
          `${fo.counts.filter((c) => c.n === 0).length} reach no work order · ` +
          `${plural(fo.unreached, "work order")} ${fo.unreached === 1 ? "reaches" : "reach"} no approved requirement through implements/satisfies and ${fo.unreached === 1 ? "is" : "are"} outside this measure · ` +
          `median ${fo.median}, p90 ${fo.p90}`
        );
      }
    }
  },
};
