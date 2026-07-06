import { redirect } from "next/navigation";

/**
 * The distribution backlog is absorbed into the singular plan page — every
 * action's full analysis now lives in its detail popup on /app/plan.
 */
export default function DistributionPage() {
  redirect("/app/plan");
}
