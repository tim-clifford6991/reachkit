import { resolveIntelContext } from "@/lib/app/intel-context";
import { CompetitorSetup } from "@/components/app/intel/competitor-setup";
import { SynthesisView } from "@/components/app/intel/synthesis-view";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({ title: "Synthesis", path: "/app/synthesis" });

export default async function SynthesisPage() {
  const ctx = await resolveIntelContext("/app/synthesis");
  if (!ctx.domain) return <p className="py-16 text-center text-sm text-neutral-400">Add your product URL in Settings to begin.</p>;
  if (ctx.competitors.length === 0) return <CompetitorSetup domain={ctx.domain} />;
  return <SynthesisView />;
}
