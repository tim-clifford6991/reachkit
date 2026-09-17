// SPEC §5 — where a founder adds their CNAME, named from their domain's
// nameservers (issue 760; owner ruling 2026-09-16).
//
// A small closed table, not a parser: a nameserver whose name ends in a
// suffix below is that provider's, and nothing else is anybody's. **An
// unknown nameserver is named as itself**, never mapped to a plausible
// brand — the founder can recognise it or search for it, and a wrong brand
// would send them to a dashboard their domain is not on. A suffix one
// provider runs for several (NS1's `nsone.net` also serves Netlify DNS,
// is left out for the same reason. `googledomains.com` serves both
// Squarespace Domains (every domain moved from Google Domains) and Google
// Cloud DNS; since issue 856 it is named "Squarespace" and given
// Squarespace's steps, the owner's "Google/Squarespace" guide.
//
// Each provider carries the guide its steps are drawn from (issue 856): the
// six the owner named, and the generic guide for every other provider.
//
// Provider names are brands, carried as data into the registry's
// `{provider}` slot — never a sentence.
import { parse as pslParse } from "psl";

/** What the founder can be told about where their DNS is. */
export type DnsWhere =
  | { kind: "provider"; provider: string; guide: DnsGuideId }
  | { kind: "nameserver"; nameserver: string }
  | { kind: "unknown" };

/** The providers with steps of their own; `generic` is everyone else's. */
export type DnsGuideId = "cloudflare" | "godaddy" | "namecheap" | "squarespace" | "route53" | "vercel" | "generic";

/** Suffix → provider. A nameserver matches a suffix when it is that name
 *  or ends in `.` + it; Route 53's names carry a numbered label
 *  (`ns-1.awsdns-01.org`), so its row is a pattern. */
const PROVIDERS: readonly (readonly [RegExp, string, DnsGuideId])[] = [
  [/(^|\.)ns\.cloudflare\.com$/, "Cloudflare", "cloudflare"],
  [/(^|\.)domaincontrol\.com$/, "GoDaddy", "godaddy"],
  [/(^|\.)awsdns-\d+\.[a-z.]+$/, "Amazon Route 53", "route53"],
  [/(^|\.)registrar-servers\.com$/, "Namecheap", "namecheap"],
  [/(^|\.)googledomains\.com$/, "Squarespace", "squarespace"],
  [/(^|\.)vercel-dns\.com$/, "Vercel", "vercel"],
  [/(^|\.)digitalocean\.com$/, "DigitalOcean", "generic"],
  [/(^|\.)ovh\.net$/, "OVHcloud", "generic"],
  [/(^|\.)gandi\.net$/, "Gandi", "generic"],
  [/(^|\.)porkbun\.com$/, "Porkbun", "generic"],
  [/(^|\.)dnsimple\.com$/, "DNSimple", "generic"],
  [/(^|\.)hover\.com$/, "Hover", "generic"],
  [/(^|\.)ui-dns\.(com|de|org|biz)$/, "IONOS", "generic"],
  [/(^|\.)wixdns\.net$/, "Wix", "generic"],
];

function providerOf(nameserver: string): (typeof PROVIDERS)[number] | null {
  for (const row of PROVIDERS) if (row[0].test(nameserver)) return row;
  return null;
}

/** The zone a founder's records live in: the registrable domain of their
 *  site's address (`blog.acme.co.uk` → `acme.co.uk`), or `null` where the
 *  address has none. The address was held to a listed suffix when it was
 *  accepted (`parseDomain`); this only finds where its zone starts. */
export function dnsZoneOf(domain: string): string | null {
  const parsed = pslParse(domain.trim().toLowerCase().replace(/\.+$/, ""));
  return "error" in parsed ? null : parsed.domain;
}

/** Where the DNS is, from what the lookup answered. `null` — no answer —
 *  is `unknown`. Every nameserver must name the same provider for the
 *  provider to be named; a zone split across two is named by its first
 *  nameserver instead. */
export function dnsWhereFrom(nameservers: readonly string[] | null): DnsWhere {
  if (nameservers === null || nameservers.length === 0) return { kind: "unknown" };
  const providers = new Set(nameservers.map(providerOf));
  const [only] = providers;
  if (providers.size === 1 && only !== null && only !== undefined) {
    return { kind: "provider", provider: only[1], guide: only[2] };
  }
  return { kind: "nameserver", nameserver: nameservers[0]! };
}
