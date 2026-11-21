// The owner-only sentences of the operations mails. No customer reads these
// (`docs/RUNBOOK.md` §8); they are apart from `mail.ts` so an owner line
// never shares a partition with a customer one.
import type { CopyPartition } from "../registry.ts";

export const OPS_COPY = Object.freeze({
  "ops.cost-drift.week": "These sources were billed more than {over} times what we estimated for the same calls last week. The caps still decide on the estimates, so the price book needs updating.",
  "ops.cost-drift.fact.source": "Source",
  "ops.cost-drift.fact.billed": "Billed",
  "ops.cost-drift.fact.estimated": "Estimated for the same calls",
  "ops.cost-drift.fact.ratio": "Billed / estimated",
  "ops.replan.committed": "A deploy changed how weeks are chosen, and each paying site's week has been re-planned from its next unwritten day. The committed week and the new one are below, for information. A held site keeps its committed week, and so does a site with no week, which the next planner tries again.",
  "ops.replan.fact.planner": "Planner",
  "ops.replan.fact.from": "Re-planned from",
  "ops.replan.fact.unmeasured": "Not measured in the stored pass",
  "ops.replan.fact.held": "Held, the committed week stands",
  "ops.replan.fact.empty": "No week, its rows not ready by reason",
  "ops.replan.fact.committed": "Committed before",
  "ops.replan.fact.replanned": "Committed now",
  "ops.serp.unreadable": "Google results bought on the normal queue came back unreadable: most of the links were Google redirects, or a search that had results came back with none. Places read from them show as not measured until a clean read. This is the first today; later ones are only counted.",
  "ops.promise.week": "Each paying site's daily promise for the week of {week}: days kept, days the customer stopped, pages that met the content standard, and the research behind the coming week. A missed day shows its recorded cause. A site with fewer than {spares} researched spares or a day left uncovered is listed first.",
  "ops.promise.low": "Coming week below its margin",
  "ops.promise.held": "The other paying sites",
  "ops.promise.line": "{domain} · Days kept: {kept} · stopped by you: {stopped} · standard met: {met} · this week: {supply}",
  "ops.promise.of": "{n} of {total}",
  "ops.promise.of-unrecorded": "{n} of {total}, {unrecorded} not recorded",
  "ops.promise.supply": "{researched} of {rows} researched, spares {spares} of {sparesOf}, uncovered {uncovered}",
  "ops.promise.not-measured": "not measured",
  "ops.promise.missed": "Missed {date}: {reason}",
  "ops.promise.unresearched": "Committed days with research still queued: {queued} · short: {short}",
  "ops.uncrawled.week": "Google has still not crawled these live pages a week or more after they went live. ReachKit announces each to Google again, once. Each shows the site, the page, what Google says of it and the day it went live.",
  "ops.uncrawled.fact.page": "Page",
  "ops.uncrawled.fact.state": "Google says",
  "ops.uncrawled.fact.published": "Went live",
}) satisfies CopyPartition;
