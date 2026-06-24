"use client";

/**
 * MarketingChrome — wraps marketing children with the shared nav + footer, EXCEPT
 * on full-bleed routes (auth) which own the whole viewport. Receives the
 * server-resolved auth state so the nav stays auth-aware while the suppression
 * decision stays client-side (usePathname).
 */

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { MarketingNav } from "@/components/sections/marketing-nav";
import { Footer, type FooterContent } from "@/components/sections/footer";

// Routes that render full-bleed (no shared nav/footer).
const FULL_BLEED = new Set<string>(["/login"]);

export function MarketingChrome({
  isLoggedIn,
  footer,
  children,
}: {
  isLoggedIn: boolean;
  footer: FooterContent;
  children: ReactNode;
}) {
  const pathname = usePathname();
  if (FULL_BLEED.has(pathname)) {
    return <div className="flex min-h-dvh flex-col" style={{ background: "#fff" }}>{children}</div>;
  }
  return (
    <div className="flex min-h-dvh flex-col overflow-x-hidden" style={{ background: "#fff" }}>
      <MarketingNav isLoggedIn={isLoggedIn} />
      <div className="flex-1">{children}</div>
      <Footer content={footer} />
    </div>
  );
}
