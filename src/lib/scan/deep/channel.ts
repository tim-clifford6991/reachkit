// The name of one site's setup channel, in one place: the job's publish, the route's token and the screen's subscription would silently diverge if spelled twice.
// It imports nothing, so a screen and the job layer can both read it. The site id is the whole name, so one founder's token cannot read another's pass.

/** One site's setup channel, by name. */
export function setupChannelName(siteId: string): string {
  return `setup:${siteId}`;
}
