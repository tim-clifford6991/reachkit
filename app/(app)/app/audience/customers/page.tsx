import { Suspense } from "react";
import { resolveIntelContext } from "@/lib/app/intel-context";
import { CompetitorSetup } from "@/components/app/intel/competitor-setup";
import { CustomersView } from "@/components/app/intel/customers-view";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({ title: "Customers", path: "/app/audience/customers" });

export default function CustomersPage() {
  return (
    <Suspense fallback={null}>
      <CustomersContent />
    </Suspense>
  );
}

async function CustomersContent() {
  const ctx = await resolveIntelContext("/app/audience/customers");
  if (!ctx.domain) return <p className="py-16 text-center text-sm text-neutral-400">Add your product URL in Settings to begin.</p>;
  if (ctx.competitors.length === 0) return <CompetitorSetup domain={ctx.domain} />;
  return <CustomersView />;
}
