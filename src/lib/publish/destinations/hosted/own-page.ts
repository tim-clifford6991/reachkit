// SPEC §7 — which existing page a hosted destination can update: only one of its own live publications, as a new
// version at the same address. The customer's own site, or a host address serving nothing, is outside it.
// A leaf with no imports so readiness and the adapter read one predicate, and no day is offered an update the adapter refuses.

/** The host a site's hosted pages are served at, and the slugs live there. */
export interface HostedOwnPages {
  host: string;
  slugs: readonly string[];
}

/** Whether `url` is one of the site's own live hosted publications:
 *  `https://{host}/{slug}` with a live slug, a trailing slash allowed. */
export function addressesOwnPage(url: string, own: HostedOwnPages): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (own.host === "" || parsed.host.toLowerCase() !== own.host.toLowerCase()) return false;
  const segments = parsed.pathname.split("/").filter((segment) => segment !== "");
  if (segments.length !== 1) return false;
  return own.slugs.includes(segments[0] ?? "");
}
