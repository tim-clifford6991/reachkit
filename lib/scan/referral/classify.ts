import type { ChannelType } from "./types";

export function normalizeHost(url: string): string {
  try {
    const h = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
    return h.replace(/^www\./, "").toLowerCase();
  } catch {
    return (
      url
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .split("/")[0] ?? ""
    ).toLowerCase();
  }
}

/** Hosts so common their backlink is meaningless as a "discovered channel". */
const UBIQUITOUS = new Set([
  "google.com",
  "bing.com",
  "duckduckgo.com",
  "twitter.com",
  "x.com",
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "youtube.com",
  "t.co",
  "pinterest.com",
  "wikipedia.org",
  "gravatar.com",
  "gstatic.com",
  "googleusercontent.com",
  "amazonaws.com",
  "cloudfront.net",
  "bit.ly",
  "t.ly",
  "tinyurl.com",
  "lnkd.in",
  "buff.ly",
  "ow.ly",
  "rebrand.ly",
  "goo.gl",
  "wordpress.com",
  "wp.com",
  "blogspot.com",
  "medium.com",
  "github.com",
  "github.io",
]);

export function isUbiquitousHost(host: string): boolean {
  if (UBIQUITOUS.has(host)) return true;
  // Subdomains of ubiquitous hosts (e.g. m.facebook.com, lite.duckduckgo.com).
  for (const u of UBIQUITOUS) {
    if (host.endsWith(`.${u}`)) return true;
  }
  return false;
}

/**
 * Customer-embed TLDs: schools and governments paste "book a meeting" links into
 * their own pages. The link exists, but they're USERS of the competitor, not a
 * marketing channel anyone can get onto. Drop them. Covers .edu/.gov and the
 * ccTLD equivalents (.edu.au, .ac.uk, .gov.gh, …).
 */
export function isCustomerEmbedTld(host: string): boolean {
  return /\.(edu|gov)$/.test(host) || /\.(edu|gov|ac)\.[a-z]{2,3}$/.test(host);
}

/**
 * Generic mega-authority sites that link out to virtually everything — their
 * backlink is not a selective endorsement and not a channel you can "join".
 * This list is heuristic and expected to grow with live data.
 */
const GENERIC_AUTHORITY = new Set([
  "amazon.com",
  "craigslist.org",
  "intuit.com",
  "squarespace.com",
  "shopify.com",
  "outlook.com",
  "prnewswire.com",
  "zendesk.com",
  "hubspot.com",
  "justia.com",
  "webflow.com",
  "atlassian.net",
  "constantcontact.com",
]);

/**
 * Generic-brand labels matched at the domain-label level so ccTLD/variant hosts
 * (glassdoor.ca, forbes.co.uk) are caught too. These are mega-media, company-data
 * aggregators, and SaaS-listicle/marketing-blog mills — high authority, link to
 * everyone, never a deliberate "channel" a founder can join. Heuristic, grows with data.
 */
const GENERIC_BRANDS = new Set([
  // tech / business media
  "businessinsider", "zdnet", "entrepreneur", "fortune", "techcrunch", "forbes",
  "inc", "fastcompany", "venturebeat", "siliconangle", "dataconomy", "wired",
  "mashable", "thenextweb", "readwrite",
  // company-data / firmographic aggregators / VC-data / encyclopedic
  "zoominfo", "crunchbase", "golden", "seedtable", "growjo", "datanyze", "craft",
  "theorg", "glassdoor", "builtin", "builtinsf", "appsruntheworld", "leadiq", "wiza",
  "pitchbook", "cbinsights", "dealroom", "ainvest", "grokipedia", "parsers", "tracxn",
  // generic SEO/marketing blogs & SaaS-listicle mills
  "neilpatel", "starterstory", "gitnux", "zipdo", "fitgap", "wifitalents", "thecmo",
  "impactplus", "salesforceben", "marketingprofs", "emailanalytics", "siteprice",
  "datainsightsmarket", "openviewpartners", "cxl", "gtmnow",
]);

export function isGenericAuthority(host: string): boolean {
  if (GENERIC_AUTHORITY.has(host)) return true;
  const labels = host.split(".");
  return labels.some((l) => GENERIC_BRANDS.has(l));
}

/**
 * SEO link-farm / scraper junk that backlinks to everything: the "X-links-bhs.xyz"
 * cluster, "what's this site worth" calculators, "similar sites" scrapers, generic
 * URL shorteners. They carry ~0 real traffic and are never a channel.
 */
const SPAM_PATTERNS: RegExp[] = [
  /(^|\.)[a-z]-links-[a-z0-9]+\./, // q-links-bhs.xyz, a-links-bhs.xyz, …
  /(website-?worth|getwebsiteworth|website-?value|whats?mysiteworth|site-?price|sitelike|site-?worth|webworth)/,
  /(shorten-?urls?|url-?shorten|tinyurl|short-?link)/,
  /(similarsites|similarweb-?like|sitescheck|whatarethebest|listofai|aitools?-?list)/,
];

export function isSpamHost(host: string): boolean {
  return SPAM_PATTERNS.some((re) => re.test(host));
}

/**
 * The full noise gate for a referring host. `exclude` carries the subject + its
 * competitor domains — a competitor linking to its rivals (comparison pages) is
 * not an opportunity, and the subject's own domain is never a referrer.
 */
export function isNoiseHost(host: string, exclude: Set<string> = new Set()): boolean {
  return (
    isUbiquitousHost(host) ||
    isCustomerEmbedTld(host) ||
    isGenericAuthority(host) ||
    isSpamHost(host) ||
    exclude.has(host)
  );
}

const MARKETPLACE_HOSTS = new Set([
  "g2.com",
  "capterra.com",
  "getapp.com",
  "softwareadvice.com",
  "producthunt.com",
  "appsumo.com",
  "alternativeto.net",
  "betalist.com",
  "saashub.com",
  "trustpilot.com",
]);
const COMMUNITY_HOSTS = new Set([
  "reddit.com",
  "news.ycombinator.com",
  "ycombinator.com",
  "quora.com",
  "stackoverflow.com",
  "stackexchange.com",
  "indiehackers.com",
  "dev.to",
  "lobste.rs",
  "discord.com",
  "slack.com",
]);
const PODCAST_HOSTS = new Set([
  "podcasts.apple.com",
  "spotify.com",
  "podbean.com",
  "buzzsprout.com",
  "transistor.fm",
]);

export function classifyReferrer(host: string, url: string): ChannelType {
  const u = url.toLowerCase();
  if (MARKETPLACE_HOSTS.has(host)) return "marketplace";
  if (COMMUNITY_HOSTS.has(host)) return "community";
  if (PODCAST_HOSTS.has(host)) return "podcast";
  if (/\.(beehiiv|substack)\.com$/.test(host) || /\/(newsletter|issues?)\//.test(u)) return "newsletter";
  if (/\/integrations?\//.test(u) || /\/partners?\//.test(u) || /works-with/.test(u)) return "partner";
  if (/\b(best|top)-[\w-]*\b/.test(u) && /\b(tools?|apps?|software|alternatives?)\b/.test(u)) return "listicle";
  if (/\b(review|comparison|vs)\b/.test(u)) return "review";
  if (/\/(docs?|wiki|resources?|awesome)\b/.test(u)) return "resource";
  if (/directory|listing/.test(u)) return "directory";
  return "other";
}
