import { redirect } from "next/navigation";

/**
 * /app/plans (the old "Queue" tab) is absorbed into the singular plan page —
 * one place to see what to do, when, and what was done. Redirect so old links
 * and muscle memory keep working.
 */
export default function PlansPage() {
  redirect("/app/plan");
}
