/**
 * sitemap.xml — §22.2 GEO / discoverability
 *
 * Served at /sitemap.xml (Next 16 MetadataRoute). Lists the MVP public routes
 * only — no auth product (`/app/*`), no API, and no per-scan public reports
 * (`/report/[slug]` are unbounded UUID artifacts, not a fixed indexable set).
 *
 * Teardown entries are generated from the content registry so the sitemap stays
 * in sync as teardowns are added; their `lastModified` uses `lastVerified`.
 */

import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";
import { allTeardowns } from "@/content/teardowns";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const core: MetadataRoute.Sitemap = [
    {
      url: `${SITE.url}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE.url}/scan`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${SITE.url}/pricing`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE.url}/teardowns`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
  ];

  const teardowns: MetadataRoute.Sitemap = allTeardowns.map((t) => ({
    url: `${SITE.url}/teardowns/${t.slug}`,
    lastModified: new Date(t.lastVerified),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const legal: MetadataRoute.Sitemap = [
    {
      url: `${SITE.url}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE.url}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE.url}/imprint`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  return [...core, ...teardowns, ...legal];
}
