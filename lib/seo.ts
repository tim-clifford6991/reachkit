import type { Metadata } from "next";

export const SITE = { url: "https://reachkit.app", name: "ReachKit" } as const;

export function buildMetadata(opts: { title: string; description?: string; path: string }): Metadata {
  const canonical = `${SITE.url}${opts.path}`;
  return {
    title: `${opts.title} — ${SITE.name}`,
    description: opts.description,
    alternates: { canonical },
    openGraph: { type: "website", title: `${opts.title} — ${SITE.name}`, url: canonical, siteName: SITE.name },
  };
}

export function softwareApplicationLd(o: { name: string; url: string; priceUsd: number }) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: o.name,
    applicationCategory: "BusinessApplication",
    url: o.url,
    offers: { "@type": "Offer", price: String(o.priceUsd), priceCurrency: "USD" },
  } as const;
}

/**
 * Article JSON-LD for the public shareable report page.
 *
 * Used by app/report/[slug]/page.tsx to make the report indexable and
 * social-sharable with structured data (headline, datePublished, url).
 */
export function articleLd(o: { headline: string; url: string; datePublished: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: o.headline,
    url: o.url,
    datePublished: o.datePublished,
    publisher: {
      "@type": "Organization",
      name: SITE.name,
      url: SITE.url,
    },
  } as const;
}
