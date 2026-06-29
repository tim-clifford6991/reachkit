import { redirect } from "next/navigation";

/**
 * The dashboard is split into Supply / Demand / Synthesis / Plans. `/app` forwards
 * to Supply (the entry point); auth + onboarding gating happen in resolveIntelContext.
 */
export default function AppDashboardPage() {
  redirect("/app/supply");
}
