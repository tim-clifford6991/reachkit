import { redirect } from "next/navigation";

/**
 * `/app` is the Dashboard home — the at-a-glance score/competitor/keyword story
 * that Supply / Demand / Synthesis / Plans drill into. Auth + onboarding gating
 * happen in resolveIntelContext (inside the dashboard page).
 */
export default function AppDashboardPage() {
  redirect("/app/dashboard");
}
