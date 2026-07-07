/**
 * sitemap.xml — §22.2 GEO / discoverability
 *
 * Served at /sitemap.xml (Next 16 MetadataRoute). Lists the public routes —
 * no auth product (`/app/*`), no API. Per-scan public reports ARE included
 * now that they live at domain slugs (/scan/nudgi.ai): every free scan we
 * run is a public teardown and an indexable SEO surface.
 *
 * Teardown entries are generated from the content registry so the sitemap stays
 * in sync as teardowns are added; their `lastModified` uses `lastVerified`.
 */

import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";
import { allTeardowns } from "@/content/teardowns";
import { COMPARE_SLUGS } from "@/app/(marketing)/compare/compare-content";
import { listPublicScans } from "@/lib/scan/public-scans";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const core: MetadataRoute.Sitemap = [
    { url: `${SITE.url}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE.url}/scan`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE.url}/how-it-works`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE.url}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE.url}/teardowns`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE.url}/tools`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE.url}/about`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${SITE.url}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE.url}/affiliates`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];

  const tools: MetadataRoute.Sitemap = ["on-page-check", "ai-visibility-check", "meta-preview"].map(
    (slug) => ({
      url: `${SITE.url}/tools/${slug}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    }),
  );

  const compare: MetadataRoute.Sitemap = [
    { url: `${SITE.url}/compare`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.7 },
    ...COMPARE_SLUGS.map((slug) => ({
      url: `${SITE.url}/compare/${slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];

  const teardowns: MetadataRoute.Sitemap = allTeardowns.map((t) => ({
    url: `${SITE.url}/teardowns/${t.slug}`,
    lastModified: new Date(t.lastVerified),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  // Note: /imprint is intentionally excluded — it's noindex until the full
  // registered entity details are finalised.
  const legal: MetadataRoute.Sitemap = [
    { url: `${SITE.url}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE.url}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  // Every completed free scan is a public report at its domain slug — spent
  // scan cost turned into indexable surface. Bounded (latest 500, one per app).
  const reports: MetadataRoute.Sitemap = (await listPublicScans(500)).map((scan) => ({
    url: `${SITE.url}/scan/${scan.slug}`,
    lastModified: scan.completedAt ? new Date(scan.completedAt) : now,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  return [...core, ...tools, ...compare, ...teardowns, ...reports, ...legal];
}
