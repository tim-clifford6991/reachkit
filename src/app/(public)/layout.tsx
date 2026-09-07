// src/app/(public)/layout.tsx
//
// BP-001 decision "three route groups — `(public)`, `(account)`, `(hosted)`
// — with the authorisation rule attached to the group rather than to the
// route". This group declares nothing about sessions — "Every route under
// `src/app/(public)/**` renders without a session, a cookie or a payment" —
// and the group's own existence, matched by `src/middleware.ts`, is the
// authorisation boundary. There is no check to write in this file.
//
// **It is no longer a pass-through** (issue #266). The owner's 2026-09-07
// review of dev — "barely a shell — we are clearly missing the UI framework,
// navbars, footers" — is answered here, once, for every public route:
// `/`, `/pricing`, `/signin`, `/scan/{domain}`, `/veto/{token}`,
// `/opt-out/{token}` and the three legal pages all render inside the same
// header and footer with no per-route edit. That is the whole reason the
// chrome lives in the group layout rather than in a component each screen
// remembers to call: a screen that forgot it would be the only way to break
// the promise, and there is no screen that renders it.
//
// **The header's CTA is not drawn on the landing.** The master's ruling on
// #266's mockup is one solid primary per screen; on `/` that primary is the
// hero's own control, so this layout tells the header which route it is on
// rather than letting the header read the pathname — a header that reads the
// route would be a second place that rule lives.
//
// **`(account)` and `(hosted)` get none of this.** §4.4's sidebar is the
// app shell's own chrome, and a hosted page is the customer's site, not
// ours — putting our header on it would be the product speaking on someone
// else's domain.
"use client";

import type React from "react";
import { usePathname } from "next/navigation";
import { Header } from "./_chrome/Header";
import { Footer } from "./_chrome/Footer";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const pathname = usePathname();
  return (
    <div className="rk-public-shell">
      <Header showCta={pathname !== "/"} />
      {children}
      <Footer />
    </div>
  );
}
