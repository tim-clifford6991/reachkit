import { resolveIntelContext } from "@/lib/app/intel-context";
import { CompetitorSetup } from "@/components/app/intel/competitor-setup";
import { DemandView } from "@/components/app/intel/demand-view";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({ title: "Demand", path: "/app/demand" });

export default async function DemandPage() {
  const ctx = await resolveIntelContext("/app/demand");
  if (!ctx.domain) return <p className="py-16 text-center text-sm text-neutral-400">Add your product URL in Settings to begin.</p>;
  if (ctx.competitors.length === 0) return <CompetitorSetup domain={ctx.domain} />;
  return <DemandView />;
}
