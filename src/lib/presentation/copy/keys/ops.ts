// The owner-only sentences of the operations mails. No customer reads these
// (`docs/RUNBOOK.md` §8); they are apart from `mail.ts` so an owner line
// never shares a partition with a customer one.
import type { CopyPartition } from "../registry.ts";

export const OPS_COPY = Object.freeze({
  "ops.cost-drift.week": [
    "These sources were billed more than {over} times what we estimated for the same calls last week. The caps still decide on the estimates, so the price book needs updating.",
    { slots: { over: "text" }, fixedBy: "owner ruling W1, 2026-10-20 (drafted)" },
  ],
  "ops.cost-drift.fact.source": ["Source", { slots: {}, fixedBy: "owner ruling W1, 2026-10-20 (drafted)" }],
  "ops.cost-drift.fact.billed": ["Billed", { slots: {}, fixedBy: "owner ruling W1, 2026-10-20 (drafted)" }],
  "ops.cost-drift.fact.estimated": ["Estimated for the same calls", { slots: {}, fixedBy: "owner ruling W1, 2026-10-20 (drafted)" }],
  "ops.cost-drift.fact.ratio": ["Billed / estimated", { slots: {}, fixedBy: "owner ruling W1, 2026-10-20 (drafted)" }],
  "ops.replan.committed": [
    "A deploy changed how weeks are chosen, and each paying site's week has been re-planned from its next unwritten day. The committed week and the new one are below, for information. A held site keeps its committed week.",
    { slots: {}, fixedBy: "owner ruling, 2026-11-16, issue 2726 (drafted)" },
  ],
  "ops.replan.fact.planner": ["Planner", { slots: {}, fixedBy: "owner ruling, 2026-11-16, issue 2726 (drafted)" }],
  "ops.replan.fact.from": ["Re-planned from", { slots: {}, fixedBy: "owner ruling, 2026-11-16, issue 2726 (drafted)" }],
  "ops.replan.fact.unmeasured": ["Not measured in the stored pass", { slots: {}, fixedBy: "owner ruling, 2026-11-16, issue 2726 (drafted)" }],
  "ops.replan.fact.held": ["Held, the committed week stands", { slots: {}, fixedBy: "owner ruling, 2026-11-16, issue 2726 (drafted)" }],
  "ops.replan.fact.committed": ["Committed before", { slots: {}, fixedBy: "owner ruling, 2026-11-16, issue 2726 (drafted)" }],
  "ops.replan.fact.replanned": ["Committed now", { slots: {}, fixedBy: "owner ruling, 2026-11-16, issue 2726 (drafted)" }],
}) satisfies CopyPartition;
