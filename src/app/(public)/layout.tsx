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
// **The header's CTA is drawn on every route it belongs on, the landing
// included** (ruling 2b, 2026-09-08). What changes between routes is what
// it does: on `/` it is REQ-099 c3's control and brings the hero's own
// field into view; off `/` it is a link to the landing. Three routes
// replace it rather than change it — the report address, whose slot is
// REQ-001 c7's copy control, and the two token pages, where the set draws
// the page's own address and no control at all. This layout tells the header
// which route
// it is on rather than letting the header read the pathname — a header that
// reads the route would be a second place that rule lives.
//
// **`(account)` and `(hosted)` get none of this.** §4.4's sidebar is the
// app shell's own chrome, and a hosted page is the customer's site, not
// ours — putting our header on it would be the product speaking on someone
// else's domain.
"use client";

import type React from "react";
import { usePathname } from "next/navigation";
import { Header, type HeaderAction } from "./_chrome/Header";
import { Footer } from "./_chrome/Footer";
import { canonicalUrl } from "./_chrome/canonical";

/** The routes whose right slot is not ruling 3a's pair: the landing, whose
 *  CTA is its own field (REQ-099 c3); the report address, whose slot is
 *  REQ-001 c7's copy control; and the two token pages, whose slot is each
 *  page's own address (UI-SPEC S6, S7). */
const LANDING = "/";
/** The one public route the header does not stand on (UI-SPEC S9). */
const SIGN_IN = "/signin";
const REPORT_PREFIX = "/scan/";
/** The bar on the two pages a mail's link lands on: the address quiet on
 *  the right, and neither half of 3a's pair. #371 wired S6's; this is S7's,
 *  drawn the same way in the set and taking the same arm — one rendering
 *  for the two, because they are one drawing. */
const VETO_PREFIX = "/veto/";
const OPT_OUT_PREFIX = "/opt-out/";

function actionFor(pathname: string): HeaderAction {
  if (pathname === LANDING) return { kind: "landing" };
  // The address as it stands, not a composed one: the bar states where the
  // reader is, and the token is already in the address bar above it.
  if (pathname.startsWith(VETO_PREFIX) || pathname.startsWith(OPT_OUT_PREFIX)) {
    return { kind: "address", address: pathname };
  }
  if (pathname.startsWith(REPORT_PREFIX)) {
    const url = canonicalUrl(pathname);
    // No origin bound at build time is no address to copy: the pair stands
    // in rather than a control that would copy a broken one.
    return url === null ? { kind: "cta" } : { kind: "copy-link", canonicalUrl: url };
  }
  return { kind: "cta" };
}

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const pathname = usePathname();
  // **The sign-in screen carries no header and no footer** (UI-SPEC S9,
  // issues #373 and #505). It is drawn as two full-height panels meeting the
  // viewport's edges, with the brand inside the left one, and the set's S9
  // renders no `pubFoot()` under them; a bar across the top or a footer
  // below would be a third band, and would put controls on the one screen
  // whose whole job is a single field. S9 is the one public screen UI-SPEC
  // draws without the footer; every other public page carries it (3a).
  // Named here rather than read as a flag, because this file is already
  // where the chrome's per-route decisions live.
  const bare = pathname === SIGN_IN;
  return (
    <div className="rk-public-shell">
      {bare ? null : <Header action={actionFor(pathname)} />}
      {children}
      {bare ? null : <Footer />}
    </div>
  );
}
