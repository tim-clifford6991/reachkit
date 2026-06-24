import type { Metadata } from "next";
import { AppHistoryCapture } from "@/components/design/captured/app-history-capture";

export const metadata: Metadata = { title: "Captured · App History", robots: { index: false } };

export default function Page() {
  return <AppHistoryCapture />;
}
