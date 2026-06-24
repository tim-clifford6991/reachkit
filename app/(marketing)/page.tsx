import type { Metadata } from "next";
import { buildMetadata, softwareApplicationLd, organizationLd, SITE } from "@/lib/seo";
import { LandingScreen } from "@/components/sections/captured/landing-screen";

export const metadata: Metadata = buildMetadata({
  title: "The distribution system for solo founders",
  description:
    "Paste your website or product link and get a free discoverability report — SEO gaps, positioning blind spots, and ranked action steps in under two minutes.",
  path: "/",
});

// The landing is now the Claude Design page imported 1:1 (server-rendered
// captured HTML + hydrated scan input / nav). Keeps the SEO JSON-LD.
export default function HomePage() {
  const appLd = softwareApplicationLd({ name: SITE.name, url: SITE.url, priceUsd: 0 });
  const orgLd = organizationLd();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(appLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }} />
      <LandingScreen />
    </>
  );
}
