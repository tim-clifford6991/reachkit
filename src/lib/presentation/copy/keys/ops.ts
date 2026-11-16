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
  "ops.replan.waiting": [
    "A deploy changed how weeks are chosen. Each paying site's committed week and its re-planned week are below. Nothing is committed until you give this planner your OK: run the statement below in the database.",
    { slots: {}, fixedBy: "owner ruling, 2026-11-16, #2726 (drafted)" },
  ],
  "ops.replan.overdue": [
    "These re-planned weeks have waited 48 hours for your OK. Nothing has been committed, and nothing will be until you run the statement below.",
    { slots: {}, fixedBy: "owner ruling, 2026-11-16, #2726 (drafted)" },
  ],
  "ops.replan.fact.planner": ["Planner", { slots: {}, fixedBy: "owner ruling, 2026-11-16, #2726 (drafted)" }],
  "ops.replan.fact.ok": ["To give your OK, run", { slots: {}, fixedBy: "owner ruling, 2026-11-16, #2726 (drafted)" }],
  "ops.replan.fact.from": ["Re-planned from", { slots: {}, fixedBy: "owner ruling, 2026-11-16, #2726 (drafted)" }],
  "ops.replan.fact.unmeasured": ["Not measured in the stored pass", { slots: {}, fixedBy: "owner ruling, 2026-11-16, #2726 (drafted)" }],
  "ops.replan.fact.held": ["Held, the committed week stands", { slots: {}, fixedBy: "owner ruling, 2026-11-16, #2726 (drafted)" }],
  "ops.replan.fact.committed": ["Committed now", { slots: {}, fixedBy: "owner ruling, 2026-11-16, #2726 (drafted)" }],
  "ops.replan.fact.replanned": ["Re-planned", { slots: {}, fixedBy: "owner ruling, 2026-11-16, #2726 (drafted)" }],
}) satisfies CopyPartition;
