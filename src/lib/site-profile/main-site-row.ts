// SPEC §7 (2026-10-18, issue 1511) — `site_profiles.main_site`, the shape
// the scan stores (`./main-site.ts`) and the hosted pages read.
//
// A leaf with no imports: the hosted store reads it, and that store is
// reached from the middleware's bundle.

/** Whether the main site's own pages link the content host. */
export type MainSiteLink = "linked" | "not_followed" | "not_linked";

export interface MainSite {
  /** The main site's canonical home. */
  home: string;
  /** What the main site's own Organization markup declares, each `null`
   *  where it declares none. */
  organization: { id: string | null; name: string | null; logo: string | null };
  /** The profile pages the main site itself links to. */
  sameAs: readonly string[];
  /** Per content host ReachKit serves for this domain (without `www.`):
   *  whether the main site's own pages link it. Empty where the domain has
   *  none, or where which pages are ours could not be read. */
  links: readonly { host: string; state: MainSiteLink }[];
}

/** What Overview says about the main-site link (SPEC §7, 2026-10-18):
 *  drawn only while the main site does not link the content host, or links
 *  it without letting search engines follow
 *  (`publish/destinations/hosted/main-link.ts`). */
export interface MainSiteLinkFinding {
  state: "not_linked" | "not_followed";
  /** The content host the link points at. */
  host: string;
  /** The anchor to copy into the main site. */
  snippet: string;
}

function isHttp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** A stored `main_site` value, read back as what of it still parses. */
export function mainSiteOf(value: unknown): MainSite | null {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;
  if (!isHttp(row.home)) return null;
  const organization = (typeof row.organization === "object" && row.organization !== null ? row.organization : {}) as Record<string, unknown>;
  const text = (entry: unknown): string | null => (typeof entry === "string" && entry.trim() !== "" ? entry : null);
  const states: readonly MainSiteLink[] = ["linked", "not_followed", "not_linked"];
  return {
    home: row.home,
    organization: { id: text(organization.id), name: text(organization.name), logo: text(organization.logo) },
    sameAs: Array.isArray(row.sameAs) ? row.sameAs.filter((entry): entry is string => isHttp(entry)) : [],
    links: Array.isArray(row.links)
      ? row.links.flatMap((entry) => {
          const link = entry as Record<string, unknown> | null;
          return typeof link?.host === "string" && states.includes(link.state as MainSiteLink)
            ? [{ host: link.host, state: link.state as MainSiteLink }]
            : [];
        })
      : [],
  };
}
