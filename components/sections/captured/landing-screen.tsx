/**
 * LandingScreen — the Claude Design landing page imported 1:1 (server-rendered
 * captured HTML for SEO/LCP) with interactivity hydrated by LandingHydrate. The
 * HTML stays out of the client bundle (server component imports it).
 */
import { LANDING_HTML } from "./landing-html";
import { LandingHydrate } from "./landing-hydrate";

export function LandingScreen() {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap"
      />
      <div id="rk-landing" dangerouslySetInnerHTML={{ __html: LANDING_HTML }} />
      <LandingHydrate />
    </>
  );
}
