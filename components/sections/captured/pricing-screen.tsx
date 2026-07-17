/**
 * PricingScreen — the Claude Design pricing page imported 1:1 (server-rendered
 * captured HTML + hydrated nav/CTAs). Carries its own nav + footer.
 */
import { PRICING_HTML } from "./pricing-html";
import { LandingHydrate } from "./landing-hydrate";
import { HERO_FADE_GLOW } from "@/components/sections/hero-fade";

export function PricingScreen() {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap"
      />
      {/* Mobile: the captured HTML sets grid tracks inline, which beat any
          stylesheet rule — so the 4-column "Compare every plan" table (which
          crushes each plan column to ~60px on a phone) is overridden here with
          `!important`, scoped to a mobile media query so desktop is untouched.
          Below 640px each row becomes: feature label on its own full-width line,
          then the three plan values in a 3-up row beneath it. The plan cards and
          FAQ collapse via inline auto-fit and need no rule. */}
      <style>{`
        @media (max-width: 640px) {
          #rk-pricing .rk-cmp-row { grid-template-columns: repeat(3, 1fr) !important; }
          #rk-pricing .rk-cmp-feat { grid-column: 1 / -1; text-align: left !important; padding-bottom: 4px !important; }
        }
      `}</style>
      <div style={{ position: "relative" }}>
        {/* Shared page-hero fade — the same top glow the intel-kit marketing
            headers use, dropped behind the captured pricing hero so pricing's
            header reads consistently with how-it-works / teardowns / compare. */}
        <div aria-hidden style={{ position: "absolute", inset: "0 0 auto 0", height: 460, background: HERO_FADE_GLOW, pointerEvents: "none" }} />
        <div id="rk-pricing" style={{ position: "relative" }} dangerouslySetInnerHTML={{ __html: PRICING_HTML }} />
      </div>
      <LandingHydrate rootId="rk-pricing" />
    </>
  );
}
