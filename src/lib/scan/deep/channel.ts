// SPEC §5 (2026-09-20, #923) — the name of one site's setup channel.
//
// **One template, one home.** Three places need it: the pass's publish
// (`src/jobs/realtime.ts`), the token the route mints for a browser, and
// the screen that hands the name to its subscription. A name spelled in two
// of them is a subscription that silently watches a channel nothing
// publishes to — the failure would be a screen that simply never updates,
// which is the hardest kind to notice.
//
// **It imports nothing, deliberately.** No platform, no database, no copy.
// That is what lets both a rendered screen and the job layer read it
// without either dragging the other's dependencies behind it.
//
// The site id is the whole of the name, which is what makes a token minted
// for one founder unable to read another's pass.

/** One site's setup channel, by name. */
export function setupChannelName(siteId: string): string {
  return `setup:${siteId}`;
}
