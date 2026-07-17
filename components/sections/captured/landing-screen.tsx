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
      {/* Mobile responsiveness for the captured landing HTML. The HTML uses
          inline styles (which beat any stylesheet rule), so the two grids that
          can't be collapsed with a pure intrinsic auto-fit — the asymmetric
          "score travels" band (1fr auto) and the 4-col comparison table — carry
          class hooks and are overridden here at mobile widths. `!important` is
          required and correct: it is the only way a stylesheet can win over the
          captured inline `grid-template-columns`, and it is scoped to a mobile
          media query so desktop is untouched. The other landing grids collapse
          via inline auto-fit and need no rule here. */}
      <style>{`
        #rk-landing .rk-travel { grid-template-columns: 1fr auto; }
        @media (max-width: 767px) {
          #rk-landing .rk-travel { grid-template-columns: 1fr !important; justify-items: start; }
        }
        @media (max-width: 640px) {
          #rk-landing .rk-cmp-row { grid-template-columns: repeat(3, 1fr) !important; }
          #rk-landing .rk-cmp-feat { grid-column: 1 / -1; text-align: left !important; padding-bottom: 2px !important; }
          #rk-landing .rk-cmp-feat:empty { display: none; }
        }
      `}</style>
      <div id="rk-landing" dangerouslySetInnerHTML={{ __html: LANDING_HTML }} />
      {/* Closing CTA band — a REAL scan input (shared ScanInput), so the bottom
          "Analyze my site" works in place instead of being a dead captured
          button (autoFocus stays false; only the hero grabs focus). */}
      <LandingFinalCta />
      <LandingHydrate />
    </>
  );
}
