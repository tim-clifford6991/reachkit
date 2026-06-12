import { parse } from "node-html-parser";
import type { ListingFacts } from "@/lib/scan/types";

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
  const res = await fetch(url, { headers: { "user-agent": "ReachKitBot/1.0 (+https://reachkit.app)" } });
  if (!res.ok) throw new Error(`site fetch ${url} failed: ${res.status}`);
  const html = await res.text();
  return { listing: parseListingHtml(html, url), raw: html.slice(0, 200_000) };
}
