/**
 * Shared URL fetching for the free /tools mini-checkers (W3).
 *
 * Every tool fetch goes through `fetchWithTimeout` (lib/scan/adapters), which
 * enforces the scan pipeline's SSRF guard (`assertPublicHttpUrl`) and hard 8s
 * timeout — the tools never grow their own unguarded fetch path. Responses are
 * size-capped so a hostile page can't balloon server memory.
 */

import { fetchWithTimeout } from "@/lib/scan/adapters/fetch-timeout";

/** Identifies tool traffic in target-site logs; mirrors the scan pipeline UA style. */
export const TOOL_FETCH_UA = "ReachKit tools checker (+https://reachkit.app/tools)";

/** Cap on fetched HTML — enough for any real <head> + body signal extraction. */
const MAX_HTML_BYTES = 400_000;

/** Cap on plain-text files (llms.txt / robots.txt). */
const MAX_TEXT_BYTES = 100_000;

/**
 * Normalize free-form user input ("acme.com", "https://acme.com/x") into a
 * fetchable absolute http(s) URL, or null when it can't be a public website.
 */
export function normalizeToolUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withScheme);
    // A public website hostname always contains a dot ("acme.com"); this also
    // rejects bare words that would otherwise fetch as https://word/.
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export interface FetchedPage {
  /** URL after redirects (fetch exposes it via res.url). */
  finalUrl: string;
  status: number;
  ok: boolean;
  html: string;
}

/**
 * Fetch a page's HTML for signal extraction. Returns null on any failure
 * (SSRF-blocked URL, DNS error, timeout, non-text body) — the tools render a
 * friendly "couldn't fetch" note instead of an error page.
 */
export async function fetchToolPage(url: string): Promise<FetchedPage | null> {
  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": TOOL_FETCH_UA,
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
      },
    });
    const html = (await res.text()).slice(0, MAX_HTML_BYTES);
    return { finalUrl: res.url || url, status: res.status, ok: res.ok, html };
  } catch {
    return null;
  }
}

export interface FetchedTextFile {
  exists: boolean;
  text: string;
}

/**
 * Fetch a well-known plain-text file (e.g. /llms.txt, /robots.txt) from a
 * site origin. Treats a 200 that returns HTML as "does not exist" — SPA hosts
 * commonly serve their index page for any path instead of a 404.
 */
export async function fetchSiteTextFile(origin: string, path: string): Promise<FetchedTextFile> {
  try {
    const res = await fetchWithTimeout(`${origin}${path}`, {
      headers: { "User-Agent": TOOL_FETCH_UA, Accept: "text/plain,*/*;q=0.5" },
    });
    if (!res.ok) return { exists: false, text: "" };
    const text = (await res.text()).slice(0, MAX_TEXT_BYTES);
    if (/^\s*</.test(text)) return { exists: false, text: "" };
    return { exists: true, text };
  } catch {
    return { exists: false, text: "" };
  }
}
