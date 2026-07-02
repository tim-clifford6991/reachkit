import { Suspense } from "react";
import { resolveIntelContext } from "@/lib/app/intel-context";
import { CompetitorSetup } from "@/components/app/intel/competitor-setup";
import { SynthesisView } from "@/components/app/intel/synthesis-view";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({ title: "Content", path: "/app/plan/content" });

export default function ContentPage() {
  return (
    <Suspense fallback={null}>
      <ContentContent />
    </Suspense>
  );
}

async function ContentContent() {
  const ctx = await resolveIntelContext("/app/plan/content");
  if (!ctx.domain) return <p className="py-16 text-center text-sm text-neutral-400">Add your product URL in Settings to begin.</p>;
  if (ctx.competitors.length === 0) return <CompetitorSetup domain={ctx.domain} />;
  return <SynthesisView />;
}
