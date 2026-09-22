// BUILD §3 — the two pieces of the public header that follow the address.
// src/app/(public)/_chrome/HeaderArm.tsx
//
// `Header.tsx` is a Server Component and draws the whole bar; these two are
// the only parts of it that cannot be, because what they draw depends on
// which public route the reader is on and that can change without a request.
// A `<Link>` from `/` to `/pricing` re-renders the page beneath the group
// layout and not the layout itself, so a header arm decided once on the
// server would still be offering the landing's field on a screen that has
// no field — a control that does nothing, which is the defect SPEC §1's
// 2026-09-20 line names. `usePathname()` is what follows the address, and
// `./action.ts` is the rule it applies.
//
// **They hold no copy key** (#988). Each sentence arrives already written,
// resolved by `Header.tsx` on the server — the convention `GrowthLine` and
// `FieldCta` already state. That is what keeps the merged copy registry, 39
// kB of it, out of every public route's client bundle.
"use client";

import type React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CopyLink } from "../scan/[domain]/_address/copy-link";
import { FieldCta } from "../_landing/FieldCta";
import { headerActionFor, type HeaderAction } from "./action";

/**
 * The arm this render is at.
 *
 * `usePathname()` answers `null` where there is no router — a bar rendered
 * on its own by `src/app/not-found.tsx`'s own test, and by anything else
 * that draws the chrome outside a route. No address is not the landing and
 * not a report, so it takes the plain pair, which is the arm every public
 * route but those two takes anyway.
 */
function armHere(pathname: string | null): HeaderAction {
  return headerActionFor(pathname ?? "");
}

/**
 * The CTA, in whichever of its two forms this route takes: on the landing
 * it focuses the hero's field, so the page keeps exactly one submit
 * control; everywhere else it is a link to the landing.
 *
 * Outline on both arms — SPEC §1, 2026-09-14: each screen's own action is
 * its only solid button.
 */
export function HeaderCta(p: { label: string }): React.JSX.Element {
  return armHere(usePathname()).kind === "landing" ? (
    <FieldCta label={p.label} />
  ) : (
    <Link href="/" className="btn btn-outline btn-primary btn-sm sm:btn-md">
      {p.label}
    </Link>
  );
}

/**
 * The report address's copy control, where the route is a report and an
 * origin is bound to build one from — and nothing at all anywhere else.
 *
 * It stands in two places at two widths, so it draws its own wrapper: an
 * inline span in the bar from `sm`, a menu item in the phone menu below it.
 * The wrapper is this component's because the *absence* is too — a server
 * that wrapped a leaf which turned out to draw nothing would leave an empty
 * `<li>` in the menu on every screen that is not a report.
 */
export function HeaderCopyLink(p: {
  label: string;
  place: "bar" | "menu";
}): React.JSX.Element | null {
  const action = armHere(usePathname());
  if (action.kind !== "copy-link") return null;
  const control = <CopyLink canonicalUrl={action.canonicalUrl} label={p.label} />;
  return p.place === "menu" ? (
    <li>{control}</li>
  ) : (
    <span className="hidden sm:inline-flex">{control}</span>
  );
}
