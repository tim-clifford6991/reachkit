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
