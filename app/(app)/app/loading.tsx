/**
 * Route-level loading UI for the /app workspace (P4). Renders INSIDE the app
 * shell (the layout's ShellSkeleton owns the sidebar/header chrome) as an
 * instant content placeholder on navigation, before a page's own Suspense
 * boundary takes over. Reuses the shared DashboardSkeleton — /app lands on the
 * dashboard, and it reads as a neutral "content loading" block elsewhere.
 */
import { DashboardSkeleton } from "@/components/app/captured/skeletons";

export default function AppLoading() {
  return <DashboardSkeleton />;
}
