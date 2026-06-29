import { Suspense } from "react";
import { resolveIntelContext } from "@/lib/app/intel-context";
import { CompetitorSetup } from "@/components/app/intel/competitor-setup";
import { PlansView } from "@/components/app/intel/plans-view";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({ title: "Plans", path: "/app/plans" });

export default function PlansPage() {
  return (
    <Suspense fallback={null}>
      <PlansContent />
    </Suspense>
  );
}

async function PlansContent() {
  const ctx = await resolveIntelContext("/app/plans");
  if (!ctx.domain) return <p className="py-16 text-center text-sm text-neutral-400">Add your product URL in Settings to begin.</p>;
  if (ctx.competitors.length === 0) return <CompetitorSetup domain={ctx.domain} />;
  return <PlansView />;
}
