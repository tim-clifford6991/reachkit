// Pricing's one control: start checkout with no account asked first, and land on the vendor or on the refused line.
"use server";

import { startCheckoutFrom } from "@/lib/account/checkout/session";
import { PRICING_PATH } from "./state";

export async function startCheckout(): Promise<void> {
  await startCheckoutFrom({ kind: "pricing" }, PRICING_PATH);
}
