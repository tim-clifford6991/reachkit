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
  "ops.visits.week": "Visits to each paying hosted site's pages for the week of {week}, counted on the pages ReachKit serves, and the clicks Search Console reports for its live pages. Robots reading a page are not visits. Anything else counted on those pages is listed under the site by its source.",
  "ops.visits.line": "{domain} · Google search visits: {google} · visits from AI apps: {ai} · Search Console clicks, last {days} days: {clicks}",
  "ops.visits.source": "Also counted, {source}: {n}",
  "ops.changes.week": "What changed in each site's market, as its weekly pass of {week} recorded it: stories at least two independent publishers reported in the last 30 days, and how many of them that week's pages used.",
  "ops.changes.line": "{domain} · Market changes recorded: {recorded} · used on pages: {used}",
  "ops.uncrawled.week": "Google has still not crawled these live pages a week or more after they went live. ReachKit announces each to Google again, once. Each shows the site, the page, what Google says of it and the day it went live.",
  "ops.uncrawled.fact.page": "Page",
  "ops.uncrawled.fact.state": "Google says",
  "ops.uncrawled.fact.published": "Went live",
  "ops.digest.subject": "ReachKit daily digest",
  "ops.digest.heading": "Since Yesterday’s Digest",
  "ops.digest.lead": "Nothing below needed you at once. Each line is one kind of event, how many times it happened, and the sites or codes it named, oldest first.",
  "ops.digest.line": "{occasion} × {n}",
}) satisfies CopyPartition;
