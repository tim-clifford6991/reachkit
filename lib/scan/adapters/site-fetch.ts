import { parse, type HTMLElement } from "node-html-parser";
import type { ListingFacts } from "@/lib/scan/types";
import { fetchWithTimeout } from "@/lib/scan/adapters/fetch-timeout";

/** The domain's brand label — reachkit.app → "reachkit". */
function domainLabel(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, "").split(".")[0]?.toLowerCase() ?? ""; }
  catch { return ""; }
}

/** Collapse a string to its bare alphanumerics (for matching a domain label). */
const bare = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Reduce a page `<title>` ("Tagline — Brand", "Brand | Tagline") to the BRAND.
 *  Prefer the segment matching the domain label; else the shortest real segment. */
function cleanBrandFromTitle(title: string, label: string): string {
  const segs = title.split(/\s*[—–|·:]\s*|\s+[-]\s+/).map((s) => s.trim()).filter((s) => s.length >= 2);
  if (segs.length <= 1) return title.trim();
  if (label) {
    const match = segs.find((s) => bare(s).includes(label) || label.includes(bare(s)));
    if (match) return match;
  }
  return segs.reduce((a, b) => (b.length < a.length ? b : a));
}

/**
 * Resolve a product's BRAND name (e.g. "ReachKit"), NOT the full page title
 * ("The distribution system for solo founders — ReachKit"). Chain: og:site_name →
 * the domain-matching / shortest title segment → og:title → host. Every consumer of
 * `listing.name` (the app switcher label, brand-ambiguity filtering, community
 * mention counting, search queries) wants the brand token, not the tagline, so this
 * is fixed at extraction (2026-07-27).
 */
export function resolveBrandName(root: HTMLElement, url: string, title: string): string {
  const label = domainLabel(url);
  const og = root.querySelector('meta[property="og:site_name"]')?.getAttribute("content")?.trim();
  // og:site_name is usually the clean brand — trust it unless it's itself a long title.
  if (og && og.length >= 2 && og.length <= 40) return og;
  if (title) {
    const cleaned = cleanBrandFromTitle(title, label);
    if (cleaned && cleaned.length <= 60) return cleaned;
  }
  const ogTitle = root.querySelector('meta[property="og:title"]')?.getAttribute("content")?.trim();
  if (ogTitle) return cleanBrandFromTitle(ogTitle, label);
  return title || label || url;
}

export function parseListingHtml(html: string, url: string): ListingFacts {
  const root = parse(html);
  let hostFallback = url;
  try { hostFallback = new URL(url).hostname; } catch { /* keep raw url */ }
  const title = root.querySelector("title")?.text?.trim() || hostFallback;
  const name = resolveBrandName(root, url, title);
  const desc = root.querySelector('meta[name="description"]')?.getAttribute("content")
            ?? root.querySelector('meta[property="og:description"]')?.getAttribute("content") ?? null;
  const h1 = root.querySelector("h1")?.text?.trim() ?? null;
  return { name, category: null, description: desc ?? h1 };
}

export async function fetchSiteListing(url: string): Promise<{ listing: ListingFacts; raw: string }> {
  const res = await fetchWithTimeout(url, {
    headers: {
      "user-agent": "ReachKitBot/1.0 (+https://reachkit.app)",
      // Force English so geo-IP'd sites (e.g. stripe.com served German) return en.
      "accept-language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`site fetch ${url} failed: ${res.status}`);
  const html = await res.text();
  // Capture up to 2MB (was 200KB). The signal parser (persist-signals →
  // extractHtmlSignals) re-parses this stored copy, and modern SPAs (Next.js/RSC)
  // stream a large inline payload BEFORE their SEO metadata — live linear.app puts
  // <title>/<meta>/<canonical> at ~865KB, so a 200KB slice truncated them away and
  // the whole SEO pillar scored 0 (false "Invisible"). Postgres TOAST compresses
  // this text heavily, so the real storage cost is small. Sites <2MB keep the full doc.
  return { listing: parseListingHtml(html, url), raw: html.slice(0, 2_000_000) };
}
