import { resolveIntelContext } from "@/lib/app/intel-context";
import { CompetitorSetup } from "@/components/app/intel/competitor-setup";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({ title: "Competitors", path: "/app/competitors" });

// Always shows the competitor picker so the cohort can be (re)chosen at any time
// — the manual entry point to the onboarding selection step.
export default async function CompetitorsPage() {
  const ctx = await resolveIntelContext("/app/competitors");
  if (!ctx.domain) return <p className="py-16 text-center text-sm text-neutral-400">Add your product URL in Settings to begin.</p>;
  return <CompetitorSetup domain={ctx.domain} />;
}
