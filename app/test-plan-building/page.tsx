/**
 * /test-plan-building — fixture render of the proof-of-work build experience
 * (PlanBuildingHero mid-stream: some stages done with details, one active,
 * rest pending). No auth / no gathers.
 */
import { PlanBuildingHero } from "@/components/app/intel/plan-building";

const STAGES = [
  { key: "funnel:profile", label: "Profiling your site", done: true },
  { key: "funnel:competitors", label: "Finding & ranking competitors", detail: "Found 4 competitors", done: true },
  { key: "funnel:backlinks", label: "Measuring traffic & backlinks", done: true },
  { key: "funnel:gaps", label: "Mapping content gaps", done: true },
  { key: "kw:gaps", label: "Finding keyword gaps", detail: "23 gaps your rivals win", done: true },
  { key: "demand:icp", label: "Understanding your buyers", done: false },
];

export default function TestPlanBuildingPage() {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px", background: "var(--c-bg)" }}>
      <PlanBuildingHero stages={STAGES} />
    </main>
  );
}
