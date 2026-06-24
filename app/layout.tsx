import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Space_Grotesk, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";

/* ── "Violet Discoverability" type system (from Claude Design ReachKit.dc.html) ──
   Display = Space Grotesk · UI/body = Plus Jakarta Sans · numbers/code = JetBrains
   Mono. Loaded here as CSS variables; globals.css repoints --font-* onto them. */
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  weight: ["400", "500", "700"],
});
import { ThemeProvider } from "@/components/motion/theme-provider";
import { LazyToaster } from "@/components/ui/lazy-toaster";
import { SITE } from "@/lib/seo";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: "ReachKit",
  description: "The distribution system for solo founders.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${spaceGrotesk.variable} ${plusJakarta.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <NuqsAdapter>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <LazyToaster />
          </ThemeProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
