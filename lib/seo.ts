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

// ---------------------------------------------------------------------------
// Organization JSON-LD — §22.1 landing
// ---------------------------------------------------------------------------

/**
 * Organization JSON-LD. Emitted alongside SoftwareApplication on the homepage
 * to establish brand identity in the knowledge graph.
 */
export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE.name,
    url: SITE.url,
    description:
      "The discoverability engine for solo founders. Scan your App Store listing or website and get a scored, ranked action plan in 90 seconds.",
    sameAs: [] as string[],
  } as const;
}

// ---------------------------------------------------------------------------
// HowTo JSON-LD — §23 /scan entry point
// ---------------------------------------------------------------------------

export interface HowToStep {
  name: string;
  text: string;
}

/**
 * HowTo JSON-LD for the /scan page — maps to the 3-step scan flow.
 */
export function howToLd(opts: {
  name: string;
  description: string;
  steps: readonly HowToStep[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: opts.name,
    description: opts.description,
    step: opts.steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
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
