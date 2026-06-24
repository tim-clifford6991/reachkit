import type { Metadata } from "next";
import { LoginCapture } from "@/components/design/captured/login-capture";

export const metadata: Metadata = { title: "Captured · Login", robots: { index: false } };

export default function Page() {
  return <LoginCapture />;
}
