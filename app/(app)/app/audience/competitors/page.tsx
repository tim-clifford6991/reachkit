import { Suspense } from "react";
import { resolveIntelContext } from "@/lib/app/intel-context";
import { CompetitorSetup } from "@/components/app/intel/competitor-setup";
import { CompetitorsView } from "@/components/app/intel/competitors-view";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({ title: "Competitors", path: "/app/audience/competitors" });

export default function CompetitorsPage() {
  return (
    <Suspense fallback={null}>
      <CompetitorsContent />
    </Suspense>
  );
}

async function CompetitorsContent() {
  const ctx = await resolveIntelContext("/app/audience/competitors");
  if (!ctx.domain) return <p className="py-16 text-center text-sm text-neutral-400">Add your product URL in Settings to begin.</p>;
  if (ctx.competitors.length === 0) return <CompetitorSetup domain={ctx.domain} />;
  return <CompetitorsView />;
}
