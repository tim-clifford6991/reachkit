import { Suspense } from "react";
import { resolveIntelContext } from "@/lib/app/intel-context";
import { CompetitorSetup } from "@/components/app/intel/competitor-setup";
import { DistributionPlanView } from "@/components/app/intel/distribution-plan-view";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({ title: "Distribution", path: "/app/plan/distribution" });

export default function DistributionPage() {
  return (
    <Suspense fallback={null}>
      <DistributionContent />
    </Suspense>
  );
}

async function DistributionContent() {
  const ctx = await resolveIntelContext("/app/plan/distribution");
  if (!ctx.domain) return <p className="py-16 text-center text-sm text-neutral-400">Add your product URL in Settings to begin.</p>;
  if (ctx.competitors.length === 0) return <CompetitorSetup domain={ctx.domain} />;
  return <DistributionPlanView />;
}
