// UI-SPEC S8 — the not-found screen for an address this product does not have.
// src/app/not-found.tsx
//
// **The root `not-found` is the only one an unmatched URL ever reaches.**
// `not-found.md`, "Good to know": "the root `app/not-found.js` … handles any
// unmatched URLs for your whole application." A route group's own
// `not-found.tsx` is a `notFound()` boundary and nothing else — it is
// rendered when a page inside that group calls `notFound()`, never because
// Next matched no route. Issue #372 built both of those and neither could
// be reached by a mistyped address, so `/anything` answered with Next's
// built-in "This page could not be found" (issue #405).
//
// **It belongs to no route group, so it draws its own chrome.** Every other
// public screen gets ruling 3a's header and footer from
// `(public)/layout.tsx`; this file renders above all three groups, inside
// `src/app/layout.tsx` alone, so the shell is written here — the same
// `rk-public-shell` element, the same `Header` and the same `Footer`, so a
// stranger who mistypes an address lands somewhere that looks like the
// product and carries the way out of it.
//
// **The screen itself is not a copy of the public 404 — it *is* the public
// 404.** `(public)/not-found.tsx` is imported and rendered, so S8's line,
// its scan field and its `Scan it` cannot drift from the group's arm the
// way a second composition of the same three keys would. What this file
// adds is the one thing a root file does not inherit.
//
// **The header's slot is ruling 3a's pair.** An address that matches no
// route is not the landing, not a report and not a token page, so it takes
// the default arm `(public)/layout.tsx` gives every other route: quiet
// *Sign in*, one solid CTA. It is a value written here, never a pathname
// read — for the same reason that layout passes one rather than letting
// the header look.
//
// **An unmatched address under `/app` is served this screen too**, in the
// public chrome, because Next reaches this file rather than
// `(account)/not-found.tsx` for anything it did not match. Telling the two
// apart would mean reading the request's path here, and a `not-found` that
// read `headers()` would be a dynamic 404 on every public address; the
// account arm stays what it is — the group's `notFound()` boundary.
//
// A Server Component: it reads no session, no cookie and no store.
import type React from "react";
import PublicNotFound from "@/app/(public)/not-found";
import { Header, type HeaderAction } from "@/app/(public)/_chrome/Header";
import { Footer } from "@/app/(public)/_chrome/Footer";

/** Ruling 3a's pair, the arm every public route but four carries. */
const ACTION: HeaderAction = { kind: "cta" };

/** A test hook, never a sentence — bound to a name for the same reason
 *  every other test id in `src/app/**` is (ADR-010 point 1). */
const TEST_ID = "root-not-found";

export default function RootNotFound(): React.JSX.Element {
  return (
    <div className="rk-public-shell" data-testid={TEST_ID}>
      <Header action={ACTION} />
      <PublicNotFound />
      <Footer />
    </div>
  );
}
