// src/app/(public)/pricing/page.tsx — BUILD §4.1 module 6, REQ-021 c4/c5 (issue #19)
//
// The one price surface that stands away from any report (REQ-021 criterion
// 4): "it carries exactly one offer to subscribe, states the price on the
// terms REQ-022 criterion 1 fixes and what the subscription does on the same
// terms the offer at the end of a report states (criterion 2), and one
// control on it begins checkout with no account, sign-in, password or form
// asked first (REQ-020 criterion 1)."
//
// A Server Component. It reads no session, no cookie and no scan, and names
// no `scanId` anywhere: a scanless purchase carries no report (§13,
// "scanless — no fabricated scan id"), and the `pricing` arm of
// `CheckoutOrigin` has no field one could be put in.
//
// **The terms are iterated, never listed.** `offerTerms()` is the single
// derivation both this surface and the offer at the end of a report read,
// so criterion 4's "on the same terms" holds by construction: a row added
// there renders here with no edit. This file writes no sentence, formats no
// currency and states no number of its own.
//
// **Two of the nine sentences are still owner-owed** —
// `price.vat_included` and `offer.cancel_self_service`, both empty in the
// registry. `copy()` refuses to render an owner-owed key, so each is asked
// for through `isWritten` and left unsaid until the owner writes it, at
// which point it appears here with no code change. What each would say is
// carried today by a sentence the owner did rule: `price.interval` reads
// "per month, VAT included", and `offer.veto.window` ends "— and you can
// cancel any time, yourself". Named in the pull request, not papered over.
//
// **The screen root is a `Surface`** (ADR-093; DECISIONS 2026-09-02). One
// column at every band: the surface is one offer, and REQ-021's own
// non-goals leave "how the terms it states are laid out" to the blueprint
// that owns the surface. A second column arrives with a decision, not a
// media query.
import { redirect } from "next/navigation";
import { Btn } from "@/ui/components/Btn";
import { Card } from "@/ui/components/Card";
import { Divider } from "@/ui/components/Divider";
import { Surface } from "@/ui/layout";
import { env } from "@/lib/config/env";
import { copy, isWritten } from "@/lib/presentation/copy";
import { offerTerms } from "@/lib/presentation/offer";
import { createCheckoutSession } from "@/lib/account/checkout/session";

/** REQ-021 criterion 4's "one control … begins checkout with no account,
 *  sign-in, password or form asked first": a Server Function reached by the
 *  one submit below. It posts to this page's own URL, which is why this
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

export default function PricingPage(): React.JSX.Element {
  const terms = offerTerms();
  // The price is stated by iterating BP-030's own `PRICE_COPY_KEYS`, in
  // their declared order, rather than by naming three keys here — so a
  // fourth price sentence states itself with no edit. The first is split
  // out only because it is the numeral: §2.3, "Every numeral … is JetBrains
  // Mono with tabular-nums."
  const [amountKey, ...restPriceKeys] = terms.priceKeys;

  return (
    <Surface
      arms={{
        compact: { kind: "columns", count: 1 },
        medium: { kind: "same-as-below" },
        wide: { kind: "same-as-below" },
      }}
    >
      {/* A padding edge, for the reason `src/app/(public)/signin/page.tsx`
          states in full: it stops a child's top margin collapsing through
          `<body>` and leaving Next's own `<next-route-announcer>` outside
          it, and it keeps the card off the viewport edge at 320px. */}
      <main className="p-4">
        <Card
          state="default"
          title={
            <>
              <span className="num">{copy(amountKey)}</span>
              {restPriceKeys.map((key) =>
                isWritten(key) ? <span key={key}> {copy(key)}</span> : null
              )}
            </>
          }
        >
          <Divider />

          <ul>
            {terms.rows.map((row) => (
              <li key={row.key}>{copy(row.key, { value: row.value })}</li>
            ))}
          </ul>

          {isWritten(terms.cancelKey) ? <p>{copy(terms.cancelKey)}</p> : null}

          <form action={startCheckout}>
            <Btn type="submit" label={copy(terms.startKey)} variant="primary" />
          </form>
        </Card>
      </main>
    </Surface>
  );
}
