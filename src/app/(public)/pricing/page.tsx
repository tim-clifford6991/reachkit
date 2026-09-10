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
// layout's (ruling 3a).
import type React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Surface } from "@/ui/layout";
import { copy } from "@/lib/presentation/copy";
import { env } from "@/lib/config/env";
import { createCheckoutSession } from "@/lib/account/checkout/session";
import { PricingCard } from "../scan/[domain]/_modules/pricing";
import { PUBLIC_ROUTE_SEO } from "../_seo/routes";
import { staticMetadata } from "../_seo/metadata";

/** REQ-021 criterion 4's "one control … begins checkout with no account,
 *  sign-in, password or form asked first": a Server Function reached by the
 *  card's own submit. It posts to this page's own URL, which is why this
 *  route needs no second entry on the middleware allow-list and no API
 *  adapter of its own.
 *
 *  `createCheckoutSession` throws `CheckoutNotImplementedError` until issue
 *  #33 lands; nothing here catches it, because a caught one would leave the
 *  buyer looking at a page that says a purchase began when none did. A
 *  refused session likewise throws: the written line a refused checkout owes
 *  its reader is REQ-020's and has no key yet — #33 brings both. */
async function startCheckout(): Promise<void> {
  "use server";
  const result = await createCheckoutSession({
    origin: { kind: "pricing" },
    returnTo: new URL("/pricing", env.NEXT_PUBLIC_APP_URL).toString(),
  });
  if (!result.ok) {
    throw new Error(`createCheckoutSession refused this purchase: ${result.reason}`);
  }
  redirect(result.url);
}

/** One reading column (design tokens §2b): the page is one decision, and a
 *  decision stretched across 1216px reads as a banner. */
const READING_MEASURE: React.CSSProperties = { maxWidth: "var(--w-read)" };

/** Issue #326: the one offer page (REQ-021 c4), and the one public route
 *  besides the landing a stranger may arrive at from a search result. */
export const metadata: Metadata = staticMetadata(PUBLIC_ROUTE_SEO.pricing);

export default function PricingPage(): React.JSX.Element {
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
      <main className="flex flex-col gap-5 p-4">
        <div className="mx-auto w-full text-center" style={READING_MEASURE}>
          {/* The eyebrow is `offer.start` — the same two words, from the
              key that owns them, rather than a second copy of them. */}
          <p className="eyebrow opacity-60">{copy("offer.start")}</p>
          <h1>{copy("pricing.heading")}</h1>
          <p className="rk-quiet">{copy("pricing.subline")}</p>
        </div>

        {/* REQ-021 c4's "exactly one offer": one card, and it is the
            report's own component with somewhere for Start to go. Nothing
            about the terms is restated here, so the two surfaces cannot
            drift. */}
        <div className="mx-auto w-full" style={READING_MEASURE}>
          {/* S4's own wording of the four terms (ruling 11a). The report's
              card keeps the owner's 2026-09-04 ruling; the facts are the
              same four either way, which is REQ-021 c4's "on the same
              terms". */}
          <PricingCard startAction={startCheckout} terms="pricing" />
        </div>

        <p className="t-explain mx-auto text-center opacity-60" style={READING_MEASURE}>
          {copy("pricing.footnote")}
        </p>
      </main>
    </Surface>
  );
}
