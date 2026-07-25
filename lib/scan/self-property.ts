/**
 * Self-property guard (A3, 2026-07-25).
 *
 * A distribution / community action must NEVER tell the founder to "go engage" at
 * the subject's OWN property. The community sources (Hacker News hits) can surface
 * a story that is really ABOUT the subject and links straight back to it — e.g. an
 * HN post titled "Simple and privacy-friendly alternative to Google Analytics"
 * linking to `github.com/plausible/analytics` (plausible.io's own repo) became
 * "community #1" and the action said "share the waitlist in your own GitHub."
 *
 * Self is detected two ways:
 *   1. the URL host IS the subject's domain (or a subdomain of it), OR
 *   2. the host is a known PLATFORM (github/twitter/…) AND the first path segment
 *      is the subject's brand — i.e. the subject's own repo/profile/handle on that
 *      platform (`github.com/<brand>`, `twitter.com/<brand>`, …).
 *
 * PURE + deterministic — unit-tested.
 */

/** Platforms where the FIRST path segment `<host>/<owner>` is the account/repo
 *  owner, so `owner == brand` means "the subject's own page", not a third-party
 *  community. Kept to platforms with that exact shape — nested namespaces
 *  (producthunt `/products/x`, linkedin `/company/x`, crunchbase `/organization/x`)
 *  are deliberately excluded to avoid mis-detection; the host-match rule still
 *  catches the subject's own domain regardless. */
const PROFILE_PLATFORM_HOSTS = new Set([
  "github.com", "gitlab.com", "twitter.com", "x.com", "instagram.com", "facebook.com",
]);

function hostOf(raw: string): string {
  try {
    return new URL(raw.startsWith("http") ? raw : `https://${raw}`).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function firstPathSegment(raw: string): string {
  try {
    const p = new URL(raw.startsWith("http") ? raw : `https://${raw}`).pathname.toLowerCase();
    return p.split("/").filter(Boolean)[0] ?? "";
  } catch {
    return "";
  }
}

/** Brand tokens for the subject: the domain label + any captured names, lowercased,
 *  split into meaningful (≥3-char) alnum tokens. e.g. "plausible.io" + "Plausible
 *  Analytics" → {plausible, analytics}. */
export function selfBrandTokens(selfDomain: string, brandNames: string[] = []): Set<string> {
  const out = new Set<string>();
  const label = hostOf(selfDomain).split(".")[0] ?? "";
  for (const src of [label, ...brandNames]) {
    for (const tok of (src || "").toLowerCase().split(/[^a-z0-9]+/)) {
      if (tok.length >= 3) out.add(tok);
    }
  }
  return out;
}

/**
 * True when `url` points at the SUBJECT'S OWN property (its domain, or its
 * repo/profile on a known platform) and therefore must never be proposed as a
 * community/venue to go engage in.
 */
export function isSelfProperty(url: string, selfDomain: string, brandNames: string[] = []): boolean {
  const host = hostOf(url);
  if (!host) return false;
  const self = hostOf(selfDomain);
  if (self && (host === self || host.endsWith(`.${self}`))) return true;

  if (PROFILE_PLATFORM_HOSTS.has(host)) {
    const owner = firstPathSegment(url);
    if (owner && selfBrandTokens(selfDomain, brandNames).has(owner)) return true;
  }
  return false;
}
