// SPEC §7 (issue 781) — which existing page a hosted destination can update.
//
// A hosted host answers only with the pages ReachKit published there, so the
// one page it can change is one of its own live publications: a new version
// at the same address. A page anywhere else — the customer's own site, or an
// address on the host that serves nothing — is outside this destination.
//
// A leaf with no imports: readiness (which never touches the edge) and the
// adapter (which delivers) read the same predicate, so a day is never
// offered an update the adapter would refuse.

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
