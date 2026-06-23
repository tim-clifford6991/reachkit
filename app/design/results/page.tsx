import type { Metadata } from "next";
import { ResultsCapture } from "@/components/design/captured/results-capture";

export const metadata: Metadata = { title: "Captured · Results", robots: { index: false } };

// Phase-1 checkpoint: the imported Claude Design "results" screen, rendered 1:1
// from the captured ground truth. No live data yet — this validates the UI
// fidelity of the capture→app pipeline before conversion/wiring proceeds.
export default function CapturedResultsPage() {
  return <ResultsCapture />;
}
