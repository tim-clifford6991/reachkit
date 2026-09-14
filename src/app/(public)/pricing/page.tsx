// src/app/(public)/pricing/page.tsx — BUILD §4.1 module 6, REQ-021 c4/c5 (issue #19)
//
// The one price surface that stands away from any report (REQ-021 criterion
// 4): "it carries exactly one offer to subscribe, states the price on the
// terms REQ-022 criterion 1 fixes and what the subscription does on the same
// terms the offer at the end of a report states (criterion 2), and one
// control on it begins checkout with no account, sign-in, password or form
// asked first (REQ-020 criterion 1)."
//
// **"On the same terms" is one component, not two lists.** The offer is
// `PricingCard` — BUILD §4.1 module 6, written for the end of the report
// (issue #13) — rendered here with somewhere for Start to go. Nothing about
// the terms is restated in this file, so the two surfaces cannot drift:
// a row added to that card appears here with no edit, which is the strongest
// available reading of criterion 4.
//
// A Server Component. It reads no session, no cookie and no scan, and names
// no `scanId` anywhere: a scanless purchase carries no report (§13,
// "scanless — no fabricated scan id"), and the `pricing` arm of
// `CheckoutOrigin` has no field one could be put in.
//
// **The screen root is a `Surface`** (ADR-093; DECISIONS 2026-09-02). One
// column at every band: the surface is one offer, and REQ-021's own
// non-goals leave "how the terms it states are laid out" to the blueprint
// that owns the surface. A second column arrives with a decision, not a
// media query.
//
// **The page around the offer is UI-SPEC S4** (issue #369): an eyebrow, a
// heading and a subline above the card, and REQ-020 c1's promise under it
// — "No account before payment. Your site is asked for after". All of it at
// the reading measure and centred, which is how the set draws a page whose
// whole content is one decision. The chrome above and below is the group
// layout's (ruling 3a). Tailwind's scale in the route (DESIGN rule 1): no
// type-ladder classes and no `var(--w-read)`.
import React, { use } from "react";
import type { Metadata } from "next";
import { Surface } from "@/ui/layout";
import { copy } from "@/lib/presentation/copy";
import { PricingCard } from "../scan/[domain]/_modules/pricing";
import { PUBLIC_ROUTE_SEO } from "../_seo/routes";
import { staticMetadata } from "../_seo/metadata";
import { startCheckout } from "./actions";
import { CHECKOUT_QUERY_KEY, REFUSED_MARKER, type PricingSearchParams } from "./state";

function isPromise<T>(value: Promise<T> | T | undefined): value is Promise<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

/** Accepts a real `searchParams` Promise (production) or an already-plain
 *  object (this file's own tests), on the terms
 *  `src/app/(public)/signin/page.tsx` established. */
function usePricingSearchParams(
  searchParams: Promise<PricingSearchParams> | PricingSearchParams | undefined
): PricingSearchParams {
  if (isPromise(searchParams)) return use(searchParams);
  return searchParams ?? {};
}

/** Issue #326: the one offer page (REQ-021 c4), and the one public route
 *  besides the landing a stranger may arrive at from a search result. */
export const metadata: Metadata = staticMetadata(PUBLIC_ROUTE_SEO.pricing);

export default function PricingPage(props: {
  searchParams?: Promise<PricingSearchParams> | PricingSearchParams;
}): React.JSX.Element {
  // Issue #624: the one thing this surface reads off its own address — the
  // marker `startCheckout` sends a refused purchase back with, so the offer
  // states what happened instead of the route throwing.
  const refused = usePricingSearchParams(props.searchParams)[CHECKOUT_QUERY_KEY] === REFUSED_MARKER;

  return (
    <Surface
      arms={{
        compact: { kind: "columns", count: 1 },
        medium: { kind: "same-as-below" },
        wide: { kind: "same-as-below" },
      }}
    >
      {/* A padding edge, so a child's top margin does not collapse through
          `<body>` and so the card is not against the viewport edge at
          320px. */}
      <main className="flex flex-col gap-6 p-4">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-2 text-center">
          {/* The eyebrow is `offer.start` — the same two words, from the
              key that owns them, rather than a second copy of them. */}
          <p className="text-base-content/60 text-xs font-semibold tracking-wide uppercase">{copy("offer.start")}</p>
          <h1 className="text-3xl font-semibold">{copy("pricing.heading")}</h1>
          <p className="text-base-content/70">{copy("pricing.subline")}</p>
        </div>

        {/* REQ-021 c4's "exactly one offer": one card, and it is the
            report's own component with somewhere for Start to go. Nothing
            about the terms is restated here, so the two surfaces cannot
            drift. */}
        <div className="mx-auto w-full max-w-xl">
          {/* S4's own wording of the four terms (ruling 11a). The report's
              card keeps the owner's 2026-09-04 ruling; the facts are the
              same four either way, which is REQ-021 c4's "on the same
              terms". */}
          <PricingCard startAction={startCheckout} terms="pricing" refused={refused} />
        </div>

        <p className="text-base-content/60 mx-auto max-w-xl text-center text-sm">
          {copy("pricing.footnote")}
        </p>
      </main>
    </Surface>
  );
}
