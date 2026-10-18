// SPEC §7 (2026-10-18, issues 1511 and 1509) — which links of a page are
// profile pages: a business's or a person's own page on a network
// (`linkedin.com/company/…`, `linkedin.com/in/…`, `github.com/…`).
//
// A leaf the crawl and the main-site reading share, so both call one link a
// profile. Pure; no I/O.
import { parse } from "node-html-parser";

/** The hosts a profile lives on. A link to one of their own share or login
 *  pages is not a profile. */
const PROFILE_HOSTS: readonly string[] = [
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
];
const NOT_A_PROFILE_RE = /^\/(?:sharer|share|sharearticle|intent|dialog|login|signup|home|search|hashtag|watch)\b/i;
/** How many profiles one page contributes: a footer lists a handful. */
export const MAX_PROFILES = 10;

const hostKey = (host: string): string => host.trim().toLowerCase().replace(/^www\./, "").replace(/\.$/, "");

/** `raw` as an absolute http(s) address against `base`, or `null`. */
export function httpUrl(raw: unknown, base: string): string | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  try {
    const url = new URL(raw.trim(), base);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** A profile page's address, without its query or fragment, or `null`
 *  where `raw` is not one. */
export function profileUrl(raw: string, base: string): string | null {
  const address = httpUrl(raw, base);
  if (address === null) return null;
  const url = new URL(address);
  const host = hostKey(url.hostname);
  if (!PROFILE_HOSTS.some((known) => host === known || host.endsWith(`.${known}`))) return null;
  if (url.pathname.replace(/\/+$/, "") === "" || NOT_A_PROFILE_RE.test(url.pathname)) return null;
  url.hash = "";
  url.search = "";
  return url.toString();
}

/** The profile pages a document's anchors link to, once each, in order. */
export function profilesOn(html: string, base: string, also: readonly string[] = []): string[] {
  const anchors = parse(html, { comment: false })
    .querySelectorAll("a[href]")
    .map((anchor) => anchor.getAttribute("href") ?? "");
  const out: string[] = [];
  for (const raw of [...anchors, ...also]) {
    const url = profileUrl(raw, base);
    if (url !== null && !out.includes(url)) out.push(url);
  }
  return out.slice(0, MAX_PROFILES);
}
