/**
 * §21.1 Marketing section library — barrel export
 *
 * Each section is a typed content-as-props component. Pages compose sections
 * by importing from here and passing a content object + optional CTA slots.
 */

export { Hero } from "./hero";
export type { HeroContent, HeroProps } from "./hero";

export { ScanInputSection } from "./scan-input-section";
export type { ScanInputSectionContent, ScanInputSectionProps } from "./scan-input-section";

export { SocialProofMarquee } from "./social-proof-marquee";
export type { MarqueeChip, SocialProofMarqueeContent, SocialProofMarqueeProps } from "./social-proof-marquee";

export { FeatureBento } from "./feature-bento";
export type { BentoCard, FeatureBentoContent, FeatureBentoProps } from "./feature-bento";

export { TeardownGrid } from "./teardown-grid";
export type { TeardownCard, TeardownGridContent, TeardownGridProps } from "./teardown-grid";

export { ComparisonTable } from "./comparison-table";
export type {
  ComparisonCellValue,
  ComparisonRow,
  ComparisonTableContent,
  ComparisonTableProps,
} from "./comparison-table";

export { PricingTable } from "./pricing-table";
export type { PricingTier, PricingTableContent, PricingTableProps } from "./pricing-table";

export { Faq } from "./faq";
export type { FaqContent, FaqProps } from "./faq";

export { FinalCta } from "./final-cta";
export type { FinalCtaContent, FinalCtaProps } from "./final-cta";

export { Footer } from "./footer";
export type {
  FooterNavItem,
  FooterNavColumn,
  FooterContent,
  FooterProps,
} from "./footer";

export { HowItWorksScroll } from "./how-it-works-scroll";
