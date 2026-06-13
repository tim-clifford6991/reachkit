/**
 * GSAP lazy wrappers — §20.3 set pieces
 *
 * All exports from this directory are dynamically imported with ssr:false
 * by the pages that use them. This file simply re-exports the components
 * for consumers that need a single import path.
 *
 * The actual dynamic() call with ssr:false MUST happen in the page file
 * (not here) so Next.js can tree-shake GSAP out of non-marketing chunks.
 *
 * See: app/(marketing)/page.tsx for the dynamic import pattern.
 */

export { HeroGsapWrapper } from "./hero-gsap-wrapper";
export { ScanScrollSequence } from "./scan-scroll-sequence";
