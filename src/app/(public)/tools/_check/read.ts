// Issue 1458 — what the two free tools read: one public page, named by its
// visitor, fetched once through `safeFetch` (the scan's own guarded reader:
// public addresses only, robots.txt respected, a size and time cap). No
// vendor is called and nothing is stored, so a check costs nothing.
import { parse, type HTMLElement } from "node-html-parser";
import { safeFetch } from "@/lib/egress";
import { parseOnPage } from "@/lib/measure/parse";
import { readPageFacts } from "@/lib/site-issues";
import { networkKeyOf, type NetworkKey } from "@/lib/scan/admission";
import { parseDomain } from "@/lib/scan/domain";

/** The tags a search engine and a share card read off one page. */
export interface PageTags {
  readonly url: string;
  readonly title: string;
  readonly description: string;
  readonly h1: readonly string[];
  readonly canonical: string;
  readonly noindex: boolean;
  readonly schemaTypes: readonly string[];
  /** `og:*` and `twitter:*` properties, by their lowercased name. */
  readonly share: Readonly<Record<string, string>>;
  readonly phoneViewport: boolean;
  readonly images: number;
  readonly imagesWithoutAlt: number;
  readonly lang: string;
}

export type PageRead =
  | { readonly ok: true; readonly tags: PageTags }
  | { readonly ok: false; readonly problem: "address" | "read" | "robots" | "limit"; readonly url?: string };

/** The address a visitor typed, as one https URL, or `null` where it names
 *  no public host. A bare `example.com/page` is read as `https://`. */
export function pageAddress(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username !== "" || url.password !== "" || url.port !== "") return null;
  if (!parseDomain(url.hostname).ok) return null;
  url.hash = "";
  return url.toString();
}

/** Free checks per network per hour. Held in this instance's memory: a
 *  check costs nothing, so the limit is a brake on one visitor driving the
 *  reader, not a budget. */
const CHECKS_PER_HOUR = 30;
const HOUR_MS = 60 * 60 * 1000;
const recent = new Map<NetworkKey, number[]>();

export function takeCheck(requestHeaders: Pick<Headers, "get">, nowMs: number = Date.now()): boolean {
  const key = networkKeyOf(requestHeaders);
  const kept = (recent.get(key) ?? []).filter((at) => nowMs - at < HOUR_MS);
  if (kept.length >= CHECKS_PER_HOUR) {
    recent.set(key, kept);
    return false;
  }
  kept.push(nowMs);
  recent.set(key, kept);
  return true;
}

function text(node: HTMLElement | null): string {
  return (node?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function attr(node: HTMLElement | null, name: string): string {
  return (node?.getAttribute(name) ?? "").replace(/\s+/g, " ").trim();
}

/** Every tag the two tools report on, read off the document as served. */
export function pageTags(url: string, html: string, headers: Readonly<Record<string, string>> = {}): PageTags {
  const root = parse(html);
  const onPage = parseOnPage({ url, html });
  const facts = readPageFacts(url, html);

  const share: Record<string, string> = {};
  for (const meta of root.querySelectorAll("meta")) {
    const name = (meta.getAttribute("property") ?? meta.getAttribute("name") ?? "").trim().toLowerCase();
    if ((name.startsWith("og:") || name.startsWith("twitter:")) && !(name in share)) {
      share[name] = attr(meta, "content");
    }
  }

  const images = root.querySelectorAll("img");
  const headerNoindex = /\bnoindex\b/i.test(headers["x-robots-tag"] ?? "");

  return {
    url,
    title: text(root.querySelector("title")),
    description: facts.metaDescription,
    h1: root.querySelectorAll("h1").map((h) => text(h)),
    canonical: attr(root.querySelector('link[rel="canonical"]'), "href"),
    noindex: facts.noindex || headerNoindex,
    schemaTypes: onPage.schemaTypes,
    share,
    phoneViewport: facts.phoneViewport,
    images: images.length,
    imagesWithoutAlt: images.filter((img) => img.getAttribute("alt") === undefined).length,
    lang: attr(root.querySelector("html"), "lang"),
  };
}

/** Read the page a visitor named. Never throws. */
export async function readPage(raw: string, requestHeaders: Pick<Headers, "get">): Promise<PageRead> {
  const url = pageAddress(raw);
  if (url === null) return { ok: false, problem: "address" };
  if (!takeCheck(requestHeaders)) return { ok: false, problem: "limit" };
  const outcome = await safeFetch(url, { timeoutMs: 8000, userAgent: "reachkit-measure" });
  if (!outcome.ok) {
    return { ok: false, problem: outcome.reason === "robots_disallowed" ? "robots" : "read", url };
  }
  if (outcome.html.trim() === "") return { ok: false, problem: "read", url };
  return { ok: true, tags: pageTags(outcome.url, outcome.html, outcome.headers) };
}
