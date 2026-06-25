export { BrandMark } from "./BrandMark";
export { Button } from "./Button";
export { Badge } from "./Badge";
export { ScoreGauge } from "./ScoreGauge";
export { ScoreCard } from "./ScoreCard";
export { ComparisonTable } from "./ComparisonTable";
export { NavBar } from "./NavBar";
export { Footer } from "./Footer";
export { ScanInput } from "./ScanInput";
export { RankedFix } from "./RankedFix";
export { PositioningMirror } from "./PositioningMirror";
export { SearchGapTable } from "./SearchGapTable";
export { AppShell } from "./AppShell";
export { KpiCard } from "./KpiCard";
export { UnlockBand } from "./UnlockBand";
export { ScanningRing } from "./ScanningRing";
export { CompareCard } from "./CompareCard";
export { TeardownCard } from "./TeardownCard";
export { Testimonial } from "./Testimonial";
export { FaqItem } from "./FaqItem";
export { Alert } from "./Alert";
export { FeatureStep } from "./FeatureStep";
export { TextField } from "./TextField";
export { Tabs } from "./Tabs";
export { PricingTable } from "./PricingTable";
export { LandingHero } from "./LandingHero";
export { ResultsScreen } from "./ResultsScreen";
export { DashboardScreen } from "./DashboardScreen";

// Self-contained preview runtime: render any export with the SAME bundled React,
// so preview cards need no external/vendored React (avoids cross-instance errors).
import * as __React from "react";
import { createRoot as __createRoot } from "react-dom/client";
export function mount(Comp: any, props: any, el: any) {
  __createRoot(el).render(__React.createElement(Comp, props));
}
