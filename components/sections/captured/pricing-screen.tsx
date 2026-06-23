/**
 * PricingScreen — the Claude Design pricing page imported 1:1 (server-rendered
 * captured HTML + hydrated nav/CTAs). Carries its own nav + footer.
 */
import { PRICING_HTML } from "./pricing-html";
import { LandingHydrate } from "./landing-hydrate";

export function PricingScreen() {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap"
      />
      <div id="rk-pricing" dangerouslySetInnerHTML={{ __html: PRICING_HTML }} />
      <LandingHydrate rootId="rk-pricing" />
    </>
  );
}
