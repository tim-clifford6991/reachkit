import type { Metadata } from "next";
import type { ReactNode } from "react";

/* BUILD.md §1: Plus Jakarta Sans (UI) + JetBrains Mono (all numerals/data),
   "@fontsource, self-hosted". These imports are the whole font story — no
   Google Fonts request, no CDN, nothing leaves the machine. BP-004 renders
   these same faces from a customer's own domain, which is why self-hosting
   is a stack fact and not a preference. */
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/plus-jakarta-sans/800.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/700.css";

import "./globals.css";
import { PreviewChrome } from "@/components/chrome/PreviewChrome";

export const metadata: Metadata = {
  title: "ReachKit — preview app",
  description: "Preview artifact. Not production code, and nothing in it is signed.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PreviewChrome />
        {children}
      </body>
    </html>
  );
}
