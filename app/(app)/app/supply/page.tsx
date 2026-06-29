import { resolveIntelContext } from "@/lib/app/intel-context";
import { CompetitorSetup } from "@/components/app/intel/competitor-setup";
import { SupplyView } from "@/components/app/intel/supply-view";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({ title: "Supply", path: "/app/supply" });

export default async function SupplyPage() {
  const ctx = await resolveIntelContext("/app/supply");
  if (!ctx.domain) return <p className="py-16 text-center text-sm text-neutral-400">Add your product URL in Settings to begin.</p>;
  if (ctx.competitors.length === 0) return <CompetitorSetup domain={ctx.domain} />;
  return <SupplyView />;
}
