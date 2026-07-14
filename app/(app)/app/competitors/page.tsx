import { Suspense } from "react";
import { resolveIntelContext } from "@/lib/app/intel-context";
import { CompetitorSetupLazy as CompetitorSetup } from "@/components/app/competitor-setup-lazy";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({ title: "Competitors", path: "/app/competitors" });

// Always shows the competitor picker so the cohort can be (re)chosen at any time
// — the manual entry point to the onboarding selection step. The auth/cohort read
// lives in an async child inside <Suspense> so the route prerenders (Next 16
// cacheComponents) instead of failing on uncached cookie access.
export default function CompetitorsPage() {
  return (
    <Suspense fallback={null}>
      <CompetitorsContent />
    </Suspense>
  );
}

async function CompetitorsContent() {
  const ctx = await resolveIntelContext("/app/competitors");
  if (!ctx.domain) return <p className="py-16 text-center text-sm text-neutral-400">Add your product URL in Settings to begin.</p>;
  // Pre-check the SAVED cohort (ctx.competitors = getSelectedCompetitors) so
  // re-picking edits the real selection; first-time users (no cohort yet) get
  // the discovery-suggested defaults.
  return <CompetitorSetup domain={ctx.domain} initialSelected={ctx.competitors} />;
}
