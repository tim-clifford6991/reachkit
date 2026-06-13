/**
 * robots.txt — §22.2 GEO / AI-crawler discoverability
 *
 * Served at /robots.txt (Next 16 MetadataRoute).
 *
 * Policy:
 *  - General crawlers: crawl the public marketing + content surface, but never
 *    the authenticated product (`/app/`) or the API (`/api/`).
 *  - AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended): EXPLICITLY
 *    allowed to crawl the public site. Vercel does not block these by default,
 *    but making the allow explicit is the GEO-correct signal — we WANT answer
 *    engines to read the teardowns, pricing, and report format.
 *  - `/app/` and `/api/` are disallowed for everyone (incl. AI bots): the
 *    product shell is auth-gated and the API has no crawlable content.
 */

import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";

/** Paths no crawler should index — auth product shell + API. */
const DISALLOW = ["/app/", "/api/"] as const;

/** AI crawlers we explicitly welcome onto the public site (§22.2). */
const AI_CRAWLERS = [
  "GPTBot",
  "ClaudeBot",
  "PerplexityBot",
  "Google-Extended",
] as const;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // General crawlers: public site allowed, product + API disallowed.
      {
        userAgent: "*",
        allow: "/",
        disallow: [...DISALLOW],
      },
      // AI crawlers: explicit allow of the public site (still no /app or /api).
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: [...DISALLOW],
      })),
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
