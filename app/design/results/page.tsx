import type { Metadata } from "next";
import { ResultsScreen } from "@/components/report/captured/results-screen";
import { RESULTS_DEMO } from "@/components/report/captured/results-demo";

export const metadata: Metadata = { title: "Captured · Results (React)", robots: { index: false } };

// React conversion of the results screen rendered with the mockup's exact demo
// data — verifies 1:1 fidelity before live-data wiring in the real route.
export default function CapturedResultsPage() {
  return <ResultsScreen {...RESULTS_DEMO} />;
}
