"use client";

/**
 * MarketingChrome — wraps marketing children with the shared nav + footer, EXCEPT
 * on full-bleed routes (auth) which own the whole viewport. The nav is passed in
 * as a (Suspense-wrapped, auth-aware) server node so the cookie read stays out of
 * the static prerender path; the suppression decision stays client-side
 * (usePathname). On full-bleed routes the nav node is never rendered, so its
 * auth lookup never runs.
 */

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Footer, type FooterContent } from "@/components/sections/footer";

// Routes that render full-bleed (no shared nav/footer).
const FULL_BLEED = new Set<string>(["/login"]);

export function MarketingChrome({
  nav,
  footer,
  children,
}: {
  nav: ReactNode;
  footer: FooterContent;
  children: ReactNode;
}) {
  const pathname = usePathname();
  if (FULL_BLEED.has(pathname)) {
    return <div className="flex min-h-dvh flex-col" style={{ background: "var(--c-surface)" }}>{children}</div>;
  }
  return (
    <div className="flex min-h-dvh flex-col overflow-x-hidden" style={{ background: "var(--c-surface)" }}>
      {nav}
      <div className="flex-1">{children}</div>
      <Footer content={footer} />
    </div>
  );
}
