import { redirect } from "next/navigation";

/**
 * The content backlog is absorbed into the singular plan page — every
 * action's full analysis now lives in its detail popup on /app/plan.
 */
export default function ContentPage() {
  redirect("/app/plan");
}
