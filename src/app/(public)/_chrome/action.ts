// BUILD §3 — which arm the public header's right slot takes, for a path.
// src/app/(public)/_chrome/action.ts
//
// SPEC §1, owner 2026-09-15 (issue 714): the same bar on every public route,
// and what changes between them is only what the CTA does — on `/` it brings
// the hero's own field into view, elsewhere it links to the landing — with
// the report address adding its copy control beside the pair. This is that
// one rule, and the only place it is decided.
//
// **Its own file since #988**, and the reason is which side of the network
// each reader is on. `Header.tsx` is a Server Component that resolves every
// sentence on the bar through `copy()`; the two leaves that *pick* an arm
// are Client Components, because the arm follows the address and the address
// can change without a request (a `<Link>` inside the group re-renders no
// layout above it). A client leaf importing this rule from `Header.tsx`
// would pull `copy()` — and with it all sixteen copy partitions, 39 kB —
// back into the bundle the whole split was there to empty. So the rule sits
// below both: pure, no copy key, no component.
import { canonicalUrl } from "./canonical";

/** What the bar's right slot holds beside Sign in. A closed union, so a
 *  fourth kind of chrome cannot arrive without a rendering. */
export type HeaderAction =
  /** The header CTA as a link to the landing. */
  | { kind: "cta" }
  /** The CTA focusing the landing's own field. */
  | { kind: "landing" }
  /** The report address: its Copy link, then the CTA as a link. */
  | { kind: "copy-link"; canonicalUrl: string };

const REPORT_PREFIX = "/scan/";

/** The bar's arm for a public path. Pure, so the one per-route rule is
 *  asserted where it is written. No origin bound at build time is no
 *  address to copy: the report then takes the plain arm. */
export function headerActionFor(pathname: string): HeaderAction {
  if (pathname === "/") return { kind: "landing" };
  if (pathname.startsWith(REPORT_PREFIX)) {
    const url = canonicalUrl(pathname);
    return url === null ? { kind: "cta" } : { kind: "copy-link", canonicalUrl: url };
  }
  return { kind: "cta" };
}
