import type { Metadata } from "next";
import { ScanningCapture } from "@/components/design/captured/scanning-capture";

export const metadata: Metadata = { title: "Captured · Scanning", robots: { index: false } };

export default function Page() {
  return <ScanningCapture />;
}
