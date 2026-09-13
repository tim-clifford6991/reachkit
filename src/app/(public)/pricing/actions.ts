// src/app/(public)/pricing/actions.ts — SPEC.md §3 (issue #624)
//
// The one action the price surface has: begin checkout, and go wherever the
// answer says. REQ-021 criterion 4's "one control … begins checkout with no
// account, sign-in, password or form asked first" — a Server Function posted
// to `/pricing` itself, so the route needs no API adapter and no second
// entry on the middleware allow-list.
//
// **A refusal is a written line, not a 500.** `createCheckoutSession`
// answers `{ ok: false }` for a return address that is not ours, an
// incomplete origin scan, and a vendor that refused; before issue #624 this
// threw, and the buyer got React's error screen instead of the offer. Both
// arms now end in a `redirect`, which is the one thing this file does with
// an answer: the vendor's URL, or this surface with the refused marker on
// it. Nothing here reads the reason — a surface renders one written line,
// and a vendor payload is not a sentence this product speaks.
"use server";

import { redirect } from "next/navigation";
import { createCheckoutSession } from "@/lib/account/checkout/session";
import { env } from "@/lib/config/env";
import { REFUSED_PATH } from "./state";

export async function startCheckout(): Promise<void> {
  const result = await createCheckoutSession({
    origin: { kind: "pricing" },
    returnTo: new URL("/pricing", env.NEXT_PUBLIC_APP_URL).toString(),
  });
  // Outside any `try`: `redirect` throws its own control-flow error, which a
  // catch here would swallow (Next's `redirect` reference, "Behavior").
  redirect(result.ok ? result.url : REFUSED_PATH);
}
