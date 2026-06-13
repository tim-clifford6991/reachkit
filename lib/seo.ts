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

// ---------------------------------------------------------------------------
// FAQPage JSON-LD — §21.1 FAQ section
//
// Used by components/sections/faq.tsx to auto-emit structured data
// for Google's FAQ rich results, directly from the FAQ item props.
// ---------------------------------------------------------------------------

export interface FaqItem {
  q: string;
  a: string;
}

/**
 * FAQPage JSON-LD. Pass the same `items` array you render to the FAQ
 * section — this keeps structured data in sync with visible content.
 */
export function faqPageLd(items: readonly FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  } as const;
}
