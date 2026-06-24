/**
 * LandingScreen — the Claude Design landing page. The hero is now the SHARED
 * <ScanHero/> (same component as /scan, so the "analyze my site" experience is
 * identical everywhere); the rest of the page is the captured HTML below the hero
 * (server-rendered for SEO/LCP, interactivity hydrated by LandingHydrate).
 */
import { LANDING_HTML } from "./landing-html";
import { LandingHydrate } from "./landing-hydrate";
import { ScanHero } from "@/components/sections/scan-hero";

// Everything after the captured hero (the first <section>…</section>), minus the
// wrapping <main>. ScanHero replaces the captured hero.
const REST_HTML = LANDING_HTML.slice(LANDING_HTML.indexOf("</section>") + "</section>".length).replace(/<\/main>\s*$/, "");

export function LandingScreen() {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap"
      />
      <ScanHero />
      <div id="rk-landing" dangerouslySetInnerHTML={{ __html: REST_HTML }} />
      <LandingHydrate />
    </>
  );
}
