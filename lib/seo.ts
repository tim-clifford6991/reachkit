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
 *
 * E-E-A-T: includes a `founder` (Person) entity and `sameAs` profile links so
 * search + AI crawlers can attribute the product and its editorial (teardowns)
 * to a real, accountable author/organization.
 */
export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE.name,
    url: SITE.url,
    description:
      "The discoverability engine for solo founders. Scan your App Store listing or website and get a scored, ranked action plan in 90 seconds.",
    founder: {
      "@type": "Person",
      name: "Tim Clifford",
      url: SITE.url,
    },
    sameAs: ["https://x.com/reachkit"],
  } as const;
}

// ---------------------------------------------------------------------------
// Product + Offer JSON-LD — §22.2 /pricing
// ---------------------------------------------------------------------------

export interface OfferTier {
  /** Tier name, e.g. "Solo" */
  name: string;
  /** Price in USD (0 for the free tier) */
  priceUsd: number;
  /** One-line tier description */
  description: string;
}

/**
 * Product JSON-LD with one Offer per pricing tier — Solo $59 / Growth $129.
 *
 * Emitted on /pricing so search + AI crawlers can read the full price ladder
 * (not just a single price point). Each Offer carries its USD price + a stable
 * billing increment so the structured data mirrors the visible table.
 */
export function offerLd(o: { name: string; url: string; tiers: readonly OfferTier[] }) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: o.name,
    url: o.url,
    description:
      "Discoverability analytics for solo founders: a scored report and a weekly, verified action plan for your App Store listing or website.",
    brand: {
      "@type": "Brand",
      name: SITE.name,
    },
    offers: o.tiers.map((t) => ({
      "@type": "Offer" as const,
      name: t.name,
      description: t.description,
      price: String(t.priceUsd),
      priceCurrency: "USD",
      url: o.url,
      availability: "https://schema.org/InStock",
      ...(t.priceUsd > 0
        ? {
            priceSpecification: {
              "@type": "UnitPriceSpecification" as const,
              price: String(t.priceUsd),
              priceCurrency: "USD",
              billingIncrement: 1,
              unitText: "MONTH",
            },
          }
        : {}),
    })),
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
 *
 * Pass `author` for teardown pages to establish E-E-A-T (author + dateModified).
 */
export function articleLd(o: {
  headline: string;
  url: string;
  datePublished: string;
  dateModified?: string;
  author?: { name: string; url?: string };
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: o.headline,
    url: o.url,
    datePublished: o.datePublished,
    ...(o.dateModified !== undefined ? { dateModified: o.dateModified } : {}),
    ...(o.author !== undefined
      ? {
          author: {
            "@type": "Person" as const,
            name: o.author.name,
            ...(o.author.url !== undefined ? { url: o.author.url } : {}),
          },
        }
      : {}),
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
