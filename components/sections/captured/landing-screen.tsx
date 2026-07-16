/**
 * LandingScreen — the Claude Design landing page. The hero is the SHARED
 * <ScanHero/> (same component as /scan) and the closing band is the SHARED
 * <LandingFinalCta/> (a real ScanInput — the bottom CTA works in place);
 * between them sits the captured HTML (server-rendered for SEO/LCP,
 * interactivity hydrated by LandingHydrate).
 */
import { Suspense } from "react";
import { connection } from "next/server";
import { LANDING_HTML } from "./landing-html";
import { LandingHydrate } from "./landing-hydrate";
import { LandingFinalCta } from "./landing-final-cta";
import { ScanHero } from "@/components/sections/scan-hero";
import { CompanyTicker } from "@/components/sections/company-ticker";
import { listScannedCompanies } from "@/lib/marketing/scanned-companies";

async function CompanyTickerSection() {
  // Defer to request time (uncached DB read → needs runtime env, must reflect
  // current scans). Without this the landing prerenders at build and crashes on
  // the missing SUPABASE_* env. The hero/page shell stays static.
  await connection();
  const companies = await listScannedCompanies();
  return <CompanyTicker companies={companies} />;
}

export function LandingScreen() {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap"
      />
      {/* The companies-analyzed ticker rides inside the hero (below the input,
          above the "See how it works" cue). Uncached DB read → <Suspense> per
          the Cache-Components blocking-route rule. */}
      <ScanHero
        showScrollCue
        trustStrip={
          <Suspense fallback={null}>
            <CompanyTickerSection />
          </Suspense>
        }
      />
      <div id="rk-landing" dangerouslySetInnerHTML={{ __html: LANDING_HTML }} />
      {/* Closing CTA band — a REAL scan input (shared ScanInput), so the bottom
          "Analyze my site" works in place instead of being a dead captured
          button (autoFocus stays false; only the hero grabs focus). */}
      <LandingFinalCta />
      <LandingHydrate />
    </>
  );
}
