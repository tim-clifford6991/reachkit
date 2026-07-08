import { parse } from "node-html-parser";
import type { ListingFacts } from "@/lib/scan/types";
import { fetchWithTimeout } from "@/lib/scan/adapters/fetch-timeout";

export function parseListingHtml(html: string, url: string): ListingFacts {
  const root = parse(html);
  let hostFallback = url;
  try { hostFallback = new URL(url).hostname; } catch { /* keep raw url */ }
  const title = root.querySelector("title")?.text?.trim() || hostFallback;
  const desc = root.querySelector('meta[name="description"]')?.getAttribute("content")
            ?? root.querySelector('meta[property="og:description"]')?.getAttribute("content") ?? null;
  const h1 = root.querySelector("h1")?.text?.trim() ?? null;
  return { name: title, category: null, description: desc ?? h1 };
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
