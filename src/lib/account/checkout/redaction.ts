// src/lib/account/checkout/redaction.ts — BUILD §13
//
// The one structured event the checkout path emits, and the reason it is a
// typed function rather than a `console.log` at each call site: this
// parameter list has no field an address, a VAT number, a card detail or a
// session URL could be put in. "The VAT number is logged nowhere" is
// therefore a property of the type, checked by the compiler on every call,
// rather than a review comment somebody has to remember.
//
// The session id is here on purpose — it is the handle that correlates a
// checkout with the account it opened, and it reaches no customer and buys
// nobody anything.
import type { CheckoutOrigin } from "./origin";

export interface CheckoutEvent {
  readonly sessionId: string;
  readonly originKind: CheckoutOrigin["kind"];
  readonly outcome: string;
}

export function checkoutEvent(e: CheckoutEvent): void {
  console.log(JSON.stringify({ event: "checkout", ...e }));
}
