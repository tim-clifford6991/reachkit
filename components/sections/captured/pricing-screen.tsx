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
