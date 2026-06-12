import type { Metadata } from "next";
import { buildMetadata, softwareApplicationLd, SITE } from "@/lib/seo";
import { ScanInput } from "./scan-input";

export const metadata: Metadata = buildMetadata({
  title: "The distribution system for solo founders",
  description:
    "Paste your App Store URL or website and get a free discoverability report — SEO gaps, positioning blind spots, and ranked action steps in under two minutes.",
  path: "/",
});

export default function HomePage() {
  const ld = softwareApplicationLd({
    name: SITE.name,
    url: SITE.url,
    priceUsd: 0,
  });

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-bg px-4 py-16">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
      />

      <div className="w-full max-w-xl space-y-8">
        {/* Hero */}
        <div className="space-y-4 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-fg sm:text-5xl">
            The distribution system
            <br />
            for solo founders
          </h1>
          <p className="text-base text-muted sm:text-lg">
            Find out exactly why your product isn&apos;t getting found — and
            what to fix first.
          </p>
        </div>

        {/* Scan input */}
        <ScanInput />

        <p className="text-center text-xs text-muted/60">
          Free scan · no account needed · results in ~90 seconds
        </p>
      </div>
    </main>
  );
}
