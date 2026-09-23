// UI-SPEC S9 — the sign-in screen's `<head>`, and nothing else.
// src/app/(public)/signin/layout.tsx — issue #326
//
// `page.tsx` is a Client Component — S9 is a form with an action state and
// a pending control — and Next reads `metadata` only from a Server
// Component. So this route's two sentences are exported from a segment
// layout, which is a server module by default, rather than by splitting the
// screen in two around a wrapper that exists to hold a string.
//
// **It renders `{children}` and adds nothing.** The group layout above it
// draws the public header and footer, and the screen between them is the
// Round 7 full-width split (#1025); a second element here would be a third
// band on a screen drawn as two.
//
// **`noindex`, from the table** (`_seo/routes.ts`): a sign-in form has
// nothing to rank and is the one public screen whose job is to hand out a
// credential by mail. It stays reachable and linked from every public
// header, and is left out of the index on purpose.
import type React from "react";
import type { Metadata } from "next";
import { PUBLIC_ROUTE_SEO } from "../_seo/routes";
import { staticMetadata } from "../_seo/metadata";

export const metadata: Metadata = staticMetadata(PUBLIC_ROUTE_SEO.signin);

export default function SignInLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return <>{children}</>;
}
