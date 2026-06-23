import type { Metadata } from "next";
import { AppDashboardCapture } from "@/components/design/captured/app-dashboard-capture";

export const metadata: Metadata = { title: "Captured · App Dashboard", robots: { index: false } };

export default function Page() {
  return <AppDashboardCapture />;
}
