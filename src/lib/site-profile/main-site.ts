// SPEC §7 (2026-10-18, issue 1511) — what the scan read of the main site
// that ties the content host to it as one business.
//
// Seven facts, all off documents the scan already fetched, so 0¢:
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
//   · **the about and team pages** (issue 1509) — their visible text and the
//     profiles they link, so a page's author is given a `url` only where a
//     page of the main site names them;
//   · **its book and quote pages** — the first link in the home's own header
//     or nav that names one, on the business's own site, so a hosted page
//     links a page the business already offers and never one we guessed;
//   · **its phone number** — the `telephone` its own JSON-LD states, else
//     its home's first `tel:` link, as written there, so a hosted page shows
//     and marks up the number the business shows;
//   · **whether the main site links the content host** — counted only on the
//     crawled pages that are not ReachKit's (`known-content/ours.ts`). A link
//     whose every anchor carries `nofollow`, `sponsored` or `ugc` is "linked,
//     not followed". Only server HTML counts: the crawl reads no script.
//
// Pure: the scan hands it what it read, and `store.ts` keeps the answer.
import { parse } from "node-html-parser";
import { registrableDomain } from "@/lib/market/rivals/domains";
import { isOurPage, type OurPages } from "@/lib/known-content/ours";
import { pageHeadingPhrases, pagePathWords } from "@/lib/locale/language";
import { phoneOf, type MainSite, type MainSiteActionKind, type MainSiteLink } from "./main-site-row";
import { httpUrl, profilesOn } from "./profiles";
import { SITE_PROFILE } from "@/lib/config/constants";

export type { MainSite, MainSiteLink } from "./main-site-row";

/** One crawled page, as this module reads it. */
interface PageLinks {
  url: string;
  links: readonly string[];
  unfollowed?: readonly string[];
  about?: { text: string; profiles: readonly string[] };
}

/** Types a business's own entity is declared as. */
const ORGANIZATION_TYPE_RE = /(?:Organization|Corporation|Business|Store|Service)$/;

const hostKey = (host: string): string => host.trim().toLowerCase().replace(/^www\./, "").replace(/\.$/, "");

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

/** The profiles the home page links to, then the Organization's own. */
function profilesOf(html: string, home: string, node: Record<string, unknown> | null): string[] {
  const declared = node === null ? [] : Array.isArray(node.sameAs) ? node.sameAs : [node.sameAs];
  return profilesOn(html, home, declared.filter((value): value is string => typeof value === "string"));
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

/** Each kind's words, matched as a whole address segment or as whole words
 *  of the link's own text, in every supported language. */
const ACTION_WORDS: readonly { kind: MainSiteActionKind; paths: ReadonlySet<string>; phrases: readonly RegExp[] }[] = (
  [
    {
      kind: "book",
      paths: ["book", "booking", "bookings", "book-now", "book-online", "appointment", "appointments", "book-an-appointment"],
      phrases: ["book", "booking", "appointment", "appointments"],
    },
    {
      kind: "quote",
      paths: ["quote", "get-a-quote", "request-a-quote", "free-quote", "estimate", "free-estimate", "request-an-estimate"],
      phrases: ["quote", "estimate"],
    },
  ] as const
).map((rule) => ({
  kind: rule.kind,
  paths: new Set(pagePathWords(rule.kind, rule.paths)),
  phrases: pageHeadingPhrases(rule.kind, rule.phrases).map(
    (phrase) => new RegExp(`(?<![\\p{L}\\p{N}])${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "iu")
  ),
}));

/** The book and quote pages the home's header or nav links on `domain`'s
 *  own site: the first of each kind, and an address once. Without `utm_`
 *  parameters, because a link of ours tracks nothing. */
function actionsOf(html: string, home: string, domain: string): MainSite["actions"] {
  const site = registrableDomain(domain);
  const out: { kind: MainSiteActionKind; url: string }[] = [];
  for (const anchor of parse(html, { comment: false }).querySelectorAll("header a[href], nav a[href]")) {
    const address = httpUrl(anchor.getAttribute("href"), home);
    if (address === null) continue;
    const url = new URL(address);
    if (registrableDomain(url.hostname) !== site) continue;
    for (const key of [...url.searchParams.keys()]) if (/^utm_/i.test(key)) url.searchParams.delete(key);
    url.hash = "";
    const segments = url.pathname.toLowerCase().split("/");
    const text = anchor.text.replace(/\s+/g, " ").trim();
    const rule = ACTION_WORDS.find(
      (each) => segments.some((segment) => each.paths.has(segment)) || each.phrases.some((phrase) => phrase.test(text))
    );
    if (rule === undefined || out.some((taken) => taken.kind === rule.kind || taken.url === url.toString())) continue;
    out.push({ kind: rule.kind, url: url.toString() });
  }
  return ACTION_WORDS.flatMap((rule) => out.filter((action) => action.kind === rule.kind));
}

/** The number the home states: its own Organization's `telephone`, else
 *  any node's (a `Plumber` is no Organization type here), else the first
 *  `tel:` link's. */
function phoneOn(html: string, organization: Record<string, unknown> | null): string | null {
  const nodes = organization === null ? schemaNodes(html) : [organization, ...schemaNodes(html)];
  for (const node of nodes) {
    const phone = phoneOf(node.telephone);
    if (phone !== null) return phone;
  }
  const link = parse(html, { comment: false }).querySelector('a[href^="tel:"]')?.getAttribute("href") ?? "";
  try {
    return phoneOf(decodeURIComponent(link.slice("tel:".length)));
  } catch {
    return null;
  }
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
    // Issue 1509: the site's own about and team pages, never one of ours.
    aboutPages: a.pages
      .flatMap((page) =>
        page.about === undefined || (ours !== null && isOurPage(ours, page.url))
          ? []
          : [{ url: page.url, text: page.about.text, profiles: [...page.about.profiles] }]
      )
      .slice(0, SITE_PROFILE.ABOUT_PAGES),
    links: ours === null ? [] : [...ours.hosts].sort().map((host) => ({ host, state: linkOf(a.pages, ours, host) })),
    actions: html === "" ? [] : actionsOf(html, home, a.domain),
    phone: html === "" ? null : phoneOn(html, organization.node),
  };
}
