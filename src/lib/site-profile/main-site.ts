// SPEC §7 (2026-10-18, issue 1511) — what the scan read of the main site
// that ties the content host to it as one business.
//
// Four facts, all off documents the scan already fetched, so 0¢:
//
//   · **the canonical home** — the home page as it was served, after its
//     redirects, at the address its own `<link rel="canonical">` names where
//     that is on the site. A `www.` home or a language path (`/de/`) is the
//     address the hosted pages link back to, never the bare domain that
//     redirects there;
//   · **the main site's own Organization** — the `@id`, `name` and `logo` its
//     JSON-LD declares, so the hosted pages reuse the `@id` and never state a
//     name or logo that contradicts it;
//   · **`sameAs`** — the profile pages the home page itself links to, and the
//     Organization's own `sameAs`. Never invented: a profile the site does not
//     link is not one of its profiles;
//   · **whether the main site links the content host** — counted only on the
//     crawled pages that are not ReachKit's (`known-content/ours.ts`). A link
//     whose every anchor carries `nofollow`, `sponsored` or `ugc` is "linked,
//     not followed". Only server HTML counts: the crawl reads no script.
//
// Pure: the scan hands it what it read, and `store.ts` keeps the answer.
import { parse } from "node-html-parser";
import { registrableDomain } from "@/lib/market/rivals/domains";
import { isOurPage, type OurPages } from "@/lib/known-content/ours";
import type { MainSite, MainSiteLink } from "./main-site-row";

export type { MainSite, MainSiteLink } from "./main-site-row";

/** One crawled page, as this module reads it. */
interface PageLinks {
  url: string;
  links: readonly string[];
  unfollowed?: readonly string[];
}

/** The hosts a profile of a business lives on. A link to one of their own
 *  share or login pages is not a profile. */
const PROFILE_HOSTS: ReadonlySet<string> = new Set([
  "linkedin.com",
  "x.com",
  "twitter.com",
  "facebook.com",
  "instagram.com",
  "youtube.com",
  "tiktok.com",
  "github.com",
  "pinterest.com",
  "threads.net",
  "bsky.app",
  "mastodon.social",
  "xing.com",
  "crunchbase.com",
  "wikipedia.org",
  "wikidata.org",
]);
const NOT_A_PROFILE_RE = /^\/(?:sharer|share|sharearticle|intent|dialog|login|signup|home|search|hashtag|watch)\b/i;
/** How many profiles are kept: a footer lists a handful. */
const MAX_PROFILES = 10;

/** Types a business's own entity is declared as. */
const ORGANIZATION_TYPE_RE = /(?:Organization|Corporation|Business|Store|Service)$/;

const hostKey = (host: string): string => host.trim().toLowerCase().replace(/^www\./, "").replace(/\.$/, "");

function httpUrl(raw: unknown, base: string): string | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  try {
    const url = new URL(raw.trim(), base);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** The document's own `<link rel="canonical">`, absolute, or `null`. */
function canonicalOf(html: string, url: string): string | null {
  for (const link of parse(html, { comment: false }).querySelectorAll("link[rel][href]")) {
    if (!(link.getAttribute("rel") ?? "").toLowerCase().split(/\s+/).includes("canonical")) continue;
    return httpUrl(link.getAttribute("href"), url);
  }
  return null;
}

/** The home as it was served, at the address its own canonical names where
 *  that is on the same site. No query and no fragment: a home is a place. */
export function canonicalHome(a: { domain: string; url: string; html: string | null }): string {
  const site = registrableDomain(a.domain);
  const declared = a.html === null || a.html === "" ? null : canonicalOf(a.html, a.url);
  const chosen = [declared, a.url, `https://${a.domain}/`].find((candidate): candidate is string => {
    if (candidate === null) return false;
    try {
      const url = new URL(candidate);
      return (url.protocol === "https:" || url.protocol === "http:") && registrableDomain(url.hostname) === site;
    } catch {
      return false;
    }
  });
  const home = new URL(chosen ?? `https://${a.domain}/`);
  home.search = "";
  home.hash = "";
  return home.toString();
}

/** Every JSON-LD node in a document, `@graph`s opened. */
function schemaNodes(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (typeof node !== "object" || node === null) return;
    const record = node as Record<string, unknown>;
    out.push(record);
    if (record["@graph"] !== undefined) walk(record["@graph"]);
  };
  for (const script of parse(html, { comment: false }).querySelectorAll('script[type="application/ld+json"]')) {
    try {
      walk(JSON.parse(script.rawText));
    } catch {
      // A schema that is not JSON says nothing.
    }
  }
  return out;
}

function isOrganization(node: Record<string, unknown>): boolean {
  const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
  return types.some((type) => typeof type === "string" && ORGANIZATION_TYPE_RE.test(type));
}

/** The main site's own Organization: the one whose `@id` says so where
 *  there are several, else the first. */
function organizationOf(html: string, home: string): { node: Record<string, unknown> | null; id: string | null; name: string | null; logo: string | null } {
  const organizations = schemaNodes(html).filter(isOrganization);
  const node =
    organizations.find((candidate) => typeof candidate["@id"] === "string" && /#organi[sz]ation$/i.test(candidate["@id"])) ??
    organizations[0] ??
    null;
  if (node === null) return { node: null, id: null, name: null, logo: null };
  const name = typeof node.name === "string" && node.name.trim() !== "" ? node.name.replace(/\s+/g, " ").trim() : null;
  const logoValue = node.logo;
  const logo =
    typeof logoValue === "object" && logoValue !== null && !Array.isArray(logoValue)
      ? httpUrl((logoValue as Record<string, unknown>).url ?? (logoValue as Record<string, unknown>).contentUrl, home)
      : httpUrl(logoValue, home);
  return { node, id: httpUrl(node["@id"], home), name, logo };
}

/** A profile page's address, or `null` where `raw` is not one. */
function profileUrl(raw: string, home: string): string | null {
  const address = httpUrl(raw, home);
  if (address === null) return null;
  const url = new URL(address);
  const host = hostKey(url.hostname);
  const platform = [...PROFILE_HOSTS].find((known) => host === known || host.endsWith(`.${known}`));
  if (platform === undefined) return null;
  if (url.pathname.replace(/\/+$/, "") === "" || NOT_A_PROFILE_RE.test(url.pathname)) return null;
  url.hash = "";
  url.search = "";
  return url.toString();
}

/** The profiles the home page links to, then the Organization's own. */
function profilesOf(html: string, home: string, node: Record<string, unknown> | null): string[] {
  const declared = node === null ? [] : Array.isArray(node.sameAs) ? node.sameAs : [node.sameAs];
  const anchors = parse(html, { comment: false })
    .querySelectorAll("a[href]")
    .map((anchor) => anchor.getAttribute("href") ?? "");
  const out: string[] = [];
  for (const raw of [...anchors, ...declared.filter((value): value is string => typeof value === "string")]) {
    const url = profileUrl(raw, home);
    if (url !== null && !out.includes(url)) out.push(url);
  }
  return out.slice(0, MAX_PROFILES);
}

function hostOfKey(key: string): string | null {
  try {
    return hostKey(new URL(key).hostname);
  } catch {
    return null;
  }
}

/** Whether the main site's own pages link `host`: followed where any of
 *  their anchors to it is, not followed where every one asks not to be. */
export function linkOf(pages: readonly PageLinks[], ours: OurPages, host: string): MainSiteLink {
  let linked = false;
  for (const page of pages) {
    if (isOurPage(ours, page.url)) continue;
    const unfollowed = new Set(page.unfollowed ?? []);
    for (const key of page.links) {
      if (hostOfKey(key) !== host) continue;
      if (!unfollowed.has(key)) return "linked";
      linked = true;
    }
  }
  return linked ? "not_followed" : "not_linked";
}

/** What the scan read of the main site. `ours` is `null` where which pages
 *  are ReachKit's could not be read: then no link is reported at all. */
export function readMainSite(a: {
  domain: string;
  /** The home's address as the crawl read it, after its redirects. */
  homeUrl: string;
  homeHtml: string | null;
  pages: readonly PageLinks[];
  ours: OurPages | null;
}): MainSite {
  const home = canonicalHome({ domain: a.domain, url: a.homeUrl, html: a.homeHtml });
  const html = a.homeHtml ?? "";
  const organization = html === "" ? { node: null, id: null, name: null, logo: null } : organizationOf(html, home);
  const ours = a.ours;
  return {
    home,
    organization: { id: organization.id, name: organization.name, logo: organization.logo },
    sameAs: html === "" ? [] : profilesOf(html, home, organization.node),
    links: ours === null ? [] : [...ours.hosts].sort().map((host) => ({ host, state: linkOf(a.pages, ours, host) })),
  };
}
